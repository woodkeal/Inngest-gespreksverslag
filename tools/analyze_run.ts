/**
 * analyze_run.ts — Debug tool for Inngest run analysis
 *
 * Usage: npx tsx tools/analyze_run.ts <runId> [conversationId]
 *
 * Collects all available data for a run (Inngest API, server logs, inngest logs),
 * sends it to Claude for analysis, and writes a diagnosis report to .tmp/debug_<runId>.md
 */

import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const INNGEST_BASE = "http://localhost:8288";
const SERVER_LOG = new URL("../.tmp/server.log", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const INNGEST_LOG = new URL("../.tmp/inngest.log", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

// ─── MCP helpers ────────────────────────────────────────────────────────────

async function mcpInit(): Promise<string> {
  const res = await fetch(`${INNGEST_BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "analyze_run", version: "1.0" } },
    }),
  });
  const sessionId = res.headers.get("Mcp-Session-Id") ?? "";
  return sessionId;
}

async function mcpCall(sessionId: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${INNGEST_BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  const json = await res.json() as { result?: { content?: Array<{ text?: string }> } };
  return json.result?.content?.[0]?.text ?? JSON.stringify(json);
}

async function inngestGet(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${INNGEST_BASE}${path}`);
    if (!res.ok) return `HTTP ${res.status}`;
    return await res.json();
  } catch {
    return "unreachable";
  }
}

// ─── Log helpers ─────────────────────────────────────────────────────────────

async function readLogLines(filePath: string): Promise<string[]> {
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf-8");
  return content.split("\n").filter(Boolean);
}

function filterByConversationId(lines: string[], conversationId: string): string[] {
  return lines.filter(l => l.includes(conversationId));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const runId = process.argv[2];
  if (!runId) {
    console.error("Usage: npx tsx tools/analyze_run.ts <runId> [conversationId]");
    process.exit(1);
  }
  const conversationIdHint = process.argv[3] ?? "";

  console.log(`\n🔍 Analysing run: ${runId}\n`);

  // 1. Inngest API
  console.log("→ Fetching run metadata...");
  const sessionId = await mcpInit();
  const runStatus = await mcpCall(sessionId, "get_run_status", { runId });
  const runMeta = await inngestGet(`/v1/runs/${runId}`);

  // 2. Derive conversationId from run meta if not provided
  let conversationId = conversationIdHint;
  if (!conversationId && typeof runMeta === "object" && runMeta !== null) {
    const meta = runMeta as Record<string, unknown>;
    const eventData = (meta.event as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    conversationId = (eventData?.sessionId ?? eventData?.conversationId ?? "") as string;
  }

  // 3. Logs
  console.log("→ Reading server logs...");
  const serverLines = await readLogLines(SERVER_LOG);
  const relevantServerLines = conversationId
    ? filterByConversationId(serverLines, conversationId)
    : serverLines.slice(-200);

  console.log("→ Reading Inngest logs...");
  const inngestLines = await readLogLines(INNGEST_LOG);
  // Keep errors + lines near the run's timestamps
  const relevantInngestLines = inngestLines.filter(l =>
    l.includes("ERROR") || l.includes("WARN") || l.includes(runId) || l.includes("function.finished")
  );

  // 4. Build context
  const context = `
## Run ID
${runId}

## Conversation ID
${conversationId || "(unknown)"}

## Inngest MCP run status
${runStatus}

## Inngest API run metadata
${JSON.stringify(runMeta, null, 2)}

## Server logs (filtered to conversationId)
${relevantServerLines.length > 0 ? relevantServerLines.join("\n") : "(no matching entries)"}

## Inngest dev server logs (errors + run events)
${relevantInngestLines.length > 0 ? relevantInngestLines.join("\n") : "(no relevant entries)"}
`.trim();

  // 5. Claude analysis
  console.log("→ Sending to Claude for analysis...");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `You are a debugging assistant for an Inngest-based AI pipeline (gespreksverslag — Dutch meeting notes automation).

The pipeline: WhatsApp/REST trigger → classifier → transcription (Groq Whisper) → report generation (Claude Sonnet) → HTML conversion (Claude Haiku) → email (SendGrid) → messenger confirmation.

Analyse the following run data and:
1. Build a step-by-step timeline of what happened
2. Identify the root cause of any failure or missing output
3. List specific code/config fixes with file paths
4. Suggest workflow documentation updates

Be precise and actionable. The codebase is TypeScript.

---

${context}`,
    }],
  });

  const analysis = message.content[0].type === "text" ? message.content[0].text : "(no text response)";

  // 6. Write report
  const reportPath = `${process.cwd()}/.tmp/debug_${runId}.md`;
  const report = `# Run Debug Report: ${runId}

Generated: ${new Date().toISOString()}

## Raw Data

<details>
<summary>Context sent to Claude</summary>

\`\`\`
${context}
\`\`\`
</details>

## Analysis

${analysis}
`;

  await writeFile(reportPath, report, "utf-8");
  console.log(`\n✅ Report written to: ${reportPath}\n`);
  console.log("─".repeat(60));
  console.log(analysis);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

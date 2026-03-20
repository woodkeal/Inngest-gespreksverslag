import Anthropic from "@anthropic-ai/sdk";
import type { ConversationFacts, ConversationMemory, ChatMessage } from "../types/memory.js";
import { logger } from "./logger.js";

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const MAX_RECENT_MESSAGES = 20;

const FACT_TRIGGERS = [
  /\bik heet\b/i,
  /\bmijn naam is\b/i,
  /\bik ben\b/i,
  /\bik werk\b/i,
  /\bik hou van\b/i,
  /\bliever\b/i,
  /\bmijn voorkeur\b/i,
];

// ─── Upstash REST client (fetch only, no npm package needed) ──────────────────

async function redisPipeline(commands: unknown[][]): Promise<unknown[]> {
  if (!BASE_URL || !TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  }
  const res = await fetch(`${BASE_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`Upstash pipeline failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as unknown[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadMemory(conversationId: string): Promise<ConversationMemory | null> {
  if (!BASE_URL || !TOKEN) return null;
  try {
    const results = await redisPipeline([["GET", `memory:${conversationId}`]]);
    const raw = (results[0] as { result: string | null }).result;
    if (!raw) return null;
    return JSON.parse(raw) as ConversationMemory;
  } catch (err) {
    logger.error("Geheugen laden mislukt", { conversationId, err });
    return null;
  }
}

export async function saveMemory(
  conversationId: string,
  userMessage: string,
  assistantReply: string,
  existing: ConversationMemory | null,
): Promise<void> {
  if (!BASE_URL || !TOKEN) return;
  try {
    const now = new Date().toISOString();

    const newMessages: ChatMessage[] = [
      { role: "user", content: userMessage, timestamp: now },
      { role: "assistant", content: assistantReply, timestamp: now },
    ];

    const recentMessages = [
      ...(existing?.recentMessages ?? []),
      ...newMessages,
    ].slice(-MAX_RECENT_MESSAGES);

    const facts = await extractFacts(userMessage, existing?.facts ?? {});

    const memory: ConversationMemory = {
      conversationId,
      facts,
      recentMessages,
      totalMessageCount: (existing?.totalMessageCount ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await redisPipeline([
      ["SET", `memory:${conversationId}`, JSON.stringify(memory), "EX", TTL_SECONDS],
    ]);

    logger.info("Geheugen opgeslagen", {
      conversationId,
      messages: recentMessages.length,
      hasFacts: Object.keys(facts).length > 0,
    });
  } catch (err) {
    logger.error("Geheugen opslaan mislukt", { conversationId, err });
    // Non-fatal: pipeline continues even if memory fails
  }
}

// ─── Fact extraction ──────────────────────────────────────────────────────────

function shouldExtractFacts(message: string): boolean {
  return FACT_TRIGGERS.some((re) => re.test(message));
}

async function extractFacts(
  userMessage: string,
  existingFacts: ConversationFacts,
): Promise<ConversationFacts> {
  if (!shouldExtractFacts(userMessage)) return existingFacts;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `Extract key facts about the user from this message. Return a valid JSON object with only the fields that are clearly present: name (string), language (string), preferences (string array), topics (string array). If nothing new is found, return {}. Return ONLY the JSON object, no explanation.`,
      messages: [
        {
          role: "user",
          content: `User message: "${userMessage}"\n\nExisting facts: ${JSON.stringify(existingFacts)}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const extracted = JSON.parse(text) as Partial<ConversationFacts>;

    // Merge arrays instead of replacing them
    return {
      ...existingFacts,
      ...extracted,
      preferences: [
        ...(existingFacts.preferences ?? []),
        ...(extracted.preferences ?? []),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      topics: [
        ...(existingFacts.topics ?? []),
        ...(extracted.topics ?? []),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
    };
  } catch {
    // Graceful degradation — never let fact extraction break the pipeline
    return existingFacts;
  }
}

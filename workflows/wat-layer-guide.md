# WAT Layer Guide: Tools vs. Functions vs. Agents

This guide defines the role of each layer in the WAT architecture and gives clear rules for where code belongs. Follow this before adding any new capability.

---

## Quick Decision Tree

```
New capability needed?
│
├─ Does it need AI reasoning or language generation?
│   └─ YES → Agent
│   └─ NO  → continue ↓
│
├─ Does it need durable execution (retry, concurrency, HITL)?
│   └─ YES → Function (step.run / step.invoke / step.waitForEvent)
│   └─ NO  → continue ↓
│
└─ Is it a single API call or pure transformation?
    └─ YES → Tool (called from an agent)
    └─ NO  → break it down further
```

---

## Tools

**Definition:** A tool is a single, atomic action an agent can call. It does one thing and returns a result. No routing, no state machine, no side effects beyond the intended API call.

**Rules:**
- One external API call per tool (Twilio, SendGrid, REST callback)
- Pure transformations (format, parse) are fine
- No `if/else` routing between systems — that's the router's job
- No embedded step infrastructure, EXCEPT the HITL exception below

**Good examples in this codebase:**
- `sendWhatsApp.ts` — calls Twilio, returns message SID
- `sendEmail.ts` — calls SendGrid, returns response
- `sendRestResponse.ts` — POSTs to callback URL

**Anti-patterns (removed):**
- `invokeTest.ts` — embedded `step.invoke` inside a tool. Step infrastructure belongs in functions, not tools.
- `transcribeAudio.ts` (old) — wrapped `step.run` inside a tool. Moved to pipeline function.

### The HITL Exception

`askFollowUp.ts` calls `step.waitForEvent` inside a tool handler. This is the **only** approved exception. It works because agent-kit passes `step` context to tool handlers, and HITL requires waiting inline within the agent's flow. Do not add more `step.xxx` calls to other tools.

---

## Functions

**Definition:** A durable Inngest function. The top-level orchestrator. Uses `step.run`, `step.invoke`, `step.waitForEvent` to build reliable workflows with retries, concurrency, and cancellation.

**Rules:**
- Use `step.run` for any operation that should be memoized (API calls, file I/O)
- Use `step.invoke` when a sub-pipeline needs its own concurrency or retry config
- Use `step.waitForEvent` for suspending execution until a user replies
- Use `NonRetriableError` for permanent failures (bad input, auth error) — stops Inngest from wasting retries
- Use `RetryAfterError` for rate limits — delays the retry by the specified duration
- Add `onFailure` to long-running pipelines as a last-resort user notification safety net
- Never put routing logic or LLM calls directly in a function — delegate to networks/agents

**Sub-pipeline pattern (step.invoke):**
```typescript
// Dispatcher function — classify then delegate
const intent = classifyIntent(body, mediaUrl);  // deterministic, no LLM

if (intent === "transcribe_audio") {
  return await step.invoke("invoke-transcribe-audio-pipeline", {
    function: transcribeAudioPipeline,
    data: { conversationId, channel, mediaUrl },
  });
}
```

Why `step.invoke` instead of `step.run` for sub-pipelines:
- The sub-pipeline gets **its own** concurrency config (e.g. `limit: 1` per `conversationId`)
- `step.invoke` does **NOT** count against the invoker's concurrency limit
- The dispatcher stays fast and light; the sub-pipeline governs its own execution

**When `step.run` is enough:** If the operation doesn't need its own concurrency/retry config and won't be reused across function boundaries, use `step.run`. No need to create a separate function.

### Inngest Error Types

| Error | When to use | Example |
|-------|-------------|---------|
| `NonRetriableError` (from `"inngest"`) | Permanent failure — no retry will fix it | Bad audio format, auth failure, 404 |
| `RetryAfterError(msg, delay)` | Temporary failure — retry after specific time | API rate limit with retry-after header |
| `StepError` (caught via try/catch) | Step failed after all retries — recover with fallback | Switch to backup API |
| `onFailure` handler | Function exhausted all retries and is marked Failed | Last-resort user notification |

---

## Agents

**Definition:** An agent is an AI-powered decision-maker. Use an agent when the task requires language understanding, nuanced judgment, or content generation that can't be reduced to deterministic rules.

**Rules:**
- An agent must do **real reasoning** — not just call a single forced tool
- If the agent always forces the same tool with `tool_choice: "fixed_tool"` and has no branching → replace it with a `step.run`
- Agents should read from state and write results back to state via tool handlers
- Router functions (`defaultRouter`) are deterministic code — no LLM needed there

**Good agents in this codebase:**
- `reportAgent` — LLM analyzes transcript nuances, generates structured Dutch report
- `htmlConverterAgent` — LLM generates formatted HTML email template
- `emailAgent` — LLM handles HITL email collection flow with branching
- `messengerAgent` — LLM composes context-appropriate messages for each channel
- `errorHandlerAgent` — LLM decides retry vs. abort based on error context

**Anti-patterns (removed):**
- `classifierAgent` — Always forced `set_intent` with boolean rules. Replaced by `classifyIntent()` in `src/lib/classifier.ts`. If classification can be expressed as `if/else`, don't use an LLM.
- `transcriptionAgent` — Always forced `transcribe_audio` tool. Replaced by `step.run` in `transcribeAudioPipeline`. A pass-through agent costs a full Haiku LLM call for zero reasoning value.

### The Deterministic Classification Rule

If the decision can be expressed as deterministic rules (no judgment needed), use a plain TypeScript function. Save LLM calls for tasks that actually require intelligence.

```typescript
// ✅ Correct — deterministic classification
export function classifyIntent(body: string, mediaUrl: string | null): Intent {
  if (mediaUrl !== null) return "transcribe_audio";
  if (body.toLowerCase().includes("test")) return "testing";
  if (body.trim().length >= 3) return "chat";
  return "unknown";
}

// ❌ Wrong — LLM with forced single-tool call for boolean rules
export const classifierAgent = createAgent({
  tool_choice: "set_intent",  // always calls this, no reasoning
  system: `mediaUrl aanwezig → transcribe_audio...`
});
```

---

## step.ai.wrap

For bare Anthropic/OpenAI SDK calls outside of agent-kit (not inside `createAgent`), wrap them with `step.ai.wrap` to get prompt/token observability in the Inngest Dev UI:

```typescript
const createCompletion = anthropic.messages.create.bind(anthropic.messages);
const result = await step.ai.wrap("my-llm-call", createCompletion, { ... });
```

**Note:** Must use `.bind()` to preserve client instance context.

**Not applicable for binary file uploads** (like audio transcription). `step.ai.wrap` args must be JSON-serializable. For audio, use `step.run` wrapping the SDK call directly.

---

## Architecture Map (current)

```
handleWhatsApp / handleRestMessage  ← dispatcher functions
  ├─ step.run("send-ack")           ← durable ACK
  ├─ classifyIntent()               ← deterministic TypeScript
  └─ step.invoke → sub-pipeline     ← based on intent

transcribeAudioPipeline             ← sub-pipeline function
  ├─ step.run(stepId, doTranscribeAudio)   ← OpenAI Whisper
  └─ transcribeAudioNetwork.run()   ← agent-kit network
       ├─ reportAgent               ← LLM: structured report
       ├─ htmlConverterAgent        ← LLM: HTML email
       ├─ emailAgent (+ HITL)       ← LLM: collect email if needed
       ├─ messengerAgent            ← LLM: send confirmation
       └─ errorHandlerAgent         ← LLM: retry or abort

chatPipeline                        ← sub-pipeline function
  └─ chatNetwork.run()
       └─ messengerAgent            ← LLM: respond to user

handleTest                          ← demo function (step.invoke)
```

---

## Extending the Architecture

### Add a new intent

1. Add to `Intent` type in `src/types/state.ts`
2. Add a rule to `classifyIntent()` in `src/lib/classifier.ts`
3. Create a new `xxxPipeline` function in `src/functions/`
4. Add a new `xxxNetwork` in `src/networks/` if needed
5. Add `step.invoke` case in `handleWhatsApp.ts` and `handleRestMessage.ts`
6. Register network + function in `src/server.ts`
7. Document in `workflows/gesprek-routing.md`

### Add a new agent capability

Only create an agent if the task requires AI reasoning. If not, use `step.run` in the pipeline or a new tool. Ask: "Would a junior developer be able to write deterministic rules for this?" If yes → no agent needed.

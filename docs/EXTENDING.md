# Uitbreiden van het systeem

## Recept: Nieuwe intent + pipeline toevoegen

### Voorbeeld: Scheduling assistant

**Stap 1**: Voeg de intent toe aan het type (`src/types/state.ts`)
```typescript
export type Intent = "transcribe_audio" | "schedule" | "chat" | "unknown" | null;
// "schedule" staat er al in — geen wijziging nodig
```

**Stap 2**: Maak een nieuwe agent (`src/agents/schedulingAgent.ts`)
```typescript
import { createAgent, anthropic } from "@inngest/agent-kit";

export const schedulingAgent = createAgent({
  name: "scheduling",
  model: anthropic({ model: "claude-haiku-4-5-20251001", max_tokens: 512 }),
  system: "...",
  tools: [/* scheduling tools */],
});
```

**Stap 3**: Voeg de agent toe aan het network (`src/networks/conversationNetwork.ts`)
```typescript
import { schedulingAgent } from "../agents/schedulingAgent.js";

export const conversationNetwork = createNetwork({
  agents: [
    classifierAgent,
    transcriptionAgent,
    reportAgent,
    htmlConverterAgent,
    emailAgent,
    messengerAgent,
    schedulingAgent, // ← nieuw
  ],
  defaultRouter: ({ network }) => {
    const state = network.state.data;
    // ... bestaande routing ...

    // Uncomment deze regel:
    if (state.intent === "schedule") return schedulingAgent;
  },
});
```

**Stap 4**: Voeg de intent toe aan de classifier (`src/agents/classifierAgent.ts`)
De classifier herkent `schedule` al — geen wijziging nodig.

---

## Recept: Nieuw kanaal toevoegen

### Voorbeeld: Telegram

**Stap 1**: Voeg het channel type toe (`src/types/state.ts`)
```typescript
export type Channel = "whatsapp" | "rest" | "telegram";
```

**Stap 2**: Voeg events toe (`src/types/events.ts`)
```typescript
"message/telegram.received": { data: TelegramReceivedData },
```

**Stap 3**: Maak een webhook handler (`src/webhooks/telegram.ts`)
```typescript
export async function handleTelegramWebhook(req, res) { ... }
```

**Stap 4**: Voeg route toe aan server (`src/server.ts`)
```typescript
if (url === "/webhook/telegram" && method === "POST") {
  await handleTelegramWebhook(req, res);
  return;
}
```

**Stap 5**: Maak een Inngest function (`src/functions/handleTelegram.ts`)

---

## Recept: Nieuwe tool toevoegen

```typescript
// src/tools/mijnNieuweTool.ts
import { createTool } from "@inngest/agent-kit";
import { z } from "zod";

export const mijnNieuweTool = createTool({
  name: "mijn_nieuwe_tool",
  description: "Wat de tool doet",
  parameters: z.object({
    input: z.string(),
  }),
  handler: async (input, { network, step }) => {
    // step.run() voor duurzaamheid bij externe API calls
    const result = await step?.run("stap-naam", async () => {
      return await mijnApiCall(input.input);
    });
    return result;
  },
});
```

Voeg toe aan `src/tools/index.ts` en gebruik in een agent via de `tools` array.

---

## Stijlconventies

- **Agents**: één verantwoordelijkheid, forced `tool_choice` voor deterministische output
- **Tools**: altijd `step.run()` wrappen om idempotentie te garanderen bij retries
- **State**: lees via `network.state.data`, schrijf direct (`state.fieldName = value`)
- **Models**: Haiku voor eenvoudige taken, Sonnet voor complexe redenering

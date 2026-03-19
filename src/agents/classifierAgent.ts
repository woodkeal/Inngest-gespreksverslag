import { createAgent, anthropic } from "@inngest/agent-kit";
import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { ConversationStateData, Intent } from "../types/state.js";

const setIntent = createTool({
  name: "set_intent",
  description: "Sla de gedetecteerde intent op",
  parameters: z.object({
    intent: z
      .enum(["transcribe_audio", "schedule", "chat", "unknown"])
      .describe("De gedetecteerde intent van het bericht"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;
    state.intent = input.intent as Intent;
    return `Intent ingesteld op: ${input.intent}`;
  },
});

export const classifierAgent = createAgent<ConversationStateData>({
  name: "classifier",
  description: "Classificeert de intent van het inkomende bericht",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 256 },
  }),
  system: `Je bent een intent-classifier voor een conversatierobot.

Analyseer het inkomende bericht en bepaal de intent:

- **transcribe_audio**: De gebruiker heeft een audiobestand gestuurd of vraagt om transcriptie van audio. Kijk of er een mediaUrl aanwezig is of de gebruiker over audio spreekt.
- **schedule**: De gebruiker wil een afspraak plannen, agenda beheren of iets inplannen.
- **chat**: De gebruiker wil gewoon chatten, een vraag stellen of informatie opvragen.
- **unknown**: De intent is onduidelijk of buiten scope.

Roep altijd de tool set_intent aan met je beslissing. Geen verdere uitleg nodig.`,
  tools: [setIntent],
  tool_choice: "set_intent",
});

import { createAgent, anthropic } from "@inngest/agent-kit";
import { sendEmailTool } from "../tools/sendEmail.js";
import type { ConversationStateData } from "../types/state.js";

export const emailAgent = createAgent<ConversationStateData>({
  name: "email",
  description: "Verstuurt het rapport per e-mail",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 256, tool_choice: { type: "any" } },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const userEmail = state?.userEmail;

    return `Je bent een e-mailagent. Stuur het gespreksverslag naar ${userEmail}.

Gebruik de tool send_email met:
- to: "${userEmail}"
- subject: "Jouw gespreksverslag"

De HTML inhoud wordt automatisch uit de state geladen — je hoeft geen html-veld mee te geven.`;
  },
  tools: [sendEmailTool],
});

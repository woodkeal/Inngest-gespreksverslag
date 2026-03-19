import { createAgent, anthropic } from "@inngest/agent-kit";
import { sendEmailTool } from "../tools/sendEmail.js";
import { askFollowUp } from "../tools/askFollowUp.js";
import type { ConversationStateData } from "../types/state.js";

export const emailAgent = createAgent<ConversationStateData>({
  name: "email",
  description: "Vraagt het e-mailadres op via HITL en verstuurt het rapport",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 512 },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const userEmail = state?.userEmail;
    const htmlOutput = state?.htmlOutput ?? "";

    if (!userEmail) {
      return `Je bent een e-mailagent. De gebruiker heeft nog geen e-mailadres opgegeven.

Gebruik de tool ask_follow_up met de vraag: "Op welk e-mailadres wil je het gespreksverslag ontvangen?"

Het antwoord van de gebruiker is hun e-mailadres. Gebruik dat vervolgens om de e-mail te versturen.`;
    }

    return `Je bent een e-mailagent. Stuur het gespreksverslag naar ${userEmail}.

Gebruik de tool send_email met:
- to: "${userEmail}"
- subject: "Jouw gespreksverslag"

De HTML inhoud wordt automatisch uit de state geladen — je hoeft geen html-veld mee te geven.`;
  },
  tools: [askFollowUp, sendEmailTool],
});

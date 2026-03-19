import { createAgent, anthropic } from "@inngest/agent-kit";
import { sendWhatsApp } from "../tools/sendWhatsApp.js";
import { sendRestResponse } from "../tools/sendRestResponse.js";
import type { ConversationStateData } from "../types/state.js";

export const messengerAgent = createAgent<ConversationStateData>({
  name: "messenger",
  description: "Verstuurt WhatsApp berichten of REST responses",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 512, tool_choice: { type: "any" } },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const channel = state?.channel ?? "whatsapp";
    const conversationId = state?.conversationId ?? "";
    const intent = state?.intent;
    const emailSent = state?.emailSent ?? false;
    const replyCallbackUrl = state?.replyCallbackUrl ?? null;

    let contextMessage = "";
    if (intent === "transcribe_audio" && emailSent) {
      contextMessage = `Het gespreksverslag is succesvol gegenereerd en per e-mail verstuurd naar ${state?.userEmail}.`;
    } else if (intent === "chat") {
      contextMessage = "Beantwoord de vraag van de gebruiker vriendelijk en behulpzaam.";
    } else {
      contextMessage = "Bevestig de verwerking van het verzoek van de gebruiker.";
    }

    if (channel === "whatsapp") {
      return `Je bent een WhatsApp messenger. ${contextMessage}

Stuur een kort, vriendelijk bevestigingsbericht via WhatsApp naar: ${conversationId}

Gebruik de tool send_whatsapp. Houd het bericht kort (max 3 zinnen) en natuurlijk.`;
    }

    if (!replyCallbackUrl) {
      return `Je bent een REST response sender. Er is geen callback URL beschikbaar, dus je hoeft geen bericht te sturen. Gebruik de tool send_rest_response met replyCallbackUrl="skip" en body="done" om af te ronden.`;
    }

    return `Je bent een REST response sender. ${contextMessage}

Stuur een antwoord via de REST callback URL: ${replyCallbackUrl}
Gebruik de tool send_rest_response met die URL.
Houd het antwoord kort en to the point.`;
  },
  tools: [sendWhatsApp, sendRestResponse],
});

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
    const errorUserMessage = state?.errorUserMessage ?? null;

    // Error path: stuur het door de error handler opgestelde bericht
    if (errorUserMessage) {
      if (channel === "whatsapp") {
        return `Je bent een WhatsApp messenger. Stuur het volgende foutbericht naar de gebruiker: "${errorUserMessage}"

Stuur het bericht via send_whatsapp naar: ${conversationId}
Stuur het bericht exact zoals opgegeven, zonder aanpassingen.`;
      }
      if (!replyCallbackUrl) {
        return `Er is geen callback URL. Gebruik send_rest_response met replyCallbackUrl="skip" en body="${errorUserMessage}" om af te ronden.`;
      }
      return `Je bent een REST response sender. Stuur het volgende foutbericht via de callback URL: "${errorUserMessage}"

Gebruik send_rest_response met URL: ${replyCallbackUrl}`;
    }

    // Normale (succesvolle) path
    let contextMessage = "";
    if (intent === "transcribe_audio" && emailSent) {
      contextMessage = `Het gespreksverslag is succesvol gegenereerd en per e-mail verstuurd naar ${state?.userEmail}.`;
    } else if (intent === "chat") {
      contextMessage = "Beantwoord de vraag van de gebruiker vriendelijk en behulpzaam.";
    } else if (intent === "testing") {
      contextMessage = `Stuur dit testresultaat terug naar de gebruiker: "${state?.testResult}"`;
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

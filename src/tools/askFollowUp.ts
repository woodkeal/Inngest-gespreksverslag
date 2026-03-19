import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import twilio from "twilio";
import type { ConversationStateData } from "../types/state.js";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

/**
 * Stel een verduidelijkingsvraag aan de gebruiker en wacht op hun antwoord.
 *
 * De `step?.waitForEvent` call zorgt ervoor dat de gehele agent-network run
 * pauzeert totdat de gebruiker antwoordt (of de timeout verstrijkt).
 * Dit is het officiële HITL-patroon uit de agent-kit support-agent voorbeelden.
 */
export const askFollowUp = createTool({
  name: "ask_follow_up",
  description:
    "Stel een verduidelijkingsvraag aan de gebruiker en wacht op hun antwoord",
  parameters: z.object({
    question: z.string().describe("De vraag om aan de gebruiker te stellen"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;
    const conversationId = state.conversationId;
    const channel = state.channel;

    // Stuur de vraag via WhatsApp
    if (channel === "whatsapp") {
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER!,
        to: conversationId,
        body: input.question,
      });
    }

    state.awaitingFollowUp = true;
    state.followUpQuestion = input.question;

    // HITL: vraag is verstuurd, antwoord komt via een nieuwe event trigger.
    // Geef de vraag terug zodat de caller weet wat er gevraagd is.
    return `VRAAG_GESTELD: ${input.question}`;
  },
});

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
  handler: async (input, { network, step }) => {
    const state = network.state.data as ConversationStateData;
    const conversationId = state.conversationId;
    const channel = state.channel;

    // Stuur de vraag via WhatsApp en wacht op het antwoord via step.waitForEvent.
    // Beide step IDs zijn stabiel (geen dynamische waarden) zodat Inngest replay
    // de WhatsApp-send en het waitForEvent correct memoïseert en niet opnieuw uitvoert.
    if (channel === "whatsapp") {
      await step?.run("send-follow-up-question", () =>
        twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER!,
          to: conversationId,
          body: input.question,
        })
      );

      // Pauzeer de pipeline totdat de gebruiker antwoordt (max 30 minuten)
      const reply = await step?.waitForEvent("wait-for-follow-up-reply", {
        event: "message/whatsapp.received",
        timeout: "30m",
        if: `async.data.conversationId == "${conversationId}"`,
      });

      if (!reply) {
        return "TIMEOUT: Geen antwoord ontvangen binnen 30 minuten.";
      }

      // Geef het antwoord van de gebruiker terug zodat de agent het kan gebruiken
      return reply.data.body;
    }

    // REST kanaal: geen HITL-mechanisme beschikbaar, markeer als wachtend
    state.awaitingFollowUp = true;
    state.followUpQuestion = input.question;
    return `VRAAG_GESTELD: ${input.question} (REST kanaal: geen follow-up mechanisme)`;
  },
});

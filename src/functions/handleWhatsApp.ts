import { inngest } from "../client.js";
import { conversationNetwork, createInitialState } from "../networks/index.js";
import { logger } from "../lib/logger.js";
import type { WhatsAppReceivedEvent } from "../types/events.js";
import twilio from "twilio";

const ACK_MESSAGE = "We hebben je audiobestand ontvangen en zijn je gespreksverslag aan het genereren. Dit kan een momentje duren ⏳";

export const handleWhatsApp = inngest.createFunction(
  {
    id: "handle-whatsapp",
    triggers: [{ event: "message/whatsapp.received" }],
    concurrency: {
      key: "event.data.conversationId",
      limit: 1, // één pipeline per gebruiker tegelijk
    },
    cancelOn: [{ event: "conversation/cancel", match: "data.conversationId" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: WhatsAppReceivedEvent }; step: any }) => {
    logger.info("WhatsApp bericht ontvangen", {
      from: event.data.from,
      messageSid: event.data.messageSid,
      hasMedia: !!event.data.mediaUrl,
    });

    // Stuur direct een bevestiging voor lange flows (audio aanwezig)
    if (event.data.mediaUrl) {
      await step.run("send-ack", async () => {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER!,
          to: event.data.from,
          body: ACK_MESSAGE,
        });
      });
    }

    const state = createInitialState({
      conversationId: event.data.from,
      channel: "whatsapp",
      mediaUrl: event.data.mediaUrl ?? null,
    });

    const messageBody = event.data.body || (event.data.mediaUrl ? "[Audiobestand ontvangen]" : "[Leeg bericht]");
    const result = await conversationNetwork.run(messageBody, { state });

    logger.info("WhatsApp pipeline voltooid", {
      conversationId: event.data.conversationId,
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    });

    return {
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    };
  },
);

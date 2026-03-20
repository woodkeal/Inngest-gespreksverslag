import { inngest } from "../client.js";
import { classifyIntent } from "../lib/classifier.js";
import { transcribeAudioPipeline } from "./transcribeAudioPipeline.js";
import { chatPipeline } from "./chatPipeline.js";
import { handleTest } from "./handleTest.js";
import { logger } from "../lib/logger.js";
import type { WhatsAppReceivedEvent } from "../types/events.js";
import twilio from "twilio";

const ACK_MESSAGE = "We hebben je audiobestand ontvangen en zijn je gespreksverslag aan het genereren. Dit kan een momentje duren ⏳";

export const handleWhatsApp = inngest.createFunction(
  {
    id: "handle-whatsapp",
    triggers: [{ event: "message/whatsapp.received" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: WhatsAppReceivedEvent }; step: any }) => {
    const conversationId = event.data.from;
    const mediaUrl = event.data.mediaUrl ?? null;
    const messageBody = event.data.body || (mediaUrl ? "[Audiobestand ontvangen]" : "[Leeg bericht]");

    logger.info("WhatsApp bericht ontvangen", {
      from: conversationId,
      messageSid: event.data.messageSid,
      hasMedia: !!mediaUrl,
    });

    // Acknowledge long-running audio flow immediately
    if (mediaUrl) {
      await step.run("send-ack", async () => {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER!,
          to: conversationId,
          body: ACK_MESSAGE,
        });
      });
    }

    const intent = classifyIntent(messageBody, mediaUrl);
    logger.info("Intent geclassificeerd", { conversationId, intent });

    if (intent === "transcribe_audio") {
      return await step.invoke("invoke-transcribe-audio-pipeline", {
        function: transcribeAudioPipeline,
        data: {
          conversationId,
          channel: "whatsapp",
          mediaUrl: mediaUrl!,
        },
      });
    }

    if (intent === "testing") {
      await step.invoke("invoke-handle-test", {
        function: handleTest,
        data: { input: messageBody },
      });

      await step.run("send-test-reply", () => {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        return client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER!,
          to: conversationId,
          body: `Testbericht ontvangen ✅\nAlles werkt.`,
        });
      });

      return;
    }

    // chat + unknown both go to chatPipeline
    return await step.invoke("invoke-chat-pipeline", {
      function: chatPipeline,
      data: {
        conversationId,
        channel: "whatsapp",
        messageBody,
        intent,
      },
    });
  },
);

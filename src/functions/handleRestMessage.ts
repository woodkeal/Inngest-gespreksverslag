import { inngest } from "../client.js";
import { classifyIntent } from "../lib/classifier.js";
import { transcribeAudioPipeline } from "./transcribeAudioPipeline.js";
import { chatPipeline } from "./chatPipeline.js";
import { handleTest } from "./handleTest.js";
import { logger } from "../lib/logger.js";
import type { RestReceivedEvent } from "../types/events.js";

const ACK_MESSAGE = "We hebben je audiobestand ontvangen en zijn je gespreksverslag aan het genereren. Dit kan een momentje duren.";

export const handleRestMessage = inngest.createFunction(
  {
    id: "handle-rest-message",
    triggers: [{ event: "message/rest.received" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: RestReceivedEvent }; step: any }) => {
    const conversationId = event.data.sessionId;
    const mediaUrl = event.data.mediaUrl ?? null;
    const messageBody = event.data.content;

    logger.info("REST bericht ontvangen", {
      conversationId,
      hasMedia: !!mediaUrl,
    });

    // Acknowledge long-running audio flow immediately
    if (mediaUrl && event.data.replyCallbackUrl) {
      await step.run("send-ack", async () => {
        await fetch(event.data.replyCallbackUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: ACK_MESSAGE }),
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
          channel: "rest",
          mediaUrl: mediaUrl!,
          userEmail: event.data.userEmail ?? null,
          replyCallbackUrl: event.data.replyCallbackUrl ?? null,
        },
      });
    }

    if (intent === "testing") {
      await step.invoke("invoke-handle-test", {
        function: handleTest,
        data: { input: messageBody },
      });

      if (event.data.replyCallbackUrl) {
        await step.run("send-test-reply", async () => {
          await fetch(event.data.replyCallbackUrl!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Test ontvangen ✅ Alles werkt." }),
          });
        });
      }

      return;
    }

    // chat + unknown both go to chatPipeline
    return await step.invoke("invoke-chat-pipeline", {
      function: chatPipeline,
      data: {
        conversationId,
        channel: "rest",
        messageBody,
        intent,
        userEmail: event.data.userEmail ?? null,
        replyCallbackUrl: event.data.replyCallbackUrl ?? null,
      },
    });
  },
);

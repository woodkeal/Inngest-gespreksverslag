import { inngest } from "../client.js";
import { conversationNetwork, createInitialState } from "../networks/index.js";
import { logger } from "../lib/logger.js";
import type { RestReceivedEvent } from "../types/events.js";

const ACK_MESSAGE = "We hebben je audiobestand ontvangen en zijn je gespreksverslag aan het genereren. Dit kan een momentje duren.";

export const handleRestMessage = inngest.createFunction(
  {
    id: "handle-rest-message",
    triggers: [{ event: "message/rest.received" }],
    concurrency: {
      key: "event.data.sessionId",
      limit: 1,
    },
    cancelOn: [{ event: "conversation/cancel", if: "event.data.sessionId == async.data.conversationId" }],
    retries: 2,
  },
  async ({ event, step }: { event: { data: RestReceivedEvent }; step: any }) => {
    logger.info("REST bericht ontvangen", {
      conversationId: event.data.sessionId,
      hasMedia: !!event.data.mediaUrl,
    });

    // Stuur direct een bevestiging voor lange flows (audio aanwezig)
    if (event.data.mediaUrl && event.data.replyCallbackUrl) {
      await step.run("send-ack", async () => {
        await fetch(event.data.replyCallbackUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: ACK_MESSAGE }),
        });
      });
    }

    const state = createInitialState({
      conversationId: event.data.sessionId,
      channel: "rest",
      mediaUrl: event.data.mediaUrl ?? null,
      userEmail: event.data.userEmail ?? null,
      replyCallbackUrl: event.data.replyCallbackUrl ?? null,
    });

    const result = await conversationNetwork.run(event.data.content, { state });

    logger.info("REST pipeline voltooid", {
      conversationId: event.data.sessionId,
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      emailTo: result.state.data.userEmail,
      messageSent: result.state.data.messageSent,
      transcript: result.state.data.transcript ? `${result.state.data.transcript.slice(0, 80)}…` : null,
    });

    return {
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    };
  },
);

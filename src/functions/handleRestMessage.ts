import { inngest } from "../client.js";
import { conversationNetwork, createInitialState } from "../networks/index.js";
import { logger } from "../lib/logger.js";
import type { RestReceivedEvent } from "../types/events.js";

export const handleRestMessage = inngest.createFunction(
  {
    id: "handle-rest-message",
    triggers: [{ event: "message/rest.received" }],
    concurrency: {
      key: "event.data.sessionId",
      limit: 1,
    },
    retries: 2,
  },
  async ({ event }: { event: { data: RestReceivedEvent } }) => {
    logger.info("REST bericht ontvangen", {
      conversationId: event.data.sessionId,
      hasMedia: !!event.data.mediaUrl,
    });

    const state = createInitialState({
      conversationId: event.data.sessionId,
      channel: "rest",
      mediaUrl: event.data.mediaUrl ?? null,
      userEmail: event.data.userEmail ?? null,
      replyCallbackUrl: event.data.replyCallbackUrl ?? null,
      messageCount: 1,
    });

    const result = await conversationNetwork.run(event.data.content, { state });

    logger.info("REST pipeline voltooid", {
      conversationId: event.data.sessionId,
      intent: result.state.data.intent,
      messageSent: result.state.data.messageSent,
    });

    return {
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    };
  },
);

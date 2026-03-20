import { inngest } from "../client.js";
import { chatNetwork, createChatState } from "../networks/chatNetwork.js";
import { logger } from "../lib/logger.js";
import type { ConversationStateData } from "../types/state.js";

export const chatPipeline = inngest.createFunction(
  {
    id: "chat-pipeline",
    triggers: [{ event: "pipeline/chat.start" }],
    concurrency: {
      key: "event.data.conversationId",
      limit: 1,
    },
    cancelOn: [{ event: "conversation/cancel", match: "data.conversationId" }],
    retries: 0,
  },
  async ({
    event,
  }: {
    event: {
      data: {
        conversationId: string;
        channel: import("../types/state.js").Channel;
        messageBody: string;
        intent?: string | null;
        userEmail?: string | null;
        replyCallbackUrl?: string | null;
      };
    };
  }) => {
    const { conversationId, channel, messageBody, userEmail, replyCallbackUrl, intent } =
      event.data;

    const state = createChatState({
      conversationId,
      channel,
      intent: (intent ?? "chat") as ConversationStateData["intent"],
      userEmail: userEmail ?? null,
      replyCallbackUrl: replyCallbackUrl ?? null,
    });

    const result = await chatNetwork.run(messageBody, { state });

    logger.info("Chat pipeline voltooid", {
      conversationId,
      intent,
      messageSent: result.state.data.messageSent,
    });

    return {
      messageSent: result.state.data.messageSent,
    };
  },
);

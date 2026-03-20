import { inngest } from "../client.js";
import { chatNetwork, createChatState } from "../networks/chatNetwork.js";
import { loadMemory, saveMemory } from "../lib/memory.js";
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
    step,
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
    step: any;
  }) => {
    const { conversationId, channel, messageBody, userEmail, replyCallbackUrl, intent } =
      event.data;

    // Load persistent memory for this user (memoized by Inngest on replay)
    const memory = await step.run("load-memory", () => loadMemory(conversationId));

    const state = createChatState({
      conversationId,
      channel,
      intent: (intent ?? "chat") as ConversationStateData["intent"],
      userEmail: userEmail ?? null,
      replyCallbackUrl: replyCallbackUrl ?? null,
      memory: memory ?? null,
    });

    const result = await chatNetwork.run(messageBody, { state });

    // Save this exchange to persistent memory (memoized by Inngest on replay)
    const lastReply = result.state.data.lastReply ?? "";
    await step.run("save-memory", () =>
      saveMemory(conversationId, messageBody, lastReply, memory ?? null),
    );

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

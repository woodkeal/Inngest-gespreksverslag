import { createNetwork, createState } from "@inngest/agent-kit";
import { messengerAgent } from "../agents/index.js";
import type { ConversationStateData } from "../types/state.js";

export function createChatState(overrides: Partial<ConversationStateData> = {}) {
  return createState<ConversationStateData>({
    intent: "chat",
    conversationId: "",
    channel: "whatsapp",
    mediaUrl: null,
    userEmail: null,
    replyCallbackUrl: null,
    transcript: null,
    report: null,
    htmlOutput: null,
    emailSent: false,
    messageSent: false,
    awaitingFollowUp: false,
    followUpQuestion: null,
    failedStep: null,
    failureReason: null,
    retryCount: {},
    shouldRetry: null,
    errorHandled: false,
    errorUserMessage: null,
    errorMessageSent: false,
    ...overrides,
  });
}

export const chatNetwork = createNetwork<ConversationStateData>({
  name: "chat-network",
  description: "Beantwoordt chat- en onbekende berichten via de messengerAgent",
  agents: [messengerAgent],
  maxIter: 3,
  defaultRouter: ({ network }) => {
    const state = network.state.data;
    if (!state.messageSent) return messengerAgent;
    return undefined;
  },
});

import { createNetwork, createState } from "@inngest/agent-kit";
import {
  reportAgent,
  htmlConverterAgent,
  emailAgent,
  messengerAgent,
  errorHandlerAgent,
} from "../agents/index.js";
import type { ConversationStateData } from "../types/state.js";

export function createTranscriptionState(overrides: Partial<ConversationStateData> = {}) {
  return createState<ConversationStateData>({
    intent: "transcribe_audio",
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

export const transcribeAudioNetwork = createNetwork<ConversationStateData>({
  name: "transcribe-audio-network",
  description: "Verwerkt getranscribeerde audio: rapportage, HTML, e-mail en berichtbevestiging",
  agents: [reportAgent, htmlConverterAgent, emailAgent, messengerAgent, errorHandlerAgent],
  maxIter: 25,
  defaultRouter: ({ network }) => {
    const state = network.state.data;

    // --- Error handling (highest priority) ---

    // Step failed, not yet handled → error handler
    if (state.failedStep && !state.errorHandled) return errorHandlerAgent;

    // Error handled, user not yet notified → messenger
    if (state.failedStep && state.errorHandled && !state.errorMessageSent) return messengerAgent;

    // Error handled + user notified → done (pipeline checks state.shouldRetry to decide on retry)
    if (state.failedStep && state.errorHandled && state.errorMessageSent) return undefined;

    // Stop if waiting for HITL reply (e.g. emailAgent waiting for user email)
    if (state.awaitingFollowUp) return undefined;

    // --- Normal pipeline ---

    if (!state.report) return reportAgent;
    if (state.report && !state.htmlOutput) return htmlConverterAgent;
    if (state.htmlOutput && !state.emailSent) return emailAgent;
    if (state.emailSent && !state.messageSent) return messengerAgent;

    return undefined;
  },
});

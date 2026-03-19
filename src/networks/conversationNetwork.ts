import { createNetwork, createState } from "@inngest/agent-kit";
import {
  classifierAgent,
  transcriptionAgent,
  reportAgent,
  htmlConverterAgent,
  emailAgent,
  messengerAgent,
} from "../agents/index.js";
import type { ConversationStateData } from "../types/state.js";

export function createInitialState(overrides: Partial<ConversationStateData> = {}) {
  return createState<ConversationStateData>({
    intent: null,
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
    messageCount: 0,
    ...overrides,
  });
}

export const conversationNetwork = createNetwork<ConversationStateData>({
  name: "conversation-network",
  description: "Verwerkt inkomende berichten via classificatie, transcriptie, rapportage en verzending",
  agents: [
    classifierAgent,
    transcriptionAgent,
    reportAgent,
    htmlConverterAgent,
    emailAgent,
    messengerAgent,
  ],
  maxIter: 20,
  defaultRouter: ({ network }) => {
    const state = network.state.data;

    // Stap 1: Classificeer altijd eerst
    if (!state.intent) return classifierAgent;

    // Stop als we wachten op een antwoord van de gebruiker (HITL)
    if (state.awaitingFollowUp) return undefined;

    // Stap 2: Audio transcriptie pipeline
    if (state.intent === "transcribe_audio") {
      if (!state.transcript)                            return transcriptionAgent;
      if (state.transcript && !state.report)            return reportAgent;
      if (state.report && !state.htmlOutput)            return htmlConverterAgent;
      if (state.htmlOutput && !state.emailSent)         return emailAgent;
      if (state.emailSent && !state.messageSent)        return messengerAgent;
    }

    // Stap 3: Chat pipeline (geen audio)
    if (state.intent === "chat" && !state.messageSent) return messengerAgent;

    // Stap 4: Planning intent — placeholder voor de volgende workflow
    // if (state.intent === "schedule") return schedulingAgent;

    // Stap 5: Onbekende intent
    if (state.intent === "unknown" && !state.messageSent) return messengerAgent;

    return undefined; // klaar
  },
});

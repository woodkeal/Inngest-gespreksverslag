import { createNetwork, createState } from "@inngest/agent-kit";
import {
  classifierAgent,
  transcriptionAgent,
  reportAgent,
  htmlConverterAgent,
  emailAgent,
  messengerAgent,
  errorHandlerAgent,
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
    // Error handling
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
    errorHandlerAgent,
  ],
  maxIter: 30,
  defaultRouter: ({ network }) => {
    const state = network.state.data;

    // --- Foutafhandeling (hoogste prioriteit) ---

    // Stap mislukt, nog niet verwerkt → error handler
    if (state.failedStep && !state.errorHandled) return errorHandlerAgent;

    // Error verwerkt, gebruiker nog niet geïnformeerd → messenger
    if (state.failedStep && state.errorHandled && !state.errorMessageSent) return messengerAgent;

    // Gebruiker geïnformeerd → retry of stoppen
    if (state.failedStep && state.errorHandled && state.errorMessageSent) {
      if (state.shouldRetry) {
        // Bewaar de te herstarten stap vóór we state clearen
        const stepToRetry = state.failedStep;
        // Reset error state zodat de normale pipeline hervat
        state.failedStep = null;
        state.failureReason = null;
        state.errorHandled = false;
        state.shouldRetry = null;
        state.errorUserMessage = null;
        state.errorMessageSent = false;
        // Route terug naar de mislukte stap
        if (stepToRetry === "transcription") return transcriptionAgent;
        if (stepToRetry === "email") return emailAgent;
      }
      // shouldRetry = false: gebruiker is geïnformeerd, we stoppen
      return undefined;
    }

    // --- Normale pipeline ---

    // Stap 1: Classificeer altijd eerst
    if (!state.intent) return classifierAgent;

    // Stop als we wachten op een antwoord van de gebruiker (HITL)
    if (state.awaitingFollowUp) return undefined;

    // Stap 2: Audio transcriptie pipeline
    if (state.intent === "transcribe_audio") {
      // Bewaker: geen audiobestand aanwezig → informeer gebruiker en stop
      if (!state.mediaUrl && state.messageSent) return undefined;
      if (!state.mediaUrl && !state.messageSent) {
        state.errorUserMessage = "Om een gespreksverslag te maken, heb ik een audiobestand nodig. Stuur het audiobestand mee als bijlage.";
        return messengerAgent;
      }

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

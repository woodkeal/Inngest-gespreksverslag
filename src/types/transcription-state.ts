import type { Channel, ReportStructure } from "./state.js";

/**
 * State for the transcribeAudioPipeline and its network.
 * Narrower than ConversationStateData — no intent (always transcribe_audio), no testResult.
 */
export interface TranscriptionPipelineState {
  conversationId: string;
  channel: Channel;
  mediaUrl: string;
  userEmail: string | null;
  replyCallbackUrl: string | null;
  transcript: string | null;
  report: ReportStructure | null;
  htmlOutput: string | null;
  emailSent: boolean;
  messageSent: boolean;
  awaitingFollowUp: boolean;
  followUpQuestion: string | null;
  // Error handling
  failedStep: string | null;
  failureReason: string | null;
  retryCount: Record<string, number>;
  shouldRetry: boolean | null;
  errorHandled: boolean;
  errorUserMessage: string | null;
  errorMessageSent: boolean;
}

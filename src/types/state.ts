export interface ActionItem {
  beschrijving: string;
  eigenaar: string | null;
  deadline: string | null;
}

export interface Speaker {
  label: string;
  statements: string[];
}

export interface ReportStructure {
  samenvatting: string;
  actiepunten: ActionItem[];
  besluiten: string[];
  sprekers: Speaker[];
  metadata: {
    duur: string | null;
    taal: string;
    generatedAt: string;
  };
}

export type Intent = "transcribe_audio" | "chat" | "unknown" | null;
export type Channel = "whatsapp" | "rest";

export interface ConversationStateData {
  intent: Intent;
  conversationId: string;
  channel: Channel;
  mediaUrl: string | null;
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

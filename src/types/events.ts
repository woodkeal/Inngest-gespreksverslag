// Inngest v4 does not have EventSchemas — we define plain TypeScript types for event payloads.

export interface WhatsAppReceivedEvent {
  from: string;           // E.164, e.g. "whatsapp:+31612345678"
  to: string;
  body: string;
  messageSid: string;
  conversationId: string; // same as `from` — used as HITL filter key
  mediaUrl?: string;
  mediaContentType?: string;
}

export interface RestReceivedEvent {
  sessionId: string;
  content: string;
  replyCallbackUrl?: string;
  mediaUrl?: string;
  mediaContentType?: string;
  userEmail?: string;
}

export interface WhatsAppSendEvent {
  to: string;
  body: string;
  conversationId: string;
}

export interface RestSendEvent {
  sessionId: string;
  body: string;
  replyCallbackUrl: string;
}

export interface ReportEmailSentEvent {
  conversationId: string;
  toEmail: string;
  subject: string;
}

export interface SystemErrorEvent {
  conversationId?: string;
  error: string;
  stack?: string;
  source: string;
}

export interface ConversationCancelEvent {
  conversationId: string;
  reason?: string;
}

// Discriminated union for inngest.send() calls
export type InngestEvents = {
  "message/whatsapp.received": { data: WhatsAppReceivedEvent };
  "message/rest.received":     { data: RestReceivedEvent };
  "message/whatsapp.send":     { data: WhatsAppSendEvent };
  "message/rest.send":         { data: RestSendEvent };
  "report/email.sent":         { data: ReportEmailSentEvent };
  "system/error.unhandled":    { data: SystemErrorEvent };
  "conversation/cancel":       { data: ConversationCancelEvent };
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO 8601
}

export interface ConversationFacts {
  name?: string;
  language?: string;
  preferences?: string[];
  topics?: string[];
}

export interface ConversationMemory {
  conversationId: string;
  facts: ConversationFacts;
  recentMessages: ChatMessage[];
  totalMessageCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

import { createAgent, anthropic } from "@inngest/agent-kit";
import { transcribeAudio } from "../tools/transcribeAudio.js";
import type { ConversationStateData } from "../types/state.js";

/**
 * De transcriptieagent heeft geen eigen LLM-aanroep nodig.
 * Hij roept direct de transcribeAudio-tool aan via tool_choice.
 *
 * Het systeem-prompt instrueert de agent om de audioUrl uit de state te halen
 * en door te geven aan de tool. We gebruiken claude-haiku voor de tool-dispatch.
 */
export const transcriptionAgent = createAgent<ConversationStateData>({
  name: "transcription",
  description: "Transcribeert audio naar tekst via OpenAI Whisper",
  model: anthropic({
    model: "claude-haiku-4-5-20251001",
    defaultParameters: { max_tokens: 64 },
  }),
  system: ({ network }) => {
    const state = network?.state.data as ConversationStateData | undefined;
    const audioUrl = state?.mediaUrl ?? "";
    return `Je bent een transcriptieagent. Je enige taak is het transcriberen van het audiobestand op de volgende URL naar tekst:

${audioUrl}

Roep de tool transcribe_audio aan met deze URL. Doe niets anders.`;
  },
  tools: [transcribeAudio],
  tool_choice: "transcribe_audio",
});

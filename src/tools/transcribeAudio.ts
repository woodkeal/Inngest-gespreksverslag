import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import OpenAI from "openai";
import type { ConversationStateData } from "../types/state.js";

// Lazy client — initialized on first use so .env changes are picked up after restart
function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY ?? "",
    baseURL: "https://api.groq.com/openai/v1",
  });
}

export const transcribeAudio = createTool({
  name: "transcribe_audio",
  description: "Transcribeer een audiobestand naar tekst via OpenAI Whisper",
  parameters: z.object({
    audioUrl: z.string().describe("De URL van het audiobestand om te transcriberen"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;

    const response = await fetch(input.audioUrl);
    if (!response.ok) {
      throw new Error(`Kon audio niet downloaden: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = input.audioUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "ogg";
    const mimeMap: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", webm: "audio/webm" };
    const mime = mimeMap[ext] ?? "audio/ogg";
    const file = new File([buffer], `audio.${ext}`, { type: mime });

    const result = await getGroqClient().audio.transcriptions.create({
      model: "whisper-large-v3-turbo",
      file,
      language: "nl",
    });

    const transcript = result.text?.trim() || "(geen spraak gedetecteerd)";
    state.transcript = transcript;

    return transcript;
  },
});

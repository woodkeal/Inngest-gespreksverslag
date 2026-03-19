import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import OpenAI from "openai";
import { logger } from "../lib/logger.js";
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
  handler: async (input, { network, step }) => {
    const state = network.state.data as ConversationStateData;

    // Gebruik state.mediaUrl als authoritative bron; input.audioUrl als fallback
    const audioUrl = state.mediaUrl ?? input.audioUrl;
    if (!audioUrl) {
      state.failedStep = "transcription";
      state.failureReason = "Geen audiobestand URL beschikbaar — stuur het audiobestand mee als bijlage.";
      logger.error("Transcriptie afgebroken: geen audioUrl", { conversationId: state.conversationId });
      return "Transcriptie afgebroken: geen audiobestand URL.";
    }

    const doTranscribe = async () => {
      // Twilio media URLs vereisen Basic Auth (account SID + auth token)
      const headers: Record<string, string> = {};
      if (audioUrl.includes("api.twilio.com")) {
        const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
        const token = process.env.TWILIO_AUTH_TOKEN ?? "";
        headers["Authorization"] = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
      }

      const response = await fetch(audioUrl, { headers });
      if (!response.ok) {
        throw new Error(`Kon audio niet downloaden: ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Bepaal extensie: probeer URL eerst, val terug op Content-Type header
      const urlExt = audioUrl.split("?")[0].split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
      const mimeMap: Record<string, string> = {
        wav: "audio/wav", mp3: "audio/mpeg", mp4: "audio/mp4",
        ogg: "audio/ogg", m4a: "audio/mp4", webm: "audio/webm",
        flac: "audio/flac", opus: "audio/opus", mpeg: "audio/mpeg", mpga: "audio/mpeg",
      };
      const mimeToExt: Record<string, string> = {
        "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a",
        "audio/ogg": "ogg", "audio/webm": "webm", "audio/flac": "flac", "audio/opus": "ogg",
      };

      const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
      const mime = mimeMap[urlExt] ?? (contentType || "audio/ogg");
      const ext = mimeMap[urlExt] ? urlExt : (mimeToExt[mime] ?? "ogg");

      const file = new File([buffer], `audio.${ext}`, { type: mime });

      const result = await getGroqClient().audio.transcriptions.create({
        model: "whisper-large-v3-turbo",
        file,
        language: "nl",
      });

      return result.text?.trim() || "(geen spraak gedetecteerd)";
    };

    const attempt = state.retryCount["transcription"] ?? 0;
    const stepId = attempt === 0 ? "transcribe-audio" : `transcribe-audio-retry-${attempt}`;

    logger.info("Transcriptie starten", { conversationId: state.conversationId, audioUrl, attempt });
    try {
      const transcript = await (step?.run(stepId, doTranscribe) ?? doTranscribe());
      logger.info("Transcriptie voltooid", { conversationId: state.conversationId, transcriptLength: transcript.length, preview: transcript.slice(0, 80) });
      state.transcript = transcript;
      return transcript;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error("Transcriptie mislukt", { conversationId: state.conversationId, attempt, reason });
      state.failedStep = "transcription";
      state.failureReason = reason;
      return `Transcriptie mislukt: ${reason}`;
    }
  },
});

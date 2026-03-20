import { getOpenAIClient } from "../lib/openai.js";
import { logger } from "../lib/logger.js";

/**
 * Downloads audio from a URL and transcribes it to Dutch text via OpenAI Whisper.
 *
 * Pure function — no Inngest step wrapping. Call this inside a step.run() in
 * transcribeAudioPipeline so retries and memoization are handled at the pipeline level.
 */
export async function doTranscribeAudio(
  audioUrl: string,
  conversationId: string,
): Promise<string> {
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

  const urlExt =
    audioUrl.split("?")[0].split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
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

  logger.info("Whisper aanroepen", { conversationId, mime, ext });

  const result = await getOpenAIClient().audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "nl",
  });

  return result.text?.trim() || "(geen spraak gedetecteerd)";
}

import type { Intent } from "../types/state.js";

/**
 * Classifies message intent deterministically — no LLM needed.
 *
 * Rules (in priority order):
 * 1. mediaUrl present → transcribe_audio
 * 2. body contains "test" (case-insensitive) → testing
 * 3. body has meaningful text (>= 3 chars) → chat
 * 4. otherwise → unknown
 */
export function classifyIntent(body: string, mediaUrl: string | null): Exclude<Intent, null> {
  if (mediaUrl !== null) return "transcribe_audio";
  if (body.toLowerCase().includes("test")) return "testing";
  if (body.trim().length >= 3) return "chat";
  return "unknown";
}

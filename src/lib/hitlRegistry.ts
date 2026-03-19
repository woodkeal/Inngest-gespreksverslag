import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SESSIONS_FILE = join(process.cwd(), ".tmp", "hitl-sessions.json");

function loadFromFile(): Set<string> {
  try {
    if (existsSync(SESSIONS_FILE)) {
      return new Set(JSON.parse(readFileSync(SESSIONS_FILE, "utf-8")) as string[]);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveToFile(sessions: Set<string>) {
  try {
    mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
    writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions]));
  } catch { /* ignore */ }
}

const activeSessions = loadFromFile();

export function startHitl(conversationId: string) {
  activeSessions.add(conversationId);
  saveToFile(activeSessions);
}

export function endHitl(conversationId: string) {
  activeSessions.delete(conversationId);
  saveToFile(activeSessions);
}

export function isHitlActive(conversationId: string): boolean {
  return activeSessions.has(conversationId);
}

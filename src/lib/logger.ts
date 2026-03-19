type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  requestId?: string;
  conversationId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, ctx: LogContext = {}): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...ctx,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info:  (message: string, ctx?: LogContext) => log("info",  message, ctx),
  warn:  (message: string, ctx?: LogContext) => log("warn",  message, ctx),
  error: (message: string, ctx?: LogContext) => log("error", message, ctx),
  debug: (message: string, ctx?: LogContext) => log("debug", message, ctx),
};

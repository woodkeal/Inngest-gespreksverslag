import { IncomingMessage, ServerResponse } from "node:http";
import twilio from "twilio";
import { inngest } from "../client.js";
import { logger } from "../lib/logger.js";

/** Parse application/x-www-form-urlencoded body from a raw IncomingMessage */
async function parseFormBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      const params: Record<string, string> = {};
      for (const pair of body.split("&")) {
        const [key, val] = pair.split("=");
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(val ?? "");
      }
      resolve(params);
    });
    req.on("error", reject);
  });
}

export async function handleTwilioWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const params = await parseFormBody(req);

  // Verify Twilio signature in production
  if (process.env.NODE_ENV !== "development" && process.env.INNGEST_DEV !== "1") {
    const signature = (req.headers["x-twilio-signature"] as string) ?? "";
    const url = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"}/webhook/whatsapp`;

    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN ?? "",
      signature,
      url,
      params,
    );

    if (!isValid) {
      logger.warn("Twilio handtekening ongeldig", { signature });
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }
  }

  // Ignore status callbacks (delivery receipts for outbound messages)
  if (params["MessageStatus"]) {
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end("<Response></Response>");
    return;
  }

  const from    = params["From"]             ?? "";
  const to      = params["To"]               ?? "";
  const body    = params["Body"]             ?? "";
  const sid     = params["MessageSid"]       ?? "";
  const mediaUrl = params["MediaUrl0"];
  const mediaContentType = params["MediaContentType0"];

  // Ignore echoes: messages sent by the bot itself
  const ownNumber = process.env.TWILIO_WHATSAPP_NUMBER ?? "";
  if (from === ownNumber || from === ownNumber.replace("whatsapp:", "")) {
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end("<Response></Response>");
    return;
  }

  logger.info("Twilio webhook ontvangen", { from, sid, hasMedia: !!mediaUrl });

  await inngest.send({
    name: "message/whatsapp.received",
    data: {
      from,
      to,
      body,
      messageSid: sid,
      conversationId: from,
      mediaUrl,
      mediaContentType,
    },
  });

  // Twilio verwacht een lege TwiML response (geen echo)
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end("<Response></Response>");
}

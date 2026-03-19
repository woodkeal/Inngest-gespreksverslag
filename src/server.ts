import "dotenv/config";
import { createServer } from "@inngest/agent-kit/server";
import { IncomingMessage, ServerResponse } from "node:http";
import { inngest } from "./client.js";
import { conversationNetwork } from "./networks/index.js";
import { handleWhatsApp, handleRestMessage, handleTest } from "./functions/index.js";
import { handleTwilioWebhook } from "./webhooks/twilio.js";
import { logger } from "./lib/logger.js";

// Build the Inngest/AgentKit server
const agentServer = createServer({
  appId: "gespreksverslag",
  client: inngest,
  networks: [conversationNetwork],
  functions: [handleWhatsApp, handleRestMessage, handleTest],
});

// Intercept requests before Inngest handles them so we can add our own routes
const originalListener = agentServer.listeners("request")[0] as (
  req: IncomingMessage,
  res: ServerResponse,
) => void;

agentServer.removeAllListeners("request");

agentServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  // Twilio WhatsApp webhook
  if (url === "/webhook/whatsapp" && method === "POST") {
    try {
      await handleTwilioWebhook(req, res);
    } catch (err) {
      logger.error("Twilio webhook fout", { error: String(err) });
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
    return;
  }

  // REST message endpoint
  if (url === "/api/messages" && method === "POST") {
    let body = "";
    const MAX_BODY = 1024 * 1024; // 1 MB
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > MAX_BODY) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload Too Large" }));
        req.destroy();
      }
    });
    req.on("end", async () => {
      if (res.writableEnded) return;
      try {
        const payload = JSON.parse(body) as {
          sessionId: string;
          content: string;
          replyCallbackUrl?: string;
          mediaUrl?: string;
          mediaContentType?: string;
          userEmail?: string;
        };

        await inngest.send({
          name: "message/rest.received",
          data: {
            sessionId: payload.sessionId,
            content: payload.content,
            replyCallbackUrl: payload.replyCallbackUrl,
            mediaUrl: payload.mediaUrl,
            mediaContentType: payload.mediaContentType,
            userEmail: payload.userEmail,
          },
        });

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true }));
      } catch (err) {
        logger.error("REST message fout", { error: String(err) });
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // Cancel a running conversation pipeline
  const cancelMatch = url.match(/^\/api\/conversations\/([^/]+)\/cancel$/);
  if (cancelMatch && method === "POST") {
    const conversationId = decodeURIComponent(cancelMatch[1]);
    let body = "";
    const MAX_BODY_CANCEL = 64 * 1024; // 64 KB (only needs a reason string)
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_CANCEL) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload Too Large" }));
        req.destroy();
      }
    });
    req.on("end", async () => {
      if (res.writableEnded) return;
      try {
        const payload = body ? (JSON.parse(body) as { reason?: string }) : {};
        await inngest.send({
          name: "conversation/cancel",
          data: { conversationId, reason: payload.reason },
        });
        logger.info("Annuleer-event verstuurd", { conversationId });
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cancelled: true, conversationId }));
      } catch (err) {
        logger.error("Annuleer-fout", { error: String(err) });
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // Health check
  if (url === "/health" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Everything else → Inngest handler
  originalListener(req, res);
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);
agentServer.listen(PORT, () => {
  logger.info(`Server gestart op poort ${PORT}`, {
    inngestEndpoint: `http://localhost:${PORT}/api/inngest`,
    whatsappWebhook: `http://localhost:${PORT}/webhook/whatsapp`,
    restEndpoint: `http://localhost:${PORT}/api/messages`,
  });
});

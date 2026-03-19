import { inngest } from "../client.js";
import { conversationNetwork, createInitialState } from "../networks/index.js";
import { logger } from "../lib/logger.js";
import type { WhatsAppReceivedEvent } from "../types/events.js";

export const handleWhatsApp = inngest.createFunction(
  {
    id: "handle-whatsapp",
    triggers: [{ event: "message/whatsapp.received" }],
    concurrency: {
      key: "event.data.conversationId",
      limit: 1, // één pipeline per gebruiker tegelijk
    },
    retries: 2,
  },
  async ({ event }: { event: { data: WhatsAppReceivedEvent } }) => {
    logger.info("WhatsApp bericht ontvangen", {
      conversationId: event.data.conversationId,
      messageSid: event.data.messageSid,
      hasMedia: !!event.data.mediaUrl,
    });

    const state = createInitialState({
      conversationId: event.data.from,
      channel: "whatsapp",
      mediaUrl: event.data.mediaUrl ?? null,
      messageCount: 1,
    });

    const result = await conversationNetwork.run(event.data.body, { state });

    logger.info("WhatsApp pipeline voltooid", {
      conversationId: event.data.conversationId,
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    });

    return {
      intent: result.state.data.intent,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    };
  },
);

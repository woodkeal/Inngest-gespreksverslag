import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import twilio from "twilio";
import type { ConversationStateData } from "../types/state.js";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const sendWhatsApp = createTool({
  name: "send_whatsapp",
  description: "Stuur een WhatsApp bericht via Twilio",
  parameters: z.object({
    to: z.string().describe("Ontvanger in E.164 formaat, bijv. whatsapp:+31612345678"),
    body: z.string().describe("De inhoud van het bericht (max 1600 tekens)"),
  }),
  handler: async (input, { network }) => {
    const state = network.state.data as ConversationStateData;

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER!,
      to: input.to,
      body: input.body.slice(0, 1600), // WhatsApp tekenlimiet
    });

    state.messageSent = true;
    return `Bericht verzonden naar ${input.to}`;
  },
});

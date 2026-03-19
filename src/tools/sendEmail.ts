import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { sendEmail } from "../lib/email.js";
import type { ConversationStateData } from "../types/state.js";

export const sendEmailTool = createTool({
  name: "send_email",
  description: "Verstuur het gespreksverslag als HTML e-mail via SendGrid",
  parameters: z.object({
    to: z.string().email().describe("E-mailadres van de ontvanger"),
    subject: z.string().describe("Onderwerp van de e-mail"),
    html: z.string().describe("HTML inhoud van de e-mail"),
  }),
  handler: async (input, { network, step }) => {
    const state = network.state.data as ConversationStateData;

    const doSend = async () => sendEmail({ to: input.to, subject: input.subject, html: input.html });
    await (step?.run("send-email", doSend) ?? doSend());

    state.emailSent = true;
    state.userEmail = input.to;
    return `E-mail verstuurd naar ${input.to}`;
  },
});

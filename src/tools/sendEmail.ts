import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import type { ConversationStateData } from "../types/state.js";

export const sendEmailTool = createTool({
  name: "send_email",
  description: "Verstuur het gespreksverslag als HTML e-mail via SendGrid",
  parameters: z.object({
    to: z.string().email().describe("E-mailadres van de ontvanger"),
    subject: z.string().describe("Onderwerp van de e-mail"),
  }),
  handler: async (input, { network, step }) => {
    const state = network.state.data as ConversationStateData;
    const html = state.htmlOutput ?? "<p>Geen rapport beschikbaar</p>";

    const attempt = state.retryCount["email"] ?? 0;
    const stepId = attempt === 0 ? "send-email" : `send-email-retry-${attempt}`;

    logger.info("E-mail versturen", { conversationId: state.conversationId, to: input.to, subject: input.subject, htmlLength: html.length, attempt });
    const doSend = async () => sendEmail({ to: input.to, subject: input.subject, html });
    try {
      await (step?.run(stepId, doSend) ?? doSend());
      logger.info("E-mail verstuurd", { conversationId: state.conversationId, to: input.to });
      state.emailSent = true;
      state.userEmail = input.to;
      return `E-mail verstuurd naar ${input.to}`;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error("E-mail versturen mislukt", { conversationId: state.conversationId, to: input.to, attempt, reason });
      state.failedStep = "email";
      state.failureReason = reason;
      return `E-mail versturen mislukt: ${reason}`;
    }
  },
});

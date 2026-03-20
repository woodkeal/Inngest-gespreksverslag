import { inngest } from "../client.js";
import { NonRetriableError } from "inngest";
import {
  transcribeAudioNetwork,
  createTranscriptionState,
} from "../networks/transcribeAudioNetwork.js";
import { doTranscribeAudio } from "../tools/transcribeAudio.js";
import { logger } from "../lib/logger.js";
import { startHitl, endHitl } from "../lib/hitlRegistry.js";
import twilio from "twilio";

export const transcribeAudioPipeline = inngest.createFunction(
  {
    id: "transcribe-audio-pipeline",
    triggers: [{ event: "pipeline/transcribe-audio.start" }],
    concurrency: {
      key: "event.data.conversationId",
      limit: 1,
    },
    cancelOn: [{ event: "conversation/cancel", match: "data.conversationId" }],
    retries: 0,
    onFailure: async ({ event }) => {
      // Safety net: fires if the pipeline throws an unhandled error.
      // Normal errors are handled by errorHandlerAgent inside the network.
      const data = event.data as unknown as {
        conversationId: string;
        channel: string;
        replyCallbackUrl?: string | null;
      };
      const message =
        "Er is een onverwachte fout opgetreden bij het verwerken van je gespreksverslag. Probeer het later opnieuw.";

      if (data.channel === "whatsapp") {
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
          );
          await client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER!,
            to: data.conversationId,
            body: message,
          });
        } catch (err) {
          logger.error("onFailure: WhatsApp foutbericht mislukt", { error: String(err) });
        }
      } else if (data.replyCallbackUrl) {
        try {
          await fetch(data.replyCallbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          });
        } catch (err) {
          logger.error("onFailure: REST foutbericht mislukt", { error: String(err) });
        }
      }
    },
  },
  async ({
    event,
    step,
  }: {
    event: {
      data: {
        conversationId: string;
        channel: import("../types/state.js").Channel;
        mediaUrl: string;
        userEmail?: string | null;
        replyCallbackUrl?: string | null;
      };
    };
    step: any;
  }) => {
    const { conversationId, channel, mediaUrl, userEmail, replyCallbackUrl } = event.data;

    const state = createTranscriptionState({
      conversationId,
      channel,
      mediaUrl,
      userEmail: userEmail ?? null,
      replyCallbackUrl: replyCallbackUrl ?? null,
    });

    // Retry loop — error path has no step.waitForEvent so resumes synchronously.
    // Unique step IDs per attempt preserve HITL compatibility.
    let attempt = 0;

    while (true) {
      const stepId =
        attempt === 0 ? "transcribe-audio" : `transcribe-audio-retry-${attempt}`;
      state.data.retryCount = { ...state.data.retryCount, transcription: attempt };

      logger.info("Transcriptie starten", { conversationId, mediaUrl, attempt });

      try {
        const transcript = await step.run(stepId, () =>
          doTranscribeAudio(mediaUrl, conversationId),
        );

        logger.info("Transcriptie voltooid", {
          conversationId,
          transcriptLength: transcript.length,
          preview: transcript.slice(0, 80),
        });
        state.data.transcript = transcript;
        break; // success — exit retry loop

      } catch (err) {
        // NonRetriableError re-throws so Inngest fires onFailure
        if (err instanceof NonRetriableError) throw err;

        const reason = err instanceof Error ? err.message : String(err);
        logger.error("Transcriptie mislukt", { conversationId, attempt, reason });
        state.data.failedStep = "transcription";
        state.data.failureReason = reason;
      }

      // Error path: let errorHandlerAgent + messengerAgent handle it
      await transcribeAudioNetwork.run("", { state });

      if (state.data.shouldRetry) {
        attempt++;
        // Reset error state for next attempt
        state.data.failedStep = null;
        state.data.failureReason = null;
        state.data.errorHandled = false;
        state.data.shouldRetry = null;
        state.data.errorUserMessage = null;
        state.data.errorMessageSent = false;
        continue;
      }

      // User notified, no retry requested → done
      return { success: false, reason: state.data.failureReason };
    }

    // Collect email address at pipeline level before running the network.
    // This ensures emailAgent is only invoked once, avoiding duplicate step ID "email"
    // (agent-kit uses agent.name as the step ID for each LLM inference call).
    if (!state.data.userEmail) {
      if (channel === "whatsapp") {
        // Ask via HITL — same pattern as askFollowUp tool
        startHitl(conversationId);

        await step.run("ask-for-email", () => {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
          );
          return client.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER!,
            to: conversationId,
            body: "Op welk e-mailadres wil je het gespreksverslag ontvangen?",
          });
        });

        const emailReply = await step.waitForEvent("wait-for-email-reply", {
          event: "conversation/hitl.reply",
          timeout: "30m",
          if: `async.data.conversationId == "${conversationId}"`,
        });

        endHitl(conversationId);

        if (!emailReply) {
          await step.run("send-email-timeout", () => {
            const client = twilio(
              process.env.TWILIO_ACCOUNT_SID,
              process.env.TWILIO_AUTH_TOKEN,
            );
            return client.messages.create({
              from: process.env.TWILIO_WHATSAPP_NUMBER!,
              to: conversationId,
              body: "Je gespreksverslag kon niet verstuurd worden. Stuur opnieuw een audiobericht en vermeld je e-mailadres.",
            });
          });
          return { success: false, reason: "email-address-timeout" };
        }

        state.data.userEmail = (emailReply as any).data.body.trim();
      } else {
        // REST channel without email: skip email delivery
        state.data.emailSent = true;
      }
    }

    // Success path: report → html → email → messenger
    const result = await transcribeAudioNetwork.run(state.data.transcript!, { state });

    logger.info("Transcriptie pipeline voltooid", {
      conversationId,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    });

    return {
      success: true,
      emailSent: result.state.data.emailSent,
      messageSent: result.state.data.messageSent,
    };
  },
);

import sgMail from "@sendgrid/mail";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Set API key lazily so missing keys don't crash at startup
  sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

  const fromEmail = process.env.EMAIL_FROM;
  if (!fromEmail) throw new Error("EMAIL_FROM env var is required but not set");

  try {
    await sgMail.send({
      to: payload.to,
      from: {
        email: fromEmail,
        name: process.env.EMAIL_FROM_NAME ?? "Gespreksverslag",
      },
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.subject,
    });
  } catch (err: unknown) {
    const sgErr = err as { code?: number; response?: { body?: { errors?: Array<{ message: string }> } } };
    const messages = sgErr.response?.body?.errors?.map(e => e.message) ?? [];
    throw new Error(`SendGrid ${sgErr.code ?? "error"}: ${messages.join("; ") || String(err)}`);
  }
}

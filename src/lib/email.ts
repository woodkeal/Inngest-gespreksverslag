import sgMail from "@sendgrid/mail";
import { writeFileSync } from "node:fs";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // Set API key lazily so missing keys don't crash at startup
  sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

  try {
    await sgMail.send({
      to: payload.to,
      from: {
        email: process.env.EMAIL_FROM ?? "noreply@example.com",
        name: process.env.EMAIL_FROM_NAME ?? "Gespreksverslag Bot",
      },
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.subject,
    });
  } catch (err) {
    // Fallback: save to file when the email provider is unreachable
    const outputPath = `/tmp/gespreksverslag_email_${Date.now()}.html`;
    writeFileSync(outputPath, `<!-- To: ${payload.to} | Subject: ${payload.subject} -->\n${payload.html}`);
    console.warn(`[email] SendGrid unreachable — email saved to ${outputPath}`);
    throw err; // re-throw so caller knows it wasn't delivered
  }
}

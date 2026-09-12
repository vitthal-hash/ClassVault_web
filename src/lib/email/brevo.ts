/**
 * Sends transactional email via Brevo's HTTP API (no SDK needed - it's a
 * single JSON POST). Requires two environment variables:
 *
 *   BREVO_API_KEY       - your Brevo API key (Settings -> SMTP & API -> API Keys)
 *   BREVO_SENDER_EMAIL   - a sender address verified in your Brevo account
 *
 * Optionally:
 *   BREVO_SENDER_NAME    - display name for the sender (defaults to "ClassVault")
 */
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendOtpEmail(to: string, otp: string, displayName?: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    throw new Error(
      "Email sending isn't configured yet. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in your environment."
    );
  }
  const senderName = process.env.BREVO_SENDER_NAME || "ClassVault";

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: displayName || to }],
      subject: `${otp} is your ClassVault verification code`,
      htmlContent: otpEmailHtml(otp, displayName),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send verification email (Brevo ${res.status}). ${body}`.trim());
  }
}

function otpEmailHtml(otp: string, displayName?: string) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f5f6fb; padding:32px;">
    <div style="max-width:420px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; text-align:center;">
      <div style="width:44px; height:44px; border-radius:14px; background:#6366f1; margin:0 auto 16px; display:flex; align-items:center; justify-content:center;"></div>
      <h1 style="font-size:18px; color:#14162b; margin:0 0 8px;">Verify your email</h1>
      <p style="font-size:14px; color:#6b7086; margin:0 0 24px;">
        ${displayName ? `Hi ${displayName}, use` : "Use"} this code to finish creating your ClassVault account:
      </p>
      <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#6366f1; margin-bottom:24px;">
        ${otp}
      </div>
      <p style="font-size:12px; color:#9599b8; margin:0;">
        This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

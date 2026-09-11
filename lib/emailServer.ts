import { Resend } from "resend";

// Server-only. Sends the actual "someone gifted you something" email via
// Resend. Until RESEND_API_KEY is set, sendGiftEmail throws a clear error
// that callers should surface as "email sending isn't configured yet" --
// the gift code itself still works for manual sharing either way.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared test sender works with zero setup but is best-effort on
// deliverability. Once sameheart.ca (or similar) is verified in Resend,
// set RESEND_FROM_EMAIL to an address on that domain for real delivery.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Same Heart <onboarding@resend.dev>";

export async function sendGiftEmail(params: {
  to: string;
  rewardTitle: string;
  rewardDescription: string;
  code: string;
  claimUrl: string;
}): Promise<void> {
  if (!resend) {
    throw new Error("email sending is not configured yet (missing RESEND_API_KEY)");
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [params.to],
    subject: `Someone sent you a gift: ${params.rewardTitle}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0a0e1a; color: #ece7dc;">
        <p style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a15a; margin: 0 0 18px;">
          Same Heart
        </p>
        <h1 style="font-family: Arial, sans-serif; font-size: 24px; margin: 0 0 12px;">
          ${params.rewardTitle}
        </h1>
        <p style="font-style: italic; color: #9aa3b8; margin: 0 0 24px;">
          ${params.rewardDescription}
        </p>
        <p style="margin: 0 0 28px;">Someone on Same Heart wanted you to have this.</p>
        <p style="margin: 0 0 20px;">
          <a href="${params.claimUrl}" style="background: #c9a15a; color: #0a0e1a; padding: 12px 22px; border-radius: 999px; text-decoration: none; font-weight: bold; font-family: Arial, sans-serif;">
            Claim it
          </a>
        </p>
        <p style="font-size: 12px; color: #9aa3b8;">Or use this code on the site: ${params.code}</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

import type { Env } from "../types";

export async function sendMagicLinkEmail(env: Env, appUrl: string, email: string, token: string) {
  const link = `${appUrl}/auth/verify?token=${token}`;

  if (!env.RESEND_API_KEY) {
    // No email provider configured yet (e.g. local dev). Log instead of sending.
    console.log(`[dev] Magic link for ${email}: ${link}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Story Worlds <onboarding@resend.com>",
      to: email,
      subject: "Your Story Worlds login link",
      html: `<p>Click below to log in. This link expires in 15 minutes.</p><p><a href="${link}">${link}</a></p>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send magic link email: ${res.status} ${await res.text()}`);
  }
}

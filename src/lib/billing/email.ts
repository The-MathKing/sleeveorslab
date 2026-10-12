// Restore-link email via Resend's HTTP API (plain fetch, no SDK).

export const SUPPORT_EMAIL = "hello@sleeveorslab.com";
const DEFAULT_FROM = `Sleeve or Slab <${SUPPORT_EMAIL}>`;

export function resendConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.RESEND_API_KEY?.trim();
}

export function restoreEmailContent(link: string): { subject: string; text: string; html: string } {
  const subject = "Your Sleeve or Slab restore link";
  const text = [
    "Someone (hopefully you) asked to restore a Sleeve or Slab purchase on a new device or browser.",
    "",
    `Open this link within 30 minutes: ${link}`,
    "",
    "If that wasn't you, ignore this email. Nothing changes and nobody gets access unless the link is opened.",
    "",
    `Questions? Reply or write to ${SUPPORT_EMAIL}.`,
  ].join("\n");
  const safe = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<p>Someone (hopefully you) asked to restore a Sleeve or Slab purchase on a new device or browser.</p>
<p><a href="${safe}">Restore my purchase</a> (works for 30 minutes)</p>
<p>If that wasn't you, ignore this email. Nothing changes unless the link is opened.</p>
<p>Questions? Write to ${SUPPORT_EMAIL}.</p>`;
  return { subject, text, html };
}

export async function sendRestoreEmail(to: string, link: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const { subject, text, html } = restoreEmailContent(link);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM?.trim() || DEFAULT_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[billing] resend failed", res.status);
    return res.ok;
  } catch (err) {
    console.error("[billing] resend error", err);
    return false;
  }
}

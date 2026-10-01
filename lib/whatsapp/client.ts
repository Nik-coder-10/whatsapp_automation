import "server-only";

/**
 * WhatsApp Business Platform (Cloud API) sender — server-only.
 *
 * Uses ONLY the official API. No Web/Selenium/Puppeteer automation.
 * Tokens live in server env and are never bundled to the client.
 * Phase 1: typed contract + safe no-op guard when unconfigured.
 */

export interface WhatsAppTextMessage {
  to: string; // E.164, e.g. "919876543210"
  body: string;
}

export interface WhatsAppSendResult {
  queued: boolean;
  providerMessageId?: string;
  reason?: string;
}

function config() {
  return {
    baseUrl: process.env.WHATSAPP_API_BASE_URL ?? "https://graph.facebook.com",
    version: process.env.WHATSAPP_API_VERSION ?? "v21.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  };
}

export function isWhatsAppConfigured(): boolean {
  const c = config();
  return c.phoneNumberId !== "" && c.accessToken !== "";
}

export async function sendTextMessage(
  msg: WhatsAppTextMessage,
): Promise<WhatsAppSendResult> {
  const c = config();
  if (!isWhatsAppConfigured()) {
    return { queued: false, reason: "WhatsApp is not configured." };
  }
  const url = `${c.baseUrl}/${c.version}/${c.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "text",
      text: { body: msg.body },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[whatsapp] send failed:", res.status, text.slice(0, 500));
    return { queued: false, reason: `Provider returned ${res.status}.` };
  }
  const json = (await res.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
  } | null;
  return { queued: true, providerMessageId: json?.messages?.[0]?.id };
}

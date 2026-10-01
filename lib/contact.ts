/**
 * Public contact helpers. The business WhatsApp number is operational
 * config (public contact info), not a secret — but it is still read
 * from the environment so it is never hard-coded into the UI.
 */

export function getWhatsAppNumber(): string | null {
  const n = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").trim();
  return n === "" ? null : n;
}

/** wa.me deep link with pre-filled text, or null when unconfigured. */
export function getWhatsAppLink(message: string): string | null {
  const number = getWhatsAppNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

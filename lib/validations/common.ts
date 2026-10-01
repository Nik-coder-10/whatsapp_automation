/**
 * Dependency-free input validators shared by client + server.
 * Server re-validates everything — client checks are UX only.
 */

/** Exactly 6 digits (Indian PIN code). */
export function isValidPincode(value: string): boolean {
  return /^[1-9][0-9]{5}$/.test(value.trim());
}

/**
 * GSTIN: 15 chars — 2-digit state code, 10-char PAN, entity code,
 * 'Z', checksum. Full checksum verification happens server-side
 * against master data in a later phase; this catches typos early.
 */
export function isValidGstin(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (v === "") return true; // GSTIN is optional
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v);
}

/** 10-digit Indian mobile (allows +91 / leading 0 for UX). */
export function isValidIndianPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "").replace(/^(91|0)/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function normalizePincode(value: string): string {
  return value.trim();
}

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}

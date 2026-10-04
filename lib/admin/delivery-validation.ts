import {
  isValidEmail,
  isValidIndianPhone,
  isValidPincode,
} from "@/lib/validations/common";

/**
 * Delivery admin validation (pure, unit-tested).
 * Money arrives as rupees decimal strings → integer paise exactly.
 */

export interface PartnerFormInput {
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  priority: number;
  isActive: boolean;
}

export interface ValidPartner {
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  priority: number;
  isActive: boolean;
}

export function validatePartnerInput(
  input: PartnerFormInput,
): { errors: Partial<Record<"name" | "contact" | "priority", string>>; value: ValidPartner | null } {
  const errors: Partial<Record<"name" | "contact" | "priority", string>> = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 150) {
    errors.name = "Partner name must be 2–150 characters.";
  }
  const contactName = input.contactName.trim();
  const contactPhone = input.contactPhone.trim();
  const contactEmail = input.contactEmail.trim();
  if (contactPhone !== "" && !isValidIndianPhone(contactPhone)) {
    errors.contact = "Contact phone must be a valid mobile number.";
  } else if (contactEmail !== "" && !isValidEmail(contactEmail)) {
    errors.contact = "Contact email must be valid.";
  }
  if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 10000) {
    errors.priority = "Priority must be a whole number from 0 to 10000.";
  }
  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      name,
      contactName: contactName === "" ? null : contactName,
      contactPhone: contactPhone === "" ? null : contactPhone,
      contactEmail: contactEmail === "" ? null : contactEmail,
      priority: input.priority,
      isActive: input.isActive,
    },
  };
}

export interface RateFormInput {
  pincode: string;
  partnerId: string;
  serviceable: boolean;
  chargeRupees: string;
  minOrderRupees: string;
  maxOrderRupees: string;
  etaMinDays: string;
  etaMaxDays: string;
}

export interface ValidRate {
  pincode: string;
  partnerId: string;
  serviceable: boolean;
  chargePaise: number;
  minOrderPaise: number | null;
  maxOrderPaise: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
}

export type RateField =
  | "pincode" | "partnerId" | "chargeRupees" | "minOrderRupees"
  | "maxOrderRupees" | "etaMinDays" | "etaMaxDays";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY_RE = /^\d+(?:\.\d{1,2})?$/;

function optPaise(raw: string): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  if (!MONEY_RE.test(v)) return "invalid";
  const paise = Math.round(Number(v) * 100);
  return Number.isSafeInteger(paise) && paise >= 0 ? paise : "invalid";
}

function optDays(raw: string): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 60 ? n : "invalid";
}

export function validateRateInput(
  input: RateFormInput,
): { errors: Partial<Record<RateField, string>>; value: ValidRate | null } {
  const errors: Partial<Record<RateField, string>> = {};
  const pincode = input.pincode.trim();
  if (!isValidPincode(pincode)) {
    errors.pincode = "Pincode must be exactly 6 digits.";
  }
  if (!UUID_RE.test(input.partnerId)) {
    errors.partnerId = "Select a valid delivery partner.";
  }
  if (!MONEY_RE.test(input.chargeRupees.trim())) {
    errors.chargeRupees = "Charge must be a non-negative amount (max 2 decimals).";
  }
  const chargePaise = MONEY_RE.test(input.chargeRupees.trim())
    ? Math.round(Number(input.chargeRupees.trim()) * 100)
    : NaN;
  if (!Number.isSafeInteger(chargePaise) || chargePaise < 0) {
    errors.chargeRupees = "Charge must be a non-negative amount (max 2 decimals).";
  }
  const minOrderPaise = optPaise(input.minOrderRupees);
  if (minOrderPaise === "invalid") errors.minOrderRupees = "Invalid minimum order amount.";
  const maxOrderPaise = optPaise(input.maxOrderRupees);
  if (maxOrderPaise === "invalid") errors.maxOrderRupees = "Invalid maximum order amount.";
  if (
    typeof minOrderPaise === "number" && typeof maxOrderPaise === "number" &&
    maxOrderPaise < minOrderPaise
  ) {
    errors.maxOrderRupees = "Maximum must be at least the minimum.";
  }
  const etaMinDays = optDays(input.etaMinDays);
  if (etaMinDays === "invalid") errors.etaMinDays = "ETA must be 0–60 days.";
  const etaMaxDays = optDays(input.etaMaxDays);
  if (etaMaxDays === "invalid") errors.etaMaxDays = "ETA must be 0–60 days.";
  if (
    typeof etaMinDays === "number" && typeof etaMaxDays === "number" &&
    etaMaxDays < etaMinDays
  ) {
    errors.etaMaxDays = "Max ETA must be at least the min ETA.";
  }
  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      pincode,
      partnerId: input.partnerId,
      serviceable: input.serviceable,
      chargePaise,
      minOrderPaise: typeof minOrderPaise === "number" ? minOrderPaise : null,
      maxOrderPaise: typeof maxOrderPaise === "number" ? maxOrderPaise : null,
      etaMinDays: typeof etaMinDays === "number" ? etaMinDays : null,
      etaMaxDays: typeof etaMaxDays === "number" ? etaMaxDays : null,
    },
  };
}

/** Rupees decimal string for NUMERIC columns. */
export function paiseToDecimal(paise: number): string {
  return (paise / 100).toFixed(2);
}

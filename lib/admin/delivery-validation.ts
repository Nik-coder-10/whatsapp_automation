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
  remoteSurchargeRupees: string;
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
  remoteSurchargePaise: number;
  minOrderPaise: number | null;
  maxOrderPaise: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
}

export type RateField =
  | "pincode" | "partnerId" | "chargeRupees" | "remoteSurchargeRupees"
  | "minOrderRupees" | "maxOrderRupees" | "etaMinDays" | "etaMaxDays";

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
  // Optional for older callers (CSV import): blank means no surcharge.
  const remote = String(input.remoteSurchargeRupees ?? "").trim();
  const remotePaise =
    remote === "" ? 0 : MONEY_RE.test(remote) ? Math.round(Number(remote) * 100) : NaN;
  if (!Number.isSafeInteger(remotePaise) || remotePaise < 0) {
    errors.remoteSurchargeRupees =
      "Remote surcharge must be blank/0 or a non-negative amount (max 2 decimals).";
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
      remoteSurchargePaise: remotePaise,
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

const KG_RE = /^\d+(?:\.\d{1,3})?$/;

function optKg(raw: string): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  if (!KG_RE.test(v)) return "invalid";
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : "invalid";
}

export interface SlabFormInput {
  partnerId: string;
  minKg: string;
  /** Blank = open-ended top band. */
  maxKg: string;
  chargeRupees: string;
}

export interface ValidSlab {
  partnerId: string;
  minKg: string;
  maxKg: string | null;
  chargePaise: number;
}

export type SlabField = "partnerId" | "minKg" | "maxKg" | "chargeRupees";

/** Existing bands for the partner (kg numbers), for overlap checks. */
export interface SlabBand {
  minKg: number;
  maxKg: number | null;
}

/**
 * Weight-slab validation (pure, unit-tested). Bands are [min, max);
 * ambiguity is rejected: the new band must not overlap any existing
 * band for the same partner.
 */
export function validateSlabInput(
  input: SlabFormInput,
  existing: SlabBand[],
): { errors: Partial<Record<SlabField, string>>; value: ValidSlab | null } {
  const errors: Partial<Record<SlabField, string>> = {};
  if (!UUID_RE.test(input.partnerId)) {
    errors.partnerId = "Select a valid delivery partner.";
  }
  const min = optKg(input.minKg);
  if (min === "invalid" || min === null) {
    errors.minKg = "Min weight must be 0–100000 kg (max 3 decimals).";
  }
  const max = optKg(input.maxKg);
  if (max === "invalid") {
    errors.maxKg = "Max weight must be blank or 0–100000 kg (max 3 decimals).";
  }
  if (typeof min === "number" && typeof max === "number" && max <= min) {
    errors.maxKg = "Max weight must be above the min weight (or blank).";
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
  if (
    typeof min === "number" &&
    (max === null || typeof max === "number") &&
    errors.minKg === undefined &&
    errors.maxKg === undefined
  ) {
    const hi = max ?? Number.POSITIVE_INFINITY;
    const clash = existing.some(
      (b) => min < (b.maxKg ?? Number.POSITIVE_INFINITY) && b.minKg < hi,
    );
    if (clash) {
      errors.minKg = "This band overlaps an existing band for the partner.";
    }
  }
  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      partnerId: input.partnerId,
      minKg: (min as number).toFixed(3),
      maxKg: max === null ? null : (max as number).toFixed(3),
      chargePaise,
    },
  };
}

export interface CategoryRuleFormInput {
  category: string;
  surchargeRupees: string;
  note: string;
}

export interface ValidCategoryRule {
  category: string;
  surchargePaise: number;
  note: string | null;
}

export type CategoryRuleField = "category" | "surchargeRupees" | "note";

/** Category handling-rule validation (pure, unit-tested). */
export function validateCategoryRuleInput(
  input: CategoryRuleFormInput,
): {
  errors: Partial<Record<CategoryRuleField, string>>;
  value: ValidCategoryRule | null;
} {
  const errors: Partial<Record<CategoryRuleField, string>> = {};
  const category = input.category.trim();
  if (category.length < 2 || category.length > 100) {
    errors.category = "Category must be 2–100 characters.";
  }
  if (!MONEY_RE.test(input.surchargeRupees.trim())) {
    errors.surchargeRupees = "Surcharge must be a non-negative amount (max 2 decimals).";
  }
  const surchargePaise = MONEY_RE.test(input.surchargeRupees.trim())
    ? Math.round(Number(input.surchargeRupees.trim()) * 100)
    : NaN;
  if (!Number.isSafeInteger(surchargePaise) || surchargePaise < 0) {
    errors.surchargeRupees = "Surcharge must be a non-negative amount (max 2 decimals).";
  }
  const note = input.note.trim();
  if (note.length > 200) {
    errors.note = "Note must be under 200 characters.";
  }
  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      category,
      surchargePaise,
      note: note === "" ? null : note,
    },
  };
}

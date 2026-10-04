import {
  isValidEmail,
  isValidGstin,
  isValidIndianPhone,
  isValidPincode,
  normalizeGstin,
  normalizePhone,
  normalizePincode,
} from "@/lib/validations/common";

/**
 * Checkout form validation (client UX + shared with future order API).
 * Pure and dependency-free apart from lib/validations — unit-tested.
 * The server re-validates everything at order time.
 */

export interface CheckoutFormData {
  name: string;
  phone: string;
  email: string;
  gstin: string;
  pincode: string;
}

export type CheckoutField = keyof CheckoutFormData;
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutFormData = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  pincode: "",
};

export interface CheckoutValidation {
  errors: CheckoutErrors;
  /** Empty cart is a form-level state (no field owns it). */
  cartEmpty: boolean;
  valid: boolean;
}

export function validateCheckoutForm(
  form: CheckoutFormData,
  itemCount: number,
): CheckoutValidation {
  const errors: CheckoutErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = "Enter your full name.";
  }
  if (!isValidIndianPhone(form.phone)) {
    errors.phone = "Enter a valid 10-digit mobile number.";
  }
  if (form.email.trim() !== "" && !isValidEmail(form.email)) {
    errors.email = "Enter a valid email address, or leave it blank.";
  }
  if (!isValidGstin(form.gstin)) {
    errors.gstin = "Enter a valid 15-character GSTIN, or leave it blank.";
  }
  if (!isValidPincode(form.pincode)) {
    errors.pincode = "Enter a valid 6-digit delivery pincode.";
  }
  const cartEmpty = itemCount <= 0;
  return {
    errors,
    cartEmpty,
    valid: Object.keys(errors).length === 0 && !cartEmpty,
  };
}

/** Normalised payload for the future order API (never prices/totals). */
export function normalizeCheckoutForm(form: CheckoutFormData) {
  return {
    name: form.name.trim(),
    phone: normalizePhone(form.phone),
    email: form.email.trim() === "" ? null : form.email.trim(),
    gstin: form.gstin.trim() === "" ? null : normalizeGstin(form.gstin),
    pincode: normalizePincode(form.pincode),
  };
}

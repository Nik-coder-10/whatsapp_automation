/** Shared, dependency-free constants for the Trolift platform. */

export const CURRENCY = "INR" as const;
export const CURRENCY_SYMBOL = "₹" as const;

/** Indian PIN codes are exactly 6 digits. */
export const PINCODE_LENGTH = 6 as const;

/** GSTIN is 15 characters (format validated in lib/validations). */
export const GSTIN_LENGTH = 15 as const;

/** API envelope version — bump only on breaking changes. */
export const API_VERSION = "v1" as const;

/** Placeholder for future paginated admin lists. */
export const DEFAULT_PAGE_SIZE = 20 as const;
export const MAX_PAGE_SIZE = 100 as const;

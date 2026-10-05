/**
 * Trolift business identity for invoices (server configuration, not DB).
 *
 * The seller block on every invoice comes from THESE environment values
 * — never from product/customer rows — so catalogue edits cannot alter
 * who issued a historical invoice. Optional fields are omitted from the
 * document when unconfigured rather than rendered as blanks.
 */

export interface BusinessDetails {
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  /** Seller GSTIN (display only — format-checked, never verified). */
  gstin: string | null;
}

/** Uppercase-letter prefix for invoice numbers (default INV). */
export function getInvoicePrefix(): string {
  const raw = (process.env.TROLIFT_INVOICE_PREFIX ?? "INV").trim().toUpperCase();
  if (!/^[A-Z]{2,10}$/.test(raw)) {
    throw new Error(
      "[invoices] TROLIFT_INVOICE_PREFIX must be 2–10 uppercase letters.",
    );
  }
  return raw;
}

/**
 * Read + validate the seller block. Name and address are required —
 * invoicing without them is a configuration error (500, never a
 * half-headed PDF). GSTIN here is display-only.
 */
export function getBusinessDetails(): BusinessDetails {
  const name = (process.env.TROLIFT_BUSINESS_NAME ?? "").trim();
  const address = (process.env.TROLIFT_BUSINESS_ADDRESS ?? "").trim();
  if (name === "" || address === "") {
    throw new Error(
      "[invoices] TROLIFT_BUSINESS_NAME and TROLIFT_BUSINESS_ADDRESS are required.",
    );
  }
  const phone = (process.env.TROLIFT_BUSINESS_PHONE ?? "").trim();
  const email = (process.env.TROLIFT_BUSINESS_EMAIL ?? "").trim();
  const gstin = (process.env.TROLIFT_BUSINESS_GSTIN ?? "").trim().toUpperCase();
  return {
    name,
    address,
    phone: phone === "" ? null : phone,
    email: email === "" ? null : email,
    gstin: gstin === "" ? null : gstin,
  };
}

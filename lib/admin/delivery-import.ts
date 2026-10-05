import { parseCsvTable } from "@/lib/admin/csv";

/**
 * Rate CSV parsing (pure, unit-tested).
 * Format: pincode,partner,charge,serviceable[,min_order,max_order,eta_min,eta_max]
 * Partner is matched by name (case-insensitive) at import time.
 * Nothing is written here — the API validates every row first and
 * reports per-row errors without committing anything.
 */

export interface CsvRateRow {
  line: number;
  pincode: string;
  partnerName: string;
  chargeRupees: string;
  serviceable: boolean;
  minOrderRupees: string;
  maxOrderRupees: string;
  etaMinDays: string;
  etaMaxDays: string;
}

export interface CsvParseResult {
  rows: CsvRateRow[];
  errors: Array<{ line: number; message: string }>;
}

const EXPECTED_HEADER = [
  "pincode", "partner", "charge", "serviceable",
  "min_order", "max_order", "eta_min", "eta_max",
];

export function parseRateCsv(text: string): CsvParseResult {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: CsvRateRow[] = [];
  const table = parseCsvTable(text, EXPECTED_HEADER);
  errors.push(...table.errors);
  for (const row of table.rows) {
    const [pincode, partnerName, chargeRupees, serviceable, minOrderRupees, maxOrderRupees, etaMinDays, etaMaxDays] =
      row.cells;
    const svc = (serviceable ?? "").toLowerCase();
    if (svc !== "true" && svc !== "false") {
      errors.push({ line: row.line, message: "serviceable must be true or false." });
      continue;
    }
    rows.push({
      line: row.line,
      pincode: pincode ?? "",
      partnerName: partnerName ?? "",
      chargeRupees: chargeRupees ?? "",
      serviceable: svc === "true",
      minOrderRupees: minOrderRupees ?? "",
      maxOrderRupees: maxOrderRupees ?? "",
      etaMinDays: etaMinDays ?? "",
      etaMaxDays: etaMaxDays ?? "",
    });
  }
  return { rows, errors };
}

/**
 * CSV bulk-import parsing + validation (pure, unit-tested).
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

function splitCsvLine(line: string): string[] {
  // Minimal CSV: commas separate, double quotes escape. Enough for the
  // controlled admin format; rejects exotic quoting explicitly.
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return quoted ? [] : cells;
}

export function parseRateCsv(text: string): CsvParseResult {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: CsvRateRow[] = [];
  const lines = text.split(/\r?\n/);
  let headerSeen = false;

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    if (raw.trim() === "") return;
    const cells = splitCsvLine(raw);
    if (cells.length === 0) {
      errors.push({ line: lineNo, message: "Unbalanced quotes." });
      return;
    }
    if (!headerSeen) {
      headerSeen = true;
      const header = cells.map((c) => c.trim().toLowerCase());
      const ok =
        header.length === EXPECTED_HEADER.length &&
        EXPECTED_HEADER.every((h, i) => header[i] === h);
      if (!ok) {
        errors.push({
          line: lineNo,
          message: `Header must be: ${EXPECTED_HEADER.join(",")}`,
        });
      }
      return;
    }
    if (cells.length !== EXPECTED_HEADER.length) {
      errors.push({
        line: lineNo,
        message: `Expected ${EXPECTED_HEADER.length} columns, got ${cells.length}.`,
      });
      return;
    }
    const [pincode, partnerName, chargeRupees, serviceable, minOrderRupees, maxOrderRupees, etaMinDays, etaMaxDays] =
      cells.map((c) => c.trim());
    const svc = (serviceable ?? "").toLowerCase();
    if (svc !== "true" && svc !== "false") {
      errors.push({ line: lineNo, message: "serviceable must be true or false." });
      return;
    }
    rows.push({
      line: lineNo,
      pincode: pincode ?? "",
      partnerName: partnerName ?? "",
      chargeRupees: chargeRupees ?? "",
      serviceable: svc === "true",
      minOrderRupees: minOrderRupees ?? "",
      maxOrderRupees: maxOrderRupees ?? "",
      etaMinDays: etaMinDays ?? "",
      etaMaxDays: etaMaxDays ?? "",
    });
  });

  if (!headerSeen) {
    return { rows: [], errors: [{ line: 0, message: "Empty file: header row required." }] };
  }
  return { rows, errors };
}

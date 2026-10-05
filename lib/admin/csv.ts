/**
 * Minimal CSV table parsing shared by admin bulk imports (pure).
 *
 * Commas separate, double quotes escape (""). Enough for the
 * controlled admin format; exotic quoting is rejected explicitly
 * rather than guessed. Blank lines are skipped; every data row keeps
 * its 1-based line number for per-row error reporting.
 */

export interface CsvTable {
  rows: Array<{ line: number; cells: string[] }>;
  errors: Array<{ line: number; message: string }>;
}

export function splitCsvLine(line: string): string[] {
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

/**
 * Parse a CSV document against an exact lowercase header. Returns data
 * rows (trimmed cells) plus structural errors; cell-level validation
 * stays with each dataset's own validator.
 */
export function parseCsvTable(
  text: string,
  expectedHeader: string[],
): CsvTable {
  const errors: CsvTable["errors"] = [];
  const rows: CsvTable["rows"] = [];
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
        header.length === expectedHeader.length &&
        expectedHeader.every((h, i) => header[i] === h);
      if (!ok) {
        errors.push({
          line: lineNo,
          message: `Header must be: ${expectedHeader.join(",")}`,
        });
      }
      return;
    }
    if (cells.length !== expectedHeader.length) {
      errors.push({
        line: lineNo,
        message: `Expected ${expectedHeader.length} columns, got ${cells.length}.`,
      });
      return;
    }
    rows.push({ line: lineNo, cells: cells.map((c) => c.trim()) });
  });

  if (!headerSeen) {
    return { rows: [], errors: [{ line: 0, message: "Empty file: header row required." }] };
  }
  return { rows, errors };
}

/** CSV-escape one cell (quotes, commas, newlines). */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export-safe cell: escapeCsvCell PLUS spreadsheet formula-injection
 * neutralization. Cells starting with =, +, - or @ execute as formulas
 * when a CSV is opened in Excel/Sheets — and our data legitimately
 * starts that way (phone numbers like +9198…, names like "-"). Prefix
 * such cells with a single quote (Excel's text marker: displayed value
 * is unchanged). Use ONLY for generated downloads, never for import
 * round-trips (the quote would corrupt re-imported values).
 */
export function escapeCsvExportCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return escapeCsvCell(guarded);
}

/** Join header + rows into a CSV document (LF endings). */
export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

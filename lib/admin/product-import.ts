import { parseCsvTable } from "@/lib/admin/csv";

/**
 * Product CSV parsing (pure, unit-tested).
 *
 * Columns (exact header):
 *   name,slug,description,category,price,stock,threshold,active,gst,weight
 * Only name, slug and price are required; everything else falls back
 * to the same defaults as the admin form (stock 0, threshold 5,
 * active true, blank gst/weight). images and specifications are NOT
 * importable — they stay form-managed (documented, not silent: the
 * sample CSV and UI say so).
 *
 * Matching is deterministic on slug (the schema's stable unique
 * handle — there is no SKU column, and none is invented here):
 * existing slugs update in place, new slugs insert. Slugs are
 * normalized exactly like the product form before matching.
 *
 * Nothing is written here — callers validate every row first and
 * report per-row errors without committing anything.
 */

export const PRODUCT_CSV_HEADER = [
  "name",
  "slug",
  "description",
  "category",
  "price",
  "stock",
  "threshold",
  "active",
  "gst",
  "weight",
];

export interface CsvProductRow {
  line: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  priceRupees: string;
  stock: string;
  threshold: string;
  active: string;
  gst: string;
  weight: string;
}

export interface CsvProductParseResult {
  rows: CsvProductRow[];
  errors: Array<{ line: number; message: string }>;
}

const ACTIVE_RE = /^(true|false)$/i;

export function parseProductCsv(text: string): CsvProductParseResult {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: CsvProductRow[] = [];
  const table = parseCsvTable(text, PRODUCT_CSV_HEADER);
  errors.push(...table.errors);
  for (const row of table.rows) {
    const [
      name, slug, description, category, priceRupees,
      stock, threshold, active, gst, weight,
    ] = row.cells;
    if ((name ?? "") === "") {
      errors.push({ line: row.line, message: "name is required." });
      continue;
    }
    if ((slug ?? "") === "") {
      errors.push({ line: row.line, message: "slug is required." });
      continue;
    }
    if ((priceRupees ?? "") === "") {
      errors.push({ line: row.line, message: "price is required." });
      continue;
    }
    const act = (active ?? "").toLowerCase();
    if (act !== "" && !ACTIVE_RE.test(act)) {
      errors.push({ line: row.line, message: "active must be true, false or blank." });
      continue;
    }
    rows.push({
      line: row.line,
      name: name ?? "",
      slug: slug ?? "",
      description: description ?? "",
      category: category ?? "",
      priceRupees: priceRupees ?? "",
      stock: stock ?? "",
      threshold: threshold ?? "",
      // Normalized to "" | "true" | "false" for the boolean step below.
      active: act,
      gst: gst ?? "",
      weight: weight ?? "",
    });
  }
  return { rows, errors };
}

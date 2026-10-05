/**
 * pdf-parse ships types for its root entry only, but the root self-tests
 * when `module.parent` is unset (vitest interop) — so tests import the
 * inner parser directly. Same function, same result shape.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  import type PdfParse from "pdf-parse";

  const parse: typeof PdfParse;
  export default parse;
}

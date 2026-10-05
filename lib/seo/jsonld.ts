/**
 * JSON-LD script serialization (pure).
 *
 * JSON.stringify does not escape "<": a value containing "</script>"
 * (reachable via admin-entered product names/descriptions, including
 * bulk CSV imports) would break out of the <script> block into
 * executable markup — stored XSS served to every visitor. Encoding
 * every "<" as \u003c is valid JSON and inert in HTML.
 */
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

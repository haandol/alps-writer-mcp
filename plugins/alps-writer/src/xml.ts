// Regex-based XML helpers shared by the document and template layers.
//
// This project deliberately parses its own XML rather than taking an XML parser
// dependency (AGENTS.md "Do-Not Rules"), so the small pieces of that parsing are
// collected here instead of being reimplemented per consumer. `attribute()`
// existed as two byte-identical private methods — one in DocumentService, one in
// TemplateRegistry — reading the same `<subsection id="…" title="…">` markup.

/** Decode the five XML predefined entities. `&amp;` must be last: decoding it
 * first would turn `&amp;lt;` into `<` instead of the literal `&lt;`. */
export function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/** Escape for use inside a double-quoted attribute value. `&` must be first so
 * the ampersands introduced by later replacements are not re-escaped. */
export function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape for element text content — quotes may stay literal there. */
export function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Read one double-quoted attribute out of a captured tag's attribute string,
 * decoded. Returns null when absent.
 *
 * Always decoding is the point: an attribute's VALUE is its decoded text, and
 * both callers compare that value against plain text. The template registry read
 * raw markup before this was shared, so a template title written with legal
 * markup (`title="Risks &amp; Limits"`) made `validateSubsection` demand the
 * entity form — it rejected the `Risks & Limits` an author actually writes and
 * told them, verbatim, that the title "must be Risks &amp; Limits".
 */
export function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATES_DIR = path.join(__dirname, "templates");
export const CHAPTERS_DIR = path.join(TEMPLATES_DIR, "chapters");
export const GUIDES_DIR = path.join(__dirname, "guides");

export const SECTION_TITLES: Record<number, string> = {
  1: "Overview",
  2: "MVP Goals and Key Metrics",
  3: "Demo Scenario",
  4: "High-Level Architecture",
  5: "Design Specification",
  6: "Requirements Summary",
  7: "Feature-Level Specification",
  8: "MVP Metrics",
  9: "Out of Scope",
};

export const SECTION_REFERENCES: Record<number, number[]> = {
  3: [2],
  5: [6],
  7: [3, 6],
  8: [2, 6],
};

// The section numbers, derived from SECTION_TITLES rather than written as a
// literal 1..9 range. The count was hardcoded in six places (two document loops,
// four Zod schemas, and the "Section number (1-9)" descriptions), so adding a
// tenth section meant finding all of them — and a missed one fails silently:
// a Zod .max(9) rejects the new section while the export loop skips it.
export const SECTION_NUMBERS: number[] = Object.keys(SECTION_TITLES)
  .map((key) => Number.parseInt(key, 10))
  .sort((a, b) => a - b);

export const FIRST_SECTION = SECTION_NUMBERS[0];
export const LAST_SECTION = SECTION_NUMBERS[SECTION_NUMBERS.length - 1];

// Shown in every section-argument description, so the range a tool advertises to
// the model always matches the range it accepts.
export const SECTION_RANGE = `${FIRST_SECTION}-${LAST_SECTION}`;

// The placeholder a section carries until it is first written. It is both what
// buildDocument emits and what the status/export/read paths test for, so the
// literal must not be spelled out at each site.
export const NOT_STARTED = "<!-- Not started -->";

import {
  ALPS_PROFILE,
  LEGACY_LITE_ALPS_PROFILE,
  LITE_ALPS_PROFILE,
  sectionNumbers,
  sectionRange,
} from "./profiles.js";

export const TEMPLATES_DIR = ALPS_PROFILE.templatesDir;
export const CHAPTERS_DIR = ALPS_PROFILE.chaptersDir;
export const GUIDES_DIR = ALPS_PROFILE.guidesDir;
export const LITE_TEMPLATES_DIR = LITE_ALPS_PROFILE.templatesDir;
export const LITE_CHAPTERS_DIR = LITE_ALPS_PROFILE.chaptersDir;
export const LITE_GUIDES_DIR = LITE_ALPS_PROFILE.guidesDir;
export const LEGACY_LITE_TEMPLATES_DIR = LEGACY_LITE_ALPS_PROFILE.templatesDir;
export const LEGACY_LITE_CHAPTERS_DIR = LEGACY_LITE_ALPS_PROFILE.chaptersDir;
export const LEGACY_LITE_GUIDES_DIR = LEGACY_LITE_ALPS_PROFILE.guidesDir;

export const SECTION_TITLES: Record<number, string> = { ...ALPS_PROFILE.sectionTitles };
export const SECTION_REFERENCES: Record<number, number[]> = Object.fromEntries(
  Object.entries(ALPS_PROFILE.sectionReferences).map(([section, refs]) => [section, [...refs]]),
);

export const LITE_SECTION_TITLES: Record<number, string> = {
  ...LITE_ALPS_PROFILE.sectionTitles,
};
export const LITE_SECTION_REFERENCES: Record<number, number[]> = Object.fromEntries(
  Object.entries(LITE_ALPS_PROFILE.sectionReferences).map(([section, refs]) => [
    section,
    [...refs],
  ]),
);
export const LEGACY_LITE_SECTION_TITLES: Record<number, string> = {
  ...LEGACY_LITE_ALPS_PROFILE.sectionTitles,
};

// The section numbers, derived from SECTION_TITLES rather than written as a
// literal 1..9 range. The count was hardcoded in six places (two document loops,
// four Zod schemas, and the "Section number (1-9)" descriptions), so adding a
// tenth section meant finding all of them — and a missed one fails silently:
// a Zod .max(9) rejects the new section while the export loop skips it.
export const SECTION_NUMBERS = sectionNumbers(ALPS_PROFILE);

export const FIRST_SECTION = SECTION_NUMBERS[0];
export const LAST_SECTION = SECTION_NUMBERS[SECTION_NUMBERS.length - 1];

// Shown in every section-argument description, so the range a tool advertises to
// the model always matches the range it accepts.
export const SECTION_RANGE = sectionRange(ALPS_PROFILE);

export const LITE_SECTION_NUMBERS = sectionNumbers(LITE_ALPS_PROFILE);
export const LITE_FIRST_SECTION = LITE_SECTION_NUMBERS[0];
export const LITE_LAST_SECTION = LITE_SECTION_NUMBERS[LITE_SECTION_NUMBERS.length - 1];
export const LITE_SECTION_RANGE = sectionRange(LITE_ALPS_PROFILE);
export const LEGACY_LITE_SECTION_NUMBERS = sectionNumbers(LEGACY_LITE_ALPS_PROFILE);
export const LEGACY_LITE_FIRST_SECTION = LEGACY_LITE_SECTION_NUMBERS[0];
export const LEGACY_LITE_LAST_SECTION =
  LEGACY_LITE_SECTION_NUMBERS[LEGACY_LITE_SECTION_NUMBERS.length - 1];
export const LEGACY_LITE_SECTION_RANGE = sectionRange(LEGACY_LITE_ALPS_PROFILE);

// The placeholder a section carries until it is first written. It is both what
// buildDocument emits and what the status/export/read paths test for, so the
// literal must not be spelled out at each site.
export const NOT_STARTED = "<!-- Not started -->";

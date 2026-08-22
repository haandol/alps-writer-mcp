import fs from "fs";
import path from "path";
import { CHAPTERS_DIR } from "../../constants.js";
import { attribute } from "../../xml.js";

export interface SubsectionDefinition {
  id: string;
  title: string;
  required: boolean;
}

export type SubsectionValidation = { ok: true; fullId: string } | { ok: false; message: string };

export class TemplateRegistry {
  private readonly definitions = new Map<number, Map<string, SubsectionDefinition>>();

  constructor(
    chaptersDir = CHAPTERS_DIR,
    private readonly dynamicSection: number | null = 7,
  ) {
    for (const filename of fs.readdirSync(chaptersDir).filter((name) => name.endsWith(".xml"))) {
      const section = Number.parseInt(filename.split("-")[0], 10);
      if (!Number.isInteger(section)) continue;

      const xml = fs.readFileSync(path.join(chaptersDir, filename), "utf8");
      const subsections = new Map<string, SubsectionDefinition>();
      const subsectionRe = /<subsection\b([^>]*)>/g;
      let match: RegExpExecArray | null;
      while ((match = subsectionRe.exec(xml)) !== null) {
        const id = attribute(match[1], "id");
        const title = attribute(match[1], "title");
        const required = attribute(match[1], "required") !== "false";
        if (id && title) subsections.set(id, { id, title, required });
      }
      this.definitions.set(section, subsections);
    }
  }

  expectedSubsections(section: number): SubsectionDefinition[] {
    if (section === this.dynamicSection) return [];
    return [...(this.definitions.get(section)?.values() ?? [])];
  }

  validateSubsection(section: number, subsectionId: string, title: string): SubsectionValidation {
    const normalizedId = subsectionId.trim();
    const normalizedTitle = title.trim();

    // A dynamic section stores one complete feature per section.x entry. The
    // nested template describes the content inside that feature entry.
    if (section === this.dynamicSection) {
      if (!/^[1-9]\d*$/.test(normalizedId)) {
        return {
          ok: false,
          message: `Section ${section} subsection_id must be a positive feature number such as "1" or "2".`,
        };
      }
      if (!normalizedTitle) {
        return { ok: false, message: `Section ${section} feature title must not be empty.` };
      }
      return { ok: true, fullId: `${section}.${normalizedId}` };
    }

    const fullId = `${section}.${normalizedId}`;
    const expected = this.definitions.get(section)?.get(fullId);
    if (!expected) {
      const allowed = this.expectedSubsections(section)
        .map((definition) => definition.id.slice(String(section).length + 1))
        .join(", ");
      return {
        ok: false,
        message: `Unknown subsection ${fullId}. Allowed subsection_id values: ${allowed || "none"}.`,
      };
    }
    if (normalizedTitle !== expected.title) {
      return {
        ok: false,
        message: `Title for ${fullId} must be "${expected.title}".`,
      };
    }
    return { ok: true, fullId };
  }
}

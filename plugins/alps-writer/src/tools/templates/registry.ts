import fs from "fs";
import path from "path";
import { CHAPTERS_DIR } from "../../constants.js";
import { attribute } from "../../xml.js";

export interface SubsectionDefinition {
  id: string;
  title: string;
}

export type SubsectionValidation = { ok: true; fullId: string } | { ok: false; message: string };

export class TemplateRegistry {
  private readonly definitions = new Map<number, Map<string, SubsectionDefinition>>();

  constructor(chaptersDir = CHAPTERS_DIR) {
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
        if (id && title) subsections.set(id, { id, title });
      }
      this.definitions.set(section, subsections);
    }
  }

  expectedSubsections(section: number): SubsectionDefinition[] {
    if (section === 7) return [];
    return [...(this.definitions.get(section)?.values() ?? [])];
  }

  validateSubsection(section: number, subsectionId: string, title: string): SubsectionValidation {
    const normalizedId = subsectionId.trim();
    const normalizedTitle = title.trim();

    // Section 7 stores one complete feature per 7.x entry. Its nested 7.x.1-7
    // template describes the content inside that dynamic feature entry.
    if (section === 7) {
      if (!/^[1-9]\d*$/.test(normalizedId)) {
        return {
          ok: false,
          message: 'Section 7 subsection_id must be a positive feature number such as "1" or "2".',
        };
      }
      if (!normalizedTitle) {
        return { ok: false, message: "Section 7 feature title must not be empty." };
      }
      return { ok: true, fullId: `7.${normalizedId}` };
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

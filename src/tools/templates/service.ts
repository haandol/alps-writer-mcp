import fs from "fs";
import path from "path";
import {
  TEMPLATES_DIR,
  CHAPTERS_DIR,
  GUIDES_DIR,
  SECTION_TITLES,
  SECTION_REFERENCES,
} from "../../constants.js";

export class TemplateService {
  private xmlToMarkdown(content: string, includeExamples: boolean): string {
    const lines: string[] = [];
    this.renderXml(content, lines, 2, includeExamples);
    return lines.join("\n").trim();
  }

  private renderXml(
    xml: string,
    lines: string[],
    level: number,
    includeExamples: boolean
  ): void {
    // Match top-level tags iteratively
    const tagRe =
      /<(section|subsection|template|description|example|header)(\s[^>]*)?>([^]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(xml)) !== null) {
      const [, tag, attrs, inner] = match;
      if (tag === "example") {
        if (includeExamples) lines.push(`\n**Example:**\n${inner.trim()}\n`);
        continue;
      }
      if (tag === "description") {
        lines.push(`\n${inner.trim()}\n`);
        continue;
      }
      if (tag === "header") {
        lines.push(`\n> ${inner.trim()}\n`);
        continue;
      }
      // section / subsection / template
      const titleMatch = attrs?.match(/title="([^"]*)"/);
      const idMatch = attrs?.match(/id="([^"]*)"/);
      const title = titleMatch?.[1] ?? "";
      const id = idMatch?.[1] ?? "";
      if (title) {
        lines.push(
          id
            ? `${"#".repeat(level)} ${id} ${title}\n`
            : `${"#".repeat(level)} ${title}\n`
        );
      }
      this.renderXml(inner, lines, level + 1, includeExamples);
    }
  }

  getOverview(): string {
    return fs.readFileSync(path.join(TEMPLATES_DIR, "overview.md"), "utf-8");
  }

  listSections(): { section: number; filename: string }[] {
    return fs
      .readdirSync(CHAPTERS_DIR)
      .filter((f) => f.endsWith(".xml"))
      .sort()
      .map((f) => ({
        section: parseInt(f.split("-")[0], 10),
        filename: f,
      }));
  }

  getSection(section: number, includeExamples = true): string {
    const prefix = String(section).padStart(2, "0") + "-";
    const file = fs
      .readdirSync(CHAPTERS_DIR)
      .find((f) => f.startsWith(prefix) && f.endsWith(".xml"));
    if (!file) return `Section ${section} not found.`;
    return this.xmlToMarkdown(
      fs.readFileSync(path.join(CHAPTERS_DIR, file), "utf-8"),
      includeExamples
    );
  }

  getFullTemplate(includeExamples = true): string {
    const parts = [this.getOverview(), "\n---\n"];
    for (const f of fs.readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".xml")).sort()) {
      parts.push(
        this.xmlToMarkdown(fs.readFileSync(path.join(CHAPTERS_DIR, f), "utf-8"), includeExamples)
      );
      parts.push("\n---\n");
    }
    return parts.join("\n");
  }

  getSectionGuide(section: number): string {
    const guidePath = path.join(GUIDES_DIR, `${String(section).padStart(2, "0")}.md`);
    if (!fs.existsSync(guidePath)) return `Section ${section} not found.`;

    const guide = fs.readFileSync(guidePath, "utf-8");
    const refs = SECTION_REFERENCES[section];
    if (refs) {
      const refNames = refs.map((r) => `Section ${r} (${SECTION_TITLES[r]})`);
      return `⚠️ REQUIRED: This section depends on ${refNames.join(", ")}.
Before proceeding, you MUST:
1. Call read_prd_section(${refs[0]}) to review referenced content
2. Summarize key points from referenced section(s) in your response
3. If referenced sections are incomplete, warn the user first

${guide}`;
    }
    return guide;
  }
}

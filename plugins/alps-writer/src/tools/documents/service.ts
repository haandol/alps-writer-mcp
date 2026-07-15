import fs from "fs";
import path from "path";
import os from "os";
import { SECTION_TITLES } from "../../constants.js";
import { TemplateRegistry } from "../templates/registry.js";

export class DocumentService {
  private workingDoc: string | null = null;
  private readonly templates: TemplateRegistry;

  constructor(templates = new TemplateRegistry()) {
    this.templates = templates;
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }

  private escapeXmlAttribute(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private escapeXmlText(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private attribute(attributes: string, name: string): string | null {
    const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
    return match ? this.decodeXml(match[1]) : null;
  }

  private parseSections(content: string): Map<number, string> {
    const sections = new Map<number, string>();
    const re = /<section\b([^>]*)>\s*([\s\S]*?)<\/section>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const id = this.attribute(m[1], "id");
      if (id && /^\d+$/.test(id)) sections.set(Number.parseInt(id, 10), m[2].trim());
    }
    return sections;
  }

  private parseSubsections(
    sectionContent: string,
    sectionId: number,
  ): Map<string, { title: string; content: string }> {
    const subs = new Map<string, { title: string; content: string }>();
    const re = /<subsection\b([^>]*)>\s*([\s\S]*?)\s*<\/subsection>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sectionContent)) !== null) {
      const id = this.attribute(m[1], "id");
      const title = this.attribute(m[1], "title");
      if (!id || title == null || !id.startsWith(`${sectionId}.`)) continue;
      subs.set(id, { title, content: this.decodeXml(m[2].trim()) });
    }
    return subs;
  }

  private hasUnparsedContent(sectionContent: string): boolean {
    const remainder = sectionContent
      .replace(/<subsection\b[^>]*>\s*[\s\S]*?\s*<\/subsection>/g, "")
      .replace(/<!--\s*Not started\s*-->/g, "")
      .trim();
    return remainder.length > 0;
  }

  private buildSubsection(subId: string, title: string, content: string): string {
    return `<subsection id="${this.escapeXmlAttribute(subId)}" title="${this.escapeXmlAttribute(title)}">\n${this.escapeXmlText(content)}\n</subsection>`;
  }

  private buildSection(sectionId: number, content: string): string {
    return `<section id="${sectionId}" title="${this.escapeXmlAttribute(SECTION_TITLES[sectionId])}">\n${content}\n</section>`;
  }

  private buildDocument(projectName: string, sections: Map<number, string>): string {
    const lines = [`<alps-document project="${this.escapeXmlAttribute(projectName)}">`];
    for (let i = 1; i <= 9; i++) {
      lines.push(this.buildSection(i, sections.get(i) || "<!-- Not started -->"));
    }
    lines.push("</alps-document>");
    return lines.join("\n\n");
  }

  private extractProjectName(content: string): string {
    const root = content.match(/<(?:alps-document|prd-document)\b([^>]*)>/);
    if (root) {
      const project = this.attribute(root[1], "project");
      if (project) return project;
    }
    const m = content.match(/^# (.+?) (?:ALPS|PRD)/m);
    return m ? m[1] : "Untitled";
  }

  private validateDocument(content: string): string | null {
    const root = content.match(/^\s*<(alps-document|prd-document)\b[^>]*>/);
    if (!root) return "Missing <alps-document> root element.";
    if (!new RegExp(`</${root[1]}>\\s*$`).test(content)) {
      return `Missing closing </${root[1]}> element.`;
    }
    if (this.parseSections(content).size === 0) return "Document contains no valid sections.";
    return null;
  }

  private readWorkingDocument(): { content: string } | { error: string } {
    if (!this.workingDoc) {
      return {
        error: "No document loaded. Call init_alps_document() or load_alps_document() first.",
      };
    }
    let content: string;
    try {
      content = fs.readFileSync(this.workingDoc, "utf-8");
    } catch (error) {
      return { error: `Unable to read ${this.workingDoc}: ${(error as Error).message}` };
    }
    const validationError = this.validateDocument(content);
    return validationError
      ? { error: `Invalid ALPS document at ${this.workingDoc}: ${validationError}` }
      : { content };
  }

  private writeAtomic(filepath: string, content: string): void {
    const temporary = `${filepath}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.writeFileSync(temporary, content, "utf-8");
      fs.renameSync(temporary, filepath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  private expandHome(p: string): string {
    return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
  }

  private get outputDir(): string {
    // Expand a leading ~ here too: env vars are passed verbatim by MCP clients
    // (no shell expansion), so a documented value like "~/Documents/alps" must
    // be resolved against $HOME rather than used as a literal "~" path segment
    // when it serves as the base dir for a relative output path.
    const dir =
      process.env.ALPS_OUTPUT_DIR || process.env.PRD_OUTPUT_DIR || path.join(process.cwd(), "prd");
    return this.expandHome(dir);
  }

  private expandPath(p: string): string {
    if (p.startsWith("~")) return this.expandHome(p);
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.outputDir, p);
  }

  initDocument(projectName: string, outputPath: string): string {
    this.workingDoc = null;
    let filepath = this.expandPath(outputPath);
    if (!path.extname(filepath)) filepath += ".alps.xml";
    if (!filepath.toLowerCase().endsWith(".alps.xml")) {
      return `Invalid document path: ${filepath}. ALPS documents must use the .alps.xml extension.`;
    }

    if (fs.existsSync(filepath)) {
      return `Document already exists at ${filepath}. Use load_alps_document() to resume.`;
    }

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    try {
      fs.writeFileSync(filepath, this.buildDocument(projectName, new Map()), {
        encoding: "utf-8",
        flag: "wx",
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return `Document already exists at ${filepath}. Use load_alps_document() to resume.`;
      }
      throw error;
    }
    this.workingDoc = filepath;
    return `Created ALPS document at ${filepath}`;
  }

  loadDocument(docPath: string): string {
    this.workingDoc = null;
    const filepath = this.expandPath(docPath);
    if (!filepath.toLowerCase().endsWith(".alps.xml")) {
      return `Invalid document path: ${filepath}. ALPS documents must use the .alps.xml extension.`;
    }
    if (!fs.existsSync(filepath)) return `Document not found at ${filepath}`;
    let content: string;
    try {
      content = fs.readFileSync(filepath, "utf-8");
    } catch (error) {
      return `Unable to read ${filepath}: ${(error as Error).message}`;
    }
    const validationError = this.validateDocument(content);
    if (validationError) return `Invalid ALPS document at ${filepath}: ${validationError}`;
    this.workingDoc = filepath;
    return `${this.getStatus()}

---
⚠️ CONVERSATION MODE REQUIRED:
1. Call get_alps_section_guide(N) before working on any section
2. Ask 1-2 focused questions at a time - DO NOT auto-generate content
3. Wait for user response before proceeding
4. Get explicit "yes" confirmation before calling save_alps_section()
NEVER auto-fill sections without user Q&A, even if content already exists.`;
  }

  saveSection(section: number, subsectionId: string, title: string, content: string): string {
    if (!(section in SECTION_TITLES)) {
      return `Invalid section number: ${section}. Must be 1-9.`;
    }
    const subsection = this.templates.validateSubsection(section, subsectionId, title);
    if (!subsection.ok) return `Invalid subsection: ${subsection.message}`;

    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    const docContent = document.content;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const sectionContent = sections.get(section) || "";
    if (this.hasUnparsedContent(sectionContent)) {
      return `Cannot safely update Section ${section}: it contains unrecognized content. Export or migrate it before saving a subsection.`;
    }
    const subId = subsection.fullId;
    const existing = this.parseSubsections(sectionContent, section);
    existing.set(subId, { title, content });

    const parts = [...existing.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([k, v]) => this.buildSubsection(k, v.title, v.content));
    sections.set(section, parts.join("\n"));

    this.writeAtomic(this.workingDoc!, this.buildDocument(projectName, sections));
    return `✅ Saved ${subId}. ${title}

---
### ${subId}. ${title}

${content}
---`;
  }

  readSection(section: number, subsectionId?: string): string {
    if (!(section in SECTION_TITLES)) return `Section ${section} not found.`;

    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    const sections = this.parseSections(document.content);
    const content = sections.get(section) || "";

    if (subsectionId != null) {
      const subId = `${section}.${subsectionId}`;
      const subs = this.parseSubsections(content, section);
      const sub = subs.get(subId);
      if (sub) return `### ${subId}. ${sub.title}\n\n${sub.content}`;
      return `Subsection ${subId} not found.`;
    }

    const display =
      !content || content.includes("<!-- Not started -->")
        ? "*Not yet written*"
        : this.contentToMarkdown(content, section);
    return `## Section ${section}. ${SECTION_TITLES[section]}\n\n${display}`;
  }

  getStatus(): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    const docContent = document.content;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const lines = [`ALPS Document: ${projectName}`, `Location: ${this.workingDoc}`, ""];
    for (const [num, title] of Object.entries(SECTION_TITLES)) {
      const section = Number.parseInt(num, 10);
      const content = sections.get(section) || "";
      const subsections = this.parseSubsections(content, section);
      let status: string;
      if (subsections.size === 0 && (!content || content.includes("<!-- Not started -->"))) {
        status = "⬜ Not started";
      } else if (section === 7) {
        const expectedFeatures = this.countFeatureIds(sections.get(6) || "");
        if (expectedFeatures > 0 && subsections.size >= expectedFeatures) {
          status = `✅ Written (${subsections.size}/${expectedFeatures} features)`;
        } else if (expectedFeatures > 0) {
          status = `🟡 In progress (${subsections.size}/${expectedFeatures} features)`;
        } else {
          status = `🟡 In progress (${subsections.size} dynamic feature${subsections.size === 1 ? "" : "s"} saved)`;
        }
      } else {
        const expected = this.templates.expectedSubsections(section);
        const written = expected.filter((definition) => subsections.has(definition.id)).length;
        status =
          expected.length > 0 && written === expected.length
            ? `✅ Written (${written}/${expected.length} subsections)`
            : `🟡 In progress (${written}/${expected.length} subsections)`;
      }
      lines.push(`Section ${num} (${title}): ${status}`);
    }
    return lines.join("\n");
  }

  private countFeatureIds(sectionSixContent: string): number {
    const subsection = this.parseSubsections(sectionSixContent, 6).get("6.1");
    if (!subsection) return 0;
    const ids = subsection.content.match(/\bF(?:\d+|(?:-[A-Z0-9]+)+)\b/gi) ?? [];
    return new Set(ids.map((id) => id.toUpperCase())).size;
  }

  private contentToMarkdown(content: string, section: number): string {
    const subs = this.parseSubsections(content, section);
    if (subs.size === 0) return content;
    return [...subs.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([id, data]) => `### ${id}. ${data.title}\n\n${data.content}`)
      .join("\n\n");
  }

  exportMarkdown(outputPath?: string): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    const docContent = document.content;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const lines = [`# ${projectName} ALPS\n`];
    for (let i = 1; i <= 9; i++) {
      const content = sections.get(i) || "";
      const md =
        !content || content.includes("<!-- Not started -->")
          ? "*Not yet written*"
          : this.contentToMarkdown(content, i);
      lines.push(`## Section ${i}. ${SECTION_TITLES[i]}\n\n${md}\n\n---\n`);
    }

    const result = lines.join("\n");
    if (outputPath) {
      const out = this.expandPath(outputPath);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      this.writeAtomic(out, result);
      return `Exported to ${out}`;
    }
    return result;
  }
}

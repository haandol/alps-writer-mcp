import fs from "fs";
import path from "path";
import os from "os";
import { NOT_STARTED, SECTION_NUMBERS, SECTION_RANGE, SECTION_TITLES } from "../../constants.js";
import { attribute, decodeXml, escapeXmlAttribute, escapeXmlText } from "../../xml.js";
import { TemplateRegistry } from "../templates/registry.js";

// Subsection IDs sort by their numeric components ("7.10" after "7.9"), not
// lexically. Used wherever subsections are rendered in order.
const bySubsectionId = ([a]: [string, unknown], [b]: [string, unknown]) =>
  a.localeCompare(b, undefined, { numeric: true });

const ALLOWED_ARCHITECTURE_DIAGRAMS = new Set(["C4Context", "C4Container"]);

function architectureDiagramError(content: string): string | null {
  const diagramTypes = [...content.matchAll(/```mermaid\s*\r?\n([\s\S]*?)```/g)]
    .map(
      (match) =>
        match[1]
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("%%"))
          ?.split(/\s+/)[0],
    )
    .filter((type): type is string => Boolean(type));

  for (const required of ALLOWED_ARCHITECTURE_DIAGRAMS) {
    if (!diagramTypes.includes(required)) {
      return `Section 4.1 requires a Mermaid ${required} diagram.`;
    }
  }

  const disallowed = diagramTypes.find((type) => !ALLOWED_ARCHITECTURE_DIAGRAMS.has(type));
  if (disallowed) {
    return `Section 4.1 allows only Mermaid C4Context and C4Container diagrams; found ${disallowed}.`;
  }

  return null;
}

export class DocumentService {
  private workingDoc: string | null = null;
  private readonly templates: TemplateRegistry;

  constructor(templates = new TemplateRegistry()) {
    this.templates = templates;
  }

  private attribute(attributes: string, name: string): string | null {
    return attribute(attributes, name);
  }

  // A section is unwritten when it holds nothing but the placeholder.
  private isNotStarted(sectionContent: string): boolean {
    return !sectionContent || sectionContent.includes(NOT_STARTED);
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
      subs.set(id, { title, content: decodeXml(m[2].trim()) });
    }
    return subs;
  }

  private hasUnparsedContent(sectionContent: string): boolean {
    const remainder = sectionContent
      .replace(/<subsection\b[^>]*>\s*[\s\S]*?\s*<\/subsection>/g, "")
      // Whitespace-tolerant on purpose: this strips the NOT_STARTED placeholder
      // from a file that may have been reformatted by hand, where isNotStarted's
      // exact-substring test would not match.
      .replace(/<!--\s*Not started\s*-->/g, "")
      .trim();
    return remainder.length > 0;
  }

  private buildSubsection(subId: string, title: string, content: string): string {
    return `<subsection id="${escapeXmlAttribute(subId)}" title="${escapeXmlAttribute(title)}">\n${escapeXmlText(content)}\n</subsection>`;
  }

  private buildSection(sectionId: number, content: string): string {
    return `<section id="${sectionId}" title="${escapeXmlAttribute(SECTION_TITLES[sectionId])}">\n${content}\n</section>`;
  }

  private buildDocument(projectName: string, sections: Map<number, string>): string {
    const lines = [`<alps-document project="${escapeXmlAttribute(projectName)}">`];
    for (const i of SECTION_NUMBERS) {
      lines.push(this.buildSection(i, sections.get(i) || NOT_STARTED));
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
      return `Invalid section number: ${section}. Must be ${SECTION_RANGE}.`;
    }
    const subsection = this.templates.validateSubsection(section, subsectionId, title);
    if (!subsection.ok) return `Invalid subsection: ${subsection.message}`;

    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    if (subsection.fullId === "4.1") {
      const diagramError = architectureDiagramError(content);
      if (diagramError) return `Invalid subsection content: ${diagramError}`;
    }
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
      .sort(bySubsectionId)
      .map(([k, v]) => this.buildSubsection(k, v.title, v.content));
    sections.set(section, parts.join("\n"));

    this.writeAtomic(this.workingDoc!, this.buildDocument(projectName, sections));
    return `Saved ${subId}. ${title}`;
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

    const display = this.isNotStarted(content)
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
      if (subsections.size === 0 && this.isNotStarted(content)) {
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
      .sort(bySubsectionId)
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
    for (const i of SECTION_NUMBERS) {
      const content = sections.get(i) || "";
      const md = this.isNotStarted(content)
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

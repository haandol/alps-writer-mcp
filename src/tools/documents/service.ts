import fs from "fs";
import path from "path";
import os from "os";
import { SECTION_TITLES } from "../../constants.js";

export class DocumentService {
  private workingDoc: string | null = null;

  private parseSections(content: string): Map<number, string> {
    const sections = new Map<number, string>();
    const re = /<section id="(\d+)" title="[^"]*">\s*([\s\S]*?)<\/section>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      sections.set(parseInt(m[1], 10), m[2].trim());
    }
    if (sections.size === 0) {
      const re2 = /<section id="(\d+)">\s*## Section \d+\.[^\n]*\n+([\s\S]*?)<\/section>/g;
      while ((m = re2.exec(content)) !== null) {
        sections.set(parseInt(m[1], 10), m[2].trim());
      }
    }
    return sections;
  }

  private parseSubsections(
    sectionContent: string,
    sectionId: number,
  ): Map<string, { title: string; content: string }> {
    const subs = new Map<string, { title: string; content: string }>();
    const re = new RegExp(
      `<subsection id="${sectionId}\\.([^"]+)" title="([^"]*)">\n([\\s\\S]*?)\n</subsection>`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(sectionContent)) !== null) {
      subs.set(`${sectionId}.${m[1]}`, { title: m[2], content: m[3].trim() });
    }
    return subs;
  }

  private buildSubsection(subId: string, title: string, content: string): string {
    return `<subsection id="${subId}" title="${title}">\n${content}\n</subsection>`;
  }

  private buildSection(sectionId: number, content: string): string {
    return `<section id="${sectionId}" title="${SECTION_TITLES[sectionId]}">\n${content}\n</section>`;
  }

  private buildDocument(projectName: string, sections: Map<number, string>): string {
    const lines = [`<prd-document project="${projectName}">`];
    for (let i = 1; i <= 9; i++) {
      lines.push(this.buildSection(i, sections.get(i) || "<!-- Not started -->"));
    }
    lines.push("</prd-document>");
    return lines.join("\n\n");
  }

  private extractProjectName(content: string): string {
    let m = content.match(/<prd-document project="([^"]+)">/);
    if (m) return m[1];
    // legacy alps format compat
    m = content.match(/<alps-document project="([^"]+)">/);
    if (m) return m[1];
    m = content.match(/^# (.+?) (?:PRD|ALPS)/m);
    return m ? m[1] : "Untitled";
  }

  private get outputDir(): string {
    return process.env.PRD_OUTPUT_DIR || process.cwd();
  }

  private expandPath(p: string): string {
    if (p.startsWith("~")) return path.join(os.homedir(), p.slice(1));
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.outputDir, p);
  }

  initDocument(projectName: string, outputPath: string): string {
    let filepath = this.expandPath(outputPath);
    if (!path.extname(filepath)) filepath += ".prd.xml";

    if (fs.existsSync(filepath)) {
      this.workingDoc = filepath;
      return `Document already exists at ${filepath}. Use load_prd_document() to resume.`;
    }

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, this.buildDocument(projectName, new Map()), "utf-8");
    this.workingDoc = filepath;
    return `Created PRD document at ${filepath}`;
  }

  loadDocument(docPath: string): string {
    const filepath = this.expandPath(docPath);
    if (!fs.existsSync(filepath)) return `Document not found at ${filepath}`;
    this.workingDoc = filepath;
    return `${this.getStatus()}

---
⚠️ CONVERSATION MODE REQUIRED:
1. Call get_prd_section_guide(N) before working on any section
2. Ask 1-2 focused questions at a time - DO NOT auto-generate content
3. Wait for user response before proceeding
4. Get explicit "yes" confirmation before calling save_prd_section()
NEVER auto-fill sections without user Q&A, even if content already exists.`;
  }

  saveSection(section: number, subsectionId: string, title: string, content: string): string {
    if (!this.workingDoc) {
      return "No document loaded. Call init_prd_document() or load_prd_document() first.";
    }
    if (!(section in SECTION_TITLES)) {
      return `Invalid section number: ${section}. Must be 1-9.`;
    }

    const docContent = fs.readFileSync(this.workingDoc, "utf-8");
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const subId = `${section}.${subsectionId}`;
    const existing = this.parseSubsections(sections.get(section) || "", section);
    existing.set(subId, { title, content });

    const parts = [...existing.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([k, v]) => this.buildSubsection(k, v.title, v.content));
    sections.set(section, parts.join("\n"));

    fs.writeFileSync(this.workingDoc, this.buildDocument(projectName, sections), "utf-8");
    return `✅ Saved ${subId}. ${title}

---
### ${subId}. ${title}

${content}
---`;
  }

  readSection(section: number, subsectionId?: string): string {
    if (!this.workingDoc) {
      return "No document loaded. Call init_prd_document() or load_prd_document() first.";
    }
    if (!(section in SECTION_TITLES)) return `Section ${section} not found.`;

    const sections = this.parseSections(fs.readFileSync(this.workingDoc, "utf-8"));
    const content = sections.get(section) || "";

    if (subsectionId != null) {
      const subId = `${section}.${subsectionId}`;
      const subs = this.parseSubsections(content, section);
      const sub = subs.get(subId);
      if (sub) return `## ${subId}. ${sub.title}\n\n${sub.content}`;
      return `Subsection ${subId} not found.`;
    }

    const display =
      !content || content.includes("<!-- Not started -->") ? "*Not yet written*" : content;
    return `## Section ${section}. ${SECTION_TITLES[section]}\n\n${display}`;
  }

  getStatus(): string {
    if (!this.workingDoc) {
      return "No document loaded. Call init_prd_document() or load_prd_document() first.";
    }

    const docContent = fs.readFileSync(this.workingDoc, "utf-8");
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const lines = [`PRD Document: ${projectName}`, `Location: ${this.workingDoc}`, ""];
    for (const [num, title] of Object.entries(SECTION_TITLES)) {
      const content = sections.get(parseInt(num, 10)) || "";
      let status: string;
      if (!content || content.includes("<!-- Not started -->")) {
        status = "⬜ Not started";
      } else if (content.trim().length > 50) {
        status = "✅ Written";
      } else {
        status = "🟡 In progress";
      }
      lines.push(`Section ${num} (${title}): ${status}`);
    }
    return lines.join("\n");
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
    if (!this.workingDoc) {
      return "No document loaded. Call init_prd_document() or load_prd_document() first.";
    }

    const docContent = fs.readFileSync(this.workingDoc, "utf-8");
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);

    const lines = [`# ${projectName} PRD\n`];
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
      fs.writeFileSync(out, result, "utf-8");
      return `Exported to ${out}`;
    }
    return result;
  }
}

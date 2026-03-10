import { TemplateService } from "./service.js";

export class TemplateController {
  constructor(private service: TemplateService) {}

  getPrdOverview(): string {
    return (
      this.service.getOverview() +
      `

---
## Next Step

**REQUIRED**: Call \`get_prd_section_guide(1)\` to begin interactive writing.
Do NOT write any section without going through the guide's Q&A process first.`
    );
  }

  listPrdSections(): { section: number; filename: string }[] {
    return this.service.listSections();
  }

  getPrdSection(section: number, includeExamples = false): string {
    return this.service.getSection(section, includeExamples);
  }

  getPrdFullTemplate(includeExamples = false): string {
    return this.service.getFullTemplate(includeExamples);
  }

  getPrdSectionGuide(section: number): string {
    return this.service.getSectionGuide(section);
  }
}

import { TemplateService } from "./service.js";

export class TemplateController {
  constructor(private service: TemplateService) {}

  getAlpsOverview(): string {
    return (
      this.service.getOverview() +
      `

---
## Next Step

**REQUIRED**: Call \`get_alps_section_guide(1)\` to begin interactive writing.
Do NOT write any section without going through the guide's Q&A process first.`
    );
  }

  listAlpsSections(): { section: number; filename: string }[] {
    return this.service.listSections();
  }

  getAlpsSection(section: number, includeExamples = false): string {
    return this.service.getSection(section, includeExamples);
  }

  getAlpsFullTemplate(includeExamples = false): string {
    return this.service.getFullTemplate(includeExamples);
  }

  getAlpsSectionGuide(section: number): string {
    return this.service.getSectionGuide(section);
  }
}

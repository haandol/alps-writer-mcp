import { DocumentService } from "./service.js";

export class DocumentController {
  constructor(private service: DocumentService) {}

  initAlpsDocument(projectName: string, outputPath: string): string {
    return this.service.initDocument(projectName, outputPath);
  }

  loadAlpsDocument(docPath: string): string {
    return this.service.loadDocument(docPath);
  }

  saveAlpsSection(section: number, subsectionId: string, title: string, content: string): string {
    return this.service.saveSection(section, subsectionId, title, content);
  }

  readAlpsSection(section: number, subsectionId?: string): string {
    return this.service.readSection(section, subsectionId);
  }

  getAlpsDocumentStatus(): string {
    return this.service.getStatus();
  }

  exportAlpsMarkdown(outputPath?: string): string {
    return this.service.exportMarkdown(outputPath);
  }
}

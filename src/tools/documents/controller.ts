import { DocumentService } from "./service.js";

export class DocumentController {
  constructor(private service: DocumentService) {}

  initPrdDocument(projectName: string, outputPath: string): string {
    return this.service.initDocument(projectName, outputPath);
  }

  loadPrdDocument(docPath: string): string {
    return this.service.loadDocument(docPath);
  }

  savePrdSection(section: number, subsectionId: string, title: string, content: string): string {
    return this.service.saveSection(section, subsectionId, title, content);
  }

  readPrdSection(section: number, subsectionId?: string): string {
    return this.service.readSection(section, subsectionId);
  }

  getPrdDocumentStatus(): string {
    return this.service.getStatus();
  }

  exportPrdMarkdown(outputPath?: string): string {
    return this.service.exportMarkdown(outputPath);
  }
}

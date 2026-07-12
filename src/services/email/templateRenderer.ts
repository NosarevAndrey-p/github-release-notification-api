import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import { ITemplateRenderer } from '../../types/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EjsTemplateRenderer implements ITemplateRenderer {
  private readonly templatesPath: string;

  constructor(templatesDirName = 'templates') {
    this.templatesPath = path.join(__dirname, '..', '..', templatesDirName);
  }

  async render(templateName: string, data: Record<string, unknown>): Promise<string> {
    const templateFile = path.join(this.templatesPath, `${templateName}.ejs`);
    return ejs.renderFile(templateFile, data);
  }
}

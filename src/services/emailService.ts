import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import ejs from 'ejs';
import { IEmailService } from '../types/emailService.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, '..', 'templates');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST as string,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER as string,
    pass: process.env.SMTP_PASS as string,
  },
});

const styles = {
  body: `font-family: Arial, sans-serif; background: #f6f8fa; padding: 20px; color: #24292f;`,
  container: `background: white; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; border: 1px solid #e1e4e8;`,
  repo: `display: inline-block; padding: 2px 8px; border-radius: 6px; background: #f1f1f1; border: 1px solid #d0d7de; font-family: monospace; font-size: 13px;`,
  btnBase: `display: inline-block; padding: 10px 16px; margin-top: 12px; border-radius: 6px; text-decoration: none; font-weight: bold;`,
  confirm: `background: #2da44e; color: white;`,
  unsubscribe: `background: #d73a49; color: white; margin-left: 8px;`,
  muted: `color: #57606a; font-size: 13px; margin-top: 12px;`,
};

async function renderTemplate(templateName: string, data: Record<string, unknown>): Promise<string> {
  const templateFile = path.join(templatesPath, `${templateName}.ejs`);
  return ejs.renderFile(templateFile, data);
}

class EmailServiceImpl implements IEmailService {
  constructor(private transporter: nodemailer.Transporter) {}

  async sendConfirmationEmail(email: string, repo: string, confirmToken: string, unsubscribeToken: string): Promise<void> {
    const confirmUrl = `${BASE_URL}/api/confirm/${confirmToken}`;
    const unsubscribeUrl = `${BASE_URL}/api/unsubscribe/${unsubscribeToken}`;

    const html = await renderTemplate('confirmation-email',
      { repo, confirmUrl, unsubscribeUrl, styles,});

    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `Confirm subscription to ${repo}`,
      html,
    });
  }

  async sendNotificationEmail(email: string, repo: string, newTag: string, unsubscribeToken: string): Promise<void> {
    const unsubscribeUrl = `${BASE_URL}/api/unsubscribe/${unsubscribeToken}`;
    const releaseUrl = `https://github.com/${repo}/releases/tag/${newTag}`;

    const html = await renderTemplate('notification-email', {
      repo, newTag, releaseUrl, unsubscribeUrl, styles, });

    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `New release ${newTag} for ${repo}`,
      html,
    });
  }
}

const emailService = new EmailServiceImpl(transporter);
export default emailService;
export { EmailServiceImpl as EmailService };

import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import ejs from 'ejs';
import { IEmailService, EmailDeps } from '../types/emailService.js';
import { emailStyles as styles } from '../constants/emailStyles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, '..', 'templates');

async function renderTemplate(templateName: string, data: Record<string, unknown>): Promise<string> {
  const templateFile = path.join(templatesPath, `${templateName}.ejs`);
  return ejs.renderFile(templateFile, data);
}

export async function sendConfirmationEmail(
  email: string,
  repo: string,
  confirmToken: string,
  unsubscribeToken: string,
  { transporter, baseUrl }: EmailDeps
): Promise<void> {
  const confirmUrl = `${baseUrl}/api/confirm/${confirmToken}`;
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;

  const html = await renderTemplate('confirmation-email', {
    repo,
    confirmUrl,
    unsubscribeUrl,
    styles,
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: `Confirm subscription to ${repo}`,
    html,
  });
}

export async function sendNotificationEmail(
  email: string,
  repo: string,
  newTag: string,
  unsubscribeToken: string,
  { transporter, baseUrl }: EmailDeps
): Promise<void> {
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;
  const releaseUrl = `https://github.com/${repo}/releases/tag/${newTag}`;

  const html = await renderTemplate('notification-email', {
    repo,
    newTag,
    releaseUrl,
    unsubscribeUrl,
    styles,
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: `New release ${newTag} for ${repo}`,
    html,
  });
}

// Configuration for the default instance
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST as string,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER as string,
    pass: process.env.SMTP_PASS as string,
  },
});

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const emailService: IEmailService = {
  sendConfirmationEmail: (email, repo, cToken, uToken) => 
    sendConfirmationEmail(email, repo, cToken, uToken, { transporter, baseUrl }),
  sendNotificationEmail: (email, repo, tag, uToken) => 
    sendNotificationEmail(email, repo, tag, uToken, { transporter, baseUrl }),
};

export default emailService;

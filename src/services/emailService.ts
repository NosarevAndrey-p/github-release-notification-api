import 'dotenv/config';
import { IEmailService, EmailDeps } from '../types/email.js';
import { emailStyles as styles } from '../constants/emailStyles.js';
import { EjsTemplateRenderer } from './templateRenderer.js';
import { NodemailerTransporter } from './emailTransporter.js';

export async function sendConfirmationEmail(
  email: string,
  repo: string,
  confirmToken: string,
  unsubscribeToken: string,
  { renderer, transporter, baseUrl }: EmailDeps
): Promise<void> {
  const confirmUrl = `${baseUrl}/api/confirm/${confirmToken}`;
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;

  const html = await renderer.render('confirmation-email', {
    repo,
    confirmUrl,
    unsubscribeUrl,
    styles,
  });

  await transporter.send(email, `Confirm subscription to ${repo}`, html);
}

export async function sendNotificationEmail(
  email: string,
  repo: string,
  newTag: string,
  unsubscribeToken: string,
  { renderer, transporter, baseUrl }: EmailDeps
): Promise<void> {
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;
  const releaseUrl = `https://github.com/${repo}/releases/tag/${newTag}`;

  const html = await renderer.render('notification-email', {
    repo,
    newTag,
    releaseUrl,
    unsubscribeUrl,
    styles,
  });

  await transporter.send(email, `New release ${newTag} for ${repo}`, html);
}

// Configuration for the default instance
const renderer = new EjsTemplateRenderer();
const transporter = new NodemailerTransporter();
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const emailService: IEmailService = {
  sendConfirmationEmail: (email, repo, cToken, uToken) => 
    sendConfirmationEmail(email, repo, cToken, uToken, { renderer, transporter, baseUrl }),
  sendNotificationEmail: (email, repo, tag, uToken) => 
    sendNotificationEmail(email, repo, tag, uToken, { renderer, transporter, baseUrl }),
};

export default emailService;

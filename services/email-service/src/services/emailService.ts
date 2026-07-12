import { IEmailService, EmailDeps, EmailMessagePayload } from '../types/email.js';
import { emailStyles as styles } from '../constants/emailStyles.js';
import { BadRequestError } from '../types/errors.js';

export class EmailService implements IEmailService {
  private renderer;
  private transporter;
  private baseUrl;

  constructor({ renderer, transporter, baseUrl }: EmailDeps) {
    this.renderer = renderer;
    this.transporter = transporter;
    this.baseUrl = baseUrl;
  }

  async sendConfirmationEmail(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<void> {
    const confirmUrl = `${this.baseUrl}/api/confirm/${confirmToken}`;
    const unsubscribeUrl = `${this.baseUrl}/api/unsubscribe/${unsubscribeToken}`;

    const html = await this.renderer.render('confirmation-email', {
      repo,
      confirmUrl,
      unsubscribeUrl,
      styles,
    });

    await this.transporter.send(email, `Confirm subscription to ${repo}`, html);
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void> {
    const unsubscribeUrl = `${this.baseUrl}/api/unsubscribe/${unsubscribeToken}`;
    const releaseUrl = `https://github.com/${repo}/releases/tag/${tagName}`;

    const html = await this.renderer.render('notification-email', {
      repo,
      newTag: tagName,
      releaseUrl,
      unsubscribeUrl,
      styles,
    });

    await this.transporter.send(email, `New release ${tagName} for ${repo}`, html);
  }

  async handleEmailMessage(payload: EmailMessagePayload): Promise<void> {
    if (payload.type === 'confirmation') {
      await this.sendConfirmationEmail(
        payload.to,
        payload.repo,
        payload.confirmToken || '',
        payload.unsubscribeToken || ''
      );
    } else if (payload.type === 'notification') {
      await this.sendNotificationEmail(
        payload.to,
        payload.repo,
        payload.tagName || '',
        payload.unsubscribeToken || ''
      );
    } else {
      throw new BadRequestError(`Unknown email message type: ${payload.type}`);
    }
  }
}

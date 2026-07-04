import { IEmailService, EmailDeps } from '../../types/email.js';
import { emailStyles as styles } from '../../constants/emailStyles.js';

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
}

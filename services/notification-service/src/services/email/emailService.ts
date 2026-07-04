import { IEmailService, EmailDeps } from '../../types/email.js';

export class EmailService implements IEmailService {
  private emailServiceUrl: string;

  constructor({ emailServiceUrl }: EmailDeps) {
    this.emailServiceUrl = emailServiceUrl;
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void> {
    const res = await fetch(`${this.emailServiceUrl}/api/internal/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'notification',
        to: email,
        repo,
        tagName,
        unsubscribeToken,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to send notification email via email service: ${res.statusText}. ${errText}`);
    }
  }
}

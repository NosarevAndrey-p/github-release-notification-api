import { IEmailService, EmailDeps } from '../../types/email.js';
import { ServiceError } from '../../types/errors.js';

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
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ServiceError(`Failed to send notification email via email service: ${res.statusText}. ${errText}`);
    }
  }
}

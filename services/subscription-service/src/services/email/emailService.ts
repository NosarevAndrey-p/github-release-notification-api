import { IEmailService, EmailDeps } from '../../types/email.js';

export class EmailService implements IEmailService {
  private emailServiceUrl: string;

  constructor({ emailServiceUrl }: EmailDeps) {
    this.emailServiceUrl = emailServiceUrl;
  }

  async sendConfirmationEmail(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<void> {
    const res = await fetch(`${this.emailServiceUrl}/api/internal/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'confirmation',
        to: email,
        repo,
        confirmToken,
        unsubscribeToken,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to send confirmation email via email service: ${res.statusText}. ${errText}`);
    }
  }
}

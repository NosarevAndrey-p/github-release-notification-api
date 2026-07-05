export interface ITemplateRenderer {
  render(templateName: string, data: Record<string, unknown>): Promise<string>;
}

export interface IEmailTransporter {
  send(to: string, subject: string, html: string): Promise<void>;
}

export interface EmailDeps {
  renderer: ITemplateRenderer;
  transporter: IEmailTransporter;
  baseUrl: string;
}

export interface EmailMessagePayload {
  type: 'confirmation' | 'notification';
  to: string;
  repo: string;
  confirmToken?: string;
  unsubscribeToken?: string;
  tagName?: string;
}

export interface IEmailService {
  sendConfirmationEmail(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<void>;

  sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void>;

  handleEmailMessage(payload: EmailMessagePayload): Promise<void>;
}

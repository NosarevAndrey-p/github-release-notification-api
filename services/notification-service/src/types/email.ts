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

export interface IEmailService {
  sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void>;
}

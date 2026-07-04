export interface EmailDeps {
  emailServiceUrl: string;
}

export interface IEmailService {
  sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void>;
}

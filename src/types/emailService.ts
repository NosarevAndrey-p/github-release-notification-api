import nodemailer from 'nodemailer';

export interface EmailDeps {
  transporter: nodemailer.Transporter;
  baseUrl: string;
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
}

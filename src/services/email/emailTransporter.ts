import nodemailer from 'nodemailer';
import { IEmailTransporter } from '../../types/email.js';
import { SmtpConfig } from '../../types/config.js';

export class NodemailerTransporter implements IEmailTransporter {
  private transporter: nodemailer.Transporter;

  constructor(private config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.user,
      to,
      subject,
      html,
    });
  }
}

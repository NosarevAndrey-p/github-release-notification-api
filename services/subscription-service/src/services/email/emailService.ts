import { IEmailService, EmailDeps } from '../../types/email.js';
import { IAmqpService } from '@shared/amqp';

export class EmailService implements IEmailService {
  private amqpService: IAmqpService;

  constructor({ amqpService }: EmailDeps) {
    this.amqpService = amqpService;
  }

  async sendConfirmationEmail(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<void> {
    await this.amqpService.publish('email.confirmation', {
      type: 'confirmation',
      to: email,
      repo,
      confirmToken,
      unsubscribeToken,
    });
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tagName: string,
    unsubscribeToken: string
  ): Promise<void> {
    await this.amqpService.publish('email.notification', {
      type: 'notification',
      to: email,
      repo,
      tagName,
      unsubscribeToken,
    });
  }
}

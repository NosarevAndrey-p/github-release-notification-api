import { AmqpService } from '../services/amqpService.js';

export interface EmailDeps {
  amqpService: AmqpService;
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

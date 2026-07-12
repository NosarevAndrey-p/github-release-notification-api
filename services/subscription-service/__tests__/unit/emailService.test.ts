import { EmailService } from '../../src/services/email/emailService.js';
import { AmqpService } from '@shared/amqp';
import { mock, mockReset } from 'jest-mock-extended';

describe('EmailService Client', () => {
  const mockAmqpService = mock<AmqpService>();
  let emailService: EmailService;

  beforeEach(() => {
    mockReset(mockAmqpService);
    mockAmqpService.publish.mockResolvedValue(undefined);
    emailService = new EmailService({ amqpService: mockAmqpService });
  });

  it('should publish sendConfirmationEmail event to RabbitMQ', async () => {
    await emailService.sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );

    expect(mockAmqpService.publish).toHaveBeenCalledWith(
      'email.confirmation',
      {
        type: 'confirmation',
        to: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        unsubscribeToken: 'unsub-token',
      }
    );
  });

  it('should publish sendNotificationEmail event to RabbitMQ', async () => {
    await emailService.sendNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.0.0',
      'unsub-token'
    );

    expect(mockAmqpService.publish).toHaveBeenCalledWith(
      'email.notification',
      {
        type: 'notification',
        to: 'test@example.com',
        repo: 'owner/repo',
        tagName: 'v1.0.0',
        unsubscribeToken: 'unsub-token',
      }
    );
  });
});

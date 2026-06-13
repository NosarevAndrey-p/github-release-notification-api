import { jest } from '@jest/globals';
import { EmailService } from '../services/emailService.js';

describe('emailService', () => {
  let mockTransporter: any;
  let emailService: EmailService;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn(),
    };
    emailService = new EmailService(mockTransporter);
  });

  it('should send confirmation email', async () => {
    mockTransporter.sendMail.mockResolvedValue({});

    await emailService.sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Confirm subscription to owner/repo'),
        html: expect.stringContaining('confirm-token'),
      })
    );
  });

  it('should send release notification email', async () => {
    mockTransporter.sendMail.mockResolvedValue({});

    await emailService.sendReleaseNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.1',
      'https://github.com/owner/repo/releases/v1.1',
      'unsub-token'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('New release v1.1 for owner/repo'),
        html: expect.stringContaining('v1.1'),
      })
    );
  });
});

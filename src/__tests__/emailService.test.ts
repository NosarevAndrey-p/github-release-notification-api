import { jest } from '@jest/globals';
import { EmailService } from '../services/emailService.js';
import nodemailer from 'nodemailer';

describe('emailService', () => {
  const mockTransporter = {
    sendMail: jest.fn(),
  } as unknown as jest.Mocked<nodemailer.Transporter>;

  const emailService = new EmailService(mockTransporter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send confirmation email', async () => {
    mockTransporter.sendMail.mockResolvedValue({} as unknown as nodemailer.SentMessageInfo);

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
    mockTransporter.sendMail.mockResolvedValue({} as unknown as nodemailer.SentMessageInfo);

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

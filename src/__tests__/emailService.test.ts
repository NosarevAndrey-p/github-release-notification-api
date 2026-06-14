import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import { EmailService } from '../services/emailService.js';

describe('EmailService', () => {
  let mockTransporter: any;
  let emailService: EmailService;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn() as any,
    };
    mockTransporter.sendMail.mockResolvedValue({ messageId: '123' });
    emailService = new EmailService(mockTransporter as unknown as nodemailer.Transporter);
  });

  it('should send confirmation email', async () => {
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
        html: expect.stringContaining('owner/repo'),
      })
    );
  });

  it('should send notification email', async () => {
    await emailService.sendNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.0',
      'unsub-token'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('New release v1.0 for owner/repo'),
        html: expect.stringContaining('v1.0'),
      })
    );
  });
});

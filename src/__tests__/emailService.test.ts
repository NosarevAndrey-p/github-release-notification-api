import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import { sendConfirmationEmail, sendNotificationEmail } from '../services/emailService.js';

describe('EmailService', () => {
  let mockTransporter: any;
  const mockDeps = {
    baseUrl: 'http://localhost:3000',
    transporter: null as any
  };

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn() as any,
    };
    mockTransporter.sendMail.mockResolvedValue({ messageId: '123' });
    mockDeps.transporter = mockTransporter as unknown as nodemailer.Transporter;
  });

  it('should send confirmation email', async () => {
    await sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token',
      mockDeps
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
    await sendNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.0',
      'unsub-token',
      mockDeps
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

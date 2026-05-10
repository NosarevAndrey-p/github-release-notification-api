import { EmailService } from '../services/emailService.js';
import { jest } from '@jest/globals';

describe('EmailService', () => {
  let mockTransporter;
  let service;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue(true),
    };

    service = new EmailService(mockTransporter);
  });

  it('should send confirmation email with correct payload', async () => {
    await service.sendConfirmationEmail(
      'test@gmail.com',
      'owner/repo',
      'confirm123',
      'unsub123'
    );

    const callArgs = mockTransporter.sendMail.mock.calls[0][0];

    expect(callArgs.to).toBe('test@gmail.com');
    expect(callArgs.subject).toContain('owner/repo');
    expect(callArgs.html).toContain('/api/confirm/confirm123');
    expect(callArgs.html).toContain('/api/unsubscribe/unsub123');
  });

  it('should send release notification email with correct payload', async () => {
    await service.sendReleaseNotificationEmail(
      'test@gmail.com',
      'owner/repo',
      'v1.2.3',
      'https://github.com/owner/repo/releases/v1.2.3',
      'unsub123'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

    const callArgs = mockTransporter.sendMail.mock.calls[0][0];

    expect(callArgs.to).toBe('test@gmail.com');
    expect(callArgs.subject).toContain('v1.2.3');
    expect(callArgs.subject).toContain('owner/repo');

    expect(callArgs.html).toContain('owner/repo');
    expect(callArgs.html).toContain('v1.2.3');
    expect(callArgs.html).toContain('/api/unsubscribe/unsub123');
  });
});
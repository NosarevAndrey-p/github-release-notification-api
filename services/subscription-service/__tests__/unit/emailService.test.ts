import { EmailService } from '../../src/services/email/emailService.js';
import { jest } from '@jest/globals';

describe('EmailService Client', () => {
  const emailServiceUrl = 'http://localhost:3003';
  let emailService: EmailService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as unknown as Response);
    global.fetch = mockFetch;

    emailService = new EmailService({ emailServiceUrl });
  });

  it('should send confirmation email request to email-service', async () => {
    await emailService.sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      `${emailServiceUrl}/api/internal/send-email`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'confirmation',
          to: 'test@example.com',
          repo: 'owner/repo',
          confirmToken: 'confirm-token',
          unsubscribeToken: 'unsub-token',
        }),
      })
    );
  });
});

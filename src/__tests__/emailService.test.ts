import { jest } from '@jest/globals';
import { EmailService } from '../services/email/emailService.js';
import { EmailDeps } from '../types/email.js';

describe('EmailService', () => {
  let mockTransporter: any;
  let mockRenderer: any;
  let mockDeps: EmailDeps;
  let emailService: EmailService;

  beforeEach(() => {
    mockTransporter = {
      send: jest.fn() as any,
    };
    mockTransporter.send.mockResolvedValue(undefined);
    
    mockRenderer = {
      render: jest.fn() as any,
    };
    mockRenderer.render.mockResolvedValue('<html>Test Template</html>');

    mockDeps = {
      baseUrl: 'http://localhost:3000',
      transporter: mockTransporter,
      renderer: mockRenderer,
    };

    emailService = new EmailService(mockDeps);
  });

  it('should send confirmation email', async () => {
    await emailService.sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );

    expect(mockRenderer.render).toHaveBeenCalledWith(
      'confirmation-email',
      expect.objectContaining({ repo: 'owner/repo' })
    );
    expect(mockTransporter.send).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('Confirm subscription to owner/repo'),
      '<html>Test Template</html>'
    );
  });

  it('should send notification email', async () => {
    await emailService.sendNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.0',
      'unsub-token'
    );

    expect(mockRenderer.render).toHaveBeenCalledWith(
      'notification-email',
      expect.objectContaining({ repo: 'owner/repo', newTag: 'v1.0' })
    );
    expect(mockTransporter.send).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('New release v1.0 for owner/repo'),
      '<html>Test Template</html>'
    );
  });
});

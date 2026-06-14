import { jest } from '@jest/globals';
import { sendConfirmationEmail, sendNotificationEmail } from '../services/emailService.js';
import { EmailDeps } from '../types/email.js';

describe('EmailService', () => {
  let mockTransporter: any;
  let mockRenderer: any;
  let mockDeps: EmailDeps;

  beforeEach(() => {
    mockTransporter = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    mockRenderer = {
      render: jest.fn().mockResolvedValue('<html>Test Template</html>'),
    };
    mockDeps = {
      baseUrl: 'http://localhost:3000',
      transporter: mockTransporter,
      renderer: mockRenderer,
    };
  });

  it('should send confirmation email', async () => {
    await sendConfirmationEmail(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token',
      mockDeps
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
    await sendNotificationEmail(
      'test@example.com',
      'owner/repo',
      'v1.0',
      'unsub-token',
      mockDeps
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

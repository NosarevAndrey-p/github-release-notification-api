import { jest } from '@jest/globals';
import { EmailService } from '../../src/services/emailService.js';
import { IEmailTransporter, ITemplateRenderer } from '../../src/types/email.js';
import { mock, mockReset } from 'jest-mock-extended';

describe('EmailService', () => {
  const mockTransporter = mock<IEmailTransporter>();
  const mockRenderer = mock<ITemplateRenderer>();
  
  const mockDeps = {
    baseUrl: 'http://localhost:3000',
    transporter: mockTransporter,
    renderer: mockRenderer,
  };

  let emailService: EmailService;

  beforeEach(() => {
    mockReset(mockTransporter);
    mockReset(mockRenderer);

    mockTransporter.send.mockResolvedValue(undefined);
    mockRenderer.render.mockResolvedValue('<html>Test Template</html>');

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

  describe('handleEmailMessage', () => {
    it('should route confirmation message type to sendConfirmationEmail', async () => {
      const spy = jest.spyOn(emailService, 'sendConfirmationEmail').mockResolvedValue(undefined);

      await emailService.handleEmailMessage({
        type: 'confirmation',
        to: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: 'confirm-token',
        unsubscribeToken: 'unsub-token',
      });

      expect(spy).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
        'confirm-token',
        'unsub-token'
      );
    });

    it('should route notification message type to sendNotificationEmail', async () => {
      const spy = jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue(undefined);

      await emailService.handleEmailMessage({
        type: 'notification',
        to: 'test@example.com',
        repo: 'owner/repo',
        tagName: 'v1.0',
        unsubscribeToken: 'unsub-token',
      });

      expect(spy).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
        'v1.0',
        'unsub-token'
      );
    });

    it('should throw error for unknown message type', async () => {
      await expect(
        emailService.handleEmailMessage({
          type: 'invalid' as any,
          to: 'test@example.com',
          repo: 'owner/repo',
        })
      ).rejects.toThrow('Unknown email message type: invalid');
    });
  });
});

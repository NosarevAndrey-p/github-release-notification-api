import { EmailService } from '../../src/services/email/emailService.js';
import { EmailDeps, IEmailTransporter, ITemplateRenderer } from '../../src/types/email.js';
import { mock, mockReset } from 'jest-mock-extended';

describe('EmailService', () => {
  const mockTransporter = mock<IEmailTransporter>();
  const mockRenderer = mock<ITemplateRenderer>();
  
  const mockDeps: EmailDeps = {
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

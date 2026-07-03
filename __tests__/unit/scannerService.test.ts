import { jest } from '@jest/globals';
import { scan, ScannerDeps } from '../../src/services/scannerService.js';
import { RateLimitError } from '../../src/types/errors.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IRepositoryStore, ISubscriptionStore, Subscription } from '../../src/types/database.js';
import { IGitHubService } from '../../src/types/github.js';
import { IEmailService } from '../../src/types/email.js';
import { ILogger } from '../../src/types/logger.js';

describe('scannerService', () => {
  const mockDb = mock<IRepositoryStore & ISubscriptionStore>();
  const mockGithubService = mock<IGitHubService>();
  const mockEmailService = mock<IEmailService>();
  const mockLogger = mock<ILogger>();

  const deps: ScannerDeps = {
    repoStore: mockDb,
    subStore: mockDb,
    githubService: mockGithubService,
    emailService: mockEmailService,
    logger: mockLogger,
  };

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockGithubService);
    mockReset(mockEmailService);
    mockReset(mockLogger);

    mockEmailService.sendNotificationEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should delegate notifications when new releases are found', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ 
      tag_name: 'v1.1', 
      html_url: 'https://github.com/owner/repo/releases/tag/v1.1' 
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' } as unknown as Subscription,
    ]);

    await scan(deps);

    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
      'user1@example.com',
      'owner/repo',
      'v1.1',
      'token1'
    );
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
  });

  it('should skip if no new release', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0', html_url: '' });

    await scan(deps);

    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
  });

  it('should handle rate limits', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

    await scan(deps);

    expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit hit, stopping scan early');
    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('should log generic errors and continue scanning', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo1', last_seen_tag: 'v1.0' },
      { id: 2, full_name: 'owner/repo2', last_seen_tag: 'v1.0' },
    ]);
    const genericError = new Error('Database connection failed');
    mockGithubService.fetchLatestRelease.mockRejectedValueOnce(genericError);
    mockGithubService.fetchLatestRelease.mockResolvedValueOnce({ tag_name: 'v1.0', html_url: '' });

    await scan(deps);

    expect(mockLogger.error).toHaveBeenCalledWith('Scan failed for owner/repo1:', genericError);
    expect(mockGithubService.fetchLatestRelease).toHaveBeenCalledTimes(2);
  });

  it('should log error when email sending fails but still update last seen tag', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ 
      tag_name: 'v1.1', 
      html_url: 'https://github.com/owner/repo/releases/tag/v1.1' 
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user@example.com', unsubscribe_token: 'token1' } as unknown as Subscription,
    ]);
    const emailError = new Error('SMTP server down');
    mockEmailService.sendNotificationEmail.mockRejectedValue(emailError);

    await scan(deps);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to email user@example.com for owner/repo:',
      emailError
    );
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
  });
});


import { jest } from '@jest/globals';
import { scan, ScannerDeps } from '../services/scannerService.js';
import { RateLimitError } from '../types/errors.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IRepositoryStore, ISubscriptionStore, Subscription } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { INotifier } from '../types/notification.js';
import { ILogger } from '../types/logger.js';

describe('scannerService', () => {
  const mockDb = mock<IRepositoryStore & ISubscriptionStore>();
  const mockGithubService = mock<IGitHubService>();
  const mockNotifier = mock<INotifier>();
  const mockLogger = mock<ILogger>();

  const deps: ScannerDeps = {
    repoStore: mockDb,
    subStore: mockDb,
    githubService: mockGithubService,
    notifier: mockNotifier,
    logger: mockLogger,
  };

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockGithubService);
    mockReset(mockNotifier);
    mockReset(mockLogger);

    mockNotifier.notify.mockResolvedValue(undefined);
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

    expect(mockNotifier.notify).toHaveBeenCalledWith(
      'owner/repo',
      'v1.1',
      expect.arrayContaining([expect.objectContaining({ email: 'user1@example.com' })])
    );
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
  });

  it('should skip if no new release', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0', html_url: '' });

    await scan(deps);

    expect(mockNotifier.notify).not.toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
  });

  it('should handle rate limits', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

    await scan(deps);

    expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit hit, stopping scan early');
    expect(mockNotifier.notify).not.toHaveBeenCalled();
  });
});

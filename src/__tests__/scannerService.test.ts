import { jest } from '@jest/globals';
import { scan } from '../services/scannerService.js';
import { RateLimitError } from '../types/errors.js';

describe('scannerService', () => {
  let mockDb: any;
  let mockGithubService: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockDb = {
      getConfirmedRepositories: jest.fn(),
      getConfirmedSubscriptionsByRepoId: jest.fn(),
      updateRepositoryLastSeenTag: jest.fn(),
    };
    mockGithubService = {
      fetchLatestRelease: jest.fn(),
    };
    mockEmailService = {
      sendNotificationEmail: jest.fn(),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should notify users of new releases', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ 
      tag_name: 'v1.1', 
      html_url: 'https://github.com/owner/repo/releases/tag/v1.1' 
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
      { email: 'user2@example.com', unsubscribe_token: 'token2' },
    ]);

    await scan({ repoStore: mockDb, subStore: mockDb, githubService: mockGithubService, emailService: mockEmailService });

    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledTimes(2);
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
    mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0' });

    await scan({ repoStore: mockDb, subStore: mockDb, githubService: mockGithubService, emailService: mockEmailService });

    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
  });

  it('should handle rate limits', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

    await scan({ repoStore: mockDb, subStore: mockDb, githubService: mockGithubService, emailService: mockEmailService });

    expect(console.warn).toHaveBeenCalledWith('Rate limit hit, stopping scan early');
    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('should handle email failures gracefully', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.1' });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
    ]);
    mockEmailService.sendNotificationEmail.mockRejectedValue(new Error('Email failed'));

    await scan({ repoStore: mockDb, subStore: mockDb, githubService: mockGithubService, emailService: mockEmailService });

    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
    expect(console.error).toHaveBeenCalled();
  });
});

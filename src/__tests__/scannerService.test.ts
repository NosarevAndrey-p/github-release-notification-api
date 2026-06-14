import { jest } from '@jest/globals';
import { scan } from '../services/scannerService.js';

describe('scannerService', () => {
  let mockDb: any;
  let mockGithubRequest: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockDb = {
      getConfirmedRepositories: jest.fn(),
      getConfirmedSubscriptionsByRepoId: jest.fn(),
      updateRepositoryLastSeenTag: jest.fn(),
    };
    mockGithubRequest = jest.fn();
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
    mockGithubRequest.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tag_name: 'v1.1', html_url: 'https://github.com/owner/repo/releases/tag/v1.1' }),
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
      { email: 'user2@example.com', unsubscribe_token: 'token2' },
    ]);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

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
    mockGithubRequest.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tag_name: 'v1.0' }),
    });

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
  });

  it('should handle rate limits', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubRequest.mockResolvedValue({ status: 403, ok: false });

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(console.warn).toHaveBeenCalledWith('Rate limit hit, stopping scan early');
    expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('should handle email failures gracefully', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubRequest.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tag_name: 'v1.1' }),
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
    ]);
    mockEmailService.sendNotificationEmail.mockRejectedValue(new Error('Email failed'));

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockEmailService.sendNotificationEmail).toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
    expect(console.error).toHaveBeenCalled();
  });
});

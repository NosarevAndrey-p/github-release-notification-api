import { jest } from '@jest/globals';
import { scan } from '../services/scannerService.js';
import DatabaseClient, { Subscription, Repository } from '../db/databaseClient.js';
import { EmailService } from '../services/emailService.js';

describe('scannerService', () => {
  const mockDb = {
    getConfirmedRepositories: jest.fn(),
    getConfirmedSubscriptionsByRepoId: jest.fn(),
    updateRepositoryLastSeenTag: jest.fn(),
  } as unknown as jest.Mocked<DatabaseClient>;

  const mockGithubRequest = jest.fn() as jest.Mock<(path: string) => Promise<Response>>;

  const mockEmailService = {
    sendReleaseNotificationEmail: jest.fn(),
  } as unknown as jest.Mocked<EmailService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do nothing if no repositories', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([]);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockDb.getConfirmedRepositories).toHaveBeenCalled();
    expect(mockGithubRequest).not.toHaveBeenCalled();
  });

  it('should skip repo with no new release', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' } as Repository]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v1.0', html_url: 'https://github.com/owner/repo/releases/v1.0' }),
    } as Response);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockGithubRequest).toHaveBeenCalledWith('/repos/owner/repo/releases/latest');
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
    expect(mockEmailService.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('should process new release and send notifications', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' } as Repository]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v1.1', html_url: 'https://github.com/owner/repo/releases/v1.1' }),
    } as Response);
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
      { email: 'user2@example.com', unsubscribe_token: 'token2' },
    ] as unknown as Subscription[]);
    mockEmailService.sendReleaseNotificationEmail.mockResolvedValue({});

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockDb.getConfirmedSubscriptionsByRepoId).toHaveBeenCalledWith(1);
    expect(mockEmailService.sendReleaseNotificationEmail).toHaveBeenCalledTimes(2);
    expect(mockEmailService.sendReleaseNotificationEmail).toHaveBeenCalledWith(
      'user1@example.com',
      'owner/repo',
      'v1.1',
      'https://github.com/owner/repo/releases/v1.1',
      'token1'
    );
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
  });

  it('should skip repo with 404 release', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: null } as Repository]);
    mockGithubRequest.mockResolvedValue({ status: 404, ok: false } as Response);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
    expect(mockEmailService.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('should stop scan on rate limit', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo1', last_seen_tag: 'v1.0' },
      { id: 2, full_name: 'owner/repo2', last_seen_tag: 'v1.0' },
    ] as Repository[]);
    mockGithubRequest.mockResolvedValueOnce({ status: 429, ok: false } as Response);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockGithubRequest).toHaveBeenCalledTimes(1); // Only first repo
    expect(mockGithubRequest).toHaveBeenCalledWith('/repos/owner/repo1/releases/latest');
  });

  it('should handle email sending errors gracefully', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' } as Repository]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v1.1', html_url: 'https://github.com/owner/repo/releases/v1.1' }),
    } as Response);
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user@example.com', unsubscribe_token: 'token' },
    ] as unknown as Subscription[]);
    mockEmailService.sendReleaseNotificationEmail.mockRejectedValue(new Error('Email failed'));

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockEmailService.sendReleaseNotificationEmail).toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1'); // Still updates tag
  });
});

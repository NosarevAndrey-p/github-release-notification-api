import { jest } from '@jest/globals';
import { scan } from '../services/scannerService.js';

describe('scannerService', () => {
  let mockDb;
  let mockGithubRequest;
  let mockEmailService;

  beforeEach(() => {
    mockDb = {
      getConfirmedRepositories: jest.fn(),
      getConfirmedSubscriptionsByRepoId: jest.fn(),
      updateRepositoryLastSeenTag: jest.fn(),
    };

    mockGithubRequest = jest.fn();
    mockEmailService = {
      sendReleaseNotificationEmail: jest.fn(),
    };
  });

  it('should do nothing if no repositories', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([]);

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockDb.getConfirmedRepositories).toHaveBeenCalled();
    expect(mockGithubRequest).not.toHaveBeenCalled();
  });

  it('should skip repo with no new release', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      json: () => ({ tag_name: 'v1.0', html_url: 'https://github.com/owner/repo/releases/v1.0' }),
    });

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockGithubRequest).toHaveBeenCalledWith('/repos/owner/repo/releases/latest');
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
    expect(mockEmailService.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('should process new release and send notifications', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      json: () => ({ tag_name: 'v1.1', html_url: 'https://github.com/owner/repo/releases/v1.1' }),
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user1@example.com', unsubscribe_token: 'token1' },
      { email: 'user2@example.com', unsubscribe_token: 'token2' },
    ]);
    mockEmailService.sendReleaseNotificationEmail.mockResolvedValue();

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
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: null }]);
    mockGithubRequest.mockResolvedValue({ status: 404 });

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
    expect(mockEmailService.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('should stop scan on rate limit', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo1', last_seen_tag: 'v1.0' },
      { id: 2, full_name: 'owner/repo2', last_seen_tag: 'v1.0' },
    ]);
    mockGithubRequest.mockResolvedValueOnce({ status: 429 });

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockGithubRequest).toHaveBeenCalledTimes(1); // Only first repo
    expect(mockGithubRequest).toHaveBeenCalledWith('/repos/owner/repo1/releases/latest');
  });

  it('should handle email sending errors gracefully', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([{ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }]);
    mockGithubRequest.mockResolvedValue({
      status: 200,
      json: () => ({ tag_name: 'v1.1', html_url: 'https://github.com/owner/repo/releases/v1.1' }),
    });
    mockDb.getConfirmedSubscriptionsByRepoId.mockResolvedValue([
      { email: 'user@example.com', unsubscribe_token: 'token' },
    ]);
    mockEmailService.sendReleaseNotificationEmail.mockRejectedValue(new Error('Email failed'));

    await scan({ db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService });

    expect(mockEmailService.sendReleaseNotificationEmail).toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1'); // Still updates tag
  });
});
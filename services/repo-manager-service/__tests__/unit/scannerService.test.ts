import { scan, handleUntrackEvent, ScannerDeps } from '../../src/services/scannerService.js';
import { RateLimitError } from '../../src/types/errors.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IRepositoryStore } from '../../src/types/database.js';
import { IGitHubService } from '../../src/types/github.js';
import { AmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';

describe('scannerService', () => {
  const mockDb = mock<IRepositoryStore>();
  const mockGithubService = mock<IGitHubService>();
  const mockAmqpService = mock<AmqpService>();
  const mockLogger = mock<ILogger>();

  const deps: ScannerDeps = {
    repoStore: mockDb,
    githubService: mockGithubService,
    amqpService: mockAmqpService,
    logger: mockLogger,
  };

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockGithubService);
    mockReset(mockAmqpService);
    mockReset(mockLogger);

    mockAmqpService.publish.mockResolvedValue(undefined);
  });

  it('should publish release.published when new release is found', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ 
      tag_name: 'v1.1', 
      html_url: 'https://github.com/owner/repo/releases/tag/v1.1' 
    });

    await scan(deps);

    expect(mockAmqpService.publish).toHaveBeenCalledWith(
      'release.published',
      {
        repo_name: 'owner/repo',
        tag_name: 'v1.1',
      }
    );
    expect(mockDb.updateRepositoryLastSeenTag).toHaveBeenCalledWith(1, 'v1.1');
  });

  it('should skip if no new release is detected', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0', html_url: '' });

    await scan(deps);

    expect(mockAmqpService.publish).not.toHaveBeenCalled();
    expect(mockDb.updateRepositoryLastSeenTag).not.toHaveBeenCalled();
  });

  it('should handle rate limits and stop scan early', async () => {
    mockDb.getConfirmedRepositories.mockResolvedValue([
      { id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' },
    ]);
    mockGithubService.fetchLatestRelease.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

    await scan(deps);

    expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit hit, stopping scan early');
    expect(mockAmqpService.publish).not.toHaveBeenCalled();
  });

  it('should log generic errors and continue scanning subsequent repositories', async () => {
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

  describe('handleUntrackEvent', () => {
    it('should delete repository from database if it exists', async () => {
      const mockPayload = { repo_name: 'owner/repo' };
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' });
      mockDb.deleteRepositoryById.mockResolvedValue({ rowCount: 1 });

      await handleUntrackEvent(mockPayload, mockDb, mockLogger);

      expect(mockDb.getRepositoryByFullName).toHaveBeenCalledWith('owner/repo');
      expect(mockDb.deleteRepositoryById).toHaveBeenCalledWith(1);
    });

    it('should do nothing if repository does not exist', async () => {
      const mockPayload = { repo_name: 'owner/repo' };
      mockDb.getRepositoryByFullName.mockResolvedValue(null);

      await handleUntrackEvent(mockPayload, mockDb, mockLogger);

      expect(mockDb.getRepositoryByFullName).toHaveBeenCalledWith('owner/repo');
      expect(mockDb.deleteRepositoryById).not.toHaveBeenCalled();
    });
  });
});

import { jest } from '@jest/globals';
import { GitHubService } from '../../src/services/githubService.js';
import { NotFoundError, RateLimitError, ServiceError } from '../../src/types/errors.js';
import { GithubRequest } from '../../src/types/github.js';

describe('GitHubService', () => {
  const mockRequest = jest.fn() as jest.MockedFunction<GithubRequest>;
  let gitHubService: GitHubService;

  beforeEach(() => {
    mockRequest.mockReset();
    gitHubService = new GitHubService(mockRequest);
  });

  describe('fetchRepository', () => {
    it('should successfully fetch and return repository info on 200', async () => {
      const mockRepoInfo = { id: 12345, full_name: 'owner/repo' };
      const mockResponse = {
        status: 200,
        json: async () => mockRepoInfo,
      } as unknown as Response;

      mockRequest.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchRepository('owner/repo');

      expect(result).toEqual(mockRepoInfo);
      expect(mockRequest).toHaveBeenCalledWith('/repos/owner/repo');
    });

    it('should throw NotFoundError if response status is 404', async () => {
      const mockResponse = {
        status: 404,
      } as unknown as Response;

      mockRequest.mockResolvedValue(mockResponse);

      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(NotFoundError);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow('repository not found');
      expect(mockRequest).toHaveBeenCalledWith('/repos/owner/repo');
    });

    it('should propagate other errors thrown by the request client (e.g. RateLimitError)', async () => {
      mockRequest.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(RateLimitError);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow('github rate limit exceeded');
    });

    it('should propagate other errors thrown by the request client (e.g. ServiceError)', async () => {
      mockRequest.mockRejectedValue(new ServiceError('github api error'));

      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(ServiceError);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow('github api error');
    });
  });

  describe('fetchLatestRelease', () => {
    it('should successfully fetch and return latest release info on 200', async () => {
      const mockReleaseInfo = { tag_name: 'v1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' };
      const mockResponse = {
        status: 200,
        json: async () => mockReleaseInfo,
      } as unknown as Response;

      mockRequest.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toEqual(mockReleaseInfo);
      expect(mockRequest).toHaveBeenCalledWith('/repos/owner/repo/releases/latest');
    });

    it('should return null if response status is 404', async () => {
      const mockResponse = {
        status: 404,
      } as unknown as Response;

      mockRequest.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toBeNull();
      expect(mockRequest).toHaveBeenCalledWith('/repos/owner/repo/releases/latest');
    });

    it('should return null if response status is other non-200 non-404 status code', async () => {
      const mockResponse = {
        status: 204, // e.g. No Content
      } as unknown as Response;

      mockRequest.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toBeNull();
    });

    it('should propagate errors thrown by the request client (e.g. RateLimitError)', async () => {
      mockRequest.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

      await expect(gitHubService.fetchLatestRelease('owner/repo')).rejects.toThrow(RateLimitError);
    });
  });
});

describe('githubRequest', () => {
  let originalFetch: typeof global.fetch;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should successfully perform fetch and return Response', async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    mockFetch.mockResolvedValue(mockResponse);

    const { githubRequest } = await import('../../src/services/githubService.js');
    const result = await githubRequest('/repos/owner/repo');
    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
        }),
      })
    );
  });

  it('should throw RateLimitError on 403 or 429', async () => {
    const { githubRequest } = await import('../../src/services/githubService.js');

    mockFetch.mockResolvedValue({ ok: false, status: 429 } as Response);
    await expect(githubRequest('/some-path')).rejects.toThrow(RateLimitError);

    mockFetch.mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(githubRequest('/some-path')).rejects.toThrow(RateLimitError);
  });

  it('should throw ServiceError on other non-ok statuses except 404', async () => {
    const { githubRequest } = await import('../../src/services/githubService.js');

    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(githubRequest('/some-path')).rejects.toThrow(ServiceError);
  });

  it('should not throw on 404', async () => {
    const { githubRequest } = await import('../../src/services/githubService.js');
    const mockResponse = { ok: false, status: 404 } as Response;
    mockFetch.mockResolvedValue(mockResponse);

    const result = await githubRequest('/some-path');
    expect(result).toBe(mockResponse);
  });
});


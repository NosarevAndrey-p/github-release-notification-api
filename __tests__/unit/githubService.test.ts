import { jest } from '@jest/globals';
import { GitHubService } from '../../src/services/githubService.js';
import { NotFoundError, RateLimitError, ServiceError } from '../../src/types/errors.js';

describe('GitHubService', () => {
  let originalFetch: typeof global.fetch;
  const mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;
  let gitHubService: GitHubService;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
    gitHubService = new GitHubService({
      apiUrl: 'https://api.github.com',
      token: 'test-token',
    });
  });

  describe('fetchRepository', () => {
    it('should successfully fetch and return repository info on 200', async () => {
      const mockRepoInfo = { id: 12345, full_name: 'owner/repo' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockRepoInfo,
      } as unknown as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchRepository('owner/repo');

      expect(result).toEqual(mockRepoInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL('https://api.github.com/repos/owner/repo'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw NotFoundError if response status is 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      } as unknown as Response;

      mockFetch.mockResolvedValue(mockResponse);

      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(NotFoundError);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow('repository not found');
    });

    it('should throw RateLimitError on 403 or 429', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429 } as Response);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(RateLimitError);

      mockFetch.mockResolvedValue({ ok: false, status: 403 } as Response);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(RateLimitError);
    });

    it('should throw ServiceError on other non-ok statuses except 404', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
      await expect(gitHubService.fetchRepository('owner/repo')).rejects.toThrow(ServiceError);
    });
  });

  describe('fetchLatestRelease', () => {
    it('should successfully fetch and return latest release info on 200', async () => {
      const mockReleaseInfo = { tag_name: 'v1.0.0', html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockReleaseInfo,
      } as unknown as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toEqual(mockReleaseInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL('https://api.github.com/repos/owner/repo/releases/latest'),
        expect.any(Object)
      );
    });

    it('should return null if response status is 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      } as unknown as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toBeNull();
    });

    it('should return null if response status is other non-200 non-404 status code', async () => {
      const mockResponse = {
        ok: true,
        status: 204, // e.g. No Content
      } as unknown as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const result = await gitHubService.fetchLatestRelease('owner/repo');

      expect(result).toBeNull();
    });
  });
});

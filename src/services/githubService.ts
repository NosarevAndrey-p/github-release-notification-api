import { 
  GithubRequest, 
  IGitHubService, 
  GithubRepoInfo, 
  GithubReleaseInfo 
} from '../types/github.js';
import { NotFoundError, RateLimitError, ServiceError } from '../types/errors.js';

const GITHUB_API = (() => {
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  return new URL(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
})();

const GITHUB_HEADERS: Record<string, string> = (() => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
})();

export const githubRequest: GithubRequest = async (path: string) => {
  const cleanPath = path.replace(/^\//, '');
  const url = new URL(cleanPath, GITHUB_API);
  const res = await fetch(url, { headers: GITHUB_HEADERS });

  if (res.status === 429 || res.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!res.ok && res.status !== 404) {
    throw new ServiceError('github api error');
  }

  return res;
};

export class GitHubService implements IGitHubService {
  constructor(private request: GithubRequest) {}

  async fetchRepository(repo: string): Promise<GithubRepoInfo> {
    const res = await this.request(`/repos/${repo}`);

    if (res.status === 404) {
      throw new NotFoundError('repository not found');
    }

    return await res.json() as GithubRepoInfo;
  }

  async fetchLatestRelease(repo: string): Promise<GithubReleaseInfo | null> {
    const res = await this.request(`/repos/${repo}/releases/latest`);

    if (res.status === 200) {
      return await res.json() as GithubReleaseInfo;
    }

    if (res.status === 404) {
      return null;
    }

    return null;
  }
}

const defaultGitHubService = new GitHubService(githubRequest);
export default defaultGitHubService;

import {    IGitHubService, 
  GithubRepoInfo, 
  GithubReleaseInfo 
} from '../types/github.js';
import { NotFoundError, RateLimitError, ServiceError } from '../types/errors.js';
import { GithubConfig } from '../types/config.js';
import { config } from '../config/index.js';

export class GitHubService implements IGitHubService {
  private apiUrl: URL;
  private headers: Record<string, string>;

  constructor(githubConfig: GithubConfig) {
    const url = githubConfig.apiUrl;
    this.apiUrl = new URL(url.endsWith('/') ? url : `${url}/`);
    this.headers = {
      Accept: 'application/vnd.github+json',
    };

    if (githubConfig.token) {
      this.headers.Authorization = `Bearer ${githubConfig.token}`;
    }
  }

  private async request(path: string): Promise<Response> {
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(cleanPath, this.apiUrl);
    const res = await fetch(url, { headers: this.headers });

    if (res.status === 429 || res.status === 403) {
      throw new RateLimitError('github rate limit exceeded');
    }

    if (!res.ok && res.status !== 404) {
      throw new ServiceError('github api error');
    }

    return res;
  }

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

const defaultGitHubService = new GitHubService(config.github);
export default defaultGitHubService;

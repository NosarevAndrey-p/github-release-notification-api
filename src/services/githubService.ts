import { GithubRequest, GithubDeps, GithubRepoInfo, GithubReleaseInfo } from '../types/github.js';
import { NotFoundError, RateLimitError, ServiceError } from '../types/errors.js';

const GITHUB_API = new URL(process.env.GITHUB_API_URL || 'https://api.github.com');

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
  const url = new URL(path, GITHUB_API);
  const res = await fetch(url, { headers: GITHUB_HEADERS });

  if (res.status === 429 || res.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!res.ok && res.status !== 404) {
    throw new ServiceError('github api error');
  }

  return res;
};

export async function fetchRepository(repo: string, { githubRequest }: GithubDeps): Promise<GithubRepoInfo> {
  const res = await githubRequest(`/repos/${repo}`);

  if (res.status === 404) {
    throw new NotFoundError('repository not found');
  }

  return await res.json() as GithubRepoInfo;
}

export async function fetchLatestRelease(repo: string, { githubRequest }: GithubDeps): Promise<GithubReleaseInfo | null> {
  const res = await githubRequest(`/repos/${repo}/releases/latest`);

  if (res.status === 200) {
    return await res.json() as GithubReleaseInfo;
  }

  if (res.status === 404) {
    return null;
  }

  return null;
}


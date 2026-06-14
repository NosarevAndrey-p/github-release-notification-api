import { GithubRequest, GithubRepoInfo, GithubReleaseInfo } from '../types/github.js';
import { NotFoundError, RateLimitError, ServiceError } from '../types/errors.js';

export interface GithubDeps {
  githubRequest: GithubRequest;
}

export async function fetchRepository(repo: string, { githubRequest }: GithubDeps): Promise<GithubRepoInfo> {
  const res = await githubRequest(`/repos/${repo}`);

  if (res.status === 404) {
    throw new NotFoundError('repository not found');
  }

  if (res.status === 429 || res.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!res.ok) {
    throw new ServiceError('github api error');
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

  if (res.status === 429 || res.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!res.ok) {
    throw new ServiceError('github api error (releases)');
  }

  return null;
}

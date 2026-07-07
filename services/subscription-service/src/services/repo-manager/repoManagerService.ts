import { IRepoManagerService, RepoManagerDeps } from '../../types/repo-manager.js';

export class RepoManagerService implements IRepoManagerService {
  private repoManagerServiceUrl: string;

  constructor({ repoManagerServiceUrl }: RepoManagerDeps) {
    this.repoManagerServiceUrl = repoManagerServiceUrl;
  }

  async fetchLatestTag(repoName: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.repoManagerServiceUrl}/api/internal/repositories?repo=${encodeURIComponent(repoName)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json() as { last_seen_tag: string | null };
        return data.last_seen_tag;
      }
      return null;
    } catch {
      return null;
    }
  }

  async fetchLatestTags(repoNames: string[]): Promise<Record<string, string | null>> {
    if (repoNames.length === 0) return {};
    try {
      const reposParam = repoNames.map(r => encodeURIComponent(r)).join(',');
      const res = await fetch(`${this.repoManagerServiceUrl}/api/internal/repositories?repos=${reposParam}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return await res.json() as Record<string, string | null>;
      }
    } catch {
      // Fallback
    }

    const fallback: Record<string, string | null> = {};
    repoNames.forEach(r => {
      fallback[r] = null;
    });
    return fallback;
  }
}

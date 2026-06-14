import { IRepositoryStore, ISubscriptionStore, Repository } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { INotifier } from '../types/notification.js';
import { RateLimitError } from '../types/errors.js';

export interface ScannerDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  notifier: INotifier;
}

export async function scan(deps: ScannerDeps) {
  const { repoStore } = deps;
  const repos = await repoStore.getConfirmedRepositories();
  
  if (!repos || repos.length === 0) return;

  for (const repo of repos) {
    try {
      await processRepository(repo, deps);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('Rate limit hit, stopping scan early');
        return;
      }
      console.error(`Scan failed for ${repo.full_name}:`, error);
    }
  }
}

async function processRepository(repo: Repository, deps: ScannerDeps) {
  const { githubService, subStore, repoStore, notifier } = deps;
  
  const release = await githubService.fetchLatestRelease(repo.full_name);
  if (!release || !release.tag_name || release.tag_name === repo.last_seen_tag) {
    return;
  }

  const subscriptions = await subStore.getConfirmedSubscriptionsByRepoId(repo.id);
  if (subscriptions.length > 0) {
    await notifier.notify(repo.full_name, release.tag_name, subscriptions);
  }

  await repoStore.updateRepositoryLastSeenTag(repo.id, release.tag_name);
}

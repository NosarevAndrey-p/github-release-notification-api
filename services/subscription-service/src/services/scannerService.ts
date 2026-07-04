import { IRepositoryStore, ISubscriptionStore, Repository } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { IEmailService } from '../types/email.js';
import { RateLimitError } from '../types/errors.js';
import { ILogger } from '../types/logger.js';

export interface ScannerDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  logger: ILogger;
}

export async function scan(deps: ScannerDeps) {
  const { repoStore, logger } = deps;
  const repos = await repoStore.getConfirmedRepositories();
  
  if (!repos || repos.length === 0) return;

  for (const repo of repos) {
    try {
      await processRepository(repo, deps);
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.warn('Rate limit hit, stopping scan early');
        return;
      }
      logger.error(`Scan failed for ${repo.full_name}:`, error);
    }
  }
}

async function processRepository(repo: Repository, deps: ScannerDeps) {
  const { githubService, subStore, repoStore, emailService, logger } = deps;
  
  const release = await githubService.fetchLatestRelease(repo.full_name);
  if (!release || !release.tag_name || release.tag_name === repo.last_seen_tag) {
    return;
  }

  const subscriptions = await subStore.getConfirmedSubscriptionsByRepoId(repo.id);
  if (subscriptions.length > 0) {
    const notifications = subscriptions.map(sub =>
      emailService.sendNotificationEmail(
        sub.email,
        repo.full_name,
        release.tag_name,
        sub.unsubscribe_token
      ).catch(error => {
        logger.error(`Failed to email ${sub.email} for ${repo.full_name}:`, error);
      })
    );
    await Promise.all(notifications);
  }

  await repoStore.updateRepositoryLastSeenTag(repo.id, release.tag_name);
}

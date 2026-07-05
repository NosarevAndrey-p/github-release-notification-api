import { IRepositoryStore, Repository } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { IEmailService } from '../types/email.js';
import { RateLimitError } from '../types/errors.js';
import { ILogger } from '../types/logger.js';

export interface ScannerDeps {
  repoStore: IRepositoryStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  logger: ILogger;
  subscriptionServiceUrl: string;
}

async function fetchSubscriptions(repo: string, subscriptionServiceUrl: string): Promise<{ email: string; unsubscribe_token: string }[] | null> {
  try {
    const res = await fetch(`${subscriptionServiceUrl}/api/internal/subscriptions?repo=${encodeURIComponent(repo)}`);
    if (res.ok) {
      return await res.json() as { email: string; unsubscribe_token: string }[];
    }
  } catch {
    // Return null to indicate network or communication error
  }
  return null;
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
  const { githubService, repoStore, emailService, logger, subscriptionServiceUrl } = deps;
  
  const release = await githubService.fetchLatestRelease(repo.full_name);
  if (!release || !release.tag_name || release.tag_name === repo.last_seen_tag) {
    return;
  }

  const subscriptions = await fetchSubscriptions(repo.full_name, subscriptionServiceUrl);
  if (subscriptions === null) {
    logger.warn(`Failed to retrieve subscriber list for ${repo.full_name} from subscription service. Skipping notifications.`);
    return;
  }

  if (subscriptions.length > 0) {
    const notifications = subscriptions.map(sub =>
      emailService.sendNotificationEmail(
        sub.email,
        repo.full_name,
        release.tag_name!,
        sub.unsubscribe_token
      ).catch(error => {
        logger.error(`Failed to email ${sub.email} for ${repo.full_name}:`, error);
      })
    );
    await Promise.all(notifications);
  } else {
    logger.info(`No active subscriptions found for ${repo.full_name}. Deleting from tracked repositories.`);
    await repoStore.deleteRepositoryById(repo.id);
    return;
  }

  await repoStore.updateRepositoryLastSeenTag(repo.id, release.tag_name);
}

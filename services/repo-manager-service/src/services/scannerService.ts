import { IRepositoryStore, Repository } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { RateLimitError } from '../types/errors.js';
import { ILogger } from '../types/logger.js';
import { IAmqpService } from '../types/amqp.js';

export interface ScannerDeps {
  repoStore: IRepositoryStore;
  githubService: IGitHubService;
  logger: ILogger;
  amqpService: IAmqpService;
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
  const { githubService, repoStore, amqpService, logger } = deps;
  
  const release = await githubService.fetchLatestRelease(repo.full_name);
  if (!release || !release.tag_name || release.tag_name === repo.last_seen_tag) {
    return;
  }

  logger.info(`New release detected for ${repo.full_name}: ${release.tag_name}. Publishing event...`);

  // Publish release.published event
  await amqpService.publish('release.published', {
    repo_name: repo.full_name,
    tag_name: release.tag_name,
  });

  await repoStore.updateRepositoryLastSeenTag(repo.id, release.tag_name);
}

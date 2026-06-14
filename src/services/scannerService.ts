import { IDatabaseClient } from '../types/database.js';
import { IEmailService } from '../types/email.js';
import { fetchLatestRelease } from './githubService.js';
import { GithubRequest } from '../types/github.js';
import { RateLimitError } from '../types/errors.js';

interface ScannerDeps {
  db: IDatabaseClient;
  githubRequest: GithubRequest;
  emailService: IEmailService;
}

export async function scan({ db, githubRequest, emailService }: ScannerDeps) {
  const repos = await db.getConfirmedRepositories();
  if (!repos || repos.length === 0) return;

  for (const repo of repos) {
    try {
      const release = await fetchLatestRelease(repo.full_name, { githubRequest });

      if (!release) {
        continue;
      }

      const newTag = release.tag_name;

      if (!newTag || newTag === repo.last_seen_tag) {
        continue;
      }

      const subscriptions = await db.getConfirmedSubscriptionsByRepoId(repo.id);
      for (const sub of subscriptions) {
        try {
          await emailService.sendNotificationEmail(
            sub.email,
            repo.full_name,
            newTag,
            sub.unsubscribe_token
          );
        } catch (error) {
          console.error(`Failed to email ${sub.email}`, error);
        }
      }

      await db.updateRepositoryLastSeenTag(repo.id, newTag);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('Rate limit hit, stopping scan early');
        return;
      }
      console.error(`Scan failed for ${repo.full_name}:`, error);
    }
  }
}



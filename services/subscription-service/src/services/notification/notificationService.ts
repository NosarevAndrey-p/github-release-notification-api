import { INotificationService, NotificationDeps } from '../../types/notification.js';
import { NotFoundError } from '../../types/errors.js';

export class NotificationService implements INotificationService {
  private notificationServiceUrl: string;

  constructor({ notificationServiceUrl }: NotificationDeps) {
    this.notificationServiceUrl = notificationServiceUrl;
  }

  async registerRepository(repoName: string): Promise<void> {
    try {
      const res = await fetch(`${this.notificationServiceUrl}/api/internal/repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName }),
      });

      if (res.status === 404) {
        throw new NotFoundError('repository not found');
      }

      if (!res.ok) {
        throw new Error(`Notification service returned ${res.status}`);
      }
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new Error(`Failed to contact notification service: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async fetchLatestTag(repoName: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.notificationServiceUrl}/api/internal/repositories?repo=${encodeURIComponent(repoName)}`);
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
    const tags: Record<string, string | null> = {};
    const promises = repoNames.map(async (repo) => {
      tags[repo] = await this.fetchLatestTag(repo);
    });
    await Promise.all(promises);
    return tags;
  }
}

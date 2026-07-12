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
        signal: AbortSignal.timeout(5000),
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
      const res = await fetch(`${this.notificationServiceUrl}/api/internal/repositories?repo=${encodeURIComponent(repoName)}`, {
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
      const res = await fetch(`${this.notificationServiceUrl}/api/internal/repositories?repos=${reposParam}`, {
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

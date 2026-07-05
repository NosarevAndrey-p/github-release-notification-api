import SubscriptionModel, { SubscriptionDeps, SubscriptionResult } from '../types/subscription.js';
import { 
  NotFoundError, 
  ConflictError, 
} from '../types/errors.js';

async function fetchLatestTags(repos: string[], notificationServiceUrl: string): Promise<Record<string, string | null>> {
  const tags: Record<string, string | null> = {};
  const promises = repos.map(async (repo) => {
    try {
      const res = await fetch(`${notificationServiceUrl}/api/internal/repositories?repo=${encodeURIComponent(repo)}`);
      if (res.ok) {
        const data = await res.json() as { last_seen_tag: string | null };
        tags[repo] = data.last_seen_tag;
      } else {
        tags[repo] = null;
      }
    } catch {
      tags[repo] = null;
    }
  });
  await Promise.all(promises);
  return tags;
}

export async function subscribeToRepo({ email, repo }: { email: string; repo: string }, deps: SubscriptionDeps) {
  const existing = await deps.subStore.getSubscriptionByEmailAndRepoName(email, repo);
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await deps.emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { status: SubscriptionResult.RESENT };
  }

  const notificationUrl = deps.notificationServiceUrl || 'http://localhost:3002';
  try {
    const res = await fetch(`${notificationUrl}/api/internal/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_name: repo }),
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

  const confirmToken = deps.crypto.randomUUID();
  const unsubscribeToken = deps.crypto.randomUUID();

  await deps.subStore.createSubscription(email, repo, confirmToken, unsubscribeToken);
  await deps.emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { status: SubscriptionResult.CREATED };
}

export async function confirmSubscription(token: string, deps: SubscriptionDeps) {
  const { subStore, notificationServiceUrl } = deps;
  const sub = await subStore.getSubscriptionByConfirmToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  if (sub.confirmed) {
    return { status: SubscriptionResult.ALREADY_CONFIRMED };
  }

  const notificationUrl = notificationServiceUrl || 'http://localhost:3002';
  try {
    const res = await fetch(`${notificationUrl}/api/internal/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_name: sub.repo_name }),
    });

    if (!res.ok) {
      throw new Error(`Notification service returned ${res.status}`);
    }
  } catch (err) {
    throw new Error(`Failed to contact notification service on confirmation: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  await subStore.updateSubscriptionConfirmed(sub.id);
  return { status: SubscriptionResult.CONFIRMED };
}

export async function unsubscribeFromRepo(token: string, { subStore }: SubscriptionDeps) {
  const sub = await subStore.getSubscriptionByUnsubscribeToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  await subStore.deleteSubscriptionById(sub.id);
  return { status: SubscriptionResult.UNSUBSCRIBED };
}

export async function getSubscriptions(email: string, deps: SubscriptionDeps) {
  const rows = await deps.subStore.getSubscriptionsByEmail(email);
  if (rows.length === 0) {
    return [];
  }

  const repos = Array.from(new Set(rows.map(row => row.repo)));
  const notificationUrl = deps.notificationServiceUrl || 'http://localhost:3002';
  const tags = await fetchLatestTags(repos, notificationUrl);

  return rows.map(row => new SubscriptionModel({
    email: row.email,
    repo: row.repo,
    confirmed: row.confirmed,
    last_seen_tag: tags[row.repo] || null,
  }));
}

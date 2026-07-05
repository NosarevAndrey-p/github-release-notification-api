import SubscriptionModel, { SubscriptionDeps, SubscriptionResult } from '../types/subscription.js';
import { 
  NotFoundError, 
  ConflictError, 
} from '../types/errors.js';

export async function subscribeToRepo({ email, repo }: { email: string; repo: string }, deps: SubscriptionDeps) {
  const existing = await deps.subStore.getSubscriptionByEmailAndRepoName(email, repo); 
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await deps.emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { status: SubscriptionResult.RESENT };
  }

  await deps.repoManagerService.registerRepository(repo);

  const confirmToken = deps.crypto.randomUUID();
  const unsubscribeToken = deps.crypto.randomUUID();

  await deps.subStore.createSubscription(email, repo, confirmToken, unsubscribeToken);
  await deps.emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { status: SubscriptionResult.CREATED };
}

export async function confirmSubscription(token: string, deps: SubscriptionDeps) {
  const { subStore, repoManagerService } = deps;
  const sub = await subStore.getSubscriptionByConfirmToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  if (sub.confirmed) {
    return { status: SubscriptionResult.ALREADY_CONFIRMED };
  }

  try {
    await repoManagerService.registerRepository(sub.repo_name);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await subStore.deleteSubscriptionById(sub.id);
    }
    throw err;
  }

  await subStore.updateSubscriptionConfirmed(sub.id);
  return { status: SubscriptionResult.CONFIRMED };
}

export async function unsubscribeFromRepo(token: string, deps: SubscriptionDeps) {
  const { subStore, amqpService } = deps;
  const sub = await subStore.getSubscriptionByUnsubscribeToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  await subStore.deleteSubscriptionById(sub.id);

  // If no remaining subscriptions exist for this repo, trigger untracking asynchronously
  const remaining = await subStore.countSubscriptionsByRepoName(sub.repo_name);
  if (remaining === 0) {
    await amqpService.publish('repository.untrack', { repo_name: sub.repo_name });
  }

  return { status: SubscriptionResult.UNSUBSCRIBED };
}

export async function getSubscriptions(email: string, deps: SubscriptionDeps) {
  const rows = await deps.subStore.getSubscriptionsByEmail(email);
  if (rows.length === 0) {
    return [];
  }

  const repos = Array.from(new Set(rows.map(row => row.repo)));
  const tags = await deps.repoManagerService.fetchLatestTags(repos);

  return rows.map(row => new SubscriptionModel({
    email: row.email,
    repo: row.repo,
    confirmed: row.confirmed,
    last_seen_tag: tags[row.repo] || null,
  }));
}

export async function handleReleasePublishedEvent(
  payload: { repo_name: string; tag_name: string },
  deps: SubscriptionDeps
): Promise<void> {
  const { repo_name, tag_name } = payload;
  const subs = await deps.subStore.getConfirmedSubscriptionsByRepoName(repo_name);

  for (const sub of subs) {
    try {
      await deps.emailService.sendNotificationEmail(
        sub.email,
        repo_name,
        tag_name,
        sub.unsubscribe_token
      );
    } catch (err) {
      deps.logger.error(`Failed to dispatch notification for ${sub.email}:`, err);
    }
  }
}

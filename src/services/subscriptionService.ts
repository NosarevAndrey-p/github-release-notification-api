import SubscriptionModel, { SubscriptionDeps, SubscriptionResult } from '../types/subscription.js';
import { 
  NotFoundError, 
  ConflictError, 
} from '../types/errors.js';

async function getOrCreateRepository(repo: string, { repoStore, githubService }: SubscriptionDeps) {
  const repoRow = await repoStore.getRepositoryByFullName(repo);
  if (repoRow) {
    return repoRow;
  }

  await githubService.fetchRepository(repo);
  const release = await githubService.fetchLatestRelease(repo);
  
  return await repoStore.createRepository(repo, release?.tag_name || null);
}

export async function subscribeToRepo({ email, repo }: { email: string; repo: string }, deps: SubscriptionDeps) {
  const repoRow = await getOrCreateRepository(repo, deps);

  const existing = await deps.subStore.getSubscriptionByEmailAndRepoId(email, repoRow.id);
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await deps.emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { status: SubscriptionResult.RESENT };
  }

  const confirmToken = deps.crypto.randomUUID();
  const unsubscribeToken = deps.crypto.randomUUID();

  await deps.subStore.createSubscription(email, repoRow.id, confirmToken, unsubscribeToken);
  await deps.emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { status: SubscriptionResult.CREATED };
}

export async function confirmSubscription(token: string, { subStore }: SubscriptionDeps) {
  const sub = await subStore.getSubscriptionByConfirmToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  if (sub.confirmed === 1) {
    return { status: SubscriptionResult.ALREADY_CONFIRMED };
  }

  await subStore.updateSubscriptionConfirmed(sub.id);
  return { status: SubscriptionResult.CONFIRMED };
}

export async function unsubscribeFromRepo(token: string, { subStore, repoStore }: SubscriptionDeps) {
  const sub = await subStore.getSubscriptionByUnsubscribeToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  const repoId = sub.repo_id;
  await subStore.deleteSubscriptionById(sub.id);

  const remaining = await subStore.countSubscriptionsByRepoId(repoId);
  if (remaining === 0) {
    await repoStore.deleteRepositoryById(repoId);
  }

  return { status: SubscriptionResult.UNSUBSCRIBED };
}

export async function getSubscriptions(email: string, { subStore }: SubscriptionDeps) {
  const rows = await subStore.getSubscriptionsByEmail(email);
  return rows.map(row => new SubscriptionModel(row));
}

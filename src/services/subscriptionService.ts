import SubscriptionModel, { SubscriptionDeps } from '../types/subscription.js';
import { 
  NotFoundError, 
  ConflictError, 
} from '../types/errors.js';
import { ValidatorService as validate } from './validatorService.js';

async function getOrCreateRepository(repo: string, { repoStore, githubService }: SubscriptionDeps) {
  await githubService.fetchRepository(repo);

  let repoRow = await repoStore.getRepositoryByFullName(repo);
  if (!repoRow) {
    const release = await githubService.fetchLatestRelease(repo);
    repoRow = await repoStore.createRepository(repo, release?.tag_name || null);
  }
  return repoRow;
}

export async function subscribeToRepo({ email, repo }: { email?: string; repo?: string }, deps: SubscriptionDeps) {
  validate.validateEmail(email);
  validate.validateRepo(repo);

  const repoRow = await getOrCreateRepository(repo, deps);

  const existing = await deps.subStore.getSubscriptionByEmailAndRepoId(email, repoRow.id);
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await deps.emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { message: 'confirmation email resent' };
  }

  const confirmToken = deps.crypto.randomUUID();
  const unsubscribeToken = deps.crypto.randomUUID();

  await deps.subStore.createSubscription(email, repoRow.id, confirmToken, unsubscribeToken);
  await deps.emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { message: 'subscription successful, confirmation email sent' };
}

export async function confirmSubscription(token: string | undefined, { subStore }: SubscriptionDeps) {
  validate.validateToken(token);

  const sub = await subStore.getSubscriptionByConfirmToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  if (sub.confirmed === 1) {
    return { message: 'subscription already confirmed' };
  }

  await subStore.updateSubscriptionConfirmed(sub.id);
  return { message: 'subscription confirmed successfully' };
}

export async function unsubscribeFromRepo(token: string | undefined, { subStore, repoStore }: SubscriptionDeps) {
  validate.validateToken(token);

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

  return { message: 'unsubscribed successfully' };
}

export async function getSubscriptions(email: string | undefined, { subStore }: SubscriptionDeps) {
  validate.validateEmail(email);

  const rows = await subStore.getSubscriptionsByEmail(email);
  return rows.map(row => new SubscriptionModel(row));
}

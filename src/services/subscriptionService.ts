import Subscription, { SubscriptionDeps } from '../types/subscription.js';
import { 
  BadRequestError, 
  NotFoundError, 
  ConflictError, 
} from '../types/errors.js';
import { fetchRepository, fetchLatestRelease } from './githubService.js';

const repoRegex = /^[^/]+\/[^/]+$/;
const tokenRegex = /^[0-9a-f-]{36}$/i;

function validateEmail(email: string | undefined): asserts email is string {
  if (!email) throw new BadRequestError('email is required');
}

function validateRepo(repo: string | undefined): asserts repo is string {
  if (!repo) throw new BadRequestError('repo is required');
  if (!repoRegex.test(repo)) throw new BadRequestError('invalid repo format');
}

function validateToken(token: string | undefined): asserts token is string {
  if (!token) throw new BadRequestError('token is required');
  if (!tokenRegex.test(token)) throw new BadRequestError('invalid token');
}

async function getOrCreateRepository(repo: string, { db, githubRequest }: SubscriptionDeps) {
  await fetchRepository(repo, { githubRequest });

  let repoRow = await db.getRepositoryByFullName(repo);
  if (!repoRow) {
    const release = await fetchLatestRelease(repo, { githubRequest });
    repoRow = await db.createRepository(repo, release?.tag_name || null);
  }
  return repoRow;
}

export async function subscribeToRepo({ email, repo }: { email?: string; repo?: string }, deps: SubscriptionDeps) {
  validateEmail(email);
  validateRepo(repo);

  const repoRow = await getOrCreateRepository(repo, deps);

  const existing = await deps.db.getSubscriptionByEmailAndRepoId(email, repoRow.id);
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await deps.emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { message: 'confirmation email resent' };
  }

  const confirmToken = deps.crypto.randomUUID();
  const unsubscribeToken = deps.crypto.randomUUID();

  await deps.db.createSubscription(email, repoRow.id, confirmToken, unsubscribeToken);
  await deps.emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { message: 'subscription successful, confirmation email sent' };
}

export async function confirmSubscription(token: string | undefined, { db }: SubscriptionDeps) {
  validateToken(token);

  const sub = await db.getSubscriptionByConfirmToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  if (sub.confirmed === 1) {
    return { message: 'subscription already confirmed' };
  }

  await db.updateSubscriptionConfirmed(sub.id);
  return { message: 'subscription confirmed successfully' };
}

export async function unsubscribeFromRepo(token: string | undefined, { db }: SubscriptionDeps) {
  validateToken(token);

  const sub = await db.getSubscriptionByUnsubscribeToken(token);
  if (!sub) {
    throw new NotFoundError('Token not found');
  }

  const repoId = sub.repo_id;
  await db.deleteSubscriptionById(sub.id);

  const remaining = await db.countSubscriptionsByRepoId(repoId);
  if (remaining === 0) {
    await db.deleteRepositoryById(repoId);
  }

  return { message: 'unsubscribed successfully' };
}

export async function getSubscriptions(email: string | undefined, { db }: SubscriptionDeps) {
  validateEmail(email);

  const rows = await db.getSubscriptionsByEmail(email);
  return rows.map(row => new Subscription(row));
}

import Subscription from '../models/subscription.js';
import DatabaseClient from '../db/databaseClient.js';
import { EmailService } from './emailService.js';

const repoRegex = /^[^/]+\/[^/]+$/;
const tokenRegex = /^[0-9a-f-]{36}$/i;

export class AppError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429);
  }
}

export class ServiceError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

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

async function fetchRepository(repo: string, githubRequest: (path: string) => Promise<Response>) {
  const ghRes = await githubRequest(`/repos/${repo}`);

  if (ghRes.status === 404) {
    throw new NotFoundError('repository not found');
  }

  if (ghRes.status === 429 || ghRes.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!ghRes.ok) {
    throw new ServiceError('github api error');
  }

  return ghRes;
}

async function fetchLatestReleaseTag(repo: string, githubRequest: (path: string) => Promise<Response>): Promise<string | null> {
  const releaseRes = await githubRequest(`/repos/${repo}/releases/latest`);

  if (releaseRes.status === 200) {
    const data = await releaseRes.json() as { tag_name?: string };
    return data.tag_name || null;
  }

  if (releaseRes.status === 404) {
    return null;
  }

  if (releaseRes.status === 429 || releaseRes.status === 403) {
    throw new RateLimitError('github rate limit exceeded');
  }

  if (!releaseRes.ok) {
    throw new ServiceError('github api error (releases)');
  }

  return null;
}

interface SubscriptionDeps {
  db: DatabaseClient;
  githubRequest: (path: string) => Promise<Response>;
  emailService: EmailService;
  crypto: {
    randomUUID: () => string;
  };
}

export async function subscribeToRepo({ email, repo }: { email?: string; repo?: string }, { db, githubRequest, emailService, crypto }: SubscriptionDeps) {
  validateEmail(email);
  validateRepo(repo);

  await fetchRepository(repo, githubRequest);

  let repoRow = await db.getRepositoryByFullName(repo);
  if (!repoRow) {
    const lastSeenTag = await fetchLatestReleaseTag(repo, githubRequest);
    repoRow = await db.createRepository(repo, lastSeenTag);
  }

  const existing = await db.getSubscriptionByEmailAndRepoId(email, repoRow.id);
  if (existing) {
    if (existing.confirmed) {
      throw new ConflictError('email already subscribed to this repository');
    }

    await emailService.sendConfirmationEmail(email, repo, existing.confirm_token, existing.unsubscribe_token);
    return { message: 'confirmation email resent' };
  }

  const confirmToken = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();

  await db.createSubscription(email, repoRow.id, confirmToken, unsubscribeToken);
  await emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { message: 'subscription successful, confirmation email sent' };
}

export async function confirmSubscription(token: string | undefined, { db }: { db: DatabaseClient }) {
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

export async function unsubscribeFromRepo(token: string | undefined, { db }: { db: DatabaseClient }) {
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

export async function getSubscriptions(email: string | undefined, { db }: { db: DatabaseClient }) {
  validateEmail(email);

  const rows = await db.getSubscriptionsByEmail(email);
  return rows.map(row => new Subscription(row));
}

export {
  AppError as AppErrorExport,
  BadRequestError as BadRequestErrorExport,
  NotFoundError as NotFoundErrorExport,
  ConflictError as ConflictErrorExport,
  RateLimitError as RateLimitErrorExport,
  ServiceError as ServiceErrorExport,
};

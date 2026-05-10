import Subscription from '../models/subscription.js';

const repoRegex = /^[^/]+\/[^/]+$/;
const tokenRegex = /^[0-9a-f-]{36}$/i;

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

class BadRequestError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(message) {
    super(message, 429);
  }
}

class ServiceError extends AppError {
  constructor(message) {
    super(message, 500);
  }
}

function validateEmail(email) {
  if (!email) throw new BadRequestError('email is required');
}

function validateRepo(repo) {
  if (!repo) throw new BadRequestError('repo is required');
  if (!repoRegex.test(repo)) throw new BadRequestError('invalid repo format');
}

function validateToken(token) {
  if (!token) throw new BadRequestError('token is required');
  if (!tokenRegex.test(token)) throw new BadRequestError('invalid token');
}

async function fetchRepository(repo, githubRequest) {
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

async function fetchLatestReleaseTag(repo, githubRequest) {
  const releaseRes = await githubRequest(`/repos/${repo}/releases/latest`);

  if (releaseRes.status === 200) {
    const data = await releaseRes.json();
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

export async function subscribeToRepo({ email, repo }, { db, githubRequest, emailService, crypto }) {
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
    throw new ConflictError('email already subscribed to this repository');
  }

  const confirmToken = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();

  await db.createSubscription(email, repoRow.id, confirmToken, unsubscribeToken);
  await emailService.sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken);

  return { message: 'subscription successful, confirmation email sent' };
}

export async function confirmSubscription(token, { db }) {
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

export async function unsubscribeFromRepo(token, { db }) {
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

export async function getSubscriptions(email, { db }) {
  validateEmail(email);

  const rows = await db.getSubscriptionsByEmail(email);
  return rows.map(row => new Subscription(row));
}

export {
  AppError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceError,
};

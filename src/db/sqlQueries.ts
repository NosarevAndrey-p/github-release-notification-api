import { IQueries } from '../types/database.js';

export const postgresQueries: IQueries = {
  getRepositoryByFullName: 'SELECT * FROM repositories WHERE full_name = $1',
  insertRepository: 'INSERT INTO repositories (full_name, last_seen_tag) VALUES ($1, $2) RETURNING id',
  getSubscriptionByEmailAndRepoId: 'SELECT * FROM subscriptions WHERE email = $1 AND repo_id = $2',
  insertSubscription: `INSERT INTO subscriptions (
    email, repo_id, confirmed, confirm_token, unsubscribe_token
  ) VALUES ($1, $2, 0, $3, $4) RETURNING id`,
  getSubscriptionByConfirmToken: 'SELECT * FROM subscriptions WHERE confirm_token = $1',
  updateSubscriptionConfirmed: 'UPDATE subscriptions SET confirmed = 1 WHERE id = $1',
  getSubscriptionByUnsubscribeToken: 'SELECT * FROM subscriptions WHERE unsubscribe_token = $1',
  deleteSubscriptionById: 'DELETE FROM subscriptions WHERE id = $1',
  countSubscriptionsByRepoId: 'SELECT COUNT(*) AS count FROM subscriptions WHERE repo_id = $1',
  deleteRepositoryById: 'DELETE FROM repositories WHERE id = $1',
  getSubscriptionsByEmail: `SELECT 
    s.email,
    r.full_name AS repo,
    s.confirmed,
    r.last_seen_tag
  FROM subscriptions s
  JOIN repositories r ON s.repo_id = r.id
  WHERE s.email = $1`,
  getConfirmedRepositories: `SELECT DISTINCT r.*
  FROM repositories r
  JOIN subscriptions s ON s.repo_id = r.id
  WHERE s.confirmed = 1`,
  getConfirmedSubscriptionsByRepoId: `SELECT * FROM subscriptions
  WHERE repo_id = $1 AND confirmed = 1`,
  updateRepositoryLastSeenTag: 'UPDATE repositories SET last_seen_tag = $1 WHERE id = $2',
};

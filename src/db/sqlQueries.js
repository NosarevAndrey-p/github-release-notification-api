export const queries = {
  getRepositoryByFullName: 'SELECT * FROM repositories WHERE full_name = ?',
  insertRepository: 'INSERT INTO repositories (full_name, last_seen_tag) VALUES (?, ?)',

  getSubscriptionByEmailAndRepoId: 'SELECT * FROM subscriptions WHERE email = ? AND repo_id = ?',
  insertSubscription: `INSERT INTO subscriptions (
    email, repo_id, confirmed, confirm_token, unsubscribe_token
  ) VALUES (?, ?, 0, ?, ?)`,

  getSubscriptionByConfirmToken: 'SELECT * FROM subscriptions WHERE confirm_token = ?',
  updateSubscriptionConfirmed: 'UPDATE subscriptions SET confirmed = 1 WHERE id = ?',

  getSubscriptionByUnsubscribeToken: 'SELECT * FROM subscriptions WHERE unsubscribe_token = ?',
  deleteSubscriptionById: 'DELETE FROM subscriptions WHERE id = ?',
  countSubscriptionsByRepoId: 'SELECT COUNT(*) AS count FROM subscriptions WHERE repo_id = ?',
  deleteRepositoryById: 'DELETE FROM repositories WHERE id = ?',

  getSubscriptionsByEmail: `SELECT 
    s.email,
    r.full_name AS repo,
    s.confirmed,
    r.last_seen_tag
  FROM subscriptions s
  JOIN repositories r ON s.repo_id = r.id
  WHERE s.email = ?`,

  getConfirmedRepositories: `SELECT DISTINCT r.*
  FROM repositories r
  JOIN subscriptions s ON s.repo_id = r.id
  WHERE s.confirmed = 1`,

  getConfirmedSubscriptionsByRepoId: `SELECT * FROM subscriptions
  WHERE repo_id = ? AND confirmed = 1`,

  updateRepositoryLastSeenTag: 'UPDATE repositories SET last_seen_tag = ? WHERE id = ?',
};

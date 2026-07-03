import fs from 'fs';
import pg from 'pg';
import { IDatabaseClient, Repository, Subscription, UserSubscription, DatabaseResult } from '../types/database.js';
import { DatabaseConfig } from '../types/config.js';

const { Pool } = pg;

const queries = {
  getRepositoryByFullName: 'SELECT * FROM repositories WHERE full_name = $1',
  insertRepository: 'INSERT INTO repositories (full_name, last_seen_tag) VALUES ($1, $2) RETURNING id',
  getSubscriptionByEmailAndRepoId: 'SELECT * FROM subscriptions WHERE email = $1 AND repo_id = $2',
  insertSubscription: `INSERT INTO subscriptions (
    email, repo_id, confirm_token, unsubscribe_token
  ) VALUES ($1, $2, $3, $4) RETURNING id`,
  getSubscriptionByConfirmToken: 'SELECT * FROM subscriptions WHERE confirm_token = $1',
  updateSubscriptionConfirmed: 'UPDATE subscriptions SET confirmed = true WHERE id = $1',
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
  WHERE s.confirmed = true`,
  getConfirmedSubscriptionsByRepoId: `SELECT * FROM subscriptions
  WHERE repo_id = $1 AND confirmed = true`,
  updateRepositoryLastSeenTag: 'UPDATE repositories SET last_seen_tag = $1 WHERE id = $2',
};

export default class PostgresDatabase implements IDatabaseClient {
  private pool: pg.Pool;
  private schemaPath: string;

  constructor(config: DatabaseConfig) {
    if (!config.url) {
      throw new Error('DatabaseConfig.url must be defined for Postgres');
    }

    this.pool = new Pool({ connectionString: config.url });
    this.schemaPath = config.schemaPath;
  }

  async initSchema(): Promise<void> {
    const schema = fs.readFileSync(this.schemaPath, 'utf-8');

    await this.pool.query(schema);
  }

  private async query(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
    return this.pool.query(sql, params);
  }

  private async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    return (result.rows[0] as T) || null;
  }

  private async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.query(sql, params);
    return result.rows as T[];
  }

  private async run(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    const result = await this.query(sql, params);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  }

  async getRepositoryByFullName(fullName: string): Promise<Repository | null> {
    return this.get<Repository>(queries.getRepositoryByFullName, [fullName]);
  }

  async createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository> {
    const result = await this.query(queries.insertRepository, [fullName, lastSeenTag]);
    return {
      id: result.rows[0].id,
      full_name: fullName,
      last_seen_tag: lastSeenTag,
    };
  }

  async getSubscriptionByEmailAndRepoId(email: string, repoId: number): Promise<Subscription | null> {
    return this.get<Subscription>(queries.getSubscriptionByEmailAndRepoId, [email, repoId]);
  }

  async createSubscription(email: string, repoId: number, confirmToken: string, unsubscribeToken: string): Promise<Subscription> {
    const result = await this.query(queries.insertSubscription, [email, repoId, confirmToken, unsubscribeToken]);
    return {
      id: result.rows[0].id,
      email,
      repo_id: repoId,
      confirmed: false,
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken,
    };
  }

  async getSubscriptionByConfirmToken(token: string): Promise<Subscription | null> {
    return this.get<Subscription>(queries.getSubscriptionByConfirmToken, [token]);
  }

  async updateSubscriptionConfirmed(id: number): Promise<DatabaseResult> {
    return this.run(queries.updateSubscriptionConfirmed, [id]);
  }

  async getSubscriptionByUnsubscribeToken(token: string): Promise<Subscription | null> {
    return this.get<Subscription>(queries.getSubscriptionByUnsubscribeToken, [token]);
  }

  async deleteSubscriptionById(id: number): Promise<DatabaseResult> {
    return this.run(queries.deleteSubscriptionById, [id]);
  }

  async countSubscriptionsByRepoId(repoId: number): Promise<number> {
    const row = await this.get<{ count: string }>(queries.countSubscriptionsByRepoId, [repoId]);
    return Number(row?.count ?? 0);
  }

  async deleteRepositoryById(id: number): Promise<DatabaseResult> {
    return this.run(queries.deleteRepositoryById, [id]);
  }

  async getSubscriptionsByEmail(email: string): Promise<UserSubscription[]> {
    return this.all<UserSubscription>(queries.getSubscriptionsByEmail, [email]);
  }

  async getConfirmedRepositories(): Promise<Repository[]> {
    return this.all<Repository>(queries.getConfirmedRepositories);
  }

  async getConfirmedSubscriptionsByRepoId(repoId: number): Promise<Subscription[]> {
    return this.all<Subscription>(queries.getConfirmedSubscriptionsByRepoId, [repoId]);
  }

  async updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult> {
    return this.run(queries.updateRepositoryLastSeenTag, [lastSeenTag, repoId]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { IDatabaseClient, Repository, Subscription, UserSubscription, DatabaseResult } from '../types/database.js';
import { postgresQueries as queries } from './sqlQueries.js';

const { Pool } = pg;

export default class PostgresDatabase implements IDatabaseClient {
  private pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be defined for Postgres');
    }

    this.pool = new Pool({ connectionString });
  }

  async initSchema(): Promise<void> {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.pg.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

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
      confirmed: 0,
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
}

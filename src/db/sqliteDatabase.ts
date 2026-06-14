import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { IDatabaseClient, Repository, Subscription, UserSubscription, DatabaseResult } from '../types/database.js';
import { sqliteQueries as queries } from './sqlQueries.js';
import { DatabaseConfig } from '../types/config.js';

export default class SqliteDatabase implements IDatabaseClient {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.sqliteFile);
    this.db.pragma('foreign_keys = ON');
  }

  initSchema(): void {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  private get<T>(sql: string, params: unknown[] = []): T | null {
    return (this.db.prepare(sql).get(...params) as T) || null;
  }

  private all<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  private run(sql: string, params: unknown[] = []): DatabaseResult {
    const result = this.db.prepare(sql).run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid,
      rowCount: result.changes,
    };
  }

  async getRepositoryByFullName(fullName: string): Promise<Repository | null> {
    return this.get<Repository>(queries.getRepositoryByFullName, [fullName]);
  }

  async createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository> {
    const result = this.run(queries.insertRepository, [fullName, lastSeenTag]);
    return {
      id: result.lastInsertRowid as number,
      full_name: fullName,
      last_seen_tag: lastSeenTag,
    };
  }

  async getSubscriptionByEmailAndRepoId(email: string, repoId: number): Promise<Subscription | null> {
    return this.get<Subscription>(queries.getSubscriptionByEmailAndRepoId, [email, repoId]);
  }

  async createSubscription(email: string, repoId: number, confirmToken: string, unsubscribeToken: string): Promise<Subscription> {
    const result = this.run(queries.insertSubscription, [email, repoId, confirmToken, unsubscribeToken]);
    return {
      id: result.lastInsertRowid as number,
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
    const row = this.get<{ count: number }>(queries.countSubscriptionsByRepoId, [repoId]);
    return row?.count ?? 0;
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

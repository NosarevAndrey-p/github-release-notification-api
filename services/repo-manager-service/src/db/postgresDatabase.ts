import pg from 'pg';
import { migrate } from 'postgres-migrations';
import { IDatabaseClient, Repository, DatabaseResult, OutboxMessage } from '../types/database.js';
import { DatabaseConfig } from '../types/config.js';
import { DatabaseError } from '../types/errors.js';

const { Pool } = pg;

const queries = {
  getRepositoryByFullName: 'SELECT * FROM repositories WHERE full_name = $1',
  getRepositoriesByFullNames: 'SELECT * FROM repositories WHERE full_name = ANY($1::text[])',
  insertRepository: 'INSERT INTO repositories (full_name, last_seen_tag) VALUES ($1, $2) RETURNING id',
  getConfirmedRepositories: 'SELECT * FROM repositories',
  updateRepositoryLastSeenTag: 'UPDATE repositories SET last_seen_tag = $1 WHERE id = $2',
  deleteRepositoryById: 'DELETE FROM repositories WHERE id = $1',
  getUnprocessedOutbox: 'SELECT * FROM outbox WHERE processed = false ORDER BY id ASC',
  markOutboxProcessed: 'UPDATE outbox SET processed = true WHERE id = ANY($1::bigint[])',
  insertOutbox: 'INSERT INTO outbox (saga_id, event_type, payload) VALUES ($1, $2, $3)',
};

export default class PostgresDatabase implements IDatabaseClient {
  private pool: pg.Pool;
  private migrationsDirectory: string;

  constructor(config: DatabaseConfig) {
    if (!config.url) {
      throw new DatabaseError('DatabaseConfig.url must be defined for Postgres');
    }

    this.pool = new Pool({ connectionString: config.url });
    this.migrationsDirectory = config.migrationsDirectory;
  }

  async initSchema(): Promise<void> {
    await migrate({ client: this.pool }, this.migrationsDirectory);
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

  async getRepositoriesByFullNames(fullNames: string[]): Promise<Repository[]> {
    if (fullNames.length === 0) return [];
    return this.all<Repository>(queries.getRepositoriesByFullNames, [fullNames]);
  }

  async createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository> {
    const result = await this.query(queries.insertRepository, [fullName, lastSeenTag]);
    return {
      id: result.rows[0].id,
      full_name: fullName,
      last_seen_tag: lastSeenTag,
    };
  }

  async getConfirmedRepositories(): Promise<Repository[]> {
    return this.all<Repository>(queries.getConfirmedRepositories);
  }

  async updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult> {
    return this.run(queries.updateRepositoryLastSeenTag, [lastSeenTag, repoId]);
  }

  async deleteRepositoryById(id: number): Promise<DatabaseResult> {
    return this.run(queries.deleteRepositoryById, [id]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createRepositoryAndQueueOutbox(
    sagaId: string,
    fullName: string,
    lastSeenTag: string | null
  ): Promise<Repository> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert repository
      const repoRes = await client.query(queries.insertRepository, [fullName, lastSeenTag]);

      // 2. Insert Outbox message
      await client.query(
        queries.insertOutbox,
        [sagaId, 'repository.registered', JSON.stringify({ saga_id: sagaId, repo_name: fullName, last_seen_tag: lastSeenTag })]
      );

      await client.query('COMMIT');

      return {
        id: repoRes.rows[0].id,
        full_name: fullName,
        last_seen_tag: lastSeenTag,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async queueOutbox(sagaId: string, eventType: string, payload: any): Promise<void> {
    await this.run(queries.insertOutbox, [sagaId, eventType, JSON.stringify(payload)]);
  }

  async getUnprocessedOutbox(): Promise<OutboxMessage[]> {
    return this.all<OutboxMessage>(queries.getUnprocessedOutbox);
  }

  async markOutboxProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.run(queries.markOutboxProcessed, [ids]);
  }
}

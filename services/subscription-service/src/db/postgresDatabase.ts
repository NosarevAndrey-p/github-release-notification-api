import pg from 'pg';
import { migrate } from 'postgres-migrations';
import { IDatabaseClient, Subscription, UserSubscriptionRow, ConfirmedSubscription, DatabaseResult, Saga, OutboxMessage } from '../types/database.js';
import { DatabaseConfig } from '../types/config.js';
import { DatabaseError } from '@shared/errors';

const { Pool } = pg;

const queries = {
  getSubscriptionByEmailAndRepoName: 'SELECT * FROM subscriptions WHERE email = $1 AND repo_name = $2',
  insertSubscription: `INSERT INTO subscriptions (
    email, repo_name, confirm_token, unsubscribe_token
  ) VALUES ($1, $2, $3, $4) RETURNING id`,
  getSubscriptionByConfirmToken: 'SELECT * FROM subscriptions WHERE confirm_token = $1',
  updateSubscriptionConfirmed: 'UPDATE subscriptions SET confirmed = true WHERE id = $1',
  getSubscriptionByUnsubscribeToken: 'SELECT * FROM subscriptions WHERE unsubscribe_token = $1',
  deleteSubscriptionById: 'DELETE FROM subscriptions WHERE id = $1',
  countSubscriptionsByRepoName: 'SELECT COUNT(*) AS count FROM subscriptions WHERE repo_name = $1',
  getSubscriptionsByEmail: `SELECT 
    email,
    repo_name AS repo,
    confirmed
  FROM subscriptions
  WHERE email = $1`,
  getConfirmedSubscriptionsByRepoName: 'SELECT email, unsubscribe_token FROM subscriptions WHERE repo_name = $1 AND confirmed = true',
  deleteSubscriptionByEmailAndRepoName: 'DELETE FROM subscriptions WHERE email = $1 AND repo_name = $2',
  getSagaById: 'SELECT * FROM sagas WHERE id = $1',
  updateSagaState: 'UPDATE sagas SET state = $1, steps_completed = $2, updated_at = NOW() WHERE id = $3',
  getUnprocessedOutbox: 'SELECT * FROM outbox WHERE processed = false ORDER BY id ASC',
  markOutboxProcessed: 'UPDATE outbox SET processed = true WHERE id = ANY($1::bigint[])',
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

  async getSubscriptionByEmailAndRepoName(email: string, repoName: string): Promise<Subscription | null> {
    return this.get<Subscription>(queries.getSubscriptionByEmailAndRepoName, [email, repoName]);
  }

  async createSubscription(email: string, repoName: string, confirmToken: string, unsubscribeToken: string): Promise<Subscription> {
    const result = await this.query(queries.insertSubscription, [email, repoName, confirmToken, unsubscribeToken]);
    return {
      id: result.rows[0].id,
      email,
      repo_name: repoName,
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

  async countSubscriptionsByRepoName(repoName: string): Promise<number> {
    const row = await this.get<{ count: string }>(queries.countSubscriptionsByRepoName, [repoName]);
    return Number(row?.count ?? 0);
  }

  async getSubscriptionsByEmail(email: string): Promise<UserSubscriptionRow[]> {
    return this.all<UserSubscriptionRow>(queries.getSubscriptionsByEmail, [email]);
  }

  async getConfirmedSubscriptionsByRepoName(repoName: string): Promise<ConfirmedSubscription[]> {
    return this.all<ConfirmedSubscription>(queries.getConfirmedSubscriptionsByRepoName, [repoName]);
  }

  async deleteSubscriptionByEmailAndRepoName(email: string, repoName: string): Promise<DatabaseResult> {
    return this.run(queries.deleteSubscriptionByEmailAndRepoName, [email, repoName]);
  }

  async startSubscriptionSaga(
    sagaId: string,
    email: string,
    repoName: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<Subscription> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create Saga
      await client.query(
        'INSERT INTO sagas (id, type, state, payload) VALUES ($1, $2, $3, $4)',
        [sagaId, 'SUBSCRIBE', 'STARTED', JSON.stringify({ email, repoName, confirmToken, unsubscribeToken })]
      );

      // 2. Create unconfirmed subscription
      const subRes = await client.query(
        `INSERT INTO subscriptions (email, repo_name, confirm_token, unsubscribe_token) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [email, repoName, confirmToken, unsubscribeToken]
      );

      // 3. Create Outbox message
      await client.query(
        'INSERT INTO outbox (saga_id, event_type, payload) VALUES ($1, $2, $3)',
        [sagaId, 'repository.register', JSON.stringify({ saga_id: sagaId, repo_name: repoName })]
      );

      await client.query('COMMIT');

      return {
        id: subRes.rows[0].id,
        email,
        repo_name: repoName,
        confirmed: false,
        confirm_token: confirmToken,
        unsubscribe_token: unsubscribeToken,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getSaga(id: string): Promise<Saga | null> {
    return this.get<Saga>(queries.getSagaById, [id]);
  }

  async updateSagaState(id: string, state: string, stepsCompleted: string[]): Promise<void> {
    await this.run(queries.updateSagaState, [state, stepsCompleted, id]);
  }

  async getUnprocessedOutbox(): Promise<OutboxMessage[]> {
    return this.all<OutboxMessage>(queries.getUnprocessedOutbox);
  }

  async markOutboxProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.run(queries.markOutboxProcessed, [ids]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

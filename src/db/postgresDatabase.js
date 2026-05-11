import fs from 'fs';
import path from 'path';
import pg from 'pg';
import DatabaseClient from './databaseClient.js';
import { queries } from './sqlQueries.js';

const { Pool } = pg;

function translatePlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export default class PostgresDatabase extends DatabaseClient {
  constructor() {
    super();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be defined for Postgres');
    }

    this.pool = new Pool({ connectionString });
  }

  async initSchema() {
    const schemaPath = path.join(process.cwd(),'src', 'db', 'schema.pg.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await this.pool.query(schema);
  }

  async query(sql, params = []) {
    const text = translatePlaceholders(sql);
    return this.pool.query(text, params);
  }

  async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    const result = await this.query(sql, params);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  }

  async getRepositoryByFullName(fullName) {
    return this.get(queries.getRepositoryByFullName, [fullName]);
  }

  async createRepository(fullName, lastSeenTag) {
    const result = await this.query(`${queries.insertRepository} RETURNING id`, [fullName, lastSeenTag]);
    return {
      id: result.rows[0].id,
      full_name: fullName,
      last_seen_tag: lastSeenTag,
    };
  }

  async getSubscriptionByEmailAndRepoId(email, repoId) {
    return this.get(queries.getSubscriptionByEmailAndRepoId, [email, repoId]);
  }

  async createSubscription(email, repoId, confirmToken, unsubscribeToken) {
    return this.run(queries.insertSubscription, [email, repoId, confirmToken, unsubscribeToken]);
  }

  async getSubscriptionByConfirmToken(token) {
    return this.get(queries.getSubscriptionByConfirmToken, [token]);
  }

  async updateSubscriptionConfirmed(id) {
    return this.run(queries.updateSubscriptionConfirmed, [id]);
  }

  async getSubscriptionByUnsubscribeToken(token) {
    return this.get(queries.getSubscriptionByUnsubscribeToken, [token]);
  }

  async deleteSubscriptionById(id) {
    return this.run(queries.deleteSubscriptionById, [id]);
  }

  async countSubscriptionsByRepoId(repoId) {
    const row = await this.get(queries.countSubscriptionsByRepoId, [repoId]);
    return Number(row?.count ?? 0);
  }

  async deleteRepositoryById(id) {
    return this.run(queries.deleteRepositoryById, [id]);
  }

  async getSubscriptionsByEmail(email) {
    return this.all(queries.getSubscriptionsByEmail, [email]);
  }

  async getConfirmedRepositories() {
    return this.all(queries.getConfirmedRepositories);
  }

  async getConfirmedSubscriptionsByRepoId(repoId) {
    return this.all(queries.getConfirmedSubscriptionsByRepoId, [repoId]);
  }

  async updateRepositoryLastSeenTag(repoId, lastSeenTag) {
    return this.run(queries.updateRepositoryLastSeenTag, [lastSeenTag, repoId]);
  }
}

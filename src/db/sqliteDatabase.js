import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import DatabaseClient from './databaseClient.js';
import { queries } from './sqlQueries.js';

export default class SqliteDatabase extends DatabaseClient {
  constructor(filename = 'database.sqlite') {
    super();
    this.db = new Database(filename);
    this.db.pragma('foreign_keys = ON');
  }

  initSchema() {
    const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }

  async getRepositoryByFullName(fullName) {
    return this.get(queries.getRepositoryByFullName, [fullName]);
  }

  async createRepository(fullName, lastSeenTag) {
    const result = this.run(queries.insertRepository, [fullName, lastSeenTag]);
    return {
      id: result.lastInsertRowid,
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
    const row = this.get(queries.countSubscriptionsByRepoId, [repoId]);
    return row?.count ?? 0;
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

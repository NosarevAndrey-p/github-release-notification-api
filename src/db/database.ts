import { config } from '../config/index.js';
import SqliteDatabase from './sqliteDatabase.js';
import PostgresDatabase from './postgresDatabase.js';
import { IDatabaseClient } from '../types/database.js';

const drivers: Record<string, () => IDatabaseClient> = {
  sqlite: () => new SqliteDatabase(config.db),
  postgres: () => new PostgresDatabase(config.db),
  pg: () => new PostgresDatabase(config.db),
};

const createDatabaseClient = (type: string): IDatabaseClient => {
  const driver = drivers[type];
  if (!driver) {
    throw new Error(`Unsupported database client: ${type}`);
  }
  return driver();
};

const db = createDatabaseClient(config.db.client);

export default db;

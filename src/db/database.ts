import 'dotenv/config';
import SqliteDatabase from './sqliteDatabase.js';
import PostgresDatabase from './postgresDatabase.js';
import { IDatabaseClient } from '../types/database.js';

const clientType = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

const drivers: Record<string, () => IDatabaseClient> = {
  sqlite: () => new SqliteDatabase(process.env.SQLITE_FILE || 'database.sqlite'),
  postgres: () => new PostgresDatabase(),
  pg: () => new PostgresDatabase(),
};

const createDatabaseClient = (type: string): IDatabaseClient => {
  const driver = drivers[type];
  if (!driver) {
    throw new Error(`Unsupported database client: ${type}`);
  }
  return driver();
};

const db = createDatabaseClient(clientType);

export default db;

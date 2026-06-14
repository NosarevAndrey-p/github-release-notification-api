import 'dotenv/config';
import SqliteDatabase from './sqliteDatabase.js';
import PostgresDatabase from './postgresDatabase.js';
import { IDatabaseClient } from './databaseClient.js';

const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

let db: IDatabaseClient;
if (client === 'postgres' || client === 'pg') {
  db = new PostgresDatabase();
} else {
  db = new SqliteDatabase(process.env.SQLITE_FILE || 'database.sqlite');
}

export default db;

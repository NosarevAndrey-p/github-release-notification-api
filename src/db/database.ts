import 'dotenv/config';
import SqliteDatabase from './sqliteDatabase.js';
import PostgresDatabase from './postgresDatabase.js';
import DatabaseClient from './databaseClient.js';

const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

let db: DatabaseClient;
if (client === 'postgres' || client === 'pg') {
  db = new PostgresDatabase();
} else {
  db = new SqliteDatabase(process.env.SQLITE_FILE || 'database.sqlite');
}

export default db;

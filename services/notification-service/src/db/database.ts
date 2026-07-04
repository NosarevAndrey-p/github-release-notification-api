import { config } from '../config/index.js';
import PostgresDatabase from './postgresDatabase.js';

const db = new PostgresDatabase(config.db);

export default db;

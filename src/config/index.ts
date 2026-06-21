import 'dotenv/config';
import path from 'path';
import { Config } from '../types/config.js';

export const config: Config = {
  app: {
    port: Number(process.env.PORT) || 3000,
    scanInterval: Number(process.env.SCAN_INTERVAL) || 60000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  db: {
    url: process.env.DATABASE_URL || '',
    schemaPath: process.env.DB_SCHEMA_PATH || path.join(process.cwd(), 'src', 'db', 'schema.pg.sql'),
  },
};

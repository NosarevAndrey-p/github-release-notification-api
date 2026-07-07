import 'dotenv/config';
import path from 'path';
import { Config } from '../types/config.js';

const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'repo_subscriber';
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
};

export const config: Config = {
  app: {
    port: Number(process.env.PORT) || 3002,
    grpcPort: Number(process.env.GRPC_PORT) || 50051,
    scanInterval: Number(process.env.SCAN_INTERVAL) || 60000,
    subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3000',
    amqpUrl: process.env.AMQP_URL || 'amqp://localhost:5672',
  },
  db: {
    url: getDatabaseUrl(),
    migrationsDirectory: process.env.DB_MIGRATIONS_DIR || path.join(process.cwd(), 'src', 'db', 'migrations'),
  },
  github: {
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    token: process.env.GITHUB_TOKEN,
  },
};

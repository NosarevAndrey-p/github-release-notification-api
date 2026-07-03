import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup() {
  console.info('\n[Jest Global Setup] Starting test database container...');
  
  const composePath = path.join(process.cwd(), 'docker-compose.test.yml');
  
  // Start the container and wait for the healthcheck to pass
  execSync(`docker compose -f "${composePath}" up -d --wait`, { stdio: 'inherit' });
  
  console.info('[Jest Global Setup] Database is ready.');

  // Set the environment variable for schema initialization
  const dbUrl = 'postgresql://postgres:postgres@localhost:5434/repo_subscriber_test';
  process.env.DATABASE_URL = dbUrl;
  process.env.DB_SCHEMA_PATH = path.join(process.cwd(), 'src', 'db', 'schema.pg.sql');

  console.info('[Jest Global Setup] Initializing database schema...');
  
  // Import the database client and initialize the schema
  const { default: db } = await import('../../src/db/database.js');
  await db.initSchema();
  await db.close();

  console.info('[Jest Global Setup] Schema initialized successfully. Connection pool closed.');
}

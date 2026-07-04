import { execSync } from 'child_process';
import path from 'path';
import pg from 'pg';
import { migrate } from 'postgres-migrations';

export default async function globalSetup() {
  console.info('\n[Jest Global Setup] Starting test database container...');
  
  const composePath = path.resolve(__dirname, '../../../../docker-compose.test.yml');
  
  // Start the container and wait for the healthcheck to pass
  execSync(`docker compose -f "${composePath}" up -d --wait`, { stdio: 'inherit' });
  
  console.info('[Jest Global Setup] Database is ready.');

  const dbUrl = 'postgresql://postgres:postgres@localhost:5434/repo_subscriber_test';
  const migrationsDirectory = path.resolve(__dirname, '../../src/db/migrations');

  console.info('[Jest Global Setup] Running database migrations...');
  
  // Use raw pg client to initialize the schema without loading app files
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  
  await migrate({ client }, migrationsDirectory);
  await client.end();

  console.info('[Jest Global Setup] Migrations executed successfully.');
}

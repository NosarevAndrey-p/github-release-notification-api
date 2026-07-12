import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

export default async function globalSetup() {
  console.info('\n[Jest Global Setup] Starting test database container...');
  
  const composePath = path.join(process.cwd(), 'docker-compose.test.yml');
  
  // Start the container and wait for the healthcheck to pass
  execSync(`docker compose -f "${composePath}" up -d --wait`, { stdio: 'inherit' });
  
  console.info('[Jest Global Setup] Database is ready.');

  const dbUrl = 'postgresql://postgres:postgres@localhost:5434/repo_subscriber_test';
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.pg.sql');

  console.info('[Jest Global Setup] Initializing database schema...');
  
  // Use raw pg client to initialize the schema without loading app files
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await client.query(schema);
  await client.end();

  console.info('[Jest Global Setup] Schema initialized successfully.');
}

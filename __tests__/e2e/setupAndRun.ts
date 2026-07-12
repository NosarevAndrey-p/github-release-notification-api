import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

async function main() {
  const composePath = path.join(process.cwd(), 'docker-compose.test.yml');
  const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:5434/repo_subscriber_test';
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.pg.sql');

  try {
    console.info('\n[E2E Setup] Starting test database container...');
    execSync(`docker compose -f "${composePath}" up -d --wait`, { stdio: 'inherit' });
    console.info('[E2E Setup] Database is ready.');

    console.info('[E2E Setup] Initializing database schema...');
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    await client.end();
    console.info('[E2E Setup] Schema initialized successfully.');

    console.info('[E2E Setup] Running Playwright E2E tests...');
    // We pass --config to make sure it uses our config
    execSync('npx playwright test', { stdio: 'inherit' });
  } catch (error) {
    console.error('[E2E Setup] Error occurred during execution:', error);
    process.exitCode = 1;
  } finally {
    console.info('\n[E2E Teardown] Stopping test database container...');
    try {
      execSync(`docker compose -f "${composePath}" down -v`, { stdio: 'inherit' });
      console.info('[E2E Teardown] Database stopped and volumes cleaned up.');
    } catch (teardownError) {
      console.error('[E2E Teardown] Failed to tear down container:', teardownError);
    }
  }
}

main();

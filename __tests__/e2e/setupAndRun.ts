import { execSync } from 'child_process';
import path from 'path';
import pg from 'pg';
import { migrate } from 'postgres-migrations';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createDatabaseIfNotExists(dbName: string, baseConnectionString: string) {
  const client = new pg.Client({ connectionString: baseConnectionString });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${dbName}`);
    console.info(`[E2E Setup] Database "${dbName}" created successfully.`);
  } catch (err: any) {
    if (err.code === '42P04') {
      // Database already exists
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const composePath = path.resolve(__dirname, '../../docker-compose.test.yml');
  const postgresBaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5434/postgres';

  try {
    console.info('\n[E2E Setup] Starting test database container...');
    execSync(`docker compose -f "${composePath}" up -d --wait`, { stdio: 'inherit' });
    console.info('[E2E Setup] Database container is ready.');

    console.info('[E2E Setup] Ensuring test databases exist...');
    await createDatabaseIfNotExists('subscription_test_db', postgresBaseUrl);
    await createDatabaseIfNotExists('repo_manager_test_db', postgresBaseUrl);

    console.info('[E2E Setup] Running database migrations...');
    
    // Run subscription migrations
    const subClient = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/subscription_test_db' });
    await subClient.connect();
    await migrate({ client: subClient }, path.resolve(__dirname, '../../services/subscription-service/src/db/migrations'));
    await subClient.end();
    console.info('[E2E Setup] Subscription service migrations executed successfully.');

    // Run repo-manager migrations
    const notifClient = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/repo_manager_test_db' });
    await notifClient.connect();
    await migrate({ client: notifClient }, path.resolve(__dirname, '../../services/repo-manager-service/src/db/migrations'));
    await notifClient.end();
    console.info('[E2E Setup] Repo manager service migrations executed successfully.');

    console.info('[E2E Setup] Running Playwright E2E tests...');
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

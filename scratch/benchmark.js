import { spawn } from 'child_process';
import pg from 'pg';

const REPO_DB_URL = 'postgresql://postgres:postgres@localhost:5433/repo_manager_db';
const SUB_DB_URL = 'postgresql://postgres:postgres@localhost:5433/subscription_db';

async function seedDatabases() {
  console.log('Seeding databases...');
  
  // Seed repo-manager-db
  const repoClient = new pg.Client({ connectionString: REPO_DB_URL });
  await repoClient.connect();
  await repoClient.query('TRUNCATE TABLE repositories RESTART IDENTITY CASCADE');
  await repoClient.query(
    "INSERT INTO repositories (full_name, last_seen_tag) VALUES ('owner/repo', 'v1.2.3')"
  );
  await repoClient.end();

  // Seed subscription-db
  const subClient = new pg.Client({ connectionString: SUB_DB_URL });
  await subClient.connect();
  await subClient.query('TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE');
  await subClient.query(
    "INSERT INTO subscriptions (email, repo_name, confirmed, confirm_token, unsubscribe_token) VALUES ('user@example.com', 'owner/repo', true, 'token1', 'token2')"
  );
  await subClient.end();
  
  console.log('Databases seeded successfully!');
}

function startService(name, path, env) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${name}...`);
    const proc = spawn('npx', ['tsx', path], {
      env: { ...process.env, ...env },
      stdio: 'pipe',
      shell: true,
    });

    proc.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('running') || msg.includes('Service running') || msg.includes('Server running')) {
        resolve(proc);
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`[${name} Error]`, data.toString().trim());
    });

    proc.on('error', reject);
  });
}

function runAutocannon() {
  return new Promise((resolve, reject) => {
    console.log('Running autocannon benchmark...');
    const proc = spawn('npx', [
      'autocannon',
      '-j',
      '-c', '20',
      '-d', '5',
      'http://localhost:3000/api/subscriptions?email=user@example.com'
    ], {
      shell: true,
    });

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      console.error('[Autocannon Error]', data.toString().trim());
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Autocannon failed with code ${code}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error(`Failed to parse autocannon JSON: ${err.message}`));
        }
      }
    });
  });
}

async function main() {
  // 1. Start Repo Manager Service (will run gRPC and REST concurrently and run its schema migrations)
  const repoManagerEnv = {
    DATABASE_URL: REPO_DB_URL,
    PORT: '3002',
    GRPC_PORT: '50051',
    AMQP_URL: 'amqp://localhost:5672',
    DB_MIGRATIONS_DIR: 'services/repo-manager-service/src/db/migrations',
  };
  const repoManagerProc = await startService(
    'Repo Manager Service',
    'services/repo-manager-service/server.ts',
    repoManagerEnv
  );

  try {
    // 2. Benchmark REST Mode
    console.log('\n--- Benchmarking REST Mode ---');
    const subEnvREST = {
      DATABASE_URL: SUB_DB_URL,
      PORT: '3000',
      REPO_MANAGER_COMMUNICATION: 'rest',
      REPO_MANAGER_SERVICE_URL: 'http://localhost:3002',
      AMQP_URL: 'amqp://localhost:5672',
      DB_MIGRATIONS_DIR: 'services/subscription-service/src/db/migrations',
    };
    const subProcREST = await startService(
      'Subscription Service (REST)',
      'services/subscription-service/server.ts',
      subEnvREST
    );

    // 3. Now that both services have started and run their migrations, seed the databases!
    await seedDatabases();

    const restResult = await runAutocannon();
    subProcREST.kill();

    // 4. Benchmark gRPC Mode
    console.log('\n--- Benchmarking gRPC Mode ---');
    const subEnvGRPC = {
      DATABASE_URL: SUB_DB_URL,
      PORT: '3000',
      REPO_MANAGER_COMMUNICATION: 'grpc',
      REPO_MANAGER_GRPC_URL: 'localhost:50051',
      AMQP_URL: 'amqp://localhost:5672',
      DB_MIGRATIONS_DIR: 'services/subscription-service/src/db/migrations',
    };
    const subProcGRPC = await startService(
      'Subscription Service (gRPC)',
      'services/subscription-service/server.ts',
      subEnvGRPC
    );

    const grpcResult = await runAutocannon();
    subProcGRPC.kill();

    // 5. Compare Results
    console.log('\n======================================');
    console.log('         BENCHMARK RESULTS            ');
    console.log('======================================');
    console.log(`REST - Avg Latency: ${restResult.latency.average} ms, Requests/sec: ${restResult.requests.average}`);
    console.log(`gRPC - Avg Latency: ${grpcResult.latency.average} ms, Requests/sec: ${grpcResult.requests.average}`);
    console.log('======================================');
    
    const diffRps = ((grpcResult.requests.average - restResult.requests.average) / restResult.requests.average) * 100;
    console.log(`gRPC throughput is ${diffRps.toFixed(2)}% ${diffRps >= 0 ? 'faster' : 'slower'} than REST.`);
  } finally {
    repoManagerProc.kill();
    process.exit(0);
  }
}

main().catch(console.error);

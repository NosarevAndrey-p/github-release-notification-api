import { createApp } from './src/app.js';
import { scan, handleUntrackEvent } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import { AmqpService, OutboxService } from '@shared/amqp';
import { UntrackPayload } from './src/types/amqp.js';
import { logger } from '@shared/logger';
import { config } from './src/config/index.js';
import { ValidatorService } from './src/services/validatorService.js';
import { createGrpcServer } from './src/grpcServer.js';
import * as grpc from '@grpc/grpc-js';

await db.initSchema();

const amqpService = new AmqpService({
  amqpUrl: config.app.amqpUrl,
  logger,
});
await amqpService.connect();

const app = createApp({
  repoStore: db,
  githubService,
  logger,
});

let scannerTimeoutId: NodeJS.Timeout | null = null;
let isShuttingDown = false;

const scannerDeps = { 
  repoStore: db, 
  githubService, 
  logger,
  amqpService,
};

const runScanner = async () => {
  if (isShuttingDown) return;
  try {
    await scan(scannerDeps);
  } catch (error) {
    logger.error('Scanner error:', error);
  } finally {
    if (!isShuttingDown) {
      scannerTimeoutId = setTimeout(runScanner, config.app.scanInterval);
    }
  }
};

const outboxService = new OutboxService({ db, amqpService, logger });
outboxService.start();

await amqpService.setupQueue('repo_manager_untrack_queue', 'repository.untrack');
await amqpService.consume<UntrackPayload>('repo_manager_untrack_queue', async (payload) => {
  await handleUntrackEvent(payload, db, logger);
});

await amqpService.setupQueue('repo_manager_register_queue', 'repository.register');
await amqpService.consume<{ saga_id: string; repo_name: string }>('repo_manager_register_queue', async (payload) => {
  try {
    const { saga_id, repo_name } = payload;
    ValidatorService.validateRepo(repo_name);

    const existing = await db.getRepositoryByFullName(repo_name);
    if (existing) {
      await db.queueOutbox(saga_id, 'repository.registered', {
        saga_id,
        repo_name,
        last_seen_tag: existing.last_seen_tag,
      });
      return;
    }

    await githubService.fetchRepository(repo_name);
    const release = await githubService.fetchLatestRelease(repo_name);

    await db.createRepositoryAndQueueOutbox(saga_id, repo_name, release?.tag_name || null);
  } catch (err) {
    logger.error(`Error processing repository.register for saga ${payload.saga_id}:`, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.queueOutbox(payload.saga_id, 'repository.failed', {
      saga_id: payload.saga_id,
      error: errorMsg,
    });
  }
});

const grpcServer = createGrpcServer(db, logger);
grpcServer.bindAsync(`0.0.0.0:${config.app.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    logger.error('Failed to bind gRPC server:', err);
    return;
  }
  logger.info(`Repo Manager gRPC Server running on port ${port}`);
});

const server = app.listen(config.app.port, () => {
  logger.info(`Repo Manager Service running on port ${config.app.port}`);
  runScanner();
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');
  outboxService.stop();
  isShuttingDown = true;
  if (scannerTimeoutId) {
    clearTimeout(scannerTimeoutId);
    logger.info('Scanner schedule stopped.');
  }

  // Force-exit if shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10_000).unref();

  try {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    logger.info('HTTP server closed.');

    await new Promise<void>((resolve) => {
      grpcServer.tryShutdown(() => {
        logger.info('gRPC server closed.');
        resolve();
      });
    });

    await amqpService.close();
    logger.info('AMQP connection closed.');

    await db.close();
    logger.info('Database connections closed.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

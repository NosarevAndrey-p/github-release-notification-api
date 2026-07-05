import { createApp } from './src/app.js';
import { scan, handleUntrackEvent } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import { AmqpService } from './src/services/amqpService.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';

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

interface UntrackPayload {
  repo_name: string;
}

await amqpService.setupQueue('repo_manager_untrack_queue', 'repository.untrack');
await amqpService.consume<UntrackPayload>('repo_manager_untrack_queue', async (payload) => {
  await handleUntrackEvent(payload, db, logger);
});

const server = app.listen(config.app.port, () => {
  logger.info(`Repo Manager Service running on port ${config.app.port}`);
  runScanner();
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');
  isShuttingDown = true;
  if (scannerTimeoutId) {
    clearTimeout(scannerTimeoutId);
    logger.info('Scanner schedule stopped.');
  }
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await amqpService.close();
      logger.info('AMQP connection closed.');
      await db.close();
      logger.info('Database connections closed.');
    } catch (err) {
      logger.error('Error during database/AMQP close:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

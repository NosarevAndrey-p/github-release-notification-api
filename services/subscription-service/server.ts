import { createApp } from './src/app.js';
import db from './src/db/database.js';
import { EmailService } from './src/services/email/emailService.js';
import { RepoManagerService } from './src/services/repo-manager/repoManagerService.js';
import { AmqpService } from './src/services/amqpService.js';
import { handleReleasePublishedEvent } from './src/services/subscriptionService.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';
import crypto from 'crypto';

await db.initSchema();

const amqpService = new AmqpService({
  amqpUrl: config.app.amqpUrl,
  logger,
});
await amqpService.connect();

const emailService = new EmailService({ 
  amqpService
});

const repoManagerService = new RepoManagerService({
  repoManagerServiceUrl: config.app.repoManagerServiceUrl,
});

const app = createApp({
  subStore: db,
  emailService,
  repoManagerService,
  amqpService,
  logger,
  crypto,
});

const subscriptionDeps = {
  subStore: db,
  emailService,
  repoManagerService,
  amqpService,
  crypto,
  logger,
};

interface ReleasePublishedPayload {
  repo_name: string;
  tag_name: string;
}

await amqpService.setupQueue('scanner_release_queue', 'release.*');
await amqpService.consume<ReleasePublishedPayload>('scanner_release_queue', async (payload) => {
  await handleReleasePublishedEvent(payload, subscriptionDeps);
});

const server = app.listen(config.app.port, () => {
  logger.info(`Subscription Service running on port ${config.app.port}`);
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');

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

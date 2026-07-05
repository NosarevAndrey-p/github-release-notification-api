import { createApp } from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import { EmailService } from './src/services/email/emailService.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';

await db.initSchema();

const emailService = new EmailService({ 
  emailServiceUrl: config.app.emailServiceUrl 
});

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
  emailService,
  logger,
  subscriptionServiceUrl: config.app.subscriptionServiceUrl,
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

const server = app.listen(config.app.port, () => {
  logger.info(`Notification Service running on port ${config.app.port}`);
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
      await db.close();
      logger.info('Database connections closed.');
    } catch (err) {
      logger.error('Error during database close:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

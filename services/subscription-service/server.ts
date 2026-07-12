import { createApp } from './src/app.js';
import db from './src/db/database.js';
import { EmailService } from './src/services/email/emailService.js';
import { NotificationService } from './src/services/notification/notificationService.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';
import crypto from 'crypto';

await db.initSchema();

const emailService = new EmailService({ 
  emailServiceUrl: config.app.emailServiceUrl 
});

const notificationService = new NotificationService({
  notificationServiceUrl: config.app.notificationServiceUrl,
});

const app = createApp({
  subStore: db,
  emailService,
  notificationService,
  logger,
  crypto,
});

const server = app.listen(config.app.port, () => {
  logger.info(`Subscription Service running on port ${config.app.port}`);
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');
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

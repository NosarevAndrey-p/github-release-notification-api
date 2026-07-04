import { createApp } from './src/app.js';
import db from './src/db/database.js';
import { EmailService } from './src/services/email/emailService.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';
import crypto from 'crypto';

await db.initSchema();

const emailService = new EmailService({ 
  emailServiceUrl: config.app.emailServiceUrl 
});

const app = createApp({
  subStore: db,
  emailService,
  logger,
  crypto,
  notificationServiceUrl: config.app.notificationServiceUrl,
});

app.listen(config.app.port, () => {
  logger.info(`Subscription Service running on port ${config.app.port}`);
});

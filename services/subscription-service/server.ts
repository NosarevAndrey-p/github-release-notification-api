import { createApp } from './src/app.js';
import db from './src/db/database.js';
import { EmailService } from './src/services/email/emailService.js';
import { EjsTemplateRenderer } from './src/services/email/templateRenderer.js';
import { NodemailerTransporter } from './src/services/email/emailTransporter.js';
import { logger } from './src/services/loggerService.js';
import { config } from './src/config/index.js';
import crypto from 'crypto';

await db.initSchema();

// Compose EmailService dependencies
const renderer = new EjsTemplateRenderer();
const transporter = new NodemailerTransporter(config.smtp);
const emailService = new EmailService({ 
  renderer, 
  transporter, 
  baseUrl: config.app.baseUrl 
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

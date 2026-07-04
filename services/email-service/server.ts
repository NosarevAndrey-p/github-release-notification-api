import config from './src/config/index.js';
import { logger } from './src/services/loggerService.js';
import { NodemailerTransporter } from './src/services/emailTransporter.js';
import { EjsTemplateRenderer } from './src/services/templateRenderer.js';
import { EmailService } from './src/services/emailService.js';
import { createApp } from './src/app.js';

const transporter = new NodemailerTransporter(config.smtp);
const renderer = new EjsTemplateRenderer();

const emailService = new EmailService({
  transporter,
  renderer,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000', // Points to subscription-service
});

const app = createApp({
  emailService,
  logger,
});

app.listen(config.port, () => {
  logger.info(`Email Service running on port ${config.port}`);
});

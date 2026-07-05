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
  baseUrl: config.baseUrl,
});

const app = createApp({
  emailService,
  logger,
});

const server = app.listen(config.port, () => {
  logger.info(`Email Service running on port ${config.port}`);
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');
  server.close(() => {
    logger.info('HTTP server closed. Shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

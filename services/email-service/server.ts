import config from './src/config/index.js';
import { logger } from '@shared/logger';
import { NodemailerTransporter } from './src/services/emailTransporter.js';
import { EjsTemplateRenderer } from './src/services/templateRenderer.js';
import { EmailService } from './src/services/emailService.js';
import { EmailMessagePayload } from './src/types/email.js';
import { AmqpService } from '@shared/amqp';
import { createApp } from './src/app.js';

const transporter = new NodemailerTransporter(config.smtp);
const renderer = new EjsTemplateRenderer();

const emailService = new EmailService({
  transporter,
  renderer,
  baseUrl: config.baseUrl,
});

const amqpService = new AmqpService({
  amqpUrl: config.amqpUrl,
  logger,
});
await amqpService.connect();


await amqpService.setupQueue('notification_email_queue', 'email.*');
await amqpService.consume<EmailMessagePayload>('notification_email_queue', async (payload) => {
  await emailService.handleEmailMessage(payload);
});

const app = createApp({
  logger,
});

const server = app.listen(config.port, () => {
  logger.info(`Email Service running on port ${config.port}`);
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
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

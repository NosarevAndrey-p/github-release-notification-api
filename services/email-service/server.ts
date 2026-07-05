import config from './src/config/index.js';
import { logger } from './src/services/loggerService.js';
import { NodemailerTransporter } from './src/services/emailTransporter.js';
import { EjsTemplateRenderer } from './src/services/templateRenderer.js';
import { EmailService } from './src/services/emailService.js';
import { AmqpService } from './src/services/amqpService.js';
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

interface EmailMessagePayload {
  type: 'confirmation' | 'notification';
  to: string;
  repo: string;
  confirmToken?: string;
  unsubscribeToken?: string;
  tagName?: string;
}

await amqpService.setupQueue('notification_email_queue', 'email.*');
await amqpService.consume<EmailMessagePayload>('notification_email_queue', async (payload) => {
  if (payload.type === 'confirmation') {
    logger.info(`Consuming confirmation email command for: ${payload.to}`);
    await emailService.sendConfirmationEmail(
      payload.to,
      payload.repo,
      payload.confirmToken || '',
      payload.unsubscribeToken || ''
    );
  } else if (payload.type === 'notification') {
    logger.info(`Consuming release notification email command for: ${payload.to}`);
    await emailService.sendNotificationEmail(
      payload.to,
      payload.repo,
      payload.tagName || '',
      payload.unsubscribeToken || ''
    );
  } else {
    logger.warn(`Unknown email message type received: ${payload.type}`);
  }
});

const app = createApp({
  logger,
});

const server = app.listen(config.port, () => {
  logger.info(`Email Service running on port ${config.port}`);
});

const shutdown = async () => {
  logger.info('Graceful shutdown initiated...');
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await amqpService.close();
      logger.info('AMQP connection closed.');
    } catch (err) {
      logger.error('Error closing AMQP:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

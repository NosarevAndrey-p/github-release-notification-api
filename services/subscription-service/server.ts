import { createApp } from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
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
  repoStore: db,
  subStore: db,
  githubService,
  emailService,
  logger,
  crypto,
});

app.listen(config.app.port, () => {
  logger.info(`Server running on port ${config.app.port}`);

  const scannerDeps = { 
    repoStore: db, 
    subStore: db, 
    githubService, 
    emailService,
    logger
  };

  const runScanner = async () => {
    try {
      await scan(scannerDeps);
    } catch (error) {
      logger.error('Scanner error:', error);
    } finally {
      setTimeout(runScanner, config.app.scanInterval);
    }
  };

  runScanner();
});

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

app.listen(config.app.port, () => {
  logger.info(`Notification Service running on port ${config.app.port}`);

  const scannerDeps = { 
    repoStore: db, 
    githubService, 
    emailService,
    logger,
    subscriptionServiceUrl: config.app.subscriptionServiceUrl,
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

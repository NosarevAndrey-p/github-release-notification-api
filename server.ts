import { createApp } from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import { EmailService } from './src/services/email/emailService.js';
import { EjsTemplateRenderer } from './src/services/email/templateRenderer.js';
import { NodemailerTransporter } from './src/services/email/emailTransporter.js';
import { EmailNotifier } from './src/services/email/emailNotifier.js';
import { config } from './src/config/index.js';

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
});

app.listen(config.app.port, () => {
  console.info(`Server running on port ${config.app.port}`);

  const notifier = new EmailNotifier(emailService);

  const scannerDeps = { 
    repoStore: db, 
    subStore: db, 
    githubService, 
    notifier 
  };

  const runScanner = async () => {
    try {
      await scan(scannerDeps);
    } catch (error) {
      console.error('Scanner error:', error);
    } finally {
      setTimeout(runScanner, config.app.scanInterval);
    }
  };

  runScanner();
});

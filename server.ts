import app from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import emailService from './src/services/email/emailService.js';
import { EmailNotifier } from './src/services/email/emailNotifier.js';
import { config } from './src/config/index.js';

await db.initSchema();

app.listen(config.app.port, () => {
  console.info(`Server running on port ${config.app.port}`);

  const notifier = new EmailNotifier(emailService);

  const scannerDeps = { 
    repoStore: db, 
    subStore: db, 
    githubService, 
    notifier 
  };

  scan(scannerDeps);
  setInterval(() => scan(scannerDeps), config.app.scanInterval);
});

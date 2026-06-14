import app from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import githubService from './src/services/githubService.js';
import emailService from './src/services/emailService.js';
import { EmailNotifier } from './src/services/emailNotifier.js';
import 'dotenv/config';

const scanIntervalMs = Number(process.env.SCAN_INTERVAL) || 60000;
const port = process.env.PORT || 3000;

await db.initSchema();

app.listen(port, () => {
  console.info(`Server running on port ${port}`);

  const notifier = new EmailNotifier(emailService);

  const scannerDeps = { 
    repoStore: db, 
    subStore: db, 
    githubService, 
    notifier 
  };

  scan(scannerDeps);
  setInterval(() => scan(scannerDeps), scanIntervalMs);
});

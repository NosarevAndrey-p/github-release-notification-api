import app from './src/app.js';
import { scan } from './src/services/scannerService.js';
import db from './src/db/database.js';
import { githubRequest } from './src/lib/github.js';
import emailService from './src/services/emailService.js';
import 'dotenv/config';

const scanIntervalMs = Number(process.env.SCAN_INTERVAL) || 60000;
const port = process.env.PORT || 3000;

await db.initSchema();

app.listen(port, () => {
  console.info(`Server running on port ${port}`);

  scan({ db, githubRequest, emailService });
  setInterval(() =>  scan({ db, githubRequest, emailService }), scanIntervalMs);
});
import express, { json, urlencoded } from 'express';
import crypto from 'crypto';
import db from './db/database.js';
import emailService from './services/email/emailService.js';
import githubService from './services/githubService.js';
import createApiRouter from './routes/api.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

const app = express();

app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/api',
  createApiRouter({ 
    repoStore: db, 
    subStore: db, 
    githubService, 
    emailService, 
    crypto 
  })
);

app.use(errorMiddleware);

export default app;

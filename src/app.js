import express, { json, urlencoded } from 'express';
import crypto from 'crypto';
import db from './db/database.js';
import emailService from './services/emailService.js';
import { githubRequest } from './lib/github.js';
import createApiRouter from './routes/api.js';

const app = express();

app.use(json());
app.use(urlencoded({ extended: true }));

app.use(
  '/api',
  createApiRouter({
    db,
    githubRequest,
    emailService,
    crypto,
  })
);

export default app;

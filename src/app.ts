import express, { json, urlencoded } from 'express';
import crypto from 'crypto';
import createApiRouter from './routes/api.js';
import { createErrorMiddleware } from './middleware/errorMiddleware.js';
import { IRepositoryStore, ISubscriptionStore } from './types/database.js';
import { IEmailService } from './types/email.js';
import { IGitHubService } from './types/github.js';
import { ILogger } from './types/logger.js';

interface AppDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  logger: ILogger;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.use('/api',
    createApiRouter({ 
      ...deps,
      crypto 
    })
  );

  app.use(createErrorMiddleware(deps.logger));

  return app;
}

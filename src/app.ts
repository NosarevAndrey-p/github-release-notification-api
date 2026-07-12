import express, { json, urlencoded } from 'express';
import path from 'path';
import client from 'prom-client';
import createApiRouter from './routes/api.js';
import { createErrorMiddleware } from './middleware/errorMiddleware.js';
import { requestLogger } from './middleware/requestLoggerMiddleware.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { IRepositoryStore, ISubscriptionStore } from './types/database.js';
import { IEmailService } from './types/email.js';
import { IGitHubService } from './types/github.js';
import { ILogger } from './types/logger.js';
import { UUIDProvider } from './types/subscription.js';

interface AppDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  logger: ILogger;
  crypto: UUIDProvider;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.set('trust proxy', true);

  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(metricsMiddleware);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  // Serve static files from /public
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use('/api',
    createApiRouter({ 
      ...deps,
    })
  );

  app.use(createErrorMiddleware(deps.logger));

  return app;
}


import express, { json, urlencoded } from 'express';
import client from 'prom-client';
import createApiRouter from './routes/api.js';
import { createErrorMiddleware } from './middleware/errorMiddleware.js';
import { requestLogger } from './middleware/requestLoggerMiddleware.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { IRepositoryStore } from './types/database.js';
import { IGitHubService } from './types/github.js';
import { ILogger } from './types/logger.js';

interface AppDeps {
  repoStore: IRepositoryStore;
  githubService: IGitHubService;
  logger: ILogger;
}

export function createApp(deps: AppDeps) {
  const app = express();

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

  app.use('/api',
    createApiRouter({ 
      repoStore: deps.repoStore,
      githubService: deps.githubService,
    })
  );

  app.use(createErrorMiddleware(deps.logger));

  return app;
}

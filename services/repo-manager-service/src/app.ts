import express, { json, urlencoded } from 'express';
import client from 'prom-client';
import createApiRouter from './routes/api.js';
import { createErrorMiddleware } from './middleware/errorMiddleware.js';
import { requestLogger } from './middleware/requestLoggerMiddleware.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { ILogger } from '@shared/logger';
import { ApiDeps } from './routes/api.js';

export interface AppDeps extends ApiDeps {
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
    createApiRouter({ ...deps })
  );

  app.use(createErrorMiddleware(deps.logger));

  return app;
}

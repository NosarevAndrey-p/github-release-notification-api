import express, { json, urlencoded } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import client from 'prom-client';
import createApiRouter from './routes/api.js';
import { createErrorMiddleware } from './middleware/errorMiddleware.js';
import { requestLogger } from './middleware/requestLoggerMiddleware.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { ApiDeps } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppDeps extends ApiDeps {}

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

  // Serve static files from /public (checking if we are running precompiled code or development source)
  const publicPath = __dirname.includes('dist')
    ? path.resolve(__dirname, '../../public')
    : path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));

  app.use('/api',
    createApiRouter({ 
      ...deps,
    })
  );

  app.use(createErrorMiddleware(deps.logger));

  return app;
}


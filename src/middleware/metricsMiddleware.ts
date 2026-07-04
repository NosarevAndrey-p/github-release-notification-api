import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1.0, 3.0, 5.0, 10.0]
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/metrics' || req.path === '/health') {
    return next();
  }

  const start = performance.now();

  res.on('finish', () => {
    const duration = (performance.now() - start) / 1000;

    // Normalize path to avoid high-cardinality tags (e.g., actual email strings or token UUIDs)
    let route = 'unknown_route';
    if (req.route) {
      const base = req.baseUrl || '';
      route = `${base}${req.route.path}`;
    } else if (res.statusCode === 404) {
      route = 'not_found';
    }

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status: res.statusCode.toString()
      },
      duration
    );
  });

  next();
}

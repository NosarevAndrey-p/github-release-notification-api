import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }

  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
      http: {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration_ms: parseFloat(duration.toFixed(2)),
        ip: req.ip,
        user_agent: req.get('User-Agent') || 'unknown'
      }
    });
  });

  next();
}

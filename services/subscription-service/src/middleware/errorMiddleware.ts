import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors';
import { ILogger } from '@shared/logger';

export function createErrorMiddleware(logger: ILogger) {
  return (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    logger.error('[Unhandled Error]:', err);
    return res.status(500).json({ error: 'internal server error' });
  };
}

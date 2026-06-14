import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.js';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[Unhandled Error]:', err);
  return res.status(500).json({ error: 'internal server error' });
}

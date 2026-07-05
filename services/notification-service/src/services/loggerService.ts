import winston from 'winston';
import path from 'path';
import { ILogger } from '../types/logger.js';

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || path.join(process.cwd(), 'logs'), 'app.log')
    })
  ]
});

export const logger: ILogger = {
  info(message: string, ...args: unknown[]) {
    const meta = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Error)
      ? (args[0] as Record<string, unknown>)
      : { args };
    winstonLogger.info(message, meta);
  },
  warn(message: string, ...args: unknown[]) {
    const meta = args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Error)
      ? (args[0] as Record<string, unknown>)
      : { args };
    winstonLogger.warn(message, meta);
  },
  error(message: string, ...args: unknown[]) {
    const errorArg = args.find((arg) => arg instanceof Error);
    const otherArgs = args.filter((arg) => arg !== errorArg);
    const plainObj = otherArgs.length === 1 && typeof otherArgs[0] === 'object' && otherArgs[0] !== null
      ? (otherArgs[0] as Record<string, unknown>)
      : null;

    if (errorArg) {
      const meta = plainObj ? { error: errorArg, ...plainObj } : { error: errorArg, args: otherArgs };
      winstonLogger.error(message, meta);
    } else {
      const meta = plainObj ? plainObj : { args };
      winstonLogger.error(message, meta);
    }
  }
};

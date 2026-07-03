import { ILogger } from '../types/logger.js';

export const logger: ILogger = {
  info(message: string, ...args: unknown[]) {
    console.info(`[${new Date().toISOString()}]`, message, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(`[${new Date().toISOString()}]`, message, ...args);
  },
  error(message: string, ...args: unknown[]) {
    console.error(`[${new Date().toISOString()}]`, message, ...args);
  }
};

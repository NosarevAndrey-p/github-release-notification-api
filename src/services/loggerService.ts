import { ILogger } from '../types/logger.js';

export const logger: ILogger = {
  info(message: string, ...args: unknown[]) {
    console.info(message, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(message, ...args);
  },
  error(message: string, ...args: unknown[]) {
    console.error(message, ...args);
  }
};

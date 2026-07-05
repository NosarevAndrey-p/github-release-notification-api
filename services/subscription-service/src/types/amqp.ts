import { ILogger } from './logger.js';

export interface AmqpConfig {
  amqpUrl: string;
  logger: ILogger;
}

export interface IAmqpService {
  connect(retries?: number, delay?: number): Promise<void>;
  publish<T>(routingKey: string, payload: T): Promise<void>;
  setupQueue(queueName: string, routingKeyPattern: string): Promise<void>;
  consume<T>(queueName: string, onMessage: (payload: T) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

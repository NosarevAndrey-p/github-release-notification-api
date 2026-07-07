import amqp from 'amqplib';
import { ILogger } from '@shared/logger';

export class AppError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
  }
}

export class AmqpError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export interface AmqpConfig {
  amqpUrl: string;
  logger: ILogger;
  amqpLib?: typeof amqp;
}

export interface IAmqpService {
  connect(retries?: number, delay?: number): Promise<void>;
  publish<T>(routingKey: string, payload: T): Promise<void>;
  setupQueue(queueName: string, routingKeyPattern: string): Promise<void>;
  consume<T>(queueName: string, onMessage: (payload: T) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export class AmqpService implements IAmqpService {
  private url: string;
  private logger: ILogger;
  private amqpLib: typeof amqp;
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchange = 'app_events_exchange';

  constructor({ amqpUrl, logger, amqpLib = amqp }: AmqpConfig) {
    this.url = amqpUrl;
    this.logger = logger;
    this.amqpLib = amqpLib;
  }

  async connect(retries = 5, delay = 2000): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const conn = await this.amqpLib.connect(this.url);
        this.connection = conn;
        this.channel = await conn.createChannel();
        await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
        this.logger.info('Connected to RabbitMQ successfully.');
        return;
      } catch (err) {
        this.logger.error(`RabbitMQ connection attempt ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw new AmqpError('Failed to connect to RabbitMQ after multiple retries.');
  }

  async publish<T>(routingKey: string, payload: T): Promise<void> {
    if (!this.channel) throw new AmqpError('AMQP channel not initialized');
    const content = Buffer.from(JSON.stringify(payload));
    this.channel.publish(this.exchange, routingKey, content, { persistent: true });
    this.logger.info(`AMQP Published message with routing key "${routingKey}"`);
  }

  async setupQueue(queueName: string, routingKeyPattern: string): Promise<void> {
    if (!this.channel) throw new AmqpError('AMQP channel not initialized');
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, this.exchange, routingKeyPattern);
    this.logger.info(`AMQP Setup queue "${queueName}" bound to "${routingKeyPattern}"`);
  }

  async consume<T>(queueName: string, onMessage: (payload: T) => Promise<void>): Promise<void> {
    if (!this.channel) throw new AmqpError('AMQP channel not initialized');
    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as T;
        await onMessage(payload);
        this.channel?.ack(msg);
      } catch (err) {
        this.logger.error(`Error processing message from queue "${queueName}": ${err instanceof Error ? err.message : String(err)}`);
        // Nack with requeue=false to avoid infinite loop
        this.channel?.nack(msg, false, false);
      }
    });
    this.logger.info(`AMQP Started consuming from queue "${queueName}"`);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.info('AMQP Connection closed.');
    } catch (err) {
      this.logger.error('Error closing AMQP connection:', err);
    }
  }
}

export { OutboxService } from './outboxService.js';
export type { IOutboxMessage, IOutboxStore } from './outboxService.js';

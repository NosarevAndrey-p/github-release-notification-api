import { ILogger } from '@shared/logger';
import { IAmqpService } from './index.js';

export interface IOutboxMessage {
  id: number;
  saga_id: string;
  event_type: string;
  payload: unknown;
  processed: boolean;
  created_at: Date;
}

export interface IOutboxStore {
  getUnprocessedOutbox(): Promise<IOutboxMessage[]>;
  markOutboxProcessed(ids: number[]): Promise<void>;
}

export class OutboxService {
  private db: IOutboxStore;
  private amqpService: IAmqpService;
  private logger: ILogger;
  private intervalMs: number;
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    deps: { db: IOutboxStore; amqpService: IAmqpService; logger: ILogger },
    intervalMs = 1000
  ) {
    this.db = deps.db;
    this.amqpService = deps.amqpService;
    this.logger = deps.logger;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Shared Outbox Service started polling.');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.logger.info('Shared Outbox Service stopped polling.');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const messages = await this.db.getUnprocessedOutbox();
      if (messages.length > 0) {
        const processedIds: number[] = [];

        for (const msg of messages) {
          try {
            const routingKey = msg.event_type;
            await this.amqpService.publish(routingKey, msg.payload);
            processedIds.push(msg.id);
          } catch (pubErr) {
            this.logger.error(`Failed to publish outbox message ${msg.id}:`, pubErr);
          }
        }

        if (processedIds.length > 0) {
          await this.db.markOutboxProcessed(processedIds);
        }
      }
    } catch (err) {
      this.logger.error('Error during outbox polling:', err);
    } finally {
      if (this.isRunning) {
        this.timeoutId = setTimeout(() => this.poll(), this.intervalMs);
      }
    }
  }
}

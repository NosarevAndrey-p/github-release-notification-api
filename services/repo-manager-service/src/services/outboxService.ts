import { IDatabaseClient } from '../types/database.js';
import { AmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';
import { IOutboxService } from '../types/outbox.js';

export class OutboxService implements IOutboxService {
  private db: IDatabaseClient;
  private amqpService: AmqpService;
  private logger: ILogger;
  private intervalMs: number;
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(deps: { db: IDatabaseClient; amqpService: AmqpService; logger: ILogger }, intervalMs = 1000) {
    this.db = deps.db;
    this.amqpService = deps.amqpService;
    this.logger = deps.logger;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Outbox Service started polling in repo-manager-service.');
    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.logger.info('Outbox Service stopped polling in repo-manager-service.');
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
            this.logger.error(`Failed to publish outbox message ${msg.id} in repo-manager-service:`, pubErr);
          }
        }

        if (processedIds.length > 0) {
          await this.db.markOutboxProcessed(processedIds);
        }
      }
    } catch (err) {
      this.logger.error('Error during outbox polling in repo-manager-service:', err);
    } finally {
      if (this.isRunning) {
        this.timeoutId = setTimeout(() => this.poll(), this.intervalMs);
      }
    }
  }
}

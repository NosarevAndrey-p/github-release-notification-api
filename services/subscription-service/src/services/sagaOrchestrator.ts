import { SubscriptionDeps, SubscriptionResult } from '../types/subscription.js';
import { IDatabaseClient, Saga } from '../types/database.js';
import { NotFoundError, ServiceError } from '@shared/errors';
import client from 'prom-client';

const sagaDuration = new client.Histogram({
  name: 'saga_duration_seconds',
  help: 'Duration of distributed Saga transactions in seconds',
  labelNames: ['type', 'status'],
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
});

const sagaCount = new client.Counter({
  name: 'saga_total',
  help: 'Total number of Saga transactions executed',
  labelNames: ['type', 'status']
});

interface SagaPromiseResolver {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
  startTime: number;
}

export class SagaRegistry {
  private static resolvers = new Map<string, SagaPromiseResolver>();

  static register(sagaId: string, resolve: (value: unknown) => void, reject: (err: Error) => void, timeoutMs = 10000) {
    const startTime = performance.now();
    const timeoutId = setTimeout(() => {
      const resolver = this.resolvers.get(sagaId);
      if (resolver) {
        this.resolvers.delete(sagaId);
        sagaCount.inc({ type: 'SUBSCRIBE', status: 'timeout' });
        sagaDuration.observe({ type: 'SUBSCRIBE', status: 'timeout' }, (performance.now() - startTime) / 1000);
        resolver.reject(new ServiceError('Saga execution timed out'));
      }
    }, timeoutMs);

    this.resolvers.set(sagaId, { resolve, reject, timeoutId, startTime });
  }

  static resolve(sagaId: string, value: unknown) {
    const resolver = this.resolvers.get(sagaId);
    if (resolver) {
      clearTimeout(resolver.timeoutId);
      this.resolvers.delete(sagaId);
      const duration = (performance.now() - resolver.startTime) / 1000;
      sagaCount.inc({ type: 'SUBSCRIBE', status: 'success' });
      sagaDuration.observe({ type: 'SUBSCRIBE', status: 'success' }, duration);
      resolver.resolve(value);
    }
  }

  static reject(sagaId: string, err: Error) {
    const resolver = this.resolvers.get(sagaId);
    if (resolver) {
      clearTimeout(resolver.timeoutId);
      this.resolvers.delete(sagaId);
      const duration = (performance.now() - resolver.startTime) / 1000;
      const status = err instanceof NotFoundError ? 'not_found' : 'failed';
      sagaCount.inc({ type: 'SUBSCRIBE', status });
      sagaDuration.observe({ type: 'SUBSCRIBE', status }, duration);
      resolver.reject(err);
    }
  }
}

export class SagaOrchestrator {
  static async start(
    email: string,
    repoName: string,
    confirmToken: string,
    unsubscribeToken: string,
    deps: SubscriptionDeps
  ): Promise<{ status: SubscriptionResult }> {
    const db = deps.subStore as unknown as IDatabaseClient;
    const sagaId = deps.crypto.randomUUID();

    const sagaResultPromise = new Promise<{ status: SubscriptionResult }>((resolve, reject) => {
      SagaRegistry.register(sagaId, resolve as (value: unknown) => void, reject);
    });

    await db.startSubscriptionSaga(sagaId, email, repoName, confirmToken, unsubscribeToken);
    return sagaResultPromise;
  }

  static async handleRepoRegistered(
    sagaId: string,
    repoName: string,
    deps: SubscriptionDeps
  ): Promise<void> {
    const db = deps.subStore as unknown as IDatabaseClient;
    const saga = await db.getSaga(sagaId);
    if (!saga || saga.state !== 'STARTED') {
      return;
    }

    try {
      // Step 3 (Orchestration): Send confirmation email (finalizing local step)
      const { email, confirmToken, unsubscribeToken } = saga.payload;
      await deps.emailService.sendConfirmationEmail(email, repoName, confirmToken, unsubscribeToken);

      // Update Saga to completed
      await db.updateSagaState(sagaId, 'COMPLETED', ['Create Subscription', 'Register Repo', 'Send Email']);

      // Resolve the synchronous HTTP request handler
      SagaRegistry.resolve(sagaId, { status: SubscriptionResult.CREATED });
    } catch (err) {
      deps.logger.error(`Saga ${sagaId} failed at email dispatch:`, err);
      // If email fails, we attempt compensation
      await this.rollback(sagaId, saga, deps, err instanceof Error ? err : new Error(String(err)));
    }
  }

  static async handleRepoFailed(
    sagaId: string,
    errorMsg: string,
    deps: SubscriptionDeps
  ): Promise<void> {
    const db = deps.subStore as unknown as IDatabaseClient;
    const saga = await db.getSaga(sagaId);
    if (!saga || saga.state !== 'STARTED') {
      return;
    }

    const err = errorMsg.includes('not found')
      ? new NotFoundError('repository not found')
      : new ServiceError(errorMsg);

    await this.rollback(sagaId, saga, deps, err);
  }

  private static async rollback(
    sagaId: string,
    saga: Saga,
    deps: SubscriptionDeps,
    triggerError: Error
  ): Promise<void> {
    const db = deps.subStore as unknown as IDatabaseClient;
    try {
      await db.updateSagaState(sagaId, 'COMPENSATING', saga.steps_completed);

      // Compensating action C1: Delete the unconfirmed subscription
      const { email, repoName } = saga.payload;
      await db.deleteSubscriptionByEmailAndRepoName(email, repoName);

      // Mark Saga as failed
      await db.updateSagaState(sagaId, 'FAILED', saga.steps_completed);
    } catch (compensateErr) {
      deps.logger.error(`Fatal: compensation failed for Saga ${sagaId}:`, compensateErr);
    } finally {
      // Reject the synchronous HTTP request handler with the initial trigger error
      SagaRegistry.reject(sagaId, triggerError);
    }
  }
}

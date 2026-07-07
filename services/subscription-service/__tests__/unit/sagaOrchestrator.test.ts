import { SagaOrchestrator } from '../../src/services/sagaOrchestrator.js';
import { SubscriptionDeps, SubscriptionResult } from '../../src/types/subscription.js';
import { IDatabaseClient, Saga, Subscription, DatabaseResult } from '../../src/types/database.js';
import { IEmailService } from '../../src/types/email.js';
import { UUIDProvider } from '../../src/types/subscription.js';
import { IRepoManagerService } from '../../src/types/repo-manager.js';
import { AmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';
import { mock, mockReset } from 'jest-mock-extended';
import { NotFoundError } from '../../src/types/errors.js';

describe('SagaOrchestrator', () => {
  const mockDb = mock<IDatabaseClient>();
  const mockEmailService = mock<IEmailService>();
  const mockRepoManagerService = mock<IRepoManagerService>();
  const mockAmqpService = mock<AmqpService>();
  const mockCrypto = mock<UUIDProvider>();
  const mockLogger = mock<ILogger>();

  const mockDeps = {
    subStore: mockDb,
    emailService: mockEmailService,
    repoManagerService: mockRepoManagerService,
    amqpService: mockAmqpService,
    crypto: mockCrypto,
    logger: mockLogger,
  } as unknown as SubscriptionDeps;

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockEmailService);
    mockReset(mockRepoManagerService);
    mockReset(mockAmqpService);
    mockReset(mockCrypto);
    mockReset(mockLogger);
  });

  it('should start Saga and resolve when repository is registered successfully', async () => {
    const sagaId = '12345678-1234-1234-1234-123456789012';
    mockCrypto.randomUUID.mockReturnValue(sagaId);
    mockDb.startSubscriptionSaga.mockResolvedValue({} as Subscription);

    const startPromise = SagaOrchestrator.start(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token',
      mockDeps
    );

    // Mock Saga database retrieval for the handleRepoRegistered call
    const mockSagaRecord: Saga = {
      id: sagaId,
      type: 'SUBSCRIBE',
      state: 'STARTED',
      payload: {
        email: 'test@example.com',
        repoName: 'owner/repo',
        confirmToken: 'confirm-token',
        unsubscribeToken: 'unsub-token',
      },
      steps_completed: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.getSaga.mockResolvedValue(mockSagaRecord);
    mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);
    mockDb.updateSagaState.mockResolvedValue(undefined);

    // Trigger repo registered event asynchronously
    setImmediate(async () => {
      await SagaOrchestrator.handleRepoRegistered(sagaId, 'owner/repo', mockDeps);
    });

    const result = await startPromise;

    expect(result.status).toBe(SubscriptionResult.CREATED);
    expect(mockDb.startSubscriptionSaga).toHaveBeenCalledWith(
      sagaId,
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );
    expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token'
    );
    expect(mockDb.updateSagaState).toHaveBeenCalledWith(sagaId, 'COMPLETED', [
      'Create Subscription',
      'Register Repo',
      'Send Email',
    ]);
  });

  it('should rollback Saga and reject with NotFoundError when repository registration fails', async () => {
    const sagaId = '12345678-1234-1234-1234-123456789012';
    mockCrypto.randomUUID.mockReturnValue(sagaId);
    mockDb.startSubscriptionSaga.mockResolvedValue({} as Subscription);

    const startPromise = SagaOrchestrator.start(
      'test@example.com',
      'owner/repo',
      'confirm-token',
      'unsub-token',
      mockDeps
    );

    const mockSagaRecord: Saga = {
      id: sagaId,
      type: 'SUBSCRIBE',
      state: 'STARTED',
      payload: {
        email: 'test@example.com',
        repoName: 'owner/repo',
        confirmToken: 'confirm-token',
        unsubscribeToken: 'unsub-token',
      },
      steps_completed: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.getSaga.mockResolvedValue(mockSagaRecord);
    mockDb.updateSagaState.mockResolvedValue(undefined);
    mockDb.deleteSubscriptionByEmailAndRepoName.mockResolvedValue({} as DatabaseResult);

    // Trigger repo failed event asynchronously
    setImmediate(async () => {
      await SagaOrchestrator.handleRepoFailed(sagaId, 'repository not found', mockDeps);
    });

    await expect(startPromise).rejects.toThrow(NotFoundError);

    expect(mockDb.updateSagaState).toHaveBeenCalledWith(sagaId, 'COMPENSATING', []);
    expect(mockDb.deleteSubscriptionByEmailAndRepoName).toHaveBeenCalledWith(
      'test@example.com',
      'owner/repo'
    );
    expect(mockDb.updateSagaState).toHaveBeenCalledWith(sagaId, 'FAILED', []);
  });
});

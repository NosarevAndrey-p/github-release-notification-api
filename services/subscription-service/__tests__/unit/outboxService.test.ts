import { OutboxService } from '../../src/services/outboxService.js';
import { IDatabaseClient, OutboxMessage } from '../../src/types/database.js';
import { IAmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';
import { mock, mockReset } from 'jest-mock-extended';
import { jest } from '@jest/globals';

describe('OutboxService', () => {
  const mockDb = mock<IDatabaseClient>();
  const mockAmqp = mock<IAmqpService>();
  const mockLogger = mock<ILogger>();

  let outboxService: OutboxService;

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockAmqp);
    mockReset(mockLogger);
  });

  afterEach(() => {
    if (outboxService) {
      outboxService.stop();
    }
  });

  it('should poll unprocessed outbox records, publish them, and mark them processed', async () => {
    const mockMessages: OutboxMessage[] = [
      {
        id: 1,
        saga_id: 'saga-1',
        event_type: 'repository.register',
        payload: { repo_name: 'owner/repo' },
        processed: false,
        created_at: new Date(),
      },
    ];

    mockDb.getUnprocessedOutbox.mockResolvedValueOnce(mockMessages).mockResolvedValue([]);
    mockAmqp.publish.mockResolvedValue(undefined);
    mockDb.markOutboxProcessed.mockResolvedValue(undefined);

    outboxService = new OutboxService({ db: mockDb, amqpService: mockAmqp, logger: mockLogger }, 10);
    outboxService.start();

    // Wait a brief moment for poll to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockDb.getUnprocessedOutbox).toHaveBeenCalled();
    expect(mockAmqp.publish).toHaveBeenCalledWith('repository.register', { repo_name: 'owner/repo' });
    expect(mockDb.markOutboxProcessed).toHaveBeenCalledWith([1]);
  });
});

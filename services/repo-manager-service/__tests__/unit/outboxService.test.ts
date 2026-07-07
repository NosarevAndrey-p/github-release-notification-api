import { OutboxService } from '../../src/services/outboxService.js';
import { IDatabaseClient, OutboxMessage } from '../../src/types/database.js';
import { AmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';
import { mock, mockReset } from 'jest-mock-extended';

describe('OutboxService in Repo Manager', () => {
  const mockDb = mock<IDatabaseClient>();
  const mockAmqp = mock<AmqpService>();
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
        event_type: 'repository.registered',
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

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockDb.getUnprocessedOutbox).toHaveBeenCalled();
    expect(mockAmqp.publish).toHaveBeenCalledWith('repository.registered', { repo_name: 'owner/repo' });
    expect(mockDb.markOutboxProcessed).toHaveBeenCalledWith([1]);
  });
});

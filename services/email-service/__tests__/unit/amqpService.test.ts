import { jest } from '@jest/globals';
import { mock, mockReset } from 'jest-mock-extended';
import { ILogger } from '../../src/types/logger.js';
import type amqpType from 'amqplib';

// Declare mockConnect first
const mockConnect = jest.fn<() => Promise<amqpType.Connection>>();

// Set up the ESM mock before importing modules
jest.unstable_mockModule('amqplib', () => {
  return {
    __esModule: true,
    default: {
      connect: mockConnect,
    },
    connect: mockConnect,
  };
});

// Dynamically import after registering the mock module
const amqp = await import('amqplib');
const { AmqpService } = await import('../../src/services/amqpService.js');

describe('AmqpService', () => {
  let amqpService: InstanceType<typeof AmqpService>;
  const mockLogger = mock<ILogger>();
  const mockChannel = mock<amqpType.Channel>();
  const mockConnection = mock<amqpType.ChannelModel>();

  beforeEach(() => {
    mockReset(mockLogger);
    mockReset(mockChannel);
    mockReset(mockConnection);
    jest.clearAllMocks();

    mockChannel.assertExchange.mockResolvedValue({ exchange: 'app_events_exchange' });
    mockChannel.assertQueue.mockResolvedValue({ queue: 'test-queue', messageCount: 0, consumerCount: 0 });
    mockChannel.bindQueue.mockResolvedValue({});
    mockChannel.publish.mockReturnValue(true);
    mockChannel.consume.mockResolvedValue({ consumerTag: 'mock-tag' });
    mockChannel.close.mockResolvedValue(undefined);

    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockConnection.close.mockResolvedValue(undefined);

    mockConnect.mockResolvedValue(mockConnection as unknown as amqpType.Connection);

    amqpService = new AmqpService({
      amqpUrl: 'amqp://localhost',
      logger: mockLogger,
    });
  });

  describe('consume', () => {
    beforeEach(async () => {
      await amqpService.connect();
    });

    it('should successfully parse a valid message, invoke callback, and call ack', async () => {
      let consumeCallback: ((msg: amqpType.ConsumeMessage | null) => void | Promise<void>) | null = null;
      mockChannel.consume.mockImplementation(async (_queue: string, callback: (msg: amqpType.ConsumeMessage | null) => void) => {
        consumeCallback = callback;
        return { consumerTag: 'mock-tag' };
      });

      const onMessage = jest.fn<(payload: { value: string }) => Promise<void>>().mockResolvedValue(undefined);
      await amqpService.consume<{ value: string }>('test-queue', onMessage);

      expect(mockChannel.consume).toHaveBeenCalledWith('test-queue', expect.any(Function));
      expect(consumeCallback).not.toBeNull();

      const mockMsg = {
        content: Buffer.from(JSON.stringify({ value: 'hello' })),
      } as amqpType.ConsumeMessage;

      await consumeCallback!(mockMsg);

      expect(onMessage).toHaveBeenCalledWith({ value: 'hello' });
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should nack with requeue=false when parsing or processing throws an error', async () => {
      let consumeCallback: ((msg: amqpType.ConsumeMessage | null) => void | Promise<void>) | null = null;
      mockChannel.consume.mockImplementation(async (_queue: string, callback: (msg: amqpType.ConsumeMessage | null) => void) => {
        consumeCallback = callback;
        return { consumerTag: 'mock-tag' };
      });

      const onMessage = jest.fn<(payload: { value: string }) => Promise<void>>().mockRejectedValue(new Error('Process failed'));
      await amqpService.consume<{ value: string }>('test-queue', onMessage);

      const mockMsg = {
        content: Buffer.from(JSON.stringify({ value: 'hello' })),
      } as amqpType.ConsumeMessage;

      await consumeCallback!(mockMsg);

      expect(onMessage).toHaveBeenCalledWith({ value: 'hello' });
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return early if msg is null', async () => {
      let consumeCallback: ((msg: amqpType.ConsumeMessage | null) => void | Promise<void>) | null = null;
      mockChannel.consume.mockImplementation(async (_queue: string, callback: (msg: amqpType.ConsumeMessage | null) => void) => {
        consumeCallback = callback;
        return { consumerTag: 'mock-tag' };
      });

      const onMessage = jest.fn<(payload: unknown) => Promise<void>>();
      await amqpService.consume<unknown>('test-queue', onMessage);

      await consumeCallback!(null);

      expect(onMessage).not.toHaveBeenCalled();
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });
  });
});

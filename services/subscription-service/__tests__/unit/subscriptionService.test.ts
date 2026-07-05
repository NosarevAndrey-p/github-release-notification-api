import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
  handleReleasePublishedEvent,
} from '../../src/services/subscriptionService.js';
import { SubscriptionDeps, SubscriptionResult } from '../../src/types/subscription.js';
import { mock, mockReset } from 'jest-mock-extended';
import { ISubscriptionStore, Subscription } from '../../src/types/database.js';
import { IEmailService } from '../../src/types/email.js';
import { UUIDProvider } from '../../src/types/subscription.js';
import { IRepoManagerService } from '../../src/types/repo-manager.js';
import { AmqpService } from '@shared/amqp';
import { ILogger } from '@shared/logger';
import { NotFoundError } from '../../src/types/errors.js';

describe('subscriptionService', () => {
  const mockSubStore = mock<ISubscriptionStore>();
  const mockEmailService = mock<IEmailService>();
  const mockRepoManagerService = mock<IRepoManagerService>();
  const mockAmqpService = mock<AmqpService>();
  const mockCrypto = mock<UUIDProvider>();
  const mockLogger = mock<ILogger>();

  const mockDeps: SubscriptionDeps = {
    subStore: mockSubStore,
    emailService: mockEmailService,
    repoManagerService: mockRepoManagerService,
    amqpService: mockAmqpService,
    crypto: mockCrypto,
    logger: mockLogger,
  };

  beforeEach(() => {
    mockReset(mockSubStore);
    mockReset(mockEmailService);
    mockReset(mockRepoManagerService);
    mockReset(mockAmqpService);
    mockReset(mockCrypto);
    mockReset(mockLogger);
  });

  describe('subscribeToRepo', () => {
    it('should subscribe successfully for valid repo and email when notification service responds OK', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue(null);
      mockRepoManagerService.registerRepository.mockResolvedValue(undefined);
      mockCrypto.randomUUID.mockReturnValue('token123');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(result.status).toBe(SubscriptionResult.CREATED);
      expect(mockSubStore.getSubscriptionByEmailAndRepoName).toHaveBeenCalledWith('test@example.com', 'owner/repo');
      expect(mockRepoManagerService.registerRepository).toHaveBeenCalledWith('owner/repo');
      expect(mockSubStore.createSubscription).toHaveBeenCalledWith('test@example.com', 'owner/repo', 'token123', 'token123');
    });

    it('should throw NotFoundError if notification service returns 404', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue(null);
      mockRepoManagerService.registerRepository.mockRejectedValue(new NotFoundError('repository not found'));

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          mockDeps
        )
      ).rejects.toThrow('repository not found');
    });

    it('should throw ConflictError for duplicate confirmed subscription', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        repo_name: 'owner/repo',
        confirmed: true,
        confirm_token: 'token',
        unsubscribe_token: 'unsub',
      });

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          mockDeps
        )
      ).rejects.toThrow('email already subscribed to this repository');
    });

    it('should resend email for unconfirmed subscription', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        repo_name: 'owner/repo',
        confirmed: false,
        confirm_token: 'token',
        unsubscribe_token: 'unsub',
      });
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(result.status).toBe(SubscriptionResult.RESENT);
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
        'token',
        'unsub'
      );
    });
  });

  describe('confirmSubscription', () => {
    it('should confirm subscription successfully', async () => {
      mockSubStore.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, repo_name: 'owner/repo', confirmed: false } as unknown as Subscription);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.CONFIRMED);
      expect(mockSubStore.updateSubscriptionConfirmed).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockSubStore.getSubscriptionByConfirmToken.mockResolvedValue(null);

      await expect(
        confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps)
      ).rejects.toThrow('Token not found');
    });

    it('should return already confirmed message', async () => {
      mockSubStore.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, repo_name: 'owner/repo', confirmed: true } as unknown as Subscription);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.ALREADY_CONFIRMED);
      expect(mockSubStore.updateSubscriptionConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromRepo', () => {
    it('should unsubscribe successfully and publish untrack command if no subscribers left', async () => {
      mockSubStore.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_name: 'owner/repo' } as unknown as Subscription);
      mockSubStore.countSubscriptionsByRepoName.mockResolvedValue(0);
      mockAmqpService.publish.mockResolvedValue(undefined);

      const result = await unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.UNSUBSCRIBED);
      expect(mockSubStore.deleteSubscriptionById).toHaveBeenCalledWith(1);
      expect(mockSubStore.countSubscriptionsByRepoName).toHaveBeenCalledWith('owner/repo');
      expect(mockAmqpService.publish).toHaveBeenCalledWith('repository.untrack', { repo_name: 'owner/repo' });
    });

    it('should unsubscribe successfully and not publish untrack command if subscribers still exist', async () => {
      mockSubStore.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_name: 'owner/repo' } as unknown as Subscription);
      mockSubStore.countSubscriptionsByRepoName.mockResolvedValue(1);

      const result = await unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.UNSUBSCRIBED);
      expect(mockSubStore.deleteSubscriptionById).toHaveBeenCalledWith(1);
      expect(mockSubStore.countSubscriptionsByRepoName).toHaveBeenCalledWith('owner/repo');
      expect(mockAmqpService.publish).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockSubStore.getSubscriptionByUnsubscribeToken.mockResolvedValue(null);

      await expect(
        unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps)
      ).rejects.toThrow('Token not found');
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscriptions for valid email and fetch tags from notification service', async () => {
      const mockSubscriptions = [{ email: 'test@example.com', repo: 'owner/repo', confirmed: true }];
      mockSubStore.getSubscriptionsByEmail.mockResolvedValue(mockSubscriptions);
      mockRepoManagerService.fetchLatestTags.mockResolvedValue({ 'owner/repo': 'v1.0.0' });

      const result = await getSubscriptions('test@example.com', mockDeps);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].last_seen_tag).toBe('v1.0.0');
      expect(mockRepoManagerService.fetchLatestTags).toHaveBeenCalledWith(['owner/repo']);
    });
  });

  describe('handleReleasePublishedEvent', () => {
    it('should query confirmed subscribers and dispatch notification emails', async () => {
      const mockPayload = { repo_name: 'owner/repo', tag_name: 'v2.0.0' };
      const mockConfirmedSubscriptions = [
        { email: 'user1@example.com', unsubscribe_token: 'unsub1' },
        { email: 'user2@example.com', unsubscribe_token: 'unsub2' },
      ];
      mockSubStore.getConfirmedSubscriptionsByRepoName.mockResolvedValue(mockConfirmedSubscriptions);
      mockEmailService.sendNotificationEmail.mockResolvedValue(undefined);

      await handleReleasePublishedEvent(mockPayload, mockDeps);

      expect(mockSubStore.getConfirmedSubscriptionsByRepoName).toHaveBeenCalledWith('owner/repo');
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith('user1@example.com', 'owner/repo', 'v2.0.0', 'unsub1');
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith('user2@example.com', 'owner/repo', 'v2.0.0', 'unsub2');
    });
  });
});

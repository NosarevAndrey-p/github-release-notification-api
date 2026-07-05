import { jest } from '@jest/globals';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../../src/services/subscriptionService.js';
import { SubscriptionDeps, SubscriptionResult } from '../../src/types/subscription.js';
import { mock, mockReset } from 'jest-mock-extended';
import { ISubscriptionStore, Subscription } from '../../src/types/database.js';
import { IEmailService } from '../../src/types/email.js';
import { UUIDProvider } from '../../src/types/subscription.js';

describe('subscriptionService', () => {
  const mockSubStore = mock<ISubscriptionStore>();
  const mockEmailService = mock<IEmailService>();
  const mockCrypto = mock<UUIDProvider>();
  let originalFetch: typeof fetch;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockDeps: SubscriptionDeps = {
    subStore: mockSubStore,
    emailService: mockEmailService,
    crypto: mockCrypto,
    notificationServiceUrl: 'http://localhost:3002',
  };

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    mockReset(mockSubStore);
    mockReset(mockEmailService);
    mockReset(mockCrypto);
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;
  });

  describe('subscribeToRepo', () => {
    it('should subscribe successfully for valid repo and email when notification service responds OK', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }),
      } as unknown as Response);
      mockCrypto.randomUUID.mockReturnValue('token123');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(result.status).toBe(SubscriptionResult.CREATED);
      expect(mockSubStore.getSubscriptionByEmailAndRepoName).toHaveBeenCalledWith('test@example.com', 'owner/repo');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/internal/repositories',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ repo_name: 'owner/repo' }),
        })
      );
      expect(mockSubStore.createSubscription).toHaveBeenCalledWith('test@example.com', 'owner/repo', 'token123', 'token123');
    });

    it('should throw NotFoundError if notification service returns 404', async () => {
      mockSubStore.getSubscriptionByEmailAndRepoName.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        status: 404,
        ok: false,
      } as unknown as Response);

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
      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }),
      } as unknown as Response);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.CONFIRMED);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/internal/repositories',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ repo_name: 'owner/repo' }),
        })
      );
      expect(mockSubStore.updateSubscriptionConfirmed).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockSubStore.getSubscriptionByConfirmToken.mockResolvedValue(null);

      await expect(
        confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps)
      ).rejects.toThrow('Token not found');
    });

    it('should return already confirmed message', async () => {
      mockSubStore.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: true } as unknown as Subscription);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.ALREADY_CONFIRMED);
      expect(mockSubStore.updateSubscriptionConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromRepo', () => {
    it('should unsubscribe successfully', async () => {
      mockSubStore.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_name: 'owner/repo' } as unknown as Subscription);

      const result = await unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.status).toBe(SubscriptionResult.UNSUBSCRIBED);
      expect(mockSubStore.deleteSubscriptionById).toHaveBeenCalledWith(1);
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
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ repo_name: 'owner/repo', last_seen_tag: 'v1.0.0' }),
      } as unknown as Response);

      const result = await getSubscriptions('test@example.com', mockDeps);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].last_seen_tag).toBe('v1.0.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/internal/repositories?repo=owner%2Frepo'
      );
    });
  });
});

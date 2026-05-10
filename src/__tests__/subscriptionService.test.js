import { jest } from '@jest/globals';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../services/subscriptionService.js';

describe('subscriptionService', () => {
  let mockDb;
  let mockGithubRequest;
  let mockEmailService;
  let mockCrypto;

  beforeEach(() => {
    mockDb = {
      getRepositoryByFullName: jest.fn(),
      createRepository: jest.fn(),
      getSubscriptionByEmailAndRepoId: jest.fn(),
      createSubscription: jest.fn(),
      getSubscriptionByConfirmToken: jest.fn(),
      updateSubscriptionConfirmed: jest.fn(),
      getSubscriptionByUnsubscribeToken: jest.fn(),
      deleteSubscriptionById: jest.fn(),
      countSubscriptionsByRepoId: jest.fn(),
      deleteRepositoryById: jest.fn(),
      getSubscriptionsByEmail: jest.fn(),
    };

    mockGithubRequest = jest.fn();
    mockEmailService = {
      sendConfirmationEmail: jest.fn(),
    };
    mockCrypto = {
      randomUUID: jest.fn(),
    };
  });

  describe('subscribeToRepo', () => {
    it('should subscribe successfully for valid repo and email', async () => {
      mockGithubRequest
        .mockResolvedValueOnce({ status: 200, ok: true })
        .mockResolvedValueOnce({ status: 200, ok: true, json: () => ({ tag_name: 'v1.0' }) });
      mockDb.getRepositoryByFullName.mockResolvedValue(null);
      mockDb.createRepository.mockResolvedValue({ id: 1, full_name: 'owner/repo' });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue(null);
      mockCrypto.randomUUID.mockReturnValue('token123');
      mockEmailService.sendConfirmationEmail.mockResolvedValue();

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
      );

      expect(result.message).toBe('subscription successful, confirmation email sent');
      expect(mockDb.createRepository).toHaveBeenCalledWith('owner/repo', 'v1.0');
      expect(mockDb.createSubscription).toHaveBeenCalledWith('test@example.com', 1, 'token123', 'token123');
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith('test@example.com', 'owner/repo', 'token123', 'token123');
    });

    it('should throw BadRequestError for invalid email', async () => {
      await expect(
        subscribeToRepo(
          { email: '', repo: 'owner/repo' },
          { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
        )
      ).rejects.toThrow('email is required');
    });

    it('should throw BadRequestError for invalid repo format', async () => {
      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'invalid' },
          { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
        )
      ).rejects.toThrow('invalid repo format');
    });

    it('should throw NotFoundError for non-existent repo', async () => {
      mockGithubRequest.mockResolvedValue({ status: 404, ok: false });

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
        )
      ).rejects.toThrow('repository not found');
    });

    it('should throw RateLimitError for GitHub rate limit', async () => {
      mockGithubRequest.mockResolvedValue({ status: 429, ok: false });

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
        )
      ).rejects.toThrow('github rate limit exceeded');
    });

    it('should throw ConflictError for duplicate subscription', async () => {
      mockGithubRequest.mockResolvedValue({ status: 200, ok: true });
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo' });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue({ id: 1 });

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          { db: mockDb, githubRequest: mockGithubRequest, emailService: mockEmailService, crypto: mockCrypto }
        )
      ).rejects.toThrow('email already subscribed to this repository');
    });
  });

  describe('confirmSubscription', () => {
    it('should confirm subscription successfully', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 0 });

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', { db: mockDb });

      expect(result.message).toBe('subscription confirmed successfully');
      expect(mockDb.updateSubscriptionConfirmed).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestError for invalid token', async () => {
      await expect(
        confirmSubscription('', { db: mockDb })
      ).rejects.toThrow('token is required');
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue(null);

      await expect(
        confirmSubscription('invalid-token', { db: mockDb })
      ).rejects.toThrow('invalid token');
    });

    it('should return already confirmed message', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 1 });

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', { db: mockDb });

      expect(result.message).toBe('subscription already confirmed');
      expect(mockDb.updateSubscriptionConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromRepo', () => {
    it('should unsubscribe successfully', async () => {
      mockDb.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_id: 1 });
      mockDb.countSubscriptionsByRepoId.mockResolvedValue(0);

      const result = await unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', { db: mockDb });

      expect(result.message).toBe('unsubscribed successfully');
      expect(mockDb.deleteSubscriptionById).toHaveBeenCalledWith(1);
      expect(mockDb.deleteRepositoryById).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestError for invalid token', async () => {
      await expect(
        unsubscribeFromRepo('', { db: mockDb })
      ).rejects.toThrow('token is required');
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockDb.getSubscriptionByUnsubscribeToken.mockResolvedValue(null);

      await expect(
        unsubscribeFromRepo('invalid-token', { db: mockDb })
      ).rejects.toThrow('invalid token');
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscriptions for valid email', async () => {
      const mockSubscriptions = [{ email: 'test@example.com', repo: 'owner/repo', confirmed: true }];
      mockDb.getSubscriptionsByEmail.mockResolvedValue(mockSubscriptions);

      const result = await getSubscriptions('test@example.com', { db: mockDb });

      expect(result).toEqual(mockSubscriptions);
    });

    it('should throw BadRequestError for invalid email', async () => {
      await expect(
        getSubscriptions('', { db: mockDb })
      ).rejects.toThrow('email is required');
    });
  });
});
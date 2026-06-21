import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../services/subscriptionService.js';
import { RateLimitError, NotFoundError } from '../types/errors.js';
import { SubscriptionDeps } from '../types/subscription.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IRepositoryStore, ISubscriptionStore, Subscription } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { IEmailService } from '../types/email.js';
import { UUIDProvider } from '../types/subscription.js';

describe('subscriptionService', () => {
  const mockDb = mock<IRepositoryStore & ISubscriptionStore>();
  const mockGithubService = mock<IGitHubService>();
  const mockEmailService = mock<IEmailService>();
  const mockCrypto = mock<UUIDProvider>();

  const mockDeps: SubscriptionDeps = {
    repoStore: mockDb,
    subStore: mockDb,
    githubService: mockGithubService,
    emailService: mockEmailService,
    crypto: mockCrypto,
  };

  beforeEach(() => {
    mockReset(mockDb);
    mockReset(mockGithubService);
    mockReset(mockEmailService);
    mockReset(mockCrypto);
  });

  describe('subscribeToRepo', () => {
    it('should subscribe successfully for valid repo and email', async () => {
      mockDb.getRepositoryByFullName.mockResolvedValue(null);
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0', html_url: '' });
      mockDb.createRepository.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue(null);
      mockCrypto.randomUUID.mockReturnValue('token123');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(result.message).toBe('subscription successful, confirmation email sent');
      expect(mockDb.getRepositoryByFullName).toHaveBeenCalledWith('owner/repo');
      expect(mockGithubService.fetchRepository).toHaveBeenCalledWith('owner/repo');
      expect(mockDb.createRepository).toHaveBeenCalledWith('owner/repo', 'v1.0');
    });

    it('should skip GitHub API calls if repo is already in database', async () => {
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue(null);
      mockCrypto.randomUUID.mockReturnValue('token123');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(mockDb.getRepositoryByFullName).toHaveBeenCalledWith('owner/repo');
      expect(mockGithubService.fetchRepository).not.toHaveBeenCalled();
      expect(mockGithubService.fetchLatestRelease).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent repo', async () => {
      mockGithubService.fetchRepository.mockRejectedValue(new NotFoundError('repository not found'));

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          mockDeps
        )
      ).rejects.toThrow('repository not found');
    });

    it('should throw RateLimitError for GitHub rate limit', async () => {
      mockGithubService.fetchRepository.mockRejectedValue(new RateLimitError('github rate limit exceeded'));

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          mockDeps
        )
      ).rejects.toThrow('github rate limit exceeded');
    });

    it('should throw ConflictError for duplicate confirmed subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: null });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue({ id: 1, confirmed: 1 } as unknown as Subscription);

      await expect(
        subscribeToRepo(
          { email: 'test@example.com', repo: 'owner/repo' },
          mockDeps
        )
      ).rejects.toThrow('email already subscribed to this repository');
    });

    it('should resend email for unconfirmed subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: null });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue({
        id: 1,
        confirmed: 0,
        confirm_token: 'token',
        unsubscribe_token: 'unsub'
      } as unknown as Subscription);
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const result = await subscribeToRepo(
        { email: 'test@example.com', repo: 'owner/repo' },
        mockDeps
      );

      expect(result.message).toBe('confirmation email resent');
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
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 0 } as unknown as Subscription);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.message).toBe('subscription confirmed successfully');
      expect(mockDb.updateSubscriptionConfirmed).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue(null);

      await expect(
        confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps)
      ).rejects.toThrow('Token not found');
    });

    it('should return already confirmed message', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 1 } as unknown as Subscription);

      const result = await confirmSubscription('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.message).toBe('subscription already confirmed');
      expect(mockDb.updateSubscriptionConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromRepo', () => {
    it('should unsubscribe successfully', async () => {
      mockDb.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_id: 1 } as unknown as Subscription);
      mockDb.countSubscriptionsByRepoId.mockResolvedValue(0);

      const result = await unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps);

      expect(result.message).toBe('unsubscribed successfully');
      expect(mockDb.deleteSubscriptionById).toHaveBeenCalledWith(1);
      expect(mockDb.deleteRepositoryById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundError for non-existent token', async () => {
      mockDb.getSubscriptionByUnsubscribeToken.mockResolvedValue(null);

      await expect(
        unsubscribeFromRepo('12345678-1234-1234-1234-123456789012', mockDeps)
      ).rejects.toThrow('Token not found');
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscriptions for valid email', async () => {
      const mockSubscriptions = [{ email: 'test@example.com', repo: 'owner/repo', confirmed: 1, last_seen_tag: null }];
      mockDb.getSubscriptionsByEmail.mockResolvedValue(mockSubscriptions);

      const result = await getSubscriptions('test@example.com', mockDeps);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
    });
  });
});

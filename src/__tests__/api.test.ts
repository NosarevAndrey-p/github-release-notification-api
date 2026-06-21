import request from 'supertest';
import express, { Express } from 'express';
import createApiRouter from '../routes/api.js';
import { jest } from '@jest/globals';
import { createErrorMiddleware } from '../middleware/errorMiddleware.js';

describe('API Routes', () => {
  let app: Express;

  const mockDb = {
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
  } as any;

  const mockGithubService = {
    fetchRepository: jest.fn(),
    fetchLatestRelease: jest.fn(),
  } as any;

  const mockEmailService = {
    sendConfirmationEmail: jest.fn(),
  } as any;

  const mockCrypto = {
    randomUUID: jest.fn() as any,
  };

  const mockDeps = {
    repoStore: mockDb,
    subStore: mockDb,
    githubService: mockGithubService,
    emailService: mockEmailService,
    crypto: mockCrypto,
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(mockDeps as any));
    app.use(createErrorMiddleware(mockLogger as any));
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 on successful subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0' });
      mockDb.getRepositoryByFullName.mockResolvedValue(null);
      mockDb.createRepository.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: null });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue(null);
      mockCrypto.randomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
      mockEmailService.sendConfirmationEmail.mockResolvedValue({});

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription successful, confirmation email sent');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/subscribe')
        .send({ repo: 'owner/repo' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });

    it('should return 400 for invalid repo format', async () => {
      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid repo format');
    });

    it('should return 404 for non-existent repo', async () => {
      const { NotFoundError } = await import('../types/errors.js');
      mockGithubService.fetchRepository.mockRejectedValue(new NotFoundError('repository not found'));

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('repository not found');
    });

    it('should return 409 for duplicate confirmed subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: null });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue({ id: 1, confirmed: 1 });

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email already subscribed to this repository');
    });

    it('should return 200 and resend email for unconfirmed subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockDb.getRepositoryByFullName.mockResolvedValue({ id: 1, full_name: 'owner/repo', last_seen_tag: null });
      mockDb.getSubscriptionByEmailAndRepoId.mockResolvedValue({
        id: 1,
        confirmed: 0,
        confirm_token: 'token',
        unsubscribe_token: 'unsub'
      });

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('confirmation email resent');
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
        'token',
        'unsub'
      );
    });
  });

  describe('GET /api/confirm/:token', () => {
    it('should return 200 on successful confirmation', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 0 });

      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription confirmed successfully');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app).get('/api/confirm/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });

    it('should return 404 for non-existent token', async () => {
      mockDb.getSubscriptionByConfirmToken.mockResolvedValue(null);

      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Token not found');
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 on successful unsubscription', async () => {
      mockDb.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_id: 1 });
      mockDb.countSubscriptionsByRepoId.mockResolvedValue(0);

      const response = await request(app).get('/api/unsubscribe/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('unsubscribed successfully');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app).get('/api/unsubscribe/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should return subscriptions for valid email', async () => {
      const mockSubscriptions = [{ email: 'test@example.com', repo: 'owner/repo', confirmed: false, last_seen_tag: null }];
      mockDb.getSubscriptionsByEmail.mockResolvedValue(mockSubscriptions);

      const response = await request(app)
        .get('/api/subscriptions')
        .query({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ email: 'test@example.com', repo: 'owner/repo', confirmed: false, last_seen_tag: null }]);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app).get('/api/subscriptions');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });
  });
});

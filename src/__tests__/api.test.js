import request from 'supertest';
import express from 'express';
import createApiRouter from '../routes/api.js';
import { jest } from '@jest/globals';

describe('API Routes', () => {
  let app;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      db: {
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
      },
      githubRequest: jest.fn(),
      emailService: {
        sendConfirmationEmail: jest.fn(),
      },
      crypto: {
        randomUUID: jest.fn(),
      },
    };

    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(mockDeps));
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 on successful subscription', async () => {
      mockDeps.githubRequest.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 123, full_name: 'owner/repo' })
      });
      mockDeps.db.getRepositoryByFullName.mockResolvedValue(null);
      mockDeps.db.createRepository.mockResolvedValue({ id: 1 });
      mockDeps.db.getSubscriptionByEmailAndRepoId.mockResolvedValue(null);
      mockDeps.crypto.randomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
      mockDeps.emailService.sendConfirmationEmail.mockResolvedValue();

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
      mockDeps.githubRequest.mockResolvedValue({ status: 404 });

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('repository not found');
    });

    it('should return 409 for duplicate subscription', async () => {
      mockDeps.githubRequest.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 123, full_name: 'owner/repo' })
      });
      mockDeps.db.getRepositoryByFullName.mockResolvedValue({ id: 1 });
      mockDeps.db.getSubscriptionByEmailAndRepoId.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email already subscribed to this repository');
    });
  });

  describe('GET /api/confirm/:token', () => {
    it('should return 200 on successful confirmation', async () => {
      mockDeps.db.getSubscriptionByConfirmToken.mockResolvedValue({ id: 1, confirmed: 0 });

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
      mockDeps.db.getSubscriptionByConfirmToken.mockResolvedValue(null);

      const response = await request(app).get('/api/confirm/invalid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 on successful unsubscription', async () => {
      mockDeps.db.getSubscriptionByUnsubscribeToken.mockResolvedValue({ id: 1, repo_id: 1 });
      mockDeps.db.countSubscriptionsByRepoId.mockResolvedValue(0);

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
      mockDeps.db.getSubscriptionsByEmail.mockResolvedValue(mockSubscriptions);

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
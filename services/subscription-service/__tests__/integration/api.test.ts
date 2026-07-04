import { jest } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IEmailService } from '../../src/types/email.js';
import { UUIDProvider } from '../../src/types/subscription.js';
import { ILogger } from '../../src/types/logger.js';
import db from '../../src/db/database.js';
import pg from 'pg';

async function seedSubscription(params: {
  email?: string;
  repo: string;
  confirmToken?: string;
  unsubscribeToken?: string;
}) {
  const email = params.email ?? 'test@example.com';
  const confirmToken = params.confirmToken ?? '12345678-1234-1234-1234-123456789012';
  const unsubscribeToken = params.unsubscribeToken ?? '22345678-1234-1234-1234-123456789012';

  return await db.createSubscription(email, params.repo, confirmToken, unsubscribeToken);
}

describe('API Routes (Integration)', () => {
  let app: Express;
  let testPool: pg.Pool;
  let originalFetch: typeof fetch;
  let mockFetch: jest.Mock<any>;

  const mockEmailService = mock<IEmailService>();
  const mockCrypto = mock<UUIDProvider>();
  const mockLogger = mock<ILogger>();

  beforeAll(async () => {
    testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    originalFetch = global.fetch;
  });

  afterAll(async () => {
    await testPool.end();
    await db.close();
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    mockReset(mockEmailService);
    mockReset(mockCrypto);
    mockReset(mockLogger);

    mockFetch = jest.fn();
    global.fetch = mockFetch as any;

    // Truncate only subscriptions table (repositories table is split out)
    await testPool.query('TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE');

    app = createApp({
      subStore: db,
      emailService: mockEmailService,
      logger: mockLogger,
      crypto: mockCrypto,
      notificationServiceUrl: 'http://localhost:3002',
    });
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 on successful subscription', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        ok: true,
        json: async () => ({ id: 1, full_name: 'owner/repo', last_seen_tag: 'v1.0' }),
      });
      mockCrypto.randomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription successful, confirmation email sent');

      // Verify data is inserted in the real database
      const subResult = await testPool.query('SELECT * FROM subscriptions WHERE email = $1', ['test@example.com']);
      expect(subResult.rows).toHaveLength(1);
      expect(subResult.rows[0].confirmed).toBe(false);
      expect(subResult.rows[0].repo_name).toBe('owner/repo');
      expect(subResult.rows[0].confirm_token).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/subscribe')
        .send({ repo: 'owner/repo' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });

    it('should return 400 for missing repo', async () => {
      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('repo is required');
    });

    it('should return 400 for invalid repo format', async () => {
      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid repo format');
    });

    it('should return 404 for non-existent repo', async () => {
      mockFetch.mockResolvedValue({
        status: 404,
        ok: false,
      });

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Repository not found on GitHub');

      // Verify no records were inserted
      const subs = await testPool.query('SELECT COUNT(*) FROM subscriptions');
      expect(Number(subs.rows[0].count)).toBe(0);
    });

    it('should return 409 for duplicate confirmed subscription', async () => {
      const sub = await seedSubscription({ repo: 'owner/repo' });
      await db.updateSubscriptionConfirmed(sub.id);

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email already subscribed to this repository');
    });

    it('should return 200 and resend email for unconfirmed subscription', async () => {
      await seedSubscription({ repo: 'owner/repo' });
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('confirmation email resent');
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'owner/repo',
        '12345678-1234-1234-1234-123456789012',
        '22345678-1234-1234-1234-123456789012'
      );
    });
  });

  describe('GET /api/confirm/:token', () => {
    it('should return 200 on successful confirmation', async () => {
      await seedSubscription({ repo: 'owner/repo' });

      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription confirmed successfully');

      const result = await testPool.query('SELECT confirmed FROM subscriptions WHERE email = $1', ['test@example.com']);
      expect(result.rows[0].confirmed).toBe(true);
    });

    it('should return 200 and already confirmed message if subscription is already confirmed', async () => {
      const sub = await seedSubscription({ repo: 'owner/repo' });
      await db.updateSubscriptionConfirmed(sub.id);

      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription already confirmed');
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app).get('/api/confirm/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });

    it('should return 404 for non-existent token', async () => {
      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789000');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Token not found');
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 on successful unsubscription', async () => {
      await seedSubscription({ repo: 'owner/repo' });

      const response = await request(app).get('/api/unsubscribe/22345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('unsubscribed successfully');

      const subs = await testPool.query('SELECT COUNT(*) FROM subscriptions');
      expect(Number(subs.rows[0].count)).toBe(0);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app).get('/api/unsubscribe/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });

    it('should return 404 for non-existent unsubscribe token', async () => {
      const response = await request(app).get('/api/unsubscribe/22345678-1234-1234-1234-123456789000');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Token not found');
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should return subscriptions for valid email', async () => {
      const sub = await seedSubscription({ repo: 'owner/repo' });
      await db.updateSubscriptionConfirmed(sub.id);

      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ repo_name: 'owner/repo', last_seen_tag: 'v1.0.0' }),
      });

      const response = await request(app)
        .get('/api/subscriptions')
        .query({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { email: 'test@example.com', repo: 'owner/repo', confirmed: true, last_seen_tag: 'v1.0.0' }
      ]);
    });

    it('should return empty array for email with no subscriptions', async () => {
      const response = await request(app)
        .get('/api/subscriptions')
        .query({ email: 'nosubs@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app).get('/api/subscriptions');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .get('/api/subscriptions')
        .query({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid email format');
    });
  });

  describe('GET /api/internal/subscriptions', () => {
    it('should return confirmed subscriptions for a repository', async () => {
      const sub = await seedSubscription({ repo: 'owner/repo', email: 'user1@example.com' });
      await db.updateSubscriptionConfirmed(sub.id);
      
      const pendingSub = await seedSubscription({ repo: 'owner/repo', email: 'user2@example.com', confirmToken: 'pending-token', unsubscribeToken: 'pending-unsub' });

      const response = await request(app)
        .get('/api/internal/subscriptions')
        .query({ repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe('user1@example.com');
      expect(response.body[0].unsubscribe_token).toBe('22345678-1234-1234-1234-123456789012');
    });
  });
});

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IEmailService } from '../../src/types/email.js';
import { IGitHubService } from '../../src/types/github.js';
import { UUIDProvider } from '../../src/types/subscription.js';
import { ILogger } from '../../src/types/logger.js';
import db from '../../src/db/database.js';
import pg from 'pg';

async function seedRepository(fullName = 'owner/repo', lastSeenTag: string | null = null) {
  return await db.createRepository(fullName, lastSeenTag);
}

async function seedSubscription(params: {
  email?: string;
  repoId: number;
  confirmToken?: string;
  unsubscribeToken?: string;
}) {
  const email = params.email ?? 'test@example.com';
  const confirmToken = params.confirmToken ?? '12345678-1234-1234-1234-123456789012';
  const unsubscribeToken = params.unsubscribeToken ?? '22345678-1234-1234-1234-123456789012';

  return await db.createSubscription(email, params.repoId, confirmToken, unsubscribeToken);
}

describe('API Routes (Integration)', () => {
  let app: Express;
  let testPool: pg.Pool;

  const mockGithubService = mock<IGitHubService>();
  const mockEmailService = mock<IEmailService>();
  const mockCrypto = mock<UUIDProvider>();
  const mockLogger = mock<ILogger>();

  beforeAll(async () => {
    // Connect to the test database for truncation helper
    testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    // Clean up connections
    await testPool.end();
    await db.close();
  });

  beforeEach(async () => {
    mockReset(mockGithubService);
    mockReset(mockEmailService);
    mockReset(mockCrypto);
    mockReset(mockLogger);

    // Truncate tables and restart IDs between tests for isolation
    await testPool.query('TRUNCATE TABLE subscriptions, repositories RESTART IDENTITY CASCADE');

    app = createApp({
      repoStore: db,
      subStore: db,
      githubService: mockGithubService,
      emailService: mockEmailService,
      logger: mockLogger,
      crypto: mockCrypto,
    });
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 on successful subscription', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0', html_url: '' });
      mockCrypto.randomUUID.mockReturnValue('12345678-1234-1234-1234-123456789012');
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription successful, confirmation email sent');

      // Verify data is inserted in the real database
      const repoResult = await testPool.query('SELECT * FROM repositories WHERE full_name = $1', ['owner/repo']);
      expect(repoResult.rows).toHaveLength(1);
      expect(repoResult.rows[0].last_seen_tag).toBe('v1.0');

      const subResult = await testPool.query('SELECT * FROM subscriptions WHERE email = $1', ['test@example.com']);
      expect(subResult.rows).toHaveLength(1);
      expect(subResult.rows[0].confirmed).toBe(false);
      expect(subResult.rows[0].confirm_token).toBe('12345678-1234-1234-1234-123456789012');
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
      const { NotFoundError } = await import('../../src/types/errors.js');
      mockGithubService.fetchRepository.mockRejectedValue(new NotFoundError('repository not found'));

      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('repository not found');

      // Verify no records were inserted
      const repos = await testPool.query('SELECT COUNT(*) FROM repositories');
      expect(Number(repos.rows[0].count)).toBe(0);
    });

    it('should return 409 for duplicate confirmed subscription', async () => {
      // 1. Setup existing database state
      const repo = await seedRepository();
      const sub = await seedSubscription({ repoId: repo.id });
      await db.updateSubscriptionConfirmed(sub.id);

      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });

      // 2. Call endpoint
      const response = await request(app)
        .post('/api/subscribe')
        .send({ email: 'test@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('email already subscribed to this repository');
    });

    it('should return 200 and resend email for unconfirmed subscription', async () => {
      // 1. Setup unconfirmed subscription in DB
      const repo = await seedRepository();
      await seedSubscription({ repoId: repo.id });

      mockGithubService.fetchRepository.mockResolvedValue({ id: 123, full_name: 'owner/repo' });
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);

      // 2. Call endpoint
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
      // 1. Setup database
      const repo = await seedRepository();
      await seedSubscription({ repoId: repo.id });

      // 2. Call endpoint
      const response = await request(app).get('/api/confirm/12345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('subscription confirmed successfully');

      // Verify confirmed status in real DB
      const result = await testPool.query('SELECT confirmed FROM subscriptions WHERE email = $1', ['test@example.com']);
      expect(result.rows[0].confirmed).toBe(true);
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
      // 1. Setup database
      const repo = await seedRepository();
      await seedSubscription({ repoId: repo.id });

      // 2. Call endpoint
      const response = await request(app).get('/api/unsubscribe/22345678-1234-1234-1234-123456789012');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('unsubscribed successfully');

      // Verify deletion in DB (both subscription and repository since it was the last subscription)
      const subs = await testPool.query('SELECT COUNT(*) FROM subscriptions');
      expect(Number(subs.rows[0].count)).toBe(0);

      const repos = await testPool.query('SELECT COUNT(*) FROM repositories');
      expect(Number(repos.rows[0].count)).toBe(0);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app).get('/api/unsubscribe/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid token');
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should return subscriptions for valid email', async () => {
      // 1. Setup database
      const repo = await seedRepository('owner/repo', 'v1.0.0');
      const sub = await seedSubscription({ repoId: repo.id });
      await db.updateSubscriptionConfirmed(sub.id);

      // 2. Call endpoint
      const response = await request(app)
        .get('/api/subscriptions')
        .query({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { email: 'test@example.com', repo: 'owner/repo', confirmed: true, last_seen_tag: 'v1.0.0' }
      ]);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app).get('/api/subscriptions');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email is required');
    });
  });
});

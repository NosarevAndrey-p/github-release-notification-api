import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app.js';
import { mock, mockReset } from 'jest-mock-extended';
import { IGitHubService } from '../../src/types/github.js';
import { ILogger } from '../../src/types/logger.js';
import db from '../../src/db/database.js';
import pg from 'pg';

describe('API Routes (Notification Service Integration)', () => {
  let app: Express;
  let testPool: pg.Pool;

  const mockGithubService = mock<IGitHubService>();
  const mockLogger = mock<ILogger>();

  beforeAll(async () => {
    testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await testPool.end();
    await db.close();
  });

  beforeEach(async () => {
    mockReset(mockGithubService);
    mockReset(mockLogger);

    // Truncate repositories table
    await testPool.query('TRUNCATE TABLE repositories RESTART IDENTITY CASCADE');

    app = createApp({
      repoStore: db,
      githubService: mockGithubService,
      logger: mockLogger,
    });
  });

  describe('POST /api/internal/repositories', () => {
    it('should create and return repository when it does not exist', async () => {
      mockGithubService.fetchRepository.mockResolvedValue({ id: 12345, full_name: 'owner/repo' });
      mockGithubService.fetchLatestRelease.mockResolvedValue({ tag_name: 'v1.0.0', html_url: '' });

      const response = await request(app)
        .post('/api/internal/repositories')
        .send({ repo_name: 'owner/repo' });

      expect(response.status).toBe(201);
      expect(response.body.full_name).toBe('owner/repo');
      expect(response.body.last_seen_tag).toBe('v1.0.0');

      // Verify db insertion
      const result = await testPool.query('SELECT * FROM repositories WHERE full_name = $1', ['owner/repo']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].last_seen_tag).toBe('v1.0.0');
    });

    it('should return existing repository without calling GitHub API', async () => {
      // Seed repository
      await db.createRepository('owner/repo', 'v1.0.0');

      const response = await request(app)
        .post('/api/internal/repositories')
        .send({ repo_name: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.full_name).toBe('owner/repo');
      expect(response.body.last_seen_tag).toBe('v1.0.0');
      expect(mockGithubService.fetchRepository).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid repo format', async () => {
      const response = await request(app)
        .post('/api/internal/repositories')
        .send({ repo_name: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid repo format');
    });
  });

  describe('GET /api/internal/repositories', () => {
    it('should return repository details if tracked', async () => {
      await db.createRepository('owner/repo', 'v1.1.0');

      const response = await request(app)
        .get('/api/internal/repositories')
        .query({ repo: 'owner/repo' });

      expect(response.status).toBe(200);
      expect(response.body.repo_name).toBe('owner/repo');
      expect(response.body.last_seen_tag).toBe('v1.1.0');
    });

    it('should return 404 if repository is not tracked', async () => {
      const response = await request(app)
        .get('/api/internal/repositories')
        .query({ repo: 'owner/repo' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Repository not tracked');
    });
  });
});

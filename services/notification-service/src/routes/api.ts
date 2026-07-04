import express from 'express';
import { IRepositoryStore } from '../types/database.js';
import { IGitHubService } from '../types/github.js';
import { ValidatorService } from '../services/validatorService.js';

interface ApiDeps {
  repoStore: IRepositoryStore;
  githubService: IGitHubService;
}

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  // POST /api/internal/repositories
  // Registers a repository if it doesn't exist, validating it against GitHub first
  apiRouter.post('/internal/repositories', async (req, res, next) => {
    try {
      const { repo_name } = req.body;
      ValidatorService.validateRepo(repo_name);

      const existing = await deps.repoStore.getRepositoryByFullName(repo_name);
      if (existing) {
        return res.status(200).json(existing);
      }

      // Check existence and get latest release from GitHub
      await deps.githubService.fetchRepository(repo_name);
      const release = await deps.githubService.fetchLatestRelease(repo_name);

      const created = await deps.repoStore.createRepository(repo_name, release?.tag_name || null);
      return res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/internal/repositories
  // Returns repository details (like last_seen_tag)
  apiRouter.get('/internal/repositories', async (req, res, next) => {
    try {
      const repoName = req.query.repo as string;
      ValidatorService.validateRepo(repoName);

      const repo = await deps.repoStore.getRepositoryByFullName(repoName);
      if (!repo) {
        return res.status(404).json({ error: 'Repository not tracked' });
      }

      return res.status(200).json({
        repo_name: repo.full_name,
        last_seen_tag: repo.last_seen_tag,
      });
    } catch (err) {
      next(err);
    }
  });

  return apiRouter;
}

export default createApiRouter;

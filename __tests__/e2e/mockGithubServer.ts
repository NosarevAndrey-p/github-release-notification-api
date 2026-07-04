import express from 'express';
import { Server } from 'http';

interface MockRepo {
  id: number;
  full_name: string;
}

interface MockRelease {
  tag_name: string;
  html_url: string;
}

class MockGithubServer {
  private app: express.Express;
  private server: Server | null = null;
  private port = 3002;
  
  // In-memory mock storage
  private repos: Map<string, MockRepo | null> = new Map();
  private releases: Map<string, MockRelease | null> = new Map();

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    // Route: Get Repository Info
    this.app.get('/repos/:owner/:repo', (req, res) => {
      const repoKey = `${req.params.owner}/${req.params.repo}`.toLowerCase();
      
      if (this.repos.has(repoKey)) {
        const repo = this.repos.get(repoKey);
        if (repo === null) {
          return res.status(404).json({ message: 'Not Found' });
        }
        return res.status(200).json(repo);
      }
      
      // Default fallback response
      return res.status(200).json({
        id: Math.floor(Math.random() * 100000),
        full_name: `${req.params.owner}/${req.params.repo}`
      });
    });

    // Route: Get Latest Release
    this.app.get('/repos/:owner/:repo/releases/latest', (req, res) => {
      const repoKey = `${req.params.owner}/${req.params.repo}`.toLowerCase();
      
      if (this.releases.has(repoKey)) {
        const release = this.releases.get(repoKey);
        if (release === null) {
          return res.status(404).json({ message: 'Not Found' });
        }
        return res.status(200).json(release);
      }
      
      // Default fallback response
      return res.status(200).json({
        tag_name: 'v1.0.0',
        html_url: `https://github.com/${req.params.owner}/${req.params.repo}/releases/tag/v1.0.0`
      });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.info(`[Mock GitHub Server] Running on port ${this.port}`);
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.info('[Mock GitHub Server] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Helper APIs for tests
  public setRepo(repoName: string, id: number | null) {
    const key = repoName.toLowerCase();
    if (id === null) {
      this.repos.set(key, null);
    } else {
      this.repos.set(key, { id, full_name: repoName });
    }
  }

  public setLatestRelease(repoName: string, tagName: string | null) {
    const key = repoName.toLowerCase();
    if (tagName === null) {
      this.releases.set(key, null);
    } else {
      this.releases.set(key, {
        tag_name: tagName,
        html_url: `https://github.com/${repoName}/releases/tag/${tagName}`
      });
    }
  }

  public reset() {
    this.repos.clear();
    this.releases.clear();
  }
}

export const mockGithub = new MockGithubServer();

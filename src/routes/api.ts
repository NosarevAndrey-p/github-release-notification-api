import express from 'express';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../services/subscriptionService.js';
import { IRepositoryStore, ISubscriptionStore } from '../types/database.js';
import { IEmailService } from '../types/email.js';
import { IGitHubService } from '../types/github.js';

interface ApiDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  crypto: {
    randomUUID: () => string;
  };
}

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  apiRouter.post('/subscribe', async (req, res) => {
    const result = await subscribeToRepo(
      {
        email: req.body.email,
        repo: req.body.repo,
      },
      deps
    );

    return res.status(200).json(result);
  });

  apiRouter.get('/confirm/:token', async (req, res) => {
    const result = await confirmSubscription(req.params.token, deps);
    return res.status(200).json(result);
  });

  apiRouter.get('/unsubscribe/:token', async (req, res) => {
    const result = await unsubscribeFromRepo(req.params.token, deps);
    return res.status(200).json(result);
  });

  apiRouter.get('/subscriptions', async (req, res) => {
    const result = await getSubscriptions(req.query.email as string, deps);
    return res.status(200).json(result);
  });

  return apiRouter;
}

export default createApiRouter;

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
import { ValidatorService } from '../services/validatorService.js';
import { UUIDProvider } from '../types/subscription.js';

interface ApiDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  crypto: UUIDProvider;
}

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  apiRouter.post('/subscribe', async (req, res) => {
    const { email, repo } = req.body;
    ValidatorService.validateEmail(email);
    ValidatorService.validateRepo(repo);

    const result = await subscribeToRepo({ email, repo }, deps);
    return res.status(200).json(result);
  });

  apiRouter.get('/confirm/:token', async (req, res) => {
    const { token } = req.params;
    ValidatorService.validateToken(token);

    const result = await confirmSubscription(token, deps);
    return res.status(200).json(result);
  });

  apiRouter.get('/unsubscribe/:token', async (req, res) => {
    const { token } = req.params;
    ValidatorService.validateToken(token);

    const result = await unsubscribeFromRepo(token, deps);
    return res.status(200).json(result);
  });

  apiRouter.get('/subscriptions', async (req, res) => {
    const email = req.query.email as string;
    ValidatorService.validateEmail(email);

    const result = await getSubscriptions(email, deps);
    return res.status(200).json(result);
  });

  return apiRouter;
}

export default createApiRouter;

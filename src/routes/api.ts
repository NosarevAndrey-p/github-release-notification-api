import express, { Response as ExpressResponse } from 'express';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../services/subscriptionService.js';
import { AppError } from '../types/errors.js';
import { IDatabaseClient } from '../types/database.js';
import { IEmailService } from '../types/email.js';
import { GithubRequest } from '../types/github.js';

interface ApiDeps {
  db: IDatabaseClient;
  githubRequest: GithubRequest;
  emailService: IEmailService;
  crypto: {
    randomUUID: () => string;
  };
}

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  function handleError(res: ExpressResponse, error: unknown) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'internal server error' });
  }

  apiRouter.post('/subscribe', async (req, res) => {
    try {
      const result = await subscribeToRepo(
        {
          email: req.body.email,
          repo: req.body.repo,
        },
        deps
      );

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  });

  apiRouter.get('/confirm/:token', async (req, res) => {
    try {
      const result = await confirmSubscription(req.params.token, deps);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  });

  apiRouter.get('/unsubscribe/:token', async (req, res) => {
    try {
      const result = await unsubscribeFromRepo(req.params.token, deps);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  });

  apiRouter.get('/subscriptions', async (req, res) => {
    try {
      const result = await getSubscriptions(req.query.email as string, deps);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  });

  return apiRouter;
}

export default createApiRouter;


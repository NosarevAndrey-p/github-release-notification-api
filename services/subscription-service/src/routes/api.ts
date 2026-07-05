import express from 'express';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
} from '../services/subscriptionService.js';
import { ValidatorService } from '../services/validatorService.js';
import { SubscriptionResult, SubscriptionDeps } from '../types/subscription.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApiDeps extends SubscriptionDeps {}

const SUBSCRIPTION_MESSAGES = {
  [SubscriptionResult.CREATED]: 'subscription successful, confirmation email sent',
  [SubscriptionResult.RESENT]: 'confirmation email resent',
  [SubscriptionResult.CONFIRMED]: 'subscription confirmed successfully',
  [SubscriptionResult.ALREADY_CONFIRMED]: 'subscription already confirmed',
  [SubscriptionResult.UNSUBSCRIBED]: 'unsubscribed successfully',
} as const;

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  apiRouter.post('/subscribe', async (req, res, next) => {
    try {
      const { email, repo } = req.body;
      ValidatorService.validateEmail(email);
      ValidatorService.validateRepo(repo);

      const result = await subscribeToRepo({ email, repo }, deps);
      return res.status(200).json({ message: SUBSCRIPTION_MESSAGES[result.status] });
    } catch (err) {
      next(err);
    }
  });

  apiRouter.get('/confirm/:token', async (req, res, next) => {
    try {
      const { token } = req.params;
      ValidatorService.validateToken(token);

      const result = await confirmSubscription(token, deps);
      return res.status(200).json({ message: SUBSCRIPTION_MESSAGES[result.status] });
    } catch (err) {
      next(err);
    }
  });

  apiRouter.get('/unsubscribe/:token', async (req, res, next) => {
    try {
      const { token } = req.params;
      ValidatorService.validateToken(token);

      const result = await unsubscribeFromRepo(token, deps);
      return res.status(200).json({ message: SUBSCRIPTION_MESSAGES[result.status] });
    } catch (err) {
      next(err);
    }
  });

  apiRouter.get('/subscriptions', async (req, res, next) => {
    try {
      const email = req.query.email as string;
      ValidatorService.validateEmail(email);

      const result = await getSubscriptions(email, deps);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Internal API for Notification Service (Scanner)
  apiRouter.get('/internal/subscriptions', async (req, res, next) => {
    try {
      const repo = req.query.repo as string;
      ValidatorService.validateRepo(repo);

      const result = await deps.subStore.getConfirmedSubscriptionsByRepoName(repo);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return apiRouter;
}

export default createApiRouter;

import express from 'express';
import {
  subscribeToRepo,
  confirmSubscription,
  unsubscribeFromRepo,
  getSubscriptions,
  AppError,
} from '../services/subscriptionService.js';

function createApiRouter(deps) {
  const apiRouter = express.Router();

  function handleError(res, error) {
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
      const result = await getSubscriptions(req.query.email, deps);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  });

  return apiRouter;
}

export default createApiRouter; 
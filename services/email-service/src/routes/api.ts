import express from 'express';
import { IEmailService } from '../types/email.js';
import { BadRequestError } from '../types/errors.js';

interface ApiDeps {
  emailService: IEmailService;
}

function createApiRouter(deps: ApiDeps) {
  const apiRouter = express.Router();

  apiRouter.post('/internal/send-email', async (req, res, next) => {
    try {
      const { type, to, repo, confirmToken, unsubscribeToken, tagName } = req.body;

      if (!type || !to || !repo || !unsubscribeToken) {
        throw new BadRequestError('Missing required fields for email sending');
      }

      if (type === 'confirmation') {
        if (!confirmToken) {
          throw new BadRequestError('confirmToken is required for confirmation email');
        }
        await deps.emailService.sendConfirmationEmail(
          to,
          repo,
          confirmToken,
          unsubscribeToken
        );
      } else if (type === 'notification') {
        if (!tagName) {
          throw new BadRequestError('tagName is required for notification email');
        }
        await deps.emailService.sendNotificationEmail(
          to,
          repo,
          tagName,
          unsubscribeToken
        );
      } else {
        throw new BadRequestError(`Invalid email type: ${type}`);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return apiRouter;
}

export default createApiRouter;

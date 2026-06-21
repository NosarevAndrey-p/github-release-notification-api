import { INotifier } from '../../types/notification.js';
import { IEmailService } from '../../types/email.js';
import { Subscription } from '../../types/database.js';
import { ILogger } from '../../types/logger.js';

export class EmailNotifier implements INotifier {
  constructor(
    private emailService: IEmailService,
    private logger: ILogger
  ) {}

  async notify(repo: string, newTag: string, subscriptions: Subscription[]): Promise<void> {
    const notifications = subscriptions.map(sub =>
      this.emailService.sendNotificationEmail(
        sub.email,
        repo,
        newTag,
        sub.unsubscribe_token
      ).catch(error => {
        this.logger.error(`Failed to email ${sub.email} for ${repo}:`, error);
      })
    );

    await Promise.all(notifications);
  }
}

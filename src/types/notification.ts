import { Subscription } from './database.js';

export interface INotifier {
  notify(repo: string, newTag: string, subscriptions: Subscription[]): Promise<void>;
}

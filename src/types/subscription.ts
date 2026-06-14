import { UserSubscription } from './database.js';
import DatabaseClient from '../db/databaseClient.js';
import { IEmailService } from './emailService.js';
import { GithubRequest } from './github.js';

export interface UUIDProvider {
  randomUUID: () => string;
}

export interface SubscriptionDeps {
  db: DatabaseClient;
  githubRequest: GithubRequest;
  emailService: IEmailService;
  crypto: UUIDProvider;
}

export default class Subscription {
  public email: string;
  public repo: string;
  public confirmed: boolean;
  public last_seen_tag: string | null;

  constructor({ email, repo, confirmed, last_seen_tag }: UserSubscription) {
    this.email = email;
    this.repo = repo;
    this.confirmed = Boolean(confirmed);
    this.last_seen_tag = last_seen_tag;
  }
}

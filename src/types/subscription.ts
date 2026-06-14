import { UserSubscription, IRepositoryStore, ISubscriptionStore } from './database.js';
import { IEmailService } from './email.js';
import { IGitHubService } from './github.js';

export interface UUIDProvider {
  randomUUID: () => string;
}

export interface SubscriptionDeps {
  repoStore: IRepositoryStore;
  subStore: ISubscriptionStore;
  githubService: IGitHubService;
  emailService: IEmailService;
  crypto: UUIDProvider;
}

export default class SubscriptionModel {
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


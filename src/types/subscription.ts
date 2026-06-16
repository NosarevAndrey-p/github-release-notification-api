import { IRepositoryStore, ISubscriptionStore } from './database.js';
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

  constructor(data: {
    email: string;
    repo: string;
    confirmed: number | boolean;
    last_seen_tag: string | null;
  }) {
    this.email = data.email;
    this.repo = data.repo;
    this.confirmed = Boolean(data.confirmed);
    this.last_seen_tag = data.last_seen_tag;
  }
}


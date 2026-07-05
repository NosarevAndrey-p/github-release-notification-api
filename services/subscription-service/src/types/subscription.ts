import { ISubscriptionStore } from './database.js';
import { IEmailService } from './email.js';
import { IRepoManagerService } from './repo-manager.js';
import { ILogger } from '@shared/logger';

export enum SubscriptionResult {
  CREATED = 'subscription.created',
  RESENT = 'subscription.resent',
  CONFIRMED = 'subscription.confirmed',
  ALREADY_CONFIRMED = 'subscription.already_confirmed',
  UNSUBSCRIBED = 'subscription.unsubscribed',
}

export interface UUIDProvider {
  randomUUID: () => string;
}

import { IAmqpService } from '@shared/amqp';

export interface SubscriptionDeps {
  subStore: ISubscriptionStore;
  emailService: IEmailService;
  repoManagerService: IRepoManagerService;
  amqpService: IAmqpService;
  crypto: UUIDProvider;
  logger: ILogger;
}

export default class SubscriptionModel {
  public email: string;
  public repo: string;
  public confirmed: boolean;
  public last_seen_tag: string | null;

  constructor(data: {
    email: string;
    repo: string;
    confirmed: boolean;
    last_seen_tag: string | null;
  }) {
    this.email = data.email;
    this.repo = data.repo;
    this.confirmed = data.confirmed;
    this.last_seen_tag = data.last_seen_tag;
  }
}

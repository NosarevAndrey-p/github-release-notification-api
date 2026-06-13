import { UserSubscription } from '../db/databaseClient.js';

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

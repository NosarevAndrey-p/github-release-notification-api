export interface Subscription {
  id: number;
  email: string;
  repo_name: string;
  confirmed: boolean;
  confirm_token: string;
  unsubscribe_token: string;
}

export interface UserSubscriptionRow {
  email: string;
  repo: string;
  confirmed: boolean;
}

export interface UserSubscription extends UserSubscriptionRow {
  last_seen_tag: string | null;
}

export interface ConfirmedSubscription {
  email: string;
  unsubscribe_token: string;
}

export interface DatabaseResult {
  rowCount?: number | null;
  rows?: unknown[];
}

export interface ISubscriptionStore {
  getSubscriptionByEmailAndRepoName(email: string, repoName: string): Promise<Subscription | null>;
  createSubscription(
    email: string,
    repoName: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<Subscription>;
  getSubscriptionByConfirmToken(token: string): Promise<Subscription | null>;
  updateSubscriptionConfirmed(id: number): Promise<DatabaseResult>;
  getSubscriptionByUnsubscribeToken(token: string): Promise<Subscription | null>;
  deleteSubscriptionById(id: number): Promise<DatabaseResult>;
  countSubscriptionsByRepoName(repoName: string): Promise<number>;
  getSubscriptionsByEmail(email: string): Promise<UserSubscriptionRow[]>;
  getConfirmedSubscriptionsByRepoName(repoName: string): Promise<ConfirmedSubscription[]>;
}

export interface IDatabaseClient extends ISubscriptionStore {
  initSchema(): Promise<void> | void;
  close(): Promise<void>;
}

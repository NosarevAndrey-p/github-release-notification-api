export interface Repository {
  id: number;
  full_name: string;
  last_seen_tag: string | null;
}

export interface Subscription {
  id: number;
  email: string;
  repo_id: number;
  confirmed: number;
  confirm_token: string;
  unsubscribe_token: string;
}

export interface UserSubscription {
  email: string;
  repo: string;
  confirmed: number;
  last_seen_tag: string | null;
}

export interface DatabaseResult {
  rowCount?: number | null;
  lastInsertRowid?: number | bigint;
  rows?: unknown[];
}

export interface IDatabaseClient {
  initSchema(): Promise<void> | void;
  getRepositoryByFullName(fullName: string): Promise<Repository | null>;
  createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository>;
  getSubscriptionByEmailAndRepoId(email: string, repoId: number): Promise<Subscription | null>;
  createSubscription(
    email: string,
    repoId: number,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<DatabaseResult>;
  getSubscriptionByConfirmToken(token: string): Promise<Subscription | null>;
  updateSubscriptionConfirmed(id: number): Promise<DatabaseResult>;
  getSubscriptionByUnsubscribeToken(token: string): Promise<Subscription | null>;
  deleteSubscriptionById(id: number): Promise<DatabaseResult>;
  countSubscriptionsByRepoId(repoId: number): Promise<number>;
  deleteRepositoryById(id: number): Promise<DatabaseResult>;
  getSubscriptionsByEmail(email: string): Promise<UserSubscription[]>;
  getConfirmedRepositories(): Promise<Repository[]>;
  getConfirmedSubscriptionsByRepoId(repoId: number): Promise<Subscription[]>;
  updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult>;
}

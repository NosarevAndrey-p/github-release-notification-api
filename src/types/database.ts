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

export interface IRepositoryStore {
  getRepositoryByFullName(fullName: string): Promise<Repository | null>;
  createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository>;
  getConfirmedRepositories(): Promise<Repository[]>;
  updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult>;
  deleteRepositoryById(id: number): Promise<DatabaseResult>;
}

export interface ISubscriptionStore {
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
  getSubscriptionsByEmail(email: string): Promise<UserSubscription[]>;
  getConfirmedSubscriptionsByRepoId(repoId: number): Promise<Subscription[]>;
}

export interface IDatabaseClient extends IRepositoryStore, ISubscriptionStore {
  initSchema(): Promise<void> | void;
}

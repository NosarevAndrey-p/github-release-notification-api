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
  rows?: any[];
}

/**
 * Abstract database client contract.
 *
 * This class defines the interface that concrete database client implementations
 * must fulfill. It is not meant to be instantiated directly.
 */
export default abstract class DatabaseClient {
  /**
   * Initialize or migrate the database schema.
   */
  abstract initSchema(): Promise<void> | void;

  /**
   * Find a repository by full name.
   */
  abstract getRepositoryByFullName(fullName: string): Promise<Repository | null>;

  /**
   * Create repository tracking state.
   */
  abstract createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository>;

  /**
   * Get a subscription by email and repository.
   */
  abstract getSubscriptionByEmailAndRepoId(email: string, repoId: number): Promise<Subscription | null>;

  /**
   * Create a new subscription.
   */
  abstract createSubscription(
    email: string,
    repoId: number,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<DatabaseResult>;

  /**
   * Get a subscription by confirmation token.
   */
  abstract getSubscriptionByConfirmToken(token: string): Promise<Subscription | null>;

  /**
   * Mark subscription as confirmed.
   */
  abstract updateSubscriptionConfirmed(id: number): Promise<DatabaseResult>;

  /**
   * Get a subscription by unsubscribe token.
   */
  abstract getSubscriptionByUnsubscribeToken(token: string): Promise<Subscription | null>;

  /**
   * Delete a subscription by ID.
   */
  abstract deleteSubscriptionById(id: number): Promise<DatabaseResult>;

  /**
   * Count subscriptions for a repository.
   */
  abstract countSubscriptionsByRepoId(repoId: number): Promise<number>;

  /**
   * Delete a repository record by ID.
   */
  abstract deleteRepositoryById(id: number): Promise<DatabaseResult>;

  /**
   * List subscriptions for an email.
   */
  abstract getSubscriptionsByEmail(email: string): Promise<UserSubscription[]>;

  /**
   * List confirmed repositories.
   */
  abstract getConfirmedRepositories(): Promise<Repository[]>;

  /**
   * Get confirmed subscriptions for a repository.
   */
  abstract getConfirmedSubscriptionsByRepoId(repoId: number): Promise<Subscription[]>;

  /**
   * Update repository last seen tag.
   */
  abstract updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult>;
}

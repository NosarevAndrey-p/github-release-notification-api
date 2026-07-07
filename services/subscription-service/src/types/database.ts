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

export interface Saga {
  id: string;
  type: string;
  state: string;
  payload: {
    email: string;
    repoName: string;
    confirmToken: string;
    unsubscribeToken: string;
  };
  steps_completed: string[];
  created_at: Date;
  updated_at: Date;
}

export interface OutboxMessage {
  id: number;
  saga_id: string;
  event_type: string;
  payload: unknown;
  processed: boolean;
  created_at: Date;
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
  deleteSubscriptionByEmailAndRepoName(email: string, repoName: string): Promise<DatabaseResult>;
}

export interface IDatabaseClient extends ISubscriptionStore {
  initSchema(): Promise<void> | void;
  close(): Promise<void>;
  startSubscriptionSaga(
    sagaId: string,
    email: string,
    repoName: string,
    confirmToken: string,
    unsubscribeToken: string
  ): Promise<Subscription>;
  getSaga(id: string): Promise<Saga | null>;
  updateSagaState(id: string, state: string, stepsCompleted: string[]): Promise<void>;
  getUnprocessedOutbox(): Promise<OutboxMessage[]>;
  markOutboxProcessed(ids: number[]): Promise<void>;
}

export interface Repository {
  id: number;
  full_name: string;
  last_seen_tag: string | null;
}

export interface DatabaseResult {
  rowCount?: number | null;
  rows?: unknown[];
}

export interface OutboxMessage {
  id: number;
  saga_id: string;
  event_type: string;
  payload: unknown;
  processed: boolean;
  created_at: Date;
}

export interface IRepositoryStore {
  getRepositoryByFullName(fullName: string): Promise<Repository | null>;
  getRepositoriesByFullNames(fullNames: string[]): Promise<Repository[]>;
  createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository>;
  getConfirmedRepositories(): Promise<Repository[]>;
  updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult>;
  deleteRepositoryById(id: number): Promise<DatabaseResult>;
}

export interface IDatabaseClient extends IRepositoryStore {
  initSchema(): Promise<void> | void;
  close(): Promise<void>;
  createRepositoryAndQueueOutbox(
    sagaId: string,
    fullName: string,
    lastSeenTag: string | null
  ): Promise<Repository>;
  queueOutbox(sagaId: string, eventType: string, payload: unknown): Promise<void>;
  getUnprocessedOutbox(): Promise<OutboxMessage[]>;
  markOutboxProcessed(ids: number[]): Promise<void>;
}

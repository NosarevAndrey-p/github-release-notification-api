export interface Repository {
  id: number;
  full_name: string;
  last_seen_tag: string | null;
}

export interface DatabaseResult {
  rowCount?: number | null;
  rows?: unknown[];
}

export interface IRepositoryStore {
  getRepositoryByFullName(fullName: string): Promise<Repository | null>;
  createRepository(fullName: string, lastSeenTag: string | null): Promise<Repository>;
  getConfirmedRepositories(): Promise<Repository[]>;
  updateRepositoryLastSeenTag(repoId: number, lastSeenTag: string | null): Promise<DatabaseResult>;
  deleteRepositoryById(id: number): Promise<DatabaseResult>;
}

export interface IDatabaseClient extends IRepositoryStore {
  initSchema(): Promise<void> | void;
  close(): Promise<void>;
}

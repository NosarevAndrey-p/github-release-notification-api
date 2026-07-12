export interface RepoManagerDeps {
  repoManagerServiceUrl: string;
}

export interface IRepoManagerService {
  fetchLatestTag(repoName: string): Promise<string | null>;
  fetchLatestTags(repoNames: string[]): Promise<Record<string, string | null>>;
}

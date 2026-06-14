export type GithubRequest = (path: string) => Promise<Response>;

export interface GithubDeps {
  githubRequest: GithubRequest;
}

export interface GithubRepoInfo {
  id: number;
  full_name: string;
}

export interface GithubReleaseInfo {
  tag_name: string;
  html_url: string;
}

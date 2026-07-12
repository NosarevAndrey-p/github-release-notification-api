export interface NotificationDeps {
  notificationServiceUrl: string;
}

export interface INotificationService {
  registerRepository(repoName: string): Promise<void>;
  fetchLatestTag(repoName: string): Promise<string | null>;
  fetchLatestTags(repoNames: string[]): Promise<Record<string, string | null>>;
}

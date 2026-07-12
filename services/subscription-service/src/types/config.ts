export interface AppConfig {
  port: number;
  scanInterval: number;
  repoManagerServiceUrl: string;
  emailServiceUrl: string;
  amqpUrl: string;
}

export interface DatabaseConfig {
  url: string;
  migrationsDirectory: string;
}

export interface GithubConfig {
  apiUrl: string;
  token?: string;
}

export interface Config {
  app: AppConfig;
  db: DatabaseConfig;
  github: GithubConfig;
}

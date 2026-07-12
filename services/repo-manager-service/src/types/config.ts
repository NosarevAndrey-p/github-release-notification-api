export interface AppConfig {
  port: number;
  grpcPort: number;
  scanInterval: number;
  subscriptionServiceUrl: string;
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

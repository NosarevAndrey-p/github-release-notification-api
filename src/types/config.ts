export interface AppConfig {
  port: number;
  scanInterval: number;
  baseUrl: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
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
  smtp: SmtpConfig;
  db: DatabaseConfig;
  github: GithubConfig;
}

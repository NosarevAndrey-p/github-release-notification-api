export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface Config {
  port: number;
  smtp: SmtpConfig;
}

import dotenv from 'dotenv';
import { Config } from '../types/config.js';

dotenv.config();

const config: Config = {
  port: Number(process.env.PORT) || 3003,
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

export default config;

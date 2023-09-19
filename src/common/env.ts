import { Log } from './Log';

const origin = (): string | string[] => {
  if (!process.env.ORIGIN) {
    Log.warn("ORIGIN is not provided in .env. '*' will be used by default.");
    return '*';
  }
  if (process.env.ORIGIN.startsWith('[')) {
    return JSON.parse(process.env.ORIGIN);
  }
  return process.env.ORIGIN;
};

export default {
  DEV_MODE: process.env.DEV_MODE === 'true',
  PORT: parseInt(process.env.PORT as string),
  JWT_SECRET: process.env.JWT_SECRET as string,
  DATABASE_URL: process.env.DATABASE_URL as string,
  REDIS_HOST: process.env.REDIS_HOST as string,
  REDIS_PORT: parseInt(process.env.REDIS_PORT as string),
  REDIS_PASS: process.env.REDIS_PASS as string,
  ORIGIN: origin(),
  NERIMITY_CDN: process.env.NERIMITY_CDN as string,
  NERIMITY_CDN_SECRET: process.env.NERIMITY_CDN_SECRET as string,

  MAX_CHANNELS_PER_SERVER: parseInt(
    process.env.MAX_CHANNELS_PER_SERVER || '0'
  ) as number,
  MAX_INVITES_PER_SERVER: parseInt(
    process.env.MAX_INVITES_PER_SERVER || '0'
  ) as number,
  MAX_ROLES_PER_SERVER: parseInt(
    process.env.MAX_ROLES_PER_SERVER || '0'
  ) as number,

  DEFAULT_SERVER_ROLE_COLOR: process.env.DEFAULT_SERVER_ROLE_COLOR as string,

  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET as string,

  SMTP_SERVICE: process.env.SMTP_SERVICE as string,
  SMTP_USER: process.env.SMTP_USER as string,
  SMTP_PASS: process.env.SMTP_PASS as string,
  SMTP_FROM: process.env.SMTP_FROM as string,
};

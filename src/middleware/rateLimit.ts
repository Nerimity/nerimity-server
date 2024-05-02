import { NextFunction, Request, Response } from 'express';
import { checkAndUpdateRateLimit } from '../cache/RateLimitCache';
import { generateError } from '../common/errorHandler';
import env from '../common/env';
import { Log } from '../common/Log';

interface Options {
  name: string;

  requests: number;
  perMS?: number;
  restrictMS: number;

  useIP?: boolean; // By default, use user id.
  globalLimit?: boolean;
  nextIfRatedLimited?: boolean; // false by default
  message?: string;
}

if (env.DEV_MODE) {
  Log.warn('Rate limit is disabled in dev mode');
}

export function rateLimit(opts: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (env.DEV_MODE) {
      return next();
    }

    const ip = req.userIP.replace(/:/g, '=');

    let id = '';

    if (!opts.globalLimit) {
      id = opts.useIP ? ip : req.userCache?.id;
      if (opts.name) {
        id = `${id}-${opts.name}`;
      }
    }

    if (opts.globalLimit) {
      id = opts.name;
    }

    const ttl = await checkAndUpdateRateLimit({
      id,
      requests: opts.requests,
      perMS: opts.perMS ?? opts.restrictMS,
      restrictMS: opts.restrictMS,
    });

    if (ttl && opts.nextIfRatedLimited) {
      req.rateLimited = ttl as number;
      return next();
    }

    if (ttl) {
      return res
        .status(429)
        .json({ ...generateError(opts.message || 'Slow down!'), ttl });
    }

    next();
  };
}
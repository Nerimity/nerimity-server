import { NextFunction, Request, Response } from 'express';
import { authenticateUser } from '../cache/UserCache';
import { generateError } from '../common/errorHandler';

interface Options {
  allowBot?: boolean;
  allowNoToken?: boolean;
}

export function authenticate(opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const t1 = performance.now();
    const token = req.header('Authorization');
    if (!token) {
      if (opts?.allowNoToken) {
        return next();
      }
      return res.status(401).json(generateError('No token provided.'));
    }

    const [cachedUser, error] = await authenticateUser(token, req.userIP);
    if (error !== null) {
      return res.status(401).json(generateError(error.message));
    }
    if (!opts?.allowBot && cachedUser.bot) {
      return res.status(401).json(generateError('Bots are not allowed to use this route.'));
    }
    req.userCache = cachedUser;
    res.setHeader('T-auth-took', (performance.now() - t1).toFixed(2) + 'ms');
    next();
  };
}

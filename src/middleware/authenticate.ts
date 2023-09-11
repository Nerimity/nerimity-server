import { NextFunction, Request, Response } from 'express';
import { authenticateUser } from '../cache/UserCache';
import { generateError } from '../common/errorHandler';

interface Options {
  allowBot?: boolean;
}

export function authenticate(opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json(generateError('No token provided.'));
    }

    const [cachedAccount, error] = await authenticateUser(token, req.userIP);
    if (error !== null) {
      return res.status(401).json(generateError(error.message));
    }
    if (!opts?.allowBot && cachedAccount.user.bot) {
      return res
        .status(401)
        .json(generateError('Bots are not allowed to use this route.'));
    }
    req.accountCache = cachedAccount;
    next();
  };
}

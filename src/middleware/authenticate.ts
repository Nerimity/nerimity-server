import { NextFunction, Request, Response } from 'express';
import { authenticateUser } from '../cache/UserCache';
import { generateError } from '../common/errorHandler';

interface Options {
  allowBot?: boolean;
}

export async function authenticate (opts: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json(generateError('No token provided.'));
    }
  
    const [cachedAccount, error] = await authenticateUser(token);
    if (error || !cachedAccount) {
      return res.status(401).json(generateError(error));
    }
    req.accountCache = cachedAccount;
    next();
  };
}

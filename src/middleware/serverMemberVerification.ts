import { NextFunction, Request, Response } from 'express';
import { getServerCache } from '../cache/ServerCache';
import { getServerMemberCache } from '../cache/ServerMemberCache';
import { generateError } from '../common/errorHandler';

interface Options {
  allowBot?: boolean;
}


// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Options {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function serverMemberVerification (opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { serverId } = req.params;

    const [memberCache, error] = await getServerMemberCache(serverId, req.accountCache.user.id);
    if (error !== null) {
      return res.status(403).json(generateError(error));
    }

    const server = await getServerCache(serverId);
    if (server === null) {
      return res.status(403).json(generateError('Server does not exist.'));
    }

    req.serverMemberCache = memberCache;
    req.serverCache = server;

    next();

  };
}
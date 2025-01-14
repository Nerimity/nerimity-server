import { NextFunction, Request, Response } from 'express';
import { getServerCache } from '../cache/ServerCache';
import { getServerMemberCache } from '../cache/ServerMemberCache';
import { generateError } from '../common/errorHandler';

interface Options {
  allowBot?: boolean;
  ignoreScheduledDeletion?: boolean;
}

export function serverMemberVerification(opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { serverId } = req.params;

    const [memberCache, error] = await getServerMemberCache(serverId, req.userCache.id);
    if (error !== null) {
      return res.status(403).json(generateError(error));
    }

    const server = await getServerCache(serverId);
    if (server === null) {
      return res.status(403).json(generateError('Server does not exist.'));
    }

    if (!opts?.ignoreScheduledDeletion && server.scheduledForDeletion) {
      return res.status(403).json(generateError('This server is scheduled for deletion.'));
    }

    req.serverMemberCache = memberCache;
    req.serverCache = server;

    next();
  };
}

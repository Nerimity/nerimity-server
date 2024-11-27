import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';
import { hasBit, ROLE_PERMISSIONS } from '../common/Bitwise';

interface Options {
  bit: number;
  invert?: boolean; // doesn't have permission
  message: string;
}

export function channelPermissions(opts: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.channelCache.server) return next();
    if (req.serverCache.createdById === req.userCache.id) return next();

    const rolePerms = req.serverMemberCache.permissions;

    if (hasBit(rolePerms, ROLE_PERMISSIONS.ADMIN.bit)) {
      return next();
    }

    const permissions = req.channelCache.permissions;

    if (opts.invert) {
      if (hasBit(permissions, opts.bit)) {
        return res.status(403).json(generateError(opts.message));
      }
    }
    if (!opts.invert) {
      if (!hasBit(permissions, opts.bit)) {
        return res.status(403).json(generateError(opts.message));
      }
    }

    next();
  };
}

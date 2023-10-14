import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';
import { hasBit, Bitwise, ROLE_PERMISSIONS } from '../common/Bitwise';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Options {
  ignoreAdmin?: boolean,
  continueOnError?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function memberHasRolePermissionMiddleware(permission: Bitwise, opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const [status, errorMessage] = memberHasRolePermission(req, permission, opts);
    if (errorMessage) {
      if (opts?.continueOnError) {
        req.errorMessage = errorMessage;
        return next();
      }
      return res.status(403).json(generateError(errorMessage));
    }

    if (status) {
      return next();
    }
  };
}

export function memberHasRolePermission(req: Request, permission: Bitwise, opts?: Omit<Options, 'continueOnError'>) {

  if (!req.serverCache) {
    return [true, null] as const
  }

  if (req.serverCache.createdById === req.serverMemberCache.userId) {
    return [true, null] as const
  }

  const memberPermissions = req.serverMemberCache.permissions;

  if (!opts?.ignoreAdmin && hasBit(memberPermissions, ROLE_PERMISSIONS.ADMIN.bit)) {
    return [true, null] as const
  }

  if (!hasBit(memberPermissions, permission.bit)) {
    return [null, `Missing ${permission.name} permission`] as const;
  }
  return [true, null] as const;
}
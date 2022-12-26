import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';
import { hasBit, Bitwise, ROLE_PERMISSIONS } from '../common/Bitwise';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Options {
  ignoreAdmin?: boolean,
  continueOnError?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function memberHasRolePermission (permission: Bitwise, opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {

    if (!req.serverCache) {
      return next();
    }

    if (req.serverCache.createdById === req.serverMemberCache.userId) {
      return next();
    }


    
    const memberPermissions = req.serverMemberCache.permissions;
    
    if (!opts?.ignoreAdmin && hasBit(memberPermissions, ROLE_PERMISSIONS.ADMIN.bit)) {
      return next();      
    }
    if (!hasBit(memberPermissions, permission.bit)) {
      const errorMessage = `Missing ${permission.name} permission`;
      if (opts?.continueOnError) {
        req.errorMessage = errorMessage;
        return next();
      }
      return res.status(403).json(generateError(errorMessage));
    }

    next();
  };
}
import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';
import { hasBit, Bitwise, ROLE_PERMISSIONS } from '../common/Bitwise';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Options {
  ignoreAdmin: boolean
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
    if (!hasBit(memberPermissions, permission.bit)){
      return res.status(403).json(generateError(`Missing ${permission.name} permission`));
    }

    next();
  };
}
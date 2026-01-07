import { NextFunction, Request, Response } from 'express';
import { USER_BADGES, hasBit } from '../../common/Bitwise';
import { generateError } from '../../common/errorHandler';

export function isModMiddleware(opts?: { allowModBadge?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const badges = req.userCache.badges;
    const isCreator = hasBit(badges, USER_BADGES.FOUNDER.bit);
    const isAdmin = hasBit(badges, USER_BADGES.ADMIN.bit);
    const isMod = hasBit(badges, USER_BADGES.MOD.bit);
    req.hasAdminOrCreatorBadge = isCreator || isAdmin;

    if (opts?.allowModBadge && isMod) {
      next();
      return;
    }

    if (!req.hasAdminOrCreatorBadge) {
      return res.status(403).json(generateError('Admin access only!'));
    }
    next();
  };
}

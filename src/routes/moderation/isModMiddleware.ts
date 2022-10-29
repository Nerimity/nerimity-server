import { NextFunction, Request, Response } from 'express';
import { USER_BADGES, hasBit } from '../../common/Bitwise';
import { generateError } from '../../common/errorHandler';

export function isModMiddleware(req: Request, res: Response, next: NextFunction){
  const badges = req.accountCache.user.badges;
  const isCreator = hasBit(badges, USER_BADGES.CREATOR.bit);
  if (!isCreator) {
    return res.status(403).json(generateError('Admin access only!'));
  }
  next();
}
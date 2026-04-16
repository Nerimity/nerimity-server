import { userAgentToDeviceType } from '@src/services/User/UserManagement';
import { Request, Response, NextFunction } from 'express';

// user ip is used to rate limit users.
export function userIP(req: Request, res: Response, next: NextFunction) {
  const userIP = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress)?.toString();

  const ua = req.get('User-Agent');

  req.deviceType = userAgentToDeviceType(ua);

  req.userIP = userIP as string;
  next();
}

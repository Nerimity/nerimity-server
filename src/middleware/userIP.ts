import { Request, Response, NextFunction } from 'express';


// user ip is used to rate limit users.
export function userIP (req: Request, res: Response, next: NextFunction) {
  const userIP = (req.headers['cf-connecting-ip'] ||
  req.headers['x-forwarded-for'] ||
  req.socket.remoteAddress)?.toString();

  req.userIP = userIP as string;
  next();
}

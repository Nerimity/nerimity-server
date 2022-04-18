import { AccountCache } from './cache/UserCache';

declare global {
  namespace Express {
    export interface Request {
      // userIp: string,
      accountCache: AccountCache

    }
  }
 
}



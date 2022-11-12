import { ChannelCache } from './cache/ChannelCache';
import { ServerCache } from './cache/ServerCache';
import { ServerMemberCache } from './cache/ServerMemberCache';
import { AccountCache } from './cache/UserCache';

declare global {
  namespace Express {
    export interface Request {
      // userIp: string,
      accountCache: AccountCache
      channelCache: ChannelCache
      serverMemberCache: ServerMemberCache
      serverCache: ServerCache
      rateLimited?: number
      userIP: string;
    }
  }

  interface Date {
    toJSON(test: string): number;
  }
}


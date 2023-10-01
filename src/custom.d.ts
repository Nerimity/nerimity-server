import internal from 'stream';
import { ChannelCache } from './cache/ChannelCache';
import { ServerCache } from './cache/ServerCache';
import { ServerMemberCache } from './cache/ServerMemberCache';
import { AccountCache } from './cache/UserCache';
// import { Auth } from 'googleapis';

declare global {
  namespace Express {
    export interface Request {
      // userIp: string,
      accountCache: AccountCache;
      channelCache: ChannelCache;
      serverMemberCache: ServerMemberCache;
      serverCache: ServerCache;
      rateLimited?: number;
      userIP: string;
      errorMessage?: string;
      // GoogleOAuth2Client?: Auth.OAuth2Client;

      fileInfo?: {
        name: string;
        file: internal.Readable;
        info: {
          encoding: string;
          filename: string;
          mimeType: string;
        };
      };
    }
  }

  interface Date {
    toJSON(test: string): number;
  }
}

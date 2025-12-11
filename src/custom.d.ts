import internal from 'stream';
import { ChannelCache } from './cache/ChannelCache';
import { ServerCache } from './cache/ServerCache';
import { ServerMemberCache } from './cache/ServerMemberCache';
import { UserCache } from './cache/UserCache';
import { OAuth2GrantCache } from './middleware/oAuth2Authenticate';

declare global {
  namespace Express {
    export interface Request {
      // userIp: string,
      userCache: UserCache;

      oAuth2Grant: OAuth2GrantCache;
      hasAdminOrCreatorBadge?: boolean;

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

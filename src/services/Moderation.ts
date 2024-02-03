import { removeAccountCacheByUserIds } from '../cache/UserCache';
import { emitErrorTo } from '../emits/Connection';

interface DisconnectUsersOptions {
  userIds: string[];
  message?: string;
  type?: string;
  reason?: string;
  expire?: string | null;
  clearCache: boolean;
}

export async function disconnectUsers(opts: DisconnectUsersOptions) {
  if (opts.clearCache) {
    await removeAccountCacheByUserIds(opts.userIds);
  }

  emitErrorTo({
    to: opts.userIds,
    disconnect: true,
    message: opts.message || 'You are suspended.',
    data: {
      type: opts.type || 'suspend',
      reason: opts.reason,
      expire: opts.expire,
    },
  });
}

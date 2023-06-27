import { removeAccountCacheByUserIds } from '../cache/UserCache';
import { emitErrorTo } from '../emits/Connection';

interface DisconnectUsersOptions {
  userIds: string[];
  reason?: string;
  expire?: string;
  clearCache: boolean;
}

export async function disconnectUsers(opts: DisconnectUsersOptions) {
  if (opts.clearCache) {
    await removeAccountCacheByUserIds(opts.userIds);
  }

  emitErrorTo({
    to: opts.userIds,
    disconnect: true,
    message: 'You are suspended.',
    data: { type: 'suspend', reason: opts.reason, expire: opts.expire },
  });
}

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './pino';

// import env from './env';

export const prisma = new PrismaClient({
  // log: ['error', 'warn', 'info', 'query'],
  log: [
    'warn',
    'error',
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration >= 200) {
    logger.warn('Long Query:', e.duration, 'ms', e.query);
  }
});

export const publicUserExcludeFields = excludeFields('User', ['status', 'customStatus', 'lastOnlineAt', 'lastOnlineStatus']);

export async function exists<Model extends { count: any }>(model: Model, args: Parameters<Model['count']>[0]): Promise<boolean> {
  const count = await model.count(args);
  return !!count;
}

type A<T extends string> = T extends `${infer U}ScalarFieldEnum` ? U : never;
type Entity = A<keyof typeof Prisma>;
type Keys<T extends Entity> = Extract<keyof (typeof Prisma)[keyof Pick<typeof Prisma, `${T}ScalarFieldEnum`>], string>;

export function excludeFields<T extends Entity, K extends Keys<T>>(type: T, omit: K[]) {
  type Key = Exclude<Keys<T>, K>;
  type TMap = Record<Key, true>;
  const result: TMap = {} as TMap;
  for (const key in Prisma[`${type}ScalarFieldEnum`]) {
    if (!omit.includes(key as K)) {
      result[key as Key] = true;
    }
  }
  return result;
}

export function includeFields<T extends Entity, K extends Keys<T>>(type: T, inc: K[]) {
  type TMap = Record<K, true>;
  const result: TMap = {} as TMap;
  for (const key of inc) {
    result[key as K] = true;
  }
  return result;
}

export function removeRoleIdFromServerMembers(roleId: string) {
  return prisma.$executeRaw(
    Prisma.sql`
    UPDATE "server_members"
      SET "roleIds"=(array_remove("roleIds", ${roleId})) 
      WHERE ${roleId} = ANY("roleIds");
      `
  );
}

export function removeServerIdFromAccountOrder(accountId: string, serverId: string) {
  return prisma.$transaction([
    prisma.$executeRaw(
      Prisma.sql`
    UPDATE "accounts"
      SET "serverOrderIds"=(array_remove("serverOrderIds", ${serverId})) 
      WHERE ${serverId} = ANY("serverOrderIds") AND "id" = ${accountId};
      `
    ),
    removeServerIdFromFolders(accountId, serverId),
  ]);
}

export function removeServerIdFromFolders(accountId: string, serverId: string) {
  return prisma.$executeRaw(
    Prisma.sql`
    UPDATE "server_folders"
      SET "serverIds"=(array_remove("serverIds", ${serverId})) 
      WHERE ${serverId} = ANY("serverIds") AND "accountId" = ${accountId};
      `
  );
}

// export function removeServerIdsFromFolders(accountId: string, serverIds: string[]) {
//   return prisma.$executeRaw(
//     Prisma.sql`
//     UPDATE "server_folders"
//       SET "serverIds"=(array_remove("serverIds", ${serverIds}))
//       WHERE ${serverIds} = ANY("serverIds") AND "accountId" = ${accountId};
//       `
//   );
// }

export function dateToDateTime(date?: Date | number) {
  if (!date) {
    return new Date().toISOString();
  }
  if (typeof date === 'number') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
}

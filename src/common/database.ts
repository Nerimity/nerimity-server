import { PrismaClient, Prisma } from '@src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import env from './env';

// import { Log } from './Log';
// import { logger } from './pino';
// import env from './env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
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

prisma.$on('query', async (e) => {
  // Exclude EXPLAIN, BEGIN, ROLLBACK, COMMIT and any internal Prisma queries
  if (e.query.startsWith('PREPARE')) return;
  if (e.query.startsWith('EXPLAIN')) return;
  if (e.query.startsWith('DEALLOCATE')) return;
  if (e.query.startsWith('BEGIN')) return;
  if (e.query.startsWith('ROLLBACK')) return;
  if (e.query.startsWith('COMMIT')) return;
  if (e.query.startsWith('SET')) return; // Prisma often sets session variables
  if (e.query.startsWith('SAVEPOINT')) return; // For nested transactions

  // if (e.duration > 50) {
  //   logger.info(`${e.duration}ms: ${e.query} ${e.params}`);
  // }
  // if (e.duration < 200) return;

  // await prisma
  //   .$transaction(async (tx) => {
  //     const params = JSON.parse(e.params);
  //     const res = await tx.$queryRawUnsafe('EXPLAIN ANALYZE ' + e.query, ...params).catch(() => {});
  //     logger.info('\n' + e.duration + 'ms: ' + e.query + '\n\n' + res.map((r) => r['QUERY PLAN']).join('\n') + '\n\n\n\n\n\n');

  //     throw new Error('Query explanation complete');
  //   })
  //   .catch(() => {});
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

export const getPostLikesFromDeletedUsers = () => {
  return prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
    SELECT "id"
    FROM "public"."post_likes"
    WHERE
      NOT EXISTS (
        SELECT 1 FROM "public"."accounts"
        WHERE "public"."accounts"."userId" = "public"."post_likes"."likedById"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "public"."applications"
        WHERE "public"."applications"."botUserId" = "public"."post_likes"."likedById"
      )
    ORDER BY "id" ASC
    LIMIT 300;
  `
  );
};

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

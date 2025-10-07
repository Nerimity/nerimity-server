import dotenv from 'dotenv';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getAllMessageMentions, getLastSeenServerChannelIdsByUserId } from './services/Channel';
import { getInbox } from './services/Inbox';

dotenv.config({ quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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

await prisma.$connect();

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

  setTimeout(async () => {
    const params = JSON.parse(e.params);
    const res = await prisma.$queryRawUnsafe('EXPLAIN (analyze, verbose) ' + e.query, ...params).catch(() => {});
    console.log('\n' + e.duration + 'ms: ' + e.query + '\n\n' + res.map((r) => r['QUERY PLAN']).join('\n') + '\n\n\n\n\n\n');
  }, 1000);
});

async function owo() {
  const t1 = performance.now();

  const userId = '1289157673362825217';
  const channelId = '1289157729608441857';
  const includeCurrentUserServerMembersOnly = false;

  const MessageValidator = {
    include: {
      webhook: {
        select: {
          avatar: true,
          name: true,
          hexColor: true,
        },
      },
      creatorOverride: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          avatar: true,
          badges: true,
          bot: true,
        },
      },
      mentions: {
        select: {
          id: true,
          username: true,
          tag: true,
          hexColor: true,
          badges: true,
          avatar: true,
        },
      },
      roleMentions: {
        select: {
          id: true,
          name: true,
          hexColor: true,
          icon: true,
        },
      },
      buttons: {
        orderBy: { order: 'asc' },
        select: {
          alert: true,
          id: true,
          label: true,
        },
      },
      replyMessages: {
        orderBy: { id: 'desc' },
        select: {
          replyToMessage: {
            select: {
              id: true,
              content: true,
              editedAt: true,
              createdAt: true,
              attachments: {
                select: {
                  height: true,
                  width: true,
                  path: true,
                  id: true,
                  filesize: true,
                  expireAt: true,
                  provider: true,
                  fileId: true,
                  mime: true,
                  createdAt: true,
                },
              },
              webhookId: true,
              webhook: {
                select: {
                  avatar: true,
                  name: true,
                  hexColor: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  tag: true,
                  hexColor: true,
                  avatar: true,
                  badges: true,
                  bot: true,
                },
              },
            },
          },
        },
      },
      quotedMessages: {
        select: {
          id: true,
          content: true,
          mentions: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              badges: true,
              avatar: true,
            },
          },
          roleMentions: {
            select: {
              id: true,
              name: true,
              hexColor: true,
              icon: true,
            },
          },
          editedAt: true,
          createdAt: true,
          channelId: true,
          attachments: {
            select: {
              height: true,
              width: true,
              path: true,
              id: true,
              provider: true,
              filesize: true,
              expireAt: true,
              fileId: true,
              mime: true,
              createdAt: true,
            },
          },
          webhookId: true,
          webhook: {
            select: {
              avatar: true,
              name: true,
              hexColor: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              tag: true,
              hexColor: true,
              avatar: true,
              badges: true,
              bot: true,
            },
          },
        },
      },
      attachments: {
        select: {
          height: true,
          width: true,
          path: true,
          id: true,
          provider: true,
          filesize: true,
          expireAt: true,
          fileId: true,
          mime: true,
          createdAt: true,
        },
      },
      reactions: true,
    },
  };

  const messages = await prisma.message.findMany({
    where: {
      channelId,
    },
    include: {
      ...MessageValidator.include,

      reactions: {
        select: {
          reactedUsers: { where: { userId } },
          emojiId: true,
          gif: true,
          name: true,
          _count: {
            select: {
              reactedUsers: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  const took = 'took ' + (performance.now() - t1).toFixed(2) + 'ms';

  setTimeout(() => {
    console.log(took, messages.length);
  }, 1500);
}

setInterval(() => {
  owo();
}, 3000);

// import dotenv from 'dotenv';
// import { Prisma, PrismaClient } from './generated/prisma/client';
// import { PrismaPg } from '@prisma/adapter-pg';
// import { getAllMessageMentions, getLastSeenServerChannelIdsByUserId } from './services/Channel';
// import { getInbox } from './services/Inbox';
// import { FriendStatus } from './types/Friend';
// import { constructPostInclude } from './services/Post';

// dotenv.config({ quiet: true });

// const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// export const prisma = new PrismaClient({
//   adapter,
//   // log: ['error', 'warn', 'info', 'query'],
//   log: [
//     'warn',
//     'error',
//     {
//       emit: 'event',
//       level: 'query',
//     },
//   ],
// });

// await prisma.$connect();

// prisma.$on('query', async (e) => {
//   // Exclude EXPLAIN, BEGIN, ROLLBACK, COMMIT and any internal Prisma queries
//   if (e.query.startsWith('PREPARE')) return;
//   if (e.query.startsWith('EXPLAIN')) return;
//   if (e.query.startsWith('DEALLOCATE')) return;
//   if (e.query.startsWith('BEGIN')) return;
//   if (e.query.startsWith('ROLLBACK')) return;
//   if (e.query.startsWith('COMMIT')) return;
//   if (e.query.startsWith('SET')) return; // Prisma often sets session variables
//   if (e.query.startsWith('SAVEPOINT')) return; // For nested transactions

//   setTimeout(async () => {
//     const params = JSON.parse(e.params);
//     const res = await prisma.$queryRawUnsafe('EXPLAIN (analyze, buffers, verbose, settings, wal) ' + e.query, ...params).catch(() => {});
//     console.log('\n' + e.duration + 'ms: ' + e.query + '\n\n' + res.map((r) => r['QUERY PLAN']).join('\n') + '\n\n\n\n\n\n');
//   }, 1000);
// });
// async function owo() {
//   const userId = '1520668380317786113';
//   const requesterUserId = '1289157673362825217';
//   const bypassBlocked = false;

//   await prisma.postLike.findMany({
//     where: {
//       likedById: userId,
//       post: {
//         ...(!bypassBlocked
//           ? {
//               createdBy: {
//                 friends: {
//                   none: {
//                     status: FriendStatus.BLOCKED,
//                     recipientId: requesterUserId,
//                   },
//                 },
//               },
//             }
//           : undefined),
//       },
//     },
//     include: { post: { include: constructPostInclude(requesterUserId) } },
//     orderBy: { createdAt: 'desc' },
//     take: 50,
//   });
// }

// setInterval(() => {
//   owo();
// }, 3000);

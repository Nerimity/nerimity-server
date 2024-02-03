import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { dateToDateTime, prisma } from '../../common/database';
import {
  customExpressValidatorResult,
  generateError,
} from '../../common/errorHandler';
import { generateId } from '../../common/flakeId';
import { removeDuplicates } from '../../common/utils';
import { authenticate } from '../../middleware/authenticate';
import { disconnectUsers } from '../../services/Moderation';
import { isModMiddleware } from './isModMiddleware';
import { removeAllowedIPsCache } from '../../cache/UserCache';
import { AuditLogType } from '../../common/AuditLog';
import { checkUserPassword } from '../../services/UserAuthentication';

export function userBatchSuspend(Router: Router) {
  Router.post(
    '/moderation/users/suspend',
    authenticate(),
    isModMiddleware,
    body('userIds')
      .not()
      .isEmpty()
      .withMessage('userIds is required')
      .isArray()
      .withMessage('userIds must be an array.'),
    body('days')
      .not()
      .isEmpty()
      .withMessage('Days are required')
      .isNumeric()
      .withMessage('Days must be a number.')
      .isLength({ min: 0, max: 5 })
      .withMessage('Days must be less than 99999'),
    body('reason')
      .not()
      .isEmpty()
      .withMessage('Reason is required.')
      .isString()
      .withMessage('Reason must be a string.')
      .isLength({ min: 0, max: 500 }),
    body('ipBan')
      .optional(true)
      .isBoolean()
      .withMessage('ipBan must be a boolean.'),
    body('password')
      .isLength({ min: 4, max: 72 })
      .withMessage('Password must be between 4 and 72 characters long.')
      .isString()
      .withMessage('Password must be a string!')
      .not()
      .isEmpty()
      .withMessage('Password is required'),
    route
  );
}

interface Body {
  userIds: string[];
  days: number;
  reason?: string;
  password: string;
  ipBan?: boolean;
}

const DAY_IN_MS = 86400000;
const expireAfter = (days: number) => {
  const now = Date.now();
  const expireDate = new Date(now + DAY_IN_MS * days);
  return expireDate;
};

async function route(req: Request<unknown, unknown, Body>, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const account = await prisma.account.findFirst({
    where: { id: req.accountCache.id },
    select: { password: true },
  });
  if (!account)
    return res
      .status(404)
      .json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(
    account.password,
    req.body.password
  );
  if (!isPasswordValid)
    return res.status(403).json(generateError('Invalid password.', 'password'));

  if (req.body.userIds.length >= 5000)
    return res
      .status(403)
      .json(generateError('user ids must contain less than 5000 ids.'));

  const sanitizedUserIds = removeDuplicates(req.body.userIds) as string[];

  const expireDateTime = dateToDateTime(expireAfter(req.body.days));

  const suspendedUsers = await prisma.suspension.findMany({
    where: { userId: { in: sanitizedUserIds } },
    select: { userId: true },
  });
  const suspendedUserIds = suspendedUsers.map((suspend) => suspend.userId);

  // Only increment if not suspended
  const incrementUserIds = sanitizedUserIds.filter(
    (id) => !suspendedUserIds.includes(id)
  );

  await prisma.account.updateMany({
    where: {
      userId: { in: incrementUserIds },
    },
    data: {
      suspendCount: { increment: 1 },
    },
  });

  await prisma.$transaction(
    sanitizedUserIds.map((userId) =>
      prisma.suspension.upsert({
        where: { userId },
        create: {
          id: generateId(),
          userId,
          suspendedById: req.accountCache.user.id,
          reason: req.body.reason,
          expireAt: req.body.days ? expireDateTime : null,
        },
        update: {
          suspendedById: req.accountCache.user.id,
          reason: req.body.reason || null,
          expireAt: req.body.days ? expireDateTime : null,
        },
      })
    )
  );

  await prisma.firebaseMessagingToken.deleteMany({
    where: { account: { userId: { in: sanitizedUserIds } } },
  });

  await disconnectUsers({
    userIds: sanitizedUserIds,
    clearCache: true,
    reason: req.body.reason,
    expire: req.body.days ? expireDateTime : null,
  });

  if (req.body.ipBan) {
    const ipExpireDateTime = dateToDateTime(expireAfter(7));

    const suspendedUserDevices = await prisma.userDevice.findMany({
      where: { userId: { in: sanitizedUserIds } },
    });
    const suspendedUserIps = suspendedUserDevices.map(
      (device) => device.ipAddress
    );

    const userDevicesWithSameIPs = await prisma.userDevice.findMany({
      where: { ipAddress: { in: suspendedUserIps } },
    });
    const ips = userDevicesWithSameIPs.map((device) => device.ipAddress);
    const userIds = userDevicesWithSameIPs.map((device) => device.userId);
    await removeAllowedIPsCache(ips);

    await prisma.$transaction(
      ips.map((ip) =>
        prisma.bannedIp.upsert({
          where: { ipAddress: ip },
          create: {
            id: generateId(),
            ipAddress: ip,
            expireAt: ipExpireDateTime,
          },
          update: {},
        })
      )
    );

    await disconnectUsers({
      userIds: userIds,
      clearCache: true,
      type: 'ip-ban',
      message: 'You have been IP Banned',
      expire: ipExpireDateTime,
    });
  }

  const newSuspendedUsers = await prisma.user.findMany({
    where: { id: { in: sanitizedUserIds } },
    select: { id: true, username: true },
  });

  await prisma.auditLog.createMany({
    data: newSuspendedUsers.map((user) => ({
      id: generateId(),
      actionType: AuditLogType.userSuspend,
      actionById: req.accountCache.user.id,
      username: user.username,
      userId: user.id,
      reason: req.body.reason,
      expireAt: req.body.days ? expireDateTime : null,
    })),
  });

  res.status(200).json({ success: true });
}

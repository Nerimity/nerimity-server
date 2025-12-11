import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { USER_BADGES, hasBit } from '../../common/Bitwise';
import bcrypt from 'bcrypt';
import { removeUserCacheByUserIds } from '../../cache/UserCache';
import { getIO } from '../../socket/socket';
import { AUTHENTICATE_ERROR } from '../../common/ClientEventNames';
import { ModAuditLogType } from '../../common/ModAuditLog';
import { generateId } from '../../common/flakeId';
import { checkUserPassword } from '../../services/UserAuthentication';
import { Prisma } from '@src/generated/prisma/client';

export function updateUser(Router: Router) {
  Router.post('/moderation/users/:userId', authenticate(), isModMiddleware(), route);
}

interface Body {
  email?: string;
  username?: string;
  tag?: string;
  badges?: number;
  newPassword?: string;
  password?: string;

  emailConfirmed?: boolean;
}

async function route(req: Request, res: Response) {
  const body: Body = req.body;
  const userId = req.params.userId;

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const moderatorAccount = await prisma.account.findFirst({
    where: { id: req.userCache.account?.id! },
    select: { password: true },
  });
  if (!moderatorAccount) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(moderatorAccount.password, body.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      account: true,
      application: true,
      username: true,
      tag: true,
      badges: true,
    },
  });

  if (!user?.account && !user?.application) return res.status(404).json(generateError('User does not exist.'));

  if (body.badges !== undefined) {
    const alreadyIsFounder = hasBit(user.badges, USER_BADGES.FOUNDER.bit);
    const updatedIsFounder = hasBit(body.badges, USER_BADGES.FOUNDER.bit);

    if (alreadyIsFounder !== updatedIsFounder) {
      return res.status(403).json(generateError(`Cannot modify the ${USER_BADGES.FOUNDER.name} badge`));
    }
  }
  if (body.tag || body.username) {
    const exists = await prisma.user.findFirst({
      where: {
        tag: body.tag?.trim() || user.tag,
        username: body.username?.trim() || user.username,
        NOT: { id: userId },
      },
    });
    if (exists) return res.status(403).json(generateError('Someone already has this combination of tag and username.'));
  }

  const updateAccount = {
    ...addToObjectIfExists('email', body.email),

    ...(body.emailConfirmed !== undefined
      ? {
          emailConfirmed: true,
          emailConfirmCode: null,
        }
      : undefined),
    ...(body.newPassword?.trim?.()
      ? {
          password: await bcrypt.hash(body.newPassword.trim(), 10),
          passwordVersion: { increment: 1 },
        }
      : undefined),
  };

  const newUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(Object.keys(updateAccount).length
        ? {
            account: { update: updateAccount },
          }
        : {}),

      ...addToObjectIfExists('username', body.username),
      ...addToObjectIfExists('tag', body.tag),
      ...addToObjectIfExists('badges', body.badges),
    },
    include: {
      account: {
        select: {
          email: true,
        },
      },
      profile: true,
    },
  });
  await removeUserCacheByUserIds([userId!]);

  if (body.newPassword?.trim()) {
    const broadcaster = getIO().in(userId!);
    broadcaster.emit(AUTHENTICATE_ERROR, { message: 'Invalid Token' });
    broadcaster.disconnectSockets(true);
  }

  await prisma.modAuditLog.create({
    data: {
      id: generateId(),
      actionType: ModAuditLogType.userUpdate,
      actionById: req.userCache.id,
      username: newUser.username,
      userId: newUser.id,
    },
  });

  res.json(newUser);
}

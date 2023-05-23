import { Request, Response, Router } from 'express';
import { prisma } from '../../common/database';
import { authenticate } from '../../middleware/authenticate';
import { isModMiddleware } from './isModMiddleware';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { checkUserPassword } from '../../services/User';
import { addToObjectIfExists } from '../../common/addToObjectIfExists';
import { USER_BADGES, hasBit } from '../../common/Bitwise';

export function updateUser(Router: Router) {
  Router.post('/moderation/users/:userId', 
    authenticate(),
    isModMiddleware,
    route
  );
}



interface Body {
  email?: string;
  username?: string;
  tag?: string;
  badges?: number;
  password?: string;
}


async function route (req: Request, res: Response) {
  const body: Body = req.body;
  const userId = req.params.userId;

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const moderatorAccount = await prisma.account.findFirst({where: { id: req.accountCache.id }, select: {password: true}});
  if (!moderatorAccount) return res.status(404).json(generateError('Something went wrong. Try again later.'));

  const isPasswordValid = await checkUserPassword(body.password, moderatorAccount.password);
  if (!isPasswordValid) return res.status(403).json(generateError('Invalid password.', 'password'));


  const account = await prisma.account.findFirst({
    where: {userId}, 
    select: {user: {select: {badges: true}}}
  });

  if (!account) return res.status(404).json(generateError('User does not exist.'));


  if (body.badges !== undefined) {
    const alreadyIsFounder = hasBit(account.user.badges, USER_BADGES.FOUNDER.bit);
    const updatedIsFounder = hasBit(body.badges, USER_BADGES.FOUNDER.bit);

    if (alreadyIsFounder !== updatedIsFounder) {
      return res.status(403).json(generateError(`Cannot modify the ${USER_BADGES.FOUNDER.name} badge`));
    }
  }


  const update = {
    ...addToObjectIfExists('email', body.email),
    user: {
      update: {
        ...addToObjectIfExists('username', body.username),
        ...addToObjectIfExists('tag', body.tag),
        ...addToObjectIfExists('badges', body.badges),
      }
    }
  };


  const user = await prisma.account.update({
    where: {userId},
    data: update,
    select: {
      email: true,
      user: {
        include: {
          profile: true,
        }
      }
    }
  });


  res.json(user);
}
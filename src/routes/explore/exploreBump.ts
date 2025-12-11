import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { bumpExploreItem, getExploreItem } from '../../services/Explore';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';
import { getServerMemberCache } from '../../cache/ServerMemberCache';

export function exploreBump(Router: Router) {
  Router.post('/explore/:id/bump', authenticate(), body('token').isString().withMessage('Token must be a string.').isLength({ min: 1, max: 5000 }).withMessage('Token must be between 1 and 5000 characters long.'), route);
}

async function route(req: Request, res: Response) {
  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const validToken = await turnstileVerify(req.body.token);

  if (!validToken) {
    return res.status(401).json(generateError('Invalid captcha! Please try again.', 'token'));
  }

  const { id } = req.params;

  const [exploreItem, exploreError] = await getExploreItem({ serverId: id });
  if (exploreError) return res.status(404).json(exploreError);

  if (exploreItem.serverId) {
    const [member, memberError] = await getServerMemberCache(exploreItem.serverId, req.userCache.id);
    if (!member) return res.status(403).json(generateError(memberError || 'You must be a member of this server to bump.'));
  }

  const [server, error] = await bumpExploreItem({
    exploreId: exploreItem.id,
    bumpedByUserId: req.userCache.id,
  });

  if (error) {
    return res.status(400).json(error);
  }
  res.json(server);
}

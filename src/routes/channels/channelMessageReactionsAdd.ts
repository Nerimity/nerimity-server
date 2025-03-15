import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { addMessageReaction } from '../../services/Message';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { rateLimit } from '../../middleware/rateLimit';

export function channelMessageReactionsAdd(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/:messageId/reactions',
    authenticate({ allowBot: true }),
    channelVerification(),
    body('name').not().isEmpty().withMessage('name is required!').isString().withMessage('name must be a string!').isLength({ min: 1, max: 20 }).withMessage('name length must be between 1 and 20 characters.'),
    body('emojiId').optional({ values: 'falsy' }).isString().withMessage('emojiId must be a string!').isLength({ min: 1, max: 20 }).withMessage('emojiId length must be between 1 and 20 characters.'),
    body('gif').optional({ values: 'falsy' }).isBoolean().withMessage('gif must be a boolean!'),
    rateLimit({
      name: 'reaction_add',
      restrictMS: 20000,
      requests: 20,
    }),
    route
  );
}

interface Body {
  name: string; // emoji name or unicode
  emojiId?: string;
  gif?: boolean;
}

async function route(req: Request, res: Response) {
  if (req.userCache.shadowBanned) {
    return res.status(403).json(generateError('Something went wrong. Try again later.'));
  }
  const body = req.body as Body;
  const { messageId } = req.params;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!body.name) {
    return res.status(403).json('Name is required!');
  }

  const [response, err] = await addMessageReaction({
    serverId: req.serverCache?.id,
    channel: req.channelCache,
    channelId: req.channelCache.id,
    reactedByUserId: req.userCache.id,
    messageId,
    ...body,
  });

  if (err) {
    return res.status(403).json(err);
  }

  return res.status(200).json(response);
}

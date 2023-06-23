import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { getMessageReactedUsers } from '../../services/Message';
import { query } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { rateLimit } from '../../middleware/rateLimit';

export function channelMessageReactedUsers(Router: Router) {
  Router.get(
    '/channels/:channelId/messages/:messageId/reactions/users',
    authenticate(),
    channelVerification(),
    query('name')
      .not()
      .isEmpty()
      .withMessage('name is required!')
      .isString()
      .withMessage('name must be a string!')
      .isLength({ min: 1, max: 20 })
      .withMessage('name length must be between 1 and 20 characters.'),
    query('emojiId')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('emojiId must be a string!')
      .isLength({ min: 1, max: 20 })
      .withMessage('emojiId length must be between 1 and 20 characters.'),
    rateLimit({
      name: 'reaction_get',
      expireMS: 20000,
      requestCount: 30,
    }),
    route
  );
}

interface Query {
  name: string; // emoji name or unicode
  emojiId?: string;
}

async function route(req: Request, res: Response) {
  const query = req.query as unknown as Query;
  const { messageId } = req.params;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (!query.name) {
    return res.status(403).json('Name is required!');
  }



  if (query.emojiId === 'null') delete query.emojiId;
  const [response, err] = await getMessageReactedUsers({
    messageId,
    ...query,
  });

  if (err) {
    return res.status(403).json(err);
  }

  return res.status(200).json(response);
}

import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplication, updateBotCommands } from '../../services/Application';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { body } from 'express-validator';

export function applicationBotSetCommands(Router: Router) {
  Router.post(
    '/applications/:id?/bot/commands',
    body('commands')
      .isArray()
      .withMessage('Commands must be an array!')
      .custom((value) => {
        return value.length < 100;
      })
      .withMessage('Commands length must be less than  100 strings.'),

    body('commands.*.name').isString().withMessage('Command name must be a string!').notEmpty().withMessage('Command name is required!').isLength({ min: 1, max: 25 }).withMessage('Command name length must be between 1 and 25 characters.').isAlpha().withMessage('Command name must only contain letters.'),

    body('commands.*.description').isString().withMessage('Command description must be a string!').isLength({ min: 0, max: 60 }).withMessage('Command description length must be less than or equal to 60 characters').optional(true),

    body('commands.*.args').isString().withMessage('Command args must be a string!').isLength({ min: 0, max: 60 }).withMessage('Command args length must be less than or equal to 60 characters').optional(true),
    body('commands.*.permissions').isNumeric().withMessage('Command permissions must be a number.').isInt({ min: 0, max: 900 }).withMessage('Permissions must be between 0 and 900.').isLength({ min: 0, max: 100 }).withMessage('Permissions must be between 0 and 100 characters long.').optional(true),

    authenticate({ allowBot: true }),
    rateLimit({
      name: 'add-bot-commands',
      restrictMS: 60000,
      requests: 4,
    }),
    route
  );
}

interface Body {
  commands: {
    name: string;
    description?: string;
    args?: string;
    permissions?: number;
  }[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const id = req.userCache.application?.id || req.params.id;

  if (!id) {
    return res.status(400).json(generateError('Missing application id!'));
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (req.userCache.application?.id !== id) {
    const [application, error] = await getApplication(req.userCache.account!.id, id);
    if (error) {
      return res.status(404).json(error);
    }
    if (!application.botUserId) {
      return res.status(400).json(generateError('You must create a bot first!'));
    }
  }

  const [status, updateErr] = await updateBotCommands({
    applicationId: id,
    commands: body.commands,
  });

  if (updateErr) {
    return res.status(403).json(updateErr);
  }

  res.json({ status });
}

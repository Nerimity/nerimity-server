import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { getApplication, updateBotCommands } from '../../services/Application';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { body } from 'express-validator';

export function applicationBotSetCommands(Router: Router) {
  Router.post(
    '/applications/:id/bot/commands',
    body('commands')
      .isArray()
      .withMessage('Commands must be an array!')
      .custom((value) => {
        return value.length < 100;
      })
      .withMessage('Commands length must be less than  100 strings.'),

    body('commands.*.name').isString().withMessage('Command name must be a string!').notEmpty().withMessage('Command name is required!').isLength({ min: 1, max: 100 }).withMessage('Command name length must be between 1 and 100 characters.'),

    body('commands.*.description').isString().withMessage('Command description must be a string!').isLength({ min: 0, max: 100 }).withMessage('Command description length must be less than or equal to 100 characters').optional(true),

    body('commands.*.args').isString().withMessage('Command args must be a string!').isLength({ min: 0, max: 100 }).withMessage('Command args length must be less than or equal to 100 characters').optional(true),

    authenticate(),
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
  }[];
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;
  const id = req.params.id;
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

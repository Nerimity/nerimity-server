import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { createServer } from '../../services/Server';
import { hasBadWord } from '../../common/badWords';

export function serverCreate(Router: Router) {
  Router.post('/servers', authenticate(), body('name').not().isEmpty().withMessage('Name is required.').isString().withMessage('Name must be a string.').isLength({ min: 2, max: 35 }).withMessage('Name must be between 2 and 35 characters long.'), route);
}

interface Body {
  name: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }

  const urlRegex = new RegExp('(^|[ \t\r\n])((http|https):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))');
  if (urlRegex.test(body.name)) {
    return res.status(400).json(generateError('Name cannot be a URL.', 'name'));
  }
  if (hasBadWord(body.name)) {
    return res.status(400).json(generateError('Name cannot contain bad words.', 'name'));
  }

  const [server, error] = await createServer({
    name: body.name,
    creatorId: req.userCache.id,
  });

  if (error) {
    res.status(400).json(error);
  }

  res.json(server);
}

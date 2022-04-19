import { Request, Response, Router } from 'express';
import {body} from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { authenticate } from '../../middleware/authenticate';
import { createServer } from '../../services/Server';

export function serverCreate(Router: Router) {
  Router.post('/servers', 
    authenticate(),
    body('name')
      .not().isEmpty().withMessage('Name is required.')
      .isString().withMessage('Name must be a string.')
      .isLength({ min: 4, max: 100 }).withMessage('Name must be between 4 and 100 characters long.'),
    route
  );
}


interface Body {
  name: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);
  if (validateError) {
    return res.status(400).json(validateError);
  }
  const [server, error] = await createServer({
    name: body.name,
    creatorId: req.accountCache.user._id
  });

  if (error) {
    res.status(400).json(error);
  }

  res.json(server);

}
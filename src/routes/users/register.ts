import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';
import { registerUser } from '../../services/User';

export function register(Router: Router) {
  Router.post('/users/register',
    body('email')
      .not().isEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 }).withMessage('Email must be between 1 and 320 characters long.'),
    body('username')
      .not().isEmpty().withMessage('Username is required.')
      .isString().withMessage('Invalid username.')
      .isLength({ min: 1, max: 320 }).withMessage('Username must be between 1 and 320 characters long.'),
    body('password')
      .not().isEmpty().withMessage('Password is required.')
      .isString().withMessage('Password must be a string.')
      .isLength({ min: 4, max: 255 }).withMessage('Password must be between 4 and 255 characters long.'),
    route
  );
}

interface Body {
  email: string;
  username: string;
  password: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;


  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [ userToken, errors ] = await registerUser({
    email: body.email,
    username: body.username,
    password: body.password,
  });
  if (errors) {
    return res.status(400).json(errors);
  }
  res.json({ token: userToken });
}
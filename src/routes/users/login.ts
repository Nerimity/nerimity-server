import { Request, Response, Router } from 'express';
import { loginUser } from '../../services/User';
import {body} from 'express-validator';
import { customExpressValidatorResult } from '../../common/errorHandler';

export function login(Router: Router) {
  Router.post('/users/login', 
    body('email')
      .not().isEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Invalid email.'),
    body('password')
      .not().isEmpty().withMessage('Password is required.')
      .isString().withMessage('Password must be a string.'),
    route
  );
}

interface Body {
  email: string;
  password: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  const [ userToken, error ] = await loginUser({
    email: body.email,
    password: body.password,
  });
  if (error) {
    return res.status(400).json(error);
  }
  res.json({ token: userToken });
}
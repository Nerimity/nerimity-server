import { Request, Response, Router } from 'express';
import { loginUser } from '../../services/User';
import {body} from 'express-validator';
import { customValidateResult } from '../../common/expressValidator';

export function login(Router: Router) {
  Router.post('/users/login', 
    body('email')
      .not().isEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 }).withMessage('Email must be between 1 and 320 characters long.'),
    body('password')
      .not().isEmpty().withMessage('Password is required.')
      .isString().withMessage('Password must be a string.')
      .isLength({ min: 4, max: 255 }).withMessage('Password must be between 4 and 255 characters long.'),
    route
  );
}


interface Body {
  email: string;
  password: string;
}




async function route (req: Request, res: Response) {
  const body = req.body as Body;

  const validateError = customValidateResult(req);

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
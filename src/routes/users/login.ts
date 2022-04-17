import { Request, Response, Router } from 'express';
import { loginUser } from '../../services/User';

export function login(Router: Router) {
  Router.post('/users/login', route);
}


interface Body {
  email: string;
  password: string;
}


async function route (req: Request, res: Response) {
  const body = req.body as Body;
  const [ userToken, errors ] = await loginUser({
    email: body.email,
    password: body.password,
  });
  if (errors) {
    return res.status(400).json(errors);
  }
  res.json({ token: userToken });
}
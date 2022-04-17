import { Request, Response, Router } from 'express';
import { registerUser } from '../../services/User';

export function register(Router: Router) {
  Router.post('/users/register', route);
}

interface Body {
  email: string;
  username: string;
  password: string;
}

async function route (req: Request, res: Response) {
  const body = req.body as Body;
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
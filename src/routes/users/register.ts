import { Request, Response, Router } from 'express';
import { customZodError, generateError } from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';
import { rateLimit } from '../../middleware/rateLimit';
import { registerUser } from '../../services/User';
import z from 'zod';

const bodySchema = z.object({
  token: z.string({})
    .min(5)
    .max(3000),
  email: z.string()
    .min(1)
    .max(320)
    .email('Invalid email.'),
  username: z.string()
    .min(3)
    .max(35),
  password: z.string()
    .min(4)
    .max(255),
});

export function register(Router: Router) {
  Router.post('/users/register',
    rateLimit({
      name: 'register_limit',
      message: 'Something went wrong! Please try again in 1 minute.',
      globalLimit: true,
      expireMS: 30000,
      requestCount: 5,
    }),
    route
  );
}



async function route (req: Request, res: Response) {
  const bodyResult = bodySchema.safeParse(req.body);

  if (!bodyResult.success) {
    console.log(bodyResult.error.errors);
    return res.status(400).json(customZodError(bodyResult.error));
  }

  const body = bodyResult.data;

  const validToken = await turnstileVerify(body.token);

  if (!validToken) {
    return res.status(401).json(generateError('Invalid captcha! Please try again.', 'token'));
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
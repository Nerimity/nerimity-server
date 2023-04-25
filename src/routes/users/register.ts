import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, customZodError, generateError } from '../../common/errorHandler';
import { turnstileVerify } from '../../common/turnstileVerify';
import { rateLimit } from '../../middleware/rateLimit';
import { registerUser } from '../../services/User';
import z from 'zod';

const tokenLengthMessage = 'Token must be between 1 and 3000 characters long';
const emailLengthMessage = 'Email must be between 1 and 320 characters long';
const usernameLengthMessage = 'Username must be between 3 and 35 characters long';
const passwordLengthMessage = 'Password must be between 4 and 255 characters long';




const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (ctx.defaultError === 'Required') {
    return {message: `${issue.path.join('.')} is required.`};
  }
  
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return {message: `${issue.path.join('.')} must be a ${issue.expected}`};
  }

  if (issue.code === z.ZodIssueCode.too_small) {
    return {message: `${issue.path.join('.')} must be at least ${issue.minimum} characters long`};
  }
  if (issue.code === z.ZodIssueCode.too_big) {
    return {message: `${issue.path.join('.')} must be at most ${issue.maximum} characters long`};
  }

  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);



const bodySchema = z.object({
  token: z.string({})
    .min(1)
    .max(3000),
  email: z.string({required_error: 'Email is required.'}).email('Invalid email.')
    .min(1)
    .max(320),
  username: z.string({required_error: 'Username is required.'})
    .min(3)
    .max(35),
  password:  z.string({required_error: 'Password is required.'})
    .min(4)
    .max(255),
});
console.clear();

const bodyResult = bodySchema.safeParse({
  token: '2222222',
  email: 'test@gmail.com',
  username: 'asdsadsaddsa',
  password: 'lo3s'

});

if (!bodyResult.success) {
  // console.log(bodyResult.error);
  console.log(customZodError(bodyResult.error));
} 


export function register(Router: Router) {
  Router.post('/users/register',
    body('token')
      .isString().withMessage('Token must be a string.')
      .isLength({ min: 1, max: 5000 }).withMessage('Token must be between 1 and 5000 characters long.')
      .optional(true),
    body('email')
      .not().isEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Invalid email.')
      .isLength({ min: 1, max: 320 }).withMessage('Email must be between 1 and 320 characters long.'),
    body('username')
      .not().isEmpty().withMessage('Username is required.')
      .isString().withMessage('Invalid username.')
      .isLength({ min: 3, max: 35 }).withMessage('Username must be between 3 and 35 characters long.'),
    body('password')
      .not().isEmpty().withMessage('Password is required.')
      .isString().withMessage('Password must be a string.')
      .isLength({ min: 4, max: 255 }).withMessage('Password must be between 4 and 255 characters long.'),
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
    console.log(customZodError(bodyResult.error));
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
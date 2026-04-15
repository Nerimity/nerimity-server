import { Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { rateLimit } from '../../middleware/rateLimit';
import { loginUserWithEmail, loginWithGoogleUserId, loginWithUsernameAndTag } from '../../services/UserAuthentication';
import { googleOAuth2Client } from '@src/common/GoogleOAuth2Client';
import env from '@src/common/env';

export function login(Router: Router) {
  Router.post(
    '/users/login',
    body('usernameAndTag').optional(true).isString().withMessage('Invalid email.'),
    body('email').optional(true).isEmail().withMessage('Invalid email.'),
    body('password').isLength({ min: 4, max: 72 }).withMessage('Password must be between 4 and 72 characters long.').not().isEmpty().withMessage('Password is required.').isString().withMessage('Password must be a string.'),
    rateLimit({
      name: 'login',
      useIP: true,
      restrictMS: 30000,
      requests: 10,
    }),
    route,
  );
}

interface Body {
  email?: string;
  usernameAndTag?: string;
  password: string;
  googleCode?: string;
}

async function route(req: Request, res: Response) {
  const body = req.body as Body;

  if (body.googleCode) {
    const client = googleOAuth2Client();

    const getTokenRes = await client.getToken({ redirect_uri: `${env.CLIENT_URL}/login`, code: body.googleCode }).catch((e) => {
      console.log(e);
    });
    if (!getTokenRes || !getTokenRes.tokens.id_token) {
      return res.status(400).json(generateError('Invalid code or missing ID token.'));
    }

    const ticket = await client.verifyIdToken({
      idToken: getTokenRes.tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleUserId = payload?.sub;
    if (!googleUserId) {
      return res.status(400).json(generateError('Invalid ID token payload.'));
    }

    const [userToken, error] = await loginWithGoogleUserId({
      googleUserId,
      ipAddress: req.userIP,
    });
    if (error) {
      return res.status(400).json(error);
    }
    res.json({ token: userToken });
    return;
  }

  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (body.usernameAndTag && body.email) {
    return res.status(400).json(generateError('Only one of username:tag/email are required!', 'email'));
  }
  if (!body.usernameAndTag && !body.email) {
    return res.status(400).json(generateError('username:tag/email required!', 'email'));
  }

  let username;
  let tag;

  if (!body.email && body.usernameAndTag) {
    const split = body.usernameAndTag.split(':');
    if (split.length !== 2) return res.status(400).json(generateError('Invalid username & tag', 'email'));
    username = split[0];
    tag = split[1];
  }

  if (body.email) {
    const [userToken, error] = await loginUserWithEmail({
      email: body.email,
      password: body.password,
      ipAddress: req.userIP,
    });
    if (error) {
      return res.status(400).json(error);
    }
    res.json({ token: userToken });
  }

  if (username && tag) {
    const [userToken, error] = await loginWithUsernameAndTag({
      username,
      tag,
      password: body.password,
      ipAddress: req.userIP,
    });
    if (error) {
      return res.status(400).json(error);
    }
    res.json({ token: userToken });
  }
}

import { Request, Response, Router } from 'express';

import { query } from 'express-validator';
import { rateLimit } from '@src/middleware/rateLimit';
import { customExpressValidatorResult, generateError } from '@src/common/errorHandler';
import { exchangeCodeForToken, refreshToken } from '@src/services/Oauth2';

export function oauth2TokenRoute(Router: Router) {
  Router.post(
    '/oauth2/token',
    query('clientId').not().isEmpty().withMessage('clientId is required!').isString().withMessage('clientId must be a string!').isLength({ min: 1, max: 20 }).withMessage('clientId length must be between 1 and 20 characters.'),
    query('clientSecret').not().isEmpty().withMessage('clientSecret is required!').isString().withMessage('clientSecret must be a string!').isLength({ min: 1, max: 90 }).withMessage('clientSecret length must be between 1 and 90 characters.'),
    query('grantType').not().isEmpty().withMessage('grantType is required!').isString().withMessage('grantType must be a string!').isLength({ min: 1, max: 50 }).withMessage('grantType length must be between 1 and 50 characters.'),

    rateLimit({
      name: 'oauth2-token',
      restrictMS: 60000,
      requests: 15,
    }),
    route
  );
}

type Query =
  | {
      grantType: 'authorization_code';
      code: string;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  | {
      grantType: 'refresh_token';
      refreshToken: string;
      clientId: string;
      clientSecret: string;
    };

async function route(req: Request, res: Response) {
  const query = req.query as unknown as Query;
  const validateError = customExpressValidatorResult(req);

  if (validateError) {
    return res.status(400).json(validateError);
  }

  if (query.grantType !== 'authorization_code' && query.grantType !== 'refresh_token') {
    return res.status(400).json('grantType must be "authorization_code" or "refresh_token"!');
  }

  let result;
  let error;

  if (query.grantType === 'authorization_code') {
    if (!query.code) {
      return res.status(400).json(generateError('code is required!'));
    }
    [result, error] = await exchangeCodeForToken({
      clientId: query.clientId,
      clientSecret: query.clientSecret,
      code: query.code,
      redirectUri: query.redirectUri,
    });
  } else {
    if (!query.refreshToken) {
      return res.status(400).json(generateError('refreshToken is required!'));
    }
    [result, error] = await refreshToken({
      clientId: query.clientId,
      clientSecret: query.clientSecret,
      refreshToken: query.refreshToken,
    });
  }

  if (error) return res.status(500).json(error);

  return res.status(200).json(result);
}

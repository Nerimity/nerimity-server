import { Router } from 'express';
import { oauth2AuthorizeRoute } from './oauth2AuthorizeRoute';
import { oauth2TokenRoute } from './oauth2TokenRoute';

const Oauth2Router = Router();

oauth2AuthorizeRoute(Oauth2Router);
oauth2TokenRoute(Oauth2Router);

export { Oauth2Router };

import { Router } from 'express';
import { oauth2AuthorizeRoute } from './oauth2AuthorizeRoute';

const Oauth2Router = Router();

oauth2AuthorizeRoute(Oauth2Router);

export { Oauth2Router };

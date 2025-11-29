import { Router } from 'express';
import { oauth2AuthorizeRoute } from './oauth2AuthorizeRoute';
import { oauth2TokenRoute } from './oauth2TokenRoute';
import { oauth2AuthorizeGetRoute } from './oauth2AuthorizeGet';
import { oauth2Unauthorize } from './oauth2Unauthorize';
import { oauth2AuthorizedApps } from './oauth2AuthorizedApps';

const Oauth2Router = Router();

oauth2AuthorizeRoute(Oauth2Router);
oauth2TokenRoute(Oauth2Router);
oauth2AuthorizeGetRoute(Oauth2Router);
oauth2Unauthorize(Oauth2Router);
oauth2AuthorizedApps(Oauth2Router);

export { Oauth2Router };

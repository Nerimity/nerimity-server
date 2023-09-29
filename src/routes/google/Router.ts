import { Router } from 'express';
import { googleLink } from './googleLink';
import { googleCreateLink } from './googleCreateLink';
import { googleUnlink } from './googleUnlink';
import { googleGetAccessToken } from './googleGetAccessToken';


const GoogleRouter = Router();

googleLink(GoogleRouter);
googleCreateLink(GoogleRouter);
googleUnlink(GoogleRouter);
googleGetAccessToken(GoogleRouter);

export { GoogleRouter };

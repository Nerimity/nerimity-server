import { Router } from 'express';
import { ogPost } from './ogPost';
import { ogServerInvite } from './ogServerInvite';
import { ogProfile } from './ogProfile';

const OpenGraphRouter = Router();

ogPost(OpenGraphRouter);
ogServerInvite(OpenGraphRouter);
ogProfile(OpenGraphRouter);

export { OpenGraphRouter };

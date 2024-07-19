import { Router } from 'express';
import { ogPost } from './ogPost';
import { ogServerInvite } from './ogServerInvite';

const OpenGraphRouter = Router();

ogPost(OpenGraphRouter);
ogServerInvite(OpenGraphRouter);

export { OpenGraphRouter };

import { Router } from 'express';
import { linkAccountWithGoogle } from './link-account';
import { createGoogleAuthLink } from './create-link';
import { unlinkAccountWithGoogle } from './unlink-account';

const GoogleRouter = Router();

linkAccountWithGoogle(GoogleRouter);
createGoogleAuthLink(GoogleRouter);
unlinkAccountWithGoogle(GoogleRouter);

export { GoogleRouter };

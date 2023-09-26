import { Router } from 'express';
import { linkAccountWithGoogle } from './link-account';
import { createGoogleAuthLink } from './create-link';

const GoogleRouter = Router();

linkAccountWithGoogle(GoogleRouter);
createGoogleAuthLink(GoogleRouter);

export { GoogleRouter };

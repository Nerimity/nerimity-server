import { google } from 'googleapis';
import env from '../common/env';
import { NextFunction, Request, Response } from 'express';
export const googleOAuth2Client = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const GoogleOAuth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URL
  );

  req.GoogleOAuth2Client = GoogleOAuth2Client;
  next();
};

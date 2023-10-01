import { google } from 'googleapis';
import env from '../common/env';

export const googleOAuth2Client = (refreshToken?: string) => {
  const GoogleOAuth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URL
  );

  if (refreshToken) {
    GoogleOAuth2Client.setCredentials({ refresh_token: refreshToken });
  }

  return GoogleOAuth2Client;
};

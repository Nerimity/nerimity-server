import { addBit, APPLICATION_SCOPES } from '@src/common/Bitwise';
import { dateToDateTime, prisma } from '@src/common/database';
import { generateError } from '@src/common/errorHandler';
import { generateId } from '@src/common/flakeId';
import crypto from 'crypto';

const CODE_EXPIRE_TIME = 60000 * 3; // 3 minutes (ms)
const REFRESH_TOKEN_EXPIRE_TIME = 60 * 60 * 24 * 30 * 1000; // 30 days (ms)
const ACCESS_TOKEN_EXPIRE_TIME = 60 * 60 * 24 * 1000; // 1 day (ms)

export const generateOauth2Token = () => {
  return crypto.randomBytes(32).toString('base64url');
};

interface Oauth2AuthorizeOpts {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  userId: string;
}
export const oauth2Authorize = async (opts: Oauth2AuthorizeOpts) => {
  const application = await prisma.application.findUnique({ where: { id: opts.clientId } });
  if (!application) {
    return [null, generateError('Invalid client ID.')] as const;
  }
  if (!opts.redirectUri.length) {
    return [null, generateError('redirectUri is required.')] as const;
  }
  if (!application.redirectUris.includes(opts.redirectUri)) {
    return [null, generateError('Invalid redirect URI!')] as const;
  }

  const userAccount = await prisma.account.findUnique({ where: { userId: opts.userId } });
  if (!userAccount) {
    return [null, generateError('Invalid user ID.')] as const;
  }

  let scopes = 0;
  let hasInvalidScopes = false;
  opts.scopes.forEach((scope) => {
    const scopeInfo = APPLICATION_SCOPES[scope as keyof typeof APPLICATION_SCOPES];
    if (!scopeInfo) {
      hasInvalidScopes = true;
      return;
    }
    scopes = addBit(scopes, scopeInfo.bit);
  });

  if (scopes == 0 || hasInvalidScopes) {
    return [null, generateError('Invalid scopes!')] as const;
  }

  const code = generateOauth2Token();
  const codeExpiresAt = dateToDateTime(Date.now() + CODE_EXPIRE_TIME);

  const grant = await prisma.applicationUserGrant
    .upsert({
      where: {
        applicationId_userId: {
          applicationId: application.id,
          userId: opts.userId,
        },
      },
      create: {
        id: generateId(),
        code: code,
        codeExpiresAt,
        applicationId: application.id,
        userId: opts.userId,
        scopes,
        redirectUri: opts.redirectUri,
      },
      update: {
        code: code,
        codeExpiresAt,
        scopes,

        accessToken: null,
        accessExpiresAt: null,
        refreshToken: null,
        refreshExpiresAt: null,
        redirectUri: opts.redirectUri,
      },
    })
    .catch((err) => {
      console.error(err);
      return null;
    });
  if (!grant) {
    return [null, generateError('Something went wrong. Try again later.')] as const;
  }
  const result = {
    redirectUri: opts.redirectUri,
    code: grant.code,
  };
  return [result, null] as const;
};

interface ExchangeCodeForTokenOpts {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
export const exchangeCodeForToken = async (opts: ExchangeCodeForTokenOpts) => {
  const application = await prisma.application.findUnique({ where: { id: opts.clientId } });
  if (!application) {
    return [null, generateError('Invalid client ID.')] as const;
  }

  if (!application.clientSecret || application.clientSecret !== opts.clientSecret) {
    return [null, generateError('Invalid client secret.')] as const;
  }

  const grant = await prisma.applicationUserGrant.findUnique({ where: { code: opts.code, applicationId: opts.clientId, redirectUri: opts.redirectUri } });

  if (!grant) {
    return [null, generateError('Invalid code or redirect URI.')] as const;
  }

  const isCodeExpired = grant.codeExpiresAt.getTime() < Date.now();
  if (isCodeExpired) {
    return [null, generateError('Code expired.')] as const;
  }

  const accessToken = generateOauth2Token();
  const accessExpiresAt = dateToDateTime(Date.now() + ACCESS_TOKEN_EXPIRE_TIME);

  const refreshToken = generateOauth2Token();
  const refreshExpiresAt = dateToDateTime(Date.now() + REFRESH_TOKEN_EXPIRE_TIME);

  await prisma.applicationUserGrant.update({
    where: { id: grant.id },
    data: {
      code: null,
      codeExpiresAt: dateToDateTime(),
      accessToken,
      accessExpiresAt,
      refreshToken,
      refreshExpiresAt,
    },
  });

  const result = {
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRE_TIME / 1000,
    refreshToken,
  };
  return [result, null] as const;
};

interface RefreshTokenOpts {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}
export const refreshToken = async (opts: RefreshTokenOpts) => {
  const application = await prisma.application.findUnique({ where: { id: opts.clientId } });
  if (!application) {
    return [null, generateError('Invalid client ID.')] as const;
  }

  if (!application.clientSecret || application.clientSecret !== opts.clientSecret) {
    return [null, generateError('Invalid client secret.')] as const;
  }

  const grant = await prisma.applicationUserGrant.findUnique({ where: { refreshToken: opts.refreshToken, applicationId: opts.clientId } });

  if (!grant?.refreshToken) {
    return [null, generateError('Invalid refresh token.')] as const;
  }

  if (!grant.refreshExpiresAt) {
    return [null, generateError('Refresh token expired.')] as const;
  }

  const isRefreshTokenExpired = grant.refreshExpiresAt.getTime() < Date.now();
  if (isRefreshTokenExpired) {
    return [null, generateError('Refresh token expired.')] as const;
  }

  const accessToken = generateOauth2Token();
  const accessExpiresAt = dateToDateTime(Date.now() + ACCESS_TOKEN_EXPIRE_TIME);

  const refreshToken = generateOauth2Token();
  const refreshExpiresAt = dateToDateTime(Date.now() + REFRESH_TOKEN_EXPIRE_TIME);

  await prisma.applicationUserGrant.update({
    where: { id: grant.id },
    data: {
      accessToken,
      accessExpiresAt,
      refreshToken,
      refreshExpiresAt,
    },
  });

  const result = {
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRE_TIME / 1000,
    refreshToken,
  };

  return [result, null] as const;
};

interface GetOAuth2ApplicationOpts {
  clientId: string;
  redirectUri: string;
  userId: string;
}

export const getOAuthApplication = async (opts: GetOAuth2ApplicationOpts) => {
  if (!opts.userId) {
    return [null, generateError('Unauthorized')] as const;
  }
  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { id: true, username: true, tag: true, badges: true, hexColor: true, avatar: true, account: { select: { id: true } } } });
  if (!user) {
    return [null, generateError('Unauthorized')] as const;
  }
  if (!user.account) {
    return [null, generateError('Unauthorized')] as const;
  }

  const application = await prisma.application.findUnique({ where: { id: opts.clientId }, select: { redirectUris: true, createdAt: true, creatorAccount: { select: { user: { select: { hexColor: true, username: true, id: true, badges: true, tag: true } } } }, id: true, name: true, botUser: { select: { id: true, avatar: true, banner: true, badges: true, hexColor: true } } } });
  if (!application) {
    return [null, generateError('Invalid client ID.')] as const;
  }

  if (!application.redirectUris.includes(opts.redirectUri)) {
    return [null, generateError('Invalid redirect URI.')] as const;
  }
  return [{ application: { ...application, redirectUris: undefined }, user }, null] as const;
};

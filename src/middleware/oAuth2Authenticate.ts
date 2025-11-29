import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';
import { prisma, publicUserExcludeFields } from '@src/common/database';
import { hasBit } from '@src/common/Bitwise';

interface Options {
  allowNoToken?: boolean;
  scopes?: number;
}

export interface OAuth2GrantCache {
  accessExpiresAt: Date | null;
  scopes: number;
  user: {
    id: string;
    account: {
      email: string;
    };
  };
}

export function oAuth2Authenticate(opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization');
    if (!token) {
      if (opts?.allowNoToken) {
        return next();
      }
      return res.status(401).json(generateError('No token provided.'));
    }

    const applicationUserGrant = await prisma.applicationUserGrant.findUnique({
      where: {
        accessToken: token,
      },
      select: {
        accessExpiresAt: true,
        scopes: true,
        user: {
          select: {
            ...publicUserExcludeFields,

            account: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });
    if (!applicationUserGrant) {
      return res.status(404).json(generateError('Invalid token.'));
    }
    if (!applicationUserGrant.user.account) {
      return res.status(404).json(generateError('Invalid token.'));
    }

    if (!applicationUserGrant.accessExpiresAt) {
      return res.status(401).json(generateError('Token expired. Please try again.'));
    }

    if (applicationUserGrant.accessExpiresAt.getTime() < Date.now()) {
      return res.status(401).json(generateError('Token expired. Please try again.'));
    }

    if (opts?.scopes && !hasBit(applicationUserGrant.scopes, opts.scopes)) {
      return res.status(401).json(generateError('Scope not allowed.'));
    }

    // Ensure the type matches OAuth2GrantCache
    req.oAuth2Grant = {
      accessExpiresAt: applicationUserGrant.accessExpiresAt,
      scopes: applicationUserGrant.scopes,
      user: {
        ...applicationUserGrant.user,
        account: {
          email: applicationUserGrant.user.account.email,
        },
      },
    };
    next();
  };
}

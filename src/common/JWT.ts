import jwt from 'jsonwebtoken';
import env from './env';

const jwtHeader = 'eyJhbGciOiJIUzI1NiJ9.';

export function generateToken(userId: string, passwordVersion: number, jwtSecret?: string) {
  const token = jwt.sign(`${userId}-${passwordVersion}`, jwtSecret || env.JWT_SECRET);
  const tokenWithoutHeader = token.split('.').splice(1).join('.');
  return tokenWithoutHeader;
}

export function decryptToken(token: string, jwtSecret?: string) {
  try {
    const tokenWithHeader = jwtHeader + token;
    const decrypted = jwt.verify(tokenWithHeader, jwtSecret || env.JWT_SECRET) as string;
    if (!decrypted) return null;
    const [userId, passwordVersion] = decrypted.split('-');
    if (!userId || !passwordVersion) return null;
    return { userId, passwordVersion: parseInt(passwordVersion) };
  } catch (error) {
    return null;
  }
}

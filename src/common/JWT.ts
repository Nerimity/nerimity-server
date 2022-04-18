import jwt from 'jsonwebtoken';
import env from './env';

const jwtHeader = 'eyJhbGciOiJIUzI1NiJ9.';

export function generateToken(userId: string, passwordVersion: number) {
  const token =  jwt.sign(`${userId}-${passwordVersion}`, env.JWT_SECRET);
  const tokenWithoutHeader = token.split('.').splice(1).join('.');
  return tokenWithoutHeader;
}

export function decryptToken(token: string) {
  const tokenWithHeader = jwtHeader + token;
  const decrypted = jwt.verify(tokenWithHeader, env.JWT_SECRET) as string;
  if (!decrypted) return null;
  const [userId, passwordVersion] = decrypted.split('-');
  return { userId, passwordVersion: parseInt(passwordVersion) };
}
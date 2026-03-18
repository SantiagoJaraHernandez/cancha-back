import jwt from 'jsonwebtoken';
import { env } from '../config/env';

type JwtPayload = {
  id: string;
  email?: string;
  role?: string;
  type?: string;
};

const ACCESS_EXPIRES = '15m' as const;
const REFRESH_EXPIRES = '7d' as const;

export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ id: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
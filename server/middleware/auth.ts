import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.ts';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
    return;
  }

  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}

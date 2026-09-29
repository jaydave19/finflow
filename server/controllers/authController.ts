import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.ts';
import { DEFAULT_CATEGORIES } from '../db/seed.ts';

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email and password are required' });
    return;
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await db.query(
    `INSERT INTO users (id, name, email, password_hash, currency, theme)
     VALUES ($1, $2, $3, $4, 'INR', 'system')`,
    [userId, name.trim(), email.toLowerCase().trim(), passwordHash]
  );

  // Initialize default categories for new user (no initial budget set)
  for (const cat of DEFAULT_CATEGORIES) {
    await db.query(
      `INSERT INTO categories (id, user_id, name, icon, color, monthly_budget, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [crypto.randomUUID(), userId, cat.name, cat.icon, cat.color, 0, true]
    );
  }

  // Initialize overall budget as 0 (no initial budget set)
  await db.query(
    `INSERT INTO budgets (id, user_id, month, year, overall_budget)
     VALUES ($1, $2, $3, $4, 0)`,
    [crypto.randomUUID(), userId, now.getMonth() + 1, now.getFullYear()]
  );

  const accessToken = signAccessToken({ userId, email: email.toLowerCase().trim() });
  const refreshToken = signRefreshToken({ userId, email: email.toLowerCase().trim() });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), userId, refreshToken, expiresAt.toISOString()]
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    user: {
      id: userId,
      name,
      email: email.toLowerCase().trim(),
      currency: 'INR',
      theme: 'system',
      avatar: null,
    },
    accessToken,
    refreshToken,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = await db.query(
    'SELECT id, name, email, password_hash, avatar, currency, theme, notification_prefs FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), user.id, refreshToken, expiresAt.toISOString()]
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      currency: user.currency || 'INR',
      theme: user.theme || 'system',
      notificationPrefs: typeof user.notification_prefs === 'string'
        ? JSON.parse(user.notification_prefs)
        : user.notification_prefs,
    },
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const stored = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2',
    [token, payload.userId]
  );

  if (stored.rows.length === 0) {
    res.status(401).json({ error: 'Revoked refresh token' });
    return;
  }

  const userRes = await db.query(
    'SELECT id, name, email, avatar, currency, theme, notification_prefs FROM users WHERE id = $1',
    [payload.userId]
  );

  if (userRes.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = userRes.rows[0];
  const newAccessToken = signAccessToken({ userId: user.id, email: user.email });

  res.json({
    accessToken: newAccessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      currency: user.currency || 'INR',
      theme: user.theme || 'system',
      notificationPrefs: typeof user.notification_prefs === 'string'
        ? JSON.parse(user.notification_prefs)
        : user.notification_prefs,
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (token) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const userRes = await db.query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (userRes.rows.length === 0) {
    // Return success to avoid email enumeration
    res.json({ message: 'If an account exists, a reset code was generated.' });
    return;
  }

  const user = userRes.rows[0];
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
  await db.query(
    'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [crypto.randomUUID(), user.id, resetToken, expiresAt.toISOString()]
  );

  // Return reset token in response for testing/demo convenience!
  res.json({
    message: 'Reset code generated successfully.',
    demoResetCode: resetToken,
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    res.status(400).json({ error: 'Email, reset code and new password are required' });
    return;
  }

  const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (userRes.rows.length === 0) {
    res.status(400).json({ error: 'Invalid reset code or email' });
    return;
  }

  const user = userRes.rows[0];
  const resetRes = await db.query(
    'SELECT * FROM password_resets WHERE user_id = $1 AND token = $2 AND expires_at > $3',
    [user.id, code.trim(), new Date().toISOString()]
  );

  if (resetRes.rows.length === 0) {
    res.status(400).json({ error: 'Invalid or expired reset code' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
  await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);

  res.json({ message: 'Password has been reset successfully. You can now login.' });
}

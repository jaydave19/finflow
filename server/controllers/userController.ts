import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'SELECT id, name, email, avatar, currency, theme, notification_prefs, created_at FROM users WHERE id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const u = result.rows[0];
  res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    currency: u.currency || 'INR',
    theme: u.theme || 'system',
    notificationPrefs: typeof u.notification_prefs === 'string'
      ? JSON.parse(u.notification_prefs)
      : u.notification_prefs,
    createdAt: u.created_at,
  });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, avatar, currentPassword, newPassword } = req.body;

  const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  if (userRes.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // If changing password, verify current password
  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to change password' });
      return;
    }
    const match = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!match) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    params.push(name.trim());
  }

  if (avatar !== undefined) {
    updates.push(`avatar = $${paramIdx++}`);
    params.push(avatar);
  }

  if (updates.length > 0) {
    params.push(req.userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
  }

  const updated = await db.query(
    'SELECT id, name, email, avatar, currency, theme, notification_prefs FROM users WHERE id = $1',
    [req.userId]
  );
  const u = updated.rows[0];

  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      currency: u.currency || 'INR',
      theme: u.theme || 'system',
      notificationPrefs: typeof u.notification_prefs === 'string'
        ? JSON.parse(u.notification_prefs)
        : u.notification_prefs,
    },
    message: 'Profile updated successfully',
  });
}

export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { currency, theme, notificationPrefs } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (currency !== undefined) {
    updates.push(`currency = $${paramIdx++}`);
    params.push(currency);
  }
  if (theme !== undefined) {
    updates.push(`theme = $${paramIdx++}`);
    params.push(theme);
  }
  if (notificationPrefs !== undefined) {
    updates.push(`notification_prefs = $${paramIdx++}`);
    params.push(JSON.stringify(notificationPrefs));
  }

  if (updates.length > 0) {
    params.push(req.userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
  }

  res.json({ message: 'Settings updated successfully' });
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { confirmation } = req.body;
  if (confirmation !== 'DELETE') {
    res.status(400).json({ error: 'Please type DELETE to confirm account deletion' });
    return;
  }

  await db.query('DELETE FROM users WHERE id = $1', [req.userId]);
  res.clearCookie('refreshToken');
  res.json({ message: 'Account permanently deleted' });
}

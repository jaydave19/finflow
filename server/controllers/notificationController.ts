import { Response } from 'express';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.userId]
  );

  const notifications = result.rows.map(r => ({
    id: r.id,
    type: r.type,
    message: r.message,
    isRead: r.is_read,
    link: r.link,
    createdAt: r.created_at,
  }));

  const unreadCount = notifications.filter(n => !n.isRead).length;

  res.json({ notifications, unreadCount });
}

export async function markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  await db.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  res.json({ message: 'Notification marked as read' });
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.userId]);
  res.json({ message: 'All notifications marked as read' });
}

export async function clearNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  await db.query('DELETE FROM notifications WHERE user_id = $1', [req.userId]);
  res.json({ message: 'Notifications cleared' });
}

import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    `SELECT * FROM categories 
     WHERE user_id = $1 AND is_deleted = false 
     ORDER BY is_default DESC, name ASC`,
    [req.userId]
  );

  const categories = result.rows.map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    monthlyBudget: Number(r.monthly_budget || 0),
    isDefault: r.is_default,
    createdAt: r.created_at,
  }));

  res.json({ categories });
}

export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, icon, color, monthlyBudget } = req.body;

  if (!name || !icon || !color) {
    res.status(400).json({ error: 'Category name, icon, and color are required' });
    return;
  }

  // Check unique name for this user
  const existing = await db.query(
    'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND is_deleted = false',
    [req.userId, name.trim()]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'A category with this name already exists' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO categories (id, user_id, name, icon, color, monthly_budget, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, false)`,
    [id, req.userId, name.trim(), icon, color, monthlyBudget ? Number(monthlyBudget) : 0]
  );

  res.status(201).json({ id, message: 'Category created successfully' });
}

export async function updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, icon, color, monthlyBudget } = req.body;

  const existing = await db.query(
    'SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  await db.query(
    `UPDATE categories SET 
      name = COALESCE($1, name),
      icon = COALESCE($2, icon),
      color = COALESCE($3, color),
      monthly_budget = COALESCE($4, monthly_budget)
     WHERE id = $5 AND user_id = $6`,
    [
      name ? name.trim() : null,
      icon,
      color,
      monthlyBudget !== undefined ? Number(monthlyBudget) : null,
      req.params.id,
      req.userId,
    ]
  );

  res.json({ message: 'Category updated successfully' });
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await db.query(
    'SELECT id, is_default FROM categories WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  await db.query(
    'UPDATE categories SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  res.json({ message: 'Category deleted (soft-delete). You can undo within 8 seconds.', id: req.params.id });
}

export async function restoreCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'UPDATE categories SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  res.json({ message: 'Category restored successfully', id: req.params.id });
}

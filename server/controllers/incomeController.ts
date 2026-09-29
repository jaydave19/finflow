import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getIncomes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'SELECT * FROM incomes WHERE user_id = $1 AND is_deleted = false ORDER BY date DESC, created_at DESC',
    [req.userId]
  );

  const incomes = result.rows.map(r => ({
    id: r.id,
    amount: Number(r.amount),
    source: r.source,
    date: r.date,
    note: r.note,
    createdAt: r.created_at,
  }));

  res.json({ incomes });
}

export async function createIncome(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, source, date, note } = req.body;

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'Valid positive amount is required' });
    return;
  }
  if (!source) {
    res.status(400).json({ error: 'Income source is required' });
    return;
  }
  if (!date) {
    res.status(400).json({ error: 'Income date is required' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO incomes (id, user_id, amount, source, date, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, req.userId, amount, source, date, note || '']
  );

  res.status(201).json({ id, message: 'Income added successfully' });
}

export async function updateIncome(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, source, date, note } = req.body;

  const existing = await db.query('SELECT id FROM incomes WHERE id = $1 AND user_id = $2 AND is_deleted = false', [
    req.params.id,
    req.userId,
  ]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Income record not found' });
    return;
  }

  await db.query(
    `UPDATE incomes SET 
      amount = COALESCE($1, amount),
      source = COALESCE($2, source),
      date = COALESCE($3, date),
      note = COALESCE($4, note)
     WHERE id = $5 AND user_id = $6`,
    [amount, source, date, note, req.params.id, req.userId]
  );

  res.json({ message: 'Income updated successfully' });
}

export async function deleteIncome(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await db.query('SELECT id FROM incomes WHERE id = $1 AND user_id = $2 AND is_deleted = false', [
    req.params.id,
    req.userId,
  ]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Income record not found' });
    return;
  }

  await db.query(
    'UPDATE incomes SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  res.json({ message: 'Income deleted (soft-delete). You can undo this action within 8 seconds.', id: req.params.id });
}

export async function restoreIncome(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'UPDATE incomes SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Income record not found or already permanently removed' });
    return;
  }

  res.json({ message: 'Income restored successfully', id: req.params.id });
}

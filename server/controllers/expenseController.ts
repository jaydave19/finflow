import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 15));
  const offset = (page - 1) * limit;

  const search = (req.query.search as string || '').trim();
  const categoryId = req.query.categoryId as string;
  const paymentMethod = req.query.paymentMethod as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
  const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
  const sortBy = req.query.sortBy === 'amount' ? 'e.amount' : 'e.date';
  const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const isIpoOnly = req.query.isIpoOnly === 'true';

  const conditions: string[] = ['e.user_id = $1', 'e.is_deleted = false'];
  const params: any[] = [userId];
  let paramIdx = 2;

  if (search) {
    conditions.push(`(e.note ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (categoryId) {
    conditions.push(`e.category_id = $${paramIdx++}`);
    params.push(categoryId);
  }

  if (paymentMethod) {
    conditions.push(`e.payment_method = $${paramIdx++}`);
    params.push(paymentMethod);
  }

  if (startDate) {
    conditions.push(`e.date >= $${paramIdx++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`e.date <= $${paramIdx++}`);
    params.push(endDate);
  }

  if (minAmount !== undefined && !isNaN(minAmount)) {
    conditions.push(`e.amount >= $${paramIdx++}`);
    params.push(minAmount);
  }

  if (maxAmount !== undefined && !isNaN(maxAmount)) {
    conditions.push(`e.amount <= $${paramIdx++}`);
    params.push(maxAmount);
  }

  if (isIpoOnly) {
    conditions.push(`e.ipo_details IS NOT NULL`);
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM expenses e 
    LEFT JOIN categories c ON e.category_id = c.id 
    WHERE ${whereClause}
  `;
  const countRes = await db.query(countQuery, params);
  const total = parseInt(countRes.rows[0].total, 10);

  const dataQuery = `
    SELECT 
      e.id, e.amount, e.date, e.payment_method, e.note, e.tags,
      e.is_recurring, e.recurrence_type, e.next_due_date, e.ipo_details,
      e.created_at,
      c.id as category_id, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}, e.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  params.push(limit, offset);

  const dataRes = await db.query(dataQuery, params);

  const expenses = dataRes.rows.map(row => ({
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    paymentMethod: row.payment_method,
    note: row.note,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    isRecurring: row.is_recurring,
    recurrenceType: row.recurrence_type,
    nextDueDate: row.next_due_date,
    ipoDetails: typeof row.ipo_details === 'string' ? JSON.parse(row.ipo_details) : row.ipo_details,
    category: row.category_id ? {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    } : null,
    createdAt: row.created_at,
  }));

  res.json({
    expenses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function getExpenseById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.id = $1 AND e.user_id = $2 AND e.is_deleted = false`,
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  const row = result.rows[0];
  res.json({
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    paymentMethod: row.payment_method,
    note: row.note,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    isRecurring: row.is_recurring,
    recurrenceType: row.recurrence_type,
    nextDueDate: row.next_due_date,
    ipoDetails: typeof row.ipo_details === 'string' ? JSON.parse(row.ipo_details) : row.ipo_details,
    category: row.category_id ? {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    } : null,
    createdAt: row.created_at,
  });
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    amount,
    categoryId,
    date,
    paymentMethod,
    note,
    tags,
    isRecurring,
    recurrenceType,
    nextDueDate,
    ipoDetails,
  } = req.body;

  if (amount === undefined || amount <= 0) {
    res.status(400).json({ error: 'Valid positive amount is required' });
    return;
  }
  if (!date) {
    res.status(400).json({ error: 'Expense date is required' });
    return;
  }
  if (!paymentMethod) {
    res.status(400).json({ error: 'Payment method is required' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO expenses (
      id, user_id, category_id, amount, date, payment_method, note, tags,
      is_recurring, recurrence_type, next_due_date, ipo_details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      req.userId,
      categoryId || null,
      amount,
      date,
      paymentMethod,
      note || '',
      JSON.stringify(tags || []),
      isRecurring || false,
      recurrenceType || null,
      nextDueDate || null,
      ipoDetails ? JSON.stringify(ipoDetails) : null,
    ]
  );

  // If this is an IPO application with funds blocked, notify user
  if (ipoDetails && (ipoDetails.status === 'Blocked' || ipoDetails.status === 'Applied')) {
    await db.query(
      `INSERT INTO notifications (id, user_id, type, message, link)
       VALUES ($1, $2, 'ipo_update', $3, '/ipo')`,
      [
        crypto.randomUUID(),
        req.userId,
        `₹${Number(amount).toLocaleString()} ASBA capital blocked for ${ipoDetails.ipoName || 'IPO application'}.`,
      ]
    );
  }

  res.status(201).json({ id, message: 'Expense created successfully' });
}

export async function updateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    amount,
    categoryId,
    date,
    paymentMethod,
    note,
    tags,
    isRecurring,
    recurrenceType,
    nextDueDate,
    ipoDetails,
  } = req.body;

  const existing = await db.query(
    'SELECT id FROM expenses WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  await db.query(
    `UPDATE expenses SET 
      amount = COALESCE($1, amount),
      category_id = $2,
      date = COALESCE($3, date),
      payment_method = COALESCE($4, payment_method),
      note = COALESCE($5, note),
      tags = COALESCE($6, tags),
      is_recurring = COALESCE($7, is_recurring),
      recurrence_type = $8,
      next_due_date = $9,
      ipo_details = $10
     WHERE id = $11 AND user_id = $12`,
    [
      amount,
      categoryId || null,
      date,
      paymentMethod,
      note,
      tags ? JSON.stringify(tags) : null,
      isRecurring,
      recurrenceType || null,
      nextDueDate || null,
      ipoDetails ? JSON.stringify(ipoDetails) : null,
      req.params.id,
      req.userId,
    ]
  );

  res.json({ message: 'Expense updated successfully' });
}

export async function deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  // Soft delete for undo support
  const existing = await db.query(
    'SELECT id, note, amount FROM expenses WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  await db.query(
    'UPDATE expenses SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  res.json({
    message: 'Expense deleted (soft-delete). You can undo this action within 8 seconds.',
    id: req.params.id,
  });
}

export async function restoreExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'UPDATE expenses SET is_deleted = false, deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Expense not found or already permanently removed' });
    return;
  }

  res.json({ message: 'Expense restored successfully', id: req.params.id });
}

export async function duplicateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await db.query(
    'SELECT * FROM expenses WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  const exp = result.rows[0];
  const newId = crypto.randomUUID();
  const today = new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO expenses (
      id, user_id, category_id, amount, date, payment_method, note, tags, ipo_details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId,
      req.userId,
      exp.category_id,
      exp.amount,
      today,
      exp.payment_method,
      `${exp.note || 'Expense'} (Copy)`,
      typeof exp.tags === 'string' ? exp.tags : JSON.stringify(exp.tags || []),
      exp.ipo_details ? (typeof exp.ipo_details === 'string' ? exp.ipo_details : JSON.stringify(exp.ipo_details)) : null,
    ]
  );

  res.status(201).json({ id: newId, message: 'Expense duplicated successfully' });
}

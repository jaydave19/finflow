import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getCards(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;

  const result = await db.query(
    `SELECT * FROM credit_cards 
     WHERE user_id = $1 AND is_deleted = false 
     ORDER BY created_at DESC`,
    [userId]
  );

  const cardsWithStats = await Promise.all(
    result.rows.map(async row => {
      const expRes = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as current_spent, COUNT(*) as tx_count 
         FROM expenses 
         WHERE card_id = $1 AND user_id = $2 AND is_deleted = false`,
        [row.id, userId]
      );

      const limit = Number(row.credit_limit);
      const spent = Number(expRes.rows[0].current_spent);
      const txCount = parseInt(expRes.rows[0].tx_count, 10);
      const available = Math.max(0, limit - spent);
      const utilization = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

      return {
        id: row.id,
        cardName: row.card_name,
        bankName: row.bank_name,
        last4: row.card_number_last4,
        cardNetwork: row.card_network || 'Visa',
        creditLimit: limit,
        currentSpent: spent,
        availableCredit: available,
        utilizationRate: utilization,
        txCount,
        billingCycleDay: row.billing_cycle_day || 1,
        dueDateDay: row.due_date_day || 20,
        color: row.color || '#4F46E5',
        createdAt: row.created_at,
      };
    })
  );

  const totalCreditLimit = cardsWithStats.reduce((acc, c) => acc + c.creditLimit, 0);
  const totalSpent = cardsWithStats.reduce((acc, c) => acc + c.currentSpent, 0);
  const totalAvailable = Math.max(0, totalCreditLimit - totalSpent);
  const overallUtilization =
    totalCreditLimit > 0 ? Math.round((totalSpent / totalCreditLimit) * 100) : 0;

  res.json({
    cards: cardsWithStats,
    summary: {
      totalCreditLimit,
      totalSpent,
      totalAvailable,
      overallUtilization,
      cardsCount: cardsWithStats.length,
    },
  });
}

export async function getCardById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const cardId = req.params.id;

  const result = await db.query(
    'SELECT * FROM credit_cards WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [cardId, userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Credit card not found' });
    return;
  }

  const row = result.rows[0];

  const expRes = await db.query(
    `SELECT e.id, e.amount, e.date, e.note, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.card_id = $1 AND e.user_id = $2 AND e.is_deleted = false
     ORDER BY e.date DESC, e.created_at DESC
     LIMIT 25`,
    [cardId, userId]
  );

  const totalSpentRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as tx_count
     FROM expenses
     WHERE card_id = $1 AND user_id = $2 AND is_deleted = false`,
    [cardId, userId]
  );

  const limit = Number(row.credit_limit);
  const currentSpent = Number(totalSpentRes.rows[0].total_spent);
  const availableCredit = Math.max(0, limit - currentSpent);
  const utilizationRate = limit > 0 ? Math.min(100, Math.round((currentSpent / limit) * 100)) : 0;

  res.json({
    card: {
      id: row.id,
      cardName: row.card_name,
      bankName: row.bank_name,
      last4: row.card_number_last4,
      cardNetwork: row.card_network || 'Visa',
      creditLimit: limit,
      currentSpent,
      availableCredit,
      utilizationRate,
      billingCycleDay: row.billing_cycle_day || 1,
      dueDateDay: row.due_date_day || 20,
      color: row.color || '#4F46E5',
      createdAt: row.created_at,
    },
    transactions: expRes.rows.map(r => ({
      id: r.id,
      amount: Number(r.amount),
      date: r.date,
      note: r.note,
      categoryName: r.category_name || 'Uncategorized',
      categoryColor: r.category_color || '#64748B',
      categoryIcon: r.category_icon || 'CreditCard',
    })),
  });
}

export async function createCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    cardName,
    bankName,
    last4,
    cardNetwork,
    creditLimit,
    billingCycleDay,
    dueDateDay,
    color,
  } = req.body;

  if (!cardName || !bankName) {
    res.status(400).json({ error: 'Card name and bank name are required' });
    return;
  }

  const cleanLast4 = String(last4 || '').trim().replace(/\D/g, '');
  if (!cleanLast4 || cleanLast4.length !== 4) {
    res.status(400).json({ error: 'Please enter valid 4 digits for card number' });
    return;
  }

  const limitNum = parseFloat(creditLimit);
  if (isNaN(limitNum) || limitNum <= 0) {
    res.status(400).json({ error: 'Please provide a valid positive credit limit' });
    return;
  }

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO credit_cards (
      id, user_id, card_name, bank_name, card_number_last4, card_network,
      credit_limit, billing_cycle_day, due_date_day, color
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      req.userId,
      cardName.trim(),
      bankName.trim(),
      cleanLast4,
      cardNetwork || 'Visa',
      limitNum,
      parseInt(billingCycleDay, 10) || 1,
      parseInt(dueDateDay, 10) || 20,
      color || '#4F46E5',
    ]
  );

  res.status(201).json({ id, message: 'Credit card added successfully' });
}

export async function updateCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    cardName,
    bankName,
    last4,
    cardNetwork,
    creditLimit,
    billingCycleDay,
    dueDateDay,
    color,
  } = req.body;

  const existing = await db.query(
    'SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Credit card not found' });
    return;
  }

  let cleanLast4 = last4 !== undefined ? String(last4).trim().replace(/\D/g, '') : undefined;
  if (cleanLast4 !== undefined && cleanLast4.length !== 4) {
    cleanLast4 = undefined;
  }

  await db.query(
    `UPDATE credit_cards SET
      card_name = COALESCE($1, card_name),
      bank_name = COALESCE($2, bank_name),
      card_number_last4 = COALESCE($3, card_number_last4),
      card_network = COALESCE($4, card_network),
      credit_limit = COALESCE($5, credit_limit),
      billing_cycle_day = COALESCE($6, billing_cycle_day),
      due_date_day = COALESCE($7, due_date_day),
      color = COALESCE($8, color)
     WHERE id = $9 AND user_id = $10`,
    [
      cardName ? cardName.trim() : null,
      bankName ? bankName.trim() : null,
      cleanLast4 || null,
      cardNetwork || null,
      creditLimit !== undefined ? parseFloat(creditLimit) : null,
      billingCycleDay !== undefined ? parseInt(billingCycleDay, 10) : null,
      dueDateDay !== undefined ? parseInt(dueDateDay, 10) : null,
      color || null,
      req.params.id,
      req.userId,
    ]
  );

  res.json({ message: 'Credit card updated successfully' });
}

export async function deleteCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await db.query(
    'SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2 AND is_deleted = false',
    [req.params.id, req.userId]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Credit card not found' });
    return;
  }

  await db.query(
    'UPDATE credit_cards SET is_deleted = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );

  res.json({ message: 'Credit card removed successfully' });
}

import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function exportBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;

  const userRes = await db.query('SELECT name, email, currency, theme, notification_prefs FROM users WHERE id = $1', [userId]);
  const categoriesRes = await db.query('SELECT name, icon, color, monthly_budget, is_default FROM categories WHERE user_id = $1 AND is_deleted = false', [userId]);
  const expensesRes = await db.query('SELECT amount, date, payment_method, note, tags, is_recurring, recurrence_type, next_due_date, ipo_details FROM expenses WHERE user_id = $1 AND is_deleted = false', [userId]);
  const incomesRes = await db.query('SELECT amount, source, date, note FROM incomes WHERE user_id = $1 AND is_deleted = false', [userId]);
  const budgetsRes = await db.query('SELECT month, year, overall_budget FROM budgets WHERE user_id = $1', [userId]);
  const notificationsRes = await db.query('SELECT type, message, is_read, link, created_at FROM notifications WHERE user_id = $1', [userId]);

  const backupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    user: userRes.rows[0],
    categories: categoriesRes.rows,
    expenses: expensesRes.rows.map(r => ({
      ...r,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
      ipo_details: typeof r.ipo_details === 'string' ? JSON.parse(r.ipo_details) : r.ipo_details,
    })),
    incomes: incomesRes.rows,
    budgets: budgetsRes.rows,
    notifications: notificationsRes.rows,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=finflow_backup_${Date.now()}.json`);
  res.json(backupData);
}

export async function importBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const { data, mode = 'merge' } = req.body;

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Valid JSON backup data is required' });
    return;
  }

  // If replace mode, clear existing user data first
  if (mode === 'replace') {
    await db.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM incomes WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM budgets WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM categories WHERE user_id = $1 AND is_default = false', [userId]);
  }

  // Map category names to IDs
  const catRes = await db.query('SELECT id, name FROM categories WHERE user_id = $1 AND is_deleted = false', [userId]);
  const catMap: Record<string, string> = {};
  for (const c of catRes.rows) {
    catMap[c.name.toLowerCase()] = c.id;
  }

  // Import categories
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      if (!c.name) continue;
      const key = c.name.toLowerCase();
      if (!catMap[key]) {
        const newCatId = crypto.randomUUID();
        await db.query(
          `INSERT INTO categories (id, user_id, name, icon, color, monthly_budget, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newCatId, userId, c.name, c.icon || 'Tag', c.color || '#3B82F6', c.monthly_budget || 0, false]
        );
        catMap[key] = newCatId;
      }
    }
  }

  // Import expenses
  let importedExpenses = 0;
  if (Array.isArray(data.expenses)) {
    for (const exp of data.expenses) {
      if (!exp.amount || !exp.date) continue;
      const expId = crypto.randomUUID();
      const catId = exp.category_name ? catMap[exp.category_name.toLowerCase()] : (catMap['others'] || null);
      await db.query(
        `INSERT INTO expenses (
          id, user_id, category_id, amount, date, payment_method, note, tags,
          is_recurring, recurrence_type, next_due_date, ipo_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          expId,
          userId,
          catId,
          exp.amount,
          exp.date,
          exp.payment_method || 'UPI',
          exp.note || '',
          JSON.stringify(exp.tags || []),
          exp.is_recurring || false,
          exp.recurrence_type || null,
          exp.next_due_date || null,
          exp.ipo_details ? JSON.stringify(exp.ipo_details) : null,
        ]
      );
      importedExpenses++;
    }
  }

  // Import incomes
  let importedIncomes = 0;
  if (Array.isArray(data.incomes)) {
    for (const inc of data.incomes) {
      if (!inc.amount || !inc.date) continue;
      await db.query(
        'INSERT INTO incomes (id, user_id, amount, source, date, note) VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), userId, inc.amount, inc.source || 'Other', inc.date, inc.note || '']
      );
      importedIncomes++;
    }
  }

  // Import budgets
  if (Array.isArray(data.budgets)) {
    for (const b of data.budgets) {
      if (b.month && b.year && b.overall_budget) {
        await db.query(
          `INSERT INTO budgets (id, user_id, month, year, overall_budget)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), userId, b.month, b.year, b.overall_budget]
        );
      }
    }
  }

  res.json({
    message: `Data imported successfully (${mode} mode).`,
    importedExpenses,
    importedIncomes,
  });
}

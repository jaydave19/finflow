import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function getBudgets(req: AuthenticatedRequest, res: Response): Promise<void> {
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  // Fetch overall budget
  const overallRes = await db.query(
    'SELECT id, overall_budget FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
    [req.userId, month, year]
  );
  const overallBudget = overallRes.rows.length > 0 ? Number(overallRes.rows[0].overall_budget) : 0;

  // Fetch total expenses this month
  const totalSpentRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total_spent 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3`,
    [req.userId, monthStart, monthEnd]
  );
  const totalSpent = Number(totalSpentRes.rows[0].total_spent);

  // Fetch categories with their monthly budget and current spending this month
  const catRes = await db.query(
    `SELECT 
      c.id, c.name, c.icon, c.color, c.monthly_budget,
      COALESCE(SUM(e.amount), 0) as spent
     FROM categories c
     LEFT JOIN expenses e ON c.id = e.category_id 
       AND e.user_id = $1 
       AND e.is_deleted = false 
       AND e.date >= $2 
       AND e.date <= $3
     WHERE c.user_id = $1 AND c.is_deleted = false
     GROUP BY c.id, c.name, c.icon, c.color, c.monthly_budget
     ORDER BY c.name ASC`,
    [req.userId, monthStart, monthEnd]
  );

  const categories = catRes.rows.map(r => {
    const budget = Number(r.monthly_budget || 0);
    const spent = Number(r.spent || 0);
    const percentage = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    return {
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      budget,
      spent,
      remaining: Math.max(0, budget - spent),
      percentage,
      isExceeded: budget > 0 && spent > budget,
      isWarning: budget > 0 && spent >= budget * 0.8 && spent <= budget,
    };
  });

  res.json({
    month,
    year,
    overallBudget,
    totalSpent,
    remainingBudget: Math.max(0, overallBudget - totalSpent),
    percentageUsed: overallBudget > 0 ? Math.min(100, Math.round((totalSpent / overallBudget) * 100)) : 0,
    isOverallExceeded: overallBudget > 0 && totalSpent > overallBudget,
    isOverallWarning: overallBudget > 0 && totalSpent >= overallBudget * 0.8 && totalSpent <= overallBudget,
    categories,
  });
}

export async function setBudget(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { month, year, overallBudget, categoryBudgets } = req.body;

  if (!month || !year) {
    res.status(400).json({ error: 'Month and year are required' });
    return;
  }

  // Upsert overall budget
  if (overallBudget !== undefined) {
    const existing = await db.query(
      'SELECT id FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.userId, month, year]
    );

    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE budgets SET overall_budget = $1 WHERE user_id = $2 AND month = $3 AND year = $4',
        [overallBudget, req.userId, month, year]
      );
    } else {
      await db.query(
        'INSERT INTO budgets (id, user_id, month, year, overall_budget) VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), req.userId, month, year, overallBudget]
      );
    }
  }

  // Update category budgets if provided
  if (Array.isArray(categoryBudgets)) {
    for (const item of categoryBudgets) {
      if (item.categoryId && item.monthlyBudget !== undefined) {
        await db.query(
          'UPDATE categories SET monthly_budget = $1 WHERE id = $2 AND user_id = $3',
          [item.monthlyBudget, item.categoryId, req.userId]
        );
      }
    }
  }

  res.json({ message: 'Budget saved successfully' });
}

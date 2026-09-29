import crypto from 'crypto';
import { db } from '../db/database.ts';

export class CronService {
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    // Run immediately on boot, then every 30 minutes
    this.runTasks().catch(console.error);
    this.timer = setInterval(() => {
      this.runTasks().catch(console.error);
    }, 30 * 60 * 1000);
    console.log('CronService: Recurring scheduler and reminders initialized.');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runTasks(): Promise<void> {
    try {
      await this.processRecurringExpenses();
      await this.processBillReminders();
      await this.checkBudgets();
      await this.purgeSoftDeleted();
    } catch (err) {
      console.error('CronService error running scheduled tasks:', err);
    }
  }

  private async processRecurringExpenses(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const res = await db.query(
      `SELECT * FROM expenses 
       WHERE is_recurring = true 
         AND is_deleted = false 
         AND next_due_date IS NOT NULL 
         AND next_due_date <= $1`,
      [today]
    );

    for (const exp of res.rows) {
      // Create new expense entry for this recurrence
      const newId = crypto.randomUUID();
      await db.query(
        `INSERT INTO expenses (id, user_id, category_id, amount, date, payment_method, note, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newId,
          exp.user_id,
          exp.category_id,
          exp.amount,
          exp.next_due_date,
          exp.payment_method,
          `${exp.note || 'Recurring bill'} (Auto-recorded)`,
          typeof exp.tags === 'string' ? exp.tags : JSON.stringify(exp.tags || []),
        ]
      );

      // Calculate next due date
      const d = new Date(exp.next_due_date);
      switch (exp.recurrence_type) {
        case 'daily':
          d.setDate(d.getDate() + 1);
          break;
        case 'weekly':
          d.setDate(d.getDate() + 7);
          break;
        case 'yearly':
          d.setFullYear(d.getFullYear() + 1);
          break;
        case 'monthly':
        default:
          d.setMonth(d.getMonth() + 1);
          break;
      }
      const nextDue = d.toISOString().split('T')[0];

      await db.query(
        `UPDATE expenses SET next_due_date = $1 WHERE id = $2`,
        [nextDue, exp.id]
      );

      // Create notification
      await db.query(
        `INSERT INTO notifications (id, user_id, type, message, link)
         VALUES ($1, $2, 'bill_reminder', $3, '/recurring')`,
        [
          crypto.randomUUID(),
          exp.user_id,
          `Recurring bill "${exp.note || 'Expense'}" of ₹${exp.amount} was auto-recorded. Next due: ${nextDue}`,
        ]
      );
    }
  }

  private async processBillReminders(): Promise<void> {
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + 3);
    const todayStr = now.toISOString().split('T')[0];
    const futureStr = future.toISOString().split('T')[0];

    const res = await db.query(
      `SELECT e.*, u.notification_prefs 
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       WHERE e.is_recurring = true 
         AND e.is_deleted = false 
         AND e.next_due_date > $1 
         AND e.next_due_date <= $2`,
      [todayStr, futureStr]
    );

    for (const exp of res.rows) {
      // Check if reminder notification already sent in past 24 hours
      const existing = await db.query(
        `SELECT id FROM notifications 
         WHERE user_id = $1 
           AND type = 'bill_reminder' 
           AND message LIKE $2 
           AND created_at >= $3`,
        [exp.user_id, `%${exp.note || 'bill'}%`, todayStr]
      );

      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO notifications (id, user_id, type, message, link)
           VALUES ($1, $2, 'bill_reminder', $3, '/recurring')`,
          [
            crypto.randomUUID(),
            exp.user_id,
            `Upcoming bill reminder: "${exp.note || 'Recurring expense'}" of ₹${exp.amount} is due on ${exp.next_due_date}.`,
          ]
        );
      }
    }
  }

  private async checkBudgets(): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

    const users = await db.query('SELECT id FROM users');
    for (const u of users.rows) {
      const budgetRes = await db.query(
        'SELECT overall_budget FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
        [u.id, month, year]
      );

      if (budgetRes.rows.length === 0 || Number(budgetRes.rows[0].overall_budget) <= 0) continue;
      const overall = Number(budgetRes.rows[0].overall_budget);

      const spentRes = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM expenses 
         WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3`,
        [u.id, monthStart, monthEnd]
      );
      const totalSpent = Number(spentRes.rows[0].total);
      const ratio = totalSpent / overall;

      if (ratio >= 1.0) {
        const alreadyAlerted = await db.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 AND type = 'budget_exceeded' AND created_at >= $2`,
          [u.id, monthStart]
        );
        if (alreadyAlerted.rows.length === 0) {
          await db.query(
            `INSERT INTO notifications (id, user_id, type, message, link)
             VALUES ($1, $2, 'budget_exceeded', $3, '/budgets')`,
            [
              crypto.randomUUID(),
              u.id,
              `⚠️ Budget Alert: You have exceeded your monthly budget! Spent: ₹${totalSpent.toLocaleString()} of ₹${overall.toLocaleString()}`,
            ]
          );
        }
      } else if (ratio >= 0.8) {
        const alreadyWarned = await db.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 AND type = 'budget_warning' AND created_at >= $2`,
          [u.id, monthStart]
        );
        if (alreadyWarned.rows.length === 0) {
          await db.query(
            `INSERT INTO notifications (id, user_id, type, message, link)
             VALUES ($1, $2, 'budget_warning', $3, '/budgets')`,
            [
              crypto.randomUUID(),
              u.id,
              `⚡ Budget Warning: You have reached ${Math.round(ratio * 100)}% of your monthly budget (₹${totalSpent.toLocaleString()} / ₹${overall.toLocaleString()}).`,
            ]
          );
        }
      }
    }
  }

  private async purgeSoftDeleted(): Promise<void> {
    // Purge records soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    await db.query(`DELETE FROM expenses WHERE is_deleted = true AND deleted_at < $1`, [dateStr]);
    await db.query(`DELETE FROM incomes WHERE is_deleted = true AND deleted_at < $1`, [dateStr]);
    await db.query(`DELETE FROM categories WHERE is_deleted = true AND deleted_at < $1`, [dateStr]);
  }
}

export const cronService = new CronService();

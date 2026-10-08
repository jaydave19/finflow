import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './database.ts';

export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: 'Utensils', color: '#EF4444', defaultBudget: 0 },
  { name: 'Groceries', icon: 'ShoppingCart', color: '#F97316', defaultBudget: 0 },
  { name: 'Transport', icon: 'Bus', color: '#F59E0B', defaultBudget: 0 },
  { name: 'Fuel', icon: 'Fuel', color: '#EAB308', defaultBudget: 0 },
  { name: 'Rent', icon: 'Home', color: '#84CC16', defaultBudget: 0 },
  { name: 'Bills & Utilities', icon: 'Zap', color: '#10B981', defaultBudget: 0 },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#06B6D4', defaultBudget: 0 },
  { name: 'Health', icon: 'HeartPulse', color: '#3B82F6', defaultBudget: 0 },
  { name: 'Education', icon: 'GraduationCap', color: '#6366F1', defaultBudget: 0 },
  { name: 'Entertainment', icon: 'Film', color: '#8B5CF6', defaultBudget: 0 },
  { name: 'Travel', icon: 'Plane', color: '#EC4899', defaultBudget: 0 },
  { name: 'Subscriptions', icon: 'Tv', color: '#F43F5E', defaultBudget: 0 },
  { name: 'Investment', icon: 'TrendingUp', color: '#14B8A6', defaultBudget: 0 },
  { name: 'Stock Market & IPOs', icon: 'Landmark', color: '#4F46E5', defaultBudget: 0 },
  { name: 'Others', icon: 'MoreHorizontal', color: '#64748B', defaultBudget: 0 },
];

export async function seedDatabase(): Promise<void> {
  try {
    // Helper for date formatting
    const formatDate = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    // 1. Check if demo user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', ['demo@example.com']);
    let userId: string;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      console.log('Seed: Demo user already exists.');
    } else {
      console.log('Seeding initial demo data...');
      userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash('Password123!', 10);

      await db.query(
        `INSERT INTO users (id, name, email, password_hash, avatar, currency, theme, notification_prefs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          'Alex Morgan',
          'demo@example.com',
          passwordHash,
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          'INR',
          'system',
          JSON.stringify({ email: true, inApp: true, daysBefore: 3 }),
        ]
      );

      // Create default categories for demo user (no initial budget set)
      for (const cat of DEFAULT_CATEGORIES) {
        const catId = crypto.randomUUID();
        await db.query(
          `INSERT INTO categories (id, user_id, name, icon, color, monthly_budget, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [catId, userId, cat.name, cat.icon, cat.color, 0, true]
        );
      }

      // Initialize overall budget as 0
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      await db.query(
        `INSERT INTO budgets (id, user_id, month, year, overall_budget)
         VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), userId, currentMonth, currentYear, 0]
      );

      // Add Incomes
      const incomeDates = [
        `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
        `${currentYear}-${String(currentMonth).padStart(2, '0')}-15`,
      ];
      await db.query(
        `INSERT INTO incomes (id, user_id, amount, source, date, note)
         VALUES 
         ($1, $2, 95000, 'Salary', $3, 'Monthly Tech Lead Salary'),
         ($4, $2, 22000, 'Freelance', $5, 'Mobile UI Design Project')`,
        [crypto.randomUUID(), userId, incomeDates[0], crypto.randomUUID(), incomeDates[1]]
      );
    }

    // 2. Ensure Credit Cards exist for the user
    let hdfcCardId = '';
    let iciciCardId = '';
    const cardsRes = await db.query('SELECT id, card_name FROM credit_cards WHERE user_id = $1 AND is_deleted = false', [userId]);

    if (cardsRes.rows.length === 0) {
      hdfcCardId = crypto.randomUUID();
      iciciCardId = crypto.randomUUID();

      await db.query(
        `INSERT INTO credit_cards (
          id, user_id, card_name, bank_name, card_number_last4, card_network,
          credit_limit, billing_cycle_day, due_date_day, color
        ) VALUES 
        ($1, $2, 'Regalia Gold', 'HDFC Bank', '4589', 'Visa', 250000, 1, 20, '#1E3A8A'),
        ($3, $2, 'Amazon Pay ICICI', 'ICICI Bank', '9021', 'Mastercard', 150000, 15, 5, '#D97706')`,
        [hdfcCardId, userId, iciciCardId]
      );
      console.log('Seeded demo Credit Cards: HDFC Regalia Gold & ICICI Amazon Pay.');
    } else {
      hdfcCardId = cardsRes.rows[0].id;
      iciciCardId = cardsRes.rows.length > 1 ? cardsRes.rows[1].id : cardsRes.rows[0].id;
    }

    // 3. Migrate any legacy IPO records out of expenses table into dedicated ipos table
    try {
      const legacyIpos = await db.query(
        `SELECT * FROM expenses WHERE ipo_details IS NOT NULL AND ipo_details::text != 'null'`
      );
      for (const row of legacyIpos.rows) {
        const details = typeof row.ipo_details === 'string' ? JSON.parse(row.ipo_details) : row.ipo_details;
        if (details && (details.ipoName || details.status)) {
          await db.query(
            `INSERT INTO ipos (
              id, user_id, ipo_name, amount, application_date, payment_method,
              shares_count, bid_price, lot_size, status, mandate_status,
              allotment_date, note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              crypto.randomUUID(),
              row.user_id,
              details.ipoName || row.note || 'IPO Application',
              row.amount,
              row.date,
              row.payment_method || 'UPI',
              details.sharesCount || null,
              details.bidPrice || null,
              details.lotSize || 1,
              details.status || 'Blocked',
              details.mandateStatus || 'UPI ASBA Mandate Accepted',
              details.allotmentDate || null,
              row.note || '',
            ]
          );
        }
      }
      if (legacyIpos.rows.length > 0) {
        await db.query(`DELETE FROM expenses WHERE ipo_details IS NOT NULL AND ipo_details::text != 'null'`);
        console.log(`Cleaned up ${legacyIpos.rows.length} IPO entries from expenses table.`);
      }
    } catch {
      // ignore
    }

    // 4. Ensure demo IPO entries exist in dedicated ipos table
    const ipoCountRes = await db.query('SELECT COUNT(*) as count FROM ipos WHERE user_id = $1 AND is_deleted = false', [userId]);
    if (parseInt(ipoCountRes.rows[0].count, 10) === 0) {
      await db.query(
        `INSERT INTO ipos (
          id, user_id, ipo_name, amount, application_date, payment_method,
          shares_count, bid_price, lot_size, status, mandate_status, allotment_date, note
        ) VALUES 
        ($1, $2, 'Bajaj Housing Finance IPO', 14950, $3, 'UPI', 214, 70, 1, 'Blocked', 'UPI ASBA Mandate Accepted', $4, 'Applied 1 Retail Lot for Bajaj Housing Finance IPO (Mandate Blocked via UPI)'),
        ($5, $2, 'Premier Energies Ltd IPO', 14700, $6, 'UPI', 33, 450, 1, 'Allotted', 'Funds Debited Upon Allotment', $7, 'Applied Premier Energies Mainboard IPO - Allotted 1 Lot')`,
        [
          crypto.randomUUID(),
          userId,
          formatDate(3),
          formatDate(-4),
          crypto.randomUUID(),
          formatDate(18),
          formatDate(14),
        ]
      );
      console.log('Seeded demo IPO applications in dedicated ipos table.');
    }

    // 5. If new user, seed pure regular expenses (NO IPOs in expenses)
    const expCountRes = await db.query('SELECT COUNT(*) as count FROM expenses WHERE user_id = $1 AND is_deleted = false', [userId]);
    if (parseInt(expCountRes.rows[0].count, 10) === 0) {
      const catsRes = await db.query('SELECT id, name FROM categories WHERE user_id = $1', [userId]);
      const catMap: Record<string, string> = {};
      for (const r of catsRes.rows) {
        catMap[r.name] = r.id;
      }

      const sampleExpenses = [
        {
          cat: 'Rent',
          amount: 22000,
          date: formatDate(25),
          payment: 'Net Banking',
          cardId: null,
          note: 'Apartment monthly rent payment',
          tags: ['house', 'fixed'],
        },
        {
          cat: 'Groceries',
          amount: 4350,
          date: formatDate(2),
          payment: 'UPI',
          cardId: null,
          note: 'Supermarket weekly fresh supplies and organic items',
          tags: ['weekly', 'supermarket'],
        },
        {
          cat: 'Food',
          amount: 1250,
          date: formatDate(1),
          payment: 'Credit Card',
          cardId: hdfcCardId,
          note: 'Dinner with team at Italian bistro',
          tags: ['dining', 'weekend'],
        },
        {
          cat: 'Bills & Utilities',
          amount: 2400,
          date: formatDate(10),
          payment: 'Net Banking',
          cardId: null,
          note: 'High-speed Fiber Internet & Electricity',
          tags: ['utilities'],
        },
        {
          cat: 'Fuel',
          amount: 3200,
          date: formatDate(5),
          payment: 'Credit Card',
          cardId: hdfcCardId,
          note: 'Car tank refill at Shell',
          tags: ['car', 'commute'],
        },
        {
          cat: 'Shopping',
          amount: 3899,
          date: formatDate(8),
          payment: 'Credit Card',
          cardId: iciciCardId,
          note: 'Ergonomic keyboard for home desk',
          tags: ['electronics', 'work'],
        },
        {
          cat: 'Subscriptions',
          amount: 999,
          date: formatDate(12),
          payment: 'Credit Card',
          cardId: iciciCardId,
          note: 'Netflix & Spotify family plans',
          tags: ['entertainment'],
          isRecurring: true,
          recurrenceType: 'monthly',
          nextDueDate: formatDate(-18),
        },
        {
          cat: 'Investment',
          amount: 10000,
          date: formatDate(15),
          payment: 'Net Banking',
          cardId: null,
          note: 'Nifty 50 Index Mutual Fund SIP',
          tags: ['sip', 'longterm'],
          isRecurring: true,
          recurrenceType: 'monthly',
          nextDueDate: formatDate(-15),
        },
        {
          cat: 'Transport',
          amount: 650,
          date: formatDate(0),
          payment: 'UPI',
          cardId: null,
          note: 'Uber cab ride to client site',
          tags: ['commute'],
        },
      ];

      for (const exp of sampleExpenses) {
        const expId = crypto.randomUUID();
        const catId = catMap[exp.cat] || catMap['Others'];
        await db.query(
          `INSERT INTO expenses (
            id, user_id, category_id, card_id, amount, date, payment_method, note, tags,
            is_recurring, recurrence_type, next_due_date, ipo_details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, null)`,
          [
            expId,
            userId,
            catId,
            exp.cardId,
            exp.amount,
            exp.date,
            exp.payment,
            exp.note,
            JSON.stringify(exp.tags),
            exp.isRecurring ?? false,
            exp.recurrenceType ?? null,
            exp.nextDueDate ?? null,
          ]
        );
      }
      console.log('Seeded regular expenses linked with credit cards.');
    }

    // 6. Notifications
    const notifCountRes = await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1', [userId]);
    if (parseInt(notifCountRes.rows[0].count, 10) === 0) {
      await db.query(
        `INSERT INTO notifications (id, user_id, type, message, is_read, link)
         VALUES 
         ($1, $2, 'ipo_update', '₹14,950 ASBA funds blocked for Bajaj Housing Finance IPO. Allotment expected soon.', false, '/ipo'),
         ($3, $2, 'card_reminder', 'HDFC Regalia Gold statement generated. Due on 20th.', false, '/cards'),
         ($4, $2, 'bill_reminder', 'Recurring subscription due in 4 days: Netflix & Spotify (₹999)', false, '/recurring')`,
        [crypto.randomUUID(), userId, crypto.randomUUID(), crypto.randomUUID()]
      );
    }

    console.log('Seeding process completed cleanly.');
  } catch (err) {
    console.error('Error during database seed:', err);
  }
}

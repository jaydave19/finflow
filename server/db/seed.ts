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
    const existing = await db.query('SELECT id FROM users WHERE email = $1', ['demo@example.com']);
    if (existing.rows.length > 0) {
      console.log('Seed: Demo user already exists.');
      return;
    }

    console.log('Seeding initial demo data...');
    const userId = crypto.randomUUID();
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
    const catMap: Record<string, string> = {};
    for (const cat of DEFAULT_CATEGORIES) {
      const catId = crypto.randomUUID();
      catMap[cat.name] = catId;
      await db.query(
        `INSERT INTO categories (id, user_id, name, icon, color, monthly_budget, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [catId, userId, cat.name, cat.icon, cat.color, 0, true]
      );
    }

    // Initialize overall budget as 0 (no budget set by default)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const budgetId = crypto.randomUUID();
    await db.query(
      `INSERT INTO budgets (id, user_id, month, year, overall_budget)
       VALUES ($1, $2, $3, $4, $5)`,
      [budgetId, userId, currentMonth, currentYear, 0]
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

    // Helper for date formatting
    const formatDate = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    // Add realistic expenses
    const sampleExpenses = [
      {
        cat: 'Rent',
        amount: 22000,
        date: formatDate(25),
        payment: 'Net Banking',
        note: 'Apartment monthly rent payment',
        tags: ['house', 'fixed'],
      },
      {
        cat: 'Groceries',
        amount: 4350,
        date: formatDate(2),
        payment: 'UPI',
        note: 'Supermarket weekly fresh supplies and organic items',
        tags: ['weekly', 'supermarket'],
      },
      {
        cat: 'Food',
        amount: 1250,
        date: formatDate(1),
        payment: 'UPI',
        note: 'Dinner with team at Italian bistro',
        tags: ['dining', 'weekend'],
      },
      {
        cat: 'Bills & Utilities',
        amount: 2400,
        date: formatDate(10),
        payment: 'Net Banking',
        note: 'High-speed Fiber Internet & Electricity',
        tags: ['utilities'],
      },
      {
        cat: 'Fuel',
        amount: 3200,
        date: formatDate(5),
        payment: 'Card',
        note: 'Car tank refill at Shell',
        tags: ['car', 'commute'],
      },
      {
        cat: 'Shopping',
        amount: 3899,
        date: formatDate(8),
        payment: 'Card',
        note: 'Ergonomic keyboard for home desk',
        tags: ['electronics', 'work'],
      },
      {
        cat: 'Subscriptions',
        amount: 999,
        date: formatDate(12),
        payment: 'Card',
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
        note: 'Nifty 50 Index Mutual Fund SIP',
        tags: ['sip', 'longterm'],
        isRecurring: true,
        recurrenceType: 'monthly',
        nextDueDate: formatDate(-15),
      },
      // Special Stock Market & IPO applications (Money Blocked feature requested by user)
      {
        cat: 'Stock Market & IPOs',
        amount: 14950,
        date: formatDate(3),
        payment: 'UPI',
        note: 'Applied 1 Retail Lot for Bajaj Housing Finance IPO (Mandate Blocked via UPI)',
        tags: ['IPO', 'Retail', 'Blocked Capital'],
        ipoDetails: {
          ipoName: 'Bajaj Housing Finance IPO',
          sharesCount: 214,
          lotSize: 1,
          bidPrice: 70,
          status: 'Blocked',
          mandateStatus: 'UPI ASBA Mandate Accepted',
          allotmentDate: formatDate(-4),
        },
      },
      {
        cat: 'Stock Market & IPOs',
        amount: 14700,
        date: formatDate(18),
        payment: 'UPI',
        note: 'Applied Premier Energies Mainboard IPO - Allotted 1 Lot',
        tags: ['IPO', 'Allotted', 'Shares'],
        ipoDetails: {
          ipoName: 'Premier Energies Ltd IPO',
          sharesCount: 33,
          lotSize: 1,
          bidPrice: 450,
          status: 'Allotted',
          mandateStatus: 'Funds Debited Upon Allotment',
          allotmentDate: formatDate(14),
        },
      },
      {
        cat: 'Transport',
        amount: 650,
        date: formatDate(0),
        payment: 'UPI',
        note: 'Uber cab ride to client site',
        tags: ['commute'],
      },
    ];

    for (const exp of sampleExpenses) {
      const expId = crypto.randomUUID();
      const catId = catMap[exp.cat] || catMap['Others'];
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
          exp.payment,
          exp.note,
          JSON.stringify(exp.tags),
          exp.isRecurring ?? false,
          exp.recurrenceType ?? null,
          exp.nextDueDate ?? null,
          exp.ipoDetails ? JSON.stringify(exp.ipoDetails) : null,
        ]
      );
    }

    // Add In-App Notifications
    await db.query(
      `INSERT INTO notifications (id, user_id, type, message, is_read, link)
       VALUES 
       ($1, $2, 'ipo_update', '₹14,950 ASBA funds blocked for Bajaj Housing Finance IPO. Allotment expected soon.', false, '/ipo'),
       ($3, $2, 'bill_reminder', 'Recurring subscription due in 4 days: Netflix & Spotify (₹999)', false, '/recurring'),
       ($4, $2, 'budget_warning', 'Rent category is at 100% of budget allocation.', true, '/budgets')`,
      [crypto.randomUUID(), userId, crypto.randomUUID(), crypto.randomUUID()]
    );

    console.log('Seeded demo account successfully with sample expenses, IPO tracking & categories.');
  } catch (err) {
    console.error('Error during database seed:', err);
  }
}

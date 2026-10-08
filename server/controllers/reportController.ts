import { Response } from 'express';
import { db } from '../db/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import * as XLSX from 'xlsx';

export async function getMonthlyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const currentMonthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  // Previous month dates
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`;

  // 1. Current Month Total Expenses (excluding IPO-tagged entries)
  const expRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const totalExpense = Number(expRes.rows[0].total);
  const transactionCount = parseInt(expRes.rows[0].count, 10);

  // 2. Previous Month Total Expenses (excluding IPO-tagged entries)
  const prevExpRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL`,
    [userId, prevMonthStart, prevMonthEnd]
  );
  const prevTotalExpense = Number(prevExpRes.rows[0].total);
  const expenseChangePct = prevTotalExpense > 0
    ? Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100)
    : 0;

  // 3. Current Month Total Income
  const incRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total 
     FROM incomes 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const totalIncome = Number(incRes.rows[0].total);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // 4. Category-wise Breakdown (Amount, % of Total, Transaction Count)
  const catBreakdownRes = await db.query(
    `SELECT 
      c.id, c.name, c.icon, c.color,
      COALESCE(SUM(e.amount), 0) as amount,
      COUNT(e.id) as count
     FROM categories c
     LEFT JOIN expenses e ON c.id = e.category_id 
       AND e.user_id = $1 
       AND e.is_deleted = false 
       AND e.date >= $2 
       AND e.date <= $3
     WHERE c.user_id = $1 AND c.is_deleted = false
     GROUP BY c.id, c.name, c.icon, c.color
     ORDER BY amount DESC`,
    [userId, currentMonthStart, currentMonthEnd]
  );

  const categoryBreakdown = catBreakdownRes.rows
    .map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      amount: Number(r.amount),
      count: parseInt(r.count, 10),
      percentage: totalExpense > 0 ? Math.round((Number(r.amount) / totalExpense) * 100) : 0,
    }))
    .filter(r => r.amount > 0);

  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
  const lowestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[categoryBreakdown.length - 1] : null;

  // 5. Top 5 Highest Expenses (excluding IPO-tagged entries)
  const topExpensesRes = await db.query(
    `SELECT e.id, e.amount, e.date, e.payment_method, e.note, c.name as category_name, c.color as category_color, e.ipo_details
     FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND e.is_deleted = false AND e.date >= $2 AND e.date <= $3 AND e.ipo_details IS NULL
     ORDER BY e.amount DESC
     LIMIT 5`,
    [userId, currentMonthStart, currentMonthEnd]
  );

  const top5Expenses = topExpensesRes.rows.map(r => ({
    id: r.id,
    amount: Number(r.amount),
    date: r.date,
    paymentMethod: r.payment_method,
    note: r.note,
    categoryName: r.category_name || 'Uncategorized',
    categoryColor: r.category_color || '#64748B',
    ipoDetails: typeof r.ipo_details === 'string' ? JSON.parse(r.ipo_details) : r.ipo_details,
  }));

  // 6. Daily Spending Trend in Current Month (excluding IPO-tagged entries)
  const dailyRes = await db.query(
    `SELECT date, COALESCE(SUM(amount), 0) as amount 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL
     GROUP BY date
     ORDER BY date ASC`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const dailySpending = dailyRes.rows.map(r => ({
    date: r.date,
    day: parseInt(r.date.split('-')[2], 10),
    amount: Number(r.amount),
  }));

  // 7. Payment Method Distribution (excluding IPO-tagged entries)
  const paymentRes = await db.query(
    `SELECT payment_method, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL
     GROUP BY payment_method
     ORDER BY amount DESC`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const paymentMethods = paymentRes.rows.map(r => ({
    method: r.payment_method,
    amount: Number(r.amount),
    count: parseInt(r.count, 10),
    percentage: totalExpense > 0 ? Math.round((Number(r.amount) / totalExpense) * 100) : 0,
  }));

  // 8. Day of week pattern (excluding IPO-tagged entries)
  const allExpMonth = await db.query(
    `SELECT date, amount FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayStats: Record<string, { total: number; count: number }> = {
    Sun: { total: 0, count: 0 },
    Mon: { total: 0, count: 0 },
    Tue: { total: 0, count: 0 },
    Wed: { total: 0, count: 0 },
    Thu: { total: 0, count: 0 },
    Fri: { total: 0, count: 0 },
    Sat: { total: 0, count: 0 },
  };

  for (const exp of allExpMonth.rows) {
    const d = new Date(exp.date);
    const day = dayNames[d.getDay()];
    if (dayStats[day]) {
      dayStats[day].total += Number(exp.amount);
      dayStats[day].count += 1;
    }
  }

  const dayOfWeekSpending = dayNames.map(d => ({
    day: d,
    amount: dayStats[d].total,
    count: dayStats[d].count,
  }));

  // 9. Stock Market & IPO blocked funds summary (queries dedicated ipos table)
  const ipoRes = await db.query(
    `SELECT id, amount, application_date as date, note, ipo_name, status 
     FROM ipos 
     WHERE user_id = $1 AND is_deleted = false`,
    [userId]
  );
  let totalIpoBlocked = 0;
  let activeIpoCount = 0;
  const activeIpos: any[] = [];

  for (const row of ipoRes.rows) {
    const st = row.status || 'Blocked';
    if (st === 'Blocked' || st === 'Applied') {
      totalIpoBlocked += Number(row.amount);
      activeIpoCount++;
      activeIpos.push({
        id: row.id,
        amount: Number(row.amount),
        date: row.date,
        note: row.note || row.ipo_name,
        details: { status: st, ipoName: row.ipo_name },
      });
    }
  }

  // 10. Last 6 Months Trend
  const monthlyTrends: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const mStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const mEnd = `${y}-${String(m).padStart(2, '0')}-31`;

    const mExp = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as exp 
       FROM expenses 
       WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 AND ipo_details IS NULL`,
      [userId, mStart, mEnd]
    );
    const mInc = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as inc 
       FROM incomes 
       WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3`,
      [userId, mStart, mEnd]
    );

    const monthLabel = d.toLocaleString('default', { month: 'short' });
    monthlyTrends.push({
      label: `${monthLabel} ${y}`,
      month: m,
      year: y,
      expense: Number(mExp.rows[0].exp),
      income: Number(mInc.rows[0].inc),
      savings: Number(mInc.rows[0].inc) - Number(mExp.rows[0].exp),
    });
  }

  res.json({
    month,
    year,
    summary: {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      transactionCount,
      prevTotalExpense,
      expenseChangePct,
      averageDailySpend: dailySpending.length > 0 ? Math.round(totalExpense / dailySpending.length) : 0,
      totalIpoBlocked,
      activeIpoCount,
    },
    categoryBreakdown,
    highestCategory,
    lowestCategory,
    top5Expenses,
    dailySpending,
    paymentMethods,
    dayOfWeekSpending,
    monthlyTrends,
    activeIpos,
  });
}

export async function getInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const currentMonthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`;

  const insights: { id: string; type: 'info' | 'warning' | 'positive' | 'tip'; title: string; message: string }[] = [];

  // 1. Category comparison with last month
  const curRes = await db.query(
    `SELECT c.name, COALESCE(SUM(e.amount), 0) as spent
     FROM categories c
     JOIN expenses e ON c.id = e.category_id AND e.user_id = $1 AND e.is_deleted = false
     WHERE e.date >= $2 AND e.date <= $3
     GROUP BY c.name`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  const prevRes = await db.query(
    `SELECT c.name, COALESCE(SUM(e.amount), 0) as spent
     FROM categories c
     JOIN expenses e ON c.id = e.category_id AND e.user_id = $1 AND e.is_deleted = false
     WHERE e.date >= $2 AND e.date <= $3
     GROUP BY c.name`,
    [userId, prevMonthStart, prevMonthEnd]
  );

  const prevMap: Record<string, number> = {};
  for (const r of prevRes.rows) {
    prevMap[r.name] = Number(r.spent);
  }

  for (const row of curRes.rows) {
    const cur = Number(row.spent);
    const prev = prevMap[row.name] || 0;
    if (prev > 0) {
      const diff = Math.round(((cur - prev) / prev) * 100);
      if (diff >= 20) {
        insights.push({
          id: `diff-${row.name}`,
          type: 'warning',
          title: `${row.name} spending spiked`,
          message: `You spent ${diff}% more on ${row.name} this month compared to last month (₹${cur.toLocaleString()} vs ₹${prev.toLocaleString()}).`,
        });
      } else if (diff <= -20) {
        insights.push({
          id: `save-${row.name}`,
          type: 'positive',
          title: `Great job on ${row.name}!`,
          message: `You cut down ${row.name} spending by ${Math.abs(diff)}% compared to last month.`,
        });
      }
    }
  }

  // 2. IPO blocked capital insight (from dedicated ipos table)
  const ipoAllRes = await db.query(
    `SELECT amount, status FROM ipos WHERE user_id = $1 AND is_deleted = false`,
    [userId]
  );
  let ipoTotal = 0;
  let activeIpoBidsCount = 0;
  for (const row of ipoAllRes.rows) {
    const st = row.status || 'Blocked';
    if (st === 'Blocked' || st === 'Applied') {
      ipoTotal += Number(row.amount);
      activeIpoBidsCount++;
    }
  }

  if (ipoTotal > 0) {
    insights.push({
      id: 'ipo-blocked',
      type: 'info',
      title: 'IPO Capital Blocked in Mandates',
      message: `You currently have ₹${ipoTotal.toLocaleString()} blocked across ${activeIpoBidsCount} active IPO application(s). Funds will be debited only upon allotment or unblocked otherwise.`,
    });
  }

  // 3. Payment Method Dominance
  const paymentRes = await db.query(
    `SELECT payment_method, SUM(amount) as total 
     FROM expenses 
     WHERE user_id = $1 AND is_deleted = false AND date >= $2 AND date <= $3 
     GROUP BY payment_method 
     ORDER BY total DESC LIMIT 1`,
    [userId, currentMonthStart, currentMonthEnd]
  );
  if (paymentRes.rows.length > 0) {
    const topMethod = paymentRes.rows[0];
    insights.push({
      id: 'payment-method',
      type: 'info',
      title: `Preferred Payment: ${topMethod.payment_method}`,
      message: `Most of your transactions this month were processed via ${topMethod.payment_method} (₹${Number(topMethod.total).toLocaleString()}).`,
    });
  }

  // Fallback tip if few insights
  if (insights.length < 3) {
    insights.push({
      id: 'savings-tip',
      type: 'tip',
      title: '50/30/20 Rule Recommendation',
      message: 'Aim to allocate 50% of income to needs, 30% to wants, and 20% to savings and investment channels.',
    });
  }

  res.json({ insights });
}

export async function exportReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.userId;
  const format = (req.query.format as string || 'csv').toLowerCase();
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const mStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const mEnd = `${year}-${String(month).padStart(2, '0')}-31`;

  const expensesRes = await db.query(
    `SELECT e.date, c.name as category, e.amount, e.payment_method, e.note, e.ipo_details
     FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND e.is_deleted = false AND e.date >= $2 AND e.date <= $3 AND e.ipo_details IS NULL
     ORDER BY e.date ASC`,
    [userId, mStart, mEnd]
  );

  const rows = expensesRes.rows.map(r => {
    const ipo = typeof r.ipo_details === 'string' ? JSON.parse(r.ipo_details) : r.ipo_details;
    return {
      Date: r.date,
      Category: r.category || 'Uncategorized',
      Amount: Number(r.amount),
      'Payment Method': r.payment_method,
      Note: r.note || '',
      'IPO/Share Details': ipo ? `${ipo.ipoName || ''} (${ipo.status || ''})` : '',
    };
  });

  if (format === 'csv') {
    const headers = ['Date', 'Category', 'Amount', 'Payment Method', 'Note', 'IPO/Share Details'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r =>
        [
          r.Date,
          `"${r.Category}"`,
          r.Amount,
          `"${r['Payment Method']}"`,
          `"${(r.Note || '').replace(/"/g, '""')}"`,
          `"${(r['IPO/Share Details'] || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${year}_${month}.csv`);
    res.send(csvContent);
    return;
  }

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${year}_${month}.xlsx`);
    res.send(buf);
    return;
  }

  res.status(400).json({ error: 'Unsupported format. Use csv or xlsx (PDF is generated directly in the frontend)' });
}

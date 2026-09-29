import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  Landmark,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  PieChart as PieIcon,
  ChevronRight,
  Trash2,
  Copy,
  Edit2,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useNavigate } from 'react-router-dom';
import { ExpenseModal } from '../components/expenses/ExpenseModal.tsx';

export function Dashboard() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportRes, expRes, budgetRes, insightRes] = await Promise.all([
        api.get(`/reports/monthly?month=${currentMonth}&year=${currentYear}`),
        api.get('/expenses?limit=6'),
        api.get(`/budgets?month=${currentMonth}&year=${currentYear}`),
        api.get('/reports/insights'),
      ]);

      setReport(reportRes);
      setRecentExpenses(expRes.expenses || []);
      setBudgetData(budgetRes);
      setInsights(insightRes.insights || []);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    loadDashboardData();
    const handleRefresh = () => loadDashboardData();
    window.addEventListener('finflow:refresh-data', handleRefresh);
    return () => window.removeEventListener('finflow:refresh-data', handleRefresh);
  }, [loadDashboardData]);

  // Handle Delete with Undo Toast
  const handleDeleteExpense = async (id: string, note: string) => {
    try {
      await api.delete(`/expenses/${id}`);
      setRecentExpenses(prev => prev.filter(e => e.id !== id));
      loadDashboardData();

      showToast({
        type: 'info',
        message: `Deleted "${note || 'Expense'}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/expenses/${id}/restore`);
            showToast({ type: 'success', message: 'Expense restored!' });
            loadDashboardData();
          } catch {
            showToast({ type: 'error', message: 'Failed to restore expense.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete expense.' });
    }
  };

  const handleDuplicateExpense = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/duplicate`);
      showToast({ type: 'success', message: 'Expense duplicated!' });
      loadDashboardData();
    } catch {
      showToast({ type: 'error', message: 'Failed to duplicate.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          ))}
        </div>
        <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  const summary = report?.summary || {};
  const isUp = summary.expenseChangePct > 0;
  const isDown = summary.expenseChangePct < 0;

  return (
    <div className="space-y-6">
      {/* Top Insights Banner if available */}
      {insights.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{insights[0].title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{insights[0].message}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          >
            All Insights <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spent this Month */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Spent this Month</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatAmount(summary.totalExpense || 0)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {summary.prevTotalExpense > 0 ? (
              <span
                className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  isUp
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    : isDown
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {Math.abs(summary.expenseChangePct)}% vs last month
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">First recorded month</span>
            )}
          </div>
        </div>

        {/* Remaining Monthly Budget */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Remaining Budget</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {budgetData?.overallBudget > 0
              ? formatAmount(budgetData.remainingBudget || 0)
              : 'No Budget Set'}
          </p>
          <div className="mt-2">
            {budgetData?.overallBudget > 0 ? (
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetData.percentageUsed >= 100
                      ? 'bg-rose-500'
                      : budgetData.percentageUsed >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetData.percentageUsed)}%` }}
                />
              </div>
            ) : (
              <button
                onClick={() => navigate('/budgets')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Set a Monthly Budget →
              </button>
            )}
          </div>
        </div>

        {/* Special Feature: IPO Blocked Funds Card! (Requested) */}
        <div
          onClick={() => navigate('/ipo')}
          className="p-5 rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-md relative overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-200">IPO Blocked Capital (ASBA)</span>
            <div className="p-2 rounded-xl bg-white/10 text-indigo-300">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2">
            {formatAmount(summary.totalIpoBlocked || 0)}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-indigo-200">
            <span>{summary.activeIpoCount || 0} active mandate(s)</span>
            <span className="font-semibold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
              View Allotments →
            </span>
          </div>
        </div>

        {/* Average Daily Spend & Transactions Count */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Daily Average Spend</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatAmount(summary.averageDailySpend || 0)}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{summary.transactionCount || 0} Transactions</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Savings: {summary.savingsRate || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Highest Spending Category Banner */}
      {report?.highestCategory && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: report.highestCategory.color }}
            >
              {report.highestCategory.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Highest Spending Category this Month
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {report.highestCategory.name} — {formatAmount(report.highestCategory.amount)} ({report.highestCategory.percentage}% of total expenses)
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
          >
            Breakdown →
          </button>
        </div>
      )}

      {/* Charts Section: Category Distribution & Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Donut Chart */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category Distribution</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Where your money went this month</p>
            </div>
            <button
              onClick={() => navigate('/categories')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Manage
            </button>
          </div>

          {report?.categoryBreakdown && report.categoryBreakdown.length > 0 ? (
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="amount"
                  >
                    {report.categoryBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366F1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatAmount(val), 'Amount']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-44 max-h-56 overflow-y-auto space-y-2 pr-2 text-xs">
                {report.categoryBreakdown.slice(0, 5).map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate text-slate-700 dark:text-slate-300">{cat.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                      {cat.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-slate-400">
              <PieIcon className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              No expenses recorded for this month yet.
            </div>
          )}
        </div>

        {/* Daily Spending Trend Bar Chart */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Spending Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Day by day timeline</p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Full Report
            </button>
          </div>

          {report?.dailySpending && report.dailySpending.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.dailySpending}>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    formatter={(val: any) => [formatAmount(val), 'Spent']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-slate-400">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              No transactions recorded this month yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions List with Undo Support */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest expenses with quick actions</p>
          </div>
          <button
            onClick={() => navigate('/transactions')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            No expenses found. Click &quot;Add Expense&quot; above to log your first record.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentExpenses.map(exp => (
              <div
                key={exp.id}
                className="py-3.5 flex items-center justify-between gap-3 group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 px-2 -mx-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: exp.category?.color || '#6366F1' }}
                  >
                    {exp.category?.name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {exp.note || exp.category?.name || 'Expense'}
                      </p>
                      {exp.ipoDetails && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          IPO: {exp.ipoDetails.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{exp.category?.name}</span>
                      <span>•</span>
                      <span>{exp.date}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">{exp.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    -{formatAmount(exp.amount)}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => handleDuplicateExpense(exp.id)}
                      title="Duplicate Expense"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingExpense(exp)}
                      title="Edit Expense"
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(exp.id, exp.note)}
                      title="Delete (Undoable)"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseModal
          isOpen={true}
          onClose={() => setEditingExpense(null)}
          onSuccess={loadDashboardData}
          initialData={editingExpense}
        />
      )}
    </div>
  );
}

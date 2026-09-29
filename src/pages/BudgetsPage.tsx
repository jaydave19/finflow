import React, { useState, useEffect, useCallback } from 'react';
import {
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function BudgetsPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgetData, setBudgetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit budget modal state
  const [isEditingOverall, setIsEditingOverall] = useState(false);
  const [newOverallBudget, setNewOverallBudget] = useState('');

  const fetchBudget = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/budgets?month=${month}&year=${year}`);
      setBudgetData(data);
      setNewOverallBudget(String(data.overallBudget || 0));

      if (data.overallBudget > 0 && data.totalSpent < data.overallBudget && data.percentageUsed < 80) {
        // Trigger subtle confetti celebration if doing great
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load budget' });
    } finally {
      setLoading(false);
    }
  }, [month, year, showToast]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleSaveOverallBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newOverallBudget);
    if (isNaN(val) || val < 0) {
      showToast({ type: 'error', message: 'Please enter a valid budget amount.' });
      return;
    }

    try {
      await api.put('/budgets', {
        month,
        year,
        overallBudget: val,
      });
      showToast({ type: 'success', message: 'Monthly budget updated successfully!' });
      setIsEditingOverall(false);
      fetchBudget();

      if (val > 0) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to update budget.' });
    }
  };

  const handleUpdateCategoryBudget = async (categoryId: string, monthlyBudget: number) => {
    try {
      await api.put('/budgets', {
        month,
        year,
        categoryBudgets: [{ categoryId, monthlyBudget }],
      });
      showToast({ type: 'success', message: 'Category budget updated!' });
      fetchBudget();
    } catch {
      showToast({ type: 'error', message: 'Failed to update category budget.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Monthly Budget Management</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Set spending limits, receive 80% warnings and over-budget notifications.
          </p>
        </div>

        {/* Month Picker */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value, 10))}
            className="text-xs font-semibold bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value, 10))}
            className="text-xs font-semibold bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overall Budget Hero Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Total Monthly Budget</span>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {budgetData?.overallBudget > 0 ? formatAmount(budgetData.overallBudget) : 'Not Set'}
                </p>
                <button
                  onClick={() => setIsEditingOverall(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                  title={budgetData?.overallBudget > 0 ? "Edit Budget" : "Set Budget"}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-400">Total Spent</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatAmount(budgetData?.totalSpent || 0)}
            </p>
          </div>
        </div>

        {/* Budget Progress Bar */}
        {budgetData?.overallBudget > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
              <span
                className={
                  budgetData?.isOverallExceeded
                    ? 'text-rose-600 font-bold flex items-center gap-1'
                    : budgetData?.isOverallWarning
                    ? 'text-amber-600 font-bold flex items-center gap-1'
                    : 'text-slate-600 dark:text-slate-300'
                }
              >
                {budgetData?.isOverallExceeded && <AlertTriangle className="w-3.5 h-3.5" />}
                {budgetData?.percentageUsed}% Used
                {budgetData?.isOverallExceeded && ' (Budget Exceeded!)'}
                {budgetData?.isOverallWarning && ' (80% Warning Threshold Reached)'}
              </span>
              <span className="text-slate-500">
                {formatAmount(budgetData?.remainingBudget || 0)} remaining
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  budgetData?.isOverallExceeded
                    ? 'bg-rose-500'
                    : budgetData?.isOverallWarning
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetData?.percentageUsed || 0)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              No overall monthly budget configured for this month.
            </span>
            <button
              onClick={() => setIsEditingOverall(true)}
              className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              Set Monthly Budget
            </button>
          </div>
        )}
      </div>

      {/* Edit Overall Budget Inline / Modal */}
      {isEditingOverall && (
        <form
          onSubmit={handleSaveOverallBudget}
          className="p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3 animate-in fade-in"
        >
          <div className="flex-1">
            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              Enter New Overall Monthly Budget (₹)
            </label>
            <input
              type="number"
              required
              value={newOverallBudget}
              onChange={e => setNewOverallBudget(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md"
            >
              Save Budget
            </button>
            <button
              type="button"
              onClick={() => setIsEditingOverall(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Category-Wise Budgets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category-Wise Budget Allocations</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetData?.categories?.map((cat: any) => {
            const hasBudget = cat.budget > 0;

            return (
              <div
                key={cat.id}
                className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{cat.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {formatAmount(cat.spent)} / {hasBudget ? formatAmount(cat.budget) : 'No Cap'}
                  </span>
                </div>

                {hasBudget ? (
                  <>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.isExceeded
                            ? 'bg-rose-500'
                            : cat.isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{cat.percentage}% Used</span>
                      <span>
                        {cat.isExceeded
                          ? `Exceeded by ${formatAmount(cat.spent - cat.budget)}`
                          : `${formatAmount(cat.remaining)} left`}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    No budget set for this category.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

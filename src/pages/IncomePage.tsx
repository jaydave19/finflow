import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  PiggyBank,
  Percent,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { IncomeModal } from '../components/income/IncomeModal.tsx';

export function IncomePage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<any>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, repRes] = await Promise.all([
        api.get('/income'),
        api.get(`/reports/monthly?month=${currentMonth}&year=${currentYear}`),
      ]);
      setIncomes(incRes.incomes || []);
      setReport(repRes);
    } catch {
      showToast({ type: 'error', message: 'Failed to load income data' });
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear, showToast]);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('finflow:refresh-data', handleRefresh);
    return () => window.removeEventListener('finflow:refresh-data', handleRefresh);
  }, [loadData]);

  const handleDelete = async (id: string, source: string) => {
    try {
      await api.delete(`/income/${id}`);
      setIncomes(prev => prev.filter(i => i.id !== id));

      showToast({
        type: 'info',
        message: `Deleted income from "${source}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/income/${id}/restore`);
            showToast({ type: 'success', message: 'Income restored!' });
            loadData();
          } catch {
            showToast({ type: 'error', message: 'Failed to restore income.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete income.' });
    }
  };

  const summary = report?.summary || {};

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Income & Earnings</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track salaries, freelance payouts, dividends, and net savings.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Income
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Income */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Income (This Month)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            +{formatAmount(summary.totalIncome || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Recorded inflow</p>
        </div>

        {/* Net Savings */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Net Savings (Income - Expense)</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${summary.netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
            {formatAmount(summary.netSavings || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Surplus after all expenses</p>
        </div>

        {/* Savings Rate % */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Savings Rate</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-2">
            {summary.savingsRate || 0}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Target is 20%+ recommended</p>
        </div>
      </div>

      {/* Incomes List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Income Entries</h3>
          <span className="text-xs font-semibold text-slate-400">{incomes.length} Entries</span>
        </div>

        {incomes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Wallet className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            No income entries recorded yet. Click &quot;Add Income&quot; above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {incomes.map(inc => (
              <div
                key={inc.id}
                className="p-4 px-6 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {inc.source}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{inc.date}</span>
                      {inc.note && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 dark:text-slate-300">{inc.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatAmount(inc.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingIncome(inc)}
                      title="Edit"
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(inc.id, inc.source)}
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

      <IncomeModal
        isOpen={isAddModalOpen || Boolean(editingIncome)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingIncome(null);
        }}
        onSuccess={loadData}
        initialData={editingIncome}
      />
    </div>
  );
}

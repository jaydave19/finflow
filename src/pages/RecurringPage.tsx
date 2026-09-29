import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock,
  Plus,
  Repeat,
  Trash2,
  Edit2,
  CheckCircle,
  Bell,
  Clock,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ExpenseModal } from '../components/expenses/ExpenseModal.tsx';

export function RecurringPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const fetchRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses?limit=100');
      const all: any[] = res.expenses || [];
      const rec = all.filter(e => e.isRecurring);
      setRecurringExpenses(rec);
    } catch {
      showToast({ type: 'error', message: 'Failed to load recurring bills' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const handleDelete = async (id: string, note: string) => {
    try {
      await api.delete(`/expenses/${id}`);
      setRecurringExpenses(prev => prev.filter(e => e.id !== id));
      showToast({
        type: 'info',
        message: `Deleted recurring bill "${note}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/expenses/${id}/restore`);
            showToast({ type: 'success', message: 'Bill restored!' });
            fetchRecurring();
          } catch {
            showToast({ type: 'error', message: 'Failed to restore bill.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete recurring bill.' });
    }
  };

  const calculateDaysRemaining = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Recurring Bills & Reminders</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated recurring bills (daily, weekly, monthly, yearly) managed by server scheduler with early reminders.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Recurring Bill
        </button>
      </div>

      {/* Info Card */}
      <div className="p-5 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Autonomous Server Cron Job</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              When a due date arrives, the server auto-generates the new transaction and updates the next cycle.
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
          {recurringExpenses.length} Active Schedules
        </span>
      </div>

      {/* Recurring Bills List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {recurringExpenses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <CalendarClock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            No recurring bills or subscriptions setup yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recurringExpenses.map(exp => {
              const daysLeft = calculateDaysRemaining(exp.nextDueDate);
              const isDueSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
              const isOverdue = daysLeft !== null && daysLeft < 0;

              return (
                <div
                  key={exp.id}
                  className="p-4 px-6 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: exp.category?.color || '#6366F1' }}
                    >
                      {exp.category?.name?.charAt(0) || 'R'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {exp.note || exp.category?.name || 'Recurring Bill'}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 capitalize">
                          {exp.recurrenceType || 'Monthly'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{exp.category?.name}</span>
                        <span>•</span>
                        <span>Next Due: {exp.nextDueDate || 'Pending'}</span>
                        {daysLeft !== null && (
                          <span
                            className={`font-semibold ${
                              isOverdue
                                ? 'text-rose-500'
                                : isDueSoon
                                ? 'text-amber-500'
                                : 'text-slate-500'
                            }`}
                          >
                            ({isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days remaining`})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      -{formatAmount(exp.amount)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingExpense(exp)}
                        title="Edit"
                        className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id, exp.note)}
                        title="Delete (Undoable)"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ExpenseModal
        isOpen={isAddModalOpen || Boolean(editingExpense)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={fetchRecurring}
        initialData={editingExpense}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Wallet } from 'lucide-react';
import { api } from '../../api/client.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function IncomeModal({ isOpen, onClose, onSuccess, initialData }: IncomeModalProps) {
  const { currencyConfig } = useCurrency();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Salary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(String(initialData.amount || ''));
        setSource(initialData.source || 'Salary');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setNote(initialData.note || '');
      } else {
        setAmount('');
        setSource('Salary');
        setDate(new Date().toISOString().split('T')[0]);
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid positive income amount.' });
      return;
    }

    setLoading(true);
    try {
      const payload = { amount: numAmount, source, date, note: note.trim() };
      if (initialData?.id) {
        await api.put(`/income/${initialData.id}`, payload);
        showToast({ type: 'success', message: 'Income updated successfully!' });
      } else {
        await api.post('/income', payload);
        showToast({ type: 'success', message: 'Income added successfully!' });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save income.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const sources = ['Salary', 'Freelance', 'Business', 'Investment Dividend', 'IPO Profit/Refund', 'Rental Income', 'Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData?.id ? 'Edit Income' : 'Record Income'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Income Amount ({currencyConfig.symbol}) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                {currencyConfig.symbol}
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Source *
            </label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {sources.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly salary, Client retainer, Stock dividend"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : initialData?.id ? 'Update Income' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

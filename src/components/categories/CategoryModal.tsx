import React, { useState, useEffect } from 'react';
import { X, Tag, Sparkles } from 'lucide-react';
import { api } from '../../api/client.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function CategoryModal({ isOpen, onClose, onSuccess, initialData }: CategoryModalProps) {
  const { currencyConfig } = useCurrency();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#6366F1');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const AVAILABLE_ICONS = [
    'Utensils', 'ShoppingCart', 'Bus', 'Fuel', 'Home', 'Zap',
    'ShoppingBag', 'HeartPulse', 'GraduationCap', 'Film', 'Plane',
    'Tv', 'TrendingUp', 'Landmark', 'Coffee', 'Gift', 'Dumbbell', 'Tag'
  ];

  const PRESET_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
  ];

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setIcon(initialData.icon || 'Tag');
        setColor(initialData.color || '#6366F1');
        setMonthlyBudget(String(initialData.monthlyBudget || ''));
      } else {
        setName('');
        setIcon('Tag');
        setColor('#6366F1');
        setMonthlyBudget('');
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Category name is required' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        icon,
        color,
        monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : 0,
      };

      if (initialData?.id) {
        await api.put(`/categories/${initialData.id}`, payload);
        showToast({ type: 'success', message: 'Category updated successfully!' });
      } else {
        await api.post('/categories', payload);
        showToast({ type: 'success', message: 'Category created successfully!' });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save category.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData?.id ? 'Edit Category' : 'Create Category'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pet Care, Gaming, Side Hustle"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Color Tag
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Icon Key
            </label>
            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              {AVAILABLE_ICONS.map(i => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`p-2 text-xs rounded-lg font-medium transition-colors text-center truncate ${
                    icon === i
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Budget (Optional) ({currencyConfig.symbol})
            </label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={monthlyBudget}
              onChange={e => setMonthlyBudget(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {loading ? 'Saving...' : initialData?.id ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

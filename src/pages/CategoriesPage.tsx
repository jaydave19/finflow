import React, { useState, useEffect, useCallback } from 'react';
import {
  Tags,
  Plus,
  Trash2,
  Edit2,
  Utensils,
  ShoppingCart,
  Bus,
  Fuel,
  Home,
  Zap,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Film,
  Plane,
  Tv,
  TrendingUp,
  Landmark,
  MoreHorizontal,
  Tag,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { CategoryModal } from '../components/categories/CategoryModal.tsx';

// Icon mapping dictionary
const ICON_MAP: Record<string, any> = {
  Utensils, ShoppingCart, Bus, Fuel, Home, Zap, ShoppingBag,
  HeartPulse, GraduationCap, Film, Plane, Tv, TrendingUp,
  Landmark, MoreHorizontal, Tag,
};

export function CategoriesPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.categories || []);
    } catch {
      showToast({ type: 'error', message: 'Failed to load categories' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.delete(`/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));

      showToast({
        type: 'info',
        message: `Deleted category "${name}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/categories/${id}/restore`);
            showToast({ type: 'success', message: 'Category restored!' });
            fetchCategories();
          } catch {
            showToast({ type: 'error', message: 'Failed to restore category.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete category.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Categories & Budgets</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize spending with default and custom categories, colors, and per-category budgets.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Category
        </button>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(cat => {
          const IconComp = ICON_MAP[cat.icon] || Tag;
          const isIpoSpecial = cat.name.toLowerCase().includes('ipo') || cat.name.toLowerCase().includes('stock');

          return (
            <div
              key={cat.id}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all hover:shadow-md ${
                isIpoSpecial
                  ? 'border-indigo-500/60 dark:border-indigo-600/60 ring-2 ring-indigo-500/10'
                  : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: cat.color }}
                >
                  <IconComp className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    title="Edit Category"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!cat.isDefault && (
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{cat.name}</h3>
                  {cat.isDefault && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Default
                    </span>
                  )}
                  {isIpoSpecial && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Special IPO
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Monthly Budget:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {cat.monthlyBudget > 0 ? formatAmount(cat.monthlyBudget) : 'No limit'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CategoryModal
        isOpen={isAddModalOpen || Boolean(editingCategory)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCategory(null);
        }}
        onSuccess={fetchCategories}
        initialData={editingCategory}
      />
    </div>
  );
}

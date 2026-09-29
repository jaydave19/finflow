import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Receipt,
  ArrowUpDown,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Landmark,
  X,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ExpenseModal } from '../components/expenses/ExpenseModal.tsx';

export function Transactions() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Categories list for filter dropdown
  const [categories, setCategories] = useState<any[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.categories || []);
    } catch {
      // ignore
    }
  };

  const fetchExpenses = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '12');
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      if (paymentMethod) params.set('paymentMethod', paymentMethod);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await api.get(`/expenses?${params.toString()}`);
      setExpenses(res.expenses || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 12, totalPages: 1 });
    } catch {
      showToast({ type: 'error', message: 'Failed to load transactions' });
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, paymentMethod, startDate, endDate, minAmount, maxAmount, sortBy, sortOrder, showToast]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses(1);
  }, [fetchExpenses]);

  // Handle Delete with Undo Toast
  const handleDelete = async (id: string, note: string) => {
    try {
      await api.delete(`/expenses/${id}`);
      setExpenses(prev => prev.filter(e => e.id !== id));

      showToast({
        type: 'info',
        message: `Deleted "${note || 'Expense'}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/expenses/${id}/restore`);
            showToast({ type: 'success', message: 'Expense restored!' });
            fetchExpenses(pagination.page);
          } catch {
            showToast({ type: 'error', message: 'Failed to restore expense.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete expense.' });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/duplicate`);
      showToast({ type: 'success', message: 'Expense duplicated successfully!' });
      fetchExpenses(pagination.page);
    } catch {
      showToast({ type: 'error', message: 'Failed to duplicate.' });
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setPaymentMethod('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date');
    setSortOrder('desc');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">All Transactions</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search, filter, edit, and audit your expense records with undo capabilities.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search note or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Payment Methods</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Net Banking">Net Banking</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`Sorting ${sortOrder.toUpperCase()}`}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Date & Amount Ranges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Min Amount (₹)</label>
            <input
              type="number"
              placeholder="0"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="Unlimited"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={resetFilters}
              title="Reset Filters"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            Showing {expenses.length} of {pagination.total} transactions
          </span>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Receipt className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            No transactions matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-6">Description / Note</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{exp.note || 'Expense'}</span>
                        {exp.isRecurring && (
                          <span title="Recurring bill" className="text-indigo-500">
                            <Repeat className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {exp.ipoDetails && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            IPO: {exp.ipoDetails.status}
                          </span>
                        )}
                      </div>
                      {exp.tags && exp.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {exp.tags.map((t: string) => (
                            <span key={t} className="text-[10px] text-slate-400">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: exp.category?.color || '#6366F1' }}
                        />
                        {exp.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{exp.date}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {exp.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      -{formatAmount(exp.amount)}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-1">
                      <button
                        onClick={() => handleDuplicate(exp.id)}
                        title="Duplicate"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => fetchExpenses(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => fetchExpenses(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    pagination.page === p
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchExpenses(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        isOpen={isAddModalOpen || Boolean(editingExpense)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={() => fetchExpenses(pagination.page)}
        initialData={editingExpense}
      />
    </div>
  );
}

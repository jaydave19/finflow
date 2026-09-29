import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Lock,
  CheckCircle,
  RotateCcw,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ExpenseModal } from '../components/expenses/ExpenseModal.tsx';

export function IPOTracker() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ipoExpenses, setIpoExpenses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const fetchIpoData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses?isIpoOnly=true&limit=100');
      setIpoExpenses(res.expenses || []);
    } catch {
      showToast({ type: 'error', message: 'Failed to load IPO transactions' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchIpoData();
    const handleRefresh = () => fetchIpoData();
    window.addEventListener('finflow:refresh-data', handleRefresh);
    return () => window.removeEventListener('finflow:refresh-data', handleRefresh);
  }, [fetchIpoData]);

  // Quick Status Updater
  const handleUpdateStatus = async (exp: any, newStatus: 'Blocked' | 'Allotted' | 'Refunded' | 'Sold') => {
    try {
      const updatedIpoDetails = {
        ...exp.ipoDetails,
        status: newStatus,
        mandateStatus:
          newStatus === 'Blocked'
            ? 'ASBA Mandate Blocked'
            : newStatus === 'Allotted'
            ? 'Shares Allotted & Funds Debited'
            : newStatus === 'Refunded'
            ? 'Mandate Revoked / Unblocked'
            : 'Shares Sold in Secondary Market',
      };

      await api.put(`/expenses/${exp.id}`, {
        ipoDetails: updatedIpoDetails,
        note: `${exp.ipoDetails?.ipoName || 'IPO'} - Status: ${newStatus}`,
      });

      showToast({
        type: 'success',
        message: `Updated status of ${exp.ipoDetails?.ipoName || 'IPO'} to ${newStatus}.`,
      });
      fetchIpoData();
    } catch {
      showToast({ type: 'error', message: 'Failed to update IPO status.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.delete(`/expenses/${id}`);
      setIpoExpenses(prev => prev.filter(e => e.id !== id));
      showToast({
        type: 'info',
        message: `Deleted IPO entry "${name || 'IPO'}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/expenses/${id}/restore`);
            showToast({ type: 'success', message: 'IPO entry restored!' });
            fetchIpoData();
          } catch {
            showToast({ type: 'error', message: 'Failed to restore IPO entry.' });
          }
        },
      });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete IPO entry.' });
    }
  };

  // Compute KPI summaries
  let totalBlockedAmount = 0;
  let blockedCount = 0;
  let totalAllottedAmount = 0;
  let allottedCount = 0;
  let totalRefundedAmount = 0;

  for (const item of ipoExpenses) {
    const status = item.ipoDetails?.status || 'Blocked';
    const amount = Number(item.amount || 0);
    if (status === 'Blocked' || status === 'Applied') {
      totalBlockedAmount += amount;
      blockedCount++;
    } else if (status === 'Allotted') {
      totalAllottedAmount += amount;
      allottedCount++;
    } else if (status === 'Refunded') {
      totalRefundedAmount += amount;
    }
  }

  // Filtered List
  const filteredList = ipoExpenses.filter(item => {
    const details = item.ipoDetails || {};
    const nameMatch =
      (details.ipoName || item.note || '').toLowerCase().includes(search.toLowerCase());
    const statusMatch =
      statusFilter === 'ALL' || (details.status || 'Blocked') === statusFilter;
    return nameMatch && statusMatch;
  });

  return (
    <div className="space-y-6">
      {/* Intro banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Stock Market & IPO ASBA Mandates
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Share & IPO Capital Tracker
          </h2>
          <p className="text-sm text-indigo-200 mt-2 leading-relaxed">
            Track which IPOs your money is currently blocked for in bank ASBA/UPI mandates.
            Update status to Allotted or Refunded to balance your portfolio and free up liquid cash.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Record IPO Application
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Currently Blocked Funds */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Capital Blocked</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {formatAmount(totalBlockedAmount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {blockedCount} Active UPI / ASBA mandate(s)
          </p>
        </div>

        {/* Allotted Shares Value */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allotted Shares Value</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatAmount(totalAllottedAmount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {allottedCount} Successfully allotted IPO(s)
          </p>
        </div>

        {/* Total Amount Unblocked / Refunded */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Unblocked / Refunded</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatAmount(totalRefundedAmount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Returned to bank account balance
          </p>
        </div>

        {/* Total Applications Count */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total IPO Bids Logged</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {ipoExpenses.length}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
            Lifetime Applications
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search IPO or stock name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'Blocked', 'Allotted', 'Refunded', 'Sold'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main IPO Applications Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active & Past IPO Applications</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">All money blocked and allotted records</p>
          </div>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {filteredList.length} Entries
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Landmark className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No IPO applications found</p>
            <p className="mt-1">Click &quot;Record IPO Application&quot; to track blocked capital for an upcoming IPO.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-6">IPO / Stock Name</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4">Lots / Shares</th>
                  <th className="py-3 px-4">Bid Price</th>
                  <th className="py-3 px-4">Blocked Amount</th>
                  <th className="py-3 px-4">Mandate & Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                {filteredList.map(exp => {
                  const details = exp.ipoDetails || {};
                  const status = details.status || 'Blocked';
                  const isBlocked = status === 'Blocked' || status === 'Applied';
                  const isAllotted = status === 'Allotted';
                  const isRefunded = status === 'Refunded';

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Landmark className="w-4 h-4" />
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {details.ipoName || exp.note || 'IPO Application'}
                            </p>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {exp.paymentMethod} • ASBA
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium">{exp.date}</td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {details.sharesCount ? `${details.sharesCount} shares` : '-'}
                        </span>
                        {details.lotSize && (
                          <span className="block text-[10px] text-slate-400">
                            ({details.lotSize} lot)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-semibold">
                        {details.bidPrice ? `₹${details.bidPrice}` : '-'}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        {formatAmount(exp.amount)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isBlocked
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : isAllotted
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : isRefunded
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                            }`}
                          >
                            {isBlocked && <Lock className="w-3 h-3" />}
                            {isAllotted && <CheckCircle className="w-3 h-3" />}
                            {isRefunded && <RotateCcw className="w-3 h-3" />}
                            {status}
                          </span>

                          {/* Quick Change Status Dropdown */}
                          <select
                            value={status}
                            onChange={e => handleUpdateStatus(exp, e.target.value as any)}
                            className="text-[10px] py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                          >
                            <option value="Blocked">Blocked</option>
                            <option value="Allotted">Allotted</option>
                            <option value="Refunded">Refunded</option>
                            <option value="Sold">Sold</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1">
                        <button
                          onClick={() => setEditingExpense(exp)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id, details.ipoName || exp.note)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for adding/editing IPO */}
      <ExpenseModal
        isOpen={isAddModalOpen || Boolean(editingExpense)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={fetchIpoData}
        initialData={editingExpense}
        defaultIsIpo={true}
      />
    </div>
  );
}

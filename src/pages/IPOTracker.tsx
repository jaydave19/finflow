import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Lock,
  CheckCircle,
  RotateCcw,
  TrendingUp,
  Plus,
  Search,
  Trash2,
  Edit2,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { IpoModal } from '../components/ipo/IpoModal.tsx';

interface IpoItem {
  id: string;
  ipoName: string;
  amount: number;
  applicationDate: string;
  paymentMethod: string;
  sharesCount?: number;
  bidPrice?: number;
  lotSize?: number;
  status: 'Blocked' | 'Allotted' | 'Refunded' | 'Sold';
  mandateStatus?: string;
  allotmentDate?: string;
  bankName?: string;
  dematAccount?: string;
  note?: string;
  createdAt: string;
}

export function IPOTracker() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ipos, setIpos] = useState<IpoItem[]>([]);
  const [stats, setStats] = useState({
    totalBlockedAmount: 0,
    blockedCount: 0,
    totalAllottedAmount: 0,
    allottedCount: 0,
    totalRefundedAmount: 0,
    totalApplications: 0,
    totalProfitLoss: 0,
    totalRealizedValue: 0,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIpo, setEditingIpo] = useState<IpoItem | null>(null);
  
  // Sold Modal State
  const [soldModalItem, setSoldModalItem] = useState<IpoItem | null>(null);
  const [soldPriceInput, setSoldPriceInput] = useState('');

  const fetchIpoData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ipos');
      setIpos(res.ipos || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load IPO applications' });
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
  const handleUpdateStatus = async (item: IpoItem, newStatus: 'Blocked' | 'Allotted' | 'Refunded' | 'Sold') => {
    if (newStatus === 'Sold') {
      setSoldModalItem(item);
      setSoldPriceInput('');
      return;
    }
    await processStatusUpdate(item, newStatus);
  };

  const processStatusUpdate = async (item: IpoItem, newStatus: 'Blocked' | 'Allotted' | 'Refunded' | 'Sold', finalSoldPrice?: number) => {
    try {
      const mandateMsg =
        newStatus === 'Blocked'
          ? 'ASBA Mandate Blocked'
          : newStatus === 'Allotted'
          ? 'Shares Allotted & Funds Debited'
          : newStatus === 'Refunded'
          ? 'Mandate Revoked / Unblocked'
          : 'Shares Sold in Secondary Market';

      await api.put(`/ipos/${item.id}`, {
        status: newStatus,
        mandateStatus: mandateMsg,
        soldPrice: finalSoldPrice,
      });

      showToast({
        type: 'success',
        message: `Updated status of ${item.ipoName} to ${newStatus}.`,
      });
      fetchIpoData();
    } catch {
      showToast({ type: 'error', message: 'Failed to update IPO status.' });
    }
  };

  const submitSoldPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soldModalItem) return;
    const finalSoldPrice = soldPriceInput.trim() !== '' ? parseFloat(soldPriceInput) : undefined;
    await processStatusUpdate(soldModalItem, 'Sold', finalSoldPrice);
    setSoldModalItem(null);
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.delete(`/ipos/${id}`);
      setIpos(prev => prev.filter(e => e.id !== id));
      showToast({
        type: 'info',
        message: `Deleted IPO entry "${name || 'IPO'}".`,
        undoLabel: 'Undo',
        duration: 7000,
        onUndo: async () => {
          try {
            await api.post(`/ipos/${id}/restore`);
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

  // Filtered List
  const filteredList = ipos.filter(item => {
    const nameMatch = (item.ipoName || item.note || '').toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === 'ALL' || item.status === statusFilter;
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
            Manage your IPO applications separately from everyday living expenses.
            Blocked funds are tracked as ASBA mandates and do not inflate your monthly expense totals.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => {
                setEditingIpo(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Record IPO Application
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Currently Blocked Funds */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Capital Blocked</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {formatAmount(stats.totalBlockedAmount || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.blockedCount || 0} Active UPI / ASBA mandate(s)
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
            {formatAmount(stats.totalAllottedAmount || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.allottedCount || 0} Successfully allotted IPO(s)
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
            {formatAmount(stats.totalRefundedAmount || 0)}
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
            {stats.totalApplications || ipos.length}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
            Separately Tracked Portfolio
          </p>
        </div>

        {/* Realized Profit & Loss */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Profit / Loss</span>
            <div className={`p-2 rounded-xl ${stats.totalProfitLoss >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${stats.totalProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {stats.totalProfitLoss >= 0 ? '+' : ''}{formatAmount(stats.totalProfitLoss || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Net realized P&L from sold IPOs
          </p>
        </div>

        {/* Realized Value (Takes) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Money Taken (Returns)</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatAmount(stats.totalRealizedValue || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total returned to bank after sale
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search IPO name..."
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
            <p className="text-xs text-slate-500 dark:text-slate-400">All money blocked and allotted records (Isolated from general expenses)</p>
          </div>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {filteredList.length} Entries
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading IPO records...</div>
        ) : filteredList.length === 0 ? (
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
                  <th className="py-3 px-6">IPO / Company Name</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4">Lots / Shares</th>
                  <th className="py-3 px-4">Bid Price</th>
                  <th className="py-3 px-4">Blocked Capital</th>
                  <th className="py-3 px-4">Mandate & Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                {filteredList.map(item => {
                  const status = item.status || 'Blocked';
                  const isBlocked = status === 'Blocked';
                  const isAllotted = status === 'Allotted';
                  const isRefunded = status === 'Refunded';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Landmark className="w-4 h-4" />
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {item.ipoName}
                            </p>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {item.paymentMethod} • ASBA
                              {item.bankName ? ` (${item.bankName})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium">{item.applicationDate}</td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {item.sharesCount ? `${item.sharesCount} shares` : '-'}
                        </span>
                        {item.lotSize && (
                          <span className="block text-[10px] text-slate-400">
                            ({item.lotSize} lot)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-semibold">
                        {item.bidPrice ? `₹${item.bidPrice}` : '-'}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                        {formatAmount(item.amount)}
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
                            onChange={e => handleUpdateStatus(item, e.target.value as any)}
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
                          onClick={() => {
                            setEditingIpo(item);
                            setIsAddModalOpen(true);
                          }}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.ipoName)}
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
      <IpoModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingIpo(null);
        }}
        onSuccess={fetchIpoData}
        initialData={editingIpo}
      />

      {/* Attractive Sold Price Modal */}
      {soldModalItem && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sold {soldModalItem.ipoName}</h3>
                <p className="text-xs text-slate-500">Record secondary market sale</p>
              </div>
            </div>
            
            <form onSubmit={submitSoldPrice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sold Price per Share (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    value={soldPriceInput}
                    onChange={(e) => setSoldPriceInput(e.target.value)}
                    placeholder="Leave blank to skip"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSoldModalItem(null)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 transition-all"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

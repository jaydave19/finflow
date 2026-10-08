import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, TrendingUp, Plus, Trash2, Edit2, Coins, ArrowRightLeft } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface InvestmentItem {
  id: string;
  investmentName: string;
  investmentType: string;
  amountInvested: number;
  currentValue: number;
  startDate: string;
  status: 'ACTIVE' | 'WITHDRAWN';
  createdAt: string;
}

export function InvestmentsPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [investments, setInvestments] = useState<InvestmentItem[]>([]);
  const [summary, setSummary] = useState({ totalInvested: 0, totalCurrentValue: 0, totalReturns: 0, activeCount: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvestmentItem | null>(null);
  
  // Withdrawn Modal State
  const [withdrawnModalItem, setWithdrawnModalItem] = useState<InvestmentItem | null>(null);
  const [withdrawnValueInput, setWithdrawnValueInput] = useState('');

  // Form Fields
  const [investmentName, setInvestmentName] = useState('');
  const [investmentType, setInvestmentType] = useState('Mutual Funds');
  const [amountInvested, setAmountInvested] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [startDate, setStartDate] = useState('');

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/investments');
      setInvestments(data.investments || []);
      setSummary(data.summary || { totalInvested: 0, totalCurrentValue: 0, totalReturns: 0, activeCount: 0 });
    } catch {
      showToast({ type: 'error', message: 'Failed to load investments.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setInvestmentName('');
    setInvestmentType('Mutual Funds');
    setAmountInvested('');
    setCurrentValue('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: InvestmentItem) => {
    setEditingItem(item);
    setInvestmentName(item.investmentName);
    setInvestmentType(item.investmentType);
    setAmountInvested(String(item.amountInvested));
    setCurrentValue(item.currentValue ? String(item.currentValue) : '');
    setStartDate(item.startDate);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investmentName.trim() || !amountInvested) {
      showToast({ type: 'error', message: 'Investment Name and Amount are required.' });
      return;
    }

    try {
      const payload = {
        investmentName,
        investmentType,
        amountInvested: parseFloat(amountInvested),
        currentValue: currentValue ? parseFloat(currentValue) : parseFloat(amountInvested),
        startDate,
      };

      if (editingItem) {
        await api.put(`/investments/${editingItem.id}`, payload);
        showToast({ type: 'success', message: 'Investment updated.' });
      } else {
        await api.post('/investments', payload);
        showToast({ type: 'success', message: 'Investment added.' });
      }
      setIsModalOpen(false);
      fetchInvestments();
    } catch {
      showToast({ type: 'error', message: 'Failed to save record.' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investments/${id}`);
      showToast({ type: 'success', message: 'Record deleted.' });
      fetchInvestments();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  const toggleStatus = async (item: InvestmentItem) => {
    if (item.status === 'ACTIVE') {
      setWithdrawnModalItem(item);
      setWithdrawnValueInput(item.currentValue ? String(item.currentValue) : String(item.amountInvested));
      return;
    } else {
      try {
        await api.put(`/investments/${item.id}`, { status: 'ACTIVE' });
        showToast({ type: 'success', message: 'Status reverted to ACTIVE.' });
        fetchInvestments();
      } catch {
        showToast({ type: 'error', message: 'Failed to update status.' });
      }
    }
  };

  const submitWithdrawnValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawnModalItem) return;
    
    const finalValue = withdrawnValueInput.trim() !== '' ? parseFloat(withdrawnValueInput) : (withdrawnModalItem.currentValue || withdrawnModalItem.amountInvested);

    try {
      await api.put(`/investments/${withdrawnModalItem.id}`, { 
        status: 'WITHDRAWN',
        currentValue: finalValue
      });
      showToast({ type: 'success', message: 'Investment marked as withdrawn and final value recorded.' });
      fetchInvestments();
    } catch {
      showToast({ type: 'error', message: 'Failed to record withdrawn investment.' });
    }
    setWithdrawnModalItem(null);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'Gold': return <Coins className="w-5 h-5 text-amber-500" />;
      case 'Mutual Funds': return <PieChart className="w-5 h-5 text-indigo-500" />;
      case 'Stocks': return <TrendingUp className="w-5 h-5 text-blue-500" />;
      default: return <PieChart className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <PieChart className="w-8 h-8" />
            Investments
          </h2>
          <p className="text-green-100 mt-2">Track your portfolio value and returns</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-all font-semibold"
        >
          <Plus className="w-5 h-5" /> Add Investment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-500" /> Total Invested
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatAmount(summary.totalInvested)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Current Value
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatAmount(summary.totalCurrentValue)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-500" /> Total Returns
          </p>
          <p className={`text-2xl font-bold mt-2 ${summary.totalReturns >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.totalReturns >= 0 ? '+' : ''}{formatAmount(summary.totalReturns)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold">Portfolio Records</h3>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500 text-center">Loading...</p>
        ) : investments.length === 0 ? (
          <p className="p-6 text-slate-500 text-center">No investments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4">Investment Details</th>
                  <th className="p-4">Invested</th>
                  <th className="p-4">Current Value</th>
                  <th className="p-4">Returns</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {investments.map(item => {
                  const returns = (item.currentValue || item.amountInvested) - item.amountInvested;
                  const returnPct = item.amountInvested > 0 ? (returns / item.amountInvested) * 100 : 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            {getIcon(item.investmentType)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.investmentName}</p>
                            <p className="text-xs text-slate-500">{item.investmentType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold">{formatAmount(item.amountInvested)}</td>
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{formatAmount(item.currentValue || item.amountInvested)}</td>
                      <td className="p-4">
                        <p className={`font-bold ${returns >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {returns >= 0 ? '+' : ''}{formatAmount(returns)}
                        </p>
                        <p className={`text-xs ${returns >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {returns >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                        </p>
                      </td>
                      <td className="p-4">
                        <button onClick={() => toggleStatus(item)} className={`px-2 py-1 rounded-md text-xs font-bold ${item.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.status}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => handleOpenEditModal(item)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{editingItem ? 'Edit Investment' : 'Add Investment'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Name / Ticker</label>
                  <input required type="text" value={investmentName} onChange={e=>setInvestmentName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. NIFTY 50" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Asset Type</label>
                  <select value={investmentType} onChange={e=>setInvestmentType(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                    <option value="Mutual Funds">Mutual Funds</option>
                    <option value="Stocks">Stocks</option>
                    <option value="Fixed Deposit">Fixed Deposit</option>
                    <option value="Gold">Gold</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Amount Invested</label>
                  <input required type="number" step="any" value={amountInvested} onChange={e=>setAmountInvested(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Current Value</label>
                  <input type="number" step="any" value={currentValue} onChange={e=>setCurrentValue(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Optional" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Start Date</label>
                  <input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdrawn Value Modal */}
      {withdrawnModalItem && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Withdraw Investment</h3>
                <p className="text-xs text-slate-500">Enter the final returned value</p>
              </div>
            </div>
            
            <form onSubmit={submitWithdrawnValue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Final Value / Sold Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={withdrawnValueInput}
                    onChange={(e) => setWithdrawnValueInput(e.target.value)}
                    placeholder="Enter withdrawn amount"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>
              
              {withdrawnValueInput && !isNaN(parseFloat(withdrawnValueInput)) && (
                (() => {
                  const final = parseFloat(withdrawnValueInput);
                  const invested = withdrawnModalItem.amountInvested;
                  const pl = final - invested;
                  const plPct = invested > 0 ? (pl / invested) * 100 : 0;
                  const isProfit = pl >= 0;

                  return (
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      isProfit
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                    }`}>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider">
                          Realized {isProfit ? 'Profit' : 'Loss'}
                        </div>
                        <div className="text-sm font-extrabold mt-0.5">
                          {isProfit ? '+' : ''}₹{Math.abs(Math.round(pl)).toLocaleString()} ({isProfit ? '+' : ''}{plPct.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawnModalItem(null)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  Confirm Withdrawal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

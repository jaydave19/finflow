import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Plus, Trash2, Edit2, DollarSign, Briefcase, ChevronRight, Activity, Percent, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface InvTransaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  units?: number;
  price?: number;
  realizedPl?: number;
}

interface InvestmentItem {
  id: string;
  investmentName: string;
  investmentType: string;
  platform?: string;
  amountInvested: number;
  currentValue: number;
  startDate: string;
  unitsQuantity?: number;
  buyPrice?: number;
  notes?: string;
  goalTag?: string;
  interestRate?: number;
  tenureMonths?: number;
  maturityDate?: string;
  maturityAmount?: number;
  autoRenew?: boolean;
  sipAmount?: number;
  sipDate?: number;
  yearlyDeposit?: number;
  lockInEnd?: string;
  status: string;
  dashboard: {
    profitLoss: number;
    returnPct: number;
  };
  transactions: InvTransaction[];
}

const INV_TYPES = [
  'Stocks', 'Mutual Funds (SIP)', 'Mutual Funds (Lump sum)', 'ETFs', 'Fixed Deposit (FD)', 
  'Recurring Deposit (RD)', 'PPF', 'EPF/VPF', 'NPS', 'Gold (Physical/Digital/SGB)', 
  'Silver', 'Bonds/Debentures', 'Post Office Schemes', 'Real Estate/Land', 'Crypto', 
  'Insurance (ULIP)', 'Chit Fund', 'Business/Startup', 'Other'
];

export function InvestmentsPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [investments, setInvestments] = useState<InvestmentItem[]>([]);
  const [summary, setSummary] = useState({ totalInvested: 0, currentValue: 0, totalProfit: 0, overallReturnPct: 0, activeCount: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvestmentItem | null>(null);

  // Form Fields
  const [investmentName, setInvestmentName] = useState('');
  const [investmentType, setInvestmentType] = useState('Mutual Funds (SIP)');
  const [platform, setPlatform] = useState('');
  const [amountInvested, setAmountInvested] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [unitsQuantity, setUnitsQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [goalTag, setGoalTag] = useState('');
  const [notes, setNotes] = useState('');
  
  // Specific fields
  const [interestRate, setInterestRate] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [maturityAmount, setMaturityAmount] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [sipAmount, setSipAmount] = useState('');
  const [sipDate, setSipDate] = useState('');
  const [yearlyDeposit, setYearlyDeposit] = useState('');
  const [lockInEnd, setLockInEnd] = useState('');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState('SELL');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txUnits, setTxUnits] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [selectedInvForTx, setSelectedInvForTx] = useState<InvestmentItem | null>(null);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/investments');
      setInvestments(data.investments || []);
      setSummary(data.summary || { totalInvested: 0, currentValue: 0, totalProfit: 0, overallReturnPct: 0, activeCount: 0 });
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
    setInvestmentType('Mutual Funds (SIP)');
    setPlatform('');
    setAmountInvested('');
    setCurrentValue('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setUnitsQuantity('');
    setBuyPrice('');
    setGoalTag('');
    setNotes('');
    setInterestRate('');
    setTenureMonths('');
    setMaturityDate('');
    setMaturityAmount('');
    setAutoRenew(false);
    setSipAmount('');
    setSipDate('');
    setYearlyDeposit('');
    setLockInEnd('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: InvestmentItem) => {
    setEditingItem(item);
    setInvestmentName(item.investmentName);
    setInvestmentType(item.investmentType);
    setPlatform(item.platform || '');
    setAmountInvested(String(item.amountInvested));
    setCurrentValue(item.currentValue !== null ? String(item.currentValue) : '');
    setStartDate(item.startDate);
    setUnitsQuantity(item.unitsQuantity ? String(item.unitsQuantity) : '');
    setBuyPrice(item.buyPrice ? String(item.buyPrice) : '');
    setGoalTag(item.goalTag || '');
    setNotes(item.notes || '');
    setInterestRate(item.interestRate ? String(item.interestRate) : '');
    setTenureMonths(item.tenureMonths ? String(item.tenureMonths) : '');
    setMaturityDate(item.maturityDate || '');
    setMaturityAmount(item.maturityAmount ? String(item.maturityAmount) : '');
    setAutoRenew(item.autoRenew || false);
    setSipAmount(item.sipAmount ? String(item.sipAmount) : '');
    setSipDate(item.sipDate ? String(item.sipDate) : '');
    setYearlyDeposit(item.yearlyDeposit ? String(item.yearlyDeposit) : '');
    setLockInEnd(item.lockInEnd || '');
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
        platform: platform || undefined,
        amountInvested: parseFloat(amountInvested),
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        startDate,
        unitsQuantity: unitsQuantity ? parseFloat(unitsQuantity) : undefined,
        buyPrice: buyPrice ? parseFloat(buyPrice) : undefined,
        goalTag: goalTag || undefined,
        notes: notes || undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        tenureMonths: tenureMonths ? parseInt(tenureMonths) : undefined,
        maturityDate: maturityDate || undefined,
        maturityAmount: maturityAmount ? parseFloat(maturityAmount) : undefined,
        autoRenew,
        sipAmount: sipAmount ? parseFloat(sipAmount) : undefined,
        sipDate: sipDate ? parseInt(sipDate) : undefined,
        yearlyDeposit: yearlyDeposit ? parseFloat(yearlyDeposit) : undefined,
        lockInEnd: lockInEnd || undefined
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

  const handleOpenTxModal = (inv: InvestmentItem) => {
    setSelectedInvForTx(inv);
    setTxType('SELL');
    setTxAmount('');
    setTxUnits('');
    setTxPrice('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsTxModalOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvForTx || !txAmount) return;
    try {
      await api.post(`/investments/${selectedInvForTx.id}/transactions`, {
        date: txDate,
        type: txType,
        amount: parseFloat(txAmount),
        units: txUnits ? parseFloat(txUnits) : undefined,
        price: txPrice ? parseFloat(txPrice) : undefined
      });
      showToast({ type: 'success', message: `${txType} transaction recorded` });
      setIsTxModalOpen(false);
      fetchInvestments();
    } catch {
      showToast({ type: 'error', message: 'Failed to record transaction' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return;
    try {
      await api.delete(`/investments/${id}`);
      showToast({ type: 'success', message: 'Record deleted.' });
      fetchInvestments();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-8 h-8" />
            Investment Portfolio
          </h2>
          <p className="text-emerald-100 mt-2">Track Stocks, Mutual Funds, FDs, and other assets seamlessly</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-all font-semibold whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Invested</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatAmount(summary.totalInvested)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Current Value</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatAmount(summary.currentValue)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Overall Return</p>
          <p className={`text-2xl font-bold mt-2 flex items-center gap-1 ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.totalProfit >= 0 ? <ArrowUpRight className="w-5 h-5"/> : <ArrowDownRight className="w-5 h-5"/>}
            {formatAmount(Math.abs(summary.totalProfit))}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm text-white">
          <p className="text-indigo-100 text-xs font-semibold uppercase tracking-wider">Absolute Returns</p>
          <p className="text-3xl font-black mt-1 flex items-center gap-1">
            {summary.overallReturnPct > 0 ? '+' : ''}{summary.overallReturnPct.toFixed(2)}%
          </p>
          <p className="text-[10px] mt-1 opacity-80">{summary.activeCount} Active Assets</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden p-6">
        <h3 className="text-lg font-bold mb-4">Your Assets</h3>
        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading portfolio...</p>
        ) : investments.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No investments found.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {investments.map(item => (
              <div 
                key={item.id} 
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all bg-slate-50 dark:bg-slate-800/40 relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.investmentName}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {item.investmentType}
                      </span>
                    </div>
                    {item.platform && <p className="text-xs text-slate-500 mt-0.5">Platform: {item.platform}</p>}
                    
                    <div className="mt-4 flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Invested</p>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{formatAmount(item.amountInvested)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Current Value</p>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{formatAmount(item.currentValue)}</p>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Return</p>
                        <p className={`font-bold text-sm flex items-center justify-end gap-0.5 ${item.dashboard.returnPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.dashboard.returnPct > 0 ? '+' : ''}{item.dashboard.returnPct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    
                    {(item.unitsQuantity || item.buyPrice || item.goalTag) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 text-[11px] text-slate-500">
                        {item.unitsQuantity && <span><strong className="text-slate-700 dark:text-slate-300">Units:</strong> {item.unitsQuantity}</span>}
                        {item.buyPrice && <span><strong className="text-slate-700 dark:text-slate-300">Avg Buy:</strong> {formatAmount(item.buyPrice)}</span>}
                        {item.goalTag && <span className="text-indigo-600 font-semibold">🎯 Goal: {item.goalTag}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => handleOpenTxModal(item)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg text-xs font-bold transition-colors">
                      Sell / Buy
                    </button>
                    <div className="flex gap-1 justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEditModal(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full shadow-2xl my-8">
            <h3 className="text-xl font-bold mb-6">{editingItem ? 'Edit Asset' : 'Add New Asset'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Asset Name / Scheme *</label>
                  <input required type="text" value={investmentName} onChange={e=>setInvestmentName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Nifty 50 Index Fund" />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold mb-1">Asset Class / Type *</label>
                  <select value={investmentType} onChange={e=>setInvestmentType(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 text-sm">
                    {INV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Platform / Broker / Bank</label>
                  <input type="text" value={platform} onChange={e=>setPlatform(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. Zerodha, SBI" />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Amount Invested (₹) *</label>
                  <input required type="number" step="any" value={amountInvested} onChange={e=>setAmountInvested(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Current Value (₹)</label>
                  <input type="number" step="any" value={currentValue} onChange={e=>setCurrentValue(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="Leave blank to use invested amount" />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date / Buy Date *</label>
                  <input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Goal Tag</label>
                  <select value={goalTag} onChange={e=>setGoalTag(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 text-sm">
                    <option value="">None</option>
                    <option value="Retirement">Retirement</option>
                    <option value="House">House</option>
                    <option value="Child Education">Child Education</option>
                    <option value="Emergency Fund">Emergency Fund</option>
                    <option value="Vacation">Vacation</option>
                  </select>
                </div>
              </div>

              {/* Conditional Fields based on Type */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Type-Specific Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {(investmentType.includes('Stocks') || investmentType.includes('Mutual') || investmentType.includes('ETF') || investmentType.includes('Gold') || investmentType.includes('Crypto')) && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Quantity / Units</label>
                        <input type="number" step="any" value={unitsQuantity} onChange={e=>setUnitsQuantity(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.0" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Average Buy Price (₹)</label>
                        <input type="number" step="any" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.00" />
                      </div>
                    </>
                  )}

                  {(investmentType.includes('FD') || investmentType.includes('RD') || investmentType.includes('Bonds')) && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Interest Rate (% p.a.)</label>
                        <input type="number" step="any" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="7.5" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Maturity Date</label>
                        <input type="date" value={maturityDate} onChange={e=>setMaturityDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Maturity Amount (₹)</label>
                        <input type="number" step="any" value={maturityAmount} onChange={e=>setMaturityAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.00" />
                      </div>
                    </>
                  )}

                  {investmentType.includes('SIP') && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Monthly SIP Amount (₹)</label>
                        <input type="number" step="any" value={sipAmount} onChange={e=>setSipAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">SIP Deduction Date (1-31)</label>
                        <input type="number" min="1" max="31" value={sipDate} onChange={e=>setSipDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                      </div>
                    </>
                  )}
                  
                  {investmentType.includes('PPF') && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Yearly Deposit Target (₹)</label>
                        <input type="number" step="any" value={yearlyDeposit} onChange={e=>setYearlyDeposit(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Lock-in End Date</label>
                        <input type="date" value={lockInEnd} onChange={e=>setLockInEnd(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors">Save Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTxModalOpen && selectedInvForTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-1">Record Transaction</h3>
            <p className="text-xs text-slate-500 mb-6">{selectedInvForTx.investmentName}</p>
            <form onSubmit={handleSaveTx} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select value={txType} onChange={e=>setTxType(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 font-bold">
                  <option value="SELL">Sell / Redeem / Withdraw</option>
                  <option value="BUY">Buy More / SIP Installment</option>
                  <option value="DIVIDEND">Dividend Received</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Amount (₹) *</label>
                <input required type="number" step="any" value={txAmount} onChange={e=>setTxAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 font-bold text-lg text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Units (Optional)</label>
                  <input type="number" step="any" value={txUnits} onChange={e=>setTxUnits(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Price (Optional)</label>
                  <input type="number" step="any" value={txPrice} onChange={e=>setTxPrice(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Date *</label>
                <input type="date" required value={txDate} onChange={e=>setTxDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-md">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Car, Plus, Trash2, Edit2, TrendingUp, Briefcase, GraduationCap, Banknote, Users } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface LoanItem {
  id: string;
  loanName: string;
  bankName: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  rateType: string;
  tenureMonths: number;
  emiAmount: number;
  startDate: string;
  firstEmiDate: string;
  processingFee: number;
  otherCharges: number;
  linkedAccount: string;
  accountNumberMasked: string;
  coBorrower: string;
  status: 'ACTIVE' | 'CLOSED' | 'OVERDUE';
  createdAt: string;
}

export function LoansPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [summary, setSummary] = useState({ totalPrincipal: 0, totalEmi: 0, activeLoansCount: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LoanItem | null>(null);

  // Form Fields
  const [loanName, setLoanName] = useState('');
  const [bankName, setBankName] = useState('');
  const [loanType, setLoanType] = useState('Personal');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [rateType, setRateType] = useState('Fixed');
  const [tenureMonths, setTenureMonths] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [firstEmiDate, setFirstEmiDate] = useState('');
  const [processingFee, setProcessingFee] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [linkedAccount, setLinkedAccount] = useState('');
  const [accountNumberMasked, setAccountNumberMasked] = useState('');
  const [coBorrower, setCoBorrower] = useState('');

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/loans');
      setLoans(data.loans || []);
      setSummary(data.summary || { totalPrincipal: 0, totalEmi: 0, activeLoansCount: 0 });
    } catch {
      showToast({ type: 'error', message: 'Failed to load loan records.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    const p = parseFloat(principalAmount);
    const rAnnual = parseFloat(interestRate);
    const n = parseInt(tenureMonths, 10);

    if (!isNaN(p) && !isNaN(rAnnual) && !isNaN(n) && p > 0 && rAnnual >= 0 && n > 0 && !editingItem) {
      if (rAnnual === 0) {
        setEmiAmount((p / n).toFixed(2));
      } else {
        const rMonthly = rAnnual / 12 / 100;
        const mathPower = Math.pow(1 + rMonthly, n);
        const emi = (p * rMonthly * mathPower) / (mathPower - 1);
        setEmiAmount(emi.toFixed(2));
      }
    }
  }, [principalAmount, interestRate, tenureMonths, editingItem]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setLoanName('');
    setBankName('');
    setLoanType('Personal');
    setPrincipalAmount('');
    setInterestRate('');
    setRateType('Fixed');
    setTenureMonths('');
    setEmiAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setFirstEmiDate('');
    setProcessingFee('');
    setOtherCharges('');
    setLinkedAccount('');
    setAccountNumberMasked('');
    setCoBorrower('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LoanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setLoanName(item.loanName);
    setBankName(item.bankName);
    setLoanType(item.loanType);
    setPrincipalAmount(String(item.principalAmount));
    setInterestRate(String(item.interestRate));
    setRateType(item.rateType || 'Fixed');
    setTenureMonths(String(item.tenureMonths));
    setEmiAmount(String(item.emiAmount));
    setStartDate(item.startDate);
    setFirstEmiDate(item.firstEmiDate || '');
    setProcessingFee(item.processingFee ? String(item.processingFee) : '');
    setOtherCharges(item.otherCharges ? String(item.otherCharges) : '');
    setLinkedAccount(item.linkedAccount || '');
    setAccountNumberMasked(item.accountNumberMasked || '');
    setCoBorrower(item.coBorrower || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanName.trim() || !principalAmount) {
      showToast({ type: 'error', message: 'Loan Name and Amount are required.' });
      return;
    }

    try {
      const payload = {
        loanName,
        bankName,
        loanType,
        principalAmount: parseFloat(principalAmount),
        interestRate: parseFloat(interestRate),
        rateType,
        tenureMonths: parseInt(tenureMonths, 10),
        emiAmount: parseFloat(emiAmount),
        startDate,
        firstEmiDate: firstEmiDate || undefined,
        processingFee: processingFee ? parseFloat(processingFee) : 0,
        otherCharges: otherCharges ? parseFloat(otherCharges) : 0,
        linkedAccount: linkedAccount || undefined,
        accountNumberMasked: accountNumberMasked || undefined,
        coBorrower: coBorrower || undefined,
      };

      if (editingItem) {
        await api.put(`/loans/${editingItem.id}`, payload);
        showToast({ type: 'success', message: 'Loan updated.' });
      } else {
        await api.post('/loans', payload);
        showToast({ type: 'success', message: 'Loan record added.' });
      }
      setIsModalOpen(false);
      fetchLoans();
    } catch {
      showToast({ type: 'error', message: 'Failed to save record.' });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this loan? All schedules will be lost.')) return;
    try {
      await api.delete(`/loans/${id}`);
      showToast({ type: 'success', message: 'Record deleted.' });
      fetchLoans();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'Home': return <Home className="w-5 h-5 text-indigo-500" />;
      case 'Auto': return <Car className="w-5 h-5 text-emerald-500" />;
      case 'Education': return <GraduationCap className="w-5 h-5 text-amber-500" />;
      case 'Personal': return <Users className="w-5 h-5 text-blue-500" />;
      default: return <Banknote className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Home className="w-8 h-8" />
            Loan Management
          </h2>
          <p className="text-blue-100 mt-2">Track active loans, amortizations, and EMIs</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-all font-semibold"
        >
          <Plus className="w-5 h-5" /> Add Loan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-500" /> Active Loans
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{summary.activeLoansCount}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Total Principal
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatAmount(summary.totalPrincipal)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rose-500" /> Total Monthly EMI
          </p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{formatAmount(summary.totalEmi)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden p-6">
        <h3 className="text-lg font-bold mb-4">Loan Portfolios</h3>
        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No loan records found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loans.map(item => (
              <div 
                key={item.id} 
                onClick={() => navigate(`/loans/${item.id}`)}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-indigo-500/50 cursor-pointer transition-all bg-slate-50 dark:bg-slate-800/40 relative group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                    {getIcon(item.loanType)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.loanName}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${item.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.bankName} • {item.loanType}</p>
                    
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Principal</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatAmount(item.principalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">EMI</p>
                        <p className="font-bold text-rose-600">{formatAmount(item.emiAmount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <span className="flex-1 text-center font-semibold text-indigo-600">{item.interestRate}% {item.rateType}</span>
                      <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                      <span className="flex-1 text-center font-semibold">{item.tenureMonths} Months</span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <button onClick={(e) => handleOpenEditModal(item, e)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => handleDelete(item.id, e)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full shadow-2xl my-8">
            <h3 className="text-xl font-bold mb-6">{editingItem ? 'Edit Loan Details' : 'Add New Loan'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Loan Name / Description *</label>
                  <input required type="text" value={loanName} onChange={e=>setLoanName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Dream Home Loan" />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold mb-1">Lender / Bank Name *</label>
                  <input required type="text" value={bankName} onChange={e=>setBankName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. SBI, HDFC" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Loan Type</label>
                  <select value={loanType} onChange={e=>setLoanType(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                    <option>Personal</option>
                    <option>Home</option>
                    <option>Auto</option>
                    <option>Education</option>
                    <option>Gold</option>
                    <option>Business</option>
                    <option>Loan Against Property</option>
                    <option>Consumer/EMI</option>
                    <option>Credit card EMI</option>
                    <option>From friend/family</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Principal Amount (₹) *</label>
                  <input required type="number" step="any" value={principalAmount} onChange={e=>setPrincipalAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Interest Rate (% p.a.) *</label>
                  <div className="flex gap-2">
                    <input required type="number" step="any" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className="w-2/3 border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="8.5" />
                    <select value={rateType} onChange={e=>setRateType(e.target.value)} className="w-1/3 border rounded-xl px-2 py-2 dark:bg-slate-800 dark:border-slate-700 text-xs">
                      <option>Fixed</option>
                      <option>Floating</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Tenure (Months) *</label>
                  <input required type="number" value={tenureMonths} onChange={e=>setTenureMonths(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="240" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Calculated EMI Amount (₹) *</label>
                  <input required type="number" step="any" value={emiAmount} onChange={e=>setEmiAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700 font-bold text-rose-600" />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Start Date / Disbursement Date *</label>
                  <input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">First EMI Date (Optional)</label>
                  <input type="date" value={firstEmiDate} onChange={e=>setFirstEmiDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Additional Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Processing Fee (₹)</label>
                    <input type="number" step="any" value={processingFee} onChange={e=>setProcessingFee(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Other Charges (₹)</label>
                    <input type="number" step="any" value={otherCharges} onChange={e=>setOtherCharges(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Linked Auto-Debit Account (Optional)</label>
                    <input type="text" value={linkedAccount} onChange={e=>setLinkedAccount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. HDFC Salary Acc" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Co-Borrower Name (Optional)</label>
                    <input type="text" value={coBorrower} onChange={e=>setCoBorrower(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. Jane Doe" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">Save Loan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

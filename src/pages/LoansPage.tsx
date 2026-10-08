import React, { useState, useEffect, useCallback } from 'react';
import { Home, Car, Plus, Trash2, Edit2, TrendingUp, Briefcase } from 'lucide-react';
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
  tenureMonths: number;
  emiAmount: number;
  startDate: string;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
}

export function LoansPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

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
  const [tenureMonths, setTenureMonths] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [startDate, setStartDate] = useState('');

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

    if (!isNaN(p) && !isNaN(rAnnual) && !isNaN(n) && p > 0 && rAnnual >= 0 && n > 0) {
      if (rAnnual === 0) {
        setEmiAmount((p / n).toFixed(2));
      } else {
        const rMonthly = rAnnual / 12 / 100;
        const mathPower = Math.pow(1 + rMonthly, n);
        const emi = (p * rMonthly * mathPower) / (mathPower - 1);
        setEmiAmount(emi.toFixed(2));
      }
    }
  }, [principalAmount, interestRate, tenureMonths]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setLoanName('');
    setBankName('');
    setLoanType('Personal');
    setPrincipalAmount('');
    setInterestRate('');
    setTenureMonths('');
    setEmiAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LoanItem) => {
    setEditingItem(item);
    setLoanName(item.loanName);
    setBankName(item.bankName);
    setLoanType(item.loanType);
    setPrincipalAmount(String(item.principalAmount));
    setInterestRate(String(item.interestRate));
    setTenureMonths(String(item.tenureMonths));
    setEmiAmount(String(item.emiAmount));
    setStartDate(item.startDate);
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
        tenureMonths: parseInt(tenureMonths, 10),
        emiAmount: parseFloat(emiAmount),
        startDate,
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

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/loans/${id}`);
      showToast({ type: 'success', message: 'Record deleted.' });
      fetchLoans();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  const toggleStatus = async (item: LoanItem) => {
    try {
      await api.put(`/loans/${item.id}`, { status: item.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE' });
      showToast({ type: 'success', message: 'Loan status updated.' });
      fetchLoans();
    } catch {
      showToast({ type: 'error', message: 'Failed to update loan status.' });
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'Home': return <Home className="w-5 h-5 text-indigo-500" />;
      case 'Auto': return <Car className="w-5 h-5 text-emerald-500" />;
      default: return <Briefcase className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Home className="w-8 h-8" />
            Loan System
          </h2>
          <p className="text-blue-100 mt-2">Track active loans, interest rates, and EMIs</p>
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

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold">Loan Records</h3>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500 text-center">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="p-6 text-slate-500 text-center">No loan records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4">Loan Details</th>
                  <th className="p-4">Principal</th>
                  <th className="p-4">Interest & Tenure</th>
                  <th className="p-4">EMI</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loans.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          {getIcon(item.loanType)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{item.loanName}</p>
                          <p className="text-xs text-slate-500">{item.bankName} • {item.loanType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-bold">{formatAmount(item.principalAmount)}</td>
                    <td className="p-4">
                      <p className="font-semibold">{item.interestRate}% <span className="text-xs text-slate-500 font-normal">p.a.</span></p>
                      <p className="text-xs text-slate-500">{item.tenureMonths} months</p>
                    </td>
                    <td className="p-4 font-bold text-rose-600">{formatAmount(item.emiAmount)}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{editingItem ? 'Edit Loan' : 'Add Loan'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Loan Name</label>
                  <input required type="text" value={loanName} onChange={e=>setLoanName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. Dream Home Loan" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Bank Name</label>
                  <input required type="text" value={bankName} onChange={e=>setBankName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="e.g. SBI" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Loan Type</label>
                  <select value={loanType} onChange={e=>setLoanType(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                    <option value="Personal">Personal</option>
                    <option value="Home">Home</option>
                    <option value="Auto">Auto</option>
                    <option value="Education">Education</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Principal Amount</label>
                  <input required type="number" step="any" value={principalAmount} onChange={e=>setPrincipalAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Interest Rate (%)</label>
                  <input required type="number" step="any" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="8.5" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Tenure (Months)</label>
                  <input required type="number" value={tenureMonths} onChange={e=>setTenureMonths(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="240" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">EMI Amount</label>
                  <input required type="number" step="any" value={emiAmount} onChange={e=>setEmiAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
                <div>
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
    </div>
  );
}

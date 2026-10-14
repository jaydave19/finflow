import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Percent, FileText, Zap, IndianRupee } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface LoanSchedule {
  id: string;
  emiNumber: number;
  dueDate: string;
  principalComponent: number;
  interestComponent: number;
  totalEmi: number;
  remainingBalance: number;
  status: string;
  paidDate?: string;
  lateFeeApplied?: number;
}

interface Prepayment {
  id: string;
  date: string;
  amount: number;
  strategy: string;
  interestSaved: number;
}

interface LoanDetail {
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
  status: string;
  dashboard: {
    outstandingPrincipal: number;
    totalInterestPayable: number;
    interestPaid: number;
    emisPaid: number;
    emisRemaining: number;
    nextEmiDate: string | null;
    percentCompleted: number;
  };
  schedules: LoanSchedule[];
  prepayments: Prepayment[];
}

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEmiModalOpen, setIsEmiModalOpen] = useState(false);
  const [selectedEmi, setSelectedEmi] = useState<LoanSchedule | null>(null);
  const [emiStatus, setEmiStatus] = useState('Paid');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [lateFee, setLateFee] = useState('');

  const [isPrepayModalOpen, setIsPrepayModalOpen] = useState(false);
  const [prepayAmount, setPrepayAmount] = useState('');
  const [prepayDate, setPrepayDate] = useState(new Date().toISOString().split('T')[0]);
  const [prepayStrategy, setPrepayStrategy] = useState('reduce_tenure');

  const fetchLoan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get('/loans');
      const found = data.loans?.find((l: any) => l.id === id);
      if (found) {
        setLoan(found);
      } else {
        showToast({ type: 'error', message: 'Loan not found' });
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load loan details' });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const handleOpenEmiModal = (emi: LoanSchedule) => {
    setSelectedEmi(emi);
    setEmiStatus('Paid');
    setPaidDate(new Date().toISOString().split('T')[0]);
    setLateFee('');
    setIsEmiModalOpen(true);
  };

  const handleSaveEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmi || !loan) return;
    try {
      await api.put(`/loans/${loan.id}/emi/${selectedEmi.id}`, {
        status: emiStatus,
        paidDate: paidDate,
        lateFeeApplied: lateFee ? parseFloat(lateFee) : 0
      });
      showToast({ type: 'success', message: 'EMI status updated' });
      setIsEmiModalOpen(false);
      fetchLoan();
    } catch {
      showToast({ type: 'error', message: 'Failed to update EMI' });
    }
  };

  const handleSavePrepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    if (!prepayAmount || parseFloat(prepayAmount) <= 0) {
      showToast({ type: 'error', message: 'Invalid prepayment amount' });
      return;
    }
    try {
      await api.post(`/loans/${loan.id}/prepayment`, {
        date: prepayDate,
        amount: parseFloat(prepayAmount),
        strategy: prepayStrategy
      });
      showToast({ type: 'success', message: 'Prepayment processed successfully' });
      setIsPrepayModalOpen(false);
      fetchLoan();
    } catch (err: any) {
      showToast({ type: 'error', message: err.response?.data?.detail || 'Failed to process prepayment' });
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading loan details...</div>;
  if (!loan) return <div className="p-10 text-center text-rose-500">Loan not found.</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/loans')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-indigo-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {loan.loanName}
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                {loan.status}
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">{loan.bankName} • {loan.loanType} • {loan.interestRate}% {loan.rateType} Rate</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setIsPrepayModalOpen(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
            <Zap className="w-4 h-4" /> Part Payment / Prepay
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Outstanding Principal</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{formatAmount(loan.dashboard.outstandingPrincipal)}</p>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${loan.dashboard.percentCompleted}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{loan.dashboard.percentCompleted.toFixed(1)}% paid off</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Interest Payable</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{formatAmount(loan.dashboard.totalInterestPayable)}</p>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500"/> {formatAmount(loan.dashboard.interestPaid)} paid so far</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">EMI Progress</p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{loan.dashboard.emisPaid} / {loan.schedules.length}</p>
          <p className="text-xs text-slate-400 mt-2">EMIs remaining: {loan.dashboard.emisRemaining}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-3xl shadow-lg text-white">
          <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Next EMI Due</p>
          <p className="text-2xl font-bold mt-2">{loan.dashboard.nextEmiDate ? new Date(loan.dashboard.nextEmiDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'None'}</p>
          <p className="text-sm font-semibold mt-2">{formatAmount(loan.emiAmount)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold">Amortization Schedule</h3>
          <button className="text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4">EMI No.</th>
                <th className="p-4">Due Date</th>
                <th className="p-4 text-right">Principal</th>
                <th className="p-4 text-right">Interest</th>
                <th className="p-4 text-right font-bold">Total EMI</th>
                <th className="p-4 text-right">Balance</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loan.schedules.map((s, idx) => (
                <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${s.status === 'Pending' && loan.dashboard.nextEmiDate === s.dueDate ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                  <td className="p-4 font-semibold text-slate-500">{s.emiNumber}</td>
                  <td className="p-4 font-medium">{s.dueDate}</td>
                  <td className="p-4 text-right text-emerald-600 font-medium">{formatAmount(s.principalComponent)}</td>
                  <td className="p-4 text-right text-rose-500 font-medium">{formatAmount(s.interestComponent)}</td>
                  <td className="p-4 text-right font-bold text-slate-900 dark:text-white">{formatAmount(s.totalEmi)}</td>
                  <td className="p-4 text-right text-slate-600 dark:text-slate-400">{formatAmount(s.remainingBalance)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      s.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                      s.status === 'Late' ? 'bg-rose-100 text-rose-700' :
                      s.status === 'Skipped' ? 'bg-slate-200 text-slate-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {s.status === 'Pending' && idx === loan.schedules.findIndex(x => x.status === 'Pending') && (
                      <button onClick={() => handleOpenEmiModal(s)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded-lg transition-colors">
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isEmiModalOpen && selectedEmi && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">Update EMI Status</h3>
            <p className="text-xs text-slate-500 mb-6">EMI #{selectedEmi.emiNumber} • Due: {selectedEmi.dueDate}</p>
            <form onSubmit={handleSaveEmi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Status</label>
                <select value={emiStatus} onChange={e=>setEmiStatus(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                  <option value="Paid">Paid on time</option>
                  <option value="Late">Paid Late</option>
                  <option value="Skipped">Skipped / Moratorium</option>
                </select>
              </div>
              {(emiStatus === 'Paid' || emiStatus === 'Late') && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Date of Payment</label>
                  <input type="date" required value={paidDate} onChange={e=>setPaidDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
                </div>
              )}
              {emiStatus === 'Late' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Late Fee Applied (₹)</label>
                  <input type="number" step="any" value={lateFee} onChange={e=>setLateFee(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" placeholder="0.00" />
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsEmiModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPrepayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2 text-indigo-600"><Zap className="w-6 h-6"/> Prepayment</h3>
            <p className="text-xs text-slate-500 mb-6">Make a part-payment to save interest</p>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4 border border-slate-100 dark:border-slate-700 text-sm">
              <span className="text-slate-500">Current Outstanding: </span>
              <strong className="text-slate-900 dark:text-white">{formatAmount(loan.dashboard.outstandingPrincipal)}</strong>
            </div>

            <form onSubmit={handleSavePrepayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Prepayment Amount (₹) *</label>
                <input required type="number" step="any" max={loan.dashboard.outstandingPrincipal} value={prepayAmount} onChange={e=>setPrepayAmount(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-lg font-bold dark:bg-slate-800 dark:border-slate-700 text-indigo-600 focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Date of Payment *</label>
                <input type="date" required value={prepayDate} onChange={e=>setPrepayDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2">Strategy (How should the schedule adjust?)</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${prepayStrategy === 'reduce_tenure' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="strategy" value="reduce_tenure" checked={prepayStrategy === 'reduce_tenure'} onChange={e=>setPrepayStrategy(e.target.value)} className="text-indigo-600" />
                    <div>
                      <p className="font-bold text-sm">Reduce Tenure (Recommended)</p>
                      <p className="text-xs text-slate-500">Keep EMI same, finish loan faster. Saves maximum interest.</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${prepayStrategy === 'reduce_emi' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="strategy" value="reduce_emi" checked={prepayStrategy === 'reduce_emi'} onChange={e=>setPrepayStrategy(e.target.value)} className="text-indigo-600" />
                    <div>
                      <p className="font-bold text-sm">Reduce EMI</p>
                      <p className="text-xs text-slate-500">Keep tenure same, lower monthly burden.</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsPrepayModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md">Submit Prepayment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

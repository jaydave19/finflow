import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Download, MessageSquare, Trash2, Edit2, TrendingUp, TrendingDown, CheckCircle, Undo2, Calendar, FileText } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface Person {
  id: string;
  name: string;
  phone: string;
  photo: string;
  notes: string;
}

interface Settlement {
  id: string;
  amount: number;
  date: string;
  paymentMethod: string;
  note: string;
}

interface LedgerEntry {
  id: string;
  type: 'gave' | 'took';
  amount: number;
  date: string;
  reason: string;
  dueDate: string;
  paymentMethod: string;
  attachment: string;
  interestRate: number | null;
  interestType: string | null;
  isSettled: boolean;
  settledAmount: number;
  status: string;
  createdAt: string;
  settlements: Settlement[];
}

export function PersonLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [person, setPerson] = useState<Person | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Computed Balances
  const balance = entries.reduce((acc, entry) => {
    const remaining = entry.amount - entry.settledAmount;
    if (entry.type === 'gave') return acc + remaining;
    if (entry.type === 'took') return acc - remaining;
    return acc;
  }, 0);

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  
  // Entry Form State
  const [entryType, setEntryType] = useState<'gave' | 'took'>('gave');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState('monthly');
  const [linkToBank, setLinkToBank] = useState(false);

  // Settle Form State
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleMethod, setSettleMethod] = useState('UPI');
  const [settleNote, setSettleNote] = useState('');
  const [settleLinkBank, setSettleLinkBank] = useState(false);

  const fetchLedger = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get(`/ledger/people/${id}/ledger`);
      setPerson(data.person);
      setEntries(data.entries);
    } catch {
      showToast({ type: 'error', message: 'Failed to load ledger details.' });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleOpenEntryModal = (type: 'gave' | 'took') => {
    setEntryType(type);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setDueDate('');
    setPaymentMethod('Cash');
    setInterestRate('');
    setInterestType('monthly');
    setLinkToBank(false);
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast({ type: 'error', message: 'Enter a valid amount' });
      return;
    }

    try {
      await api.post(`/ledger/people/${id}/ledger`, {
        type: entryType,
        amount: parseFloat(amount),
        date,
        reason,
        dueDate: dueDate || undefined,
        paymentMethod,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        interestType,
        linkToBank,
        personName: person?.name
      });
      showToast({ type: 'success', message: 'Entry added successfully' });
      setIsEntryModalOpen(false);
      fetchLedger();
    } catch {
      showToast({ type: 'error', message: 'Failed to add entry' });
    }
  };

  const handleOpenSettleModal = (entry: LedgerEntry) => {
    setSelectedEntry(entry);
    setSettleAmount(String(entry.amount - entry.settledAmount));
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleMethod('UPI');
    setSettleNote('');
    setSettleLinkBank(false);
    setIsSettleModalOpen(true);
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      showToast({ type: 'error', message: 'Enter a valid settlement amount' });
      return;
    }
    const max = selectedEntry.amount - selectedEntry.settledAmount;
    if (parseFloat(settleAmount) > max) {
      showToast({ type: 'error', message: `Cannot settle more than ${max}` });
      return;
    }

    try {
      await api.post(`/ledger/${selectedEntry.id}/settle`, {
        amount: parseFloat(settleAmount),
        date: settleDate,
        paymentMethod: settleMethod,
        note: settleNote,
        linkToBank: settleLinkBank,
        personName: person?.name
      });
      showToast({ type: 'success', message: 'Settlement recorded' });
      setIsSettleModalOpen(false);
      fetchLedger();
    } catch {
      showToast({ type: 'error', message: 'Failed to record settlement' });
    }
  };

  const handleUndoSettlement = async (settlementId: string) => {
    if (!confirm('Undo this settlement?')) return;
    try {
      await api.delete(`/ledger/settlement/${settlementId}`);
      showToast({ type: 'info', message: 'Settlement undone' });
      fetchLedger();
    } catch {
      showToast({ type: 'error', message: 'Failed to undo settlement' });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry and all its settlements?')) return;
    try {
      await api.delete(`/ledger/${entryId}`);
      showToast({ type: 'info', message: 'Entry deleted' });
      fetchLedger();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete entry' });
    }
  };

  const exportStatement = () => {
    if (!person) return;
    let text = `Ledger Statement: ${person.name}\\n`;
    text += `Net Balance: ${balance > 0 ? 'You will get ' + formatAmount(balance) : balance < 0 ? 'You need to give ' + formatAmount(Math.abs(balance)) : 'Settled'}\\n\\n`;
    text += `Transactions:\\n`;
    entries.forEach(e => {
      text += `- ${e.date} | ${e.type === 'gave' ? 'Gave' : 'Took'} | ${formatAmount(e.amount)} | ${e.reason || 'No note'}\\n`;
      e.settlements.forEach(s => {
        text += `   -> Settled ${formatAmount(s.amount)} on ${s.date} (${s.paymentMethod})\\n`;
      });
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${person.name}_statement.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendReminder = () => {
    if (!person || !person.phone) {
      showToast({ type: 'error', message: 'No phone number saved for this person.' });
      return;
    }
    if (balance <= 0) {
      showToast({ type: 'info', message: 'Nothing to receive.' });
      return;
    }
    const text = encodeURIComponent(`Hi ${person.name}, this is a gentle reminder regarding the pending balance of ${formatAmount(balance)} in our ledger. Please let me know when you can settle this. Thanks!`);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile ? `whatsapp://send?phone=${person.phone}&text=${text}` : `https://web.whatsapp.com/send?phone=${person.phone}&text=${text}`;
    window.open(url, '_blank');
  };

  const sendSMS = () => {
    if (!person || !person.phone) return;
    const text = encodeURIComponent(`Hi ${person.name}, gentle reminder for the pending ${formatAmount(balance)}.`);
    window.open(`sms:${person.phone}?body=${text}`, '_blank');
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading ledger details...</div>;
  if (!person) return <div className="p-10 text-center text-rose-500">Person not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/ledger')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:text-indigo-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{person.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              {person.phone && <span>📞 {person.phone}</span>}
              {person.notes && <span>📝 {person.notes}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {balance > 0 && person.phone && (
            <>
              <button onClick={sendReminder} className="px-3 py-1.5 text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 rounded-lg flex items-center gap-1.5 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Reminder
              </button>
              <button onClick={sendSMS} className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center gap-1.5 transition-colors">
                SMS
              </button>
            </>
          )}
          <button onClick={exportStatement} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export TXT
          </button>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-indigo-200 text-sm font-semibold mb-1">Overall Net Balance</p>
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold ${balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-rose-400' : 'text-white'}`}>
              {balance > 0 ? '+' : ''}{formatAmount(balance)}
            </span>
            <span className="text-sm text-slate-300 font-medium mb-1.5">
              {balance > 0 ? '(You will get)' : balance < 0 ? '(You need to give)' : '(Settled)'}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleOpenEntryModal('gave')} className="px-5 py-2.5 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all">
            <TrendingDown className="w-5 h-5" /> I Gave ₹
          </button>
          <button onClick={() => handleOpenEntryModal('took')} className="px-5 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all">
            <TrendingUp className="w-5 h-5" /> I Took ₹
          </button>
        </div>
      </div>

      {/* Ledger Entries */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Transaction History</h3>
        
        {entries.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">No transactions recorded yet.</p>
          </div>
        ) : (
          entries.map(entry => {
            const isGave = entry.type === 'gave';
            const remaining = entry.amount - entry.settledAmount;
            
            // Check Overdue
            let isOverdue = false;
            if (entry.dueDate && !entry.isSettled) {
              const due = new Date(entry.dueDate);
              if (due < new Date()) isOverdue = true;
            }

            return (
              <div key={entry.id} className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border ${isOverdue ? 'border-rose-300 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800'} shadow-sm`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Side: Icon & Details */}
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isGave ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'}`}>
                      {isGave ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold uppercase tracking-wider ${isGave ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isGave ? 'You Gave' : 'You Took'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{entry.date}</span>
                        {isOverdue && <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Overdue</span>}
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{formatAmount(entry.amount)}</p>
                      
                      {entry.reason && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> {entry.reason}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                        {entry.paymentMethod && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">Via {entry.paymentMethod}</span>}
                        {entry.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Due: {entry.dueDate}</span>}
                        {entry.interestRate && <span className="text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md">+{entry.interestRate}% {entry.interestType} interest</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Settlement Status */}
                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-semibold mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        entry.isSettled ? 'bg-emerald-100 text-emerald-700' :
                        entry.status === 'Partially paid' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {entry.isSettled ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                        {entry.status}
                      </span>
                    </div>

                    {!entry.isSettled && (
                      <div className="w-full">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Remaining</span>
                          <span className="font-bold text-slate-900 dark:text-white">{formatAmount(remaining)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(entry.settledAmount / entry.amount) * 100}%` }} />
                        </div>
                        <button 
                          onClick={() => handleOpenSettleModal(entry)}
                          className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors"
                        >
                          Record Settlement
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settlement History */}
                {entry.settlements.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Settlement History</p>
                    <div className="space-y-2">
                      {entry.settlements.map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-xs">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">{formatAmount(s.amount)}</span>
                              <span className="text-slate-500 ml-2">on {s.date} via {s.paymentMethod}</span>
                              {s.note && <span className="text-slate-400 ml-2 block sm:inline">• {s.note}</span>}
                            </div>
                          </div>
                          <button onClick={() => handleUndoSettlement(s.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Undo Settlement">
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Delete Entry Button */}
                <div className="mt-2 text-right">
                  <button onClick={() => handleDeleteEntry(entry.id)} className="text-[10px] text-slate-400 hover:text-rose-500 font-medium uppercase tracking-wider">
                    Delete Entry
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl my-8">
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
              {entryType === 'gave' ? <TrendingDown className="text-rose-500 w-6 h-6"/> : <TrendingUp className="text-emerald-500 w-6 h-6"/>}
              {entryType === 'gave' ? 'I Gave (Lent)' : 'I Took (Borrowed)'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Record a new transaction with {person.name}</p>
            
            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Amount (₹) *</label>
                <input required type="number" step="any" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-lg font-bold dark:bg-slate-800" placeholder="0.00" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date *</label>
                  <input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Due Date</label>
                  <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reason / Note</label>
                <input type="text" value={reason} onChange={e=>setReason(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800" placeholder="Dinner split, Rent advance..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500 flex items-center gap-2">
                    <input type="checkbox" checked={linkToBank} onChange={e=>setLinkToBank(e.target.checked)} className="rounded" />
                    Link to Expenses/Income
                  </label>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">If checked, this will appear in your main expense/income tracker.</p>
                </div>
              </div>

              {/* Interest (Optional) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-semibold mb-2 text-slate-700 dark:text-slate-300">Interest (Optional)</label>
                <div className="flex gap-2">
                  <input type="number" step="0.1" value={interestRate} onChange={e=>setInterestRate(e.target.value)} placeholder="Rate %" className="w-20 border dark:border-slate-700 rounded-lg px-2 py-1 text-sm dark:bg-slate-800" />
                  <select value={interestType} onChange={e=>setInterestType(e.target.value)} className="flex-1 border dark:border-slate-700 rounded-lg px-2 py-1 text-sm dark:bg-slate-800">
                    <option value="monthly">per Month</option>
                    <option value="yearly">per Year</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsEntryModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className={`px-6 py-2 text-white font-bold rounded-xl shadow-md ${entryType === 'gave' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {isSettleModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="text-indigo-500" /> Record Settlement
            </h3>
            <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-sm">
              <p className="text-indigo-800 dark:text-indigo-200">
                Remaining Balance: <strong>{formatAmount(selectedEntry.amount - selectedEntry.settledAmount)}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Amount Settled (₹) *</label>
                <input required type="number" step="any" max={selectedEntry.amount - selectedEntry.settledAmount} value={settleAmount} onChange={e=>setSettleAmount(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-lg font-bold dark:bg-slate-800 text-indigo-600" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date *</label>
                  <input required type="date" value={settleDate} onChange={e=>setSettleDate(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Method</label>
                  <select value={settleMethod} onChange={e=>setSettleMethod(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800">
                    <option>UPI</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Note (Optional)</label>
                <input type="text" value={settleNote} onChange={e=>setSettleNote(e.target.value)} className="w-full border dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800" placeholder="e.g. Paid via GPay" />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500 flex items-center gap-2">
                  <input type="checkbox" checked={settleLinkBank} onChange={e=>setSettleLinkBank(e.target.checked)} className="rounded" />
                  Link to Expenses/Income
                </label>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">If checked, this repayment will update your main tracker.</p>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsSettleModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

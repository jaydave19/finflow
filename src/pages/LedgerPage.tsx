import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, CheckCircle, Trash2, Edit2, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface LedgerItem {
  id: string;
  personName: string;
  amount: number;
  type: 'I_OWE' | 'THEY_OWE';
  status: 'PENDING' | 'SETTLED';
  dueDate?: string;
  note?: string;
  createdAt: string;
}

export function LedgerPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState({ totalIOwe: 0, totalTheyOwe: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LedgerItem | null>(null);

  // Form Fields
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'I_OWE' | 'THEY_OWE'>('THEY_OWE');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const fetchLedgers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/ledger');
      setLedgers(data.ledgers || []);
      setSummary(data.summary || { totalIOwe: 0, totalTheyOwe: 0, netBalance: 0 });
    } catch {
      showToast({ type: 'error', message: 'Failed to load ledger records.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setPersonName('');
    setAmount('');
    setType('THEY_OWE');
    setDueDate('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LedgerItem) => {
    setEditingItem(item);
    setPersonName(item.personName);
    setAmount(String(item.amount));
    setType(item.type);
    setDueDate(item.dueDate || '');
    setNote(item.note || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !amount) {
      showToast({ type: 'error', message: 'Name and Amount are required.' });
      return;
    }

    try {
      const payload = {
        personName,
        amount: parseFloat(amount),
        type,
        dueDate: dueDate || undefined,
        note,
      };

      if (editingItem) {
        await api.put(`/ledger/${editingItem.id}`, payload);
        showToast({ type: 'success', message: 'Ledger updated.' });
      } else {
        await api.post('/ledger', payload);
        showToast({ type: 'success', message: 'Ledger record added.' });
      }
      setIsModalOpen(false);
      fetchLedgers();
    } catch {
      showToast({ type: 'error', message: 'Failed to save record.' });
    }
  };

  const handleSettle = async (item: LedgerItem) => {
    try {
      await api.put(`/ledger/${item.id}`, { status: item.status === 'SETTLED' ? 'PENDING' : 'SETTLED' });
      showToast({ type: 'success', message: 'Status updated.' });
      fetchLedgers();
    } catch {
      showToast({ type: 'error', message: 'Failed to update status.' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/ledger/${id}`);
      showToast({ type: 'success', message: 'Record deleted.' });
      fetchLedgers();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            People Ledger
          </h2>
          <p className="text-violet-200 mt-2">Manage money you owe and money owed to you</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-all font-semibold"
        >
          <Plus className="w-5 h-5" /> Add Record
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" /> I Owe
          </p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{formatAmount(summary.totalIOwe)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> They Owe Me
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatAmount(summary.totalTheyOwe)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" /> Net Balance
          </p>
          <p className={`text-2xl font-bold mt-2 ${summary.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.netBalance >= 0 ? '+' : ''}{formatAmount(summary.netBalance)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold">Ledger Records</h3>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500 text-center">Loading...</p>
        ) : ledgers.length === 0 ? (
          <p className="p-6 text-slate-500 text-center">No ledger records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4">Person</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ledgers.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-semibold">{item.personName}
                      {item.note && <p className="text-xs text-slate-500 font-normal">{item.note}</p>}
                    </td>
                    <td className="p-4">
                      {item.type === 'THEY_OWE' ? (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold">Owes me</span>
                      ) : (
                        <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-md text-xs font-bold">I owe</span>
                      )}
                    </td>
                    <td className="p-4 font-bold">{formatAmount(item.amount)}</td>
                    <td className="p-4">
                      <button onClick={() => handleSettle(item)} className={`px-2 py-1 rounded-md text-xs font-bold ${item.status === 'SETTLED' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.status}
                      </button>
                    </td>
                    <td className="p-4 text-slate-500">{item.dueDate || '-'}</td>
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4">{editingItem ? 'Edit Record' : 'Add Record'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Person Name</label>
                <input required type="text" value={personName} onChange={e=>setPersonName(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Type</label>
                <select value={type} onChange={e=>setType(e.target.value as any)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700">
                  <option value="THEY_OWE">They Owe Me</option>
                  <option value="I_OWE">I Owe Them</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Amount</label>
                <input required type="number" step="any" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Note (Optional)</label>
                <input type="text" value={note} onChange={e=>setNote(e.target.value)} className="w-full border rounded-xl px-3 py-2 dark:bg-slate-800 dark:border-slate-700" />
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

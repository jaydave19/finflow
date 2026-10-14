import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit2, Trash2, TrendingUp, TrendingDown, ArrowRightLeft, User, MessageCircle } from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useNavigate } from 'react-router-dom';

interface Person {
  id: string;
  name: string;
  phone: string;
  photo: string;
  notes: string;
  balance: number;
  createdAt: string;
}

export function LedgerPage() {
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [people, setPeople] = useState<Person[]>([]);
  const [summary, setSummary] = useState({ totalToReceive: 0, totalToPay: 0, netPosition: 0 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/ledger/people');
      setPeople(data.people || []);
      setSummary(data.summary || { totalToReceive: 0, totalToPay: 0, netPosition: 0 });
    } catch {
      showToast({ type: 'error', message: 'Failed to load people.' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleOpenAddModal = () => {
    setEditingPerson(null);
    setName('');
    setPhone('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (person: Person, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPerson(person);
    setName(person.name);
    setPhone(person.phone || '');
    setNotes(person.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Name is required.' });
      return;
    }

    try {
      const payload = { name, phone, notes };
      if (editingPerson) {
        await api.put(`/ledger/people/${editingPerson.id}`, payload);
        showToast({ type: 'success', message: 'Person updated.' });
      } else {
        await api.post('/ledger/people', payload);
        showToast({ type: 'success', message: 'Person added.' });
      }
      setIsModalOpen(false);
      fetchPeople();
    } catch {
      showToast({ type: 'error', message: 'Failed to save person.' });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this person and all their ledger entries?')) return;
    try {
      await api.delete(`/ledger/people/${id}`);
      showToast({ type: 'success', message: 'Person deleted.' });
      fetchPeople();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete person.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            People Ledger (Udhar / Khata)
          </h2>
          <p className="text-violet-200 mt-2">Manage money you owe and money owed to you</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-all font-semibold shadow-sm"
        >
          <Plus className="w-5 h-5" /> Add Person
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> You will get
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatAmount(summary.totalToReceive)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" /> You need to give
          </p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{formatAmount(summary.totalToPay)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" /> Net Position
          </p>
          <p className={`text-2xl font-bold mt-2 ${summary.netPosition >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.netPosition >= 0 ? '+' : ''}{formatAmount(summary.netPosition)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
        <h3 className="text-lg font-bold mb-4">People</h3>
        {loading ? (
          <p className="text-slate-500 text-center py-4">Loading...</p>
        ) : people.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No people added yet. Add a person to start tracking ledgers.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {people.map(person => (
              <div 
                key={person.id} 
                onClick={() => navigate(`/ledger/${person.id}`)}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-indigo-500/50 cursor-pointer transition-all bg-slate-50 dark:bg-slate-800/40 relative group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{person.name}</h4>
                    {person.phone && <p className="text-xs text-slate-500 truncate">{person.phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${person.balance > 0 ? 'text-emerald-600' : person.balance < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {person.balance > 0 ? '+' : ''}{formatAmount(person.balance)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {person.balance > 0 ? 'You will get' : person.balance < 0 ? 'You need to give' : 'Settled'}
                    </p>
                  </div>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <button onClick={(e) => handleOpenEditModal(person, e)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => handleDelete(person.id, e)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4">{editingPerson ? 'Edit Person' : 'Add Person'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Name</label>
                <input required type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Phone (Optional)</label>
                <input type="text" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" placeholder="+1 234 567 8900" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" placeholder="Colleague" />
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-md">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

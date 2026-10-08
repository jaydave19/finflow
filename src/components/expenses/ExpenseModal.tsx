import React, { useState, useEffect } from 'react';
import { X, Calendar, CreditCard, Tag, Repeat, Sparkles, Plus } from 'lucide-react';
import { api } from '../../api/client.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CreditCardOption {
  id: string;
  cardName: string;
  bankName: string;
  last4: string;
  availableCredit: number;
  creditLimit: number;
}

interface DebitCardOption {
  id: string;
  cardName: string;
  bankName: string;
  last4: string;
  remainingBalance: number;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
  defaultIsIpo?: boolean; // Kept for interface compatibility
}

export function ExpenseModal({ isOpen, onClose, onSuccess, initialData }: ExpenseModalProps) {
  const { currencyConfig, formatAmount } = useCurrency();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([]);
  const [debitCards, setDebitCards] = useState<DebitCardOption[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [cardId, setCardId] = useState('');
  const [debitCardId, setDebitCardId] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('monthly');

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchCreditCards();
      fetchDebitCards();

      if (initialData) {
        setAmount(String(initialData.amount || ''));
        setCategoryId(initialData.category?.id || initialData.categoryId || '');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        const pm = initialData.paymentMethod === 'Card' ? 'Credit Card' : initialData.paymentMethod || 'UPI';
        setPaymentMethod(pm);
        setCardId(initialData.cardId || initialData.card?.id || '');
        setDebitCardId(initialData.debitCardId || '');
        setNote(initialData.note || '');
        setTags(initialData.tags || []);
        setIsRecurring(Boolean(initialData.isRecurring));
        setRecurrenceType(initialData.recurrenceType || 'monthly');
      } else {
        // Reset form
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('UPI');
        setCardId('');
        setDebitCardId('');
        setNote('');
        setTags([]);
        setIsRecurring(false);
        setRecurrenceType('monthly');
      }
    }
  }, [isOpen, initialData]);

  const fetchCategories = async () => {
    try {
      const data = await api.get('/categories');
      const cats: Category[] = data.categories || [];
      // Filter out stock market/IPO from everyday expense dropdown if desired, or let user pick
      setCategories(cats);
      if (!categoryId && cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    } catch {
      // ignore
    }
  };

  const fetchCreditCards = async () => {
    setLoadingCards(true);
    try {
      const data = await api.get('/cards');
      const cardList: CreditCardOption[] = data.cards || [];
      setCreditCards(cardList);
      if (cardList.length > 0 && !cardId) {
        setCardId(cardList[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCards(false);
    }
  };

  const fetchDebitCards = async () => {
    try {
      const data = await api.get('/debit-cards');
      const cardList: DebitCardOption[] = data.cards || [];
      setDebitCards(cardList);
      if (cardList.length > 0 && !debitCardId) {
        setDebitCardId(cardList[0].id);
      }
    } catch {
      // ignore
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^/, '');
      if (!tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid positive expense amount.' });
      return;
    }

    if (paymentMethod === 'Credit Card' && creditCards.length > 0 && !cardId) {
      showToast({ type: 'error', message: 'Please select which credit card was used.' });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        amount: numAmount,
        categoryId: categoryId || null,
        cardId: paymentMethod === 'Credit Card' ? (cardId || null) : null,
        debitCardId: paymentMethod === 'Debit Card' ? (debitCardId || null) : null,
        date,
        paymentMethod,
        note: note.trim(),
        tags,
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        nextDueDate: isRecurring ? date : null,
      };

      if (initialData?.id) {
        await api.put(`/expenses/${initialData.id}`, payload);
        showToast({ type: 'success', message: 'Expense updated successfully!' });
      } else {
        await api.post('/expenses', payload);
        showToast({ type: 'success', message: 'Expense recorded successfully!' });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save expense.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData?.id ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Record everyday expenditure and link to your payment mode
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Amount ({currencyConfig.symbol}) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                {currencyConfig.symbol}
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Payment Method *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'Cash', 'Net Banking', 'Credit Card', 'Debit Card', 'Other'].map(pm => (
                <button
                  type="button"
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    paymentMethod === pm
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>

          {/* Credit Card Dropdown (Active when Credit Card is selected) */}
          {paymentMethod === 'Credit Card' && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <label className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Select Your Credit Card *
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/cards');
                  }}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Manage Cards
                </button>
              </div>

              {loadingCards ? (
                <div className="text-xs text-slate-400 py-2">Loading your credit cards...</div>
              ) : creditCards.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    No credit cards added yet.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/cards');
                    }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 underline"
                  >
                    + Add Card
                  </button>
                </div>
              ) : (
                <div>
                  <select
                    value={cardId}
                    onChange={e => setCardId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Credit Card --</option>
                    {creditCards.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.bankName} {c.cardName} (•••• {c.last4}) — Avail: {formatAmount(c.availableCredit)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 mt-1 block">
                    Expense will be charged to this card and update its available credit.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Debit Card Dropdown */}
          {paymentMethod === 'Debit Card' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    Select Your Debit Card *
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/debit-cards'); }}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Manage Cards
                </button>
              </div>

              {debitCards.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400">No debit cards added yet.</span>
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate('/debit-cards'); }}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 underline"
                  >
                    + Add Card
                  </button>
                </div>
              ) : (
                <div>
                  <select
                    value={debitCardId}
                    onChange={e => setDebitCardId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Debit Card --</option>
                    {debitCards.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.bankName} – {c.cardName} (•••• {c.last4}) | Bal: {formatAmount(c.remainingBalance)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-1 block">
                    Amount will be deducted from this bank account balance.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Note / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Note / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Dinner with friends, Car fuel, Supermarket grocery"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tags (press Enter)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type a tag and press Enter (e.g. food, trip, office)..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Recurring Expense Option */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                This is a recurring bill / subscription
              </span>
            </label>

            {isRecurring && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Repeats:</span>
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(freq => (
                  <button
                    type="button"
                    key={freq}
                    onClick={() => setRecurrenceType(freq)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border capitalize ${
                      recurrenceType === freq
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : initialData?.id ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

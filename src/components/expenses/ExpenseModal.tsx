import React, { useState, useEffect } from 'react';
import { X, Calendar, CreditCard, Tag, Repeat, Landmark, Sparkles } from 'lucide-react';
import { api } from '../../api/client.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
  defaultIsIpo?: boolean;
}

export function ExpenseModal({ isOpen, onClose, onSuccess, initialData, defaultIsIpo = false }: ExpenseModalProps) {
  const { currencyConfig } = useCurrency();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('monthly');

  // IPO & Stock Specific State (User requirement!)
  const [isIpoMode, setIsIpoMode] = useState(defaultIsIpo);
  const [ipoName, setIpoName] = useState('');
  const [sharesCount, setSharesCount] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [lotSize, setLotSize] = useState('1');
  const [ipoStatus, setIpoStatus] = useState<'Blocked' | 'Allotted' | 'Refunded' | 'Sold'>('Blocked');
  const [mandateStatus, setMandateStatus] = useState('UPI ASBA Mandate Accepted');

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (initialData) {
        setAmount(String(initialData.amount || ''));
        setCategoryId(initialData.category?.id || initialData.categoryId || '');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setPaymentMethod(initialData.paymentMethod || 'UPI');
        setNote(initialData.note || '');
        setTags(initialData.tags || []);
        setIsRecurring(Boolean(initialData.isRecurring));
        setRecurrenceType(initialData.recurrenceType || 'monthly');

        if (initialData.ipoDetails) {
          setIsIpoMode(true);
          setIpoName(initialData.ipoDetails.ipoName || '');
          setSharesCount(String(initialData.ipoDetails.sharesCount || ''));
          setBidPrice(String(initialData.ipoDetails.bidPrice || ''));
          setLotSize(String(initialData.ipoDetails.lotSize || '1'));
          setIpoStatus(initialData.ipoDetails.status || 'Blocked');
          setMandateStatus(initialData.ipoDetails.mandateStatus || 'UPI ASBA Mandate Accepted');
        } else {
          setIsIpoMode(defaultIsIpo);
        }
      } else {
        // Reset form
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('UPI');
        setNote('');
        setTags([]);
        setIsRecurring(false);
        setRecurrenceType('monthly');
        setIsIpoMode(defaultIsIpo);
        setIpoName('');
        setSharesCount('');
        setBidPrice('');
        setLotSize('1');
        setIpoStatus('Blocked');
        setMandateStatus('UPI ASBA Mandate Accepted');
      }
    }
  }, [isOpen, initialData, defaultIsIpo]);

  const fetchCategories = async () => {
    try {
      const data = await api.get('/categories');
      const cats: Category[] = data.categories || [];
      setCategories(cats);

      if (!categoryId && cats.length > 0) {
        if (defaultIsIpo) {
          const ipoCat = cats.find(c => c.name.toLowerCase().includes('ipo') || c.name.toLowerCase().includes('stock'));
          setCategoryId(ipoCat ? ipoCat.id : cats[0].id);
        } else {
          setCategoryId(cats[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  // If user selects Stock & IPO category, auto-enable IPO fields
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setCategoryId(selectedId);
    const cat = categories.find(c => c.id === selectedId);
    if (cat && (cat.name.toLowerCase().includes('ipo') || cat.name.toLowerCase().includes('stock'))) {
      setIsIpoMode(true);
    }
  };

  // Auto calculate IPO amount when shares and bid price are entered
  const handleCalcIpoAmount = () => {
    const shares = parseFloat(sharesCount);
    const price = parseFloat(bidPrice);
    if (!isNaN(shares) && !isNaN(price) && shares > 0 && price > 0) {
      setAmount(String(Math.round(shares * price)));
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
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

    setLoading(true);
    try {
      const payload: any = {
        amount: numAmount,
        categoryId: categoryId || null,
        date,
        paymentMethod,
        note: note.trim(),
        tags,
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        nextDueDate: isRecurring ? date : null,
      };

      if (isIpoMode && (ipoName || sharesCount || bidPrice)) {
        payload.ipoDetails = {
          ipoName: ipoName.trim() || 'IPO Application',
          sharesCount: sharesCount ? parseInt(sharesCount, 10) : undefined,
          bidPrice: bidPrice ? parseFloat(bidPrice) : undefined,
          lotSize: lotSize ? parseInt(lotSize, 10) : 1,
          status: ipoStatus,
          mandateStatus,
        };
        if (!payload.note) {
          payload.note = `${ipoName || 'IPO'} - ${ipoStatus === 'Blocked' ? 'Mandate Blocked' : ipoStatus}`;
        }
      }

      if (initialData?.id) {
        await api.put(`/expenses/${initialData.id}`, payload);
        showToast({ type: 'success', message: 'Expense updated successfully!' });
      } else {
        await api.post('/expenses', payload);
        showToast({
          type: 'success',
          message: isIpoMode
            ? `IPO Mandate recorded! ₹${numAmount.toLocaleString()} marked as ${ipoStatus}.`
            : 'Expense recorded successfully!',
        });
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
              {initialData?.id ? 'Edit Expense' : isIpoMode ? 'Track IPO / Share Buy' : 'Add New Expense'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isIpoMode ? 'Track application capital blocked in ASBA/UPI mandate' : 'Record everyday expenditure'}
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
                onChange={handleCategoryChange}
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
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Payment Method *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['UPI', 'Card', 'Cash', 'Net Banking'].map(pm => (
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

          {/* Stock Market & IPO Specialized Card (Feature requested!) */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Stock Market & IPO Application Details
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsIpoMode(!isIpoMode)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isIpoMode ? 'Minimize' : 'Enable IPO Details'}
              </button>
            </div>

            {isIpoMode && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    IPO / Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tata Tech IPO / Premier Energies"
                    value={ipoName}
                    onChange={e => setIpoName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Shares Count
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 30"
                      value={sharesCount}
                      onChange={e => setSharesCount(e.target.value)}
                      onBlur={handleCalcIpoAmount}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Cut-off / Price (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={bidPrice}
                      onChange={e => setBidPrice(e.target.value)}
                      onBlur={handleCalcIpoAmount}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Allotment Status
                    </label>
                    <select
                      value={ipoStatus}
                      onChange={e => setIpoStatus(e.target.value as any)}
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Blocked">Blocked (ASBA)</option>
                      <option value="Allotted">Allotted (Shares Received)</option>
                      <option value="Refunded">Refunded / Unblocked</option>
                      <option value="Sold">Sold with P&L</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300">
                  <span>Mandate Status: <strong>{mandateStatus}</strong></span>
                  {sharesCount && bidPrice && (
                    <button
                      type="button"
                      onClick={handleCalcIpoAmount}
                      className="text-xs font-bold underline"
                    >
                      Auto-fill Amount: ₹{Number(sharesCount) * Number(bidPrice)}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Note / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Note / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Dinner with friends, Car fuel, Netflix sub"
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
              placeholder="Type a tag and press Enter (e.g. food, trip, sip)..."
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

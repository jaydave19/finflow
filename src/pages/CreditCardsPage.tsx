import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  X,
  Shield,
  Zap,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface CreditCardItem {
  id: string;
  cardName: string;
  bankName: string;
  last4: string;
  cardNetwork: string;
  creditLimit: number;
  currentSpent: number;
  availableCredit: number;
  utilizationRate: number;
  txCount: number;
  billingCycleDay: number;
  dueDateDay: number;
  color: string;
  createdAt: string;
}

const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'SBI Card',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'American Express',
  'Bank of Baroda',
  'IndusInd Bank',
  'Other',
];

const CARD_NETWORKS = ['Visa', 'Mastercard', 'RuPay', 'American Express'];

const COLOR_PRESETS = [
  { name: 'Royal Navy', value: '#1E3A8A' },
  { name: 'Indigo Violet', value: '#4F46E5' },
  { name: 'Emerald Teal', value: '#065F46' },
  { name: 'Golden Amber', value: '#B45309' },
  { name: 'Crimson Wine', value: '#991B1B' },
  { name: 'Sleek Obsidian', value: '#1E293B' },
];

export function CreditCardsPage() {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [summary, setSummary] = useState<any>({
    totalCreditLimit: 0,
    totalSpent: 0,
    totalAvailable: 0,
    overallUtilization: 0,
    cardsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardItem | null>(null);

  // Form Fields
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [customBank, setCustomBank] = useState('');
  const [last4, setLast4] = useState('');
  const [cardNetwork, setCardNetwork] = useState('Visa');
  const [creditLimit, setCreditLimit] = useState('');
  const [billingCycleDay, setBillingCycleDay] = useState('1');
  const [dueDateDay, setDueDateDay] = useState('20');
  const [selectedColor, setSelectedColor] = useState('#1E3A8A');
  const [formLoading, setFormLoading] = useState(false);

  // Selected Card for Transactions View
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/cards');
      const cardList = data.cards || [];
      setCards(cardList);
      setSummary(data.summary || {});

      if (cardList.length > 0 && !selectedCardId) {
        setSelectedCardId(cardList[0].id);
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load credit cards.' });
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedCardId]);

  useEffect(() => {
    fetchCards();
    const handleRefresh = () => fetchCards();
    window.addEventListener('finflow:refresh-data', handleRefresh);
    return () => window.removeEventListener('finflow:refresh-data', handleRefresh);
  }, [fetchCards]);

  // Load transactions for currently selected card
  useEffect(() => {
    if (!selectedCardId) {
      setCardTransactions([]);
      return;
    }
    const fetchTxs = async () => {
      setLoadingTxs(true);
      try {
        const data = await api.get(`/cards/${selectedCardId}`);
        setCardTransactions(data.transactions || []);
      } catch {
        // ignore
      } finally {
        setLoadingTxs(false);
      }
    };
    fetchTxs();
  }, [selectedCardId]);

  const handleOpenAddModal = () => {
    setEditingCard(null);
    setCardName('');
    setBankName('HDFC Bank');
    setCustomBank('');
    setLast4('');
    setCardNetwork('Visa');
    setCreditLimit('100000');
    setBillingCycleDay('1');
    setDueDateDay('20');
    setSelectedColor('#1E3A8A');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card: CreditCardItem) => {
    setEditingCard(card);
    setCardName(card.cardName);
    if (POPULAR_BANKS.includes(card.bankName)) {
      setBankName(card.bankName);
      setCustomBank('');
    } else {
      setBankName('Other');
      setCustomBank(card.bankName);
    }
    setLast4(card.last4);
    setCardNetwork(card.cardNetwork || 'Visa');
    setCreditLimit(String(card.creditLimit));
    setBillingCycleDay(String(card.billingCycleDay || 1));
    setDueDateDay(String(card.dueDateDay || 20));
    setSelectedColor(card.color || '#1E3A8A');
    setIsModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const actualBank = bankName === 'Other' ? customBank.trim() : bankName;
    if (!actualBank) {
      showToast({ type: 'error', message: 'Please specify the bank name.' });
      return;
    }

    const cleanLast4 = last4.trim().replace(/\D/g, '');
    if (cleanLast4.length !== 4) {
      showToast({ type: 'error', message: 'Please enter valid 4 digits for the card number.' });
      return;
    }

    const numLimit = parseFloat(creditLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid credit limit.' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        cardName: cardName.trim() || `${actualBank} Card`,
        bankName: actualBank,
        last4: cleanLast4,
        cardNetwork,
        creditLimit: numLimit,
        billingCycleDay: parseInt(billingCycleDay, 10) || 1,
        dueDateDay: parseInt(dueDateDay, 10) || 20,
        color: selectedColor,
      };

      if (editingCard) {
        await api.put(`/cards/${editingCard.id}`, payload);
        showToast({ type: 'success', message: 'Credit card updated successfully!' });
      } else {
        await api.post('/cards', payload);
        showToast({ type: 'success', message: 'Credit card added successfully!' });
      }

      setIsModalOpen(false);
      fetchCards();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save card.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCard = async (card: CreditCardItem) => {
    if (!confirm(`Are you sure you want to remove ${card.bankName} ${card.cardName} (•••• ${card.last4})?`)) {
      return;
    }

    try {
      await api.delete(`/cards/${card.id}`);
      showToast({ type: 'info', message: `Removed card •••• ${card.last4}.` });
      if (selectedCardId === card.id) {
        setSelectedCardId(null);
      }
      fetchCards();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete card.' });
    }
  };

  const selectedCard = cards.find(c => c.id === selectedCardId) || cards[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
            <CardIcon className="w-3.5 h-3.5" />
            Credit Card Portfolio & Spend Tracker
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Manage Your Credit Cards
          </h2>
          <p className="text-sm text-indigo-200 mt-2 leading-relaxed">
            Keep track of your total credit limit, monitor credit utilization ratio, and link specific cards when recording expenses for seamless statement reconciliation.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Credit Card
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Credit Limit */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Credit Limit</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatAmount(summary.totalCreditLimit || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across {summary.cardsCount || 0} active card(s)
          </p>
        </div>

        {/* Current Utilized / Spent */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Utilized Balance</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {formatAmount(summary.totalSpent || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Current outstanding expenses
          </p>
        </div>

        {/* Total Available Credit */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Available Limit</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatAmount(summary.totalAvailable || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Available purchasing power
          </p>
        </div>

        {/* Utilization Ratio */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Credit Utilization</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {summary.overallUtilization || 0}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {(summary.overallUtilization || 0) < 30 ? (
              <span className="text-emerald-600 font-semibold">Healthy (&lt; 30%)</span>
            ) : (
              <span className="text-rose-500 font-semibold">Keep under 30% for score</span>
            )}
          </p>
        </div>
      </div>

      {/* Cards List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Your Credit Cards</h3>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Card
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="h-56 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <CardIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No credit cards added yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Add your credit cards to select them when adding expenses, monitor billing dates, and keep track of your credit limits.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Add Your First Card
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map(card => {
              const isSelected = selectedCardId === card.id;
              const isHighUtilization = card.utilizationRate > 50;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`cursor-pointer rounded-3xl p-5 border transition-all duration-200 relative group overflow-hidden ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-lg'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md'
                  }`}
                >
                  {/* Visual Credit Card Preview */}
                  <div
                    className="w-full h-44 rounded-2xl p-5 text-white shadow-lg relative flex flex-col justify-between overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${card.color} 0%, #0f172a 100%)`,
                    }}
                  >
                    {/* Background geometric accents */}
                    <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
                    <div className="absolute right-12 top-0 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

                    {/* Top Row: Bank Name & Network */}
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-white/70 block">
                          {card.bankName}
                        </span>
                        <h4 className="text-sm font-bold tracking-tight text-white drop-shadow-sm truncate max-w-[180px]">
                          {card.cardName}
                        </h4>
                      </div>
                      <span className="text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded bg-white/20 backdrop-blur-sm">
                        {card.cardNetwork}
                      </span>
                    </div>

                    {/* Middle: EMV Chip & Contactless */}
                    <div className="flex items-center gap-3 relative z-10 my-1">
                      <div className="w-8 h-6 rounded-md bg-amber-300/80 border border-amber-400/90 shadow-inner flex flex-col justify-between p-1">
                        <div className="h-0.5 bg-amber-600/60 rounded" />
                        <div className="h-0.5 bg-amber-600/60 rounded" />
                      </div>
                      <Zap className="w-4 h-4 text-white/70" />
                    </div>

                    {/* Bottom Row: Number & Cardholder */}
                    <div className="relative z-10 flex items-end justify-between">
                      <div>
                        <p className="font-mono text-sm tracking-widest drop-shadow text-white/95">
                          •••• •••• •••• {card.last4}
                        </p>
                        <p className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5 font-medium truncate max-w-[150px]">
                          {user?.name || 'Cardholder'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-white/70 block font-semibold">
                          Due Date
                        </span>
                        <span className="text-xs font-bold font-mono">
                          {card.dueDateDay}th
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Details & Stats */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Spent / Limit</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatAmount(card.currentSpent)} <span className="font-normal text-slate-400">/ {formatAmount(card.creditLimit)}</span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            card.utilizationRate > 70
                              ? 'bg-rose-500'
                              : card.utilizationRate > 30
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, card.utilizationRate)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500">
                        <span>{card.utilizationRate}% utilized</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatAmount(card.availableCredit)} left
                        </span>
                      </div>
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Cycle: {card.billingCycleDay}st • Due: {card.dueDateDay}th
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenEditModal(card);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Card"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteCard(card);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title="Delete Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Card Recent Expenses Breakdown */}
      {selectedCard && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Expenses on {selectedCard.bankName} {selectedCard.cardName} (•••• {selectedCard.last4})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recent transactions charged to this credit card
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {cardTransactions.length} Recorded Expense(s)
            </span>
          </div>

          {loadingTxs ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading transactions...</div>
          ) : cardTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-600 dark:text-slate-300">No expenses charged to this card yet.</p>
              <p className="mt-1">When adding an expense, select &quot;Credit Card&quot; and choose this card from the dropdown.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description / Note</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                  {cardTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-500 dark:text-slate-400">{t.date}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{t.note || 'Expense'}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: t.categoryColor || '#6366F1' }}
                          />
                          {t.categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatAmount(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Card Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Save card details to select it when recording expenses
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4 mt-4">
              {/* Bank Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Bank / Issuer *
                </label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {POPULAR_BANKS.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {bankName === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Custom Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Chartered"
                    value={customBank}
                    onChange={e => setCustomBank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Card Label / Variant */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Name / Variant *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regalia Gold, Amazon Pay, Millennia, Coral"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Last 4 Digits & Network */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Last 4 Digits *
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="4589"
                    value={last4}
                    onChange={e => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Network
                  </label>
                  <select
                    value={cardNetwork}
                    onChange={e => setCardNetwork(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CARD_NETWORKS.map(net => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Credit Limit (₹) *
                </label>
                <input
                  type="number"
                  step="1000"
                  required
                  placeholder="150000"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Billing Cycle Day & Due Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Statement Date (Day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingCycleDay}
                    onChange={e => setBillingCycleDay(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Payment Due Date (Day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDateDay}
                    onChange={e => setDueDateDay(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Color Preset Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Theme Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map(col => (
                    <button
                      type="button"
                      key={col.value}
                      onClick={() => setSelectedColor(col.value)}
                      className={`w-8 h-8 rounded-xl transition-all ${
                        selectedColor === col.value
                          ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    />
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
                >
                  {formLoading ? 'Saving...' : editingCard ? 'Update Card' : 'Save Credit Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

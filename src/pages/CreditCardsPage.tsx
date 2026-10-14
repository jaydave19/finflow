import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RotateCw,
  Search,
  Grid,
  Layers,
  Sparkles,
  Download,
  AlertTriangle,
  Clock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { InteractiveBankCard, BankCardData } from '../components/cards/InteractiveBankCard.tsx';

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
  { name: 'Obsidian Black', value: '#0F172A', preview: 'from-slate-900 to-black' },
  { name: 'Royal Navy', value: '#1E3A8A', preview: 'from-blue-900 to-slate-900' },
  { name: 'Deep Indigo', value: '#3730A3', preview: 'from-indigo-900 to-slate-900' },
  { name: 'Violet Neon', value: '#4F46E5', preview: 'from-indigo-600 to-purple-900' },
  { name: 'Emerald Wealth', value: '#065F46', preview: 'from-emerald-900 to-slate-900' },
  { name: 'Teal Horizon', value: '#0F766E', preview: 'from-teal-800 to-slate-900' },
  { name: 'Golden Amber', value: '#B45309', preview: 'from-amber-700 to-stone-900' },
  { name: 'Crimson Wine', value: '#991B1B', preview: 'from-red-900 to-stone-950' },
  { name: 'Amethyst Luxe', value: '#6B21A8', preview: 'from-purple-900 to-slate-950' },
  { name: 'Titanium Slate', value: '#1E293B', preview: 'from-slate-800 to-slate-950' },
];

const CARD_TEMPLATES = [
  {
    label: 'HDFC Regalia Gold',
    bank: 'HDFC Bank',
    cardName: 'Regalia Gold',
    network: 'Visa',
    color: '#1E3A8A',
    limit: '400000',
  },
  {
    label: 'ICICI Amazon Pay',
    bank: 'ICICI Bank',
    cardName: 'Amazon Pay ICICI',
    network: 'Visa',
    color: '#0F172A',
    limit: '250000',
  },
  {
    label: 'Axis Magnus / Ace',
    bank: 'Axis Bank',
    cardName: 'Axis Magnus',
    network: 'Mastercard',
    color: '#991B1B',
    limit: '500000',
  },
  {
    label: 'SBI SimplyCLICK',
    bank: 'SBI Card',
    cardName: 'SimplyCLICK',
    network: 'Visa',
    color: '#3730A3',
    limit: '150000',
  },
  {
    label: 'Amex Platinum',
    bank: 'American Express',
    cardName: 'Platinum Travel',
    network: 'American Express',
    color: '#1E293B',
    limit: '600000',
  },
  {
    label: 'HDFC Millennia',
    bank: 'HDFC Bank',
    cardName: 'Millennia',
    network: 'Mastercard',
    color: '#4F46E5',
    limit: '200000',
  },
];

// Helper to calculate days remaining until payment due date
function getDaysUntilDue(dueDay: number) {
  if (!dueDay || dueDay < 1 || dueDay > 31) return null;
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetDate = new Date(currentYear, currentMonth, dueDay);
  if (currentDay > dueDay) {
    // Due date has passed for this month, target next month
    targetDate = new Date(currentYear, currentMonth + 1, dueDay);
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    days: diffDays,
    dateString: targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isUrgent: diffDays <= 5,
  };
}

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

  // View & Filter States
  const [viewMode, setViewMode] = useState<'grid' | 'wallet'>('grid');
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('All');
  const [modalPreviewFlipped, setModalPreviewFlipped] = useState(false);

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
  const [txSearchQuery, setTxSearchQuery] = useState('');

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
    setCreditLimit('150000');
    setBillingCycleDay('1');
    setDueDateDay('20');
    setSelectedColor('#1E3A8A');
    setModalPreviewFlipped(false);
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
    setModalPreviewFlipped(false);
    setIsModalOpen(true);
  };

  const handleApplyTemplate = (tpl: (typeof CARD_TEMPLATES)[0]) => {
    setBankName(tpl.bank);
    setCustomBank('');
    setCardName(tpl.cardName);
    setCardNetwork(tpl.network);
    setSelectedColor(tpl.color);
    if (!creditLimit || creditLimit === '150000') {
      setCreditLimit(tpl.limit);
    }
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

  const toggleCardFlip = (cardId: string) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const toggleFlipAll = () => {
    const allFlipped = cards.every(c => flippedCards[c.id]);
    const nextState: Record<string, boolean> = {};
    cards.forEach(c => {
      nextState[c.id] = !allFlipped;
    });
    setFlippedCards(nextState);
  };

  // Filter cards by search and bank
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      const matchesSearch =
        c.cardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last4.includes(searchQuery);

      const matchesBank =
        selectedBankFilter === 'All' ||
        c.bankName.toLowerCase() === selectedBankFilter.toLowerCase();

      return matchesSearch && matchesBank;
    });
  }, [cards, searchQuery, selectedBankFilter]);

  // Unique banks list for filtering
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => set.add(c.bankName));
    return ['All', ...Array.from(set)];
  }, [cards]);

  const selectedCard = cards.find(c => c.id === selectedCardId) || cards[0];

  // Filter transactions in selected card
  const filteredTransactions = useMemo(() => {
    if (!txSearchQuery) return cardTransactions;
    const q = txSearchQuery.toLowerCase();
    return cardTransactions.filter(
      t =>
        (t.note && t.note.toLowerCase().includes(q)) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
        (t.date && t.date.includes(q))
    );
  }, [cardTransactions, txSearchQuery]);

  // Export card transactions to CSV
  const handleExportCSV = () => {
    if (!selectedCard || cardTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Amount (INR)'];
    const rows = cardTransactions.map(t => [
      t.date,
      `"${(t.note || 'Expense').replace(/"/g, '""')}"`,
      `"${(t.categoryName || '').replace(/"/g, '""')}"`,
      t.amount,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${selectedCard.bankName}_${selectedCard.last4}_statement.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ type: 'success', message: 'Statement exported successfully.' });
  };

  // Live preview card data for the modal
  const modalLiveCardData: BankCardData = {
    cardName: cardName.trim() || 'Regalia Gold',
    bankName: bankName === 'Other' ? (customBank.trim() || 'Other Bank') : bankName,
    last4: last4.trim() || '4589',
    cardNetwork,
    cardType: 'credit',
    creditLimit: parseFloat(creditLimit) || 150000,
    dueDateDay: parseInt(dueDateDay, 10) || 20,
    billingCycleDay: parseInt(billingCycleDay, 10) || 1,
    color: selectedColor,
    nameOnCard: user?.name || 'CARDHOLDER',
  };

  // Find any card with urgent due date
  const urgentDueCards = useMemo(() => {
    return cards
      .map(c => ({ card: c, due: getDaysUntilDue(c.dueDateDay) }))
      .filter(item => item.due && item.due.isUrgent)
      .sort((a, b) => (a.due?.days || 0) - (b.due?.days || 0));
  }, [cards]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl relative overflow-hidden border border-indigo-900/30">
        {/* Glow and geometric decorations */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Credit Card Portfolio & 3D Interactive Hub
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Credit Cards & Spend Optimizer
          </h2>
          <p className="text-sm text-indigo-200 mt-2 leading-relaxed">
            Monitor credit utilization, avoid high-interest penalties, flip cards in 3D to view security CVV, and track monthly statements effortlessly.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white transition-all shadow-lg shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Credit Card
            </button>
            {cards.length > 0 && (
              <button
                onClick={toggleFlipAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all shadow-sm"
              >
                <RotateCw className="w-4 h-4 text-indigo-300" />
                Flip All Cards
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Urgent Payment Due Alert Banner (if any card due within 5 days) */}
      {urgentDueCards.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 backdrop-blur-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Payment Due Soon!
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                {urgentDueCards[0].card.bankName} {urgentDueCards[0].card.cardName} (•••• {urgentDueCards[0].card.last4}) is due in{' '}
                <strong className="font-bold underline">{urgentDueCards[0].due?.days} days</strong> ({urgentDueCards[0].due?.dateString}).
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedCardId(urgentDueCards[0].card.id)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
          >
            Inspect Card
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Credit Limit */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Credit Limit</span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
            {formatAmount(summary.totalCreditLimit || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across {summary.cardsCount || 0} active card(s)
          </p>
        </div>

        {/* Current Utilized / Spent */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Utilized Balance</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 tracking-tight">
            {formatAmount(summary.totalSpent || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Current outstanding expenses
          </p>
        </div>

        {/* Total Available Credit */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Available Limit</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
            {formatAmount(summary.totalAvailable || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Available purchasing power
          </p>
        </div>

        {/* Utilization Ratio */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Credit Utilization</span>
            <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {summary.overallUtilization || 0}%
            </p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                (summary.overallUtilization || 0) < 30
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
              }`}
            >
              {(summary.overallUtilization || 0) < 30 ? 'Optimal' : 'High'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {(summary.overallUtilization || 0) < 30
              ? '💡 Keeping < 30% improves credit score'
              : '⚠️ Keep under 30% to maximize CIBIL'}
          </p>
        </div>
      </div>

      {/* Main Section: Search, Filters & View Switcher */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search & Bank Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search card name, bank or last 4..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bank pills */}
            {availableBanks.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {availableBanks.slice(0, 4).map(bank => (
                  <button
                    key={bank}
                    onClick={() => setSelectedBankFilter(bank)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedBankFilter === bank
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Controls: View Switcher & Add Button */}
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('wallet')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'wallet'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Wallet Stack View"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden md:inline">Wallet Stack</span>
              </button>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              New Card
            </button>
          </div>
        </div>

        {/* Card List / Render */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <CardIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {cards.length === 0 ? 'No credit cards added yet' : 'No cards match your filter'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {cards.length === 0
                ? 'Add your credit cards to select them when adding expenses, monitor billing dates, and keep track of your credit limits.'
                : 'Try clearing your search query or selecting "All" banks.'}
            </p>
            {cards.length === 0 ? (
              <button
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                Add Your First Card
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBankFilter('All');
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ================================================================= */
          /* GRID VIEW WITH 3D FLIP CARDS                                      */
          /* ================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map(card => {
              const isSelected = selectedCardId === card.id;
              const dueInfo = getDaysUntilDue(card.dueDateDay);
              const isFlipped = !!flippedCards[card.id];

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`cursor-pointer rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 border-indigo-500 bg-white dark:bg-slate-900 shadow-xl'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg'
                  }`}
                >
                  {/* Top 3D Interactive Flip Card */}
                  <div className="flex justify-center w-full mb-4">
                    <InteractiveBankCard
                      card={{
                        ...card,
                        cardType: 'credit',
                      }}
                      cardholderFallback={user?.name || 'CARDHOLDER'}
                      isFlipped={isFlipped}
                      onFlipToggle={() => toggleCardFlip(card.id)}
                      size="md"
                    />
                  </div>

                  {/* Card Metrics & Progress */}
                  <div className="space-y-3 pt-2">
                    {/* Spent / Limit */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Spent / Limit</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatAmount(card.currentSpent)}{' '}
                        <span className="font-normal text-slate-400">/ {formatAmount(card.creditLimit)}</span>
                      </span>
                    </div>

                    {/* Progress Bar with Color Coding */}
                    <div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            card.utilizationRate > 70
                              ? 'bg-rose-500'
                              : card.utilizationRate > 30
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, card.utilizationRate)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1.5">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {card.utilizationRate}% utilized
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatAmount(card.availableCredit)} available
                        </span>
                      </div>
                    </div>

                    {/* Due Date & Billing Cycle Tag */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Cycle: Day {card.billingCycleDay || 1}</span>
                      </div>

                      {dueInfo && (
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dueInfo.isUrgent
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Due in {dueInfo.days}d ({card.dueDateDay}th)</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                        {card.txCount || 0} recorded expense(s)
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleCardFlip(card.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Flip Card"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
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
                          type="button"
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
        ) : (
          /* ================================================================= */
          /* WALLET STACK VIEW (LUXURY OVERLAPPING DECK)                      */
          /* ================================================================= */
          <div className="bg-slate-900/40 dark:bg-slate-900/60 p-8 rounded-3xl border border-slate-800/80 backdrop-blur-md">
            <div className="text-center mb-6">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">
                FinFlow Card Wallet
              </span>
              <h3 className="text-lg font-extrabold text-white">Your Card Stack</h3>
              <p className="text-xs text-slate-400 mt-1">
                Hover or click any card to pull it to the top of your wallet deck
              </p>
            </div>

            <div className="max-w-md mx-auto relative pt-4 pb-12 flex flex-col items-center">
              {filteredCards.map((card, idx) => {
                const isSelected = selectedCardId === card.id;
                const isFlipped = !!flippedCards[card.id];

                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`transition-all duration-300 w-full flex justify-center cursor-pointer ${
                      idx !== 0 ? '-mt-36' : ''
                    } hover:-translate-y-6 hover:z-30`}
                    style={{
                      zIndex: isSelected ? 40 : idx + 1,
                      transform: isSelected ? 'scale(1.03)' : undefined,
                    }}
                  >
                    <InteractiveBankCard
                      card={{
                        ...card,
                        cardType: 'credit',
                      }}
                      cardholderFallback={user?.name || 'CARDHOLDER'}
                      isFlipped={isFlipped}
                      onFlipToggle={() => toggleCardFlip(card.id)}
                      size="md"
                      className={isSelected ? 'ring-4 ring-indigo-500 rounded-2xl' : ''}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Card Recent Expenses Breakdown */}
      {selectedCard && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCard.color || '#4F46E5' }}
                />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Expenses on {selectedCard.bankName} {selectedCard.cardName} (•••• {selectedCard.last4})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current cycle spend: {formatAmount(selectedCard.currentSpent)} • Available credit:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatAmount(selectedCard.availableCredit)}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter expenses..."
                  value={txSearchQuery}
                  onChange={e => setTxSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {cardTransactions.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Export Statement to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              )}
            </div>
          </div>

          {loadingTxs ? (
            <div className="py-10 text-center text-xs text-slate-400">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <CardIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {cardTransactions.length === 0
                  ? 'No expenses charged to this card yet.'
                  : 'No expenses match your search query.'}
              </p>
              <p className="mt-1">
                When recording an expense, choose &quot;Credit Card&quot; and pick this card to link it.
              </p>
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
                  {filteredTransactions.map(t => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                        {t.date}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {t.note || 'Expense'}
                      </td>
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

      {/* Add / Edit Card Modal with LIVE 3D Interactive Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  See real-time 3D card preview as you customize details
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LIVE 3D INTERACTIVE CARD PREVIEW */}
            <div className="my-5 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Live Card Preview (Click to Flip)
              </span>
              <InteractiveBankCard
                card={modalLiveCardData}
                cardholderFallback={user?.name || 'CARDHOLDER'}
                isFlipped={modalPreviewFlipped}
                onFlipToggle={setModalPreviewFlipped}
                size="md"
              />
            </div>

            {/* Popular Card Quick-Fill Templates */}
            {!editingCard && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  ⚡ Quick Templates (Click to Auto-fill)
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {CARD_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 whitespace-nowrap transition-colors"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveCard} className="space-y-4">
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
                    placeholder="e.g. Standard Chartered, Citi"
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

              {/* Color Theme Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Theme Finish
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PRESETS.map(col => (
                    <button
                      type="button"
                      key={col.value}
                      onClick={() => setSelectedColor(col.value)}
                      className={`h-9 rounded-xl flex items-center justify-center transition-all relative overflow-hidden border ${
                        selectedColor === col.value
                          ? 'ring-2 ring-indigo-500 border-white scale-105 shadow-md'
                          : 'border-white/10 hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    >
                      {selectedColor === col.value && (
                        <CheckCircle className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
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
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
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

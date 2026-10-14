import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  Trash2,
  Edit2,
  Wallet,
  TrendingDown,
  CheckCircle,
  Calendar,
  X,
  Zap,
  ArrowDownLeft,
  RotateCw,
  Search,
  Grid,
  Layers,
  Sparkles,
  Download,
  AlertTriangle,
  PhoneCall,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Landmark,
} from 'lucide-react';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { InteractiveBankCard, BankCardData } from '../components/cards/InteractiveBankCard.tsx';

interface DebitCardItem {
  id: string;
  cardName: string;
  bankName: string;
  last4: string;
  cardNetwork: string;
  nameOnCard: string;
  expiryMmYy: string;
  linkedAccount: string;
  atmLimit: number;
  posLimit: number;
  status: string;
  amcReminderDate: string;
  lostCardContact: string;
  currentSpent: number;
  txCount: number;
  color: string;
  createdAt: string;
}

const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'SBI',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bank of Baroda',
  'IndusInd Bank',
  'Punjab National Bank',
  'Canara Bank',
  'Other',
];

const CARD_NETWORKS = ['RuPay', 'Visa', 'Mastercard', 'Maestro'];

const COLOR_PRESETS = [
  { name: 'Emerald Wealth', value: '#065F46', preview: 'from-emerald-900 to-slate-900' },
  { name: 'Teal Horizon', value: '#0F766E', preview: 'from-teal-800 to-slate-900' },
  { name: 'Ocean Navy', value: '#1E3A8A', preview: 'from-blue-900 to-slate-900' },
  { name: 'Deep Indigo', value: '#3730A3', preview: 'from-indigo-900 to-slate-900' },
  { name: 'Obsidian Black', value: '#0F172A', preview: 'from-slate-900 to-black' },
  { name: 'Titanium Slate', value: '#1E293B', preview: 'from-slate-800 to-slate-950' },
  { name: 'Amethyst Luxe', value: '#6B21A8', preview: 'from-purple-900 to-slate-950' },
  { name: 'Crimson Ruby', value: '#991B1B', preview: 'from-red-900 to-stone-950' },
  { name: 'Golden Bronze', value: '#B45309', preview: 'from-amber-700 to-stone-900' },
];

const DEBIT_TEMPLATES = [
  {
    label: 'HDFC EasyShop Platinum',
    bank: 'HDFC Bank',
    cardName: 'EasyShop Platinum',
    network: 'Visa',
    color: '#1E3A8A',
    atmLimit: '100000',
    posLimit: '500000',
    lostContact: '1800 202 6161',
  },
  {
    label: 'SBI Global RuPay',
    bank: 'SBI',
    cardName: 'Global International',
    network: 'RuPay',
    color: '#065F46',
    atmLimit: '40000',
    posLimit: '75000',
    lostContact: '1800 1234',
  },
  {
    label: 'ICICI Coral Debit',
    bank: 'ICICI Bank',
    cardName: 'Coral Debit Card',
    network: 'Mastercard',
    color: '#0F766E',
    atmLimit: '100000',
    posLimit: '300000',
    lostContact: '1800 1080',
  },
  {
    label: 'Axis Burgundy Debit',
    bank: 'Axis Bank',
    cardName: 'Burgundy World Debit',
    network: 'Mastercard',
    color: '#991B1B',
    atmLimit: '200000',
    posLimit: '600000',
    lostContact: '1800 419 5959',
  },
  {
    label: 'Kotak Privy League',
    bank: 'Kotak Mahindra Bank',
    cardName: 'Privy League Signature',
    network: 'Visa',
    color: '#0F172A',
    atmLimit: '150000',
    posLimit: '400000',
    lostContact: '1860 266 2666',
  },
];

export function DebitCardsPage() {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { showToast } = useToast();

  const [cards, setCards] = useState<DebitCardItem[]>([]);
  const [summary, setSummary] = useState({
    totalSpent: 0,
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
  const [editingCard, setEditingCard] = useState<DebitCardItem | null>(null);

  // Form Fields
  const [cardName, setCardName] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [customBank, setCustomBank] = useState('');
  const [last4, setLast4] = useState('');
  const [cardNetwork, setCardNetwork] = useState('RuPay');
  const [nameOnCard, setNameOnCard] = useState('');
  const [expiryMmYy, setExpiryMmYy] = useState('');
  const [linkedAccount, setLinkedAccount] = useState('');
  const [atmLimit, setAtmLimit] = useState('');
  const [posLimit, setPosLimit] = useState('');
  const [status, setStatus] = useState('Active');
  const [amcReminderDate, setAmcReminderDate] = useState('');
  const [lostCardContact, setLostCardContact] = useState('');
  const [selectedColor, setSelectedColor] = useState('#065F46');
  const [formLoading, setFormLoading] = useState(false);

  // Selected Card for Transactions View
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [txSearchQuery, setTxSearchQuery] = useState('');

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/cards?type=debit');
      const cardList = data.cards || [];
      setCards(cardList);
      setSummary(data.summary || {});
      if (cardList.length > 0 && !selectedCardId) {
        setSelectedCardId(cardList[0].id);
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load debit cards.' });
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
        /* ignore */
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
    setCardNetwork('RuPay');
    setNameOnCard(user?.name || '');
    setExpiryMmYy('12/29');
    setLinkedAccount('');
    setAtmLimit('50000');
    setPosLimit('100000');
    setStatus('Active');
    setAmcReminderDate('');
    setLostCardContact('1800 202 6161');
    setSelectedColor('#065F46');
    setModalPreviewFlipped(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card: DebitCardItem) => {
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
    setCardNetwork(card.cardNetwork || 'RuPay');
    setNameOnCard(card.nameOnCard || user?.name || '');
    setExpiryMmYy(card.expiryMmYy || '');
    setLinkedAccount(card.linkedAccount || '');
    setAtmLimit(card.atmLimit ? String(card.atmLimit) : '');
    setPosLimit(card.posLimit ? String(card.posLimit) : '');
    setStatus(card.status || 'Active');
    setAmcReminderDate(card.amcReminderDate || '');
    setLostCardContact(card.lostCardContact || '');
    setSelectedColor(card.color || '#065F46');
    setModalPreviewFlipped(false);
    setIsModalOpen(true);
  };

  const handleApplyTemplate = (tpl: (typeof DEBIT_TEMPLATES)[0]) => {
    setBankName(tpl.bank);
    setCustomBank('');
    setCardName(tpl.cardName);
    setCardNetwork(tpl.network);
    setSelectedColor(tpl.color);
    setAtmLimit(tpl.atmLimit);
    setPosLimit(tpl.posLimit);
    setLostCardContact(tpl.lostContact);
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

    setFormLoading(true);
    try {
      const payload = {
        cardName: cardName.trim() || `${actualBank} Debit Card`,
        bankName: actualBank,
        last4: cleanLast4,
        cardNetwork,
        cardType: 'debit',
        nameOnCard,
        expiryMmYy,
        linkedAccount,
        atmLimit: atmLimit ? parseFloat(atmLimit) : undefined,
        posLimit: posLimit ? parseFloat(posLimit) : undefined,
        status,
        amcReminderDate,
        lostCardContact,
        color: selectedColor,
      };

      if (editingCard) {
        await api.put(`/cards/${editingCard.id}`, payload);
        showToast({ type: 'success', message: 'Debit card updated!' });
      } else {
        await api.post('/cards', payload);
        showToast({ type: 'success', message: 'Debit card added!' });
      }

      setIsModalOpen(false);
      fetchCards();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save card.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCard = async (card: DebitCardItem) => {
    if (!confirm(`Remove ${card.bankName} •••• ${card.last4}?`)) return;
    try {
      await api.delete(`/cards/${card.id}`);
      showToast({ type: 'info', message: `Removed card •••• ${card.last4}.` });
      if (selectedCardId === card.id) setSelectedCardId(null);
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
        c.last4.includes(searchQuery) ||
        (c.linkedAccount && c.linkedAccount.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBank =
        selectedBankFilter === 'All' ||
        c.bankName.toLowerCase() === selectedBankFilter.toLowerCase();

      return matchesSearch && matchesBank;
    });
  }, [cards, searchQuery, selectedBankFilter]);

  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => set.add(c.bankName));
    return ['All', ...Array.from(set)];
  }, [cards]);

  const selectedCard = cards.find(c => c.id === selectedCardId) || cards[0];

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

  const handleExportCSV = () => {
    if (!selectedCard || cardTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Amount (INR)'];
    const rows = cardTransactions.map(t => [
      t.date,
      `"${(t.note || 'Debit Expense').replace(/"/g, '""')}"`,
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
      `${selectedCard.bankName}_debit_${selectedCard.last4}_statement.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({ type: 'success', message: 'Debit statement exported.' });
  };

  // Compute daily limit totals across all active cards
  const totalAtmLimits = useMemo(() => {
    return cards.reduce((acc, c) => acc + (c.atmLimit || 0), 0);
  }, [cards]);

  const totalPosLimits = useMemo(() => {
    return cards.reduce((acc, c) => acc + (c.posLimit || 0), 0);
  }, [cards]);

  // Live modal card preview object
  const modalLiveCardData: BankCardData = {
    cardName: cardName.trim() || 'EasyShop Platinum',
    bankName: bankName === 'Other' ? (customBank.trim() || 'Bank') : bankName,
    last4: last4.trim() || '9876',
    cardNetwork,
    cardType: 'debit',
    nameOnCard: nameOnCard || user?.name || 'CARDHOLDER',
    expiryMmYy: expiryMmYy || '12/29',
    linkedAccount: linkedAccount || 'Savings A/C •••• 1234',
    lostCardContact: lostCardContact || '1800 202 6161',
    color: selectedColor,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white shadow-2xl relative overflow-hidden border border-emerald-900/30">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-teal-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30 backdrop-blur-md">
            <Wallet className="w-3.5 h-3.5 text-emerald-300" />
            Debit Cards & Bank Account Spending Hub
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Debit Cards Portfolio
          </h2>
          <p className="text-sm text-emerald-200 mt-2 leading-relaxed">
            Manage your physical bank debit cards, monitor ATM withdrawal allowances and POS swipe limits, inspect security CVVs with 3D flip cards, and keep bank statements organized.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white transition-all shadow-lg shadow-emerald-500/30"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Debit Card
            </button>
            {cards.length > 0 && (
              <button
                onClick={toggleFlipAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all shadow-sm"
              >
                <RotateCw className="w-4 h-4 text-emerald-300" />
                Flip All Cards
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spent */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Debit Spending</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 tracking-tight">
            {formatAmount(summary.totalSpent || 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deducted directly from bank accounts
          </p>
        </div>

        {/* Active Debit Cards */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Cards</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
            {cards.filter(c => c.status !== 'Blocked' && c.status !== 'Expired').length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Out of {cards.length} total card(s)
          </p>
        </div>

        {/* Total ATM Daily Capacity */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Daily ATM Withdrawal</span>
            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
            {formatAmount(totalAtmLimits)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Combined daily cash limit
          </p>
        </div>

        {/* Total POS Daily Capacity */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Daily POS / E-Com Limit</span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
            {formatAmount(totalPosLimits)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Merchant / online transaction limit
          </p>
        </div>
      </div>

      {/* Main Section: Search, Filters & View Switcher */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search debit card name, bank, or last 4..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            {availableBanks.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {availableBanks.slice(0, 4).map(bank => (
                  <button
                    key={bank}
                    onClick={() => setSelectedBankFilter(bank)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedBankFilter === bank
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              New Card
            </button>
          </div>
        </div>

        {/* Card Grid / List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <Wallet className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {cards.length === 0 ? 'No debit cards added yet' : 'No cards match your filter'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {cards.length === 0
                ? 'Add your debit cards to keep track of spending from your bank accounts and manage daily limits.'
                : 'Try adjusting your search terms or clearing bank filters.'}
            </p>
            {cards.length === 0 ? (
              <button
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
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
          /* GRID VIEW WITH 3D FLIP DEBIT CARDS                                */
          /* ================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map(card => {
              const isSelected = selectedCardId === card.id;
              const isFlipped = !!flippedCards[card.id];
              const isExpired = card.status === 'Expired';
              const isBlocked = card.status === 'Blocked';

              let expiryWarning = false;
              if (card.expiryMmYy) {
                const [mm, yy] = card.expiryMmYy.split('/');
                if (mm && yy) {
                  const expiryDate = new Date(2000 + parseInt(yy, 10), parseInt(mm, 10) - 1, 1);
                  const now = new Date();
                  const diffTime = expiryDate.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  if (expiryDate > now && diffDays <= 45) {
                    expiryWarning = true;
                  }
                }
              }

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`cursor-pointer rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 border-emerald-500 bg-white dark:bg-slate-900 shadow-xl'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg'
                  }`}
                >
                  {/* Top 3D Interactive Flip Card */}
                  <div className="flex justify-center w-full mb-4">
                    <InteractiveBankCard
                      card={{
                        ...card,
                        cardType: 'debit',
                      }}
                      cardholderFallback={user?.name || 'CARDHOLDER'}
                      isFlipped={isFlipped}
                      onFlipToggle={() => toggleCardFlip(card.id)}
                      size="md"
                    />
                  </div>

                  {/* Card Details & Limits */}
                  <div className="space-y-3 pt-2">
                    {/* Status & Expiry Warning */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isBlocked ? 'bg-rose-500' : isExpired ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {card.status || 'Active'}
                        </span>
                      </div>

                      {card.linkedAccount && (
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg truncate max-w-[160px]">
                          {card.linkedAccount}
                        </span>
                      )}
                    </div>

                    {expiryWarning && (
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-200/80 dark:border-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Card expiring soon ({card.expiryMmYy})</span>
                      </div>
                    )}

                    {/* Spend & Limits Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Spent
                        </span>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
                          {formatAmount(card.currentSpent)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Daily ATM Limit
                        </span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                          {card.atmLimit ? formatAmount(card.atmLimit) : 'Unlimited'}
                        </span>
                      </div>
                    </div>

                    {/* Lost Card Contact line */}
                    {card.lostCardContact && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <PhoneCall className="w-3 h-3 text-amber-500" />
                          <span>Emergency Helpline:</span>
                        </span>
                        <a
                          href={`tel:${card.lostCardContact}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {card.lostCardContact}
                        </a>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        {card.txCount || 0} debit transactions
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleCardFlip(card.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
          /* WALLET STACK VIEW FOR DEBIT CARDS                                 */
          /* ================================================================= */
          <div className="bg-slate-900/40 dark:bg-slate-900/60 p-8 rounded-3xl border border-slate-800/80 backdrop-blur-md">
            <div className="text-center mb-6">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
                Debit Card Wallet
              </span>
              <h3 className="text-lg font-extrabold text-white">Your Bank Cards</h3>
              <p className="text-xs text-slate-400 mt-1">
                Hover or click any card to pull it to the top of your wallet stack
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
                        cardType: 'debit',
                      }}
                      cardholderFallback={user?.name || 'CARDHOLDER'}
                      isFlipped={isFlipped}
                      onFlipToggle={() => toggleCardFlip(card.id)}
                      size="md"
                      className={isSelected ? 'ring-4 ring-emerald-500 rounded-2xl' : ''}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Card Transactions View */}
      {selectedCard && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCard.color || '#065F46' }}
                />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Expenses on {selectedCard.bankName} Debit (•••• {selectedCard.last4})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total deducted from linked account: {formatAmount(selectedCard.currentSpent)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter debit expenses..."
                  value={txSearchQuery}
                  onChange={e => setTxSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              <Wallet className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {cardTransactions.length === 0
                  ? 'No debit expenses charged to this card yet.'
                  : 'No expenses match your search query.'}
              </p>
              <p className="mt-1">
                When adding an expense, select &quot;Debit Card&quot; and choose this card to link it.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount Deducted</th>
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
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        - {formatAmount(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal with LIVE 3D Interactive Card Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingCard ? 'Edit Debit Card' : 'Add New Debit Card'}
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
                <Sparkles className="w-3 h-3 text-emerald-500" />
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

            {/* Quick Templates */}
            {!editingCard && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  ⚡ Quick Templates (Click to Auto-fill)
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {DEBIT_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 whitespace-nowrap transition-colors"
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
                  Bank Name *
                </label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    placeholder="e.g. Federal Bank, DBS"
                    value={customBank}
                    onChange={e => setCustomBank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Card Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Card / Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salary Account, Savings Account, Coral Debit"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Last 4 */}
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Network */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Network
                  </label>
                  <select
                    value={cardNetwork}
                    onChange={e => setCardNetwork(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CARD_NETWORKS.map(net => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cardholder Name & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={nameOnCard}
                    onChange={e => setNameOnCard(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Expiry (MM/YY)
                  </label>
                  <input
                    type="text"
                    placeholder="12/29"
                    maxLength={5}
                    value={expiryMmYy}
                    onChange={e => setExpiryMmYy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Account and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Linked Bank Account
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Savings A/C •••• 1234"
                    value={linkedAccount}
                    onChange={e => setLinkedAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Daily ATM & POS Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Daily ATM Limit (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="50000"
                    value={atmLimit}
                    onChange={e => setAtmLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Daily POS Limit (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="100000"
                    value={posLimit}
                    onChange={e => setPosLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Lost Card Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Lost Card Helpline
                  </label>
                  <input
                    type="text"
                    placeholder="1800-202-6161"
                    value={lostCardContact}
                    onChange={e => setLostCardContact(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    AMC Reminder Date
                  </label>
                  <input
                    type="date"
                    value={amcReminderDate}
                    onChange={e => setAmcReminderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                          ? 'ring-2 ring-emerald-500 border-white scale-105 shadow-md'
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
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  {formLoading ? 'Saving...' : editingCard ? 'Update Card' : 'Save Debit Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

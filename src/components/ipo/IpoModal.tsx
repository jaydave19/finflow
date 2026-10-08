import React, { useState, useEffect } from 'react';
import { X, Landmark, ShieldCheck, Lock, CheckCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { api } from '../../api/client.ts';
import { useCurrency } from '../../context/CurrencyContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface IpoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function IpoModal({ isOpen, onClose, onSuccess, initialData }: IpoModalProps) {
  const { currencyConfig } = useCurrency();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [ipoName, setIpoName] = useState('');
  const [amount, setAmount] = useState('');
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [sharesCount, setSharesCount] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [lotSize, setLotSize] = useState('1');
  const [status, setStatus] = useState<'Blocked' | 'Allotted' | 'Refunded' | 'Sold'>('Blocked');
  const [soldPrice, setSoldPrice] = useState('');
  const [mandateStatus, setMandateStatus] = useState('UPI ASBA Mandate Accepted');
  const [bankName, setBankName] = useState('');
  const [dematAccount, setDematAccount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setIpoName(initialData.ipoName || initialData.note || '');
        setAmount(String(initialData.amount || ''));
        setApplicationDate(initialData.applicationDate || initialData.date || new Date().toISOString().split('T')[0]);
        setPaymentMethod(initialData.paymentMethod || 'UPI');
        setSharesCount(String(initialData.sharesCount || initialData.ipoDetails?.sharesCount || ''));
        setBidPrice(String(initialData.bidPrice || initialData.ipoDetails?.bidPrice || ''));
        setLotSize(String(initialData.lotSize || initialData.ipoDetails?.lotSize || '1'));
        setStatus(initialData.status || initialData.ipoDetails?.status || 'Blocked');
        setSoldPrice(String(initialData.soldPrice || initialData.ipoDetails?.soldPrice || ''));
        setMandateStatus(initialData.mandateStatus || initialData.ipoDetails?.mandateStatus || 'UPI ASBA Mandate Accepted');
        setBankName(initialData.bankName || '');
        setDematAccount(initialData.dematAccount || '');
        setNote(initialData.note || '');
      } else {
        setIpoName('');
        setAmount('');
        setApplicationDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('UPI');
        setSharesCount('');
        setBidPrice('');
        setLotSize('1');
        setStatus('Blocked');
        setSoldPrice('');
        setMandateStatus('UPI ASBA Mandate Accepted');
        setBankName('');
        setDematAccount('');
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  // Auto calculate amount when shares count and bid price change
  const handleAutoCalcAmount = () => {
    const s = parseFloat(sharesCount);
    const p = parseFloat(bidPrice);
    if (!isNaN(s) && !isNaN(p) && s > 0 && p > 0) {
      setAmount(String(Math.round(s * p)));
    }
  };

  const handleStatusChange = (newStatus: 'Blocked' | 'Allotted' | 'Refunded' | 'Sold') => {
    setStatus(newStatus);
    if (newStatus === 'Blocked') {
      setMandateStatus('UPI ASBA Mandate Accepted & Capital Blocked');
    } else if (newStatus === 'Allotted') {
      setMandateStatus('Shares Allotted & Funds Debited from Bank');
    } else if (newStatus === 'Refunded') {
      setMandateStatus('Mandate Revoked / Capital Unblocked');
    } else if (newStatus === 'Sold') {
      setMandateStatus('Shares Sold in Secondary Market');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipoName.trim()) {
      showToast({ type: 'error', message: 'Please enter the IPO / Company name.' });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid blocked application amount.' });
      return;
    }

    const numSoldPrice = parseFloat(soldPrice);
    if (status === 'Sold' && (isNaN(numSoldPrice) || numSoldPrice <= 0)) {
      showToast({ type: 'error', message: 'Please enter the sold price per share.' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ipoName: ipoName.trim(),
        amount: numAmount,
        applicationDate,
        paymentMethod,
        sharesCount: sharesCount ? parseInt(sharesCount, 10) : undefined,
        bidPrice: bidPrice ? parseFloat(bidPrice) : undefined,
        lotSize: lotSize ? parseInt(lotSize, 10) : 1,
        status,
        mandateStatus,
        soldPrice: status === 'Sold' && !isNaN(numSoldPrice) ? numSoldPrice : undefined,
        bankName: bankName.trim() || undefined,
        dematAccount: dematAccount.trim() || undefined,
        note: note.trim() || `${ipoName.trim()} - ${status}`,
      };

      if (initialData?.id) {
        await api.put(`/ipos/${initialData.id}`, payload);
        showToast({ type: 'success', message: 'IPO application updated successfully!' });
      } else {
        await api.post('/ipos', payload);
        showToast({
          type: 'success',
          message: `IPO application logged! ${currencyConfig.symbol}${numAmount.toLocaleString()} marked as ${status}.`,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save IPO entry.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {initialData?.id ? 'Edit IPO Application' : 'Record IPO Application'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track ASBA / UPI mandate blocked capital separately from daily expenses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Company / IPO Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              IPO / Company Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bajaj Housing Finance, Premier Energies, Tata Tech"
              value={ipoName}
              onChange={e => setIpoName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Amount Blocked */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Blocked Amount ({currencyConfig.symbol}) *
              </label>
              {sharesCount && bidPrice && (
                <button
                  type="button"
                  onClick={handleAutoCalcAmount}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Auto-fill: ₹{Number(sharesCount) * Number(bidPrice)}
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                {currencyConfig.symbol}
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="14950"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Shares Count, Bid Price, Lots */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Total Shares
              </label>
              <input
                type="number"
                placeholder="e.g. 214"
                value={sharesCount}
                onChange={e => setSharesCount(e.target.value)}
                onBlur={handleAutoCalcAmount}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cut-off / Price (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 70"
                value={bidPrice}
                onChange={e => setBidPrice(e.target.value)}
                onBlur={handleAutoCalcAmount}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Lots
              </label>
              <input
                type="number"
                min="1"
                placeholder="1"
                value={lotSize}
                onChange={e => setLotSize(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Date & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Application Date *
              </label>
              <input
                type="date"
                required
                value={applicationDate}
                onChange={e => setApplicationDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ASBA Mode
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="UPI">UPI ASBA (Google Pay / PhonePe / BHIM)</option>
                <option value="Net Banking">Net Banking ASBA (HDFC / SBI / ICICI)</option>
              </select>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Allotment Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'Blocked', label: 'Blocked', icon: Lock, color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
                { key: 'Allotted', label: 'Allotted', icon: CheckCircle, color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
                { key: 'Refunded', label: 'Refunded', icon: RotateCcw, color: 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
                { key: 'Sold', label: 'Sold', icon: TrendingUp, color: 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
              ].map(st => {
                const Icon = st.icon;
                const isSelected = status === st.key;
                return (
                  <button
                    type="button"
                    key={st.key}
                    onClick={() => handleStatusChange(st.key as any)}
                    className={`py-2 px-1 text-center rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? `${st.color} shadow-sm font-bold ring-2 ring-indigo-500/20`
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sold Price & Realized Profit/Loss (Shown when status is Sold) */}
          {status === 'Sold' && (
            <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-purple-900 dark:text-purple-300">
                  Sold Price per Share (₹) *
                </label>
                {bidPrice && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Bought / Issue Price: ₹{bidPrice}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 115.50"
                  value={soldPrice}
                  onChange={e => setSoldPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Live Profit & Loss Preview */}
              {soldPrice && !isNaN(parseFloat(soldPrice)) && (
                (() => {
                  const sp = parseFloat(soldPrice);
                  const shares = parseFloat(sharesCount) || (bidPrice ? Math.round(parseFloat(amount) / parseFloat(bidPrice)) : 1);
                  const bp = parseFloat(bidPrice) || (shares > 0 ? parseFloat(amount) / shares : 0);
                  const totalInvested = parseFloat(amount) || (shares * bp);
                  const totalRealized = shares * sp;
                  const pl = totalRealized - totalInvested;
                  const plPct = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;
                  const isProfit = pl >= 0;

                  return (
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      isProfit
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                    }`}>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider">
                          Realized {isProfit ? 'Profit' : 'Loss'}
                        </div>
                        <div className="text-sm font-extrabold mt-0.5">
                          {isProfit ? '+' : ''}₹{Math.abs(Math.round(pl)).toLocaleString()} ({isProfit ? '+' : ''}{plPct.toFixed(2)}%)
                        </div>
                      </div>
                      <div className="text-right text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Realized Value</span>
                        <span className="font-bold">₹{Math.round(totalRealized).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Mandate Status / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Mandate Status Message
            </label>
            <input
              type="text"
              value={mandateStatus}
              onChange={e => setMandateStatus(e.target.value)}
              placeholder="e.g. UPI ASBA Mandate Accepted"
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Optional Bank & Demat info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bank Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC / SBI"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Demat / Broker (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Zerodha / Groww"
                value={dematAccount}
                onChange={e => setDematAccount(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
              {loading ? 'Saving...' : initialData?.id ? 'Update IPO' : 'Save IPO Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

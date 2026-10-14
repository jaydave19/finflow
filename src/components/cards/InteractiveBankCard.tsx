import React, { useState } from 'react';
import {
  RotateCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Zap,
  PhoneCall,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard as CardIcon,
  Sparkles,
} from 'lucide-react';
import { CardNetworkLogo } from './CardNetworkLogo.tsx';

export interface BankCardData {
  id?: string;
  cardName: string;
  bankName: string;
  last4: string;
  cardNetwork?: string;
  cardType?: 'credit' | 'debit' | string;
  nameOnCard?: string;
  expiryMmYy?: string;
  linkedAccount?: string;
  creditLimit?: number;
  currentSpent?: number;
  availableCredit?: number;
  utilizationRate?: number;
  billingCycleDay?: number;
  dueDateDay?: number;
  atmLimit?: number;
  posLimit?: number;
  status?: string;
  amcReminderDate?: string;
  lostCardContact?: string;
  color?: string;
}

interface InteractiveBankCardProps {
  card: BankCardData;
  cardholderFallback?: string;
  isFlipped?: boolean;
  onFlipToggle?: (flipped: boolean) => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showQuickActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Generate gradient styles from base color or theme
function getCardBackground(color?: string) {
  const base = color || '#1E3A8A';

  // Specific preset gradients for popular colors
  const presets: Record<string, string> = {
    '#0F172A': 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #090d16 100%)', // Obsidian Black
    '#1E293B': 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)', // Titanium Slate
    '#1E3A8A': 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #0f172a 100%)', // Royal Navy
    '#3730A3': 'linear-gradient(135deg, #3730a3 0%, #4338ca 40%, #1e1b4b 100%)', // Deep Indigo
    '#4F46E5': 'linear-gradient(135deg, #4f46e5 0%, #6366f1 45%, #1e1b4b 100%)', // Violet Neon
    '#065F46': 'linear-gradient(135deg, #065f46 0%, #047857 45%, #022c22 100%)', // Emerald Wealth
    '#0F766E': 'linear-gradient(135deg, #0f766e 0%, #14b8a6 45%, #042f2e 100%)', // Teal Horizon
    '#B45309': 'linear-gradient(135deg, #b45309 0%, #d97706 45%, #451a03 100%)', // Golden Amber
    '#991B1B': 'linear-gradient(135deg, #991b1b 0%, #b91c1c 45%, #450a0a 100%)', // Crimson Wine
    '#6B21A8': 'linear-gradient(135deg, #6b21a8 0%, #7e22ce 45%, #2e1065 100%)', // Amethyst Luxe
    '#BE185D': 'linear-gradient(135deg, #be185d 0%, #db2777 45%, #500724 100%)', // Rose Gold Luxe
  };

  if (presets[base.toUpperCase()] || presets[base]) {
    return presets[base.toUpperCase()] || presets[base];
  }

  // Fallback dynamic gradient around the user's custom hex
  return `linear-gradient(135deg, ${base} 0%, #0b0f19 100%)`;
}

// Derive a tier badge based on card name
function getCardTier(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('infinite')) return 'INFINITE';
  if (n.includes('signature')) return 'SIGNATURE';
  if (n.includes('regalia') || n.includes('sapphiro') || n.includes('magnus')) return 'PREMIER';
  if (n.includes('millennia') || n.includes('coral') || n.includes('rubyx')) return 'SELECT';
  if (n.includes('platinum')) return 'PLATINUM';
  if (n.includes('gold')) return 'GOLD';
  if (n.includes('world')) return 'WORLD ELITE';
  if (n.includes('black') || n.includes('obsidian') || n.includes('titanium')) return 'TITANIUM';
  return 'STANDARD';
}

export function InteractiveBankCard({
  card,
  cardholderFallback = 'CARDHOLDER',
  isFlipped: controlledFlipped,
  onFlipToggle,
  interactive = true,
  size = 'md',
  className = '',
  showQuickActions = true,
  onEdit,
  onDelete,
}: InteractiveBankCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCvv, setCopiedCvv] = useState(false);

  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const toggleFlip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !isFlipped;
    if (onFlipToggle) {
      onFlipToggle(next);
    } else {
      setInternalFlipped(next);
    }
  };

  const handleCopyCardNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullNum = `4532 •••• •••• ${card.last4 || '0000'}`;
    navigator.clipboard?.writeText?.(fullNum.replace(/\s+/g, ' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCvv = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Deterministic dummy CVV from last4
    const pseudoCvv = String(((parseInt(card.last4 || '42', 10) * 17) % 900) + 100);
    navigator.clipboard?.writeText?.(pseudoCvv);
    setCopiedCvv(true);
    setTimeout(() => setCopiedCvv(false), 2000);
  };

  const isCredit = (card.cardType || 'credit').toLowerCase() === 'credit';
  const tier = getCardTier(card.cardName);
  const bgGradient = getCardBackground(card.color);
  const cardholder = card.nameOnCard || cardholderFallback;
  const pseudoCvv = String(((parseInt(card.last4 || '42', 10) * 17) % 900) + 100);

  // Size configurations
  const sizeStyles = {
    sm: 'max-w-[290px] h-[180px] text-xs',
    md: 'max-w-[380px] h-[225px] text-sm',
    lg: 'max-w-[440px] h-[260px] text-base',
  }[size];

  return (
    <div
      className={`relative select-none group/card w-full ${sizeStyles} ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* 3D Flip Container */}
      <div
        onClick={interactive ? toggleFlip : undefined}
        className={`w-full h-full relative rounded-2xl transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-1`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ========================================================================= */}
        {/* FRONT FACE                                                                 */}
        {/* ========================================================================= */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl p-5 text-white flex flex-col justify-between overflow-hidden border border-white/20 shadow-2xl"
          style={{
            background: bgGradient,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Holographic & Light Specular Refractions */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
            style={{
              background:
                'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.45) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(255,255,255,0.2) 0%, transparent 40%)',
            }}
          />

          {/* Guilloche / Circuit Geometric Background Accents */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute right-14 -top-8 w-32 h-32 rounded-full bg-white/5 blur-xl pointer-events-none" />

          {/* Micro-shimmer shine effect bar */}
          <div className="absolute -inset-full top-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 group-hover/card:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

          {/* TOP ROW: Bank Info & Card Network / Badges */}
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-white/70 block leading-tight">
                  {card.bankName || 'BANK'}
                </span>
                <h4 className="text-sm font-bold tracking-tight text-white drop-shadow truncate max-w-[170px]">
                  {card.cardName || 'FinFlow Card'}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Type & Tier Pill */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-[9px] font-bold tracking-widest uppercase">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCredit ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{isCredit ? 'CREDIT' : 'DEBIT'}</span>
                </div>
                {tier !== 'STANDARD' && (
                  <span className="text-[8px] font-black tracking-widest text-amber-300 uppercase drop-shadow-sm">
                    ★ {tier}
                  </span>
                )}
              </div>

              {/* Network Logo */}
              <CardNetworkLogo network={card.cardNetwork || 'Visa'} size="md" />
            </div>
          </div>

          {/* MIDDLE ROW: EMV Chip, Contactless NFC & Quick Flip Indicator */}
          <div className="flex items-center justify-between relative z-10 my-auto">
            <div className="flex items-center gap-3">
              {/* Gold EMV Chip with realistic pins */}
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_2px_4px_rgba(0,0,0,0.3)] relative p-0.5 flex flex-col justify-between overflow-hidden">
                <div className="h-[2px] bg-amber-700/60 rounded-full w-full" />
                <div className="flex justify-between items-center px-1">
                  <div className="w-2.5 h-2.5 rounded-full border border-amber-700/60" />
                  <div className="w-2.5 h-2.5 rounded-full border border-amber-700/60" />
                </div>
                <div className="h-[2px] bg-amber-700/60 rounded-full w-full" />
              </div>

              {/* Contactless Waves */}
              <div className="flex items-center gap-0.5 text-white/80" title="Contactless Enabled">
                <Zap className="w-3.5 h-3.5 text-amber-300 drop-shadow-sm" />
                <span className="text-[10px] font-mono tracking-tighter opacity-80">)))</span>
              </div>
            </div>

            {/* Flip hint pill */}
            <button
              type="button"
              onClick={toggleFlip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-white/90 transition-all shadow-sm group/btn"
              title="Click to flip card and view CVV & back details"
            >
              <RotateCw className="w-3 h-3 text-white/80 group-hover/btn:rotate-180 transition-transform duration-500" />
              <span>Flip Card</span>
            </button>
          </div>

          {/* BOTTOM ROW: Card Number, Cardholder Name, Expiry & Copy */}
          <div className="relative z-10 space-y-2">
            {/* Card Number */}
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm md:text-base font-bold tracking-[0.22em] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {revealed
                  ? `4532 8920 1198 ${card.last4 || '4242'}`
                  : `•••• •••• •••• ${card.last4 || '4242'}`}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setRevealed(!revealed);
                  }}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-colors"
                  title={revealed ? 'Mask number' : 'Preview full number'}
                >
                  {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCardNumber}
                  className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-colors"
                  title="Copy card number"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Details: Name & Expiry / Due */}
            <div className="flex items-end justify-between pt-1 border-t border-white/10">
              <div className="max-w-[200px]">
                <span className="text-[8px] uppercase tracking-wider text-white/60 font-semibold block">
                  CARDHOLDER
                </span>
                <p className="text-xs font-bold text-white tracking-wider uppercase truncate drop-shadow-sm">
                  {cardholder}
                </p>
              </div>

              <div className="text-right">
                {isCredit ? (
                  <>
                    <span className="text-[8px] uppercase tracking-wider text-white/60 font-semibold block">
                      DUE DATE
                    </span>
                    <span className="text-xs font-bold font-mono text-white tracking-widest drop-shadow-sm">
                      {card.dueDateDay ? `${card.dueDateDay}th` : '20th'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[8px] uppercase tracking-wider text-white/60 font-semibold block">
                      VALID THRU
                    </span>
                    <span className="text-xs font-bold font-mono text-white tracking-widest drop-shadow-sm">
                      {card.expiryMmYy || '12/29'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BACK FACE                                                                  */}
        {/* ========================================================================= */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl text-white flex flex-col justify-between overflow-hidden border border-white/20 shadow-2xl"
          style={{
            background: bgGradient,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Top Header / Return Button */}
          <div className="pt-3 px-5 flex items-center justify-between text-xs text-white/80">
            <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Security & Verification</span>
            </div>
            <button
              type="button"
              onClick={toggleFlip}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-[10px] font-semibold transition-all"
            >
              <RotateCw className="w-3 h-3" />
              <span>Front</span>
            </button>
          </div>

          {/* Magnetic Stripe Band */}
          <div className="w-full h-10 bg-slate-950 my-1 relative shadow-inner overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 pointer-events-none" />
            <div className="w-full h-[1px] bg-white/10 mt-1" />
            <div className="w-full h-[1px] bg-white/10 mt-6" />
          </div>

          {/* Middle Security Zone: Hologram + Signature Panel + CVV */}
          <div className="px-5 space-y-2">
            <div className="flex items-center gap-3">
              {/* Hologram Foil Emblem */}
              <div className="w-10 h-8 rounded bg-gradient-to-tr from-slate-300 via-white to-amber-200 border border-white/60 shadow-sm flex items-center justify-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-400/30 via-cyan-400/30 to-amber-400/30 animate-pulse" />
                <Sparkles className="w-4 h-4 text-slate-800 relative z-10" />
              </div>

              {/* White Signature Strip with Security Hatch */}
              <div className="flex-1 h-8 rounded bg-slate-100 dark:bg-slate-200 flex items-center justify-between px-3 text-slate-800 font-mono text-xs border border-slate-300 shadow-inner relative overflow-hidden">
                {/* Diagonal lines texture pattern */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 6px)',
                  }}
                />
                <span className="font-serif italic text-xs tracking-wider text-slate-600 select-none relative z-10 truncate max-w-[140px]">
                  {cardholder}
                </span>

                {/* CVV Security Box */}
                <div className="flex items-center gap-1 relative z-10">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    CVV
                  </span>
                  <div className="px-2 py-0.5 rounded bg-white font-mono font-bold text-slate-900 border border-slate-400 text-xs shadow-sm flex items-center gap-1">
                    <span>{revealed ? pseudoCvv : '•••'}</span>
                    <button
                      type="button"
                      onClick={handleCopyCvv}
                      className="text-slate-400 hover:text-indigo-600 transition-colors ml-0.5"
                      title="Copy CVV"
                    >
                      {copiedCvv ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Helpline & Network Details */}
            <div className="flex items-center justify-between text-[10px] text-white/80 pt-1">
              <div className="flex items-center gap-1.5">
                <PhoneCall className="w-3 h-3 text-amber-300" />
                <span className="font-medium">
                  24x7 Helpline:{' '}
                  <strong className="text-white font-mono">
                    {card.lostCardContact || '1800 202 6161'}
                  </strong>
                </span>
              </div>
              <span className="font-bold tracking-widest text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10">
                {isCredit ? `Cycle: Day ${card.billingCycleDay || 1}` : 'ATM + POS SECURE'}
              </span>
            </div>
          </div>

          {/* Bottom Disclaimers & Secondary Badges */}
          <div className="px-5 pb-3 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] text-white/60 leading-tight">
            <p className="max-w-[240px]">
              Authorized signature required. This card is property of {card.bankName || 'the Bank'}. If found, please return to any branch.
            </p>
            <div className="flex items-center gap-1 text-[9px] font-black tracking-widest text-white/80 uppercase">
              <span>CIRRUS</span>
              <span>•</span>
              <span>PLUS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

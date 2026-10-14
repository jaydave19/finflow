import React from 'react';

interface CardNetworkLogoProps {
  network: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CardNetworkLogo({ network, className = '', size = 'md' }: CardNetworkLogoProps) {
  const norm = (network || 'visa').toLowerCase();

  const sizeClasses = {
    sm: 'h-4',
    md: 'h-6',
    lg: 'h-8',
  }[size];

  if (norm.includes('mastercard') || norm.includes('master')) {
    return (
      <div className={`inline-flex items-center gap-0 relative select-none ${className}`}>
        <svg
          viewBox="0 0 54 34"
          className={`${sizeClasses} w-auto drop-shadow-sm`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="17" cy="17" r="17" fill="#EB001B" />
          <circle cx="37" cy="17" r="17" fill="#F79E1B" fillOpacity="0.9" />
          <path
            d="M27 6.45a16.92 16.92 0 0 1 7 10.55A16.92 16.92 0 0 1 27 27.55a16.92 16.92 0 0 1-7-10.55A16.92 16.92 0 0 1 27 6.45z"
            fill="#FF5F00"
          />
        </svg>
      </div>
    );
  }

  if (norm.includes('rupay')) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-sm shadow-sm">
          <span className="font-black italic tracking-tighter text-[11px] text-slate-900 leading-none">
            RuPay
          </span>
          <div className="flex gap-0.5 items-center">
            <span className="w-1.5 h-2.5 bg-[#008D48] transform -skew-x-12 rounded-[1px]" />
            <span className="w-1.5 h-2.5 bg-[#F37021] transform -skew-x-12 rounded-[1px]" />
          </div>
        </div>
      </div>
    );
  }

  if (norm.includes('amex') || norm.includes('american express')) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <div className="px-2 py-0.5 rounded bg-[#006FCF] text-white font-black text-[10px] tracking-widest uppercase border border-white/40 shadow-sm">
          AMEX
        </div>
      </div>
    );
  }

  if (norm.includes('maestro')) {
    return (
      <div className={`inline-flex items-center gap-0 relative select-none ${className}`}>
        <svg
          viewBox="0 0 54 34"
          className={`${sizeClasses} w-auto drop-shadow-sm`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="17" cy="17" r="17" fill="#0061A8" />
          <circle cx="37" cy="17" r="17" fill="#EB001B" fillOpacity="0.9" />
          <path
            d="M27 6.45a16.92 16.92 0 0 1 7 10.55A16.92 16.92 0 0 1 27 27.55a16.92 16.92 0 0 1-7-10.55A16.92 16.92 0 0 1 27 6.45z"
            fill="#6C2A7B"
          />
        </svg>
      </div>
    );
  }

  // Default to Visa
  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <span className="font-black italic text-sm md:text-base tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] flex items-center">
        <span className="text-amber-400 mr-[1px]">/</span>VISA
      </span>
    </div>
  );
}

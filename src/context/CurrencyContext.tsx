import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  rateFromINR: number; // 1 INR in target currency
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)', rateFromINR: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar (USD)', rateFromINR: 0.012 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (EUR)', rateFromINR: 0.011 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', rateFromINR: 0.0095 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham (AED)', rateFromINR: 0.044 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)', rateFromINR: 1.82 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD)', rateFromINR: 0.016 },
  AUD: { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AUD)', rateFromINR: 0.018 },
};

interface CurrencyContextType {
  currentCurrency: string;
  currencyConfig: CurrencyConfig;
  setCurrency: (code: string) => void;
  formatAmount: (amountInINR: number, showDecimals?: boolean) => string;
  convertAmount: (amountInINR: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children, initialCurrency = 'INR' }: { children: React.ReactNode; initialCurrency?: string }) {
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    return localStorage.getItem('finflow_currency') || initialCurrency || 'INR';
  });

  const currencyConfig = CURRENCIES[currencyCode] || CURRENCIES.INR;

  const setCurrency = (code: string) => {
    if (CURRENCIES[code]) {
      setCurrencyCode(code);
      localStorage.setItem('finflow_currency', code);
    }
  };

  const convertAmount = (amountInINR: number): number => {
    return amountInINR * currencyConfig.rateFromINR;
  };

  const formatAmount = (amountInINR: number, showDecimals = false): string => {
    const converted = convertAmount(amountInINR);
    const maximumFractionDigits = showDecimals || (currencyConfig.code !== 'INR' && currencyConfig.code !== 'JPY') ? 2 : 0;

    try {
      const formatted = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0,
        maximumFractionDigits,
      }).format(converted);

      return `${currencyConfig.symbol}${formatted}`;
    } catch {
      return `${currencyConfig.symbol}${converted.toFixed(maximumFractionDigits)}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currentCurrency: currencyCode,
        currencyConfig,
        setCurrency,
        formatAmount,
        convertAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider');
  return context;
}

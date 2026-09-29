import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Plus,
  Sun,
  Moon,
  Landmark,
  Check,
  CheckCheck,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useCurrency, CURRENCIES } from '../../context/CurrencyContext.tsx';
import { api } from '../../api/client.ts';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  onOpenAddExpense: () => void;
  onOpenAddIPO: () => void;
  onOpenMobileMenu?: () => void;
}

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export function Header({ title = 'Dashboard', onOpenAddExpense, onOpenAddIPO, onOpenMobileMenu }: HeaderProps) {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { currentCurrency, setCurrency } = useCurrency();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setShowCurrencyMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (link) {
        setShowNotifications(false);
        navigate(link);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left Title & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick IPO Fund Action (Highlighted requested feature!) */}
        <button
          onClick={onOpenAddIPO}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/80 transition-all"
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Apply IPO / Share</span>
        </button>

        {/* Primary Add Expense Action */}
        <button
          onClick={onOpenAddExpense}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Expense</span>
        </button>

        {/* Currency Selector Dropdown */}
        <div className="relative" ref={currencyRef}>
          <button
            onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <span>{CURRENCIES[currentCurrency]?.symbol}</span>
            <span className="hidden sm:inline">{currentCurrency}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showCurrencyMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Select Currency
              </div>
              {Object.values(CURRENCIES).map(curr => (
                <button
                  key={curr.code}
                  onClick={() => {
                    setCurrency(curr.code);
                    setShowCurrencyMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                    currentCurrency === curr.code
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-center font-bold">{curr.symbol}</span>
                    <span>{curr.name}</span>
                  </span>
                  {currentCurrency === curr.code && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications right now.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id, n.link)}
                      className={`p-3 text-xs cursor-pointer transition-colors ${
                        n.isRead
                          ? 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          : 'bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-800 dark:text-slate-200 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                      }`}
                    >
                      <p className="leading-snug">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {new Date(n.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

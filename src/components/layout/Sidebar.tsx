import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Wallet,
  Tags,
  PiggyBank,
  BarChart3,
  CalendarClock,
  Settings,
  LogOut,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: Receipt },
    {
      name: 'Stock & IPOs',
      path: '/ipo',
      icon: Landmark,
      badge: 'Blocked Funds',
      highlight: true,
    },
    { name: 'Income', path: '/income', icon: Wallet },
    { name: 'Budgets', path: '/budgets', icon: PiggyBank },
    { name: 'Categories', path: '/categories', icon: Tags },
    { name: 'Monthly Reports', path: '/reports', icon: BarChart3 },
    { name: 'Recurring & Bills', path: '/recurring', icon: CalendarClock },
    { name: 'Profile & Settings', path: '/profile', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <TrendingUp className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">FinFlow</span>
          <span className="text-[10px] block font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Postgres Edition
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=4f46e5&color=fff`
              }
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-indigo-500/20"
            />
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

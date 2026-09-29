import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  PiggyBank,
  BarChart3,
} from 'lucide-react';

export function MobileNav() {
  const items = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'History', path: '/transactions', icon: Receipt },
    { name: 'IPO Block', path: '/ipo', icon: Landmark, badge: 'IPO' },
    { name: 'Budgets', path: '/budgets', icon: PiggyBank },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 flex items-center justify-around px-2">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`
            }
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-indigo-500 ring-1 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span className="mt-1">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

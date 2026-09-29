import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { MobileNav } from './MobileNav.tsx';
import { ExpenseModal } from '../expenses/ExpenseModal.tsx';
import { X } from 'lucide-react';

export function Layout() {
  const location = useLocation();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isIpoModalOpen, setIsIpoModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Map pathname to header title
  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard Overview';
    if (path.startsWith('/transactions')) return 'All Transactions';
    if (path.startsWith('/ipo')) return 'Stock Market & IPO Blocked Capital';
    if (path.startsWith('/income')) return 'Income & Earnings';
    if (path.startsWith('/categories')) return 'Categories & Budgets';
    if (path.startsWith('/budgets')) return 'Monthly Budget Tracking';
    if (path.startsWith('/reports')) return 'Monthly Financial Reports';
    if (path.startsWith('/recurring')) return 'Recurring Bills & Subscriptions';
    if (path.startsWith('/profile')) return 'Profile & System Settings';
    return 'Expense Tracker';
  };

  const refreshCurrentView = () => {
    window.dispatchEvent(new CustomEvent('finflow:refresh-data'));
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80%] h-full bg-white dark:bg-slate-900 shadow-2xl z-10">
            <Sidebar onCloseMobile={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          title={getPageTitle(location.pathname)}
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
          onOpenAddIPO={() => setIsIpoModalOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 md:pb-8">
          <Outlet />
        </main>

        <MobileNav />
      </div>

      {/* Global Add Regular Expense Modal */}
      <ExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={refreshCurrentView}
        defaultIsIpo={false}
      />

      {/* Global Specialized Add IPO/Stock Modal (Requested Feature) */}
      <ExpenseModal
        isOpen={isIpoModalOpen}
        onClose={() => setIsIpoModalOpen(false)}
        onSuccess={refreshCurrentView}
        defaultIsIpo={true}
      />
    </div>
  );
}

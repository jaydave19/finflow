import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { CurrencyProvider } from './context/CurrencyContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';

import { Layout } from './components/layout/Layout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Transactions } from './pages/Transactions.tsx';
import { IPOTracker } from './pages/IPOTracker.tsx';
import { IncomePage } from './pages/IncomePage.tsx';
import { CategoriesPage } from './pages/CategoriesPage.tsx';
import { BudgetsPage } from './pages/BudgetsPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { RecurringPage } from './pages/RecurringPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LedgerPage } from './pages/LedgerPage.tsx';
import { LoansPage } from './pages/LoansPage.tsx';
import { BankStatementsPage } from './pages/BankStatementsPage.tsx';
import { InvestmentsPage } from './pages/InvestmentsPage.tsx';
import { CreditCardsPage } from './pages/CreditCardsPage.tsx';
import { DebitCardsPage } from './pages/DebitCardsPage.tsx';

import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading FinFlow...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Auth Routes */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <RegisterPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicRoute>
                      <ForgotPasswordPage />
                    </PublicRoute>
                  }
                />

                {/* Protected Application Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="cards" element={<CreditCardsPage />} />
                  <Route path="debit-cards" element={<DebitCardsPage />} />
                  <Route path="ipo" element={<IPOTracker />} />
                  <Route path="income" element={<IncomePage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="budgets" element={<BudgetsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="recurring" element={<RecurringPage />} />
                  <Route path="ledger" element={<LedgerPage />} />
                  <Route path="loans" element={<LoansPage />} />
                  <Route path="investments" element={<InvestmentsPage />} />
                  <Route path="statements" element={<BankStatementsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

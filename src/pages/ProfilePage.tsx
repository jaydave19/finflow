import React, { useState } from 'react';
import {
  User,
  Shield,
  Key,
  Database,
  Download,
  Upload,
  Trash2,
  Check,
  Sun,
  Moon,
  Coins,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { api } from '../api/client.ts';
import { useNavigate } from 'react-router-dom';

export function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { currentCurrency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Profile Edit
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Backup & Restore
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [loadingImport, setLoadingImport] = useState(false);

  // Delete Account
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loadingDelete, setLoadingDelete] = useState(false);

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  ];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      const res = await api.put('/user/profile', { name, avatar });
      updateUser(res.user);
      showToast({ type: 'success', message: 'Profile details saved.' });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      showToast({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    setLoadingPassword(true);
    try {
      await api.put('/user/profile', { currentPassword, newPassword });
      showToast({ type: 'success', message: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to change password.' });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.get('/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finflow_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Full data backup exported!' });
    } catch {
      showToast({ type: 'error', message: 'Failed to export backup.' });
    }
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile) {
      showToast({ type: 'error', message: 'Please select a backup JSON file.' });
      return;
    }

    setLoadingImport(true);
    try {
      const text = await backupFile.text();
      const parsedData = JSON.parse(text);

      const res = await api.post('/backup/import', {
        data: parsedData,
        mode: importMode,
      });

      showToast({ type: 'success', message: res.message || 'Data restored successfully!' });
      setBackupFile(null);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Invalid backup JSON file.' });
    } finally {
      setLoadingImport(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showToast({ type: 'error', message: 'Type DELETE to confirm.' });
      return;
    }

    setLoadingDelete(true);
    try {
      await api.delete('/user', { confirmation: 'DELETE' });
      await logout();
      navigate('/login');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to delete account.' });
      setLoadingDelete(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Profile & Preferences</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your identity, currency, theme, data backup & restore, and account security.
        </p>
      </div>

      {/* User Info Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Personal Profile
        </h3>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={
                avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4f46e5&color=fff`
              }
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover ring-4 ring-indigo-500/20"
            />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Choose an Avatar Preset</p>
              <div className="flex items-center gap-2">
                {AVATAR_PRESETS.map((p, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setAvatar(p)}
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform ${
                      avatar === p ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                  >
                    <img src={p} alt="Preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address (Account ID)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingProfile}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
          >
            {loadingProfile ? 'Saving...' : 'Update Details'}
          </button>
        </form>
      </div>

      {/* App Preferences: Currency & Theme */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          Currency & Display Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Primary Currency
            </label>
            <select
              value={currentCurrency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            >
              {Object.values(CURRENCIES).map(c => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['system', 'light', 'dark'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`py-2 text-xs font-semibold rounded-xl border capitalize ${
                    theme === t
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-600" />
          Security & Password
        </h3>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingPassword}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white shadow-sm"
          >
            {loadingPassword ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Data Backup & Restore Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          Full Data Backup & Restore
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Export your entire account state (expenses, incomes, categories, budgets, notifications) as one clean JSON file, or restore from a previous backup.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Export */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Download JSON Backup</span>
            <p className="text-xs text-slate-500">Safely backup all your records to your local machine.</p>
            <button
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Data JSON
            </button>
          </div>

          {/* Import */}
          <form
            onSubmit={handleImportBackup}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3"
          >
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Restore from Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={e => setBackupFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
            />
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                />
                Merge
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                Replace All
              </label>
            </div>
            <button
              type="submit"
              disabled={loadingImport || !backupFile}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-40"
            >
              <Upload className="w-3.5 h-3.5" /> {loadingImport ? 'Restoring...' : 'Import Backup'}
            </button>
          </form>
        </div>
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="p-6 rounded-3xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone: Delete Account
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Permanently delete your account and all associated transactions, budgets, and categories. This action cannot be reversed.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Type DELETE to confirm"
            value={deleteConfirmation}
            onChange={e => setDeleteConfirmation(e.target.value)}
            className="w-full sm:w-60 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl"
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirmation !== 'DELETE' || loadingDelete}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-30 shadow-sm transition-colors whitespace-nowrap"
          >
            {loadingDelete ? 'Deleting...' : 'Permanently Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

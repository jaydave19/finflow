import React, { useState } from 'react';
import { FileText, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api/client.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useCurrency } from '../context/CurrencyContext.tsx';

export function BankStatementsPage() {
  const { showToast } = useToast();
  const { formatAmount } = useCurrency();

  const [bankName, setBankName] = useState('HDFC Bank');
  const [period, setPeriod] = useState('Monthly');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; totalAmount: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast({ type: 'error', message: 'Please select a CSV file to upload.' });
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('bankName', bankName);
    formData.append('period', period);
    formData.append('file', file);

    try {
      // Direct fetch call because the api.ts client might not support multipart/form-data well without custom headers
      const token = localStorage.getItem('finflow_token');
      const response = await fetch('http://localhost:8000/api/statements/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      setResult({ importedCount: data.importedCount, totalAmount: data.totalAmount });
      showToast({ type: 'success', message: data.message });
      setFile(null);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to process statement.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Bank Statements
          </h2>
          <p className="text-teal-100 mt-2">Upload your bank CSV statements to auto-sync expenses</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold">Upload New Statement</h3>
        </div>
        
        <form onSubmit={handleUpload} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Bank Name</label>
              <select value={bankName} onChange={e=>setBankName(e.target.value)} className="w-full border rounded-xl px-4 py-3 dark:bg-slate-800 dark:border-slate-700 font-semibold">
                <option value="HDFC Bank">HDFC Bank</option>
                <option value="ICICI Bank">ICICI Bank</option>
                <option value="SBI">SBI</option>
                <option value="Axis Bank">Axis Bank</option>
                <option value="Other">Other Bank</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Statement Period</label>
              <select value={period} onChange={e=>setPeriod(e.target.value)} className="w-full border rounded-xl px-4 py-3 dark:bg-slate-800 dark:border-slate-700 font-semibold">
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <UploadCloud className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {file ? file.name : "Click or drag your CSV file here"}
            </p>
            <p className="text-xs text-slate-500 mb-4">Ensure your CSV has Date, Description, and Amount columns.</p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-slate-800 dark:file:text-slate-300"
            />
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={loading || !file}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/30"
            >
              {loading ? 'Processing...' : 'Upload & Sync Expenses'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 flex gap-4 items-start animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Sync Complete!</h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
              Successfully imported <strong>{result.importedCount}</strong> expenses from your statement.
            </p>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mt-2">
              Total Amount Tracked: {formatAmount(result.totalAmount)}
            </p>
            <p className="text-xs text-emerald-600 mt-4">
              These expenses have been added to your transactions list under the "Other" category and marked with a 'bank_statement' tag.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

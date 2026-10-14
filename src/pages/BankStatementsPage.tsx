import React, { useState, useEffect } from 'react';
import { FileText, UploadCloud, CheckCircle, AlertCircle, ArrowRight, Trash2, Edit2, Link } from 'lucide-react';
import { api } from '../api/client.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useCurrency } from '../context/CurrencyContext.tsx';

interface ParsedRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string;
  categoryName: string;
  isDuplicate: boolean;
  suggestedLink: string | null;
}

interface UploadHistory {
  id: string;
  bankName: string;
  period: string;
  fileName: string;
  savedCount: number;
  date: string;
}

export function BankStatementsPage() {
  const { showToast } = useToast();
  const { formatAmount } = useCurrency();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [bankName, setBankName] = useState('HDFC Bank');
  const [period, setPeriod] = useState('Monthly (Current)');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [history, setHistory] = useState<UploadHistory[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/statements/history');
      setHistory(res || []);
    } catch {
      // ignore
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast({ type: 'error', message: 'Please select a CSV file.' });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('bankName', bankName);
    formData.append('period', period);
    formData.append('file', file);

    try {
      const token = localStorage.getItem('finflow_token');
      const response = await fetch('http://localhost:8000/api/statements/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');

      setUploadId(data.uploadId);
      setParsedRows(data.transactions);
      setStep(2);
      showToast({ type: 'success', message: 'Statement parsed successfully. Please review.' });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to process statement.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      await api.post('/statements/save', {
        uploadId: uploadId,
        transactions: parsedRows
      });
      setStep(3);
      fetchHistory();
      showToast({ type: 'success', message: 'Transactions saved successfully!' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to save transactions.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Are you sure? This will delete the upload and all associated expenses.")) return;
    try {
      await api.delete(`/statements/history/${id}`);
      showToast({ type: 'success', message: 'History deleted.' });
      fetchHistory();
    } catch {
      showToast({ type: 'error', message: 'Failed to delete history.' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-700 to-purple-600 text-white shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Statement Analyzer & Import
          </h2>
          <p className="text-indigo-100 mt-2">Upload, auto-categorize, and analyze your bank statements seamlessly</p>
        </div>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold">1. Upload Statement</h3>
              </div>
              
              <form onSubmit={handleParse} className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Select Bank / Account</label>
                    <select value={bankName} onChange={e=>setBankName(e.target.value)} className="w-full border rounded-xl px-4 py-3 dark:bg-slate-800 dark:border-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500">
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                      <option>SBI</option>
                      <option>Axis Bank</option>
                      <option>Kotak Mahindra</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Statement Period</label>
                    <input type="text" value={period} onChange={e=>setPeriod(e.target.value)} className="w-full border rounded-xl px-4 py-3 dark:bg-slate-800 dark:border-slate-700 font-semibold" placeholder="e.g. October 2023" />
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <UploadCloud className="w-12 h-12 mx-auto text-indigo-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {file ? file.name : "Click or drag your CSV file here"}
                  </p>
                  <p className="text-xs text-slate-500 mb-4">PDF parsing coming soon. For now, please upload a CSV export.</p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange}
                    className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-slate-300 cursor-pointer"
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    disabled={loading || !file}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/30"
                  >
                    {loading ? 'Analyzing...' : 'Parse & Analyze Statement'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold">Recent Uploads</h3>
              </div>
              <div className="p-2">
                {history.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">No past uploads found.</p>
                ) : (
                  history.map(h => (
                    <div key={h.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl flex items-center justify-between group">
                      <div>
                        <p className="text-sm font-bold">{h.bankName}</p>
                        <p className="text-xs text-slate-500">{h.period} • {h.savedCount} txns</p>
                      </div>
                      <button onClick={() => handleDeleteHistory(h.id)} className="p-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">2. Review Transactions</h3>
                <p className="text-sm text-slate-500 mt-1">We parsed {parsedRows.length} transactions. Please review and categorize them before saving.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-xl">Cancel</button>
                <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2">
                  {loading ? 'Saving...' : 'Confirm & Save All'} <CheckCircle className="w-4 h-4"/>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="p-4 w-32">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Auto-Category</th>
                    <th className="p-4">Suggestions</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((row) => (
                    <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${row.isDuplicate ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{row.date}</td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={row.description}>{row.description}</p>
                        {row.isDuplicate && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-bold mt-1">
                            <AlertCircle className="w-3 h-3"/> Possible Duplicate
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 dark:text-white">{formatAmount(row.amount)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-indigo-600 cursor-pointer hover:underline">
                        {row.categoryName}
                      </td>
                      <td className="p-4">
                        {row.suggestedLink && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">
                            <Link className="w-3 h-3"/> Link to {row.suggestedLink}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleRemoveRow(row.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-10 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-3xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">Sync Complete!</h3>
          <p className="text-emerald-700 dark:text-emerald-300 max-w-md mx-auto mb-8">
            Successfully imported and categorized your bank statement transactions. They are now reflecting in your dashboard.
          </p>
          <div className="flex justify-center gap-4">
            <button onClick={() => { setStep(1); setFile(null); setUploadId(null); setParsedRows([]); }} className="px-6 py-3 font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl">
              Upload Another
            </button>
            <button onClick={() => window.location.href = '/'} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30">
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

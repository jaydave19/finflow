import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart2,
  Receipt,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { api } from '../api/client.ts';
import { useCurrency } from '../context/CurrencyContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function ReportsPage() {
  const { formatAmount, currentCurrency } = useCurrency();
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/reports/monthly?month=${month}&year=${year}`);
      setReport(data);
    } catch {
      showToast({ type: 'error', message: 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  }, [month, year, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryRows = [
        ['Metric', 'Value'],
        ['Month / Year', `${month} / ${year}`],
        ['Total Income', report?.summary?.totalIncome || 0],
        ['Total Expenses', report?.summary?.totalExpense || 0],
        ['Net Savings', report?.summary?.netSavings || 0],
        ['Savings Rate %', `${report?.summary?.savingsRate || 0}%`],
        ['Total Transactions', report?.summary?.transactionCount || 0],
        ['IPO Capital Blocked', report?.summary?.totalIpoBlocked || 0],
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Category breakdown sheet
      const catRows = (report?.categoryBreakdown || []).map((c: any) => ({
        Category: c.name,
        Amount: c.amount,
        Percentage: `${c.percentage}%`,
        'Transaction Count': c.count,
      }));
      const catWs = XLSX.utils.json_to_sheet(catRows);
      XLSX.utils.book_append_sheet(wb, catWs, 'Category Breakdown');

      // Top expenses sheet
      const topRows = (report?.top5Expenses || []).map((e: any) => ({
        Date: e.date,
        Category: e.categoryName,
        Amount: e.amount,
        'Payment Method': e.paymentMethod,
        Note: e.note,
      }));
      const topWs = XLSX.utils.json_to_sheet(topRows);
      XLSX.utils.book_append_sheet(wb, topWs, 'Top Expenses');

      XLSX.writeFile(wb, `FinFlow_Financial_Report_${year}_${month}.xlsx`);
      showToast({ type: 'success', message: 'Excel report downloaded!' });
    } catch {
      showToast({ type: 'error', message: 'Failed to export Excel report.' });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    window.location.href = `/api/reports/export?format=csv&month=${month}&year=${year}`;
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

      // Title & Header
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('FinFlow Financial Report', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Statement Period: ${monthName} ${year} | Currency: ${currentCurrency}`, 14, 27);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);

      // Summary Table
      const summaryData = [
        ['Total Income', formatAmount(report?.summary?.totalIncome || 0)],
        ['Total Expenses', formatAmount(report?.summary?.totalExpense || 0)],
        ['Net Savings', formatAmount(report?.summary?.netSavings || 0)],
        ['Savings Rate', `${report?.summary?.savingsRate || 0}%`],
        ['Average Daily Spend', formatAmount(report?.summary?.averageDailySpend || 0)],
        ['IPO Capital Blocked (ASBA)', formatAmount(report?.summary?.totalIpoBlocked || 0)],
      ];

      autoTable(doc, {
        startY: 38,
        head: [['Summary KPI', 'Amount']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
      });

      // Category Breakdown Table
      const catData = (report?.categoryBreakdown || []).map((c: any) => [
        c.name,
        formatAmount(c.amount),
        `${c.percentage}%`,
        c.count,
      ]);

      const lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Category-Wise Breakdown', 14, lastY);

      autoTable(doc, {
        startY: lastY + 4,
        head: [['Category', 'Amount', '% of Total', 'Transactions']],
        body: catData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 },
      });

      // Top 5 Expenses
      const topLastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Top 5 Highest Expenses', 14, topLastY);

      const topData = (report?.top5Expenses || []).map((e: any) => [
        e.date,
        e.categoryName,
        formatAmount(e.amount),
        e.paymentMethod,
        e.note || '-',
      ]);

      autoTable(doc, {
        startY: topLastY + 4,
        head: [['Date', 'Category', 'Amount', 'Payment Method', 'Note']],
        body: topData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
      });

      doc.save(`FinFlow_Monthly_Report_${year}_${month}.pdf`);
      showToast({ type: 'success', message: 'PDF report generated and downloaded!' });
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', message: 'Failed to generate PDF report.' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = report?.summary || {};

  return (
    <div className="space-y-6 print:p-0" ref={reportRef}>
      {/* Top Header and Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Monthly Financial Report</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit trends, analyze category distributions, and download formal statements.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Month/Year selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl">
            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={month}
              onChange={e => setMonth(parseInt(e.target.value, 10))}
              className="text-xs font-semibold bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value, 10))}
              className="text-xs font-semibold bg-transparent border-0 text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Print View"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Income</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            +{formatAmount(summary.totalIncome || 0)}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Expenses</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            -{formatAmount(summary.totalExpense || 0)}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Net Savings</span>
          <p className={`text-2xl font-bold mt-2 ${summary.netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
            {formatAmount(summary.netSavings || 0)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            Savings Rate: {summary.savingsRate || 0}%
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">IPO Blocked Capital</span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {formatAmount(summary.totalIpoBlocked || 0)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            {summary.activeIpoCount || 0} active IPO mandates
          </span>
        </div>
      </div>

      {/* Highest & Lowest Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {report?.highestCategory && (
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Highest Expense Category</span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {report.highestCategory.name} ({formatAmount(report.highestCategory.amount)})
              </p>
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-100 dark:bg-rose-900 px-2 py-1 rounded-lg">
              {report.highestCategory.percentage}% of total
            </span>
          </div>
        )}

        {report?.lowestCategory && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Lowest Expense Category</span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {report.lowestCategory.name} ({formatAmount(report.lowestCategory.amount)})
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900 px-2 py-1 rounded-lg">
              {report.lowestCategory.percentage}% of total
            </span>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Bar Chart (Sorted highest to lowest) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Category Spending (Highest to Lowest)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Ranked breakdown</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report?.categoryBreakdown || []} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={v => `₹${v}`} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                <Tooltip
                  formatter={(val: any) => [formatAmount(val), 'Amount']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6-Month Income vs Expense Trend */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Past 6-Months Trend
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Income vs Expenses vs Savings</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report?.monthlyTrends || []}>
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  formatter={(val: any) => [formatAmount(val), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Methods and Day of Week Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Spending by Payment Method</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">UPI, Cards, Cash & Banking</p>

          <div className="space-y-3">
            {report?.paymentMethods?.map((pm: any) => (
              <div key={pm.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{pm.method}</span>
                  <span className="text-slate-500">
                    {formatAmount(pm.amount)} ({pm.percentage}%) • {pm.count} txns
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${pm.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Day of Week Pattern */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Day-of-Week Spending Pattern</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Identify weekend vs weekday habits</p>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report?.dayOfWeekSpending || []}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  formatter={(val: any) => [formatAmount(val), 'Spent']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category-Wise Breakdown Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-6">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">% of Total</th>
                <th className="py-3 px-4">Transaction Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {report?.categoryBreakdown?.map((cat: any) => (
                <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-6 font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{formatAmount(cat.amount)}</td>
                  <td className="py-3 px-4 font-medium">{cat.percentage}%</td>
                  <td className="py-3 px-4 text-slate-500">{cat.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 Expenses Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 5 Highest Expenses</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {report?.top5Expenses?.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-6 font-medium">{exp.date}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{exp.categoryName}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{exp.note || '-'}</td>
                  <td className="py-3 px-4 text-slate-500">{exp.paymentMethod}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                    -{formatAmount(exp.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

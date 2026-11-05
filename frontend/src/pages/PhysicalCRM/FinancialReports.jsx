import React, { useState, useEffect, useRef } from 'react';
import { physicalFinanceService } from '../../api/physicalFinance';
import { 
  FileText, Download, Printer, Calendar, TrendingUp, TrendingDown, 
  Wallet, GraduationCap, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownRight,
  Layers, CheckCircle2, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';

export default function FinancialReports() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    summary: {
      totalIncome: 0,
      totalExpense: 0,
      netCash: 0,
      registrationFeesTotal: 0,
      registrationCount: 0,
      transactionCount: 0
    },
    incomeCategories: [],
    expenseCategories: [],
    dailyTimeline: [],
    transactions: []
  });

  // Filter States
  const [dateRangePreset, setDateRangePreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [categories, setCategories] = useState([]);
  
  // Table search & active tab
  const [tableSearch, setTableSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, INCOME, EXPENSE, REGISTRATION

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, typeFilter, categoryFilter]);

  const fetchCategories = async () => {
    try {
      const data = await physicalFinanceService.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load categories', e);
      setCategories([]);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await physicalFinanceService.getReports({
        startDate,
        endDate,
        type: typeFilter,
        category: categoryFilter
      });
      setReportData(data || {
        summary: { totalIncome: 0, totalExpense: 0, netCash: 0, registrationFeesTotal: 0, registrationCount: 0, transactionCount: 0 },
        incomeCategories: [],
        expenseCategories: [],
        dailyTimeline: [],
        transactions: []
      });
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Preset Date Handlers
  const handlePresetChange = (preset) => {
    setDateRangePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'yesterday':
        const yest = subDays(today, 1);
        setStartDate(format(yest, 'yyyy-MM-dd'));
        setEndDate(format(yest, 'yyyy-MM-dd'));
        break;
      case 'thisWeek':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'thisMonth':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lastMonthDate = subMonths(today, 1);
        setStartDate(format(startOfMonth(lastMonthDate), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonthDate), 'yyyy-MM-dd'));
        break;
      case 'thisYear':
        setStartDate(format(startOfYear(today), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'custom':
        // Keep current custom start and end dates
        break;
      default:
        break;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportData.transactions || reportData.transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Description', 'Student ID', 'Student Name', 'Student Phone', 'Amount (LKR)'];
    const rows = reportData.transactions.map(t => [
      t.date ? format(new Date(t.date), 'yyyy-MM-dd HH:mm') : '',
      t.type,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.student?.studentId || '',
      `"${(t.student ? (t.student.studentName || `${t.student.firstName || ''} ${t.student.lastName || ''}`.trim()) : '').replace(/"/g, '""')}"`,
      t.student?.phone || '',
      t.amount
    ]);

    // Add summary row at the end
    rows.push([]);
    rows.push(['SUMMARY FOR PERIOD:', `${startDate} to ${endDate}`]);
    rows.push(['Total Income', '', '', '', '', '', '', reportData.summary.totalIncome]);
    rows.push(['Total Expenses', '', '', '', '', '', '', reportData.summary.totalExpense]);
    rows.push(['Net Cash Flow', '', '', '', '', '', '', reportData.summary.netCash]);
    rows.push(['Registration Revenue', '', '', '', '', '', '', reportData.summary.registrationFeesTotal]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IMA_Campus_Financial_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Report downloaded as CSV!');
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  // Filtered transactions for table
  const filteredTransactions = (reportData.transactions || []).filter(t => {
    if (activeTab === 'INCOME' && t.type !== 'INCOME') return false;
    if (activeTab === 'EXPENSE' && t.type !== 'EXPENSE') return false;
    if (activeTab === 'REGISTRATION' && !(t.category || '').toUpperCase().includes('REGISTRATION')) return false;

    if (!tableSearch) return true;
    const query = tableSearch.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const sId = (t.student?.studentId || '').toLowerCase();
    const sName = (t.student ? (t.student.studentName || `${t.student.firstName || ''} ${t.student.lastName || ''}`.trim()) : '').toLowerCase();

    return desc.includes(query) || cat.includes(query) || sId.includes(query) || sName.includes(query);
  });

  const { summary, incomeCategories, expenseCategories } = reportData;

  return (
    <div className="space-y-6 w-full min-h-full pb-14 animate-in fade-in duration-500 text-white">
      
      {/* HEADER CONTROLS */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-rose-500/20 to-blue-500/20 border border-rose-500/30 rounded-2xl shadow-lg">
              <FileText className="text-rose-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                Financial Reports & Analytics
              </h1>
              <p className="text-white/60 text-xs mt-0.5">Comprehensive income, expense, and student registration fee reports with custom date ranges.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-stretch xl:self-auto">
          <button 
            onClick={fetchReport}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl border border-white/10 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
            title="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Download size={15} /> Export CSV / Excel
          </button>

          <button 
            onClick={handlePrint}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-black/30 backdrop-blur-xl border border-white/15 p-5 rounded-3xl shadow-lg space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'thisWeek', label: 'This Week' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'lastMonth', label: 'Last Month' },
              { id: 'thisYear', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dateRangePreset === preset.id ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Picker Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs">
              <span className="text-white/50 font-bold uppercase text-[10px]">From:</span>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDateRangePreset('custom'); }}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              />
            </div>
            <span className="text-white/40 font-bold">-</span>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs">
              <span className="text-white/50 font-bold uppercase text-[10px]">To:</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDateRangePreset('custom'); }}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/50 font-bold uppercase text-[10px] flex items-center gap-1">
              <Filter size={11} /> Type:
            </span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold text-xs outline-none"
            >
              <option value="ALL" className="text-black">All (Income & Expense)</option>
              <option value="INCOME" className="text-black">Income Only</option>
              <option value="EXPENSE" className="text-black">Expenses Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/50 font-bold uppercase text-[10px]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold text-xs outline-none"
            >
              <option value="ALL" className="text-black">All Categories</option>
              {(Array.isArray(categories) ? categories : []).map(c => (
                <option key={c.id} value={c.name} className="text-black">{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-[11px] text-white/40 italic">
            Showing results from <strong>{startDate}</strong> to <strong>{endDate}</strong>
          </span>
        </div>
      </div>

      {/* PRINT HEADER ONLY (Visible in print) */}
      <div className="hidden print:block text-black mb-6">
        <h1 className="text-2xl font-black">IMA CAMPUS - PHYSICAL CRM FINANCIAL STATEMENT</h1>
        <p className="text-sm text-gray-600">Reporting Period: {startDate} to {endDate}</p>
        <p className="text-xs text-gray-500">Generated on {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
      </div>

      {/* EXECUTIVE FINANCIAL SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Income */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl relative overflow-hidden shadow-[0_8px_30px_rgba(16,185,129,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={15} /> Total Income
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              +{reportData.transactions.filter(t => t.type === 'INCOME').length} Txns
            </span>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-md mt-1">
            Rs. {summary.totalIncome.toLocaleString()}
          </h3>
          <div className="text-[11px] text-emerald-300/70 mt-3 flex items-center gap-1">
            <ArrowUpRight size={13} className="text-emerald-400" /> Revenue generated in period
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown size={15} /> Total Expenses
            </span>
            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">
              -{reportData.transactions.filter(t => t.type === 'EXPENSE').length} Txns
            </span>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-md mt-1">
            Rs. {summary.totalExpense.toLocaleString()}
          </h3>
          <div className="text-[11px] text-red-300/70 mt-3 flex items-center gap-1">
            <ArrowDownRight size={13} className="text-red-400" /> Operational expenditure
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className={`p-6 rounded-3xl relative overflow-hidden shadow-xl flex flex-col justify-between border ${summary.netCash >= 0 ? 'bg-gradient-to-br from-blue-600/90 to-indigo-700/90 border-blue-400/50' : 'bg-gradient-to-br from-rose-700/90 to-red-900/90 border-rose-400/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={15} /> Net Cash Flow
            </span>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-extrabold uppercase">
              {summary.netCash >= 0 ? 'Profit' : 'Deficit'}
            </span>
          </div>
          <h3 className="text-4xl font-black text-white tracking-tight drop-shadow-lg mt-1">
            Rs. {summary.netCash.toLocaleString()}
          </h3>
          <div className="text-[11px] text-white/70 mt-3">
            Income minus operational expenses
          </div>
        </div>

        {/* Student Registration Revenue */}
        <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/20 border border-purple-500/30 p-6 rounded-3xl relative overflow-hidden shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={16} /> Reg. Fee Revenue
            </span>
            <span className="text-[10px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full font-bold">
              {summary.registrationCount} Students
            </span>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-md mt-1">
            Rs. {summary.registrationFeesTotal.toLocaleString()}
          </h3>
          <div className="text-[11px] text-purple-200/70 mt-3 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-purple-400" /> Student portal collections
          </div>
        </div>

      </div>

      {/* CATEGORY BREAKDOWNS (INCOME VS EXPENSES) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Income by Category */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <TrendingUp size={18} /> Income Breakdown by Category
            </h3>
            <span className="text-xs font-extrabold text-white">Rs. {summary.totalIncome.toLocaleString()}</span>
          </div>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {incomeCategories.map((cat, idx) => (
              <div key={idx} className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white/90 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {cat.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-[10px]">({cat.count} txns)</span>
                    <span className="font-black text-emerald-400 text-sm">Rs. {cat.total.toLocaleString()}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                  ></div>
                </div>
                <div className="flex justify-end text-[10px] text-white/40 font-semibold">
                  {cat.percentage}% of total income
                </div>
              </div>
            ))}

            {incomeCategories.length === 0 && (
              <div className="text-center py-10 text-white/40 text-xs italic">
                No income transactions recorded for this period.
              </div>
            )}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
              <TrendingDown size={18} /> Expense Breakdown by Category
            </h3>
            <span className="text-xs font-extrabold text-white">Rs. {summary.totalExpense.toLocaleString()}</span>
          </div>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {expenseCategories.map((cat, idx) => (
              <div key={idx} className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white/90 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span> {cat.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-[10px]">({cat.count} txns)</span>
                    <span className="font-black text-red-400 text-sm">Rs. {cat.total.toLocaleString()}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-red-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                  ></div>
                </div>
                <div className="flex justify-end text-[10px] text-white/40 font-semibold">
                  {cat.percentage}% of total expenses
                </div>
              </div>
            ))}

            {expenseCategories.length === 0 && (
              <div className="text-center py-10 text-white/40 text-xs italic">
                No expense transactions recorded for this period.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ITEMIZED TRANSACTIONS TABLE */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-xl overflow-hidden flex flex-col">
        
        {/* Table Header & Tabs */}
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold mr-2">Itemized Records</span>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              {[
                { id: 'ALL', label: 'All Transactions' },
                { id: 'INCOME', label: 'Income' },
                { id: 'EXPENSE', label: 'Expenses' },
                { id: 'REGISTRATION', label: 'Registrations' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search description, student, ID..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto custom-scrollbar p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 text-white/40 text-sm font-semibold">
              No matching records found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-[11px] uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Date & Time</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Description / Notes</th>
                  <th className="pb-3 font-semibold">Student Reference</th>
                  <th className="pb-3 font-semibold text-right">Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3.5 text-white/70 font-medium whitespace-nowrap">
                      {t.date ? format(new Date(t.date), 'yyyy-MM-dd HH:mm') : '-'}
                    </td>
                    <td className="py-3.5">
                      {t.type === 'INCOME' ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/20">INCOME</span>
                      ) : (
                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/20">EXPENSE</span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span className="font-bold text-white/80 bg-white/5 px-2 py-0.5 rounded text-[11px] border border-white/10">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3.5 max-w-xs font-medium text-white/90">
                      {t.description || '-'}
                    </td>
                    <td className="py-3.5">
                      {t.student ? (
                        <div>
                          <span className="text-blue-400 font-bold block">{t.student.studentId}</span>
                          <span className="text-white/70 text-[11px]">{t.student.studentName || `${t.student.firstName || ''} ${t.student.lastName || ''}`.trim()}</span>
                          {t.student.phone && <span className="text-white/40 text-[10px] block">{t.student.phone}</span>}
                        </div>
                      ) : (
                        <span className="text-white/30 italic">-</span>
                      )}
                    </td>
                    <td className={`py-3.5 text-right font-black text-sm whitespace-nowrap ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-white/5 border-t border-white/10 flex flex-wrap justify-between items-center text-xs font-bold text-white/70 px-6">
          <span>Total Records: {filteredTransactions.length}</span>
          <div className="flex items-center gap-6">
            <span>Filtered Total: <strong className="text-white">Rs. {filteredTransactions.reduce((acc, t) => t.type === 'INCOME' ? acc + t.amount : acc - t.amount, 0).toLocaleString()}</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
}

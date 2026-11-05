import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, Layers, TrendingUp, Users, DollarSign, Wallet, ShieldCheck,
  CheckCircle, Clock, AlertTriangle, ArrowUpDown, ChevronDown, ChevronRight,
  Search, RefreshCw, FileText, Download, Printer, ExternalLink, Filter,
  Building2, Briefcase, Eye, ArrowRight, X, Percent, Check, Edit3, Save, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import api from '../../api/axios';

// Smart Teacher Avatar with multi-source fallback
const TeacherAvatar = ({ image, name, size = "w-11 h-11", textSize = "text-sm" }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgIndex(0);
    setFailed(false);
  }, [image]);

  const cleanImg = useMemo(() => {
    if (!image || image === 'null' || image === 'default.png' || image === 'default-user.png' || image === 'default-tute.png') {
      return null;
    }
    return image;
  }, [image]);

  const baseUrl = useMemo(() => {
    let base = api.defaults?.baseURL || '';
    if (!base) {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:5000';
        if (window.location.protocol === 'https:') return `https://${hostname}`;
        return `http://${hostname}:5000`;
      }
      return '';
    }
    return base.replace(/\/api\/?$/, '');
  }, []);

  const candidateUrls = useMemo(() => {
    if (!cleanImg) return [];
    if (cleanImg.startsWith('http://') || cleanImg.startsWith('https://')) {
      return [cleanImg];
    }
    const stripped = cleanImg.replace(/^\/+/, '');
    return [
      `${baseUrl}/storage/images/${stripped}`,
      `${baseUrl}/storage/documents/${stripped}`,
      `${baseUrl}/storage/icons/${stripped}`,
      `${baseUrl}/storage/users/${stripped}`,
      `${baseUrl}/api/storage/images/${stripped}`,
      `${baseUrl}/api/storage/documents/${stripped}`
    ];
  }, [cleanImg, baseUrl]);

  const handleError = () => {
    if (imgIndex < candidateUrls.length - 1) {
      setImgIndex(prev => prev + 1);
    } else {
      setFailed(true);
    }
  };

  const initials = useMemo(() => {
    if (!name) return 'L';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  const gradient = useMemo(() => {
    const colors = [
      'from-purple-600 to-indigo-600',
      'from-blue-600 to-cyan-600',
      'from-emerald-600 to-teal-600',
      'from-rose-600 to-pink-600',
      'from-amber-600 to-orange-600'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  }, [name]);

  if (!cleanImg || failed || candidateUrls.length === 0) {
    return (
      <div className={`${size} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black shrink-0 shadow-md ${textSize} border-2 border-white/20 select-none`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={candidateUrls[imgIndex]}
      alt={name || 'Lecturer'}
      crossOrigin="anonymous"
      onError={handleError}
      className={`${size} rounded-full object-cover shrink-0 shadow-md border-2 border-purple-500/30 bg-slate-800`}
    />
  );
};

export default function TeacherSalaryHistory({ loggedInUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBillingMonth, setSelectedBillingMonth] = useState('2026-10');
  const [selectedBusinessId, setSelectedBusinessId] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ADJUSTED', 'EXACT'

  // Data states
  const [historyData, setHistoryData] = useState({
    activeCycle: null,
    availableBillingMonths: [],
    multiCycleTimeline: [],
    summary: {
      totalTrueIncome: 0,
      totalTrueSalary: 0,
      totalPaidSalary: 0,
      totalVariance: 0,
      varianceType: 'EXACT',
      instituteSavings: 0,
      instituteExtraPaid: 0,
      totalInstituteShare: 0,
      totalLecturers: 0,
      totalBusinesses: 0,
      totalTrueStudents: 0,
      totalPaidStudents: 0
    },
    businesses: []
  });

  // Expanded Businesses
  const [expandedBiz, setExpandedBiz] = useState({});

  // Cycle Status Update Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [cycleStatusInput, setCycleStatusInput] = useState('DRAFT');
  const [cycleNotesInput, setCycleNotesInput] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Voucher / Final Slip Preview Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipData, setSelectedSlipData] = useState(null);
  const [slipTheme, setSlipTheme] = useState('light');
  const [slipOrientation, setSlipOrientation] = useState('portrait');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const slipRef = useRef(null);

  // Fetch History Data
  const fetchHistory = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const params = {
        billingMonth: selectedBillingMonth,
        businessId: selectedBusinessId,
        forceRefresh: force ? 'true' : 'false'
      };

      const res = await api.get('/admin/teacher-salary/history', { params });
      if (res.data && res.data.success) {
        setHistoryData(res.data);
        if (res.data.activeCycle) {
          setCycleStatusInput(res.data.activeCycle.status || 'DRAFT');
          setCycleNotesInput(res.data.activeCycle.notes || '');
        }

        // Auto-expand all businesses by default for immediate view
        const initialExpand = {};
        (res.data.businesses || []).forEach(b => {
          initialExpand[b.id] = true;
        });
        setExpandedBiz(prev => ({ ...initialExpand, ...prev }));
      }
    } catch (err) {
      console.error("Error loading salary history:", err);
      toast.error("Failed to load cycle salary history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory(false);
  }, [selectedBillingMonth, selectedBusinessId]);

  const toggleBusinessExpand = (bId) => {
    setExpandedBiz(prev => ({ ...prev, [bId]: !prev[bId] }));
  };

  const handleSaveCycleStatus = async () => {
    try {
      setSavingStatus(true);
      const res = await api.post('/admin/teacher-salary/cycle-status', {
        billingMonth: selectedBillingMonth,
        status: cycleStatusInput,
        notes: cycleNotesInput
      });
      if (res.data && res.data.success) {
        toast.success(`Cycle status updated to ${cycleStatusInput}`);
        setStatusModalOpen(false);
        fetchHistory(true);
      }
    } catch (err) {
      console.error("Error saving cycle status:", err);
      toast.error("Failed to update cycle status.");
    } finally {
      setSavingStatus(false);
    }
  };

  // Filtered Businesses and Teachers
  const filteredBusinesses = useMemo(() => {
    const list = historyData.businesses || [];
    const q = searchQuery.toLowerCase().trim();

    return list.map(b => {
      let teachers = b.teachers || [];
      if (statusFilter === 'ADJUSTED') {
        teachers = teachers.filter(t => t.status === 'ADJUSTED');
      } else if (statusFilter === 'EXACT') {
        teachers = teachers.filter(t => t.status === 'EXACT');
      }

      if (q) {
        teachers = teachers.filter(t => 
          t.name.toLowerCase().includes(q) ||
          b.name.toLowerCase().includes(q) ||
          (t.batches || []).some(bt => bt.toLowerCase().includes(q))
        );
      }

      return {
        ...b,
        filteredTeachers: teachers
      };
    }).filter(b => b.filteredTeachers.length > 0 || (q && b.name.toLowerCase().includes(q)));
  }, [historyData.businesses, searchQuery, statusFilter]);

  // Open Final Salary Slip Modal
  const handleOpenSlipModal = (teacher) => {
    const slipPayload = {
      isConsolidated: true,
      business: { id: teacher.businessId, name: teacher.businessName },
      lecturer: { name: teacher.name, image: teacher.image },
      batchesCount: teacher.batchesCount || 1,
      batch: { name: (teacher.batches || []).join(', ') || 'All Batches' },
      additions: teacher.additionsList || [],
      deductions: teacher.deductionsList || [],
      breakdownMode: teacher.breakdownMode || 'DETAILED',
      subtotalAdj: {
        totalApproved: teacher.paidStudents,
        totalAmount: teacher.paidIncome,
        grossSalary: teacher.paidGrossSalary,
        whtAmount: teacher.paidWht,
        teacherSalary: teacher.paidSalary - (teacher.additions || 0) + (teacher.deductions || 0)
      }
    };
    setSelectedSlipData(slipPayload);
    setSlipModalOpen(true);
  };

  // Download Slip PDF
  const handleDownloadSlipPdf = async () => {
    if (!slipRef.current || !selectedSlipData) return;
    try {
      setDownloadingPdf(true);
      const isLandscape = slipOrientation === 'landscape';
      const toastId = toast.loading("Generating High-Resolution Official Slip PDF...");
      await new Promise(r => setTimeout(r, 150));

      const element = slipRef.current;
      const imgData = await toPng(element, {
        quality: 1,
        pixelRatio: 2.5,
        backgroundColor: slipTheme === 'light' ? '#ffffff' : '#0f172a',
        cacheBust: true
      });

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 10;
      const printableWidth = pageWidth - (margin * 2);

      const img = new Image();
      img.src = imgData;
      await new Promise(resolve => { img.onload = resolve; });

      const imgRatio = img.height / img.width;
      let renderWidth = printableWidth;
      let renderHeight = printableWidth * imgRatio;

      if (renderHeight > (pageHeight - (margin * 2))) {
        renderHeight = pageHeight - (margin * 2);
        renderWidth = renderHeight / imgRatio;
      }

      const xPos = margin + ((printableWidth - renderWidth) / 2);
      const yPos = margin;

      pdf.addImage(imgData, 'PNG', xPos, yPos, renderWidth, renderHeight);

      const cleanLecName = (selectedSlipData.lecturer?.name || 'Lecturer').replace(/[^a-zA-Z0-9]/g, '_');
      const monthStr = selectedBillingMonth || 'Month';
      const filename = `Salary_Slip_${cleanLecName}_${monthStr}.pdf`;

      pdf.save(filename);
      toast.dismiss(toastId);
      toast.success("Salary Slip PDF Downloaded!");
    } catch (err) {
      console.error("PDF download failed:", err);
      toast.error("Failed to generate PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    try {
      const rows = [
        ['Billing Cycle', selectedBillingMonth],
        ['Business', 'Lecturer Name', 'Batches', 'True Students', 'Paid Students', 'True Revenue (Rs.)', 'True Salary (Rs.)', 'Additions (+Rs.)', 'Deductions (-Rs.)', 'Paid Salary (Rs.)', 'Variance / Diff (Rs.)', 'Status']
      ];

      (historyData.businesses || []).forEach(b => {
        (b.teachers || []).forEach(t => {
          rows.push([
            b.name,
            t.name,
            (t.batches || []).join('; '),
            t.trueStudents,
            t.paidStudents,
            t.trueIncome,
            t.trueSalary,
            t.additions,
            t.deductions,
            t.paidSalary,
            t.variance,
            t.status
          ]);
        });
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Salary_History_${selectedBillingMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report exported successfully!");
    } catch (err) {
      console.error("CSV Export error:", err);
      toast.error("Failed to export CSV.");
    }
  };

  const isLight = slipTheme === 'light';

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-4 md:p-8 animate-fade-in font-sans">
      {/* 🌟 EXECUTIVE HEADER 🌟 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
              <Calendar className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                Cycle-Wise Salary History & Audit
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  Executive Audit
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400 font-medium mt-0.5">
                චක්‍ර අනුව වැටුප් ඉතිහාසය • True Income vs Paid Salary Difference & Business-wise Teacher Remuneration
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* SYNC / REFRESH BUTTON */}
          <button
            type="button"
            onClick={() => fetchHistory(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh & Recalculate Live Database"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>

          {/* CYCLE STATUS BUTTON */}
          <button
            type="button"
            onClick={() => setStatusModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              historyData.activeCycle?.status === 'SETTLED'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : historyData.activeCycle?.status === 'AUDITED'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            {historyData.activeCycle?.status === 'SETTLED' ? (
              <CheckCircle size={14} className="text-emerald-400" />
            ) : historyData.activeCycle?.status === 'AUDITED' ? (
              <ShieldCheck size={14} className="text-blue-400" />
            ) : (
              <Clock size={14} className="text-amber-400" />
            )}
            <span>Cycle Status: {historyData.activeCycle?.status || 'DRAFT'}</span>
            <Edit3 size={12} className="opacity-70 ml-1" />
          </button>

          {/* EXPORT CSV BUTTON */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            title="Export Cycle Audit to CSV"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* JUMP TO EDITABLE SALARY PORTAL */}
          <button
            type="button"
            onClick={() => navigate('/admin/teacher-salary')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
            title="Open Live Teacher Salary Portal to adjust payouts"
          >
            <span>Salary Portal</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* 🗓️ MULTI-CYCLE TIMELINE CHIPS (MONTH SELECTOR) 🗓️ */}
      <div className="my-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock size={13} className="text-cyan-400" />
            Billing Cycle Timeline (මසෙන් මසට චක්‍ර තෝරන්න)
          </span>
          <span className="text-xs text-slate-400 font-semibold">
            Active: <strong className="text-white">{historyData.activeCycle?.label || selectedBillingMonth}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {(historyData.multiCycleTimeline || []).map((cycle) => {
            const isSelected = selectedBillingMonth === cycle.monthKey;
            return (
              <button
                key={cycle.monthKey}
                type="button"
                onClick={() => setSelectedBillingMonth(cycle.monthKey)}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-bold shrink-0 flex items-center gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className={`font-black ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                    {cycle.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Rs. {(cycle.revenue || 0).toLocaleString()} • {cycle.paymentsCount || 0} payments
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  cycle.status === 'SETTLED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : cycle.status === 'AUDITED'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {cycle.status || 'DRAFT'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📊 TOP EXECUTIVE KPI SUMMARY CARDS 📊 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
        {/* CARD 1: TRUE INCOME */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>True Apportioned Income</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-400 tracking-tight">
            Rs. {(historyData.summary?.totalTrueIncome || 0).toLocaleString()}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium mt-1">
            Real student revenue collected in {historyData.activeCycle?.monthName}
          </p>
        </div>

        {/* CARD 2: TRUE AUDITED SALARY */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>True Audited Salary</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-indigo-300 tracking-tight">
            Rs. {(historyData.summary?.totalTrueSalary || 0).toLocaleString()}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium mt-1">
            Strict system calculated salary ({historyData.summary?.totalTrueStudents || 0} students)
          </p>
        </div>

        {/* CARD 3: TOTAL PAID SALARY */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-900 border border-cyan-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>Actual Paid Salary</span>
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Wallet size={16} />
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-cyan-400 tracking-tight">
            Rs. {(historyData.summary?.totalPaidSalary || 0).toLocaleString()}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium mt-1">
            Settlement payouts (+Additions -Deductions)
          </p>
        </div>

        {/* CARD 4: VARIANCE / DIFFERENCE */}
        {(() => {
          const variance = historyData.summary?.totalVariance || 0;
          const isSaved = variance < 0;
          const isExtra = variance > 0;
          return (
            <div className={`p-4 rounded-2xl border shadow-lg relative overflow-hidden ${
              isSaved
                ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-400/50'
                : isExtra
                ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-400/50'
                : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 border-white/10'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Paid vs True Difference</span>
                <span className={`p-1.5 rounded-lg ${
                  isSaved ? 'bg-emerald-500/10 text-emerald-400' : isExtra ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>
                  <ArrowUpDown size={16} />
                </span>
              </div>
              <div className={`text-xl md:text-2xl font-black tracking-tight ${
                isSaved ? 'text-emerald-400' : isExtra ? 'text-amber-400' : 'text-slate-300'
              }`}>
                {isSaved ? `-Rs. ${Math.abs(variance).toLocaleString()}` : isExtra ? `+Rs. ${variance.toLocaleString()}` : 'Rs. 0 (Exact)'}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                  isSaved ? 'bg-emerald-500/20 text-emerald-300' : isExtra ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isSaved ? 'Institute Savings (ඉතිරිය)' : isExtra ? 'Extra Allowances Paid' : 'Exact System Match'}
                </span>
              </div>
            </div>
          );
        })()}

        {/* CARD 5: INSTITUTE RETAINED PROFIT SHARE */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/30 via-slate-900 to-slate-900 border border-teal-500/30 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>Institute Retained Profit</span>
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="text-xl md:text-2xl font-black text-teal-300 tracking-tight">
            Rs. {(historyData.summary?.totalInstituteShare || 0).toLocaleString()}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium mt-1">
            True Income minus Paid Salary Settlement
          </p>
        </div>
      </div>

      {/* 🔍 FILTERS BAR 🔍 */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 mb-6 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          {/* BUSINESS DROPDOWN */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl">
            <Building2 size={14} className="text-indigo-400" />
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Businesses ({historyData.businesses?.length || 0})</option>
              {(historyData.businesses || []).map(b => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
              ))}
            </select>
          </div>

          {/* STATUS FILTER PILLS */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                statusFilter === 'ALL' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Teachers
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ADJUSTED')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'ADJUSTED' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Adjusted Only</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXACT')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'EXACT' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Check size={12} />
              <span>Exact Match</span>
            </button>
          </div>
        </div>

        {/* SEARCH BOX */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Teacher, Subject, Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 🏢 BUSINESS-WISE MONTH-BY-MONTH SALARY SECTIONS 🏢 */}
      {loading ? (
        <div className="p-16 text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-300">Auditing and computing cycle-wise salary history...</p>
          <p className="text-xs text-slate-500 mt-1">Comparing True Apportioned Income against Paid Salary Settlement</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="p-16 rounded-3xl bg-slate-900/50 border border-white/10 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No salary records found</h3>
          <p className="text-xs text-slate-400 mt-1">No businesses or teachers matched the current filters for {selectedBillingMonth}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBusinesses.map((biz) => {
            const isExpanded = !!expandedBiz[biz.id];
            const bizVariance = biz.paidSalary - biz.trueSalary;
            const isSaved = bizVariance < 0;
            const isExtra = bizVariance > 0;

            return (
              <div
                key={biz.id}
                className="rounded-3xl bg-[#111624] border border-white/10 shadow-xl overflow-hidden transition-all duration-200"
              >
                {/* 🌟 BUSINESS HEADER ACCORDION BAR 🌟 */}
                <div
                  onClick={() => toggleBusinessExpand(biz.id)}
                  className="p-4 md:p-5 bg-gradient-to-r from-slate-900/90 via-[#151b2e] to-slate-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400"
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <h2 className="text-base md:text-lg font-black text-white tracking-tight">
                          {biz.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold">
                          {biz.category || 'Academic'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {biz.teachersCount} Lecturers • {historyData.activeCycle?.monthName} Billing Cycle Settlement
                      </p>
                    </div>
                  </div>

                  {/* BUSINESS TOTALS ROW (TRUE REVENUE, TRUE SALARY, TOTAL PAID SALARY) */}
                  <div className="flex items-center flex-wrap gap-4 text-right">
                    {/* TRUE INCOME */}
                    <div>
                      <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">True Revenue</p>
                      <p className="text-sm font-black text-emerald-400">
                        Rs. {(biz.trueIncome || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* TRUE SALARY */}
                    <div className="border-l border-white/10 pl-4">
                      <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">True Salary</p>
                      <p className="text-sm font-black text-indigo-300">
                        Rs. {(biz.trueSalary || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* TOTAL PAID SALARY FOR THIS BUSINESS */}
                    <div className="border-l border-white/10 pl-4">
                      <p className="text-[9.5px] uppercase font-extrabold text-cyan-300 tracking-wider">Total Paid Salary</p>
                      <p className="text-base font-black text-cyan-400">
                        Rs. {(biz.paidSalary || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* VARIANCE / DIFFERENCE */}
                    <div className="border-l border-white/10 pl-4">
                      <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">Variance</p>
                      <p className={`text-xs font-black ${
                        isSaved ? 'text-emerald-400' : isExtra ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {isSaved ? `-Rs. ${Math.abs(bizVariance).toLocaleString()}` : isExtra ? `+Rs. ${bizVariance.toLocaleString()}` : 'Rs. 0'}
                      </p>
                    </div>

                    {/* INSTITUTE NET PROFIT */}
                    <div className="border-l border-white/10 pl-4">
                      <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">Institute Profit</p>
                      <p className="text-xs font-black text-teal-300">
                        Rs. {(biz.instituteShare || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 📋 TEACHERS TABLE (EXPANDABLE) 📋 */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-black/40 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="py-3 px-4">Lecturer & Batches</th>
                          <th className="py-3 px-3 text-center">True vs Paid Students</th>
                          <th className="py-3 px-3 text-right">True Salary (නියම)</th>
                          <th className="py-3 px-3 text-right">Additions (+)</th>
                          <th className="py-3 px-3 text-right">Deductions (-)</th>
                          <th className="py-3 px-3 text-right text-cyan-300">Final Paid Salary (ගෙවූ)</th>
                          <th className="py-3 px-3 text-right">Variance (වෙනස)</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(biz.filteredTeachers || []).map((t, idx) => {
                          const isTAdjusted = t.status === 'ADJUSTED';
                          const isTSaved = t.variance < 0;
                          const isTExtra = t.variance > 0;

                          return (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              {/* LECTURER NAME & AVATAR */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <TeacherAvatar image={t.image} name={t.name} size="w-9 h-9" textSize="text-xs" />
                                  <div className="min-w-0">
                                    <p className="font-black text-sm text-white truncate">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate max-w-xs" title={(t.batches || []).join(', ')}>
                                      {(t.batches || []).join(' • ') || 'Assigned Batches'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* TRUE VS PAID STUDENTS */}
                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10">
                                  <span className="font-bold text-slate-300">{t.trueStudents}</span>
                                  <ArrowRight size={10} className="text-slate-500" />
                                  <span className={`font-black ${t.studentsDiff !== 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {t.paidStudents}
                                  </span>
                                </div>
                                {t.studentsDiff !== 0 && (
                                  <p className="text-[9px] font-bold text-amber-400 mt-0.5">
                                    {t.studentsDiff > 0 ? `+${t.studentsDiff}` : t.studentsDiff} students
                                  </p>
                                )}
                              </td>

                              {/* TRUE AUDITED SALARY */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-bold text-slate-300">
                                  Rs. {(t.trueSalary || 0).toLocaleString()}
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-medium">
                                  Rev: Rs. {(t.trueIncome || 0).toLocaleString()}
                                </div>
                              </td>

                              {/* ADDITIONS */}
                              <td className="py-3 px-3 text-right">
                                {t.additions > 0 ? (
                                  <span className="font-bold text-emerald-400 text-xs">
                                    +Rs. {t.additions.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>

                              {/* DEDUCTIONS */}
                              <td className="py-3 px-3 text-right">
                                {t.deductions > 0 ? (
                                  <span className="font-bold text-rose-400 text-xs">
                                    -Rs. {t.deductions.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>

                              {/* FINAL PAID SALARY */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-black text-cyan-400 text-sm">
                                  Rs. {(t.paidSalary || 0).toLocaleString()}
                                </div>
                                <div className="text-[9.5px] text-slate-400 font-medium">
                                  Net Remuneration
                                </div>
                              </td>

                              {/* VARIANCE / DIFFERENCE */}
                              <td className="py-3 px-3 text-right">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-black text-xs ${
                                  isTSaved
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : isTExtra
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-white/5 text-slate-400'
                                }`}>
                                  {isTSaved ? `-Rs. ${Math.abs(t.variance).toLocaleString()}` : isTExtra ? `+Rs. ${t.variance.toLocaleString()}` : 'Rs. 0'}
                                </span>
                              </td>

                              {/* STATUS BADGE */}
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1 ${
                                  isTAdjusted
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}>
                                  {isTAdjusted ? <AlertTriangle size={10} /> : <Check size={10} />}
                                  {isTAdjusted ? 'Adjusted' : 'Exact Match'}
                                </span>
                              </td>

                              {/* ACTION BUTTONS */}
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* VIEW SALARY SLIP */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSlipModal(t)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="View & Download Official Remuneration Slip"
                                  >
                                    <FileText size={12} />
                                    <span>Slip</span>
                                  </button>

                                  {/* OPEN IN SALARY PORTAL */}
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/admin/teacher-salary?lecturer=${encodeURIComponent(t.name)}&month=${selectedBillingMonth}`)}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                    title="Edit in Teacher Salary Portal"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 📝 UPDATE CYCLE STATUS MODAL 📝 */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131726] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-cyan-400" />
                Manage Cycle Audit Status
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Billing Cycle Month
                </label>
                <input
                  type="text"
                  disabled
                  value={historyData.activeCycle?.label || selectedBillingMonth}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Remuneration Audit Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'DRAFT', label: 'Draft', color: 'amber' },
                    { id: 'AUDITED', label: 'Audited', color: 'blue' },
                    { id: 'SETTLED', label: 'Settled & Closed', color: 'emerald' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCycleStatusInput(s.id)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        cycleStatusInput === s.id
                          ? s.id === 'SETTLED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-sm'
                            : s.id === 'AUDITED'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-400 shadow-sm'
                            : 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm'
                          : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Finance Notes & Bank Payment Reference
                </label>
                <textarea
                  rows={3}
                  value={cycleNotesInput}
                  onChange={(e) => setCycleNotesInput(e.target.value)}
                  placeholder="e.g. Paid on 2nd Nov 2026 via HNB bulk transfer. Verified by Head of Finance."
                  className="w-full bg-slate-900 border border-white/10 focus:border-cyan-400 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCycleStatus}
                  disabled={savingStatus}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingStatus ? 'Saving...' : 'Save Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📄 FULL SALARY SLIP PREVIEW & DOWNLOAD MODAL 📄 */}
      {slipModalOpen && selectedSlipData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-[#131726] border border-white/10 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* TOP BAR / MODAL CONTROLS */}
            <div className="px-5 py-3.5 bg-black/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                    Official Remuneration Voucher
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                      Audited
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {selectedSlipData.lecturer?.name} • {selectedSlipData.business?.name}
                  </p>
                </div>
              </div>

              {/* ACTION BUTTONS & TOGGLES */}
              <div className="flex items-center flex-wrap gap-2">
                {/* THEME TOGGLE */}
                <button
                  type="button"
                  onClick={() => setSlipTheme(prev => prev === 'light' ? 'dark' : 'light')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  title="Toggle Light / Dark Voucher Theme"
                >
                  <span>{slipTheme === 'light' ? '📄 White Paper' : '🌙 Dark Theme'}</span>
                </button>

                {/* ORIENTATION TOGGLE */}
                <button
                  type="button"
                  onClick={() => setSlipOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  title="Toggle PDF Orientation"
                >
                  <span className="uppercase text-[10px]">{slipOrientation}</span>
                </button>

                {/* PRINT BUTTON */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  title="Print Salary Slip"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                {/* DOWNLOAD PDF BUTTON */}
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadSlipPdf}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Download Official Salary Slip PDF"
                >
                  <Download size={14} />
                  <span>{downloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
                </button>

                {/* CLOSE BUTTON */}
                <button
                  type="button"
                  onClick={() => setSlipModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* VOUCHER PREVIEW CONTAINER (SCROLLABLE) */}
            <div className="p-4 md:p-8 overflow-y-auto flex-1 bg-black/40">
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  #history-salary-slip-printable, #history-salary-slip-printable * { visibility: visible !important; }
                  #history-salary-slip-printable {
                    position: fixed !important;
                    left: 0 !important; top: 0 !important;
                    width: 100% !important; max-width: 100% !important;
                    margin: 0 !important; padding: 10mm !important;
                    border: none !important; box-shadow: none !important;
                    background: #ffffff !important; color: #000000 !important;
                  }
                  @page { size: A4 portrait; margin: 10mm; }
                }
              `}</style>

              <div
                ref={slipRef}
                id="history-salary-slip-printable"
                className={`w-full ${
                  slipOrientation === 'portrait' ? 'max-w-[794px]' : 'max-w-4xl'
                } mx-auto rounded-2xl transition-colors duration-200 relative overflow-hidden ${
                  isLight
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-xl'
                    : 'bg-[#0f172a] text-slate-100 border border-white/10 shadow-2xl'
                } p-6 md:p-9`}
              >
                {/* SUBTLE BRAND WATERMARK */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
                  <img
                    src="/logo.png"
                    alt=""
                    crossOrigin="anonymous"
                    className="w-96 max-w-full object-contain filter grayscale select-none"
                  />
                </div>

                {/* VOUCHER HEADER */}
                <div className={`relative z-10 flex flex-wrap items-start justify-between pb-5 border-b ${
                  isLight ? 'border-slate-200' : 'border-white/10'
                } gap-4`}>
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/logo.png"
                      alt="IMA Campus Official Logo"
                      crossOrigin="anonymous"
                      className="h-14 md:h-16 w-auto object-contain shrink-0"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                    <div>
                      <h2 className={`text-xl md:text-2xl font-black tracking-tight ${
                        isLight ? 'text-slate-950 font-black' : 'text-white font-black'
                      }`}>
                        IMA CAMPUS
                      </h2>
                      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Higher Academic & Professional Education
                      </p>
                      <p className={`text-[10.5px] font-semibold ${
                        isLight ? 'text-indigo-600 font-bold' : 'text-purple-400'
                      }`}>
                        Department of Academic Finance & Teacher Remuneration
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider inline-block ${
                      isLight ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      Official Remuneration Voucher
                    </span>
                    <p className={`text-xs font-mono font-bold mt-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Voucher No: IMA-PAY-{selectedSlipData.business?.id}-{Date.now().toString().slice(-5)}
                    </p>
                    <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Date Issued: {new Date().toLocaleDateString('en-GB')}
                    </p>
                    <p className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-purple-300'}`}>
                      Billing Period: {historyData.activeCycle?.label || selectedBillingMonth}
                    </p>
                  </div>
                </div>

                {/* TEACHER & BATCH INFO CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5 relative z-10">
                  {/* LECTURER CARD */}
                  <div className={`p-3.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                  } flex items-center gap-3`}>
                    <TeacherAvatar
                      image={selectedSlipData.lecturer?.image}
                      name={selectedSlipData.lecturer?.name}
                      size="w-13 h-13"
                      textSize="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Lecturer Name
                      </p>
                      <p className={`text-sm font-black truncate mt-0.5 ${isLight ? 'text-slate-950 font-black' : 'text-white'}`}>
                        {selectedSlipData.lecturer?.name}
                      </p>
                      <p className={`text-[10.5px] font-medium truncate mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Business: <span className="font-bold">{selectedSlipData.business?.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* BATCH CARD */}
                  <div className={`p-3.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                  } flex flex-col justify-center`}>
                    <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Academic Scope
                    </p>
                    <p className={`text-sm font-black truncate mt-0.5 ${isLight ? 'text-slate-950 font-black' : 'text-white'}`}>
                      {selectedSlipData.batch?.name}
                    </p>
                    <p className={`text-[10.5px] font-medium mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Mode: Theory & Apportioned Modules
                    </p>
                  </div>

                  {/* STUDENTS SUMMARY CARD */}
                  <div className={`p-3.5 rounded-xl border ${
                    isLight ? 'bg-emerald-50/60 border-emerald-300' : 'bg-emerald-950/20 border-emerald-500/30'
                  } flex flex-col justify-center`}>
                    <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
                      Total Approved Students
                    </p>
                    <p className={`text-xl font-black mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                      {(selectedSlipData.subtotalAdj?.totalApproved || 0)} Students
                    </p>
                    <p className={`text-[10.5px] font-semibold mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Verified & Audited
                    </p>
                  </div>
                </div>

                {/* ADDITIONS & DEDUCTIONS BREAKDOWN */}
                {(() => {
                  const hasAdditions = (selectedSlipData.additions || []).length > 0;
                  const hasDeductions = (selectedSlipData.deductions || []).length > 0;
                  if (!hasAdditions && !hasDeductions) return null;

                  const additionsTotal = (selectedSlipData.additions || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const deductionsTotal = (selectedSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 relative z-10">
                      {hasAdditions ? (
                        <div className={`p-3.5 rounded-xl border ${
                          isLight ? 'bg-emerald-50/70 border-emerald-300' : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}>
                          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20 mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                              (+) Additional Allowances & Payments (එකතු කිරීම්)
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              +Rs. {additionsTotal.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {selectedSlipData.additions.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                  {item.description || 'Addition'}
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +Rs. {(parseFloat(item.amount) || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <div />}

                      {hasDeductions ? (
                        <div className={`p-3.5 rounded-xl border ${
                          isLight ? 'bg-rose-50/70 border-rose-300' : 'bg-rose-950/20 border-rose-500/30'
                        }`}>
                          <div className="flex items-center justify-between pb-2 border-b border-rose-500/20 mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-rose-800' : 'text-rose-300'}`}>
                              (-) Loan, Advance & Deductions (අඩු කිරීම්)
                            </span>
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                              -Rs. {deductionsTotal.toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {selectedSlipData.deductions.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                  {item.description || 'Deduction'}
                                </span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                  -Rs. {(parseFloat(item.amount) || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <div />}
                    </div>
                  );
                })()}

                {/* FINANCIAL SETTLEMENT SUMMARY BOX */}
                {(() => {
                  const baseSalary = selectedSlipData.subtotalAdj?.teacherSalary || 0;
                  const additionsTotal = (selectedSlipData.additions || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const deductionsTotal = (selectedSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                  const netPayable = Math.max(0, baseSalary + additionsTotal - deductionsTotal);

                  return (
                    <div className={`p-4 md:p-5 rounded-2xl border relative z-10 ${
                      isLight
                        ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300'
                        : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border-emerald-500/30'
                    } flex flex-wrap items-center justify-between gap-4 mb-6`}>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                            Gross Lecturer Remuneration:
                          </span>
                          <strong className={`font-black text-base ${isLight ? 'text-indigo-950 font-black' : 'text-indigo-300'}`}>
                            Rs. {(selectedSlipData.subtotalAdj?.grossSalary || 0).toLocaleString()}
                          </strong>
                        </div>

                        {(selectedSlipData.subtotalAdj?.whtAmount || 0) > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                            <span>Withholding Tax (WHT Deducted):</span>
                            <span className="font-black">
                              -Rs. {(selectedSlipData.subtotalAdj?.whtAmount || 0).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {additionsTotal > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                            <span>Total Additions & Allowances:</span>
                            <span className="font-black">+Rs. {additionsTotal.toLocaleString()}</span>
                          </div>
                        )}

                        {deductionsTotal > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                            <span>Total Deductions (Loan / Advance):</span>
                            <span className="font-black">-Rs. {deductionsTotal.toLocaleString()}</span>
                          </div>
                        )}

                        <p className={`text-[10px] font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          Remuneration calculated for {(selectedSlipData.subtotalAdj?.totalApproved || 0)} approved students • {selectedSlipData.business?.name}.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
                          Final Net Payable to Lecturer
                        </p>
                        <p className={`text-2xl md:text-3xl font-black tracking-tight mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          Rs. {netPayable.toLocaleString()}
                        </p>
                        <p className={`text-[9.5px] font-semibold mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          (Full & Final Remuneration Settlement)
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* SIGNATURES BLOCK */}
                <div className={`pt-5 border-t relative z-10 ${
                  isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
                } grid grid-cols-4 gap-3 text-center text-[10.5px]`}>
                  <div className={`border-t border-dashed pt-2 ${isLight ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Prepared By</p>
                    <p className="text-[9px] opacity-75">Finance & Accounts</p>
                  </div>
                  <div className={`border-t border-dashed pt-2 ${isLight ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Checked & Verified</p>
                    <p className="text-[9px] opacity-75">Head of Finance</p>
                  </div>
                  <div className={`border-t border-dashed pt-2 ${isLight ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Authorized By</p>
                    <p className="text-[9px] opacity-75">Director / GM</p>
                  </div>
                  <div className={`border-t border-dashed pt-2 ${isLight ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Lecturer Acknowledgement</p>
                    <p className="text-[9px] opacity-75">{selectedSlipData.lecturer?.name}</p>
                  </div>
                </div>

                {/* VOUCHER FOOTER NOTE */}
                <div className={`mt-5 pt-2.5 border-t text-[8.5px] text-center font-medium relative z-10 ${
                  isLight ? 'border-slate-200 text-slate-400' : 'border-white/5 text-slate-500'
                }`}>
                  IMA Campus ERP • Academic Remuneration & Payroll Subsystem • Official Computer Generated Document
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


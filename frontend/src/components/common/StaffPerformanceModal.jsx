import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    X as CloseIcon, 
    Calendar, 
    CheckCircle, 
    XCircle, 
    User, 
    Bot, 
    Filter, 
    Search,
    BarChart3,
    Trophy,
    Activity,
    ShieldCheck,
    Clock,
    Download,
    Printer,
    Sparkles,
    TrendingUp,
    Percent,
    Zap,
    Tag,
    Scale,
    ArrowUpCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Sun,
    Moon,
    Users,
    FileSpreadsheet,
    FileText,
    HelpCircle
} from 'lucide-react';
import axios from '../../api/axios';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

// Helper to get initials
const getInitials = (name) => {
    if (!name || name === 'Unknown') return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

// Helper for consistent avatar colors
const getAvatarColor = (str, isLight = true) => {
    if (isLight) {
        const colors = [
            'bg-blue-100 text-blue-700 border-blue-200',
            'bg-emerald-100 text-emerald-700 border-emerald-200',
            'bg-purple-100 text-purple-700 border-purple-200',
            'bg-amber-100 text-amber-800 border-amber-200',
            'bg-rose-100 text-rose-700 border-rose-200',
            'bg-cyan-100 text-cyan-800 border-cyan-200',
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    } else {
        const colors = [
            'bg-blue-500/20 text-blue-400 border-blue-500/30',
            'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            'bg-purple-500/20 text-purple-400 border-purple-500/30',
            'bg-amber-500/20 text-amber-400 border-amber-500/30',
            'bg-pink-500/20 text-pink-400 border-pink-500/30',
            'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
};

export default function StaffPerformanceModal({ onClose }) {
    // Theme state: defaults to 'light' (Clean Executive Report) as requested!
    const [theme, setTheme] = useState('light');
    const isLight = theme === 'light';

    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState({ 
        aiVerified: 0, manualVerified: 0, rejected: 0, postpay: 0, total: 0,
        quickApprove: 0, discountApprove: 0, adjustApprove: 0, upgradeApprove: 0, installmentApprove: 0
    });
    const [loading, setLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    const reportCardRef = useRef(null);
    
    // Filters (Default to this month or today)
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Default to This Month so user sees comprehensive monthly data immediately
    const [dateFrom, setDateFrom] = useState(`${year}-${month}-01T00:00`);
    const [dateTo, setDateTo] = useState(`${today}T23:59`);
    const [activePreset, setActivePreset] = useState('month');
    const [verificationMethod, setVerificationMethod] = useState('all'); 
    const [actionFilter, setActionFilter] = useState('all');
    const [dateBasis, setDateBasis] = useState('updatedAt'); // 'updatedAt' (Staff Action Date) vs 'created_at' (Student Slip Upload Date)

    const setPreset = (preset) => {
        setActivePreset(preset);
        const currentDate = new Date();
        let start, end;
        if (preset === 'today') {
            const todayStr = currentDate.toLocaleDateString('en-CA');
            start = `${todayStr}T00:00`;
            end = `${todayStr}T23:59`;
        } else if (preset === 'yesterday') {
            const y = new Date(currentDate);
            y.setDate(y.getDate() - 1);
            const yStr = y.toLocaleDateString('en-CA');
            start = `${yStr}T00:00`;
            end = `${yStr}T23:59`;
        } else if (preset === 'week') {
            const d = new Date(currentDate);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            start = `${monday.toLocaleDateString('en-CA')}T00:00`;
            end = `${currentDate.toLocaleDateString('en-CA')}T23:59`;
        } else if (preset === 'month') {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            start = `${y}-${m}-01T00:00`;
            end = `${currentDate.toLocaleDateString('en-CA')}T23:59`;
        } else if (preset === 'lastMonth') {
            const firstOfCurrent = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDayOfPrev = new Date(firstOfCurrent - 1);
            const firstDayOfPrev = new Date(lastDayOfPrev.getFullYear(), lastDayOfPrev.getMonth(), 1);
            start = `${firstDayOfPrev.toLocaleDateString('en-CA')}T00:00`;
            end = `${lastDayOfPrev.toLocaleDateString('en-CA')}T23:59`;
        } else if (preset === 'september2026') {
            start = '2026-09-01T00:00';
            end = '2026-09-30T23:59';
        } else if (preset === 'all') {
            start = '2026-01-01T00:00';
            end = `${currentDate.toLocaleDateString('en-CA')}T23:59`;
        }
        setDateFrom(start);
        setDateTo(end);
    };

    const fetchStaffStats = async () => {
        setLoading(true);
        setCurrentPage(1);
        try {
            const res = await axios.get('/admin/payments/staff-stats-report', {
                params: { dateFrom, dateTo, verificationMethod, action: actionFilter, dateBasis }
            });
            if (res.data) {
                setReportData(res.data.data || []);
                setSummary(res.data.summary || { 
                    aiVerified: 0, manualVerified: 0, rejected: 0, postpay: 0, total: 0,
                    quickApprove: 0, discountApprove: 0, adjustApprove: 0, upgradeApprove: 0, installmentApprove: 0
                });
            }
        } catch (error) {
            console.error("Failed to fetch staff stats report", error);
            toast.error("Failed to load verification report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffStats();
    }, [verificationMethod, actionFilter, dateBasis]);

    // Derived unique students count
    const uniqueStudentsTotal = useMemo(() => {
        return new Set(reportData.map(r => r.studentPhone || r.studentName)).size;
    }, [reportData]);

    const uniqueStudentsApproved = useMemo(() => {
        return new Set(reportData.filter(r => r.status === 1).map(r => r.studentPhone || r.studentName)).size;
    }, [reportData]);

    // Calculate Leaderboard Data with Breakdown
    const staffBreakdownRaw = useMemo(() => {
        return reportData.filter(r => !r.isAiVerified && r.verifiedBy !== 'Unknown' && r.verifiedBy !== 'System / Staff').reduce((acc, row) => {
            if (!acc[row.verifiedBy]) {
                acc[row.verifiedBy] = { 
                    total: 0, 
                    quick: 0, 
                    discount: 0, 
                    adjust: 0, 
                    upgrade: 0, 
                    installment: 0,
                    rejected: 0,
                    postpay: 0
                };
            }
            acc[row.verifiedBy].total++;
            if (row.approveType === 'Quick Approve') acc[row.verifiedBy].quick++;
            else if (row.approveType === 'Discount Approve') acc[row.verifiedBy].discount++;
            else if (row.approveType === 'Adjust Approve') acc[row.verifiedBy].adjust++;
            else if (row.approveType === 'Upgrade Approve') acc[row.verifiedBy].upgrade++;
            else if (row.approveType === 'Installment Approve') acc[row.verifiedBy].installment++;
            else if (row.status === 2) acc[row.verifiedBy].rejected++;
            else if (row.status === 4) acc[row.verifiedBy].postpay++;
            return acc;
        }, {});
    }, [reportData]);

    const staffBreakdown = useMemo(() => {
        return Object.entries(staffBreakdownRaw).sort((a, b) => b[1].total - a[1].total);
    }, [staffBreakdownRaw]);

    const maxStaffCount = staffBreakdown[0] ? staffBreakdown[0][1].total : 1;
    const totalManualFromBreakdown = summary.manualVerified || 1;

    // Filter table records by search input
    const filteredRows = useMemo(() => {
        if (!tableSearch.trim()) return reportData;
        const query = tableSearch.toLowerCase();
        return reportData.filter(r => 
            (r.studentName && r.studentName.toLowerCase().includes(query)) ||
            (r.studentPhone && r.studentPhone.toLowerCase().includes(query)) ||
            (r.verifiedBy && r.verifiedBy.toLowerCase().includes(query)) ||
            (r.batch && r.batch.toLowerCase().includes(query)) ||
            (r.business && r.business.toLowerCase().includes(query)) ||
            (r.id && String(r.id).includes(query)) ||
            (r.paymentId && String(r.paymentId).includes(query)) ||
            (r.approveType && r.approveType.toLowerCase().includes(query))
        );
    }, [reportData, tableSearch]);

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, currentPage]);

    const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

    // Derived percentages
    const totalApproved = (summary.quickApprove || 0) + (summary.discountApprove || 0) + (summary.adjustApprove || 0) + (summary.upgradeApprove || 0) + (summary.installmentApprove || 0);
    const approvalRate = summary.total > 0 ? ((totalApproved / summary.total) * 100).toFixed(1) : '0.0';
    const rejectionRate = summary.total > 0 ? (((summary.rejected || 0) / summary.total) * 100).toFixed(1) : '0.0';

    // Export printable summary card as Image (PNG)
    const handleExportImage = async () => {
        if (!reportCardRef.current) return;
        setIsExporting(true);
        const tId = toast.loading('Rendering high-resolution executive report image...');
        try {
            const dataUrl = await toPng(reportCardRef.current, {
                quality: 0.98,
                pixelRatio: 2,
                backgroundColor: isLight ? '#FFFFFF' : '#090D14',
                skipFonts: true,
                filter: (node) => !node.classList?.contains('no-export')
            });
            const link = document.createElement('a');
            link.download = `IMA_Verification_Report_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataUrl;
            link.click();
            toast.success('Executive Report Image exported successfully!', { id: tId });
        } catch (err) {
            console.error('Image export failed:', err);
            toast.error('Failed to export report image', { id: tId });
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
            {/* Main Modal Container */}
            <div className={`w-full max-w-[95rem] max-h-[96vh] rounded-[24px] border shadow-2xl flex flex-col overflow-hidden relative transition-colors duration-200 ${
                isLight 
                    ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 shadow-slate-900/20' 
                    : 'bg-[#090D14] border-white/10 text-white shadow-teal-500/10'
            }`}>
                
                {/* Header Section */}
                <div className={`px-6 sm:px-8 py-4 border-b flex flex-wrap justify-between items-center gap-4 relative z-10 ${
                    isLight 
                        ? 'bg-white border-slate-200 shadow-sm' 
                        : 'bg-white/[0.02] border-white/10'
                }`}>
                    <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border ${
                            isLight 
                                ? 'bg-teal-50 border-teal-200 text-teal-700' 
                                : 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-500/30 text-teal-400'
                        }`}>
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Payment Slips Verification Report
                                </h2>
                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-wider ${
                                    isLight 
                                        ? 'bg-teal-50 text-teal-800 border-teal-300' 
                                        : 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                }`}>
                                    Official Audit
                                </span>
                            </div>
                            <p className={`text-xs font-medium flex items-center gap-1.5 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                <Activity size={13} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
                                Comprehensive audit breakdown of slip verifications, staff speed & approvals
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons: Theme Toggle, Export Image, Print, Close */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Theme Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setTheme(isLight ? 'dark' : 'light')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                isLight 
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' 
                                    : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
                            }`}
                            title={isLight ? "Switch to Dark Analytics theme" : "Switch to Executive Light Report"}
                        >
                            {isLight ? <Moon size={14} className="text-slate-700" /> : <Sun size={14} className="text-amber-400" />}
                            <span>{isLight ? 'Dark View' : 'Executive Light'}</span>
                        </button>

                        <button 
                            type="button"
                            onClick={handleExportImage}
                            disabled={isExporting}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm py-2 px-3.5 sm:px-4 rounded-xl transition-all shadow-md flex items-center gap-2 border border-emerald-500/40 cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Export entire breakdown as high-definition PNG"
                        >
                            <Download size={15} />
                            <span>{isExporting ? 'Exporting...' : 'Export Image'}</span>
                        </button>

                        <button 
                            type="button"
                            onClick={handlePrint}
                            className={`font-semibold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-xl transition-all border flex items-center gap-2 cursor-pointer active:scale-95 ${
                                isLight 
                                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' 
                                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                            }`}
                            title="Print or Save as PDF"
                        >
                            <Printer size={15} />
                            <span className="hidden sm:inline">Print</span>
                        </button>

                        <button 
                            type="button"
                            onClick={onClose} 
                            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-150 cursor-pointer ${
                                isLight 
                                    ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border-slate-200 hover:border-rose-300' 
                                    : 'bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-white/10 hover:border-rose-500/30'
                            }`}
                            aria-label="Close modal"
                        >
                            <CloseIcon size={17} />
                        </button>
                    </div>
                </div>

                {/* Filters Section (Sticky at Top) */}
                <div className={`px-6 sm:px-8 py-3.5 border-b relative z-10 space-y-3 no-export ${
                    isLight 
                        ? 'bg-slate-100/80 border-slate-200' 
                        : 'bg-[#0C121E] border-white/10'
                }`}>
                    
                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        <span className={`text-[10px] font-bold uppercase tracking-widest mr-1 shrink-0 flex items-center gap-1 ${
                            isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                            <Sparkles size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'} /> Presets:
                        </span>
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'week', label: 'This Week' },
                            { id: 'month', label: 'This Month' },
                            { id: 'lastMonth', label: 'Last Month' },
                            { id: 'september2026', label: 'September 2026' },
                            { id: 'all', label: 'All Time' },
                        ].map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPreset(p.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    activePreset === p.id 
                                        ? (isLight 
                                            ? 'bg-teal-600 text-white shadow-sm' 
                                            : 'bg-teal-500 text-gray-950 font-black shadow-[0_0_12px_rgba(20,184,166,0.4)]')
                                        : (isLight 
                                            ? 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200' 
                                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5')
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter Inputs Grid */}
                    <div className="flex flex-wrap items-end gap-3 text-xs">
                        {/* From Date */}
                        <div className="flex-1 min-w-[170px]">
                            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 ml-1 flex items-center gap-1 ${
                                isLight ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                                <Calendar size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'}/> From Date & Time
                            </label>
                            <input 
                                type="datetime-local" 
                                value={dateFrom} 
                                onChange={e => { setDateFrom(e.target.value); setActivePreset('custom'); }} 
                                className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all ${
                                    isLight 
                                        ? 'bg-white border-slate-300 text-slate-900 focus:border-teal-600 shadow-sm' 
                                        : 'bg-[#090D14] border-white/10 text-white focus:border-teal-500'
                                }`}
                            />
                        </div>

                        {/* To Date */}
                        <div className="flex-1 min-w-[170px]">
                            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 ml-1 flex items-center gap-1 ${
                                isLight ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                                <Calendar size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'}/> To Date & Time
                            </label>
                            <input 
                                type="datetime-local" 
                                value={dateTo} 
                                onChange={e => { setDateTo(e.target.value); setActivePreset('custom'); }} 
                                className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all ${
                                    isLight 
                                        ? 'bg-white border-slate-300 text-slate-900 focus:border-teal-600 shadow-sm' 
                                        : 'bg-[#090D14] border-white/10 text-white focus:border-teal-500'
                                }`}
                            />
                        </div>

                        {/* Date Basis: Action Date vs Slip Upload Date */}
                        <div className="flex-1 min-w-[170px]">
                            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 ml-1 flex items-center gap-1 ${
                                isLight ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                                <Clock size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'}/> Date Criteria
                            </label>
                            <select 
                                value={dateBasis} 
                                onChange={e => setDateBasis(e.target.value)} 
                                className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all cursor-pointer ${
                                    isLight 
                                        ? 'bg-white border-slate-300 text-slate-900 focus:border-teal-600 shadow-sm' 
                                        : 'bg-[#090D14] border-white/10 text-white focus:border-teal-500'
                                }`}
                            >
                                <option value="updatedAt">By Verification Date (Staff Action)</option>
                                <option value="created_at">By Slip Upload Date (Manage Payments)</option>
                            </select>
                        </div>

                        {/* Method Filter */}
                        <div className="flex-1 min-w-[130px]">
                            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 ml-1 flex items-center gap-1 ${
                                isLight ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                                <Bot size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'}/> Method
                            </label>
                            <select 
                                value={verificationMethod} 
                                onChange={e => setVerificationMethod(e.target.value)} 
                                className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all cursor-pointer ${
                                    isLight 
                                        ? 'bg-white border-slate-300 text-slate-900 focus:border-teal-600 shadow-sm' 
                                        : 'bg-[#090D14] border-white/10 text-white focus:border-teal-500'
                                }`}
                            >
                                <option value="all">All Methods</option>
                                <option value="ai">AI Verified</option>
                                <option value="manual">Manual / Staff</option>
                            </select>
                        </div>

                        {/* Action Status Filter */}
                        <div className="flex-1 min-w-[150px]">
                            <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 ml-1 flex items-center gap-1 ${
                                isLight ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                                <Filter size={11} className={isLight ? 'text-teal-600' : 'text-teal-400'}/> Action Status
                            </label>
                            <select 
                                value={actionFilter} 
                                onChange={e => setActionFilter(e.target.value)} 
                                className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all cursor-pointer ${
                                    isLight 
                                        ? 'bg-white border-slate-300 text-slate-900 focus:border-teal-600 shadow-sm' 
                                        : 'bg-[#090D14] border-white/10 text-white focus:border-teal-500'
                                }`}
                            >
                                <option value="all">All Verified Actions</option>
                                <option value="approved">All Approved</option>
                                <option value="quick_approve">↳ Quick Approve</option>
                                <option value="discount_approve">↳ Discount Approve</option>
                                <option value="adjust_approve">↳ Adjust Approve</option>
                                <option value="upgrade_approve">↳ Upgrade Approve</option>
                                <option value="installment_approve">↳ Installment Approve</option>
                                <option value="rejected">Rejected Only</option>
                            </select>
                        </div>

                        {/* Fetch Button */}
                        <button 
                            type="button"
                            onClick={fetchStaffStats} 
                            disabled={loading}
                            className={`font-extrabold py-2 px-5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 h-[36px] cursor-pointer active:scale-95 shrink-0 ${
                                isLight 
                                    ? 'bg-teal-600 hover:bg-teal-500 text-white' 
                                    : 'bg-teal-500 hover:bg-teal-400 text-gray-950 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                            }`}
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span>{loading ? 'Fetching...' : 'Fetch'}</span>
                        </button>
                    </div>
                </div>

                {/* Printable / Report Container (Scrollable) */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-6 ${
                    isLight ? 'bg-slate-100/50' : 'bg-[#080C14]'
                }`}>
                    
                    {/* The Exportable Report Card (Target for toPng image export) */}
                    <div 
                        ref={reportCardRef} 
                        className={`space-y-6 rounded-2xl p-4 sm:p-6 transition-colors duration-200 ${
                            isLight 
                                ? 'bg-white border border-slate-200 shadow-sm text-slate-900' 
                                : 'bg-[#080C14] border border-white/10 text-white'
                        }`}
                    >
                        
                        {/* Executive Printable Report Header */}
                        <div className={`flex flex-wrap items-center justify-between pb-5 border-b gap-4 ${
                            isLight ? 'border-slate-200' : 'border-white/10'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                        isLight ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                    }`}>
                                        IMA CAMPUS SRI LANKA
                                    </span>
                                    <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        • Academic & Verification Operations
                                    </span>
                                </div>
                                <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Payment Slips Verification & Staff Audit Summary
                                </h1>
                                <p className={`text-xs mt-1 font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    Period: <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {new Date(dateFrom).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span> to <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {new Date(dateTo).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span>
                                    <span className="mx-2">•</span>
                                    Filtered by: <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {dateBasis === 'created_at' ? 'Slip Upload Date' : 'Staff Verification Date'}
                                    </span>
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Overall Approval Rate
                                    </span>
                                    <span className={`text-2xl sm:text-3xl font-black ${
                                        parseFloat(approvalRate) >= 90 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : (isLight ? 'text-amber-600' : 'text-amber-400')
                                    }`}>
                                        {approvalRate}%
                                    </span>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black shadow-sm ${
                                    isLight 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                }`}>
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                        </div>

                        {/* Top 4 Executive KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                            {/* Card 1: Total Slips & Unique Students */}
                            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                isLight 
                                    ? 'bg-slate-50 border-slate-200 shadow-sm' 
                                    : 'bg-gradient-to-br from-[#121B2C] to-[#0D1424] border-white/10'
                            }`}>
                                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 ${
                                    isLight ? 'text-slate-600' : 'text-slate-400'
                                }`}>
                                    Total Actioned Slips
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {summary.total.toLocaleString()}
                                    </p>
                                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>slips</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                                    <span className={`text-[11px] font-extrabold flex items-center gap-1 ${
                                        isLight ? 'text-teal-700' : 'text-teal-300'
                                    }`}>
                                        <Users size={12}/> {uniqueStudentsTotal.toLocaleString()} Unique Students
                                    </span>
                                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        (multi-slip per student)
                                    </span>
                                </div>
                            </div>
                            
                            {/* Card 2: AI Verified */}
                            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                isLight 
                                    ? 'bg-cyan-50/70 border-cyan-200 shadow-sm' 
                                    : 'bg-gradient-to-br from-teal-950/40 to-[#0D1424] border-teal-500/20'
                            }`}>
                                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                                    isLight ? 'text-cyan-800' : 'text-teal-300'
                                }`}>
                                    <Bot size={13}/> AI Verified
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${
                                        isLight ? 'text-cyan-900' : 'text-teal-400'
                                    }`}>
                                        {summary.aiVerified.toLocaleString()}
                                    </p>
                                    <span className={`text-xs font-bold ${
                                        isLight ? 'text-cyan-800' : 'text-teal-400/80'
                                    }`}>
                                        {summary.total > 0 ? ((summary.aiVerified / summary.total) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                                <p className={`text-[10px] mt-2 ${isLight ? 'text-cyan-700' : 'text-teal-400/60'}`}>
                                    Instant automated AI approvals
                                </p>
                            </div>
                            
                            {/* Card 3: Manual Staff Verified */}
                            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                isLight 
                                    ? 'bg-emerald-50/70 border-emerald-200 shadow-sm' 
                                    : 'bg-gradient-to-br from-emerald-950/40 to-[#0D1424] border-emerald-500/20'
                            }`}>
                                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                                    isLight ? 'text-emerald-800' : 'text-emerald-300'
                                }`}>
                                    <User size={13}/> Manual Staff Verified
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${
                                        isLight ? 'text-emerald-900' : 'text-emerald-400'
                                    }`}>
                                        {summary.manualVerified.toLocaleString()}
                                    </p>
                                    <span className={`text-xs font-bold ${
                                        isLight ? 'text-emerald-800' : 'text-emerald-400/80'
                                    }`}>
                                        {summary.total > 0 ? ((summary.manualVerified / summary.total) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-white/10 flex items-center justify-between">
                                    <span className={`text-[11px] font-extrabold ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                                        {uniqueStudentsApproved.toLocaleString()} Students Approved
                                    </span>
                                </div>
                            </div>
                            
                            {/* Card 4: Rejected Slips */}
                            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                isLight 
                                    ? 'bg-rose-50/70 border-rose-200 shadow-sm' 
                                    : 'bg-gradient-to-br from-rose-950/40 to-[#0D1424] border-rose-500/20'
                            }`}>
                                <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                                    isLight ? 'text-rose-800' : 'text-rose-300'
                                }`}>
                                    <XCircle size={13}/> Rejected Slips
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${
                                        isLight ? 'text-rose-900' : 'text-rose-400'
                                    }`}>
                                        {summary.rejected.toLocaleString()}
                                    </p>
                                    <span className={`text-xs font-bold ${
                                        isLight ? 'text-rose-800' : 'text-rose-400/80'
                                    }`}>
                                        {rejectionRate}%
                                    </span>
                                </div>
                                <p className={`text-[10px] mt-2 ${isLight ? 'text-rose-700' : 'text-rose-400/60'}`}>
                                    Invalid or fake slip submissions
                                </p>
                            </div>
                        </div>

                        {/* Complete Breakdown of Approval Categories */}
                        <div className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${
                            isLight 
                                ? 'bg-slate-50/80 border-slate-200' 
                                : 'bg-[#0F1626] border-white/10'
                        }`}>
                            <div className="flex flex-wrap justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
                                    <h3 className={`text-sm font-black uppercase tracking-wider ${
                                        isLight ? 'text-slate-900' : 'text-white'
                                    }`}>
                                        Comprehensive Action Breakdown ({totalApproved.toLocaleString()} Approved + {summary.rejected.toLocaleString()} Rejected)
                                    </h3>
                                </div>
                                <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Detailed distribution across all verified payments
                                </span>
                            </div>

                            {/* Proportional Multi-Color Progress Strip */}
                            {summary.total > 0 && (
                                <div className={`w-full h-3 rounded-full overflow-hidden flex shadow-inner ${
                                    isLight ? 'bg-slate-200' : 'bg-black/40'
                                }`}>
                                    <div style={{ width: `${(summary.quickApprove / summary.total) * 100}%` }} className="bg-emerald-500 h-full" title={`Quick Approve: ${summary.quickApprove}`} />
                                    <div style={{ width: `${(summary.discountApprove / summary.total) * 100}%` }} className="bg-cyan-500 h-full" title={`Discount: ${summary.discountApprove}`} />
                                    <div style={{ width: `${(summary.adjustApprove / summary.total) * 100}%` }} className="bg-amber-500 h-full" title={`Adjust: ${summary.adjustApprove}`} />
                                    <div style={{ width: `${(summary.upgradeApprove / summary.total) * 100}%` }} className="bg-purple-500 h-full" title={`Upgrade: ${summary.upgradeApprove}`} />
                                    <div style={{ width: `${(summary.installmentApprove / summary.total) * 100}%` }} className="bg-blue-500 h-full" title={`Installment: ${summary.installmentApprove}`} />
                                    <div style={{ width: `${(summary.rejected / summary.total) * 100}%` }} className="bg-rose-500 h-full" title={`Rejected: ${summary.rejected}`} />
                                </div>
                            )}

                            {/* 6 Category Breakdown Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                                {/* Quick */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-emerald-200 shadow-sm' 
                                        : 'bg-[#141E33] border-emerald-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-emerald-700' : 'text-emerald-400'
                                        }`}>
                                            <Zap size={12}/> Quick
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {summary.total > 0 ? ((summary.quickApprove / summary.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.quickApprove.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Instant Approve</span>
                                    </div>
                                </div>

                                {/* Discount */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-cyan-200 shadow-sm' 
                                        : 'bg-[#141E33] border-cyan-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-cyan-700' : 'text-cyan-400'
                                        }`}>
                                            <Tag size={12}/> Discount
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {summary.total > 0 ? ((summary.discountApprove / summary.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.discountApprove.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fee Waivers</span>
                                    </div>
                                </div>

                                {/* Adjust */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-amber-200 shadow-sm' 
                                        : 'bg-[#141E33] border-amber-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-amber-700' : 'text-amber-400'
                                        }`}>
                                            <Scale size={12}/> Adjust
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {summary.total > 0 ? ((summary.adjustApprove / summary.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.adjustApprove.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Wallet/Arrears</span>
                                    </div>
                                </div>

                                {/* Upgrade */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-purple-200 shadow-sm' 
                                        : 'bg-[#141E33] border-purple-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-purple-700' : 'text-purple-400'
                                        }`}>
                                            <ArrowUpCircle size={12}/> Upgrade
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {summary.total > 0 ? ((summary.upgradeApprove / summary.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.upgradeApprove.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Batch Upgrades</span>
                                    </div>
                                </div>

                                {/* Installment */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-blue-200 shadow-sm' 
                                        : 'bg-[#141E33] border-blue-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-blue-700' : 'text-blue-400'
                                        }`}>
                                            <CalendarDays size={12}/> Installment
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {summary.total > 0 ? ((summary.installmentApprove / summary.total) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.installmentApprove.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Part Payments</span>
                                    </div>
                                </div>

                                {/* Rejected */}
                                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                                    isLight 
                                        ? 'bg-white border-rose-200 shadow-sm' 
                                        : 'bg-[#141E33] border-rose-500/20'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                                            isLight ? 'text-rose-700' : 'text-rose-400'
                                        }`}>
                                            <XCircle size={12}/> Rejected
                                        </span>
                                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {rejectionRate}%
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <span className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            {summary.rejected.toLocaleString()}
                                        </span>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Decline Slips</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Staff Performance Leaderboard */}
                        {staffBreakdown.length > 0 && (
                            <div className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${
                                isLight 
                                    ? 'bg-slate-50/80 border-slate-200' 
                                    : 'bg-[#0F1626] border-white/10'
                            }`}>
                                <div className="flex flex-wrap justify-between items-center gap-2">
                                    <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${
                                        isLight ? 'text-slate-900' : 'text-white'
                                    }`}>
                                        <Trophy size={16} className={isLight ? 'text-amber-500' : 'text-amber-400'} /> 
                                        Staff Leaderboard ({staffBreakdown.length} Active Officers)
                                    </h3>
                                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Ranked by total manual slips verified during this time
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {staffBreakdown.map(([staffName, stats], idx) => {
                                        const percentageOfMax = Math.round((stats.total / maxStaffCount) * 100);
                                        const shareOfAll = ((stats.total / totalManualFromBreakdown) * 100).toFixed(1);
                                        
                                        const rankBadgeStyle = idx === 0 
                                            ? (isLight ? 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300' : 'bg-amber-400 text-gray-950 font-black')
                                            : idx === 1 
                                            ? (isLight ? 'bg-slate-200 text-slate-800 font-extrabold border border-slate-300' : 'bg-slate-300 text-gray-950 font-black')
                                            : idx === 2 
                                            ? (isLight ? 'bg-amber-50 text-amber-800 font-extrabold border border-amber-200' : 'bg-amber-700 text-white font-black')
                                            : (isLight ? 'bg-slate-100 text-slate-600 font-bold border border-slate-200' : 'bg-white/10 text-slate-400');

                                        return (
                                            <div 
                                                key={staffName} 
                                                className={`border rounded-2xl p-4 flex flex-col justify-between gap-3 relative transition-all ${
                                                    isLight 
                                                        ? (idx === 0 
                                                            ? 'bg-white border-amber-300 shadow-sm ring-1 ring-amber-300/40' 
                                                            : 'bg-white border-slate-200 shadow-sm hover:border-teal-300')
                                                        : (idx === 0 
                                                            ? 'bg-[#141E33] border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.1)]' 
                                                            : 'bg-[#141E33] border-white/5 hover:border-teal-500/30')
                                                }`}
                                            >
                                                {/* Header: Avatar, Name, Rank */}
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${getAvatarColor(staffName, isLight)}`}>
                                                            {getInitials(staffName)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-bold truncate leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`} title={staffName}>
                                                                {staffName}
                                                            </p>
                                                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] uppercase mt-0.5 ${rankBadgeStyle}`}>
                                                                Rank #{idx + 1}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className={`text-lg font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                                                            {stats.total}
                                                        </span>
                                                        <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                                                            {shareOfAll}% share
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-black/40'}`}>
                                                    <div 
                                                        className={`h-full ${idx === 0 ? 'bg-amber-500' : 'bg-teal-500'}`} 
                                                        style={{ width: `${percentageOfMax}%` }}
                                                    ></div>
                                                </div>

                                                {/* Mini Stats Badges */}
                                                <div className={`grid grid-cols-5 gap-1 border-t pt-2 text-center ${
                                                    isLight ? 'border-slate-100' : 'border-white/5'
                                                }`}>
                                                    <div title="Quick Approve">
                                                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.quick}</span>
                                                        <span className={`text-[8px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Qck</span>
                                                    </div>
                                                    <div title="Discount">
                                                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.discount}</span>
                                                        <span className={`text-[8px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Dis</span>
                                                    </div>
                                                    <div title="Adjust">
                                                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.adjust}</span>
                                                        <span className={`text-[8px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Adj</span>
                                                    </div>
                                                    <div title="Upgrade">
                                                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.upgrade}</span>
                                                        <span className={`text-[8px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Upg</span>
                                                    </div>
                                                    <div title="Installment">
                                                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-800' : 'text-white'}`}>{stats.installment}</span>
                                                        <span className={`text-[8px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Inst</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Detailed Data Table Section */}
                    <div className={`border rounded-2xl overflow-hidden flex flex-col ${
                        isLight 
                            ? 'bg-white border-slate-200 shadow-sm' 
                            : 'bg-[#0F1626] border-white/10 shadow-inner'
                    }`}>
                        
                        {/* Table Header Controls */}
                        <div className={`p-4 sm:p-5 border-b flex flex-wrap justify-between items-center gap-3 ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111827]/70 border-white/10'
                        }`}>
                            <div className="flex items-center gap-3">
                                <h3 className={`text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Detailed Slip Action Logs ({filteredRows.length.toLocaleString()} Records)
                                </h3>
                                {filteredRows.length !== reportData.length && (
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                        isLight 
                                            ? 'bg-teal-50 text-teal-800 border-teal-200' 
                                            : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                    }`}>
                                        Filtered from {reportData.length.toLocaleString()} total
                                    </span>
                                )}
                            </div>

                            {/* Table Search Input */}
                            <div className="relative w-full sm:w-72">
                                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
                                <input 
                                    type="text" 
                                    value={tableSearch} 
                                    onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }} 
                                    placeholder="Search by student, staff, batch..." 
                                    className={`w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none transition-colors ${
                                        isLight 
                                            ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-600' 
                                            : 'bg-[#090D14] border-white/10 text-white placeholder-slate-500 focus:border-teal-400'
                                    }`}
                                />
                                {tableSearch && (
                                    <button 
                                        onClick={() => setTableSearch('')} 
                                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs cursor-pointer ${
                                            isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Table Content */}
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center">
                                <div className={`w-10 h-10 border-4 border-t-teal-500 rounded-full animate-spin mb-3 ${
                                    isLight ? 'border-slate-200' : 'border-teal-500/20'
                                }`}></div>
                                <p className={`text-sm font-bold tracking-wide ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>
                                    Syncing full verification dataset...
                                </p>
                            </div>
                        ) : filteredRows.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${
                                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                                }`}>
                                    <Filter size={28} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                                </div>
                                <h3 className={`text-base font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    No Records Found
                                </h3>
                                <p className={`text-xs max-w-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Try expanding your date range or adjusting status filters to view records.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className={`border-b text-[10px] font-black uppercase tracking-widest ${
                                        isLight 
                                            ? 'bg-slate-100/80 text-slate-600 border-slate-200' 
                                            : 'bg-[#141E33] text-slate-400 border-white/10'
                                    }`}>
                                        <tr>
                                            <th className="px-5 py-3 whitespace-nowrap">Record ID</th>
                                            <th className="px-5 py-3">Student Details</th>
                                            <th className="px-5 py-3">Batch</th>
                                            <th className="px-5 py-3">Action Type</th>
                                            <th className="px-5 py-3">Verified By</th>
                                            <th className="px-5 py-3 text-right whitespace-nowrap">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y text-xs ${
                                        isLight ? 'divide-slate-200' : 'divide-white/5'
                                    }`}>
                                        {paginatedRows.map((row) => (
                                            <tr key={row.id} className={`transition-colors ${
                                                isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                                            }`}>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                                                        Log #{row.id}
                                                    </div>
                                                    <div className={`text-[11px] font-semibold ${isLight ? 'text-teal-700' : 'text-teal-400/80'}`}>
                                                        Pay #{row.paymentId || row.id}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-7 h-7 rounded-lg flex shrink-0 items-center justify-center font-bold text-[11px] border ${getAvatarColor(row.studentName, isLight)}`}>
                                                            {getInitials(row.studentName)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`font-bold truncate max-w-[180px] ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                                {row.studentName}
                                                            </div>
                                                            <div className={`text-[10px] truncate max-w-[180px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {row.businessName || row.business} {row.studentPhone ? `• ${row.studentPhone}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-block max-w-[160px] truncate text-xs font-semibold px-2 py-0.5 rounded border ${
                                                        isLight 
                                                            ? 'bg-slate-100 text-slate-800 border-slate-200' 
                                                            : 'bg-white/5 text-slate-300 border-white/5'
                                                    }`}>
                                                        {row.batchName || row.batch || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    {row.status === 1 ? (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                                            isLight 
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                        }`}>
                                                            <CheckCircle size={11} strokeWidth={2.5}/> {row.approveType || 'APPROVED'}
                                                        </span>
                                                    ) : row.status === 2 ? (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                                            isLight 
                                                                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                                                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                                        }`}>
                                                            <XCircle size={11} strokeWidth={2.5}/> REJECTED
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                                            isLight 
                                                                ? 'bg-blue-50 text-blue-800 border-blue-200' 
                                                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                                        }`}>
                                                            <Clock size={11} strokeWidth={2.5}/> {row.approveType || 'POSTPAY'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 whitespace-nowrap">
                                                    {row.isAiVerified ? (
                                                        <div className={`flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-lg border w-fit ${
                                                            isLight 
                                                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200' 
                                                                : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                                        }`}>
                                                            <Bot size={13}/> AI System
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-1.5 font-semibold text-xs px-2.5 py-1 rounded-lg border w-fit ${
                                                            isLight 
                                                                ? 'bg-slate-100 text-slate-800 border-slate-200' 
                                                                : 'bg-white/5 text-slate-300 border-white/10'
                                                        }`}>
                                                            <User size={13} className={isLight ? 'text-slate-500' : 'text-slate-400'}/>
                                                            {row.verifiedBy}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                                    <div className={`font-semibold flex items-center justify-end gap-1 ${
                                                        isLight ? 'text-slate-800' : 'text-slate-300'
                                                    }`}>
                                                        <Clock size={11} className={isLight ? 'text-slate-400' : 'text-slate-500'}/>
                                                        {new Date(row.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </div>
                                                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                                                        {new Date(row.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className={`p-3 border-t flex flex-wrap justify-between items-center gap-2 text-xs ${
                                isLight 
                                    ? 'bg-slate-50 border-slate-200 text-slate-600' 
                                    : 'bg-[#111827]/80 border-white/10 text-slate-400'
                            }`}>
                                <div>
                                    Showing <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{((currentPage - 1) * pageSize) + 1}</span> to <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.min(currentPage * pageSize, filteredRows.length)}</span> of <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{filteredRows.length.toLocaleString()}</span> entries
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        className={`p-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                                            isLight 
                                                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' 
                                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                                        }`}
                                        title="Previous Page"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className={`px-2 font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        className={`p-1.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                                            isLight 
                                                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' 
                                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                                        }`}
                                        title="Next Page"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>

                </div>

            </div>
        </div>
    );
}
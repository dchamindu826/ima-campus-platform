import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../api/axios';
import { 
    FaUserTie, FaDownload, FaUsers, FaPhoneAlt, FaComments, FaFilter, FaChartPie, FaChartBar, FaBullseye, FaBolt
} from 'react-icons/fa';
import { 
    Calendar as CalendarIcon, PhoneCall, MessageSquare,
    TrendingUp, Layers, Zap, UserCheck, FileText,
    ChevronRight, Activity, Search, ShieldCheck, PieChart as PieChartIcon, BarChart2, Briefcase,
    Sparkles, ArrowUpRight, CheckCircle2, XCircle, Clock, Award, RefreshCw, Send, PhoneForwarded, Ghost
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Helper Component: Animated Circular Progress Ring
function CircularProgressRing({ percentage, size = 68, strokeWidth = 6, color = '#6366F1', label, sublabel }) {
    const validPct = isNaN(percentage) ? 0 : Math.min(100, Math.max(0, percentage));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (validPct / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center group">
            <svg width={size} height={size} className="transform -rotate-90 drop-shadow-md">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={isNaN(offset) ? circumference : offset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-black text-white tracking-tight">{validPct}%</span>
                {label && <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">{label}</span>}
                {sublabel && <span className="text-[7px] text-slate-500 font-semibold">{sublabel}</span>}
            </div>
        </div>
    );
}

// Helper Component: Modern Visual Progress Bar
function VisualProgressBar({ value, max, color = 'bg-indigo-500', label, subtext, showPct = true }) {
    const validVal = value || 0;
    const validMax = max > 0 ? max : 1;
    const pct = max > 0 ? Math.min(100, Math.round((validVal / validMax) * 100)) : 0;
    return (
        <div className="space-y-1.5 w-full">
            <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-slate-300 flex items-center gap-1.5">{label}</span>
                <span className="text-white font-extrabold flex items-center gap-1">
                    {validVal}
                    {showPct && <span className="text-slate-400 font-medium text-[10px]">({pct}%)</span>}
                </span>
            </div>
            <div className="w-full h-2 bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out ${color} shadow-sm`} 
                    style={{ width: `${pct}%` }}
                ></div>
            </div>
            {subtext && <span className="text-[9px] text-slate-500 font-medium block">{subtext}</span>}
        </div>
    );
}

export default function CoordinatorProgressSheet({ filters = {} }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        coordinators: [],
        rawLeads: []
    });

    // Search, Date Range and Sort controls
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('assigned'); // 'assigned', 'paid', 'answerRate'
    
    // Dynamic default date range: Last 10 days up to today
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const defaultStartStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 10);
        return d.toISOString().split('T')[0];
    }, []);

    const [startDate, setStartDate] = useState(defaultStartStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [selectedCoordId, setSelectedCoordId] = useState('ALL');

    useEffect(() => {
        fetchProgressStats();
    }, [filters.selectedBusiness, filters.selectedBatch, startDate, endDate, selectedCoordId]);

    const fetchProgressStats = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const biz = filters.selectedBusiness || 'ALL';
            const bat = filters.selectedBatch || 'ALL';

            const res = await axios.get('/after-seminar-crm/stats/coordinator-progress', {
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    businessId: biz, 
                    batchId: bat,
                    startDate: startDate,
                    endDate: endDate,
                    coordinatorId: selectedCoordId
                }
            });
            setStats(res.data);
            if (isManual) toast.success("Coordinator stats refreshed!");
        } catch (error) {
            console.error("Failed to load coordinator progress stats", error);
            toast.error("Failed to load Coordinator Progress.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Quick Date Preset Handlers
    const setQuickDate = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const handleExportWordDoc = async () => {
        try {
            toast.loading("Generating Word Document (.docx)...", { id: 'word-export' });
            const token = localStorage.getItem('token');
            const biz = filters.selectedBusiness || 'ALL';
            const bat = filters.selectedBatch || 'ALL';

            const response = await axios.get('/after-seminar-crm/export-coordinator-word-doc', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    businessId: biz,
                    batchId: bat,
                    startDate: startDate,
                    endDate: endDate,
                    coordinatorId: selectedCoordId
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Coordinator_Performance_Report_${startDate}_to_${endDate}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("Word Document downloaded successfully!", { id: 'word-export' });
        } catch (error) {
            console.error("Failed to export Word document", error);
            toast.error("Failed to export Word document.", { id: 'word-export' });
        }
    };

    const handleExportToExcel = () => {
        if (!stats.rawLeads || stats.rawLeads.length === 0) {
            toast.error("No data available to export.");
            return;
        }

        const exportData = stats.rawLeads.map(l => ({
            "Coordinator Name": l.coordinatorName,
            "Student Phone": l.phone,
            "Student Name": l.name,
            "Campaign": l.campaignType,
            "Inquiry Type": l.inquiryType,
            "Round": l.round,
            "Phase": l.phase,
            "Call Status": l.callStatus,
            "Enrollment": l.enrollmentStatus,
            "Payment Plan": l.paymentPlan,
            "Remark": l.remark
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Coordinator_Progress");
        XLSX.writeFile(workbook, `Coordinator_Progress_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Full Coordinator Report Exported successfully!");
    };

    const handleGhostLogin = async (coordinatorId) => {
        try {
            const toastId = toast.loading("Switching to Ghost Mode...");
            const res = await axios.post(`/auth/ghost-login/${coordinatorId}`);
            if (res.data.token && res.data.user) {
                localStorage.setItem('admin_token', localStorage.getItem('token'));
                localStorage.setItem('admin_user', localStorage.getItem('user'));
                const { password, ...safeUser } = res.data.user;
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(safeUser));
                toast.success("Switched to Ghost Mode successfully!", { id: toastId });
                window.location.href = '/login';
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Ghost login failed.");
        }
    };

    // Filter active team coordinators for business
    const activeStaffList = (stats.coordinators || []).filter(c => (c.totalAssigned || 0) > 0);
    const mainActiveStaff = activeStaffList.filter(c => (c.totalAssigned || 0) >= 3);
    const chartCoordinators = mainActiveStaff.length > 0 ? mainActiveStaff : activeStaffList;
    const totalCoordinatorsCount = chartCoordinators.length;

    // Calculate aggregated overall stats for top summary cards & charts
    const totalFreeSemAssigned = (stats.coordinators || []).reduce((acc, c) => acc + (c.freeSem?.assignedCount || 0), 0);
    const totalOpenSemAssigned = (stats.coordinators || []).reduce((acc, c) => acc + (c.afterSem?.openSem?.assignedCount || 0), 0);
    const totalNewInqAssigned = (stats.coordinators || []).reduce((acc, c) => acc + (c.afterSem?.newInq?.assignedCount || 0), 0);
    const totalAfterSemAssigned = totalOpenSemAssigned + totalNewInqAssigned;
    const totalPaidEnrolled = (stats.coordinators || []).reduce((acc, c) => acc + (c.afterSem?.combinedTotals?.totalPaid || 0), 0);
    const overallTotalLeads = totalFreeSemAssigned + totalAfterSemAssigned;
    const overallPaidConversionPct = overallTotalLeads > 0 ? Math.round((totalPaidEnrolled / overallTotalLeads) * 100) : 0;

    // Total Calls & Messages across coordinators
    const totalCallsCount = (stats.coordinators || []).reduce((acc, c) => acc + (c.dateWiseTotals?.allCallsTotal || 0), 0);
    const totalMsgsCount = (stats.coordinators || []).reduce((acc, c) => acc + (c.dateWiseTotals?.allMsgTotal || 0), 0);

    // Data for Donut Chart (Lead Channel Breakdown)
    const channelPieData = [
        { name: 'Free Sem CRM', value: totalFreeSemAssigned, color: '#38BDF8' },
        { name: 'Open Seminar', value: totalOpenSemAssigned, color: '#A855F7' },
        { name: 'New Inquiries', value: totalNewInqAssigned, color: '#6366F1' },
    ].filter(d => d.value > 0);

    // Data for Bar Chart
    const coordinatorBarData = chartCoordinators.map(c => ({
        displayName: `${c.name || 'Coord'} (#${c.id})`,
        shortName: c.name ? c.name.split(' ')[0] : 'Coord',
        Assigned: c.totalAssigned || 0,
        Paid: c.afterSem?.combinedTotals?.totalPaid || 0,
    }));

    const filteredCoordinators = (stats.coordinators || [])
        .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'paid') return (b.afterSem?.combinedTotals?.totalPaid || 0) - (a.afterSem?.combinedTotals?.totalPaid || 0);
            if (sortBy === 'answerRate') return (b.freeSem?.callAnswerRate || 0) - (a.freeSem?.callAnswerRate || 0);
            return (b.totalAssigned || 0) - (a.totalAssigned || 0);
        });

    if (loading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center space-y-4 bg-gradient-to-b from-slate-900/90 to-slate-950/95 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-2xl">
                <div className="relative">
                    <div className="w-14 h-14 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <Sparkles size={20} className="text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                    <p className="text-indigo-300 font-black text-sm tracking-wider uppercase">
                        Loading Coordinator Intelligence Hub...
                    </p>
                    <p className="text-slate-500 text-xs font-medium">Aggregating real-time messaging, call velocity & paid conversions</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-7 animate-fade-in text-left font-sans min-h-screen">
            
            {/* 🌟 1. EXECUTIVE HERO BANNER */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/95 via-indigo-950/40 to-slate-950/95 border border-white/10 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                {/* Ambient Decorative Glows */}
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 bg-indigo-500/15 text-indigo-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-indigo-500/30 tracking-wider shadow-sm">
                                <Briefcase size={13} className="text-indigo-400" /> Coordinator Command Center
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-emerald-500/30 tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Tracking
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200 tracking-tight">
                            Coordinator Performance & Progress Hub
                        </h1>
                        <p className="text-slate-400 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
                            Monitor coordinator pipeline capacity, multi-channel messaging velocity, daily call audits, and verified paid student enrollments.
                        </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button 
                            onClick={() => fetchProgressStats(true)}
                            disabled={refreshing}
                            className="bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button 
                            onClick={handleExportWordDoc}
                            className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-indigo-400/40 uppercase tracking-wider"
                        >
                            <FileText size={15} /> Export Word Doc
                        </button>
                        <button 
                            onClick={handleExportToExcel}
                            className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
                        >
                            <FaDownload size={12} className="text-emerald-400" /> Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* 📊 2. TOP EXECUTIVE METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                
                {/* Card 1: Active Coordinators */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md hover:border-indigo-500/40 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                            <FaUsers className="text-indigo-400" /> Active Coordinators
                        </span>
                        <span className="text-[10px] font-black text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30">
                            Team
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-3">
                        <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">{totalCoordinatorsCount}</h3>
                        <span className="text-xs text-slate-400 font-semibold">Assigned Staff</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Total Pipeline Leads:</span>
                        <strong className="text-white font-bold">{overallTotalLeads}</strong>
                    </div>
                </div>

                {/* Card 2: Free Sem Assigned */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md hover:border-sky-500/40 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                            <PhoneCall size={13} className="text-sky-400" /> Free Sem Pool
                        </span>
                        <span className="text-[10px] font-black text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-500/30">
                            Phase 1 & 2
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-3">
                        <h3 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 tracking-tight">
                            {totalFreeSemAssigned}
                        </h3>
                        <span className="text-xs text-sky-400/80 font-semibold">Free Leads</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Share of Total:</span>
                        <strong className="text-sky-300 font-bold">
                            {overallTotalLeads > 0 ? Math.round((totalFreeSemAssigned / overallTotalLeads) * 100) : 0}%
                        </strong>
                    </div>
                </div>

                {/* Card 3: After Sem Assigned */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md hover:border-purple-500/40 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                            <Layers size={13} className="text-purple-400" /> After Sem Pipeline
                        </span>
                        <span className="text-[10px] font-black text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/30">
                            Open + New Inq
                        </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-3">
                        <h3 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 tracking-tight">
                            {totalAfterSemAssigned}
                        </h3>
                        <span className="text-xs text-purple-400/80 font-semibold">Round 1 & 2</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Open: <strong className="text-purple-300">{totalOpenSemAssigned}</strong></span>
                        <span>New Inq: <strong className="text-indigo-300">{totalNewInqAssigned}</strong></span>
                    </div>
                </div>

                {/* Card 4: Total Paid Conversions */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-emerald-500/30 p-5 rounded-2xl shadow-xl backdrop-blur-md hover:border-emerald-500/50 transition-all duration-300 flex items-center justify-between group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                            <TrendingUp size={13} className="text-emerald-400" /> Paid Conversions
                        </span>
                        <h3 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 tracking-tight">
                            {totalPaidEnrolled}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            <CheckCircle2 size={11} /> Verified Enrolled
                        </span>
                    </div>
                    <CircularProgressRing percentage={overallPaidConversionPct} size={62} strokeWidth={5} color="#10B981" label="Paid" />
                </div>

            </div>

            {/* 📈 3. VISUAL CHARTS PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Donut Chart: Pipeline Split */}
                <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <PieChartIcon size={15} className="text-sky-400" /> Pipeline Volume Split
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                            Channels
                        </span>
                    </div>

                    <div className="h-44 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={channelPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={48}
                                    outerRadius={68}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {channelPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }} 
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xl font-black text-white">{overallTotalLeads}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] font-bold text-center">
                        <div className="bg-slate-950/60 p-2 rounded-xl border border-sky-500/20">
                            <span className="text-[9px] text-sky-400 block uppercase">Free Sem</span>
                            <strong className="text-white text-xs">{totalFreeSemAssigned}</strong>
                        </div>
                        <div className="bg-slate-950/60 p-2 rounded-xl border border-purple-500/20">
                            <span className="text-[9px] text-purple-400 block uppercase">Open Sem</span>
                            <strong className="text-white text-xs">{totalOpenSemAssigned}</strong>
                        </div>
                        <div className="bg-slate-950/60 p-2 rounded-xl border border-indigo-500/20">
                            <span className="text-[9px] text-indigo-400 block uppercase">New Inq</span>
                            <strong className="text-white text-xs">{totalNewInqAssigned}</strong>
                        </div>
                    </div>
                </div>

                {/* Bar Chart: Coordinator Leads vs Paid Enrollments */}
                <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-md space-y-3 lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart2 size={15} className="text-indigo-400" /> Team Performance (Assigned Leads vs Paid Conversions)
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Assigned
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Paid
                            </span>
                        </div>
                    </div>

                    <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={coordinatorBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="displayName" tickFormatter={(val) => val.split(' (#')[0]} stroke="#94A3B8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }} 
                                />
                                <Bar dataKey="Assigned" fill="#6366F1" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Paid" fill="#10B981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* 🎛️ 4. CONTROLS, SEARCH & QUICK DATE TOOLBAR */}
            <div className="bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-white/10 p-4 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md">
                
                {/* Search & Coordinator Filter Pills */}
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3.5 py-2 rounded-xl w-full sm:w-60 focus-within:border-indigo-500 transition-all shadow-inner">
                        <Search size={14} className="text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search Coordinator..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 scrollbar-thin">
                        <button
                            onClick={() => setSelectedCoordId('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${selectedCoordId === 'ALL' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'}`}
                        >
                            All ({stats.coordinators?.length || 0})
                        </button>

                        {(stats.coordinators || []).map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCoordId(String(c.id))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${String(selectedCoordId) === String(c.id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-950/80 text-slate-400 hover:text-white border border-white/5'}`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Controls & Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-between xl:justify-end">
                    
                    {/* Quick Date Range Buttons */}
                    <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/5 text-[11px] font-bold">
                        <button 
                            onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
                            className={`px-2.5 py-1 rounded-lg transition-all ${startDate === todayStr && endDate === todayStr ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'}`}
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setQuickDate(7)}
                            className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all"
                        >
                            7 Days
                        </button>
                        <button 
                            onClick={() => setQuickDate(14)}
                            className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all"
                        >
                            14 Days
                        </button>
                    </div>

                    {/* Date Picker Input */}
                    <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs shadow-inner">
                        <CalendarIcon size={14} className="text-indigo-400" />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                        />
                        <span className="text-slate-500 font-bold">to</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                        />
                    </div>

                </div>

            </div>

            {/* 👤 5. MAIN COORDINATOR PERFORMANCE CARDS & DATA-TABLES */}
            {filteredCoordinators.length === 0 ? (
                <div className="bg-slate-900/80 border border-white/10 p-16 rounded-3xl text-center text-slate-400 backdrop-blur-md">
                    <UserCheck size={44} className="mx-auto mb-3 text-slate-600" />
                    <h3 className="text-lg font-bold text-white mb-1">No Coordinators Found</h3>
                    <p className="text-xs text-slate-500">Try adjusting your search or business/batch filters.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {filteredCoordinators.map((coord) => {
                        const free = coord.freeSem || {};
                        const after = coord.afterSem || {};
                        const openSem = after.openSem || {};
                        const newInq = after.newInq || {};
                        const combined = after.combinedTotals || {};
                        const paidPct = combined.totalLeads > 0 ? Math.round((combined.totalPaid / combined.totalLeads) * 100) : 0;

                        return (
                            <div 
                                key={coord.id}
                                className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-white/10 rounded-3xl p-6 md:p-8 space-y-7 shadow-2xl backdrop-blur-xl"
                            >
                                {/* Background Gradient Accent */}
                                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

                                {/* COORDINATOR PROFILE HEADER */}
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-white/5 pb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-2 ring-white/10">
                                            {coord.name ? coord.name.charAt(0).toUpperCase() : 'C'}
                                        </div>
                                        <div>
                                            <div className="flex items-center flex-wrap gap-2.5">
                                                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">{coord.name}</h2>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full shadow-sm">
                                                    Coordinator #{coord.id}
                                                </span>
                                                <button
                                                    onClick={() => handleGhostLogin(coord.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/15 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg text-xs font-bold border border-purple-500/30 transition-all shadow-sm group/ghost cursor-pointer"
                                                    title="Ghost Login as this Coordinator"
                                                >
                                                    <Ghost size={13} className="text-purple-400 group-hover/ghost:text-white transition-colors" />
                                                    <span>Ghost Login</span>
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-2">
                                                <span>Performance Metrics & Daily Campaign Velocity</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* High Level Key Badges & Circular Ring */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="bg-slate-950/80 border border-white/5 px-3.5 py-2 rounded-xl text-center shadow-inner">
                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">Assigned Total</span>
                                                <span className="text-base font-black text-white">{coord.totalAssigned || 0}</span>
                                            </div>
                                            <div className="bg-slate-950/80 border border-sky-500/20 px-3.5 py-2 rounded-xl text-center shadow-inner">
                                                <span className="text-[9px] font-bold text-sky-400 block uppercase">Free Sem</span>
                                                <span className="text-base font-black text-sky-400">{free.assignedCount || 0}</span>
                                            </div>
                                            <div className="bg-slate-950/80 border border-purple-500/20 px-3.5 py-2 rounded-xl text-center shadow-inner">
                                                <span className="text-[9px] font-bold text-purple-400 block uppercase">After Sem</span>
                                                <span className="text-base font-black text-purple-400">{after.assignedCount || 0}</span>
                                            </div>
                                            <div className="bg-slate-950/80 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-center shadow-inner">
                                                <span className="text-[9px] font-bold text-emerald-400 block uppercase">Paid Enrolled</span>
                                                <span className="text-base font-black text-emerald-400">{combined.totalPaid || 0}</span>
                                            </div>
                                        </div>

                                        <div className="hidden sm:block pl-2 border-l border-white/10">
                                            <CircularProgressRing percentage={paidPct} size={56} strokeWidth={5} color="#10B981" label="Paid %" />
                                        </div>
                                    </div>
                                </div>

                                {/* THREE VISUAL CAMPAIGN MODULE TILES */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                    
                                    {/* TILE 1: FREE SEMINAR CRM */}
                                    <div className="bg-slate-950/80 border border-white/5 p-5 rounded-2xl space-y-4 shadow-xl backdrop-blur-sm hover:border-sky-500/30 transition-all">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                            <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <PhoneCall size={14} /> Free Sem CRM
                                            </span>
                                            <span className="bg-sky-950/80 text-sky-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-sky-500/30">
                                                Assigned: {free.assignedCount || 0}
                                            </span>
                                        </div>

                                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/5 flex items-center justify-between shadow-inner">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Call Answer Velocity</span>
                                                <span className="text-sm font-black text-white block mt-0.5">
                                                    {(free.phase1?.answer || 0) + (free.phase2?.answer || 0)} Calls Answered
                                                </span>
                                                <span className="text-[10px] text-sky-400 font-semibold mt-1 block">
                                                    Covered: {free.coveredCount || 0} / {free.assignedCount || 0}
                                                </span>
                                            </div>
                                            <CircularProgressRing percentage={free.callAnswerRate || 0} size={52} strokeWidth={5} color="#38BDF8" label="Answer" />
                                        </div>

                                        <div className="space-y-3 pt-1">
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Phase 1 Status Breakdown</span>
                                                <VisualProgressBar value={free.phase1?.answer || 0} max={free.phase1?.total || 1} color="bg-emerald-500" label="Answered" />
                                                <VisualProgressBar value={free.phase1?.noAnswer || 0} max={free.phase1?.total || 1} color="bg-slate-600" label="No Answer" />
                                                <VisualProgressBar value={free.phase1?.reject || 0} max={free.phase1?.total || 1} color="bg-rose-500" label="Rejected" />
                                            </div>

                                            <div className="space-y-1.5 pt-2 border-t border-white/5">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Phase 2 Status Breakdown</span>
                                                <VisualProgressBar value={free.phase2?.answer || 0} max={free.phase2?.total || 1} color="bg-emerald-500" label="Answered" />
                                                <VisualProgressBar value={free.phase2?.noAnswer || 0} max={free.phase2?.total || 1} color="bg-slate-600" label="No Answer" />
                                                <VisualProgressBar value={free.phase2?.reject || 0} max={free.phase2?.total || 1} color="bg-rose-500" label="Rejected" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* TILE 2: OPEN SEMINAR CAMPAIGN */}
                                    <div className="bg-slate-950/80 border border-white/5 p-5 rounded-2xl space-y-4 shadow-xl backdrop-blur-sm hover:border-purple-500/30 transition-all">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                            <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers size={14} /> Open Seminar Campaign
                                            </span>
                                            <span className="bg-purple-950/80 text-purple-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-500/30">
                                                Assigned: {openSem.assignedCount || 0}
                                            </span>
                                        </div>

                                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/5 space-y-2 shadow-inner">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-purple-300">Paid Conversion Target</span>
                                                <span className="text-emerald-400 font-black">{openSem.paidCount || 0} ({openSem.paidPercentage || 0}%)</span>
                                            </div>
                                            <VisualProgressBar value={openSem.paidCount || 0} max={openSem.assignedCount || 1} color="bg-purple-500" showPct={false} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="bg-slate-900/90 p-3 rounded-xl border border-white/5 space-y-2">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Round 1 Leads Funnel</span>
                                                <div className="grid grid-cols-4 gap-1.5 text-center">
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Active</span>
                                                        <span className="text-xs font-black text-emerald-400">{openSem.round1?.active || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Pending</span>
                                                        <span className="text-xs font-black text-amber-400">{openSem.round1?.pending || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">No Ans</span>
                                                        <span className="text-xs font-black text-sky-400">{openSem.round1?.noAnswer || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Reject</span>
                                                        <span className="text-xs font-black text-rose-400">{openSem.round1?.reject || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900/90 p-3 rounded-xl border border-white/5 space-y-2">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Round 2 Leads Funnel</span>
                                                <div className="grid grid-cols-4 gap-1.5 text-center">
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Active</span>
                                                        <span className="text-xs font-black text-emerald-400">{openSem.round2?.active || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Pending</span>
                                                        <span className="text-xs font-black text-amber-400">{openSem.round2?.pending || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">No Ans</span>
                                                        <span className="text-xs font-black text-sky-400">{openSem.round2?.noAnswer || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Reject</span>
                                                        <span className="text-xs font-black text-rose-400">{openSem.round2?.reject || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TILE 3: NEW INQUIRIES CAMPAIGN */}
                                    <div className="bg-slate-950/80 border border-white/5 p-5 rounded-2xl space-y-4 shadow-xl backdrop-blur-sm hover:border-indigo-500/30 transition-all">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Activity size={14} /> New Inquiries Campaign
                                            </span>
                                            <span className="bg-indigo-950/80 text-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                                                Assigned: {newInq.assignedCount || 0}
                                            </span>
                                        </div>

                                        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/5 space-y-2 shadow-inner">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-indigo-300">Paid Conversion Target</span>
                                                <span className="text-emerald-400 font-black">{newInq.paidCount || 0} ({newInq.paidPercentage || 0}%)</span>
                                            </div>
                                            <VisualProgressBar value={newInq.paidCount || 0} max={newInq.assignedCount || 1} color="bg-indigo-500" showPct={false} />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="bg-slate-900/90 p-3 rounded-xl border border-white/5 space-y-2">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Round 1 Leads Funnel</span>
                                                <div className="grid grid-cols-4 gap-1.5 text-center">
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Active</span>
                                                        <span className="text-xs font-black text-emerald-400">{newInq.round1?.active || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Pending</span>
                                                        <span className="text-xs font-black text-amber-400">{newInq.round1?.pending || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">No Ans</span>
                                                        <span className="text-xs font-black text-sky-400">{newInq.round1?.noAnswer || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Reject</span>
                                                        <span className="text-xs font-black text-rose-400">{newInq.round1?.reject || 0}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900/90 p-3 rounded-xl border border-white/5 space-y-2">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Round 2 Leads Funnel</span>
                                                <div className="grid grid-cols-4 gap-1.5 text-center">
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Active</span>
                                                        <span className="text-xs font-black text-emerald-400">{newInq.round2?.active || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Pending</span>
                                                        <span className="text-xs font-black text-amber-400">{newInq.round2?.pending || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">No Ans</span>
                                                        <span className="text-xs font-black text-sky-400">{newInq.round2?.noAnswer || 0}</span>
                                                    </div>
                                                    <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                                                        <span className="text-[8px] text-slate-400 block uppercase">Reject</span>
                                                        <span className="text-xs font-black text-rose-400">{newInq.round2?.reject || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* 🌟 6. REDESIGNED DATE-WISE MESSAGING & CALLING ACTIVITY TABLE */}
                                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                    
                                    {/* Table Header Controls */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-2xl border border-white/10 shadow-lg">
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs md:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 uppercase tracking-wider flex items-center gap-2">
                                                <Activity size={16} className="text-indigo-400" /> Date-Wise Messaging & Calling Activity Log
                                            </h4>
                                            <p className="text-slate-400 text-xs font-medium">
                                                Daily count of unique student phone numbers messaged/called vs total messages & call attempts.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/5">
                                                <CalendarIcon size={12} className="text-indigo-400" /> {startDate} — {endDate}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Glassmorphic Ultra-Modern Table */}
                                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-md">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border-b border-white/10 text-slate-300 uppercase font-black tracking-wider text-[11px]">
                                                    <th className="py-4 px-5">Date</th>
                                                    <th className="py-4 px-4 text-center text-sky-400">Free Sem Unique</th>
                                                    <th className="py-4 px-4 text-center text-slate-300">Free Sem Msgs</th>
                                                    <th className="py-4 px-4 text-center text-amber-400">Free Sem Calls</th>
                                                    <th className="py-4 px-4 text-center text-indigo-400">All Unique Numbers</th>
                                                    <th className="py-4 px-4 text-center text-slate-300">All Msgs</th>
                                                    <th className="py-4 px-4 text-center text-purple-400">All Calls</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.04] font-medium">
                                                {(coord.dateWiseBreakdown || []).map((row, idx) => {
                                                    const isToday = row.date === todayStr;
                                                    const hasActivity = (row.allCallsTotal > 0 || row.allMsgTotal > 0 || row.freeMsgTotal > 0);

                                                    return (
                                                        <tr 
                                                            key={idx} 
                                                            className={`transition-colors duration-150 ${isToday ? 'bg-indigo-950/30 hover:bg-indigo-900/40 border-l-4 border-l-indigo-500' : 'hover:bg-slate-900/70'} ${!hasActivity ? 'opacity-60 hover:opacity-100' : ''}`}
                                                        >
                                                            <td className="py-3.5 px-5 font-bold text-white flex items-center gap-2.5">
                                                                <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-emerald-400 animate-pulse' : hasActivity ? 'bg-indigo-400' : 'bg-slate-700'}`}></span>
                                                                <span className="tracking-tight">{row.date}</span>
                                                                {isToday && (
                                                                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border border-emerald-500/30 ml-1">
                                                                        Today
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                {row.freeMsgUnique > 0 ? (
                                                                    <span className="inline-block bg-sky-500/15 text-sky-300 font-black px-3 py-1 rounded-xl border border-sky-500/30 shadow-sm">
                                                                        {row.freeMsgUnique} Unique
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600 font-bold">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-bold">
                                                                {row.freeMsgTotal > 0 ? (
                                                                    <span className="text-slate-200">{row.freeMsgTotal}</span>
                                                                ) : (
                                                                    <span className="text-slate-600">0</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-black">
                                                                {row.freeCallsTotal > 0 ? (
                                                                    <span className="inline-block bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                                                                        {row.freeCallsTotal}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600">0</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                {row.allMsgUnique > 0 ? (
                                                                    <span className="inline-block bg-indigo-500/15 text-indigo-300 font-black px-3 py-1 rounded-xl border border-indigo-500/30 shadow-sm">
                                                                        {row.allMsgUnique} Unique
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600 font-bold">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-bold">
                                                                {row.allMsgTotal > 0 ? (
                                                                    <span className="text-slate-200">{row.allMsgTotal}</span>
                                                                ) : (
                                                                    <span className="text-slate-600">0</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-black">
                                                                {row.allCallsTotal > 0 ? (
                                                                    <span className="inline-block bg-purple-500/15 text-purple-300 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
                                                                        {row.allCallsTotal}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600">0</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}

                                                {/* Summary Total Row */}
                                                {coord.dateWiseTotals && (
                                                    <tr className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 font-black text-white border-t-2 border-indigo-500/40 shadow-lg">
                                                        <td className="py-4 px-5 uppercase text-indigo-300 font-black tracking-wider text-xs flex items-center gap-2">
                                                            <Award size={16} className="text-indigo-400" /> TOTAL (Net)
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className="inline-block bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-black px-3.5 py-1 rounded-xl text-xs shadow-md">
                                                                {coord.dateWiseTotals.freeMsgUniqueNet} Unique
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-center text-slate-100 font-extrabold">
                                                            {coord.dateWiseTotals.freeMsgTotal} Msgs
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className="inline-block bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 font-black">
                                                                {coord.dateWiseTotals.freeCallsTotal} Calls
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black px-3.5 py-1 rounded-xl text-xs shadow-md">
                                                                {coord.dateWiseTotals.allMsgUniqueNet} Unique
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-4 text-center text-slate-100 font-extrabold">
                                                            {coord.dateWiseTotals.allMsgTotal} Msgs
                                                        </td>
                                                        <td className="py-4 px-4 text-center">
                                                            <span className="inline-block bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-500/40 font-black">
                                                                {coord.dateWiseTotals.allCallsTotal} Calls
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

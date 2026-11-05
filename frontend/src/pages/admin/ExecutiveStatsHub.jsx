import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';
import {
    BarChart3, TrendingUp, Users, PhoneCall, CheckCircle2, Clock, AlertTriangle,
    XCircle, HelpCircle, Layers, ArrowLeft, RefreshCw, Download, Filter, Building2,
    Search, Award, Sparkles, ChevronRight, PieChart as PieIcon, ShieldCheck,
    PhoneForwarded, DollarSign, Calendar, Flame, Eye, ArrowUpRight, GraduationCap,
    CheckSquare, UserCheck, Activity, Target, Zap, MessageSquare, Send, Inbox, MessageCircle,
    ChevronDown, ChevronUp, UserX, UserPlus, CreditCard, RotateCcw, TrendingDown,
    Hash, PhoneIncoming, PhoneOutgoing, UserMinus, FileText, CheckCheck, Brain, Bot
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import LumiAiAnalyserAssistant from '../../components/admin/LumiAiAnalyserAssistant';

// Helper to construct fully qualified image URLs for the backend
const resolveBackendUrl = (path, subDir = 'icons') => {
    if (!path || path === 'default.png') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    let base = (axios.defaults && axios.defaults.baseURL)
        ? axios.defaults.baseURL.replace('/api', '')
        : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
    if (!base) base = 'http://localhost:5000';
    if (base.endsWith('/')) base = base.slice(0, -1);

    if (path.startsWith('/storage/') || path.startsWith('storage/')) {
        const clean = path.startsWith('/') ? path : `/${path}`;
        return `${base}${clean}`;
    }

    return `${base}/storage/${subDir}/${path}`;
};

// Robust Avatar Component with foolproof fallback (Never shows broken image)
const SafeAvatar = ({ image, name, size = 'w-9 h-9', textSize = 'text-xs', rank = null }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const imageUrl = useMemo(() => resolveBackendUrl(image, 'users'), [image]);

    const initials = useMemo(() => {
        if (!name) return 'ST';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }, [name]);

    if (imageUrl && !imgFailed) {
        return (
            <img
                src={imageUrl}
                alt={name || 'Avatar'}
                className={`${size} rounded-xl object-cover border-2 border-slate-600/60 shadow-md shrink-0`}
                onError={() => setImgFailed(true)}
            />
        );
    }

    const gradientColors = rank === 1
        ? 'from-amber-500 via-amber-600 to-yellow-400 border-amber-300 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
        : 'from-blue-600 via-indigo-600 to-purple-600 border-indigo-400/50 text-white shadow-md';

    return (
        <div className={`${size} rounded-xl bg-gradient-to-tr ${gradientColors} border font-black ${textSize} flex items-center justify-center shrink-0 tracking-wider shadow-inner`}>
            {initials}
        </div>
    );
};

// Robust Business Logo Component with foolproof fallback
const SafeBusinessLogo = ({ logo, name, size = 'w-14 h-14', padding = 'p-2' }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const logoUrl = useMemo(() => resolveBackendUrl(logo, 'icons'), [logo]);

    if (logoUrl && !imgFailed) {
        return (
            <div className={`${size} ${padding} rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-lg`}>
                <img
                    src={logoUrl}
                    alt={name || 'Logo'}
                    className="max-w-full max-h-full object-contain drop-shadow-md"
                    onError={() => setImgFailed(true)}
                />
            </div>
        );
    }

    return (
        <div className={`${size} rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-lg`}>
            <Building2 className="text-blue-400" size={28} />
        </div>
    );
};

// Reusable 4-Round Cards Grid Component (used for Batch totals & per-coordinator breakdown)
const RoundCardsGrid = ({ rounds, isCompact = false }) => {
    const r1 = rounds?.round1 || { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 };
    const r2 = rounds?.round2 || { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 };
    const nonEnr = rounds?.nonEnrolled || { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 };
    const enr = rounds?.enrolledPaid || { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 };

    if (isCompact) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Round 1 */}
                <div className="bg-slate-950/85 border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">ROUND 01</span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            {r1.assigned} Assigned
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Answered</p>
                            <p className="text-xl font-black text-emerald-400 mt-0.5">{r1.answered}</p>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-blue-400 font-bold uppercase">Pending</p>
                            <p className="text-xl font-black text-blue-400 mt-0.5">{r1.pending}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-slate-300">
                        <div>No Ans: <strong className="text-amber-400 font-black">{r1.noAnswer}</strong></div>
                        <div>Reject: <strong className="text-rose-400 font-black">{r1.reject}</strong></div>
                    </div>
                </div>

                {/* Round 2 */}
                <div className="bg-slate-950/85 border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">ROUND 02</span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {r2.assigned} Assigned
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Answered</p>
                            <p className="text-xl font-black text-emerald-400 mt-0.5">{r2.answered}</p>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-blue-400 font-bold uppercase">Pending</p>
                            <p className="text-xl font-black text-blue-400 mt-0.5">{r2.pending}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-slate-300">
                        <div>No Ans: <strong className="text-amber-400 font-black">{r2.noAnswer}</strong></div>
                        <div>Reject: <strong className="text-rose-400 font-black">{r2.reject}</strong></div>
                    </div>
                </div>

                {/* Non Enrolled */}
                <div className="bg-slate-950/85 border border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">NON ENROLLED</span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {nonEnr.assigned} Assigned
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Answered</p>
                            <p className="text-xl font-black text-emerald-400 mt-0.5">{nonEnr.answered}</p>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-blue-400 font-bold uppercase">Pending</p>
                            <p className="text-xl font-black text-blue-400 mt-0.5">{nonEnr.pending}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-slate-300">
                        <div>No Ans: <strong className="text-amber-400 font-black">{nonEnr.noAnswer}</strong></div>
                        <div>Reject: <strong className="text-rose-400 font-black">{nonEnr.reject}</strong></div>
                    </div>
                </div>

                {/* Enrolled Paid */}
                <div className="bg-emerald-950/50 border border-emerald-500/40 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-300">ENROLLED (PAID)</span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                            {enr.assigned} Paid
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-emerald-500/30">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Answered</p>
                            <p className="text-xl font-black text-emerald-400 mt-0.5">{enr.answered}</p>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-xl border border-emerald-500/30">
                            <p className="text-[10px] text-blue-400 font-bold uppercase">Pending</p>
                            <p className="text-xl font-black text-blue-400 mt-0.5">{enr.pending}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold bg-slate-900/60 p-2 rounded-xl border border-emerald-500/30 text-slate-300">
                        <div>No Ans: <strong className="text-amber-400 font-black">{enr.noAnswer}</strong></div>
                        <div>Reject: <strong className="text-rose-400 font-black">{enr.reject}</strong></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ROUND 01 */}
            <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-4 shadow-xl">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center justify-between">
                    <span>ROUND 01</span>
                    <span className="text-xs text-blue-400 font-bold">First Inflow</span>
                </h5>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">ASSIGNED</p>
                        <p className="text-2xl font-black text-white mt-0.5">{r1.assigned}</p>
                    </div>
                    <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">ANSWERED</p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{r1.answered}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                    <div>PEND: <strong className="text-blue-400">{r1.pending}</strong></div>
                    <div>NO ANS: <strong className="text-amber-400">{r1.noAnswer}</strong></div>
                    <div>REJ: <strong className="text-rose-400">{r1.reject}</strong></div>
                </div>
                <div className="text-xs font-black text-amber-400 bg-amber-500/15 p-2 rounded-xl text-center border border-amber-500/30">
                    Delayed KPI: {r1.delayed || 0}
                </div>
            </div>

            {/* ROUND 02 */}
            <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-4 shadow-xl">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center justify-between">
                    <span>ROUND 02</span>
                    <span className="text-xs text-purple-400 font-bold">Follow-up</span>
                </h5>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">ASSIGNED</p>
                        <p className="text-2xl font-black text-white mt-0.5">{r2.assigned}</p>
                    </div>
                    <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">ANSWERED</p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{r2.answered}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                    <div>PEND: <strong className="text-blue-400">{r2.pending}</strong></div>
                    <div>NO ANS: <strong className="text-amber-400">{r2.noAnswer}</strong></div>
                    <div>REJ: <strong className="text-rose-400">{r2.reject}</strong></div>
                </div>
                <div className="text-xs font-black text-amber-400 bg-amber-500/15 p-2 rounded-xl text-center border border-amber-500/30">
                    Delayed KPI: {r2.delayed || 0}
                </div>
            </div>

            {/* NON ENROLLED */}
            <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-4 shadow-xl">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center justify-between">
                    <span>NON ENROLLED</span>
                    <span className="text-xs text-rose-400 font-bold">Dropped</span>
                </h5>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">ASSIGNED</p>
                        <p className="text-2xl font-black text-white mt-0.5">{nonEnr.assigned}</p>
                    </div>
                    <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">ANSWERED</p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{nonEnr.answered}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                    <div>PEND: <strong className="text-blue-400">{nonEnr.pending}</strong></div>
                    <div>NO ANS: <strong className="text-amber-400">{nonEnr.noAnswer}</strong></div>
                    <div>REJ: <strong className="text-rose-400">{nonEnr.reject}</strong></div>
                </div>
                <div className="text-xs font-black text-amber-400 bg-amber-500/15 p-2 rounded-xl text-center border border-amber-500/30">
                    Delayed KPI: {nonEnr.delayed || 0}
                </div>
            </div>

            {/* ENROLLED PAID */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-5 rounded-2xl space-y-4 shadow-xl">
                <h5 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center justify-between">
                    <span>ENROLLED (PAID)</span>
                    <span className="text-xs text-emerald-400 font-bold">Converted</span>
                </h5>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="bg-slate-900/90 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">TOTAL PAID</p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{enr.assigned}</p>
                    </div>
                    <div className="bg-slate-900/90 p-3 rounded-2xl border border-emerald-500/30">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">ANSWERED</p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">{enr.answered}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                    <div>PEND: <strong className="text-blue-400">{enr.pending}</strong></div>
                    <div>NO ANS: <strong className="text-amber-400">{enr.noAnswer}</strong></div>
                    <div>REJ: <strong className="text-rose-400">{enr.reject}</strong></div>
                </div>
                <div className="text-xs font-black text-emerald-300 bg-emerald-500/20 p-2 rounded-xl text-center border border-emerald-500/30 flex items-center justify-center gap-1.5">
                    <CheckCheck size={14} /> Verified Payments
                </div>
            </div>
        </div>
    );
};

export default function ExecutiveStatsHub({ loggedInUser }) {
    // -------------------------------------------------------------
    // STATES
    // -------------------------------------------------------------
    const [loading, setLoading] = useState(true);
    const [exportingImage, setExportingImage] = useState(false);
    
    // View Levels: 'businesses' | 'dashboard'
    const [viewLevel, setViewLevel] = useState('businesses');
    const [selectedBusinessId, setSelectedBusinessId] = useState(null);
    const [selectedBatchId, setSelectedBatchId] = useState('ALL');
    
    // Time filter: 'all' | 'today' | 'this_week' | 'this_month' | 'custom'
    const [timeFilter, setTimeFilter] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Main 2 Sections: 'free_sem' | 'after_sem'
    const [mainSection, setMainSection] = useState('free_sem');

    // Free Seminar Sub-Views: 'call_campaign' | 'whatsapp_messages'
    const [freeSemSubView, setFreeSemSubView] = useState('call_campaign');

    // After Seminar Sub-Views: 'open_seminar' | 'new_inquiries' | 'paid_campaign' | 'whatsapp_messages'
    const [afterSemSubView, setAfterSemSubView] = useState('open_seminar');

    // Active expanded group in Paid Campaign Cohort
    const [expandedGroupIds, setExpandedGroupIds] = useState({});

    // Search query for businesses
    const [bizSearchQuery, setBizSearchQuery] = useState('');

    // LUMI AI Assistant Modal/Drawer State
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

    // Analytics Data Store
    const [analyticsData, setAnalyticsData] = useState({
        selectedBusiness: null,
        selectedBatch: null,
        businesses: [],
        overview: null,
        freeSeminar: null,
        afterSeminar: null
    });

    const reportRef = useRef(null);

    // -------------------------------------------------------------
    // DATA FETCHING
    // -------------------------------------------------------------
    const fetchAnalytics = async (bizId = selectedBusinessId, batchId = selectedBatchId) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = {
                businessId: bizId || 'ALL',
                batchId: batchId || 'ALL',
                timeFilter
            };
            if (timeFilter === 'custom') {
                if (customStartDate) params.startDate = customStartDate;
                if (customEndDate) params.endDate = customEndDate;
            }

            const res = await axios.get('/admin/all-in-one-analytics', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (res.data) {
                setAnalyticsData(res.data);
                if (bizId && res.data.selectedBusiness) {
                    setViewLevel('dashboard');
                }
            }
        } catch (error) {
            console.error("Failed to load analytics:", error);
            toast.error("Failed to fetch analytics data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics(selectedBusinessId, selectedBatchId);
    }, [selectedBusinessId, selectedBatchId, timeFilter, customStartDate, customEndDate]);

    // -------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------
    const handleSelectBusiness = (biz) => {
        setSelectedBusinessId(biz.id);
        setSelectedBatchId('ALL');
        setViewLevel('dashboard');
    };

    const handleBackToBusinesses = () => {
        setViewLevel('businesses');
        setSelectedBusinessId(null);
        setSelectedBatchId('ALL');
    };

    const toggleGroupAccordion = (groupId) => {
        setExpandedGroupIds(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    // -------------------------------------------------------------
    // EXPORT REPORT AS IMAGE (PNG)
    // -------------------------------------------------------------
    const handleExportImage = async () => {
        if (!reportRef.current) return;
        setExportingImage(true);
        const toastId = toast.loading("Generating high-resolution report image...");

        try {
            await new Promise(r => setTimeout(r, 200));

            const dataUrl = await toPng(reportRef.current, {
                cacheBust: true,
                backgroundColor: '#0c1322',
                pixelRatio: 2
            });

            const link = document.createElement('a');
            const bizName = (analyticsData.selectedBusiness?.name || 'IMA_Campus').replace(/\s+/g, '_');
            const sectionName = mainSection === 'free_sem' ? `FreeSem_${freeSemSubView}` : `AfterSem_${afterSemSubView}`;
            const dateStr = new Date().toISOString().split('T')[0];

            link.href = dataUrl;
            link.download = `${bizName}_${sectionName}_Report_${dateStr}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Executive report exported successfully!", { id: toastId, icon: '📸' });
        } catch (error) {
            console.error("Report image export failed:", error);
            toast.error("Failed to export report image", { id: toastId });
        } finally {
            setExportingImage(false);
        }
    };

    // Filtered businesses list
    const filteredBusinesses = useMemo(() => {
        const list = analyticsData.businesses || [];
        if (!bizSearchQuery.trim()) return list;
        const q = bizSearchQuery.toLowerCase().trim();
        return list.filter(b => 
            b.name.toLowerCase().includes(q) || 
            b.category?.toLowerCase().includes(q) ||
            b.streams?.toLowerCase().includes(q)
        );
    }, [analyticsData.businesses, bizSearchQuery]);

    // Current active business & batch objects
    const currentBiz = analyticsData.selectedBusiness;
    const currentBatch = analyticsData.selectedBatch;
    const freeSem = analyticsData.freeSeminar || {};
    const freeSemWhatsapp = freeSem.whatsappMessages || {};
    const afterSem = analyticsData.afterSeminar || {};
    const afterSemWhatsapp = afterSem.whatsappMessages || {};
    const openSem = afterSem.openSeminar || {};
    const newInq = afterSem.newInquiries || {};
    const paidCamp = afterSem.paidCampaign || {};
    const paymentGroups = paidCamp.paymentGroups || [];
    const taskCenter = analyticsData.taskCenter || {};

    // -------------------------------------------------------------
    // RENDER: LEVEL 1 - BUSINESS DIRECTORY CARDS
    // -------------------------------------------------------------
    if (viewLevel === 'businesses' || !currentBiz) {
        return (
            <div className="min-h-full flex flex-col gap-6 animate-fade-in-up text-slate-100 pb-16">
                
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-[#131d36] via-[#1a233d] to-[#0f172a] backdrop-blur-2xl p-7 sm:p-9 rounded-3xl border border-slate-700/60 shadow-[0_12px_40px_rgba(0,0,0,0.45)] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 blur-[90px] pointer-events-none rounded-full" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2.5">
                            <span className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/30 via-cyan-500/30 to-emerald-500/30 text-cyan-300 border border-cyan-400/40 shadow-lg shadow-cyan-500/20 animate-pulse">
                                <Sparkles size={26} />
                            </span>
                            <span className="text-xs font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                                <Brain size={13} /> Gemini 2.5 Flash • Predictive Intelligence Engine
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            LUMI AI Analyser
                        </h1>
                        <p className="text-slate-300 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
                            Enterprise intelligence & forecasting hub. Select a business unit to explore real-time conversion matrices, staff SLA audits, and automated future batch predictions.
                        </p>
                    </div>

                    {/* Search, Ask AI & Refresh */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10">
                        <button
                            onClick={() => setIsAiAssistantOpen(true)}
                            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-emerald-400 hover:from-purple-500 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/30 hover:scale-105 cursor-pointer"
                        >
                            <Sparkles size={16} className="text-slate-950 animate-spin" />
                            <span>✨ Ask LUMI AI</span>
                        </button>

                        <div className="relative flex-1 md:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={bizSearchQuery}
                                onChange={(e) => setBizSearchQuery(e.target.value)}
                                placeholder="Search business or stream..."
                                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-400 outline-none focus:border-cyan-400 transition-all shadow-inner"
                            />
                        </div>
                        <button
                            onClick={() => fetchAnalytics()}
                            disabled={loading}
                            className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 hover:text-white transition-all shadow-lg outline-none cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin text-cyan-400' : ''} />
                        </button>
                    </div>
                </div>

                {/* Businesses Cards Grid */}
                {loading && filteredBusinesses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
                        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-extrabold uppercase tracking-widest text-slate-300">Loading Business Units...</span>
                    </div>
                ) : filteredBusinesses.length === 0 ? (
                    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-14 text-center text-slate-400">
                        <Building2 size={56} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-extrabold text-slate-200">No matching business found</h3>
                        <p className="text-sm text-slate-400 mt-1">Try clearing your search filter.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredBusinesses.map((biz) => (
                            <div
                                key={biz.id}
                                onClick={() => handleSelectBusiness(biz)}
                                className="group cursor-pointer bg-gradient-to-b from-slate-800/70 to-slate-900/90 hover:from-slate-800 hover:to-slate-900 backdrop-blur-2xl border border-slate-700/60 hover:border-blue-400/80 p-7 rounded-[2rem] flex flex-col justify-between gap-6 transition-all duration-300 shadow-[0_10px_35px_rgba(0,0,0,0.4)] hover:shadow-2xl hover:-translate-y-1.5 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/10 group-hover:bg-blue-500/20 blur-[60px] transition-all rounded-full pointer-events-none" />

                                <div>
                                    <div className="flex items-center gap-4 mb-5">
                                        <SafeBusinessLogo logo={biz.logo} name={biz.name} size="w-16 h-16" padding="p-2.5" />
                                        <div className="flex-1 overflow-hidden">
                                            <h3 className="text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors truncate" title={biz.name}>
                                                {biz.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-lg shadow-sm">
                                                    {biz.category || 'Academic'}
                                                </span>
                                                <span className="text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-lg">
                                                    {biz.batchesCount} {biz.batchesCount === 1 ? 'Batch' : 'Batches'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Head Manager</span>
                                            <span className="font-extrabold text-slate-100 truncate pl-2 text-sm">
                                                {biz.headManager ? `${biz.headManager.firstName} ${biz.headManager.lastName || ''}`.trim() : 'Unassigned'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Asst. Manager</span>
                                            <span className="font-extrabold text-slate-100 truncate pl-2 text-sm">
                                                {biz.assManager ? `${biz.assManager.firstName} ${biz.assManager.lastName || ''}`.trim() : 'Unassigned'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="grid grid-cols-3 gap-3 py-3 border-t border-slate-700/60 text-center">
                                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 shadow-inner">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</p>
                                            <p className="text-2xl font-black text-white mt-1">{biz.totalLeads?.toLocaleString() || 0}</p>
                                        </div>
                                        <div className="bg-emerald-950/40 p-3 rounded-2xl border border-emerald-500/30 shadow-inner">
                                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Free Sem</p>
                                            <p className="text-2xl font-black text-emerald-300 mt-1">{biz.freeSemLeads?.toLocaleString() || 0}</p>
                                        </div>
                                        <div className="bg-purple-950/40 p-3 rounded-2xl border border-purple-500/30 shadow-inner">
                                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">After Sem</p>
                                            <p className="text-2xl font-black text-purple-300 mt-1">{biz.afterSemLeads?.toLocaleString() || 0}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between text-sm font-extrabold text-blue-400 group-hover:text-blue-300 transition-colors">
                                        <span>Open Intelligence Dashboard</span>
                                        <ArrowUpRight size={20} className="transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* LUMI AI Strategic Analyst Assistant Modal/Drawer */}
                <LumiAiAnalyserAssistant
                    isOpen={isAiAssistantOpen}
                    onClose={() => setIsAiAssistantOpen(false)}
                    businesses={analyticsData.businesses}
                    currentContext={{
                        selectedBusiness: currentBiz,
                        selectedBatch: currentBatch,
                        timeFilter,
                        freeSeminar: freeSem,
                        afterSeminar: afterSem,
                        taskCenter,
                        overview: analyticsData.overview
                    }}
                />
            </div>
        );
    }

    // -------------------------------------------------------------
    // RENDER: LEVEL 2 - BUSINESS ANALYTICS DASHBOARD
    // -------------------------------------------------------------
    return (
        <div className="min-h-full flex flex-col gap-6 animate-fade-in-up text-slate-100 pb-20">
            
            {/* STICKY TOP CONTROL & FILTER BAR */}
            <div className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBackToBusinesses}
                        className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 hover:text-white transition-all shadow-md outline-none flex items-center gap-2 text-xs font-black cursor-pointer uppercase tracking-wider"
                        title="Back to all businesses"
                    >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Businesses</span>
                    </button>

                    <div className="flex items-center gap-3.5 bg-slate-900 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-inner">
                        <SafeBusinessLogo logo={currentBiz.logo} name={currentBiz.name} size="w-10 h-10" padding="p-1" />
                        <div className="truncate max-w-[200px] sm:max-w-xs">
                            <h2 className="text-base font-black text-white truncate" title={currentBiz.name}>{currentBiz.name}</h2>
                            <span className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">{currentBiz.category || 'General'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-end">
                    
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-2xl px-3 py-2">
                        <Building2 size={16} className="text-slate-400 shrink-0" />
                        <select
                            value={selectedBusinessId || ''}
                            onChange={(e) => {
                                setSelectedBusinessId(parseInt(e.target.value));
                                setSelectedBatchId('ALL');
                            }}
                            className="bg-transparent text-xs font-extrabold text-slate-100 outline-none cursor-pointer max-w-[150px] truncate"
                        >
                            {analyticsData.businesses.map(b => (
                                <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-blue-500/40 rounded-2xl px-3.5 py-2 shadow-md">
                        <Layers size={16} className="text-blue-400 shrink-0" />
                        <select
                            value={selectedBatchId}
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            className="bg-transparent text-xs font-black text-blue-300 outline-none cursor-pointer max-w-[180px] truncate"
                        >
                            <option value="ALL" className="bg-slate-900 text-white">✨ All Batches ({currentBiz.batches?.length || 0})</option>
                            {currentBiz.batches?.map(b => (
                                <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-2xl px-3 py-2">
                        <Calendar size={16} className="text-slate-400 shrink-0" />
                        <select
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="bg-transparent text-xs font-extrabold text-slate-100 outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-slate-900 text-white">All Time</option>
                            <option value="today" className="bg-slate-900 text-white">Today</option>
                            <option value="this_week" className="bg-slate-900 text-white">This Week</option>
                            <option value="this_month" className="bg-slate-900 text-white">This Month</option>
                            <option value="custom" className="bg-slate-900 text-white">Custom Range</option>
                        </select>
                    </div>

                    {timeFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                            />
                        </div>
                    )}

                    {/* Ask LUMI AI Strategy Button */}
                    <button
                        onClick={() => setIsAiAssistantOpen(true)}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-emerald-400 hover:from-purple-500 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/30 hover:scale-105 outline-none cursor-pointer"
                        title="Open LUMI AI Strategic Analyst & Future Forecast Engine"
                    >
                        <Sparkles size={16} className="text-slate-950 animate-spin" />
                        <span>✨ Ask LUMI AI</span>
                    </button>

                    <button
                        onClick={handleExportImage}
                        disabled={exportingImage || loading}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2 outline-none cursor-pointer uppercase tracking-wider"
                        title="Download high-resolution image report"
                    >
                        <Download size={16} />
                        <span>{exportingImage ? 'Exporting...' : 'Export Report (PNG)'}</span>
                    </button>

                    <button
                        onClick={() => fetchAnalytics(selectedBusinessId, selectedBatchId)}
                        disabled={loading}
                        className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-md outline-none cursor-pointer"
                        title="Refresh Analytics"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
                    </button>
                </div>
            </div>

            {/* 3 MAIN SECTIONS TABS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-700/80 pb-5 gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setMainSection('free_sem')}
                        className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                            mainSection === 'free_sem'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-2 border-emerald-400/50 shadow-emerald-900/50 scale-[1.02]'
                                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                        }`}
                    >
                        <PhoneCall size={18} />
                        <span>01. Free Seminar</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950/60 text-emerald-300 border border-emerald-500/40 font-black">
                            {freeSem.total?.toLocaleString() || 0}
                        </span>
                    </button>

                    <button
                        onClick={() => setMainSection('after_sem')}
                        className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                            mainSection === 'after_sem'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-2 border-purple-400/50 shadow-purple-900/50 scale-[1.02]'
                                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                        }`}
                    >
                        <Target size={18} />
                        <span>02. After Seminar</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950/60 text-purple-300 border border-purple-500/40 font-black">
                            {afterSem.total?.toLocaleString() || 0}
                        </span>
                    </button>

                    <button
                        onClick={() => setMainSection('task_center')}
                        className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                            mainSection === 'task_center'
                                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white border-2 border-cyan-400/50 shadow-blue-900/50 scale-[1.02]'
                                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                        }`}
                    >
                        <CheckSquare size={18} />
                        <span>03. Task Center Operations</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950/60 text-cyan-300 border border-cyan-500/40 font-black">
                            {taskCenter.total?.toLocaleString() || 0}
                        </span>
                    </button>
                </div>

                {mainSection === 'free_sem' && (
                    <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/80 shadow-inner">
                        <button
                            onClick={() => setFreeSemSubView('call_campaign')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                freeSemSubView === 'call_campaign'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <PhoneCall size={15} /> i. Call Campaign
                        </button>
                        <button
                            onClick={() => setFreeSemSubView('whatsapp_messages')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                freeSemSubView === 'whatsapp_messages'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <MessageSquare size={15} /> ii. WhatsApp Messages
                        </button>
                    </div>
                )}
            </div>

            {/* REPORT CAPTURE WRAPPER FOR HIGH-RES EXPORT */}
            <div ref={reportRef} className="flex flex-col gap-7 p-7 sm:p-9 bg-gradient-to-b from-[#0e1628] via-[#111a30] to-[#0c1322] rounded-3xl border border-slate-700/70 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
                
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-[#0e1628]/80 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center gap-3 animate-fade-in">
                        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Synchronizing Real-Time Business Intelligence...</p>
                    </div>
                )}
                
                {/* Executive Report Branded Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-700/70 gap-4">
                    <div className="flex items-center gap-4">
                        <SafeBusinessLogo logo={currentBiz.logo} name={currentBiz.name} size="w-16 h-16" padding="p-2" />
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{currentBiz.name}</h2>
                                <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm">
                                    {currentBatch ? currentBatch.name : 'All Active Batches'}
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                                LUMI AI Analyser • Predictive Intelligence & Executive Performance Report • Generated on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                        <div className="bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl shadow-md">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Filter</p>
                            <p className="text-sm font-black text-emerald-400">{timeFilter.replace('_', ' ').toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* 01. FREE SEMINAR SECTION */}
                {/* ========================================================= */}
                {mainSection === 'free_sem' && (
                    <div className="flex flex-col gap-7 animate-fade-in">
                        
                        {/* SUB-VIEW 1: CALL CAMPAIGN DATA */}
                        {freeSemSubView === 'call_campaign' && (
                            <>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Total Leads</p>
                                        <p className="text-3xl sm:text-4xl font-black text-white mt-1">{freeSem.total?.toLocaleString() || 0}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            <span className="text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md border border-rose-500/30">
                                                {freeSem.unassigned || 0} UNASSIGNED
                                            </span>
                                            <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                                                {freeSem.callCenterAssigned || 0} CALL CENTER
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Total Assigned</p>
                                        <p className="text-3xl sm:text-4xl font-black text-blue-400 mt-1">{freeSem.assigned?.toLocaleString() || 0}</p>
                                        <p className="text-xs font-extrabold text-blue-400/80 mt-2">Active Coordinators</p>
                                    </div>

                                    <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Covered Leads</p>
                                        <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">{freeSem.covered?.toLocaleString() || 0}</p>
                                        <p className="text-xs font-extrabold text-emerald-400 mt-2">
                                            {freeSem.answered || 0} Ans <span className="text-slate-400 font-normal">/</span> {freeSem.noAnswer || 0} No Ans
                                        </p>
                                    </div>

                                    <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-300">Pending Leads</p>
                                        <p className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">{freeSem.pending?.toLocaleString() || 0}</p>
                                        <p className="text-xs font-extrabold text-amber-400/80 mt-2">Remaining Calls</p>
                                    </div>

                                    <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl col-span-2 lg:col-span-1 shadow-xl flex flex-col justify-between">
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-300">Response Rate</p>
                                            <span className="text-[10px] font-extrabold text-slate-400">(Ans/Assigned)</span>
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-black text-yellow-400 mt-1">{freeSem.responseRate || 0}%</p>
                                        <div className="w-full bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden border border-slate-700">
                                            <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full" style={{ width: `${Math.min(100, freeSem.responseRate || 0)}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    
                                    <div className="lg:col-span-7 bg-slate-900/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="p-4 sm:p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
                                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2.5">
                                                <Users size={18} className="text-blue-400" /> Coordinator Performance Matrix
                                            </h4>
                                            <span className="text-xs font-extrabold text-blue-300 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/30">
                                                {freeSem.coordinators?.length || 0} Coordinators
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                                    <tr>
                                                        <th className="py-3.5 px-4">Coordinator</th>
                                                        <th className="py-3.5 px-3 text-right">Assigned</th>
                                                        <th className="py-3.5 px-3 text-right text-blue-400">Pending</th>
                                                        <th className="py-3.5 px-3 text-right text-emerald-400">Answered</th>
                                                        <th className="py-3.5 px-3 text-right text-amber-400">No Ans</th>
                                                        <th className="py-3.5 px-3 text-right text-rose-400">Reject</th>
                                                        <th className="py-3.5 pr-4 text-right text-yellow-400">Resp Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/80 font-medium">
                                                    {freeSem.coordinators?.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="7" className="text-center py-10 text-slate-400 font-bold">
                                                                No coordinator allocations found for this filter
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        freeSem.coordinators?.map((c, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                                <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                                                                    <SafeAvatar image={c.image} name={c.name} size="w-8 h-8" textSize="text-xs" />
                                                                    <span className="truncate max-w-[150px] text-slate-100">{c.name}</span>
                                                                </td>
                                                                <td className="py-3.5 px-3 text-right font-black text-slate-200">{c.assigned}</td>
                                                                <td className="py-3.5 px-3 text-right font-black text-blue-400">{c.pending}</td>
                                                                <td className="py-3.5 px-3 text-right font-black text-emerald-400">{c.answered}</td>
                                                                <td className="py-3.5 px-3 text-right font-black text-amber-400">{c.noAnswer}</td>
                                                                <td className="py-3.5 px-3 text-right font-black text-rose-400">{c.reject}</td>
                                                                <td className="py-3.5 pr-4 text-right font-black text-yellow-400">{c.responseRate}%</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                {freeSem.coordinators?.length > 0 && (
                                                    <tfoot className="bg-gradient-to-r from-slate-800 to-indigo-950/80 text-sm font-black border-t-2 border-slate-600">
                                                        <tr>
                                                            <td className="py-3.5 px-4 text-white uppercase">TOTAL SUMMARY</td>
                                                            <td className="py-3.5 px-3 text-right text-white">{freeSem.assigned}</td>
                                                            <td className="py-3.5 px-3 text-right text-blue-300">{freeSem.pending}</td>
                                                            <td className="py-3.5 px-3 text-right text-emerald-300">{freeSem.answered}</td>
                                                            <td className="py-3.5 px-3 text-right text-amber-300">{freeSem.noAnswer}</td>
                                                            <td className="py-3.5 px-3 text-right text-rose-300">{freeSem.reject}</td>
                                                            <td className="py-3.5 pr-4 text-right text-yellow-300">{freeSem.responseRate}%</td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-5 bg-slate-900/80 border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                                <BarChart3 size={18} className="text-emerald-400" /> Call Distribution Chart
                                            </h4>
                                            <div className="flex items-center gap-3 text-xs font-bold">
                                                <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ans</span>
                                                <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> No Ans</span>
                                                <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rej</span>
                                            </div>
                                        </div>

                                        <div className="h-72 sm:h-80 w-full min-w-0">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                                                <BarChart data={freeSem.coordinators || []} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} interval={0} angle={-25} textAnchor="end" />
                                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold' }}
                                                    />
                                                    <Bar dataKey="answered" name="Answered" fill="#10B981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="noAnswer" name="No Answer" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="reject" name="Reject" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-red-950/40 via-slate-900/80 to-slate-900/80 border border-red-500/30 p-6 rounded-3xl shadow-xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <PhoneForwarded size={20} className="text-red-400" />
                                        <h4 className="text-sm font-black uppercase tracking-wider text-red-300">Call Center Performance Matrix</h4>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                            <p className="text-xs font-bold uppercase text-slate-400">Total Assigned in CC</p>
                                            <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-1">{freeSem.callCenterProgress?.totalAssigned || 0}</p>
                                        </div>

                                        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                            <p className="text-xs font-bold uppercase text-slate-400">Covered Leads</p>
                                            <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{freeSem.callCenterProgress?.covered || 0}</p>
                                        </div>

                                        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                            <p className="text-xs font-bold uppercase text-slate-400">Pending Leads</p>
                                            <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{freeSem.callCenterProgress?.pending || 0}</p>
                                        </div>

                                        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                            <p className="text-xs font-bold uppercase text-slate-400">Response Rate</p>
                                            <p className="text-2xl sm:text-3xl font-black text-yellow-400 mt-1">{freeSem.callCenterProgress?.responseRate || 0}%</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* SUB-VIEW 2: WHATSAPP MESSAGES BREAKDOWN */}
                        {freeSemSubView === 'whatsapp_messages' && (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inbound Numbers</p>
                                            <Inbox size={18} className="text-blue-400" />
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-black text-blue-400 mt-2">
                                            {freeSemWhatsapp.uniqueInboundNumbersCount?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Unique numbers sent msgs</p>
                                    </div>

                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Outbound Numbers</p>
                                            <Send size={18} className="text-emerald-400" />
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">
                                            {freeSemWhatsapp.uniqueOutboundNumbersCount?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Unique numbers reached out</p>
                                    </div>

                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Inbound Msgs</p>
                                            <MessageCircle size={18} className="text-purple-400" />
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-black text-purple-400 mt-2">
                                            {freeSemWhatsapp.totalReceived?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Incoming message volume</p>
                                    </div>

                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Outbound Msgs</p>
                                            <Send size={18} className="text-teal-400" />
                                        </div>
                                        <p className="text-3xl sm:text-4xl font-black text-teal-400 mt-2">
                                            {freeSemWhatsapp.totalSent?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Outgoing message volume</p>
                                    </div>
                                </div>

                                <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                                    <div className="p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                            <MessageSquare size={18} className="text-emerald-400" /> Coordinator WhatsApp Outreach & Engagement Breakdown
                                        </h4>
                                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30">
                                            {freeSemWhatsapp.staffBreakdown?.length || 0} Senders
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                                <tr>
                                                    <th className="py-3.5 px-4">Coordinator / Sender</th>
                                                    <th className="py-3.5 px-3 text-right text-blue-400">Inbound Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-emerald-400">Outbound Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-teal-300">Assigned Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-amber-400">Other Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-purple-400">Total Sent</th>
                                                    <th className="py-3.5 px-3 text-right text-indigo-400">Total Recv</th>
                                                    <th className="py-3.5 pr-4 text-right text-emerald-400">Match %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/80 font-medium">
                                                {freeSemWhatsapp.staffBreakdown?.map((s, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                                                            <SafeAvatar image={s.image} name={s.coordinatorName} size="w-8 h-8" textSize="text-xs" />
                                                            <div>
                                                                <p className="truncate max-w-[150px] text-slate-100">{s.coordinatorName}</p>
                                                                <span className="text-[10px] font-extrabold text-slate-400 uppercase">{s.role}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-black text-blue-400">{s.inboundNumbersCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-emerald-400">{s.outboundNumbersCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-teal-300 bg-teal-500/10">{s.assignedNumbersMessagedCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-amber-400 bg-amber-500/10">{s.otherNumbersMessagedCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-purple-400">{s.totalSent}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-indigo-400">{s.totalReceived}</td>
                                                        <td className="py-3.5 pr-4 text-right font-black text-emerald-400">{s.matchRate}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================= */}
                {/* 02. AFTER SEMINAR SECTION */}
                {/* ========================================================= */}
                {mainSection === 'after_sem' && (
                    <div className="flex flex-col gap-7 animate-fade-in">
                        
                        {/* Top High Level Summary Banner for After Seminar */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-slate-900/80 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Total After Sem Leads</p>
                                <p className="text-3xl sm:text-4xl font-black text-white mt-1">{afterSem.total?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-purple-400 mt-2">Open Sem + New Inq + Paid</p>
                            </div>

                            <div className="bg-slate-900/80 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Calls Contacted</p>
                                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">{afterSem.totalCallsMade?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-emerald-400 mt-2">Completed Calls</p>
                            </div>

                            <div className="bg-slate-900/80 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Pending Calls</p>
                                <p className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">{afterSem.totalCallsPending?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-amber-400 mt-2">To be dialed</p>
                            </div>

                            <div className="bg-slate-900/80 border border-purple-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-300">Total Enrolled (Paid)</p>
                                <p className="text-3xl sm:text-4xl font-black text-teal-300 mt-1">{afterSem.totalEnrolled?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-teal-400 mt-2">Conversion: {afterSem.conversionRate || 0}%</p>
                            </div>

                            <div className="bg-slate-900/80 border border-purple-500/30 p-5 rounded-2xl col-span-2 lg:col-span-1 shadow-xl flex flex-col justify-between">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-300">WhatsApp Volume</p>
                                <div className="flex items-center justify-between mt-1">
                                    <div>
                                        <p className="text-2xl font-black text-emerald-400">{afterSemWhatsapp.totalSent?.toLocaleString() || 0} <span className="text-xs text-slate-400 font-bold">Sent</span></p>
                                        <p className="text-sm font-bold text-blue-400 mt-0.5">{afterSemWhatsapp.totalReceived?.toLocaleString() || 0} <span className="text-slate-400 font-normal">Recv</span></p>
                                    </div>
                                    <MessageSquare size={24} className="text-purple-400 shrink-0" />
                                </div>
                            </div>
                        </div>

                        {/* Sub Navigation Bar for After Seminar */}
                        <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-700/80 overflow-x-auto custom-scrollbar shadow-inner">
                            <button
                                onClick={() => setAfterSemSubView('open_seminar')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-2.5 ${
                                    afterSemSubView === 'open_seminar'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-[1.02]'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <PhoneCall size={16} /> Open Seminar ({openSem.total || 0})
                            </button>
                            <button
                                onClick={() => setAfterSemSubView('new_inquiries')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-2.5 ${
                                    afterSemSubView === 'new_inquiries'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-[1.02]'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <UserPlus size={16} /> New Inquiries ({newInq.total || 0})
                            </button>
                            <button
                                onClick={() => setAfterSemSubView('paid_campaign')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-2.5 ${
                                    afterSemSubView === 'paid_campaign'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-[1.02]'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <CreditCard size={16} /> Paid Campaign & Cohort Matrix ({paidCamp.total || 0})
                            </button>
                            <button
                                onClick={() => setAfterSemSubView('whatsapp_messages')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-2.5 ${
                                    afterSemSubView === 'whatsapp_messages'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-[1.02]'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <MessageSquare size={16} /> WhatsApp Messages ({afterSemWhatsapp.totalSent || 0})
                            </button>
                        </div>

                        {/* ------------------------------------------------- */}
                        {/* SUB TAB 1: OPEN SEMINAR */}
                        {/* ------------------------------------------------- */}
                        {afterSemSubView === 'open_seminar' && (
                            <div className="flex flex-col gap-7">
                                
                                {/* Historical Delays Banner & Payment Plan Badges */}
                                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                                            <AlertTriangle size={17} /> Historical Delays:
                                        </span>
                                        <span className="text-xs font-bold text-slate-200 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-xl">
                                            Round 1: <strong className="text-rose-400 font-black">{openSem.historicalDelays?.round1 || 0}</strong>
                                        </span>
                                        <span className="text-xs font-bold text-slate-200 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-xl">
                                            Round 2: <strong className="text-rose-400 font-black">{openSem.historicalDelays?.round2 || 0}</strong>
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-300 shadow-sm">
                                            Full: <span className="font-black text-emerald-400 text-sm ml-1">{openSem.plans?.full || 0}</span>
                                        </div>
                                        <div className="bg-blue-500/20 border border-blue-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-300 shadow-sm">
                                            Upgrade: <span className="font-black text-blue-400 text-sm ml-1">{openSem.plans?.upgrade || 0}</span>
                                        </div>
                                        <div className="bg-purple-500/20 border border-purple-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-300 shadow-sm">
                                            Monthly: <span className="font-black text-purple-400 text-sm ml-1">{openSem.plans?.monthly || 0}</span>
                                        </div>
                                        <div className="bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 shadow-sm">
                                            Installments: <span className="font-black text-amber-400 text-sm ml-1">{openSem.plans?.installments || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Campaign 4 Rounds Cards Grid (Batch Aggregate) */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                            <Layers size={14} className="text-blue-400" /> Overall Batch Rounds Aggregate
                                        </h4>
                                    </div>
                                    <RoundCardsGrid rounds={openSem.rounds} />
                                </div>

                                {/* Coordinator Performance & Single Goal Trackers Cards */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                            <Award size={18} className="text-amber-400" /> Coordinator Performance & Single Goal Trackers
                                        </h4>
                                        <span className="text-xs font-bold text-slate-400">Target Goal: {openSem.goals?.targetIndividualGoal || 40}%</span>
                                    </div>

                                    <div className="space-y-5">
                                        {openSem.coordinators?.map((c, idx) => (
                                            <div key={idx} className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
                                                
                                                {/* Coordinator Header & Top KPIs */}
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                                    <div className="flex items-center gap-4">
                                                        <SafeAvatar image={c.image} name={c.name} size="w-14 h-14" textSize="text-sm" rank={idx + 1} />
                                                        <div>
                                                            <div className="flex items-center gap-2.5">
                                                                <h5 className="text-lg font-black text-white">{c.name}</h5>
                                                                {idx === 0 && (
                                                                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-md">
                                                                        <Award size={14} /> #1 Top Performer
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                                                                    {c.stream}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2.5 text-center text-xs">
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase">Assigned</p>
                                                            <p className="text-base font-black text-white mt-0.5">{c.assigned}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-emerald-400 uppercase">Answered</p>
                                                            <p className="text-base font-black text-emerald-400 mt-0.5">{c.answered}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-amber-400 uppercase">No Ans</p>
                                                            <p className="text-base font-black text-amber-400 mt-0.5">{c.noAnswer}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-blue-400 uppercase">Pending</p>
                                                            <p className="text-base font-black text-blue-400 mt-0.5">{c.pending}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-rose-400 uppercase">Reject</p>
                                                            <p className="text-base font-black text-rose-400 mt-0.5">{c.reject}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-red-400 uppercase">Delayed</p>
                                                            <p className="text-base font-black text-red-400 mt-0.5">{c.delayed}</p>
                                                        </div>
                                                        <div className="bg-emerald-950/50 p-3 rounded-2xl border border-emerald-500/40">
                                                            <p className="text-[10px] font-black text-emerald-300 uppercase">Conversion</p>
                                                            <p className="text-base font-black text-emerald-300 mt-0.5">{c.conversionRate}%</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Coordinator Specific 4-Round Breakdown Grid */}
                                                {c.rounds && (
                                                    <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                                                            <Layers size={13} className="text-purple-400" /> {c.name}'s Round Progression Breakdown:
                                                        </p>
                                                        <RoundCardsGrid rounds={c.rounds} isCompact={true} />
                                                    </div>
                                                )}

                                                {/* Goal Progress Bar */}
                                                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                                                    <div className="flex items-center gap-2 font-black text-slate-200">
                                                        <Target size={16} className="text-blue-400" />
                                                        <span>Single Goal ({c.conversionRate}% / {openSem.goals?.targetIndividualGoal || 40}%)</span>
                                                    </div>

                                                    <div className="flex-1 w-full max-w-md h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                                                        <div
                                                            className={`h-full rounded-full ${c.goalAchievedPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'} transition-all`}
                                                            style={{ width: `${Math.min(100, c.goalAchievedPct)}%` }}
                                                        />
                                                    </div>

                                                    <div className="text-xs font-black">
                                                        {c.targetNeed > 0 ? (
                                                            <span className="text-amber-300 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/40">
                                                                Need {c.targetNeed} more
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-500/40">
                                                                ✨ Goal Achieved!
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ------------------------------------------------- */}
                        {/* SUB TAB 2: NEW INQUIRIES (MATCHES OPEN SEMINAR UI) */}
                        {/* ------------------------------------------------- */}
                        {afterSemSubView === 'new_inquiries' && (
                            <div className="flex flex-col gap-7">
                                
                                {/* Historical Delays & Payment Plan Badges for New Inquiries */}
                                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl shadow-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                                            <AlertTriangle size={17} /> Delays / Status:
                                        </span>
                                        <span className="text-xs font-bold text-slate-200 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-xl">
                                            Pending Calls: <strong className="text-rose-400 font-black">{newInq.pending || 0}</strong>
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-300 shadow-sm">
                                            Full: <span className="font-black text-emerald-400 text-sm ml-1">{newInq.plans?.full || 0}</span>
                                        </div>
                                        <div className="bg-blue-500/20 border border-blue-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-300 shadow-sm">
                                            Upgrade: <span className="font-black text-blue-400 text-sm ml-1">{newInq.plans?.upgrade || 0}</span>
                                        </div>
                                        <div className="bg-purple-500/20 border border-purple-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-300 shadow-sm">
                                            Monthly: <span className="font-black text-purple-400 text-sm ml-1">{newInq.plans?.monthly || 0}</span>
                                        </div>
                                        <div className="bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 shadow-sm">
                                            Installments: <span className="font-black text-amber-400 text-sm ml-1">{newInq.plans?.installments || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Overall Batch 4-Rounds Cards for New Inquiries */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                            <Layers size={14} className="text-blue-400" /> Overall Batch Rounds Aggregate
                                        </h4>
                                    </div>
                                    <RoundCardsGrid rounds={newInq.rounds} />
                                </div>

                                {/* Coordinator Performance & Single Goal Trackers Cards (MATCHES OPEN SEM) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                            <Award size={18} className="text-amber-400" /> New Inquiries Coordinator Performance & Single Goal Trackers
                                        </h4>
                                        <span className="text-xs font-bold text-slate-400">Target Goal: {openSem.goals?.targetIndividualGoal || 40}%</span>
                                    </div>

                                    <div className="space-y-5">
                                        {newInq.coordinators?.map((c, idx) => (
                                            <div key={idx} className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
                                                
                                                {/* Coordinator Header & Top KPIs */}
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                                    <div className="flex items-center gap-4">
                                                        <SafeAvatar image={c.image} name={c.name} size="w-14 h-14" textSize="text-sm" rank={idx + 1} />
                                                        <div>
                                                            <div className="flex items-center gap-2.5">
                                                                <h5 className="text-lg font-black text-white">{c.name}</h5>
                                                                {idx === 0 && (
                                                                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-md">
                                                                        <Award size={14} /> #1 Top Performer
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                                                                    {c.stream || 'Standard'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2.5 text-center text-xs">
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase">Assigned</p>
                                                            <p className="text-base font-black text-white mt-0.5">{c.assigned}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-emerald-400 uppercase">Answered</p>
                                                            <p className="text-base font-black text-emerald-400 mt-0.5">{c.answered}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-amber-400 uppercase">No Ans</p>
                                                            <p className="text-base font-black text-amber-400 mt-0.5">{c.noAnswer}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-blue-400 uppercase">Pending</p>
                                                            <p className="text-base font-black text-blue-400 mt-0.5">{c.pending}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-rose-400 uppercase">Reject</p>
                                                            <p className="text-base font-black text-rose-400 mt-0.5">{c.reject}</p>
                                                        </div>
                                                        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                                                            <p className="text-[10px] font-black text-red-400 uppercase">Delayed</p>
                                                            <p className="text-base font-black text-red-400 mt-0.5">{c.delayed || 0}</p>
                                                        </div>
                                                        <div className="bg-emerald-950/50 p-3 rounded-2xl border border-emerald-500/40">
                                                            <p className="text-[10px] font-black text-emerald-300 uppercase">Conversion</p>
                                                            <p className="text-base font-black text-emerald-300 mt-0.5">{c.conversionRate}%</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Coordinator Specific 4-Round Breakdown Grid for New Inquiries */}
                                                {c.rounds && (
                                                    <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                                                            <Layers size={13} className="text-purple-400" /> {c.name}'s Round Progression Breakdown:
                                                        </p>
                                                        <RoundCardsGrid rounds={c.rounds} isCompact={true} />
                                                    </div>
                                                )}

                                                {/* Goal Progress Bar */}
                                                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                                                    <div className="flex items-center gap-2 font-black text-slate-200">
                                                        <Target size={16} className="text-blue-400" />
                                                        <span>Single Goal ({c.conversionRate}% / {openSem.goals?.targetIndividualGoal || 40}%)</span>
                                                    </div>

                                                    <div className="flex-1 w-full max-w-md h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                                                        <div
                                                            className={`h-full rounded-full ${c.goalAchievedPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'} transition-all`}
                                                            style={{ width: `${Math.min(100, c.goalAchievedPct || 0)}%` }}
                                                        />
                                                    </div>

                                                    <div className="text-xs font-black">
                                                        {(c.targetNeed || 0) > 0 ? (
                                                            <span className="text-amber-300 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/40">
                                                                Need {c.targetNeed} more
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-500/40">
                                                                ✨ Goal Achieved!
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ------------------------------------------------- */}
                        {/* SUB TAB 3: PAID CAMPAIGN & PAYMENT GROUPS RETENTION MATRIX */}
                        {/* ------------------------------------------------- */}
                        {afterSemSubView === 'paid_campaign' && (
                            <div className="flex flex-col gap-7">
                                
                                {/* A. Plan Breakdown (Full, Monthly, Installment, Total Enrolled) */}
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 mb-3.5 flex items-center gap-2">
                                        <CreditCard size={18} className="text-purple-400" /> Enrolled Plan Categories (Calls & Coverage Status)
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* FULL PAYMENT */}
                                        <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-3.5 shadow-xl">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black uppercase text-blue-400">Full Payment</h5>
                                                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                                    {paidCamp.plans?.full?.assigned || 0} Enrolled
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-slate-400 font-bold uppercase">COVERED</p><p className="text-xl font-black text-emerald-400">{paidCamp.plans?.full?.covered || 0}</p></div>
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-amber-400 font-bold uppercase">PENDING</p><p className="text-xl font-black text-amber-400">{paidCamp.plans?.full?.pending || 0}</p></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                                                <div>ANS: <strong className="text-emerald-400">{paidCamp.plans?.full?.answered || 0}</strong></div>
                                                <div>NO ANS: <strong className="text-amber-400">{paidCamp.plans?.full?.noAnswer || 0}</strong></div>
                                                <div>REJ: <strong className="text-rose-400">{paidCamp.plans?.full?.reject || 0}</strong></div>
                                            </div>
                                        </div>

                                        {/* MONTHLY PLAN */}
                                        <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-3.5 shadow-xl">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black uppercase text-purple-400">Monthly Plan</h5>
                                                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                                    {paidCamp.plans?.monthly?.assigned || 0} Enrolled
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-slate-400 font-bold uppercase">COVERED</p><p className="text-xl font-black text-emerald-400">{paidCamp.plans?.monthly?.covered || 0}</p></div>
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-amber-400 font-bold uppercase">PENDING</p><p className="text-xl font-black text-amber-400">{paidCamp.plans?.monthly?.pending || 0}</p></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                                                <div>ANS: <strong className="text-emerald-400">{paidCamp.plans?.monthly?.answered || 0}</strong></div>
                                                <div>NO ANS: <strong className="text-amber-400">{paidCamp.plans?.monthly?.noAnswer || 0}</strong></div>
                                                <div>REJ: <strong className="text-rose-400">{paidCamp.plans?.monthly?.reject || 0}</strong></div>
                                            </div>
                                        </div>

                                        {/* INSTALLMENTS */}
                                        <div className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-3.5 shadow-xl">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black uppercase text-amber-400">Installments</h5>
                                                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                    {paidCamp.plans?.installment?.assigned || 0} Enrolled
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-slate-400 font-bold uppercase">COVERED</p><p className="text-xl font-black text-emerald-400">{paidCamp.plans?.installment?.covered || 0}</p></div>
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-amber-400 font-bold uppercase">PENDING</p><p className="text-xl font-black text-amber-400">{paidCamp.plans?.installment?.pending || 0}</p></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                                                <div>ANS: <strong className="text-emerald-400">{paidCamp.plans?.installment?.answered || 0}</strong></div>
                                                <div>NO ANS: <strong className="text-amber-400">{paidCamp.plans?.installment?.noAnswer || 0}</strong></div>
                                                <div>REJ: <strong className="text-rose-400">{paidCamp.plans?.installment?.reject || 0}</strong></div>
                                            </div>
                                        </div>

                                        {/* TOTAL ENROLLED SUMMARY */}
                                        <div className="bg-emerald-950/40 border border-emerald-500/40 p-5 rounded-2xl space-y-3.5 shadow-xl">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black uppercase text-emerald-300">Total Enrolled</h5>
                                                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                    {paidCamp.plans?.totalEnrolled?.assigned || 0} Total
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-slate-400 font-bold uppercase">COVERED</p><p className="text-xl font-black text-emerald-400">{paidCamp.plans?.totalEnrolled?.covered || 0}</p></div>
                                                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700"><p className="text-[10px] text-amber-400 font-bold uppercase">PENDING</p><p className="text-xl font-black text-amber-400">{paidCamp.plans?.totalEnrolled?.pending || 0}</p></div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300 font-bold">
                                                <div>ANS: <strong className="text-emerald-400">{paidCamp.plans?.totalEnrolled?.answered || 0}</strong></div>
                                                <div>NO ANS: <strong className="text-amber-400">{paidCamp.plans?.totalEnrolled?.noAnswer || 0}</strong></div>
                                                <div>REJ: <strong className="text-rose-400">{paidCamp.plans?.totalEnrolled?.reject || 0}</strong></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* B. Batch Payment Groups & Coordinator Cohort Retention Matrix */}
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                                <RotateCcw size={18} className="text-teal-400" /> Batch Monthly Cohort Retention & Progression Matrix
                                            </h4>
                                            <p className="text-xs text-slate-300 mt-0.5 font-medium">
                                                Month 1 establishes base enrolled students (100% active). Drops & later recovery are tracked across consecutive monthly groups.
                                            </p>
                                        </div>
                                        <span className="text-xs font-black text-teal-300 bg-teal-500/20 px-3.5 py-1.5 rounded-xl border border-teal-500/40 shrink-0 shadow-sm">
                                            {paymentGroups.length} Monthly Groups
                                        </span>
                                    </div>

                                    {paymentGroups.length === 0 ? (
                                        <div className="bg-slate-900/60 p-10 rounded-2xl border border-slate-800 text-center text-slate-400 font-bold text-sm">
                                            No monthly payment groups found for the selected batch
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {paymentGroups.map((pg, gIdx) => {
                                                const isExpanded = expandedGroupIds[pg.groupId] !== false;
                                                const isFirstMonth = gIdx === 0;

                                                return (
                                                    <div key={pg.groupId} className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                                                        
                                                        {/* Group Accordion Header */}
                                                        <div
                                                            onClick={() => toggleGroupAccordion(pg.groupId)}
                                                            className="p-5 bg-slate-800/40 hover:bg-slate-800/70 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-700/80"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <span className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black text-sm shadow-sm">
                                                                    {gIdx + 1}
                                                                </span>
                                                                <div>
                                                                    <div className="flex items-center gap-2.5">
                                                                        <h5 className="text-base font-black text-white">
                                                                            {pg.groupName}
                                                                        </h5>
                                                                        {isFirstMonth && (
                                                                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                                                                🏁 Start Month (All Paid Enrolled)
                                                                            </span>
                                                                        )}
                                                                        {pg.nextGroupName && (
                                                                            <span className="text-xs font-extrabold text-slate-300">
                                                                                ➔ Follow-up in: <strong className="text-teal-300 font-black">{pg.nextGroupName}</strong>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-300 font-semibold mt-0.5">
                                                                        Total Paid in this Group: <strong className="text-emerald-400 text-sm font-black">{pg.totalPaidStudents} Students</strong> across {pg.coordinators?.length || 0} Coordinators
                                                                        {pg.nextGroupName && (
                                                                            <span className="ml-2 text-slate-400">
                                                                                (Next Month: <strong className="text-teal-300">{pg.coordinators?.reduce((acc, c) => acc + (c.nextMonthPaid || 0), 0)} Paid</strong>, <strong className="text-amber-400">{pg.coordinators?.reduce((acc, c) => acc + (c.droppedInNext || 0), 0)} Pending</strong>)
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-black text-slate-300 p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                                                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Group Coordinator Table */}
                                                        {isExpanded && (
                                                            <div className="overflow-x-auto custom-scrollbar p-3">
                                                                <table className="w-full text-left text-sm">
                                                                    <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                                                        <tr>
                                                                            <th className="py-3.5 px-4">Coordinator</th>
                                                                            <th className="py-3.5 px-3 text-right text-emerald-400">Paid in Group</th>
                                                                            <th className="py-3.5 px-3 text-right text-teal-300">
                                                                                {pg.nextGroupName ? `${pg.nextGroupName.replace('Monthly Payment - ', '').trim()} Paid` : 'Next Month Paid'}
                                                                            </th>
                                                                            <th className="py-3.5 px-3 text-right text-amber-400">
                                                                                {pg.nextGroupName ? `${pg.nextGroupName.replace('Monthly Payment - ', '').trim()} Pending (Unpaid)` : 'Next Month Pending'}
                                                                            </th>
                                                                            <th className="py-3.5 px-3 text-right text-purple-300">Later Recovered</th>
                                                                            <th className="py-3.5 px-3 text-right text-teal-400">Retention %</th>
                                                                            <th className="py-3.5 pr-4 text-right text-emerald-400">Recovery %</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-800/80 font-medium">
                                                                        {pg.coordinators?.length === 0 ? (
                                                                            <tr>
                                                                                <td colSpan="7" className="text-center py-8 text-slate-400 font-bold">
                                                                                    No coordinator allocations found for this group
                                                                                </td>
                                                                            </tr>
                                                                        ) : (
                                                                            pg.coordinators?.map((c, cIdx) => (
                                                                                <tr key={cIdx} className="hover:bg-slate-800/50 transition-colors">
                                                                                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                                                                                        <SafeAvatar image={c.image} name={c.coordinatorName} size="w-8 h-8" textSize="text-xs" />
                                                                                        <span className="truncate max-w-[160px] text-slate-100">{c.coordinatorName}</span>
                                                                                    </td>
                                                                                    <td className="py-3.5 px-3 text-right font-black text-emerald-400 text-base">{c.paidCount}</td>
                                                                                    <td className="py-3.5 px-3 text-right font-black text-teal-300 text-base">{c.nextMonthPaid}</td>
                                                                                    <td className="py-3.5 px-3 text-right font-black text-amber-400 bg-amber-500/10 text-base">{c.droppedInNext}</td>
                                                                                    <td className="py-3.5 px-3 text-right font-black text-purple-300 bg-purple-500/10 text-base">
                                                                                        {c.recoveredLater}
                                                                                        {c.recoveredLater > 0 && Object.keys(c.recoveredDetails || {}).length > 0 && (
                                                                                            <span className="block text-[10px] font-bold text-purple-300 mt-0.5">
                                                                                                ({Object.entries(c.recoveredDetails).map(([m, cnt]) => `${m}: ${cnt}`).join(', ')})
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-3.5 px-3 text-right font-black text-teal-400 text-base">{c.retentionRate}%</td>
                                                                                    <td className="py-3.5 pr-4 text-right font-black text-emerald-400 text-base pr-4">{c.recoveryRate}%</td>
                                                                                </tr>
                                                                            ))
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ------------------------------------------------- */}
                        {/* SUB TAB 4: WHATSAPP MESSAGES IN AFTER SEMINAR */}
                        {/* ------------------------------------------------- */}
                        {afterSemSubView === 'whatsapp_messages' && (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <p className="text-xs font-bold uppercase text-slate-400">Unique Inbound Numbers</p>
                                        <p className="text-3xl sm:text-4xl font-black text-blue-400 mt-2">{afterSemWhatsapp.uniqueInboundNumbersCount || 0}</p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Student numbers inbound</p>
                                    </div>
                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <p className="text-xs font-bold uppercase text-slate-400">Unique Outbound Numbers</p>
                                        <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">{afterSemWhatsapp.uniqueOutboundNumbersCount || 0}</p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Numbers messaged</p>
                                    </div>
                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <p className="text-xs font-bold uppercase text-slate-400">Total Sent Msgs</p>
                                        <p className="text-3xl sm:text-4xl font-black text-purple-400 mt-2">{afterSemWhatsapp.totalSent || 0}</p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Total messages outbound</p>
                                    </div>
                                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/80 shadow-xl">
                                        <p className="text-xs font-bold uppercase text-slate-400">Total Recv Msgs</p>
                                        <p className="text-3xl sm:text-4xl font-black text-teal-400 mt-2">{afterSemWhatsapp.totalReceived || 0}</p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Total messages inbound</p>
                                    </div>
                                </div>

                                <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                                    <div className="p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                            <MessageSquare size={18} className="text-purple-400" /> After Seminar WhatsApp Coordinator Breakdown
                                        </h4>
                                    </div>
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                                <tr>
                                                    <th className="py-3.5 px-4">Coordinator / Sender</th>
                                                    <th className="py-3.5 px-3 text-right text-blue-400">Inbound Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-emerald-400">Outbound Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-teal-300">Assigned Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-amber-400">Other Numbers</th>
                                                    <th className="py-3.5 px-3 text-right text-purple-400">Total Sent</th>
                                                    <th className="py-3.5 pr-4 text-right text-indigo-400">Total Recv</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/80 font-medium">
                                                {afterSemWhatsapp.staffBreakdown?.map((s, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                                                            <SafeAvatar image={s.image} name={s.coordinatorName} size="w-8 h-8" textSize="text-xs" />
                                                            <span className="text-slate-100">{s.coordinatorName}</span>
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-black text-blue-400">{s.inboundNumbersCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-emerald-400">{s.outboundNumbersCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-teal-300">{s.assignedNumbersMessagedCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-amber-400">{s.otherNumbersMessagedCount}</td>
                                                        <td className="py-3.5 px-3 text-right font-black text-purple-400">{s.totalSent}</td>
                                                        <td className="py-3.5 pr-4 text-right font-black text-indigo-400">{s.totalReceived}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================= */}
                {/* 03. TASK CENTER OPERATIONS SECTION */}
                {/* ========================================================= */}
                {mainSection === 'task_center' && (
                    <div className="flex flex-col gap-7 animate-fade-in">
                        
                        {/* Top KPI Cards for Task Center */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-slate-900/80 border border-cyan-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">Total Tasks</p>
                                    <CheckSquare size={18} className="text-cyan-400" />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-white mt-1">{taskCenter.total?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-cyan-400 mt-2">All Assigned Tasks</p>
                            </div>

                            <div className="bg-slate-900/80 border border-emerald-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">Completed</p>
                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">{taskCenter.completed?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-emerald-300 mt-2">Finished Successfully</p>
                            </div>

                            <div className="bg-slate-900/80 border border-blue-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">In-Progress</p>
                                    <Activity size={18} className="text-blue-400" />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-blue-400 mt-1">{taskCenter.inProgress?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-blue-300 mt-2">Currently Active</p>
                            </div>

                            <div className="bg-slate-900/80 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">Pending</p>
                                    <Clock size={18} className="text-amber-400" />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">{taskCenter.pending?.toLocaleString() || 0}</p>
                                <p className="text-xs font-bold text-amber-300 mt-2">Yet to Start</p>
                            </div>

                            <div className="bg-slate-900/80 border border-rose-500/30 p-5 rounded-2xl col-span-2 lg:col-span-1 shadow-xl flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">Locked / Overdue</p>
                                    <AlertTriangle size={18} className="text-rose-400" />
                                </div>
                                <p className="text-3xl sm:text-4xl font-black text-rose-400 mt-1">{taskCenter.locked?.toLocaleString() || 0}</p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs font-bold text-rose-300">Completion: {taskCenter.completionRate || 0}%</span>
                                    <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, taskCenter.completionRate || 0)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Staff / Coordinator Wise Task Completion Matrix */}
                        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
                                <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <Users size={18} className="text-cyan-400" /> Staff & Coordinator Task Execution Performance Matrix
                                </h4>
                                <span className="text-xs font-black text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/30">
                                    {taskCenter.staffBreakdown?.length || 0} Staff Members
                                </span>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                        <tr>
                                            <th className="py-3.5 px-4">Staff Member</th>
                                            <th className="py-3.5 px-3 text-right">Total Assigned</th>
                                            <th className="py-3.5 px-3 text-right text-emerald-400">Completed</th>
                                            <th className="py-3.5 px-3 text-right text-blue-400">In-Progress</th>
                                            <th className="py-3.5 px-3 text-right text-amber-400">Pending</th>
                                            <th className="py-3.5 px-3 text-right text-rose-400">Locked/Overdue</th>
                                            <th className="py-3.5 px-4 text-center text-cyan-300">Completion %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/80 font-medium">
                                        {taskCenter.staffBreakdown?.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-10 text-slate-400 font-bold">
                                                    No task assignments recorded for this scope
                                                </td>
                                            </tr>
                                        ) : (
                                            taskCenter.staffBreakdown?.map((s, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-3">
                                                        <SafeAvatar image={s.image} name={s.name} size="w-8 h-8" textSize="text-xs" />
                                                        <div>
                                                            <p className="truncate max-w-[160px] text-slate-100">{s.name}</p>
                                                            <span className="text-[10px] font-extrabold text-slate-400 uppercase">{s.role}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-black text-slate-200 text-base">{s.total}</td>
                                                    <td className="py-3.5 px-3 text-right font-black text-emerald-400 text-base">{s.completed}</td>
                                                    <td className="py-3.5 px-3 text-right font-black text-blue-400 text-base">{s.inProgress}</td>
                                                    <td className="py-3.5 px-3 text-right font-black text-amber-400 text-base">{s.pending}</td>
                                                    <td className="py-3.5 px-3 text-right font-black text-rose-400 bg-rose-500/10 text-base">{s.locked}</td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="w-24 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                                                                <div
                                                                    className={`h-full rounded-full ${s.completionRate >= 80 ? 'bg-emerald-500' : s.completionRate >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(100, s.completionRate)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-black text-white">{s.completionRate}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Task Categories Breakdown Grid */}
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 mb-3.5 flex items-center gap-2">
                                <Layers size={18} className="text-purple-400" /> Task Categories & Operational Workflow Breakdown
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {taskCenter.taskTypes?.map((t, idx) => (
                                    <div key={idx} className="bg-slate-900/80 border border-slate-700/80 p-5 rounded-2xl space-y-3 shadow-xl">
                                        <div className="flex justify-between items-center">
                                            <h5 className="text-xs font-black uppercase text-cyan-300 truncate max-w-[170px]" title={t.type}>
                                                {t.type.replace(/_/g, ' ')}
                                            </h5>
                                            <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                                {t.total} Tasks
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 text-center text-xs">
                                            <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                                <p className="text-[9px] text-emerald-400 font-bold uppercase">DONE</p>
                                                <p className="text-base font-black text-emerald-400 mt-0.5">{t.completed}</p>
                                            </div>
                                            <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                                <p className="text-[9px] text-blue-400 font-bold uppercase">ACT</p>
                                                <p className="text-base font-black text-blue-400 mt-0.5">{t.inProgress}</p>
                                            </div>
                                            <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                                                <p className="text-[9px] text-rose-400 font-bold uppercase">LOCK</p>
                                                <p className="text-base font-black text-rose-400 mt-0.5">{t.locked}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                                            <span className="text-slate-400 font-bold">Success Rate:</span>
                                            <span className="font-black text-emerald-400">{t.completionRate}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Tasks Stream Table */}
                        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-slate-700/80 flex justify-between items-center bg-slate-800/40">
                                <h4 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                                    <Activity size={18} className="text-emerald-400" /> Recent Operational Tasks Stream
                                </h4>
                                <span className="text-xs font-bold text-slate-400">Latest 30 Recorded Tasks</span>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-800/90 text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-700">
                                        <tr>
                                            <th className="py-3.5 px-4">Task Details</th>
                                            <th className="py-3.5 px-3">Category</th>
                                            <th className="py-3.5 px-3">Batch</th>
                                            <th className="py-3.5 px-3">Assigned Staff</th>
                                            <th className="py-3.5 px-3">Deadline</th>
                                            <th className="py-3.5 pr-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/80 font-medium">
                                        {taskCenter.recentTasks?.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-8 text-slate-400 font-bold">
                                                    No recent tasks found
                                                </td>
                                            </tr>
                                        ) : (
                                            taskCenter.recentTasks?.map((task) => (
                                                <tr key={task.id} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-3.5 px-4">
                                                        <p className="font-bold text-white max-w-xs truncate">{task.title}</p>
                                                        <span className="text-[10px] text-slate-400">ID: #{task.id}</span>
                                                    </td>
                                                    <td className="py-3.5 px-3">
                                                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                                                            {task.taskType?.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-3 text-xs font-bold text-slate-300">
                                                        {task.batchName || 'General Business'}
                                                    </td>
                                                    <td className="py-3.5 px-3">
                                                        {task.assignedUser ? (
                                                            <div className="flex items-center gap-2">
                                                                <SafeAvatar image={task.assignedUser.image} name={task.assignedUser.name} size="w-7 h-7" textSize="text-[10px]" />
                                                                <span className="font-bold text-slate-200 text-xs">{task.assignedUser.name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-500">Unassigned</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-3 text-xs font-semibold text-slate-300">
                                                        {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Deadline'}
                                                    </td>
                                                    <td className="py-3.5 pr-4 text-center">
                                                        {task.status === 'COMPLETED' ? (
                                                            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                                COMPLETED
                                                            </span>
                                                        ) : task.status === 'IN_PROGRESS' ? (
                                                            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                                                IN PROGRESS
                                                            </span>
                                                        ) : task.status === 'LOCKED' ? (
                                                            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                                                                LOCKED / OVERDUE
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                                PENDING
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* LUMI AI Strategic Analyst Assistant Modal/Drawer */}
            <LumiAiAnalyserAssistant
                isOpen={isAiAssistantOpen}
                onClose={() => setIsAiAssistantOpen(false)}
                businesses={analyticsData.businesses}
                currentContext={{
                    selectedBusiness: currentBiz,
                    selectedBatch: currentBatch,
                    timeFilter,
                    freeSeminar: freeSem,
                    afterSeminar: afterSem,
                    taskCenter,
                    overview: analyticsData.overview
                }}
            />
        </div>
    );
}

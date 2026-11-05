import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { 
    CreditCard, DollarSign, TrendingUp, RefreshCw, Download, 
    Smartphone, ShieldCheck, AlertTriangle, Layers, Calendar, 
    Filter, Settings, CheckCircle2, MessageSquare, Zap, Activity,
    Sliders, ExternalLink, ArrowUpRight, Clock, HelpCircle, X
} from 'lucide-react';
import { io } from 'socket.io-client';

export default function WhatsAppBillingDashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshingHealth, setRefreshingHealth] = useState(false);
    const [overviewData, setOverviewData] = useState(null);
    const [phoneHealth, setPhoneHealth] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); // overview, numbers, logs
    
    // Filters
    const [range, setRange] = useState('this_month');
    const [selectedBusiness, setSelectedBusiness] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [businesses, setBusinesses] = useState([]);

    // Rate Settings Modal
    const [showRateModal, setShowRateModal] = useState(false);
    const [ratesForm, setRatesForm] = useState({
        MARKETING: 0.0528,
        UTILITY: 0.0150,
        AUTHENTICATION: 0.0154,
        SERVICE: 0.0125,
        USD_TO_LKR: 305
    });
    const [savingRates, setSavingRates] = useState(false);

    useEffect(() => {
        fetchBusinesses();
        fetchBillingOverview();
        fetchPhoneHealth();

        // Socket for live updates
        const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
        const socket = io(socketUrl, { transports: ['websocket'] });

        socket.on('whatsapp_billing_update', (data) => {
            console.log('[Socket] WhatsApp billing live event:', data);
            fetchBillingOverview(false); // background silent refresh
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        fetchBillingOverview(true);
    }, [range, selectedBusiness, startDate, endDate]);

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/admin/businesses');
            const list = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);
            setBusinesses(list);
        } catch (e) {
            console.error('Failed to load businesses:', e);
        }
    };

    const fetchBillingOverview = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const params = { range };
            if (selectedBusiness) params.businessId = selectedBusiness;
            if (range === 'custom' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }

            const res = await axios.get('/admin/whatsapp-billing/overview', { params });
            if (res.data?.success) {
                setOverviewData(res.data.data);
                if (res.data.data.rates) {
                    setRatesForm(res.data.data.rates);
                }
            }
        } catch (error) {
            console.error('Error fetching billing overview:', error);
            if (showLoading) toast.error('Failed to load WhatsApp billing metrics');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const fetchPhoneHealth = async () => {
        setRefreshingHealth(true);
        try {
            const res = await axios.get('/admin/whatsapp-billing/health');
            if (res.data?.success) {
                setPhoneHealth(res.data.health || []);
            }
        } catch (error) {
            console.error('Error fetching phone health:', error);
        } finally {
            setRefreshingHealth(false);
        }
    };

    const handleSaveRates = async (e) => {
        e.preventDefault();
        setSavingRates(true);
        try {
            const res = await axios.put('/admin/whatsapp-billing/rates', ratesForm);
            if (res.data?.success) {
                toast.success('Pricing rates updated successfully!');
                setShowRateModal(false);
                fetchBillingOverview(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update rates');
        } finally {
            setSavingRates(false);
        }
    };

    const handleExportCsv = async () => {
        const toastId = toast.loading('Exporting WhatsApp billing CSV...');
        try {
            const params = { range };
            if (selectedBusiness) params.businessId = selectedBusiness;
            if (range === 'custom' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }
            const res = await axios.get('/admin/whatsapp-billing/export', {
                params,
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `whatsapp_billing_${range}_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('CSV Export downloaded successfully', { id: toastId });
        } catch (err) {
            console.error('Export CSV error:', err);
            toast.error('Failed to export CSV', { id: toastId });
        }
    };

    const formatCurrency = (usd = 0, lkr = 0) => {
        return {
            usd: `$${Number(usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            lkr: `LKR ${Number(lkr).toLocaleString()}`
        };
    };

    const getQualityBadge = (rating) => {
        switch (rating) {
            case 'GREEN':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><CheckCircle2 size={12} /> High Quality</span>;
            case 'YELLOW':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30"><AlertTriangle size={12} /> Medium Quality</span>;
            case 'RED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30"><AlertTriangle size={12} /> Low Quality</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">Unknown</span>;
        }
    };

    const summary = overviewData?.summary || {
        totalCostUsd: 0,
        totalCostLkr: 0,
        todayCostUsd: 0,
        todayCostLkr: 0,
        totalMessages: 0,
        totalBillable: 0,
        usdToLkrRate: 305
    };

    const categoryStats = overviewData?.categoryStats || {};
    const businessBreakdown = overviewData?.businessBreakdown || [];
    const dailyTrend = overviewData?.dailyTrend || [];
    const recentLogs = overviewData?.recentLogs || [];

    const totalBill = formatCurrency(summary.totalCostUsd, summary.totalCostLkr);
    const todayBill = formatCurrency(summary.todayCostUsd, summary.todayCostLkr);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6 font-sans">
            {/* Top Navigation & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <CreditCard size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                WhatsApp API Billing & Spend
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold tracking-wider uppercase font-outfit">LIVE REAL-TIME</span>
                            </h1>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Real-time Meta Cloud API conversation charges, usage rates & number health
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Rate indicator pill */}
                    <button 
                        onClick={() => setShowRateModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-2 transition"
                    >
                        <Zap size={14} className="text-amber-400" />
                        <span>1 USD = <strong className="text-white font-outfit font-bold tabular-nums">{summary.usdToLkrRate || 305} LKR</strong></span>
                        <Settings size={13} className="text-slate-400 hover:text-white" />
                    </button>

                    {/* Meta health refresh */}
                    <button
                        onClick={fetchPhoneHealth}
                        disabled={refreshingHealth}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
                        title="Sync live status with Meta Graph API"
                    >
                        <RefreshCw size={14} className={refreshingHealth ? "animate-spin text-emerald-400" : "text-slate-400"} />
                        <span>Sync Meta</span>
                    </button>

                    {/* CSV Export */}
                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
                    >
                        <Download size={14} className="text-cyan-400" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
                <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Time Period</label>
                    <div className="relative">
                        <select
                            value={range}
                            onChange={(e) => setRange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="this_week">This Week</option>
                            <option value="last_week">Last Week</option>
                            <option value="last_7_days">Last 7 Days</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="custom">Custom Date Range</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Business Line</label>
                    <select
                        value={selectedBusiness}
                        onChange={(e) => setSelectedBusiness(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                    >
                        <option value="">All Businesses</option>
                        {businesses.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                {range === 'custom' && (
                    <>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </>
                )}

                {range !== 'custom' && (
                    <div className="md:col-span-2 flex items-center justify-end text-xs text-slate-400 pr-2">
                        <span className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                            <Clock size={13} className="text-emerald-400" />
                            Showing data for: <strong className="text-slate-200 capitalize">{range.replace(/_/g, ' ')}</strong>
                        </span>
                    </div>
                )}
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Estimated Bill Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5 border border-emerald-500/30 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Period Bill</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-3xl font-black text-white font-outfit tracking-tight tabular-nums">
                            {totalBill.usd}
                        </div>
                        <div className="text-sm font-bold text-emerald-400/90 font-outfit tracking-tight tabular-nums">
                            ≈ {totalBill.lkr}
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Today's Spend:</span>
                        <span className="font-outfit font-bold text-slate-200 tabular-nums">{todayBill.usd} <span className="text-slate-400 font-normal">({todayBill.lkr})</span></span>
                    </div>
                </div>

                {/* 2. Marketing Spend Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-900 p-5 border border-purple-500/20 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Marketing Broadcasts</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                            <Zap size={18} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-3xl font-black text-white font-outfit tracking-tight tabular-nums">
                            ${Number(categoryStats.MARKETING?.costUsd || 0).toFixed(2)}
                        </div>
                        <div className="text-sm font-bold text-purple-400/90 font-outfit tracking-tight tabular-nums">
                            ≈ LKR {(categoryStats.MARKETING?.costLkr || 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Messages Count:</span>
                        <span className="font-outfit font-bold text-slate-200 tabular-nums">{(categoryStats.MARKETING?.count || 0).toLocaleString()} msgs</span>
                    </div>
                </div>

                {/* 3. Utility & Authentication Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900 p-5 border border-blue-500/20 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Utility & Alerts</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                            <Layers size={18} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-3xl font-black text-white font-outfit tracking-tight tabular-nums">
                            ${Number((categoryStats.UTILITY?.costUsd || 0) + (categoryStats.AUTHENTICATION?.costUsd || 0)).toFixed(2)}
                        </div>
                        <div className="text-sm font-bold text-blue-400/90 font-outfit tracking-tight tabular-nums">
                            ≈ LKR {((categoryStats.UTILITY?.costLkr || 0) + (categoryStats.AUTHENTICATION?.costLkr || 0)).toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Messages Count:</span>
                        <span className="font-outfit font-bold text-slate-200 tabular-nums">{((categoryStats.UTILITY?.count || 0) + (categoryStats.AUTHENTICATION?.count || 0)).toLocaleString()} msgs</span>
                    </div>
                </div>

                {/* 4. Total Messages Volume Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 p-5 border border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Volume</span>
                        <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
                            <MessageSquare size={18} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-3xl font-black text-white font-outfit tracking-tight tabular-nums">
                            {(summary.totalMessages || 0).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-slate-400 font-outfit">
                            Billable: <strong className="text-emerald-400 font-bold tabular-nums">{(summary.totalBillable || 0).toLocaleString()}</strong>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Service msgs (Free Tier):</span>
                        <span className="font-outfit font-bold text-slate-200 tabular-nums">{(categoryStats.SERVICE?.count || 0).toLocaleString()} msgs</span>
                    </div>
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                        activeTab === 'overview'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                >
                    <TrendingUp size={16} />
                    <span>Business & Number Breakdown</span>
                </button>
                <button
                    onClick={() => setActiveTab('numbers')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                        activeTab === 'numbers'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                >
                    <Smartphone size={16} />
                    <span>API Numbers & Quality Health ({phoneHealth.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                        activeTab === 'logs'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                >
                    <Activity size={16} />
                    <span>Live Webhook Log Stream ({recentLogs.length})</span>
                </button>
            </div>

            {/* TAB 1: OVERVIEW & BREAKDOWN */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Number-wise / Business Breakdown Table */}
                    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-white text-base">Cost Breakdown by WhatsApp API Number</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Calculated based on Meta Cloud API billing rates per conversation category</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="animate-spin inline-block mb-3 text-emerald-400" size={24} />
                                <p className="text-sm">Calculating billing metrics...</p>
                            </div>
                        ) : businessBreakdown.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Smartphone className="inline-block mb-3 text-slate-600" size={32} />
                                <p className="text-base font-semibold text-slate-300">No billable message logs for this period</p>
                                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                    New messages sent via WhatsApp Cloud API will appear here in real-time as Meta delivers billing webhooks.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                            <th className="py-3 px-4">Business Name</th>
                                            <th className="py-3 px-4">Phone Number</th>
                                            <th className="py-3 px-4 text-center">Total Messages</th>
                                            <th className="py-3 px-4 text-center">Marketing</th>
                                            <th className="py-3 px-4 text-center">Utility</th>
                                            <th className="py-3 px-4 text-center">Service</th>
                                            <th className="py-3 px-4 text-right">Spend (USD)</th>
                                            <th className="py-3 px-4 text-right">Spend (LKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 font-medium font-outfit">
                                        {businessBreakdown.map((b, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30 transition">
                                                <td className="py-3.5 px-4 font-semibold text-white">
                                                    {b.businessName}
                                                </td>
                                                <td className="py-3.5 px-4 font-medium text-slate-300 tabular-nums">
                                                    {b.phoneNumber}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold text-slate-200 tabular-nums">
                                                    {b.count.toLocaleString()}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold text-purple-400 tabular-nums">
                                                    {b.marketingCount}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold text-blue-400 tabular-nums">
                                                    {b.utilityCount}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold text-emerald-400 tabular-nums">
                                                    {b.serviceCount}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-black text-emerald-400 tabular-nums">
                                                    ${b.costUsd.toFixed(2)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right text-slate-200 font-bold tabular-nums">
                                                    LKR {b.costLkr.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-950 font-bold border-t border-slate-800 font-outfit">
                                            <td colSpan={2} className="py-3.5 px-4 text-white">Total</td>
                                            <td className="py-3.5 px-4 text-center font-black text-white tabular-nums">{summary.totalMessages.toLocaleString()}</td>
                                            <td className="py-3.5 px-4 text-center font-black text-purple-400 tabular-nums">{categoryStats.MARKETING?.count || 0}</td>
                                            <td className="py-3.5 px-4 text-center font-black text-blue-400 tabular-nums">{categoryStats.UTILITY?.count || 0}</td>
                                            <td className="py-3.5 px-4 text-center font-black text-emerald-400 tabular-nums">{categoryStats.SERVICE?.count || 0}</td>
                                            <td className="py-3.5 px-4 text-right font-black text-emerald-400 text-base tabular-nums">${summary.totalCostUsd.toFixed(2)}</td>
                                            <td className="py-3.5 px-4 text-right font-black text-white text-base tabular-nums">LKR {summary.totalCostLkr.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Daily Spend Trend */}
                    {dailyTrend.length > 0 && (
                        <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-xl">
                            <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                                <TrendingUp size={18} className="text-emerald-400" />
                                <span>Daily Spend & Usage Trend</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                                {dailyTrend.map((d, i) => (
                                    <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-center space-y-1 font-outfit">
                                        <div className="text-[11px] font-semibold text-slate-400">{d.date}</div>
                                        <div className="text-base font-black text-emerald-400 tabular-nums">${d.costUsd.toFixed(2)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium tabular-nums">{d.count} messages</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: PHONE NUMBERS & META HEALTH */}
            {activeTab === 'numbers' && (
                <div className="space-y-4">
                    <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white text-base">Meta Verified WhatsApp API Numbers</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Live quality rating, verified business display name, and daily messaging tier limits directly from Meta Graph API</p>
                        </div>
                        <button
                            onClick={fetchPhoneHealth}
                            disabled={refreshingHealth}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20 transition flex items-center gap-2"
                        >
                            <RefreshCw size={13} className={refreshingHealth ? "animate-spin" : ""} />
                            <span>{refreshingHealth ? 'Syncing...' : 'Sync Live Status'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {phoneHealth.map((ph, idx) => (
                            <div key={idx} className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3 hover:border-slate-700 transition shadow-lg">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-bold text-white text-base">{ph.businessName}</h4>
                                        <span className="text-xs text-slate-400 font-medium">{ph.campaignType}</span>
                                    </div>
                                    {getQualityBadge(ph.qualityRating)}
                                </div>

                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs font-outfit">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Phone Number:</span>
                                        <span className="font-bold text-white tabular-nums">{ph.displayPhoneNumber || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Verified Name:</span>
                                        <span className="text-emerald-400 font-semibold">{ph.verifiedName || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Messaging Limit:</span>
                                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">{ph.messagingLimitTier}</span>
                                    </div>
                                </div>

                                <div className="text-[11px] text-slate-500 space-y-0.5 font-sans">
                                    <div>Phone ID: <span className="text-slate-400 font-mono text-[10px]">{ph.phoneNumberId}</span></div>
                                    <div>WABA ID: <span className="text-slate-400 font-mono text-[10px]">{ph.wabaId}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: LIVE WEBHOOK LOG STREAM */}
            {activeTab === 'logs' && (
                <div className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white text-base flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <span>Real-Time Meta Billing Webhook Stream</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Every billable status event delivered by Meta Cloud API is tracked here with exact category & calculated cost</p>
                        </div>
                    </div>

                    {recentLogs.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Activity size={32} className="inline-block mb-3 text-slate-600" />
                            <p className="text-base font-semibold text-slate-300">No recent logs</p>
                            <p className="text-xs text-slate-500 mt-1">Logs will appear in real time when messages are sent to students/leads.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs font-outfit">
                                <thead>
                                     <tr className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                         <th className="py-2.5 px-4">Time</th>
                                         <th className="py-2.5 px-4">Business</th>
                                         <th className="py-2.5 px-4">Recipient</th>
                                         <th className="py-2.5 px-4">Category</th>
                                         <th className="py-2.5 px-4">Status</th>
                                         <th className="py-2.5 px-4 text-right">Cost (USD)</th>
                                         <th className="py-2.5 px-4 text-right">Cost (LKR)</th>
                                     </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                     {recentLogs.map((log) => (
                                         <tr key={log.id} className="hover:bg-slate-800/30 transition">
                                             <td className="py-2 px-4 text-slate-400">
                                                 {new Date(log.timestamp).toLocaleTimeString()}
                                             </td>
                                             <td className="py-2 px-4 font-semibold text-white">
                                                 {log.businessName}
                                             </td>
                                             <td className="py-2 px-4 text-slate-300 tabular-nums">
                                                 {log.recipient}
                                             </td>
                                             <td className="py-2 px-4">
                                                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                     log.category === 'MARKETING' ? 'bg-purple-500/20 text-purple-300' :
                                                     log.category === 'UTILITY' ? 'bg-blue-500/20 text-blue-300' :
                                                     'bg-emerald-500/20 text-emerald-300'
                                                 }`}>
                                                     {log.category}
                                                 </span>
                                             </td>
                                             <td className="py-2 px-4 capitalize text-slate-300">
                                                 {log.status}
                                             </td>
                                             <td className="py-2 px-4 text-right font-bold text-emerald-400 tabular-nums">
                                                 ${log.costUsd.toFixed(4)}
                                             </td>
                                             <td className="py-2 px-4 text-right font-bold text-slate-200 tabular-nums">
                                                 LKR {log.costLkr}
                                             </td>
                                         </tr>
                                     ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* RATE CONFIGURATION MODAL */}
            {showRateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 font-sans">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <Sliders size={18} className="text-emerald-400" />
                                <h3 className="font-bold text-lg text-white">WhatsApp Pricing & Exchange Rates</h3>
                            </div>
                            <button
                                onClick={() => setShowRateModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRates} className="space-y-4 font-outfit">
                            <div>
                                <label className="text-xs font-semibold text-slate-300 block mb-1">
                                    USD to LKR Exchange Rate (1 USD in LKR)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={ratesForm.USD_TO_LKR}
                                    onChange={(e) => setRatesForm({ ...ratesForm, USD_TO_LKR: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="border-t border-slate-800 pt-3">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                                    Meta Cloud API Rates per Conversation (USD)
                                </span>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-purple-400 font-semibold">Marketing Conversation Rate</span>
                                            <span className="text-slate-500 font-medium tabular-nums">Meta standard: ~$0.0528</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={ratesForm.MARKETING}
                                            onChange={(e) => setRatesForm({ ...ratesForm, MARKETING: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold tabular-nums focus:border-purple-500 focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-blue-400 font-semibold">Utility Conversation Rate</span>
                                            <span className="text-slate-500 font-medium tabular-nums">Meta standard: ~$0.0150</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={ratesForm.UTILITY}
                                            onChange={(e) => setRatesForm({ ...ratesForm, UTILITY: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold tabular-nums focus:border-blue-500 focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-emerald-400 font-semibold">Service Conversation Rate</span>
                                            <span className="text-slate-500 font-medium tabular-nums">1,000 Free, then ~$0.0125</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={ratesForm.SERVICE}
                                            onChange={(e) => setRatesForm({ ...ratesForm, SERVICE: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRateModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRates}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                                >
                                    {savingRates ? 'Saving...' : 'Save Rates'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

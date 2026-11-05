import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { 
    BarChart3, Download, Loader2, FileText, Search, User, 
    Users, CreditCard, AlertTriangle, ChevronDown, 
    ChevronRight, RefreshCw, Package, Truck, Layers, CheckCircle2,
    X, ArrowUpDown, Calendar, Building, ShieldAlert
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// 👤 Smart Lecturer Avatar Component with multi-directory fallback
const SmartLecturerAvatar = ({ image, name, size = "w-8 h-8", textSize = "text-xs" }) => {
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

    // Build base URL without trailing /api
    const baseUrl = useMemo(() => {
        let base = axios.defaults?.baseURL || '';
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
            `${baseUrl}/storage/icons/${stripped}`,
            `${baseUrl}/storage/images/${stripped}`,
            `${baseUrl}/storage/documents/${stripped}`,
            `${baseUrl}/storage/users/${stripped}`,
            `${baseUrl}/api/storage/icons/${stripped}`,
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

    // 1-2 initials from teacher's name
    const initials = useMemo(() => {
        if (!name) return 'L';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }, [name]);

    const gradient = useMemo(() => {
        const colors = [
            'from-rose-500 to-indigo-600',
            'from-amber-500 to-pink-600',
            'from-emerald-500 to-teal-700',
            'from-blue-500 to-cyan-600',
            'from-purple-500 to-violet-700',
            'from-fuchsia-500 to-rose-600'
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = (hash + (name || '').charCodeAt(i)) % colors.length;
        }
        return colors[hash];
    }, [name]);

    if (!cleanImg || failed || candidateUrls.length === 0) {
        return (
            <div className={`${size} rounded-full bg-gradient-to-tr ${gradient} text-white font-black ${textSize} flex items-center justify-center shrink-0 shadow-md select-none border border-white/20`}>
                {initials}
            </div>
        );
    }

    return (
        <div className={`${size} rounded-full overflow-hidden bg-gray-100 dark:bg-black/40 border border-brand-accent/30 shrink-0 shadow-sm relative`}>
            <img
                src={candidateUrls[imgIndex]}
                onError={handleError}
                alt=""
                className="w-full h-full object-cover"
            />
        </div>
    );
};

export default function StockReports({ loggedInUser }) {
    const [selectedBusiness, setSelectedBusiness] = useState('All');
    const [selectedLecturer, setSelectedLecturer] = useState('All');
    const [paymentType, setPaymentType] = useState('All');
    const [hazardOnly, setHazardOnly] = useState(false);
    const [dateType, setDateType] = useState('all_time');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('lecturer'); // 'lecturer' | 'materials'
    const [showChart, setShowChart] = useState(false);

    const [stockData, setStockData] = useState({ businesses: [], lecturers: [], summary: null });
    const [loading, setLoading] = useState(false);
    const [expandedLecturers, setExpandedLecturers] = useState(new Set());
    
    const [sortField, setSortField] = useState('totalDelivered');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchStockReport();
    }, [selectedBusiness, dateType, startDate, endDate, paymentType]);

    const handleDateTypeChange = (type) => {
        setDateType(type);
        const today = new Date();
        let start = '';
        let end = '';
        if (type === 'this_month') {
            const s = new Date(today.getFullYear(), today.getMonth(), 1);
            const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            start = s.toISOString().split('T')[0];
            end = e.toISOString().split('T')[0];
        } else if (type === 'last_month') {
            const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const e = new Date(today.getFullYear(), today.getMonth(), 0);
            start = s.toISOString().split('T')[0];
            end = e.toISOString().split('T')[0];
        } else if (type === 'all_time') {
            start = '';
            end = '';
        }
        setStartDate(start);
        setEndDate(end);
    };

    const fetchStockReport = async () => {
        setLoading(true);
        try {
            const params = {
                businessId: selectedBusiness || 'All'
            };
            if (dateType !== 'all_time' && startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }
            if (paymentType && paymentType !== 'All') {
                params.paymentType = paymentType;
            }

            const res = await axios.get('/admin/delivery/manager/lecturer-stock', { params });
            if (res.data) {
                setStockData(res.data);
            }
        } catch (error) {
            console.error("Failed to load stock reports:", error);
            toast.error("Failed to fetch stock reports");
        } finally {
            setLoading(false);
        }
    };

    // Available lecturers derived from current stockData
    const availableLecturers = useMemo(() => {
        if (!stockData?.lecturers) return [];
        return stockData.lecturers.map(l => l.name).sort((a, b) => a.localeCompare(b));
    }, [stockData]);

    // Filter lecturers and their tutes based on client-side search, hazard toggle & dropdown filters
    const filteredLecturers = useMemo(() => {
        if (!stockData?.lecturers) return [];
        const q = searchQuery.toLowerCase().trim();

        return stockData.lecturers
            .filter(lec => {
                if (selectedLecturer !== 'All' && lec.name !== selectedLecturer) {
                    return false;
                }
                return true;
            })
            .map(lec => {
                // Filter inner tutes by search query & hazard toggle
                const matchingTutes = lec.tutes.filter(t => {
                    if (hazardOnly && (t.availableQuantity || 0) >= 10) {
                        return false;
                    }
                    if (q) {
                        const matchLec = lec.name.toLowerCase().includes(q);
                        const matchTute = t.tuteName.toLowerCase().includes(q);
                        const matchCourse = t.courseName.toLowerCase().includes(q);
                        const matchBiz = (t.businessName || '').toLowerCase().includes(q);
                        if (!matchLec && !matchTute && !matchCourse && !matchBiz) {
                            return false;
                        }
                    }
                    return true;
                });

                const monthlyTutes = matchingTutes.filter(t => (t.paymentType || '').toLowerCase().includes('monthly'));
                const fullTutes = matchingTutes.filter(t => (t.paymentType || '').toLowerCase().includes('full'));

                const totalDel = matchingTutes.reduce((sum, t) => sum + (t.totalDelivered || 0), 0);
                const monthlyDelivered = monthlyTutes.reduce((sum, t) => sum + (t.totalDelivered || 0), 0);
                const fullDelivered = fullTutes.reduce((sum, t) => sum + (t.totalDelivered || 0), 0);

                const totalStock = matchingTutes.reduce((sum, t) => sum + (t.availableQuantity || 0), 0);
                const monthlyStock = monthlyTutes.reduce((sum, t) => sum + (t.availableQuantity || 0), 0);
                const fullStock = fullTutes.reduce((sum, t) => sum + (t.availableQuantity || 0), 0);

                // Compute hazard count (< 10) from lecturer's raw tutes
                const rawHazardTutes = (lec.tutes || []).filter(t => (t.availableQuantity || 0) < 10);
                const hazardCount = rawHazardTutes.length;
                const hasHazard = hazardCount > 0;

                return {
                    ...lec,
                    filteredTutes: matchingTutes,
                    displayDelivered: totalDel,
                    monthlyDelivered,
                    fullDelivered,
                    displayStock: totalStock,
                    monthlyStock,
                    fullStock,
                    monthlyCount: monthlyTutes.length,
                    fullCount: fullTutes.length,
                    hazardCount,
                    hasHazard,
                    monthlyTutesList: monthlyTutes,
                    fullTutesList: fullTutes
                };
            })
            .filter(lec => {
                if (hazardOnly && !lec.hasHazard) {
                    return false;
                }
                if (q) {
                    const matchLec = lec.name.toLowerCase().includes(q);
                    return matchLec || lec.filteredTutes.length > 0;
                }
                return true;
            })
            .sort((a, b) => {
                if (sortField === 'name') {
                    return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
                if (sortField === 'totalDelivered') {
                    return sortOrder === 'asc' ? a.displayDelivered - b.displayDelivered : b.displayDelivered - a.displayDelivered;
                }
                if (sortField === 'totalStock') {
                    return sortOrder === 'asc' ? a.displayStock - b.displayStock : b.displayStock - a.displayStock;
                }
                if (sortField === 'hazard') {
                    return sortOrder === 'asc' ? a.hazardCount - b.hazardCount : b.hazardCount - a.hazardCount;
                }
                if (sortField === 'tutesCount') {
                    return sortOrder === 'asc' ? a.filteredTutes.length - b.filteredTutes.length : b.filteredTutes.length - a.filteredTutes.length;
                }
                return 0;
            });
    }, [stockData, selectedLecturer, searchQuery, hazardOnly, sortField, sortOrder]);

    // Flat list of all materials across filtered lecturers
    const allFilteredMaterials = useMemo(() => {
        const list = [];
        filteredLecturers.forEach(lec => {
            lec.filteredTutes.forEach(t => {
                list.push({
                    ...t,
                    lecturerName: lec.name,
                    lecturerImage: lec.image
                });
            });
        });
        return list;
    }, [filteredLecturers]);

    // Computed summary based on currently filtered records
    const computedSummary = useMemo(() => {
        const totalLecs = filteredLecturers.length;
        const totalMats = allFilteredMaterials.length;
        const totalDel = allFilteredMaterials.reduce((sum, m) => sum + (m.totalDelivered || 0), 0);
        const totalStock = allFilteredMaterials.reduce((sum, m) => sum + (m.availableQuantity || 0), 0);

        const totalFullDel = allFilteredMaterials
            .filter(m => (m.paymentType || '').toLowerCase().includes('full'))
            .reduce((sum, m) => sum + (m.totalDelivered || 0), 0);
        const totalMonthlyDel = allFilteredMaterials
            .filter(m => (m.paymentType || '').toLowerCase().includes('monthly'))
            .reduce((sum, m) => sum + (m.totalDelivered || 0), 0);

        const totalFullStock = allFilteredMaterials
            .filter(m => (m.paymentType || '').toLowerCase().includes('full'))
            .reduce((sum, m) => sum + (m.availableQuantity || 0), 0);
        const totalMonthlyStock = allFilteredMaterials
            .filter(m => (m.paymentType || '').toLowerCase().includes('monthly'))
            .reduce((sum, m) => sum + (m.availableQuantity || 0), 0);

        const hazardCount = allFilteredMaterials.filter(m => (m.availableQuantity ?? 0) < 10).length;
        const hazardLecturersCount = filteredLecturers.filter(l => l.hasHazard).length;

        return { 
            totalLecs, 
            totalMats, 
            totalDel, 
            totalFullDel, 
            totalMonthlyDel,
            totalStock,
            totalFullStock,
            totalMonthlyStock,
            hazardCount,
            hazardLecturersCount
        };
    }, [filteredLecturers, allFilteredMaterials]);

    const toggleLecturerExpand = (lecName) => {
        setExpandedLecturers(prev => {
            const next = new Set(prev);
            if (next.has(lecName)) {
                next.delete(lecName);
            } else {
                next.add(lecName);
            }
            return next;
        });
    };

    const toggleExpandAll = () => {
        if (expandedLecturers.size >= filteredLecturers.length) {
            setExpandedLecturers(new Set());
        } else {
            setExpandedLecturers(new Set(filteredLecturers.map(l => l.name)));
        }
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const exportToCSV = () => {
        if (allFilteredMaterials.length === 0) {
            toast.error("No data available to export");
            return;
        }

        const headers = ["Lecturer", "Business", "Course / Subject", "Batch", "Material / Tute Name", "Payment Type", "Delivered Qty", "Available Stock"];
        const rows = allFilteredMaterials.map(m => [
            `"${m.lecturerName || ''}"`,
            `"${m.businessName || ''}"`,
            `"${m.courseName || ''}"`,
            `"${m.batchName || ''}"`,
            `"${m.tuteName || ''}"`,
            `"${m.paymentType || ''}"`,
            m.totalDelivered || 0,
            m.availableQuantity || 0
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute("download", `Delivery_Report_${dateType}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("CSV report downloaded successfully");
    };

    // Chart Data (Top 15 materials by deliveries)
    const chartData = useMemo(() => {
        return allFilteredMaterials
            .slice(0, 15)
            .map(m => ({
                name: (m.tuteName || m.courseName || '').substring(0, 16) + '...',
                Delivered: m.totalDelivered || 0
            }));
    }, [allFilteredMaterials]);

    return (
        <div className="animate-fade-in font-sans relative z-10 w-full h-full flex flex-col space-y-3.5">
            {/* TOP HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-white/10 pb-3">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                            <Layers size={20} />
                        </span>
                        Lecturer Delivery & Material Reports
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 font-bold">
                        Track student deliveries, analyze material distribution, and view lecturer-wise dispatches.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href="/manager/tute-stock"
                        className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all shadow-sm"
                        title="Open Packing Calendar & Tute Stock"
                    >
                        <Calendar size={14} />
                        Calendar 📦
                    </a>

                    <button
                        onClick={() => setShowChart(!showChart)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                            showChart
                                ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
                                : 'bg-white dark:bg-black/40 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-brand-accent/40'
                        }`}
                    >
                        <BarChart3 size={14} />
                        {showChart ? 'Hide Chart' : 'Show Chart'}
                    </button>

                    <button
                        onClick={exportToCSV}
                        disabled={allFilteredMaterials.length === 0}
                        className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 disabled:opacity-50 transition-all shadow-sm"
                        title="Export current filtered data to CSV"
                    >
                        <Download size={14} />
                        CSV
                    </button>

                    <button
                        onClick={fetchStockReport}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-white dark:bg-black/40 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 hover:border-brand-accent/50 disabled:opacity-50 transition-all shadow-sm"
                        title="Reload latest data"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-brand-accent' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* SUMMARY STAT CARDS (Focused on Lecturers, Materials, Delivered, and Available Stock) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-sm backdrop-blur-md flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <Users size={18} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 truncate">Active Lecturers</div>
                        <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5 truncate">
                            {computedSummary.totalLecs}
                            <span className="text-[10px] font-bold text-gray-400 ml-1">lecturers</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-sm backdrop-blur-md flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <Layers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 truncate">Material Types</div>
                        <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5 truncate">
                            {computedSummary.totalMats}
                            <span className="text-[10px] font-bold text-gray-400 font-sans ml-1">types</span>
                        </div>
                        <div className="text-[9.5px] font-bold text-gray-400 mt-0.5 truncate">
                            Full &amp; Monthly Tutes
                        </div>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-sm backdrop-blur-md flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <Truck size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 truncate">Total Delivered</div>
                        <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5 font-mono truncate">
                            {computedSummary.totalDel.toLocaleString()}
                            <span className="text-[10px] font-bold text-gray-400 font-sans ml-1">items</span>
                        </div>
                        <div className="text-[9.5px] font-bold text-gray-400 mt-0.5 truncate flex items-center gap-1.5 font-mono">
                            <span className="text-purple-400" title="Full Tutes Delivered">F: {computedSummary.totalFullDel.toLocaleString()}</span>
                            <span className="text-gray-500/60">•</span>
                            <span className="text-blue-400" title="Monthly Tutes Delivered">M: {computedSummary.totalMonthlyDel.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-sm backdrop-blur-md flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Package size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 truncate">Available Stock</span>
                            {computedSummary.hazardCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[8.5px] font-black text-rose-500 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded animate-pulse" title="Critical low stock alert">
                                    <AlertTriangle size={9} /> {computedSummary.hazardCount} &lt; 10
                                </span>
                            )}
                        </div>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono truncate">
                            {computedSummary.totalStock.toLocaleString()}
                            <span className="text-[10px] font-bold text-gray-400 font-sans ml-1">pcs</span>
                        </div>
                        <div className="text-[9.5px] font-bold text-gray-400 mt-0.5 truncate flex items-center gap-1.5 font-mono">
                            <span className="text-purple-400" title="Full Tutes Stock">F: {computedSummary.totalFullStock.toLocaleString()}</span>
                            <span className="text-gray-500/60">•</span>
                            <span className="text-blue-400" title="Monthly Tutes Stock">M: {computedSummary.totalMonthlyStock.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* OPTIONAL CHART */}
            {showChart && chartData.length > 0 && (
                <div className="bg-white/80 dark:bg-black/30 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm backdrop-blur-md h-60">
                    <div className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                        <BarChart3 size={14} className="text-brand-accent"/> Deliveries Distribution (Top Materials)
                    </div>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
                            <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#fff' }} itemStyle={{ fontWeight: 800 }} />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar dataKey="Delivered" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* FILTER CONTROLS BAR (4-Column Grid: Search, Business, Lecturer, Payment Type) */}
            <div className="bg-white/80 dark:bg-black/30 p-3.5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm backdrop-blur-md space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* 1. SEARCH BAR */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                            <Search size={12} className="text-brand-accent" />
                            Search Material / Lecturer
                        </label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search lecturer, material, subject..."
                                className="w-full pl-8 pr-7 py-2 bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:border-brand-accent shadow-inner text-gray-800 dark:text-slate-200 h-[38px]"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 2. BUSINESS FILTER */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                            <Building size={12} className="text-brand-accent" />
                            Business
                        </label>
                        <select
                            value={selectedBusiness}
                            onChange={(e) => {
                                setSelectedBusiness(e.target.value);
                                setSelectedLecturer('All');
                            }}
                            className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200 outline-none focus:border-brand-accent shadow-inner transition-colors h-[38px]"
                        >
                            <option value="All">All Accessible Businesses ({stockData.businesses?.length || 0})</option>
                            {stockData.businesses?.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. LECTURER FILTER */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                            <Users size={12} className="text-brand-accent" />
                            Lecturer
                        </label>
                        <select
                            value={selectedLecturer}
                            onChange={(e) => setSelectedLecturer(e.target.value)}
                            className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200 outline-none focus:border-brand-accent shadow-inner transition-colors h-[38px]"
                        >
                            <option value="All">All Lecturers ({availableLecturers.length})</option>
                            {availableLecturers.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 4. PAYMENT TYPE FILTER */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                            <CreditCard size={12} className="text-brand-accent" />
                            Payment Type
                        </label>
                        <select
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value)}
                            className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-200 outline-none focus:border-brand-accent shadow-inner transition-colors h-[38px]"
                        >
                            <option value="All">All Payments</option>
                            <option value="Monthly">Monthly Only</option>
                            <option value="Full">Full Payment Only</option>
                        </select>
                    </div>
                </div>

                {/* SECOND ROW: TIME PERIOD + HAZARD TOGGLE + VIEW MODE */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-gray-200 dark:border-white/10">
                    {/* Time Period Buttons & Hazard Filter */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-500 mr-1">Period:</span>
                        {[
                            { key: 'all_time', label: 'All Time' },
                            { key: 'this_month', label: 'This Month' },
                            { key: 'last_month', label: 'Last Month' },
                            { key: 'custom', label: 'Custom' }
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => handleDateTypeChange(t.key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${
                                    dateType === t.key
                                        ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
                                        : 'bg-white dark:bg-black/30 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-brand-accent/40'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}

                        {dateType === 'custom' && (
                            <div className="flex items-center gap-1 ml-1.5">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent"
                                />
                                <span className="text-gray-400 font-bold">-</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-slate-300 outline-none focus:border-brand-accent"
                                />
                            </div>
                        )}

                        {/* Quick Hazard Alert Filter (< 10) */}
                        <button
                            onClick={() => setHazardOnly(!hazardOnly)}
                            className={`ml-2 px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                                hazardOnly
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-md animate-pulse'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/20'
                            }`}
                            title="Filter materials with stock below 10 pcs"
                        >
                            <AlertTriangle size={12} className={hazardOnly ? 'text-white' : 'text-rose-500'} />
                            <span>Hazard (&lt; 10)</span>
                            {computedSummary.hazardCount > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                                    hazardOnly ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-500'
                                }`}>
                                    {computedSummary.hazardCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* View Switcher: By Lecturer vs All Materials */}
                    <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shrink-0">
                        <button
                            onClick={() => setViewMode('lecturer')}
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                viewMode === 'lecturer'
                                    ? 'bg-brand-accent text-white shadow-sm'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Users size={13} />
                            By Lecturer
                        </button>
                        <button
                            onClick={() => setViewMode('materials')}
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                viewMode === 'materials'
                                    ? 'bg-brand-accent text-white shadow-sm'
                                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <Package size={13} />
                            All Materials
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN TABLE CONTAINER (NO SIDEWAYS SCROLL, COMPACT TABLE-FIXED) */}
            <div className="flex-1 bg-white/70 dark:bg-[#0c1017]/70 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-white/10 shadow-lg flex flex-col min-h-[420px] overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <Loader2 size={32} className="animate-spin text-brand-accent mb-2" />
                        <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Loading stock reports...</p>
                    </div>
                ) : filteredLecturers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400 dark:text-slate-500">
                        <FileText size={40} className="mb-2 opacity-30" />
                        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300">No stock records found</h3>
                        <p className="text-[11px] mt-0.5 text-gray-500">Try adjusting your search query or filters.</p>
                    </div>
                ) : viewMode === 'lecturer' ? (
                    /* ================= VIEW 1: GROUPED BY LECTURER TABLE ================= */
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.02]">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                Showing {filteredLecturers.length} Lecturers
                            </span>
                            <button
                                onClick={toggleExpandAll}
                                className="text-[11px] font-bold text-brand-accent hover:underline flex items-center gap-1"
                            >
                                {expandedLecturers.size >= filteredLecturers.length ? 'Collapse All' : 'Expand All Lecturers'}
                            </button>
                        </div>

                        <table className="w-full text-left border-collapse table-fixed">
                            <colgroup>
                                <col className="w-8" />                  {/* Chevron expand icon */}
                                <col className="w-[26%]" />              {/* Lecturer */}
                                <col className="w-[18%]" />              {/* Associated Businesses */}
                                <col className="w-[12%]" />              {/* Materials count */}
                                <col className="w-[14%]" />              {/* Delivered Qty */}
                                <col className="w-[14%]" />              {/* Available Stock */}
                                <col className="w-16" />                 {/* Action button */}
                            </colgroup>
                            <thead className="bg-gray-100/90 dark:bg-black/60 backdrop-blur-md sticky top-0 border-b border-gray-200 dark:border-white/10 z-10">
                                <tr className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                    <th className="py-2.5 px-1 text-center"></th>
                                    <th className="py-2.5 px-2.5 font-black cursor-pointer hover:text-brand-accent transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1 truncate">
                                            Lecturer <ArrowUpDown size={11} className="opacity-50 shrink-0" />
                                        </div>
                                    </th>
                                    <th className="py-2.5 px-2 font-black truncate">Associated Businesses</th>
                                    <th className="py-2.5 px-1.5 font-black text-center cursor-pointer hover:text-brand-accent transition-colors" onClick={() => handleSort('tutesCount')}>
                                        <div className="flex items-center justify-center gap-1 truncate">
                                            Materials <ArrowUpDown size={11} className="opacity-50 shrink-0" />
                                        </div>
                                    </th>
                                    <th className="py-2.5 px-1.5 font-black text-center cursor-pointer hover:text-brand-accent transition-colors" onClick={() => handleSort('totalDelivered')}>
                                        <div className="flex items-center justify-center gap-1 truncate" title="Total Delivered (Hover on row for Full vs Monthly)">
                                            Delivered <ArrowUpDown size={11} className="opacity-50 shrink-0" />
                                        </div>
                                    </th>
                                    <th className="py-2.5 px-1.5 font-black text-center cursor-pointer hover:text-brand-accent transition-colors" onClick={() => handleSort('totalStock')}>
                                        <div className="flex items-center justify-center gap-1 truncate" title="Available Stock (Current physical inventory)">
                                            Available Stock <ArrowUpDown size={11} className="opacity-50 shrink-0" />
                                        </div>
                                    </th>
                                    <th className="py-2.5 px-2 text-right pr-3 font-black truncate">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {filteredLecturers.map((lec, idx) => {
                                    const isExpanded = expandedLecturers.has(lec.name);
                                    const tutes = lec.filteredTutes;

                                    return (
                                        <React.Fragment key={lec.name}>
                                            <tr
                                                onClick={() => toggleLecturerExpand(lec.name)}
                                                className={`cursor-pointer transition-colors ${
                                                    isExpanded
                                                        ? 'bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08]'
                                                        : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.03]'
                                                }`}
                                            >
                                                <td className="py-2.5 px-1 text-center">
                                                    <span className="text-gray-400 transition-transform duration-200 inline-block">
                                                        {isExpanded ? <ChevronDown size={14} className="text-brand-accent" /> : <ChevronRight size={14} />}
                                                    </span>
                                                </td>

                                                {/* Lecturer Profile */}
                                                <td className="py-2.5 px-2.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <SmartLecturerAvatar image={lec.image} name={lec.name} size="w-7 h-7" textSize="text-[10px]" />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="font-black text-gray-900 dark:text-white text-xs truncate" title={lec.name}>
                                                                    {lec.name}
                                                                </span>
                                                                {lec.hasHazard && (
                                                                    <span 
                                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[8.5px] font-black uppercase tracking-wider shrink-0 animate-pulse"
                                                                        title={`Critical Hazard: ${lec.hazardCount} material type(s) have stock below 10 pcs!`}
                                                                    >
                                                                        <AlertTriangle size={10} className="text-rose-500 shrink-0" />
                                                                        <span>{lec.hazardCount} Hazard &lt; 10</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-gray-400 truncate">
                                                                {tutes.length} registered tute type{tutes.length === 1 ? '' : 's'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Businesses */}
                                                <td className="py-2.5 px-2">
                                                    <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                                                        {lec.businesses && lec.businesses.length > 0 ? (
                                                            lec.businesses.slice(0, 2).map(b => (
                                                                <span
                                                                    key={b.id}
                                                                    title={b.name}
                                                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 truncate max-w-[120px]"
                                                                >
                                                                    {b.name}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 italic">General / All</span>
                                                        )}
                                                        {lec.businesses && lec.businesses.length > 2 && (
                                                            <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-white/5 text-gray-400">
                                                                +{lec.businesses.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Tutes Types Count */}
                                                <td className="py-2.5 px-1.5 text-center">
                                                    <div className="inline-flex flex-col items-center justify-center">
                                                        <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-bold text-xs text-gray-700 dark:text-slate-300">
                                                            {tutes.length} Types
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[8.5px] font-mono text-gray-400 mt-0.5">
                                                            <span className="text-purple-400" title={`Full: ${lec.fullCount} types`}>F:{lec.fullCount}</span>
                                                            <span className="text-gray-500/50">•</span>
                                                            <span className="text-blue-400" title={`Monthly: ${lec.monthlyCount} types`}>M:{lec.monthlyCount}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Delivered Qty (with Full vs Monthly Hover Breakdown) */}
                                                <td className="py-2.5 px-1.5 text-center relative group">
                                                    <div className="inline-flex flex-col items-center justify-center cursor-help">
                                                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 group-hover:border-blue-500/50 transition-all">
                                                            {lec.displayDelivered.toLocaleString()} pcs
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[8.5px] font-mono font-bold mt-0.5 tracking-tight">
                                                            <span className="text-purple-400" title={`Full Delivered: ${lec.fullDelivered}`}>F: {lec.fullDelivered}</span>
                                                            <span className="text-gray-500/60">•</span>
                                                            <span className="text-blue-400" title={`Monthly Delivered: ${lec.monthlyDelivered}`}>M: {lec.monthlyDelivered}</span>
                                                        </div>
                                                    </div>

                                                    {/* Floating Hover Card for Delivery */}
                                                    <div className={`opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 absolute left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80 p-3 rounded-xl bg-gray-900/95 dark:bg-[#131b26]/95 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-left ${
                                                        idx < 2 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                                                    }`}>
                                                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 pb-1.5 mb-2 border-b border-white/10 flex items-center justify-between">
                                                            <span className="flex items-center gap-1 text-blue-400">
                                                                <Truck size={12} /> Delivery Breakdown
                                                            </span>
                                                            <span className="text-gray-300 font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Total: {lec.displayDelivered} pcs</span>
                                                        </div>
                                                        <div className="space-y-1.5 text-xs">
                                                            <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                                                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                                    Full Tutes Delivered:
                                                                </span>
                                                                <span className="font-mono font-black text-purple-200">
                                                                    {lec.fullDelivered.toLocaleString()} pcs
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                                <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                    Monthly Tutes Delivered:
                                                                </span>
                                                                <span className="font-mono font-black text-blue-200">
                                                                    {lec.monthlyDelivered.toLocaleString()} pcs
                                                                </span>
                                                            </div>
                                                            <div className="pt-1 flex justify-between items-center text-[11px] font-black text-gray-300 border-t border-white/10">
                                                                <span>Total Delivered:</span>
                                                                <span className="font-mono text-blue-400">{lec.displayDelivered.toLocaleString()} pcs</span>
                                                            </div>
                                                        </div>
                                                        <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                                                            idx < 2 ? 'bottom-full border-b-gray-900 dark:border-b-[#131b26]' : 'top-full border-t-gray-900 dark:border-t-[#131b26]'
                                                        }`}></div>
                                                    </div>
                                                </td>

                                                {/* Available Stock (with Full vs Monthly Hover Breakdown & Hazard Indicator) */}
                                                <td className="py-2.5 px-1.5 text-center relative group">
                                                    <div className="inline-flex flex-col items-center justify-center cursor-help">
                                                        <span className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-md border flex items-center justify-center gap-1 transition-all ${
                                                            lec.hasHazard
                                                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35 group-hover:border-rose-500/60 shadow-xs'
                                                                : lec.displayStock > 20
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/50'
                                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 group-hover:border-amber-500/50'
                                                        }`}>
                                                            {lec.hasHazard && <AlertTriangle size={11} className="text-rose-500 animate-pulse shrink-0" />}
                                                            {lec.displayStock.toLocaleString()} pcs
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[8.5px] font-mono font-bold mt-0.5 tracking-tight">
                                                            <span className="text-purple-400" title={`Full Stock: ${lec.fullStock}`}>F: {lec.fullStock}</span>
                                                            <span className="text-gray-500/60">•</span>
                                                            <span className="text-blue-400" title={`Monthly Stock: ${lec.monthlyStock}`}>M: {lec.monthlyStock}</span>
                                                        </div>
                                                    </div>

                                                    {/* Floating Hover Card for Available Stock */}
                                                    <div className={`opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 absolute left-1/2 -translate-x-1/2 z-50 w-72 sm:w-80 p-3 rounded-xl bg-gray-900/95 dark:bg-[#131b26]/95 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-left ${
                                                        idx < 2 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                                                    }`}>
                                                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 pb-1.5 mb-2 border-b border-white/10 flex items-center justify-between">
                                                            <span className="flex items-center gap-1 text-emerald-400">
                                                                <Package size={12} /> Stock Breakdown
                                                            </span>
                                                            <span className="text-gray-300 font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Total: {lec.displayStock} pcs</span>
                                                        </div>
                                                        <div className="space-y-1.5 text-xs">
                                                            {lec.hasHazard && (
                                                                <div className="flex justify-between items-center p-2 rounded-lg bg-rose-500/20 border border-rose-500/35 text-rose-300">
                                                                    <span className="text-[11px] font-bold flex items-center gap-1.5 text-rose-300">
                                                                        <AlertTriangle size={12} className="text-rose-400 shrink-0 animate-pulse" />
                                                                        Hazard Stock (&lt; 10 pcs):
                                                                    </span>
                                                                    <span className="font-mono font-black text-rose-200">
                                                                        {lec.hazardCount} type{lec.hazardCount === 1 ? '' : 's'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                                                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                                    Full Tutes Stock:
                                                                </span>
                                                                <span className="font-mono font-black text-purple-200">
                                                                    {lec.fullStock.toLocaleString()} pcs
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                                <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                    Monthly Tutes Stock:
                                                                </span>
                                                                <span className="font-mono font-black text-blue-200">
                                                                    {lec.monthlyStock.toLocaleString()} pcs
                                                                </span>
                                                            </div>
                                                            <div className="pt-1 flex justify-between items-center text-[11px] font-black text-gray-300 border-t border-white/10">
                                                                <span>Total Physical Stock:</span>
                                                                <span className="font-mono text-emerald-400">{lec.displayStock.toLocaleString()} pcs</span>
                                                            </div>
                                                        </div>
                                                        <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                                                            idx < 2 ? 'bottom-full border-b-gray-900 dark:border-b-[#131b26]' : 'top-full border-t-gray-900 dark:border-t-[#131b26]'
                                                        }`}></div>
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="py-2.5 px-2 text-right pr-3">
                                                    <button
                                                        onClick={(e) => {
                                                             e.stopPropagation();
                                                             toggleLecturerExpand(lec.name);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-white/10 transition-colors"
                                                    >
                                                        {isExpanded ? 'Hide' : 'View'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* EXPANDED NESTED TUTE DETAILS TABLE (Eye-comfort spacing, Both Stock & Delivered) */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50/70 dark:bg-black/40 border-y border-gray-200/80 dark:border-white/10">
                                                    <td colSpan={7} className="p-3 pl-6 pr-3">
                                                        <div className="bg-white/95 dark:bg-[#0f141c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-lg">
                                                            {/* Sub-table Header Bar */}
                                                            <div className="px-3.5 py-2 bg-gray-100/80 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 flex flex-wrap justify-between items-center gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Package size={14} className="text-brand-accent shrink-0" />
                                                                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-800 dark:text-slate-200 truncate">
                                                                        {lec.name} — Material Breakdown ({tutes.length} Types)
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                                                    {lec.hasHazard && (
                                                                        <span className="px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30 font-mono flex items-center gap-1 animate-pulse">
                                                                            <AlertTriangle size={12} /> {lec.hazardCount} Hazard Type{lec.hazardCount === 1 ? '' : 's'} (&lt; 10 pcs)
                                                                        </span>
                                                                    )}
                                                                    <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 font-mono">
                                                                        Delivered: {lec.displayDelivered.toLocaleString()} pcs
                                                                    </span>
                                                                    <span className={`px-2.5 py-1 rounded-md font-mono border ${
                                                                        lec.hasHazard
                                                                            ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/25'
                                                                            : lec.displayStock > 20
                                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                                    }`}>
                                                                        Available Stock: {lec.displayStock.toLocaleString()} pcs
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Nested Sub-table with Balanced Proportions */}
                                                            <table className="w-full text-left border-collapse table-fixed text-xs">
                                                                <colgroup>
                                                                    <col className="w-[28%]" />  {/* Material / Tute */}
                                                                    <col className="w-[22%]" />  {/* Subject / Course */}
                                                                    <col className="w-[18%]" />  {/* Business & Batch */}
                                                                    <col className="w-[10%]" />  {/* Payment */}
                                                                    <col className="w-[11%]" />  {/* Delivered */}
                                                                    <col className="w-[11%]" />  {/* Available Stock */}
                                                                </colgroup>
                                                                <thead>
                                                                    <tr className="border-b border-gray-200 dark:border-white/10 text-[9.5px] uppercase tracking-wider text-gray-500 dark:text-slate-400 bg-gray-50/70 dark:bg-white/[0.02]">
                                                                        <th className="py-2 px-3 font-black truncate">Material / Tute</th>
                                                                        <th className="py-2 px-2.5 font-black truncate">Subject / Course</th>
                                                                        <th className="py-2 px-2.5 font-black truncate">Business & Batch</th>
                                                                        <th className="py-2 px-2 font-black text-center">Payment</th>
                                                                        <th className="py-2 px-2 font-black text-center">Delivered</th>
                                                                        <th className="py-2 px-2 font-black text-center">Available Stock</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                    {tutes.map((tute, tIdx) => {
                                                                        const stockQty = tute.availableQuantity ?? 0;
                                                                        const deliveredQty = tute.totalDelivered ?? 0;
                                                                        const isHazard = stockQty < 10;
                                                                        const isDepleted = stockQty <= 0;
                                                                        const isLow = stockQty >= 10 && stockQty <= 20;

                                                                        return (
                                                                            <tr 
                                                                                key={tIdx} 
                                                                                className={`transition-colors ${
                                                                                    isHazard 
                                                                                        ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.07] border-l-2 border-l-rose-500 hover:bg-rose-500/[0.08]' 
                                                                                        : tIdx % 2 === 1 
                                                                                        ? 'bg-gray-50/40 dark:bg-white/[0.015] hover:bg-brand-accent/[0.04]' 
                                                                                        : 'bg-transparent hover:bg-brand-accent/[0.04]'
                                                                                }`}
                                                                            >
                                                                                {/* Material / Tute */}
                                                                                <td className="py-2 px-3 font-bold text-gray-900 dark:text-slate-100">
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        <Package size={13} className={isHazard ? "text-rose-400 shrink-0" : "text-gray-400 shrink-0"} />
                                                                                        <span className="truncate text-xs" title={tute.tuteName}>{tute.tuteName}</span>
                                                                                        {isHazard && (
                                                                                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[8.5px] font-black uppercase tracking-tight flex items-center gap-0.5 shrink-0 animate-pulse">
                                                                                                <AlertTriangle size={9} /> &lt; 10
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>

                                                                                {/* Subject / Course */}
                                                                                <td className="py-2 px-2.5 font-medium text-gray-700 dark:text-slate-300 text-xs truncate" title={tute.courseName}>
                                                                                    {tute.courseName}
                                                                                </td>

                                                                                {/* Business & Batch */}
                                                                                <td className="py-2 px-2.5">
                                                                                    <div className="text-gray-800 dark:text-slate-200 font-bold text-xs truncate" title={tute.businessName}>
                                                                                        {tute.businessName || 'General'}
                                                                                    </div>
                                                                                    {tute.batchName && tute.batchName !== 'N/A' && (
                                                                                        <div className="text-[10px] text-gray-400 font-medium truncate" title={tute.batchName}>
                                                                                            {tute.batchName}
                                                                                        </div>
                                                                                    )}
                                                                                </td>

                                                                                {/* Payment */}
                                                                                <td className="py-2 px-2 text-center">
                                                                                    <span className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                                                                        (tute.paymentType || '').toLowerCase() === 'monthly'
                                                                                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                                                            : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                                                                    }`}>
                                                                                        {tute.paymentType || 'General'}
                                                                                    </span>
                                                                                </td>

                                                                                {/* Delivered */}
                                                                                <td className="py-2 px-2 text-center">
                                                                                    <span className="inline-block font-mono font-bold text-xs text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                                                                                        {deliveredQty.toLocaleString()} pcs
                                                                                    </span>
                                                                                </td>

                                                                                {/* Available Stock */}
                                                                                <td className="py-2 px-2 text-center">
                                                                                    <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-0.5 rounded-md border ${
                                                                                        isHazard
                                                                                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-xs animate-pulse font-black'
                                                                                            : isLow
                                                                                            ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25'
                                                                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                                                                    }`}>
                                                                                        {isHazard && <AlertTriangle size={11} className="text-rose-500 shrink-0" />}
                                                                                        {stockQty.toLocaleString()} pcs
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* ================= VIEW 2: FLAT MASTER MATERIALS TABLE (Zero sideways scroll) ================= */
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.02]">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                Showing {allFilteredMaterials.length} Materials
                            </span>
                        </div>

                        <table className="w-full text-left border-collapse table-fixed">
                            <colgroup>
                                <col className="w-[20%]" />
                                <col className="w-[16%]" />
                                <col className="w-[18%]" />
                                <col className="w-[22%]" />
                                <col className="w-[8%]" />
                                <col className="w-[8%]" />
                                <col className="w-[8%]" />
                            </colgroup>
                            <thead className="bg-gray-100/90 dark:bg-black/60 backdrop-blur-md sticky top-0 border-b border-gray-200 dark:border-white/10 z-10">
                                <tr className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                    <th className="py-2.5 px-3 font-black truncate">Lecturer</th>
                                    <th className="py-2.5 px-2 font-black truncate">Business & Batch</th>
                                    <th className="py-2.5 px-2 font-black truncate">Subject / Course</th>
                                    <th className="py-2.5 px-2 font-black truncate">Material / Tute Name</th>
                                    <th className="py-2.5 px-2 font-black text-center">Payment</th>
                                    <th className="py-2.5 px-1.5 font-black text-center">Delivered</th>
                                    <th className="py-2.5 px-1.5 font-black text-center">Available Stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {allFilteredMaterials.map((row, idx) => {
                                    const stockQty = row.availableQuantity ?? 0;
                                    const isHazard = stockQty < 10;
                                    const isDepleted = stockQty <= 0;
                                    const isLow = stockQty >= 10 && stockQty <= 20;

                                    return (
                                        <tr key={idx} className={`transition-colors ${
                                            isHazard 
                                                ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.07] border-l-2 border-l-rose-500 hover:bg-rose-500/[0.08]' 
                                                : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.03]'
                                        }`}>
                                            {/* Lecturer */}
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <SmartLecturerAvatar image={row.lecturerImage} name={row.lecturerName} size="w-6 h-6" textSize="text-[9px]" />
                                                    <span className="font-black text-gray-900 dark:text-slate-200 text-xs truncate" title={row.lecturerName}>
                                                        {row.lecturerName}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Business & Batch */}
                                            <td className="py-2 px-2">
                                                <div className="font-bold text-gray-800 dark:text-slate-200 text-xs truncate" title={row.businessName}>
                                                    {row.businessName || 'General'}
                                                </div>
                                                <div className="text-[9px] text-gray-400 font-medium truncate">
                                                    {row.batchName || ''}
                                                </div>
                                            </td>

                                            {/* Course */}
                                            <td className="py-2 px-2 text-xs font-bold text-gray-700 dark:text-slate-300 truncate" title={row.courseName}>
                                                {row.courseName}
                                            </td>

                                            {/* Material Name */}
                                            <td className="py-2 px-2 text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
                                                <Package size={12} className={isHazard ? "text-rose-400 shrink-0" : "text-gray-400 shrink-0"} />
                                                <span className="truncate" title={row.tuteName}>{row.tuteName}</span>
                                                {isHazard && (
                                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[8px] font-black uppercase tracking-tight flex items-center gap-0.5 shrink-0 animate-pulse">
                                                        <AlertTriangle size={8} /> &lt; 10
                                                    </span>
                                                )}
                                            </td>

                                            {/* Payment */}
                                            <td className="py-2 px-2 text-center">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                                    (row.paymentType || '').toLowerCase() === 'monthly'
                                                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                        : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                                }`}>
                                                    {row.paymentType || 'General'}
                                                </span>
                                            </td>

                                            {/* Delivered Qty */}
                                            <td className="py-2 px-1.5 text-center">
                                                <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                                                    {(row.totalDelivered || 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Available Stock */}
                                            <td className="py-2 px-1.5 text-center">
                                                <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${
                                                    isHazard
                                                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-xs animate-pulse font-black'
                                                        : isLow
                                                        ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25'
                                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                                }`}>
                                                    {isHazard && <AlertTriangle size={11} className="text-rose-500 shrink-0" />}
                                                    {stockQty.toLocaleString()} pcs
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

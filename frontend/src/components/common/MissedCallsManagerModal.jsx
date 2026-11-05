import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../api/axios';
import { 
    FaPhoneSlash, 
    FaTimes, 
    FaSearch, 
    FaCheck, 
    FaUserCheck, 
    FaCalendarAlt, 
    FaBuilding, 
    FaUsers, 
    FaChartBar, 
    FaPhoneAlt, 
    FaWhatsapp, 
    FaFileExcel, 
    FaSync,
    FaArrowRight,
    FaShieldAlt,
    FaRegClock,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle
} from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import BusinessBadge from './BusinessBadge';
import CustomSelect from './CustomSelect';
import { useCall } from '../../contexts/CallContext';

export default function MissedCallsManagerModal({ isOpen, onClose, defaultBusinessId = 'ALL' }) {
    const { startOutboundCall } = useCall?.() || {};
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const [activeTab, setActiveTab] = useState('DISTRIBUTION'); // 'DISTRIBUTION' | 'ANALYTICS'
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selectedBusiness, setSelectedBusiness] = useState(defaultBusinessId || 'ALL');
    const [businesses, setBusinesses] = useState([]);
    const [staffList, setStaffList] = useState([]);
    
    // Distribution State
    const [tasks, setTasks] = useState([]);
    const [summary, setSummary] = useState({ total: 0, pendingDistribution: 0, assigned: 0, completed: 0, answered: 0, resolutionRate: 0 });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [bulkStaffId, setBulkStaffId] = useState('');
    const [isDistributing, setIsDistributing] = useState(false);

    // Analytics State
    const [analyticsStart, setAnalyticsStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [analyticsEnd, setAnalyticsEnd] = useState(todayStr);
    const [analyticsStaff, setAnalyticsStaff] = useState('ALL');
    const [analyticsData, setAnalyticsData] = useState({ summary: {}, staffBreakdown: [], tasks: [] });
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const getBusinessName = (bizIdOrName) => {
        if (!bizIdOrName || bizIdOrName === 'ALL') return 'ALL';
        const found = businesses.find(b => String(b.id) === String(bizIdOrName) || String(b.name).toLowerCase().trim() === String(bizIdOrName).toLowerCase().trim());
        return found ? found.name : String(bizIdOrName);
    };

    const isClassCoordinatorOrManager = (s) => {
        if (!s) return false;
        const roleUpper = String(s.role || '').toUpperCase().replace(/ /g, '_');
        const deptUpper = String(s.department || '').toUpperCase().trim();

        // Strictly exclude non-coordination departments & roles
        const excludedDepts = ['CALL CENTER', 'FINANCE', 'DELIVERY', 'PHYSICAL', 'SOCIAL MEDIA', 'ACADEMIC'];
        if (excludedDepts.includes(deptUpper)) return false;

        if (roleUpper.includes('CALL_CENTER') || roleUpper.includes('SOCIAL_MEDIA') || roleUpper.includes('DELIVERY') || roleUpper.includes('PAPER_GUIDER')) {
            return false;
        }

        const allowedRoles = ['COORDINATOR', 'MANAGER', 'ASS_MANAGER', 'ASSISTANT_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'CALLER', 'STAFF'];
        const isAllowedRole = allowedRoles.some(r => roleUpper.includes(r));
        const isCoordDept = deptUpper.includes('COORDINATION') || deptUpper === '';

        return isAllowedRole && (isCoordDept || roleUpper === 'SYSTEM_ADMIN' || roleUpper === 'DIRECTOR');
    };

    const matchesBusiness = (staff, bizIdOrName) => {
        if (!bizIdOrName || bizIdOrName === 'ALL') return true;
        if (!staff) return false;

        const roleUpper = String(staff.role || '').toUpperCase().replace(/ /g, '_');
        if (roleUpper === 'SYSTEM_ADMIN' || roleUpper === 'DIRECTOR') return true;

        const staffBiz = String(staff.businessType || '').toLowerCase().trim();
        if (!staffBiz || staffBiz === 'all') return true;

        const targetBizName = getBusinessName(bizIdOrName).toLowerCase().trim();
        const targetBizIdStr = String(bizIdOrName).toLowerCase().trim();

        return staffBiz.includes(targetBizName) || targetBizName.includes(staffBiz) || staffBiz.includes(targetBizIdStr);
    };

    const getStaffForBusiness = (bizIdOrName) => {
        if (!staffList || staffList.length === 0) return [];
        if (!bizIdOrName || bizIdOrName === 'ALL') return staffList;
        const matching = staffList.filter(s => matchesBusiness(s, bizIdOrName));
        const nonMatching = staffList.filter(s => !matchesBusiness(s, bizIdOrName));
        return [...matching, ...nonMatching];
    };

    const renderCampaignBadge = (source) => {
        const s = String(source || '').toUpperCase().trim();
        if (s === 'FREE_SEMINAR' || s.includes('FREE')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black tracking-wide uppercase shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Free Sem
                </span>
            );
        }
        if (s === 'AFTER_SEMINAR' || s.includes('AFTER')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-black tracking-wide uppercase shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> After Sem
                </span>
            );
        }
        if (s === 'OPEN_SEMINAR' || s.includes('OPEN') || s.includes('BOOST')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black tracking-wide uppercase shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Boost
                </span>
            );
        }
        if (s === 'NEW_INQ' || s.includes('INQ')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-black tracking-wide uppercase shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> New Inq
                </span>
            );
        }
        if (s === 'PAID') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-black tracking-wide uppercase shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Paid
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold">
                {source || 'CRM'}
            </span>
        );
    };

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            fetchDailyTasks(selectedBusiness, selectedDate);
        }
    }, [isOpen, selectedDate, selectedBusiness]);

    useEffect(() => {
        if (isOpen && activeTab === 'ANALYTICS') {
            fetchAnalyticsReport(selectedBusiness, analyticsStart, analyticsEnd, analyticsStaff);
        }
    }, [isOpen, activeTab, analyticsStart, analyticsEnd, selectedBusiness, analyticsStaff]);

    const fetchInitialData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [bizRes, staffRes] = await Promise.allSettled([
                axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/admin/staff', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (bizRes.status === 'fulfilled') {
                setBusinesses(Array.isArray(bizRes.value.data) ? bizRes.value.data : []);
            }
            if (staffRes.status === 'fulfilled') {
                // Strictly filter Class Coordinators and Managers for missed call distribution
                const list = Array.isArray(staffRes.value.data) ? staffRes.value.data : [];
                setStaffList(list.filter(isClassCoordinatorOrManager));
            }
        } catch (e) {
            console.error("Failed to load initial dropdowns", e);
        }
    };

    const fetchDailyTasks = async (targetBiz = selectedBusiness, targetDate = selectedDate) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/missed-call-tasks/daily', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    date: targetDate,
                    businessId: targetBiz !== 'ALL' ? targetBiz : undefined
                }
            });

            if (res.data?.success) {
                setTasks(res.data.tasks || []);
                setSummary(res.data.summary || {});
            }
        } catch (err) {
            console.error("Failed to fetch daily missed call tasks", err);
            toast.error("Failed to fetch daily missed calls");
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalyticsReport = async (targetBiz = selectedBusiness, start = analyticsStart, end = analyticsEnd, staff = analyticsStaff) => {
        setAnalyticsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/missed-call-tasks/analytics', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    startDate: start,
                    endDate: end,
                    businessId: targetBiz !== 'ALL' ? targetBiz : undefined,
                    staffId: staff !== 'ALL' ? staff : undefined
                }
            });

            if (res.data?.success) {
                setAnalyticsData(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch missed call analytics", err);
            toast.error("Failed to load analytics report");
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedTaskIds.length === filteredTasks.length) {
            setSelectedTaskIds([]);
        } else {
            setSelectedTaskIds(filteredTasks.map(t => t.id));
        }
    };

    const handleBulkDistribute = async () => {
        if (selectedTaskIds.length === 0) return toast.error("Please select at least one task to distribute");
        if (!bulkStaffId) return toast.error("Please select a Coordinator / Staff member to assign");

        setIsDistributing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/missed-call-tasks/distribute', {
                taskIds: selectedTaskIds,
                staffId: bulkStaffId
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success(res.data?.message || "Tasks distributed successfully!");
            setSelectedTaskIds([]);
            setBulkStaffId('');
            fetchDailyTasks();
        } catch (err) {
            console.error("Bulk distribute error", err);
            toast.error(err.response?.data?.error || "Failed to distribute tasks");
        } finally {
            setIsDistributing(false);
        }
    };

    const handleSingleAssign = async (taskId, staffId) => {
        if (!staffId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post('/missed-call-tasks/distribute', {
                taskIds: [taskId],
                staffId
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success("Task assigned successfully!");
            fetchDailyTasks();
        } catch (err) {
            toast.error("Failed to assign task");
        }
    };

    const handleExportExcel = () => {
        try {
            const exportRows = (activeTab === 'DISTRIBUTION' ? tasks : analyticsData.tasks || []).map(t => ({
                "Task ID": t.id,
                "Date": t.taskDate,
                "Call Time": new Date(t.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                "Phone": t.phone,
                "Student Name": t.studentName || 'Unknown',
                "Business": t.business?.name || 'N/A',
                "Campaign / Source": t.source || 'General',
                "Batch": t.batch?.name || 'Unallocated',
                "Current CRM Owner": t.existingAssigneeName || 'Unassigned',
                "Task Assigned To": t.taskAssignee ? `${t.taskAssignee.firstName} (${t.taskAssignee.role})` : 'Unassigned',
                "Status": t.status,
                "Call Outcome": t.callOutcome || 'Pending',
                "Attempts": t.callAttempts || 0,
                "Remarks": t.remarks || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Missed Calls Report");
            XLSX.writeFile(wb, `Missed_Calls_Report_${selectedDate}.xlsx`);
            toast.success("Excel report exported successfully!");
        } catch (e) {
            toast.error("Failed to export Excel report");
        }
    };

    if (!isOpen) return null;

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            // 1. Business Filter (Strict client & server matching)
            if (selectedBusiness !== 'ALL') {
                const matchesId = String(t.businessId) === String(selectedBusiness) || String(t.business?.id) === String(selectedBusiness);
                const matchesName = t.business?.name && getBusinessName(selectedBusiness).toLowerCase().trim() === String(t.business.name).toLowerCase().trim();
                if (!matchesId && !matchesName) return false;
            }

            // 2. Search query filter
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const pMatch = t.phone && t.phone.toLowerCase().includes(q);
            const nMatch = t.studentName && t.studentName.toLowerCase().includes(q);
            const aMatch = t.taskAssignee && t.taskAssignee.firstName.toLowerCase().includes(q);
            const oMatch = t.existingAssigneeName && t.existingAssigneeName.toLowerCase().includes(q);
            const sMatch = t.source && t.source.toLowerCase().includes(q);
            const bMatch = t.business && t.business.name && t.business.name.toLowerCase().includes(q);
            return pMatch || nMatch || aMatch || oMatch || sMatch || bMatch;
        });
    }, [tasks, selectedBusiness, searchQuery, businesses]);

    const displayedSummary = useMemo(() => {
        const total = filteredTasks.length;
        const pendingDistribution = filteredTasks.filter(t => t.status === 'PENDING_DISTRIBUTION').length;
        const assigned = filteredTasks.filter(t => t.status === 'ASSIGNED').length;
        const completed = filteredTasks.filter(t => t.status === 'COMPLETED').length;
        const answered = filteredTasks.filter(t => t.callOutcome === 'ANSWERED').length;
        const resolutionRate = total > 0 ? Math.round((answered / total) * 100) : 0;
        return { total, pendingDistribution, assigned, completed, answered, resolutionRate };
    }, [filteredTasks]);

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
            <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-red-950/40 via-[#1e293b] to-[#0f172a] border-b border-slate-800 flex flex-wrap justify-between items-center gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
                            <FaPhoneSlash size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white tracking-wide">
                                    Missed Calls Follow-Up & Task Distribution
                                </h2>
                                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider">
                                    Lumi WA Caller
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Automated smart missed call capture, coordinator assignment, and attempt tracking
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tab Switcher */}
                        <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex gap-1">
                            <button
                                onClick={() => setActiveTab('DISTRIBUTION')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'DISTRIBUTION' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                <FaUsers size={12}/> Daily Distribution
                            </button>
                            <button
                                onClick={() => setActiveTab('ANALYTICS')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'ANALYTICS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                <FaChartBar size={12}/> Analytics Report
                            </button>
                        </div>

                        <button 
                            onClick={handleExportExcel}
                            title="Export to Excel"
                            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            <FaFileExcel size={14}/> Export
                        </button>

                        <button 
                            onClick={() => activeTab === 'DISTRIBUTION' ? fetchDailyTasks(selectedBusiness, selectedDate) : fetchAnalyticsReport(selectedBusiness, analyticsStart, analyticsEnd, analyticsStaff)}
                            title="Refresh Data"
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        >
                            <FaSync size={14} className={loading || analyticsLoading ? 'animate-spin' : ''}/>
                        </button>

                        <button 
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                            <FaTimes size={16} />
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="px-6 py-3 bg-[#131d2e] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'DISTRIBUTION' ? (
                            <div className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 px-3 py-1.5 rounded-xl">
                                <FaCalendarAlt className="text-slate-400" size={12}/>
                                <span className="text-xs text-slate-400 font-bold uppercase">Date:</span>
                                <input 
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedDate(val);
                                        fetchDailyTasks(selectedBusiness, val);
                                    }}
                                    className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 px-3 py-1.5 rounded-xl">
                                    <span className="text-xs text-slate-400 font-bold">From:</span>
                                    <input 
                                        type="date" 
                                        value={analyticsStart} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setAnalyticsStart(val);
                                            fetchAnalyticsReport(selectedBusiness, val, analyticsEnd, analyticsStaff);
                                        }} 
                                        className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 px-3 py-1.5 rounded-xl">
                                    <span className="text-xs text-slate-400 font-bold">To:</span>
                                    <input 
                                        type="date" 
                                        value={analyticsEnd} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setAnalyticsEnd(val);
                                            fetchAnalyticsReport(selectedBusiness, analyticsStart, val, analyticsStaff);
                                        }} 
                                        className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 px-3 py-1.5 rounded-xl">
                            <FaBuilding className="text-slate-400" size={12}/>
                            <select 
                                value={selectedBusiness} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedBusiness(val);
                                    if (activeTab === 'DISTRIBUTION') {
                                        fetchDailyTasks(val, selectedDate);
                                    } else {
                                        fetchAnalyticsReport(val, analyticsStart, analyticsEnd, analyticsStaff);
                                    }
                                }}
                                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                            >
                                <option value="ALL" className="bg-[#0f172a]">All Businesses</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id} className="bg-[#0f172a]">{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {activeTab === 'ANALYTICS' && (
                            <div className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 px-3 py-1.5 rounded-xl">
                                <FaUsers className="text-slate-400" size={12}/>
                                <select 
                                    value={analyticsStaff} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAnalyticsStaff(val);
                                        fetchAnalyticsReport(selectedBusiness, analyticsStart, analyticsEnd, val);
                                    }}
                                    className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                                >
                                    <option value="ALL" className="bg-[#0f172a]">All Staff Members</option>
                                    {getStaffForBusiness(selectedBusiness).map(s => (
                                        <option key={s.id} value={s.id} className="bg-[#0f172a]">
                                            {s.firstName} {s.lastName ? s.lastName.charAt(0) + '.' : ''} ({s.role || 'Coordinator'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {activeTab === 'DISTRIBUTION' && (
                        <div className="relative min-w-[260px]">
                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search number, student, staff..."
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                            />
                        </div>
                    )}
                </div>

                {/* DISTRIBUTION TAB VIEW */}
                {activeTab === 'DISTRIBUTION' && (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Summary Metrics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[#0b121e] border-b border-slate-800 shrink-0">
                            <div className="p-3 bg-[#1e293b]/60 border border-slate-700/60 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Missed</p>
                                    <h4 className="text-xl font-black text-white">{displayedSummary.total || 0}</h4>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                                    <FaPhoneSlash size={14}/>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Unallocated</p>
                                    <h4 className="text-xl font-black text-amber-400">{displayedSummary.pendingDistribution || 0}</h4>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                    <FaExclamationTriangle size={14}/>
                                </div>
                            </div>

                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Assigned</p>
                                    <h4 className="text-xl font-black text-blue-400">{displayedSummary.assigned || 0}</h4>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <FaUserCheck size={14}/>
                                </div>
                            </div>

                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Answered</p>
                                    <h4 className="text-xl font-black text-emerald-400">{displayedSummary.answered || 0}</h4>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <FaCheckCircle size={14}/>
                                </div>
                            </div>

                            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Resolution %</p>
                                    <h4 className="text-xl font-black text-purple-400">{displayedSummary.resolutionRate || 0}%</h4>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                    <FaShieldAlt size={14}/>
                                </div>
                            </div>
                        </div>

                        {/* Bulk Action Controls */}
                        <div className="px-6 py-2.5 bg-[#121c2c] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-300">
                                    <input 
                                        type="checkbox" 
                                        checked={filteredTasks.length > 0 && selectedTaskIds.length === filteredTasks.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                                    />
                                    Select All ({selectedTaskIds.length} of {filteredTasks.length})
                                </label>

                                {selectedTaskIds.length > 0 && (
                                    <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-black border border-rose-500/30">
                                        {selectedTaskIds.length} Selected
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <select 
                                    value={bulkStaffId} 
                                    onChange={(e) => setBulkStaffId(e.target.value)}
                                    className="bg-[#0f172a] border border-slate-700 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-rose-500 max-w-[280px]"
                                >
                                    <option value="">Select Coordinator / Staff to Assign...</option>
                                    {getStaffForBusiness(selectedBusiness).map(s => {
                                        const matches = matchesBusiness(s, selectedBusiness);
                                        return (
                                            <option key={s.id} value={s.id}>
                                                {s.firstName} {s.lastName ? s.lastName.charAt(0) + '.' : ''} ({s.role || 'Coordinator'}{s.businessType ? ` - ${s.businessType}` : ''}{!matches && selectedBusiness !== 'ALL' ? ' [Other Biz]' : ''})
                                            </option>
                                        );
                                    })}
                                </select>

                                <button
                                    onClick={handleBulkDistribute}
                                    disabled={selectedTaskIds.length === 0 || !bulkStaffId || isDistributing}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider"
                                >
                                    {isDistributing ? <Loader2 size={12} className="animate-spin"/> : <FaArrowRight size={12}/>}
                                    Distribute Selected Tasks
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {loading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 className="animate-spin text-rose-500" size={32} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Detecting Smart Missed Calls...</span>
                                </div>
                            ) : filteredTasks.length === 0 ? (
                                <div className="py-20 text-center text-slate-500">
                                    <FaPhoneSlash size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                                    <h4 className="text-base font-bold text-slate-300 mb-1">No Unresolved Missed Calls Found</h4>
                                    <p className="text-xs max-w-sm mx-auto text-slate-500">
                                        All inbound missed calls on {selectedDate} have either been called back or no missed calls occurred.
                                    </p>
                                </div>
                            ) : (
                                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#131d2e]/60 shadow-xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-[#0b121e] text-slate-400 uppercase tracking-wider text-[10px] font-black border-b border-slate-800">
                                                <th className="p-3 w-10 text-center">#</th>
                                                <th className="p-3">Time</th>
                                                <th className="p-3">Caller & Student</th>
                                                <th className="p-3">Business & Campaign / Batch</th>
                                                <th className="p-3">Current CRM Lead Owner</th>
                                                <th className="p-3">Assigned Coordinator</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 text-center">Outcome</th>
                                                <th className="p-3 text-center">Attempts</th>
                                                <th className="p-3">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {filteredTasks.map((t, idx) => {
                                                const isSelected = selectedTaskIds.includes(t.id);
                                                return (
                                                    <tr 
                                                        key={t.id} 
                                                        className={`hover:bg-white/[0.03] transition-colors ${isSelected ? 'bg-rose-500/10' : ''}`}
                                                    >
                                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    if (isSelected) setSelectedTaskIds(selectedTaskIds.filter(id => id !== t.id));
                                                                    else setSelectedTaskIds([...selectedTaskIds, t.id]);
                                                                }}
                                                                className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-slate-300 font-bold whitespace-nowrap">
                                                            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                                                                <FaRegClock size={10}/>
                                                                {new Date(t.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-white text-sm tracking-wide">
                                                                    {t.phone}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 font-medium">
                                                                    {t.studentName || 'Unregistered Contact'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-black text-slate-200 text-xs">{t.business?.name || 'General'}</span>
                                                                    {renderCampaignBadge(t.source)}
                                                                </div>
                                                                {t.batch && (
                                                                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={t.batch.name}>
                                                                        📁 {t.batch.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            {t.existingAssigneeName ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                                                                    👤 {t.existingAssigneeName}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                                                                    ⚠️ Unassigned in CRM
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                                            <select
                                                                value={t.taskAssigneeId || ''}
                                                                onChange={(e) => handleSingleAssign(t.id, e.target.value)}
                                                                className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg p-1.5 outline-none focus:border-rose-500"
                                                            >
                                                                <option value="">Allocate Coordinator...</option>
                                                                {(() => {
                                                                    const taskBiz = t.business?.name || t.business?.id || t.businessId || selectedBusiness;
                                                                    const availableStaff = getStaffForBusiness(taskBiz);
                                                                    const list = [...availableStaff];
                                                                    if (t.taskAssignee && !list.some(s => s.id === t.taskAssignee.id)) {
                                                                        list.unshift(t.taskAssignee);
                                                                    }
                                                                    return list.map(s => (
                                                                        <option key={s.id} value={s.id}>
                                                                            {s.firstName} {s.lastName ? s.lastName.charAt(0) + '.' : ''} ({s.role || 'Coordinator'})
                                                                        </option>
                                                                    ));
                                                                })()}
                                                            </select>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {t.status === 'COMPLETED' ? (
                                                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-[10px] uppercase">
                                                                    COMPLETED
                                                                </span>
                                                            ) : t.status === 'ASSIGNED' ? (
                                                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-[10px] uppercase">
                                                                    ASSIGNED
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-[10px] uppercase">
                                                                    PENDING
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {t.callOutcome === 'ANSWERED' ? (
                                                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] uppercase">
                                                                    ANSWERED
                                                                </span>
                                                            ) : t.callOutcome === 'NO_ANSWER' ? (
                                                                <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 font-black text-[10px] uppercase">
                                                                    NO ANSWER
                                                                </span>
                                                            ) : t.callOutcome === 'REJECTED' ? (
                                                                <span className="px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 font-black text-[10px] uppercase">
                                                                    REJECTED
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 text-[11px]">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center font-black text-slate-300">
                                                            {t.callAttempts || 0}
                                                        </td>
                                                        <td className="p-3 text-slate-400 text-[11px] max-w-[200px] truncate" title={t.remarks || ''}>
                                                            {t.remarks || <span className="text-slate-600 italic">No remarks yet</span>}
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
                )}

                {/* ANALYTICS TAB VIEW */}
                {activeTab === 'ANALYTICS' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {analyticsLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="animate-spin text-indigo-500" size={32} />
                                <span className="text-xs font-bold uppercase tracking-wider">Generating Analytics Report...</span>
                            </div>
                        ) : (
                            <>
                                {/* Metrics Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="p-4 bg-[#1a2434] border border-slate-700/80 rounded-2xl">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Total Missed Period</p>
                                        <h3 className="text-2xl font-black text-white mt-1">{analyticsData.summary?.total || 0}</h3>
                                    </div>
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                                        <p className="text-xs text-emerald-400 font-bold uppercase">Answered / Resolved</p>
                                        <h3 className="text-2xl font-black text-emerald-300 mt-1">{analyticsData.summary?.answered || 0}</h3>
                                    </div>
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                                        <p className="text-xs text-amber-400 font-bold uppercase">No Answer / Pending</p>
                                        <h3 className="text-2xl font-black text-amber-300 mt-1">{analyticsData.summary?.noAnswer || 0}</h3>
                                    </div>
                                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
                                        <p className="text-xs text-purple-400 font-bold uppercase">Resolution Success %</p>
                                        <h3 className="text-2xl font-black text-purple-300 mt-1">{analyticsData.summary?.successRate || 0}%</h3>
                                    </div>
                                </div>

                                {/* Staff Breakdown Table */}
                                <div className="bg-[#131d2e] border border-slate-800 rounded-3xl p-5 shadow-xl">
                                    <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
                                        <FaUsers className="text-indigo-400"/> Staff Performance Breakdown
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-[#0b121e] text-slate-400 uppercase tracking-wider text-[10px] font-black border-b border-slate-800">
                                                    <th className="p-3">Staff Member</th>
                                                    <th className="p-3 text-center">Assigned Tasks</th>
                                                    <th className="p-3 text-center">Total Attempts</th>
                                                    <th className="p-3 text-center">Avg Attempts/Task</th>
                                                    <th className="p-3 text-center">Answered</th>
                                                    <th className="p-3 text-center">No Answer / Reject</th>
                                                    <th className="p-3 text-center">Success Rate %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/60">
                                                {(analyticsData.staffBreakdown || []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                                            No staff task records in this period
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    analyticsData.staffBreakdown.map((s) => (
                                                        <tr key={s.staffId} className="hover:bg-white/[0.02]">
                                                            <td className="p-3 font-bold text-white flex items-center gap-2">
                                                                👤 {s.name} <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{s.role}</span>
                                                            </td>
                                                            <td className="p-3 text-center font-black text-slate-200">{s.assignedTasks}</td>
                                                            <td className="p-3 text-center font-black text-slate-300">{s.totalAttempts}</td>
                                                            <td className="p-3 text-center text-slate-400 font-bold">{s.avgAttemptsPerTask}</td>
                                                            <td className="p-3 text-center font-black text-emerald-400">{s.answered}</td>
                                                            <td className="p-3 text-center font-black text-amber-400">{s.noAnswer + s.rejected}</td>
                                                            <td className="p-3 text-center">
                                                                <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-black border border-indigo-500/30">
                                                                    {s.successRate}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../api/axios';
import { FaUsers, FaUserTie, FaPhoneVolume, FaCheckCircle, FaExclamationCircle, FaChartBar, FaExclamationTriangle, FaCalendarAlt, FaChevronDown, FaChevronUp, FaFileExport, FaTimes, FaCheckSquare, FaRegSquare, FaLayerGroup, FaUserCheck, FaBullseye, FaCrown, FaTrophy, FaLock, FaLockOpen } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import BusinessBadge from '../../common/BusinessBadge';
import UnassignedBatchModal from './UnassignedBatchModal';
import MissingPaidStudentsModal from './MissingPaidStudentsModal';
import SetBatchGoalsModal from './SetBatchGoalsModal';

const getShiftData = (dateString) => {
    if (!dateString) return { dateStr: 'Unknown', label: 'Unknown Date', timestamp: 0 };

    const d = new Date(dateString);
    const shiftDate = new Date(d);

    if (d.getHours() < 8) {
        shiftDate.setDate(shiftDate.getDate() - 1);
    }

    shiftDate.setHours(0, 0, 0, 0);

    const now = new Date();
    const todayShift = new Date(now);
    if (now.getHours() < 8) todayShift.setDate(todayShift.getDate() - 1);
    todayShift.setHours(0, 0, 0, 0);

    const yesterdayShift = new Date(todayShift);
    yesterdayShift.setDate(yesterdayShift.getDate() - 1);

    if (shiftDate.getTime() === todayShift.getTime()) {
        return { label: 'Today', timestamp: shiftDate.getTime() };
    } else if (shiftDate.getTime() === yesterdayShift.getTime()) {
        return { label: 'Yesterday', timestamp: shiftDate.getTime() };
    } else {
        return { label: shiftDate.toLocaleDateString('en-CA'), timestamp: shiftDate.getTime() };
    }
};

const CoordinatorAvatar = ({ image, name, rankNum, initials }) => {
    const [imgFailed, setImgFailed] = React.useState(false);
    const validImage = image && typeof image === 'string' && image !== 'undefined' && image !== 'null' && image.trim().length > 5;

    if (validImage && !imgFailed) {
        return (
            <img
                src={image.startsWith('http') ? image : `${import.meta.env.VITE_API_URL || ''}${image}`}
                alt={name || 'Coordinator'}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-md flex-shrink-0"
                onError={() => setImgFailed(true)}
            />
        );
    }

    return (
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${rankNum === 1 ? 'from-amber-500 via-amber-600 to-yellow-400 border-2 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'from-indigo-600 to-purple-600 border border-white/20'} flex items-center justify-center font-black text-white text-sm shadow-md flex-shrink-0`}>
            {initials}
        </div>
    );
};

export default function OpenSeminarControls({ filters }) {
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [expandedRows, setExpandedRows] = useState({});

    // 🔥 Advanced Export & Tools Modal States 🔥
    const [showExportModal, setShowExportModal] = useState(false);
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);
    const [showMissingPaidModal, setShowMissingPaidModal] = useState(false);
    const [showGoalsModal, setShowGoalsModal] = useState(false);
    const [exportMode, setExportMode] = useState('ALL'); // ALL, SINGLE, MULTIPLE
    const [selectedSingleStaff, setSelectedSingleStaff] = useState('');
    const [selectedMultipleStaff, setSelectedMultipleStaff] = useState([]);

    // 🔒 Campaign Lock State (Manager / Super Admin) 🔒
    const [isCampaignLocked, setIsCampaignLocked] = useState(false);
    const [locking, setLocking] = useState(false);

    const currentUser = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('user')) || {}; } catch(e) { return {}; }
    }, []);
    const userRole = (currentUser.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const isManagerOrAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'HEAD_MANAGER', 'ASSISTANT_MANAGER', 'MANAGER'].includes(userRole);

    const [stats, setStats] = useState({
        totalOpenSem: 0, totalAssigned: 0, totalContacted: 0, totalPending: 0, totalDirectPaid: 0, totalDelayed: 0, totalEnrolled: 0,
        staffBreakdown: [],
        rawLeads: []
    });

    useEffect(() => {
        fetchOpenSemStats();
    }, [filters?.selectedBusiness, filters?.selectedBatch, startDate, endDate]);

    useEffect(() => {
        fetchCampaignLockStatus();
    }, [filters?.selectedBatch]);

    const fetchCampaignLockStatus = async () => {
        if (!filters?.selectedBatch || filters.selectedBatch === 'ALL') {
            setIsCampaignLocked(false);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/campaign-lock-status', {
                headers: { Authorization: `Bearer ${token}` },
                params: { batchId: filters.selectedBatch }
            });
            setIsCampaignLocked(Boolean(res.data?.isLocked));
        } catch (err) {
            console.error("Failed to fetch lock status", err);
        }
    };

    const handleToggleCampaignLock = async () => {
        if (!filters?.selectedBatch || filters.selectedBatch === 'ALL') {
            return toast.error("Please select a specific Batch from the top dropdown to Lock/Unlock Opening Seminar campaign.");
        }
        if (!isManagerOrAdmin) {
            return toast.error("Only Managers and Super Admins have permission to lock or unlock campaigns.");
        }

        const actionText = isCampaignLocked ? "UNLOCK" : "LOCK";
        const confirmMsg = isCampaignLocked
            ? "Are you sure you want to UNLOCK the Opening Seminar campaign for this batch? Staff will be able to assign leads again."
            : "Are you sure you want to LOCK the Opening Seminar campaign for this batch? When locked, no new leads can be assigned to this campaign from chat or CRM.";

        if (!window.confirm(confirmMsg)) return;

        setLocking(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/after-seminar-crm/campaign-toggle-lock', {
                batchId: filters.selectedBatch,
                isLocked: !isCampaignLocked
            }, { headers: { Authorization: `Bearer ${token}` } });

            setIsCampaignLocked(Boolean(res.data?.isLocked));
            toast.success(res.data?.message || `Campaign ${actionText}ED successfully!`, {
                icon: res.data?.isLocked ? '🔒' : '🔓',
                duration: 4000
            });
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to update campaign lock status");
        } finally {
            setLocking(false);
        }
    };

    const fetchOpenSemStats = async () => {
        if (!filters?.selectedBusiness) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/stats/open-seminar', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    businessId: filters.selectedBusiness,
                    batchId: filters.selectedBatch || 'ALL',
                    startDate: startDate || undefined,
                    endDate: endDate || undefined
                }
            });
            if (res.data) setStats(res.data);
        } catch (error) {
            toast.error("Failed to fetch Open Sem Stats");
            setStats({ totalOpenSem: 0, totalAssigned: 0, totalContacted: 0, totalPending: 0, totalDirectPaid: 0, totalDelayed: 0, totalEnrolled: 0, staffBreakdown: [], rawLeads: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleDailyClick = () => {
        const todayDate = new Date();
        const localDateStr = new Date(todayDate.getTime() - (todayDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        setStartDate(`${localDateStr}T08:00`);
        setEndDate(`${localDateStr}T20:00`);
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    const toggleRow = (staffName) => {
        setExpandedRows(prev => ({ ...prev, [staffName]: !prev[staffName] }));
    };

    const handleMultiSelectToggle = (staffName) => {
        if (selectedMultipleStaff.includes(staffName)) {
            setSelectedMultipleStaff(selectedMultipleStaff.filter(name => name !== staffName));
        } else {
            setSelectedMultipleStaff([...selectedMultipleStaff, staffName]);
        }
    };

    // 🔥 MAIN EXCEL EXPORT FUNCTION 🔥
    const generateExcel = (dataToExport, filename) => {
        if (!dataToExport || dataToExport.length === 0) {
            return toast.error("No leads found to export!");
        }

        const headers = ['Phone', 'Name', 'Assigned Coordinator', 'Round', 'Call Status', 'Enrollment Status', 'Payment Plan', 'Remark'];
        const rows = dataToExport.map(l => [
            l.phone,
            (l.name || 'Unknown').replace(/,/g, ' '),
            l.assignedToName || 'Unassigned',
            l.round,
            l.callStatus.replace('_', ' ').toUpperCase(),
            l.enrollmentStatus,
            l.paymentPlan,
            (l.remark || 'No Remark').replace(/,/g, ' ').replace(/\n/g, ' ')
        ]);

        const csvContent = headers.join(',') + "\n" + rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Exported ${dataToExport.length} leads successfully!`);
        setShowExportModal(false);
    };

    const handleExecuteExport = () => {
        if (!stats.rawLeads || stats.rawLeads.length === 0) {
            return toast.error("No data available to export.");
        }

        let dataToExport = [];
        let filename = "Open_Seminar_Export";

        if (exportMode === 'ALL') {
            dataToExport = stats.rawLeads;
            filename = "All_Open_Seminar_Leads";
        }
        else if (exportMode === 'SINGLE') {
            if (!selectedSingleStaff) return toast.error("Please select a Coordinator!");
            dataToExport = stats.rawLeads.filter(l => l.assignedToName === selectedSingleStaff);
            filename = `${selectedSingleStaff.replace(/ /g, '_')}_Leads`;
        }
        else if (exportMode === 'MULTIPLE') {
            if (selectedMultipleStaff.length === 0) return toast.error("Please select at least one Coordinator!");
            dataToExport = stats.rawLeads.filter(l => selectedMultipleStaff.includes(l.assignedToName));
            filename = `Multiple_Staff_Leads`;
        }

        generateExcel(dataToExport, filename);
    };

    const exportStaffRoundData = (staffName, roundName, leadsArray) => {
        generateExcel(leadsArray.map(l => ({
            ...l, assignedToName: staffName, round: roundName, callStatus: l.status, paymentPlan: 'N/A', enrollmentStatus: l.enrolled
        })), `${staffName}_${roundName}_Leads`);
    };

    if (!filters?.selectedBusiness) {
        return <div className="flex justify-center items-center h-[400px] text-slate-500 font-sans tracking-wide">Please select a Campaign/Business to view analytics.</div>;
    }

    if (loading && !stats.totalOpenSem) return <div className="flex justify-center items-center h-[400px] text-slate-500 animate-pulse font-sans tracking-wide">Loading Open Seminar Analytics...</div>;

    const conversionRate = stats.totalAssigned > 0 ? Math.round((stats.totalEnrolled / stats.totalAssigned) * 100) : 0;
    const chartData = stats.staffBreakdown.map(staff => ({ name: staff.name, contacted: staff.overall.contacted, delayed: staff.overall.delayed, enrolled: staff.overall.enrolled }));
    const allStaffNames = stats.staffBreakdown.map(s => s.name);

    // 🔥 Aggregate staff rounds to build the Campaign Overview 🔥
    const aggregatedRounds = {
        '1': { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
        '2': { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
        'NON_ENROLLED': { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 },
        'PAID': { assigned: 0, answered: 0, pending: 0 }
    };

    let totalFull = 0;
    let totalUpgrade = 0;
    let totalMonthly = 0;
    let totalInstallment = 0;

    if (stats.staffBreakdown) {
        stats.staffBreakdown.forEach(staff => {
            totalFull += (staff.overall?.full || 0);
            totalUpgrade += (staff.overall?.upgrade || 0);
            totalMonthly += (staff.overall?.monthly || 0);
            totalInstallment += (staff.overall?.installment || 0);

            ['1', '2', 'NON_ENROLLED', 'PAID'].forEach(round => {
                if (staff.rounds && staff.rounds[round]) {
                    aggregatedRounds[round].assigned += (staff.rounds[round].assigned || 0);
                    aggregatedRounds[round].answered += (staff.rounds[round].answered || 0);
                    aggregatedRounds[round].pending += (staff.rounds[round].pending || 0);
                    aggregatedRounds[round].noAnswer += (staff.rounds[round].noAnswer || 0);
                    aggregatedRounds[round].reject += (staff.rounds[round].reject || 0);
                    if (round === '1' || round === '2') {
                        aggregatedRounds[round].delayed += (staff.rounds[round].delayed || 0);
                    }
                }
            });
        });
    }

    return (
        <div className="flex flex-col gap-6 font-sans text-slate-200 animate-fade-in p-2 rounded-lg bg-transparent relative">
            
            {/* 🔥 DATE FILTERS ROW & MAIN EXPORT BUTTON 🔥 */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-black/40 backdrop-blur-3xl p-5 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-1/4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg"><FaCalendarAlt size={18} /></div>
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Campaign Stats</h3>
                        <p className="text-[10px] text-slate-400">Filter by specific dates or view today's performance</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleDailyClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all">Today (Daily)</button>
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-lg">
                        <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-semibold outline-none px-2 cursor-pointer" style={{ colorScheme: 'dark' }} />
                        <span className="text-slate-500 text-xs">to</span>
                        <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-semibold outline-none px-2 cursor-pointer" style={{ colorScheme: 'dark' }} />
                    </div>
                    {(startDate || endDate) && <button onClick={handleClearDates} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all">Clear</button>}

                    <div className="w-px h-6 bg-white/10 mx-2 hidden md:block"></div>

                    {/* TOOLS BUTTONS */}
                    <button onClick={() => setShowGoalsModal(true)} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-1.5 border border-purple-400/30">
                        <FaBullseye size={13} className="text-amber-300 animate-pulse" /> Target Goals (Conversion)
                    </button>
                    <button onClick={() => setShowUnassignedModal(true)} className="px-4 py-2 bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-1.5">
                        <FaLayerGroup size={12} /> Unassigned Batch Leads
                    </button>
                    <button onClick={() => setShowMissingPaidModal(true)} className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-1.5">
                        <FaUserCheck size={12} /> Missing Paid Web Students
                    </button>

                    {/* MASTER EXPORT BUTTON */}
                    <button onClick={() => setShowExportModal(true)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer">
                        <FaFileExport size={12} /> Advanced Export
                    </button>

                    {/* 🔒 CAMPAIGN LOCK / UNLOCK TOGGLE BUTTON (MANAGER / SUPER ADMIN) 🔒 */}
                    {isManagerOrAdmin && (
                        <button
                            type="button"
                            onClick={handleToggleCampaignLock}
                            disabled={locking || !filters?.selectedBatch || filters?.selectedBatch === 'ALL'}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-2 border cursor-pointer ${
                                !filters?.selectedBatch || filters?.selectedBatch === 'ALL'
                                    ? 'bg-slate-800/40 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60'
                                    : isCampaignLocked
                                    ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white border-red-400 shadow-rose-600/30'
                                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-600 hover:border-slate-400'
                            }`}
                            title={
                                !filters?.selectedBatch || filters?.selectedBatch === 'ALL'
                                    ? 'Select a specific batch from the top dropdown to Lock/Unlock Opening Seminar campaign'
                                    : isCampaignLocked
                                    ? 'Campaign is currently LOCKED for this batch. Click to Unlock.'
                                    : 'Campaign is Active for this batch. Click to Lock.'
                            }
                        >
                            {locking ? (
                                <span className="animate-pulse">Updating...</span>
                            ) : isCampaignLocked ? (
                                <>
                                    <FaLock size={12} className="text-white" />
                                    <span>Campaign Locked</span>
                                </>
                            ) : (
                                <>
                                    <FaLockOpen size={12} className="text-emerald-400" />
                                    <span>Lock Campaign</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* 🔒 LOCKED CAMPAIGN NOTICE BANNER 🔒 */}
            {isCampaignLocked && (
                <div className="bg-gradient-to-r from-red-950/70 via-rose-950/50 to-red-950/70 border border-red-500/40 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl shadow-red-950/30 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 shrink-0">
                            <FaLock size={18} />
                        </div>
                        <div>
                            <span className="text-xs font-black text-red-200 uppercase tracking-wider block">
                                🔒 Opening Seminar Campaign Locked for this Batch
                            </span>
                            <span className="text-[11px] text-red-300/70 leading-relaxed block mt-0.5">
                                New lead assignments and batch allocations are disabled in Chat and CRM for this batch.
                            </span>
                        </div>
                    </div>
                    {isManagerOrAdmin && (
                        <button
                            type="button"
                            onClick={handleToggleCampaignLock}
                            disabled={locking}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer whitespace-nowrap"
                        >
                            {locking ? 'Unlocking...' : 'Unlock Now'}
                        </button>
                    )}
                </div>
            )}

            {/* TOP SUMMARY SECTION */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                {/* Total Assigned Card (1 col) */}
                <div className="bg-indigo-500/5 backdrop-blur-2xl p-6 rounded-3xl border border-indigo-500/10 shadow-[0_8px_30px_rgba(79,70,229,0.1)] flex flex-col justify-center relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500">
                    <div className="absolute -left-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl shadow-inner"><FaUsers size={16} /></div>
                        <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Total Assigned</p>
                    </div>
                    <h2 className="text-3xl font-black text-white relative z-10 drop-shadow-md">{stats.totalAssigned}</h2>
                    <div className="mt-4 pt-4 border-t border-white/5 relative z-10">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><FaCheckCircle size={10} /> Overall Enrolled</p>
                        <h3 className="text-xl font-black text-emerald-400">{stats.totalEnrolled} <span className="text-xs text-emerald-500">({conversionRate}%)</span></h3>
                    </div>
                </div>

                {/* Campaign Rounds Cards (4 cols) */}
                <div className="xl:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {['1', '2', 'NON_ENROLLED', 'PAID'].map(round => {
                        const roundData = aggregatedRounds[round];
                        
                        let title = `ROUND 0${round}`;
                        let iconColor = 'text-indigo-400';
                        let bgGradient = 'from-indigo-500/10 to-transparent';
                        let borderColor = 'border-indigo-500/20';
                        let answerColor = 'text-indigo-300';
                        let answerBg = 'bg-indigo-500/10 border-indigo-500/20';

                        if (round === 'NON_ENROLLED') {
                            title = 'NON ENROLLED';
                            iconColor = 'text-slate-400';
                            bgGradient = 'from-slate-600/10 to-transparent';
                            borderColor = 'border-slate-500/20';
                            answerColor = 'text-slate-300';
                            answerBg = 'bg-slate-500/10 border-slate-500/20';
                        } else if (round === 'PAID') {
                            title = 'ENROLLED (PAID)';
                            iconColor = 'text-emerald-400';
                            bgGradient = 'from-emerald-500/10 to-transparent';
                            borderColor = 'border-emerald-500/20';
                            answerColor = 'text-emerald-300';
                            answerBg = 'bg-emerald-500/10 border-emerald-500/20';
                        } else if (round === '2') {
                            iconColor = 'text-blue-400';
                            bgGradient = 'from-blue-500/10 to-transparent';
                            borderColor = 'border-blue-500/20';
                            answerColor = 'text-blue-300';
                            answerBg = 'bg-blue-500/10 border-blue-500/20';
                        }

                        return (
                            <div key={round} className={`bg-gradient-to-br ${bgGradient} border ${borderColor} rounded-[2rem] p-5 flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group relative overflow-hidden bg-black/20 backdrop-blur-md`}>
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-bl-full pointer-events-none ${iconColor}`}></div>
                                
                                <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4 relative z-10">
                                    <span className={`text-xs font-black uppercase tracking-widest ${iconColor} drop-shadow-sm flex items-center gap-2`}>
                                        {title}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3 relative z-10">
                                    {round === 'PAID' ? (
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Full</span>
                                                <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{totalFull}</span>
                                            </div>
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Upgrade</span>
                                                <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{totalUpgrade}</span>
                                            </div>
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Monthly</span>
                                                <span className="text-xl font-black text-emerald-400">{totalMonthly}</span>
                                            </div>
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Installment</span>
                                                <span className="text-xl font-black text-emerald-400">{totalInstallment}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-center items-center">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Assigned</span>
                                                    <span className="text-xl font-black text-slate-200">{roundData.assigned}</span>
                                                </div>
                                                <div className={`${answerBg} border p-3 rounded-xl flex flex-col justify-center items-center relative overflow-hidden`}>
                                                    <span className={`text-[10px] ${iconColor} opacity-80 font-bold uppercase tracking-wider mb-1`}>Answered</span>
                                                    <span className={`text-xl font-black ${answerColor}`}>{roundData.answered}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                    <span className="text-[9px] text-amber-500/70 font-bold uppercase tracking-wider mb-1">Pending</span>
                                                    <span className="text-sm font-bold text-amber-400">{roundData.pending}</span>
                                                </div>
                                                <div className="bg-slate-500/10 border border-slate-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">No Ans</span>
                                                    <span className="text-sm font-bold text-slate-300">{roundData.noAnswer}</span>
                                                </div>
                                                <div className="bg-red-500/5 border border-red-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                    <span className="text-[9px] text-red-400/70 font-bold uppercase tracking-wider mb-1">Reject</span>
                                                    <span className="text-sm font-bold text-red-400">{roundData.reject}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Extras: Delayed (Only for R1 & R2) */}
                                            {(round === '1' || round === '2') && (
                                                <div className="flex justify-between items-center text-xs mt-2 px-1">
                                                    {roundData.delayed > 0 ? (
                                                        <>
                                                            <span className="text-rose-400/80 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5"><FaExclamationTriangle size={10}/> Delayed KPI</span>
                                                            <span className="text-rose-400 font-black bg-rose-500/10 px-2.5 py-0.5 rounded text-xs border border-rose-500/20">{roundData.delayed}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">No Delays</span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* DETAILS SECTION */}
            <div className="w-full mt-6">
                {/* ADVANCED STAFF BREAKDOWN TABLE */}
                <div className="bg-black/40 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg shadow-inner border border-indigo-500/20"><FaUserTie className="text-indigo-400"/></div>
                            Coordinator Advanced Performance
                        </h3>
                    </div>

                    <div className="flex-1">
                        {stats.staffBreakdown.length === 0 ? <div className="text-center py-10 text-slate-500 text-sm">No coordinator data available.</div> : (
                            <div className="flex flex-col gap-5">
                                {(() => {
                                    // Sort Coordinators for Leaderboard ranking
                                    const sortedStaff = [...stats.staffBreakdown].sort((a, b) => {
                                        const rateA = a.overall.assigned > 0 ? (a.overall.enrolled / a.overall.assigned) : 0;
                                        const rateB = b.overall.assigned > 0 ? (b.overall.enrolled / b.overall.assigned) : 0;
                                        if (rateB !== rateA) return rateB - rateA;
                                        return b.overall.enrolled - a.overall.enrolled;
                                    });

                                    const targetIndGoal = stats.batchGoals?.targetIndividualGoal ?? 40;
                                    const targetGrpGoal = stats.batchGoals?.targetGroupGoal ?? 50;

                                    return sortedStaff.map((staff, idx) => {
                                        const isExpanded = expandedRows[staff.name];
                                        const isHighDelay = staff.overall.delayed > 10;

                                        // Required enrollments for Single Goal (Students cannot be fractional, so floor represents target achievement)
                                        const reqSingleCount = Math.floor((targetIndGoal / 100) * staff.overall.assigned);
                                        const neededSingle = Math.max(0, reqSingleCount - staff.overall.enrolled);
                                        const singleProgressPct = neededSingle === 0 ? 100 : Math.min(100, Math.round((staff.overall.enrolled / (reqSingleCount || 1)) * 100));

                                        // Conversion rate: If coordinator reached the floored student target count, align displayed rate with targetIndGoal
                                        let rawRate = staff.overall.assigned > 0 ? (staff.overall.enrolled / staff.overall.assigned) * 100 : 0;
                                        let rate = Math.round(rawRate);
                                        if (neededSingle === 0 && staff.overall.enrolled > 0 && targetIndGoal > rate) {
                                            rate = targetIndGoal;
                                        }

                                        // Rank badges
                                        const rankNum = idx + 1;
                                        let rankBadge = null;
                                        if (rankNum === 1) {
                                            rankBadge = (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                                    <FaCrown className="text-amber-400 animate-bounce" size={10} /> #1 Top Performer
                                                </span>
                                            );
                                        } else if (rankNum === 2) {
                                            rankBadge = <span className="text-[10px] font-black text-slate-300 bg-slate-400/20 px-2 py-0.5 rounded-full border border-slate-400/30">#2 Leader</span>;
                                        } else if (rankNum === 3) {
                                            rankBadge = <span className="text-[10px] font-black text-amber-500 bg-amber-700/20 px-2 py-0.5 rounded-full border border-amber-600/30">#3 Contributor</span>;
                                        }

                                        // Bulletproof Initials for avatar fallback
                                        const cleanStaffName = (staff.name || 'Coordinator').trim().replace(/\s+/g, ' ');
                                        const nameParts = cleanStaffName.split(' ').filter(Boolean);
                                        let initials = 'CO';
                                        if (nameParts.length >= 2 && nameParts[0][0] && nameParts[1][0]) {
                                            initials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
                                        } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
                                            initials = nameParts[0].substring(0, 2).toUpperCase();
                                        }

                                        return (
                                            <div key={idx} className={`bg-gradient-to-r from-[#0F172A] via-[#1E293B]/70 to-[#0F172A] rounded-3xl border transition-all duration-500 overflow-hidden shadow-xl ${isExpanded ? 'border-indigo-500/40 shadow-[0_8px_32px_rgba(99,102,241,0.2)]' : rankNum === 1 ? 'border-amber-400/40 shadow-amber-500/10' : 'border-white/10 hover:border-white/25'}`}>
                                                
                                                {/* Header Row / Main Overview */}
                                                <div onClick={() => toggleRow(staff.name)} className={`p-5 cursor-pointer flex flex-col xl:flex-row items-center justify-between gap-6 transition-colors ${isExpanded ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                                                    
                                                    {/* Coordinator Avatar, Name & Rank */}
                                                    <div className="flex items-center gap-4 w-full xl:w-1/3">
                                                        <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${isExpanded ? 'bg-indigo-500/20 text-indigo-400 rotate-180' : 'bg-white/5 text-slate-400'}`}>
                                                            <FaChevronDown size={14} />
                                                        </div>

                                                        {/* Clean Avatar Component (No undefined bugs) */}
                                                        <CoordinatorAvatar image={staff.image} name={staff.name} rankNum={rankNum} initials={initials} />

                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-black text-base text-white tracking-wide truncate">{staff.name}</span>
                                                                {rankBadge}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                <BusinessBadge businessType={staff.businessType} role={staff.role} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Main Stats Grid */}
                                                    <div className="grid grid-cols-4 md:grid-cols-7 gap-3 w-full xl:w-3/4 flex-1 items-center">
                                                        {(() => {
                                                            const displayOverallPending = staff.rounds && staff.rounds['1'] ? staff.rounds['1'].pending : 0;
                                                            const displayOverallAnswered = Math.max(0, staff.overall.assigned - displayOverallPending - staff.overall.noAnswer - staff.overall.reject);
                                                            return (
                                                                <>
                                                                    <div className="flex flex-col items-center bg-black/20 p-2 rounded-xl border border-white/5">
                                                                        <span className="text-[9px] uppercase font-black text-slate-400 mb-0.5 tracking-wider">Assigned</span>
                                                                        <span className="text-lg font-black text-slate-200">{staff.overall.assigned}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                                                                        <span className="text-[9px] uppercase font-black text-indigo-300 mb-0.5 tracking-wider">Answered</span>
                                                                        <span className="text-xl font-black text-indigo-300 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">{displayOverallAnswered}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-black/20 p-2 rounded-xl border border-white/5">
                                                                        <span className="text-[9px] uppercase font-black text-slate-400 mb-0.5 tracking-wider">No Ans</span>
                                                                        <span className="text-base font-black text-slate-300">{staff.overall.noAnswer}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                                                                        <span className="text-[9px] uppercase font-black text-amber-400 mb-0.5 tracking-wider">Pending</span>
                                                                        <span className="text-base font-black text-amber-300">{displayOverallPending}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-red-500/10 p-2 rounded-xl border border-red-500/20">
                                                                        <span className="text-[9px] uppercase font-black text-red-400 mb-0.5 tracking-wider">Reject</span>
                                                                        <span className="text-base font-black text-red-400">{staff.overall.reject}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                                                                        <span className="text-[9px] uppercase font-black text-rose-400 mb-0.5 tracking-wider">Delayed</span>
                                                                        <span className={`text-base font-black ${isHighDelay ? 'text-rose-300 animate-pulse' : 'text-rose-400'}`}>{staff.overall.delayed}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                                                                        <span className="text-[9px] uppercase font-black text-emerald-400 mb-0.5 tracking-wider">Conversion</span>
                                                                        <span className="text-base font-black text-emerald-300">{rate}%</span>
                                                                    </div>

                                                                    {/* Dedicated Single Goal Progress Pill */}
                                                                    <div className="col-span-4 md:col-span-7 xl:col-span-2 flex flex-col justify-center bg-indigo-950/40 p-2.5 rounded-2xl border border-indigo-500/30">
                                                                        <div className="flex justify-between items-center text-[10px] font-black mb-1">
                                                                            <span className="text-cyan-300 flex items-center gap-1">
                                                                                <FaBullseye size={11} className="text-cyan-400" /> Single Goal ({targetIndGoal}%)
                                                                            </span>
                                                                            {neededSingle > 0 ? (
                                                                                <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-400/30">Need {neededSingle} more</span>
                                                                            ) : (
                                                                                <span className="text-emerald-300 font-black bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-400/30">🎯 Achieved!</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="w-full h-2.5 bg-black/60 rounded-full p-0.5 border border-white/10 relative overflow-hidden">
                                                                            <div 
                                                                                className={`h-full rounded-full ${neededSingle === 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-300' : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400'} transition-all duration-700`}
                                                                                style={{ width: `${singleProgressPct}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                            {/* Expanded Section */}
                                            {isExpanded && (
                                                <div className="border-t border-indigo-500/20 bg-black/60 p-6 md:p-8 relative">
                                                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                                                    
                                                    {/* Payment Breakdown Strip & Historical Delays */}
                                                    <div className="flex flex-col gap-4 mb-8 relative z-10">
                                                        
                                                        {/* Historical Delays */}
                                                        {(staff.overall.r1HistoricalDelays > 0 || staff.overall.r2HistoricalDelays > 0) && (
                                                            <div className="flex justify-center">
                                                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl px-5 py-2.5 flex items-center gap-6 shadow-inner">
                                                                    <span className="text-[10px] uppercase font-black tracking-widest text-rose-500 flex items-center gap-2"><FaExclamationTriangle size={10} /> Historical Delays</span>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[9px] font-bold text-rose-400/70">ROUND 1</span>
                                                                            <span className="text-sm font-black text-rose-400">{staff.overall.r1HistoricalDelays || 0}</span>
                                                                        </div>
                                                                        <div className="w-px h-4 bg-rose-500/20"></div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[9px] font-bold text-rose-400/70">ROUND 2</span>
                                                                            <span className="text-sm font-black text-rose-400">{staff.overall.r2HistoricalDelays || 0}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Payment Plans */}
                                                        {staff.overall.enrolled > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-4">
                                                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-6 py-3 flex gap-4 items-center shadow-inner">
                                                                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/70">Full</span>
                                                                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{staff.overall.full}</span>
                                                                </div>
                                                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-6 py-3 flex gap-4 items-center shadow-inner">
                                                                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/70">Upgrade</span>
                                                                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{staff.overall.upgrade}</span>
                                                                </div>
                                                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-6 py-3 flex gap-4 items-center shadow-inner">
                                                                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/70">Monthly Plan</span>
                                                                    <span className="text-xl font-black text-emerald-400">{staff.overall.monthly}</span>
                                                                </div>
                                                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-6 py-3 flex gap-4 items-center shadow-inner">
                                                                    <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/70">Installments</span>
                                                                    <span className="text-xl font-black text-emerald-400">{staff.overall.installment}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* The 4 Round Cards */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
                                                        {['1', '2', 'NON_ENROLLED', 'PAID'].map(round => {
                                                            const roundData = staff.rounds && staff.rounds[round] ? staff.rounds[round] : { assigned: 0, contacted: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0, delayed: 0, leads: [] };
                                                            
                                                            let title = `ROUND 0${round}`;
                                                            let iconColor = 'text-indigo-400';
                                                            let bgGradient = 'from-indigo-500/10 to-transparent';
                                                            let borderColor = 'border-indigo-500/20';
                                                            let answerColor = 'text-indigo-300';
                                                            let answerBg = 'bg-indigo-500/10 border-indigo-500/20';

                                                            let displayAssigned = roundData.totalAssigned !== undefined ? roundData.totalAssigned : roundData.assigned;
                                                            let displayAnswered = round === 'PAID' ? roundData.answered : Math.max(0, displayAssigned - roundData.pending - roundData.noAnswer - roundData.reject);

                                                            if (round === '1') {
                                                                displayAssigned = staff.overall.assigned;
                                                                displayAnswered = Math.max(0, displayAssigned - roundData.pending - roundData.noAnswer - roundData.reject);
                                                            }

                                                            if (round === 'NON_ENROLLED') {
                                                                title = 'NON ENROLLED';
                                                                iconColor = 'text-slate-400';
                                                                bgGradient = 'from-slate-600/10 to-transparent';
                                                                borderColor = 'border-slate-500/20';
                                                                answerColor = 'text-slate-300';
                                                                answerBg = 'bg-slate-500/10 border-slate-500/20';
                                                            } else if (round === 'PAID') {
                                                                title = 'ENROLLED (PAID)';
                                                                iconColor = 'text-emerald-400';
                                                                bgGradient = 'from-emerald-500/10 to-transparent';
                                                                borderColor = 'border-emerald-500/20';
                                                                answerColor = 'text-emerald-300';
                                                                answerBg = 'bg-emerald-500/10 border-emerald-500/20';
                                                            } else if (round === '2') {
                                                                iconColor = 'text-blue-400';
                                                                bgGradient = 'from-blue-500/10 to-transparent';
                                                                borderColor = 'border-blue-500/20';
                                                                answerColor = 'text-blue-300';
                                                                answerBg = 'bg-blue-500/10 border-blue-500/20';
                                                            }

                                                            return (
                                                                <div key={round} className={`bg-gradient-to-br ${bgGradient} border ${borderColor} rounded-2xl p-4 flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group relative overflow-hidden`}>
                                                                    <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.03] rounded-bl-full pointer-events-none ${iconColor}`}></div>
                                                                    
                                                                    <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 relative z-10">
                                                                        <span className={`text-[11px] font-black uppercase tracking-widest ${iconColor} drop-shadow-sm flex items-center gap-2`}>
                                                                            {title}
                                                                        </span>
                                                                        <button onClick={(e) => { e.stopPropagation(); exportStaffRoundData(staff.name, round, roundData.leads); }} className="bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white p-1.5 rounded-md transition-all shadow-sm" title={`Export ${title} Leads`}>
                                                                            <FaFileExport size={10} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="flex flex-col gap-2 relative z-10">
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div className="bg-black/20 border border-white/5 p-2 rounded-xl flex flex-col justify-center items-center">
                                                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Assigned</span>
                                                                                <span className="text-sm font-black text-slate-200">{displayAssigned}</span>
                                                                            </div>
                                                                            <div className={`${answerBg} border p-2 rounded-xl flex flex-col justify-center items-center relative overflow-hidden`}>
                                                                                <span className={`text-[9px] ${iconColor} opacity-80 font-bold uppercase tracking-wider mb-0.5`}>Answered</span>
                                                                                <span className={`text-sm font-black ${answerColor}`}>{displayAnswered}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded-xl flex flex-col justify-center items-center">
                                                                                <span className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider mb-0.5">Pending</span>
                                                                                <span className="text-xs font-bold text-amber-400">{roundData.pending}</span>
                                                                            </div>
                                                                            <div className="bg-slate-500/10 border border-slate-500/10 p-2 rounded-xl flex flex-col justify-center items-center">
                                                                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">No Ans</span>
                                                                                <span className="text-xs font-bold text-slate-300">{roundData.noAnswer}</span>
                                                                            </div>
                                                                            <div className="bg-red-500/5 border border-red-500/10 p-2 rounded-xl flex flex-col justify-center items-center">
                                                                                <span className="text-[8px] text-red-400/70 font-bold uppercase tracking-wider mb-0.5">Reject</span>
                                                                                <span className="text-xs font-bold text-red-400">{roundData.reject}</span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Extras: Delayed (Only for R1 & R2) */}
                                                                        {(round === '1' || round === '2') && (
                                                                            <div className="flex justify-between items-center text-xs mt-2 px-1">
                                                                                {roundData.delayed > 0 ? (
                                                                                    <>
                                                                                        <span className="text-rose-400/80 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1"><FaExclamationTriangle size={8}/> Delayed KPI</span>
                                                                                        <span className="text-rose-400 font-black bg-rose-500/10 px-2 py-0.5 rounded text-[10px] border border-rose-500/20">{roundData.delayed}</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">No Delays</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* Mini Progress Bar */}
                                                                    <div className="w-full bg-black/40 rounded-full h-1 mt-4 overflow-hidden relative z-10">
                                                                        <div className={`h-1 rounded-full ${displayAssigned > 0 ? (displayAnswered === displayAssigned ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]') : 'bg-transparent'}`} style={{ width: `${displayAssigned > 0 ? (displayAnswered / displayAssigned) * 100 : 0}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* 🔥 ADVANCED EXPORT MODAL 🔥 */}
            {showExportModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#0b111a] border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2"><FaFileExport className="text-emerald-500" /> Advanced Export Leads</h2>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Export Open Seminar Data to Excel (CSV)</p>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="text-slate-500 hover:text-white bg-black/40 p-2 rounded-lg transition-colors border border-transparent hover:border-white/10"><FaTimes size={14} /></button>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex flex-col gap-5">
                            {/* Mode Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Export Scope</label>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setExportMode('ALL')} className={`p-3 rounded-xl border text-left transition-all ${exportMode === 'ALL' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-inner' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                        <h4 className="font-bold text-sm text-white mb-0.5">All Data (Overall)</h4>
                                        <p className="text-xs opacity-70">Export all Open Seminar leads across all staff members.</p>
                                    </button>
                                    <button onClick={() => setExportMode('SINGLE')} className={`p-3 rounded-xl border text-left transition-all ${exportMode === 'SINGLE' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-inner' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                        <h4 className="font-bold text-sm text-white mb-0.5">Single Coordinator</h4>
                                        <p className="text-xs opacity-70">Select one specific coordinator and export their leads.</p>
                                    </button>
                                    <button onClick={() => setExportMode('MULTIPLE')} className={`p-3 rounded-xl border text-left transition-all ${exportMode === 'MULTIPLE' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-inner' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                        <h4 className="font-bold text-sm text-white mb-0.5">Multiple Coordinators</h4>
                                        <p className="text-xs opacity-70">Select multiple staff members to export their combined leads.</p>
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Options based on selection */}
                            <div className="min-h-[120px]">
                                {exportMode === 'ALL' && (
                                    <div className="flex h-full items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <p className="text-sm font-bold text-emerald-400 text-center">Ready to export {stats.rawLeads?.length || 0} total leads.</p>
                                    </div>
                                )}

                                {exportMode === 'SINGLE' && (
                                    <div className="flex flex-col gap-2 animate-fade-in">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Coordinator</label>
                                        <select value={selectedSingleStaff} onChange={(e) => setSelectedSingleStaff(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-semibold text-white outline-none focus:border-indigo-500 cursor-pointer">
                                            <option value="">-- Choose Staff --</option>
                                            {allStaffNames.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {exportMode === 'MULTIPLE' && (
                                    <div className="flex flex-col gap-2 animate-fade-in">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Coordinators (Tick)</label>
                                        <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-2 p-2 bg-black/20 border border-white/5 rounded-xl">
                                            {allStaffNames.map(name => {
                                                const isSelected = selectedMultipleStaff.includes(name);
                                                return (
                                                    <div key={name} onClick={() => handleMultiSelectToggle(name)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-600/20 border-indigo-500/30' : 'hover:bg-white/5 border-transparent'}`}>
                                                        {isSelected ? <FaCheckSquare className="text-indigo-400" size={16} /> : <FaRegSquare className="text-slate-600" size={16} />}
                                                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{name}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <p className="text-xs text-indigo-400 font-bold mt-1 text-right">{selectedMultipleStaff.length} selected</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex gap-3">
                            <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-white/10">Cancel</button>
                            <button onClick={handleExecuteExport} className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2">
                                <FaFileExport size={14} /> Generate Excel
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Modals */}
            <UnassignedBatchModal
                isOpen={showUnassignedModal}
                onClose={() => setShowUnassignedModal(false)}
                businessId={filters?.selectedBusiness}
                onBatchAssigned={fetchOpenSemStats}
            />

            <MissingPaidStudentsModal
                isOpen={showMissingPaidModal}
                onClose={() => setShowMissingPaidModal(false)}
                businessId={filters?.selectedBusiness}
                batchId={filters?.selectedBatch || 'ALL'}
                onStudentPushed={fetchOpenSemStats}
            />

            <SetBatchGoalsModal
                isOpen={showGoalsModal}
                onClose={() => setShowGoalsModal(false)}
                filters={filters}
                batchGoals={stats?.batchGoals}
                onGoalsUpdated={fetchOpenSemStats}
            />

        </div>
    );
}
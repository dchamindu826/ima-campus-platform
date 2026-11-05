import React, { useState, useEffect, useMemo } from 'react';
import axios from "../../../api/axios";
import { FaUserTie, FaCalendarAlt, FaFileExport, FaCheckSquare, FaRegSquare, FaFilter, FaArrowDown, FaArrowUp } from 'react-icons/fa';
import toast from 'react-hot-toast';
import BusinessBadge from '../../common/BusinessBadge';

export default function PaidCampaignPerformance({ filters }) {
    const [loading, setLoading] = useState(true);
    const [rawLeads, setRawLeads] = useState([]);
    
    // UI Filters
    const [targetMonthName, setTargetMonthName] = useState('');
    const [monthlyGroups, setMonthlyGroups] = useState([]);
    const [overallEnrolledStats, setOverallEnrolledStats] = useState({ inCrmCount: 0, notInCrmCount: 0, notInCrmStudents: [] });
    const [searchQuery, setSearchQuery] = useState('');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Global Filters for the Table
    const [activePhaseFilter, setActivePhaseFilter] = useState('ALL');

    useEffect(() => {
        fetchRetentionData();
    }, [filters?.selectedBusiness, filters?.selectedBatch, targetMonthName, startDate, endDate]);

    const fetchRetentionData = async () => {
        if (!filters?.selectedBusiness) {
            setLoading(false);
            setRawLeads([]);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/retention/campaign-data', {
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    businessId: filters.selectedBusiness, 
                    batchId: filters.selectedBatch || 'ALL',
                    targetMonthName: targetMonthName,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined
                }
            });
            if (res.data) {
                setRawLeads(res.data.leads || []);
                setMonthlyGroups(res.data.monthlyGroups || []);
                setOverallEnrolledStats(res.data.overallEnrolledStats || { inCrmCount: 0, notInCrmCount: 0, notInCrmStudents: [] });
                if (!targetMonthName && res.data.defaultActiveGroupName) {
                    setTargetMonthName(res.data.defaultActiveGroupName);
                }
            }
        } catch (error) {
            console.error("Failed to fetch Retention Campaign Stats");
        }
        setLoading(false);
    };

    const handleDailyClick = () => {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    const exportNotInCrmLeads = () => {
        if (!overallEnrolledStats.notInCrmStudents || overallEnrolledStats.notInCrmStudents.length === 0) {
            return toast.error("No missing leads to export!");
        }
        const headers = ['Student ID', 'Name', 'Phone', 'WhatsApp'];
        const rows = overallEnrolledStats.notInCrmStudents.map(s => [
            s.id,
            (s.name || 'Unknown').replace(/,/g, ' '),
            s.phone || '',
            s.whatsapp || ''
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Not_In_CRM_Paid_Students.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${overallEnrolledStats.notInCrmStudents.length} missing leads successfully!`);
    };

    // Calculate all metrics dynamically
    const metrics = useMemo(() => {
        const targetIdx = monthlyGroups.findIndex(g => g.name === targetMonthName);
        const m0 = targetIdx >= 0 ? monthlyGroups[targetIdx] : null;
        const m1 = targetIdx >= 1 ? monthlyGroups[targetIdx - 1] : null;
        const m2 = targetIdx >= 2 ? monthlyGroups[targetIdx - 2] : null;

        const monthStats = {
            m0: { name: m0?.name || 'Selected Month', total: 0, full: 0, upgrade: 0, monthly: 0, drops: 0, expected: 0, newJoins: 0 },
            m1: { name: m1?.name || 'Previous Month 1', total: 0, full: 0, upgrade: 0, monthly: 0, drops: 0, expected: 0, newJoins: 0 },
            m2: { name: m2?.name || 'Previous Month 2', total: 0, full: 0, upgrade: 0, monthly: 0, drops: 0, expected: 0, newJoins: 0 }
        };

        let staffMap = {};

        rawLeads.forEach(l => {
            const matchesSearch = (l.phone || '').includes(searchQuery) || (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (!matchesSearch) return;

            const intention = l.paymentIntention || 'NOT_DECIDED';
            const isPending = l.callStatus === 'pending' || !l.callStatus;
            const round = l.coordinationRound || 1;
            const phase = l.phase || 1;
            const enrolledGroupIds = l.enrolledGroupIds || [];

            // Month Stats
            [
                { key: 'm0', group: m0, prevGroup: m1 },
                { key: 'm1', group: m1, prevGroup: m2 },
                { key: 'm2', group: m2, prevGroup: targetIdx >= 3 ? monthlyGroups[targetIdx - 3] : null }
            ].forEach(({ key, group, prevGroup }) => {
                if (!group) return;
                if (intention === 'FULL' && ((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))) {
                    monthStats[key].full++;
                    monthStats[key].total++;
                } else if (intention === 'UPGRADE' && ((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))) {
                    monthStats[key].upgrade++;
                    monthStats[key].total++;
                } else if (intention === 'MONTHLY' || intention === 'INSTALLMENT') {
                    const paidThisMonth = enrolledGroupIds.some(id => group.ids.includes(id));
                    const paidPrevMonth = prevGroup ? enrolledGroupIds.some(id => prevGroup.ids.includes(id)) : false;

                    if (paidThisMonth) {
                        monthStats[key].monthly++;
                        monthStats[key].total++;
                        if (prevGroup && !paidPrevMonth) {
                            monthStats[key].newJoins++;
                        }
                    }

                    if (paidPrevMonth) {
                        monthStats[key].expected++;
                        if (!paidThisMonth) {
                            monthStats[key].drops++;
                        }
                    }
                }
            });

            if (activePhaseFilter !== 'ALL' && phase !== activePhaseFilter) {
                return; // Skip for Agent table
            }

            if (l.assignedTo) {
                const sName = l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim() : 'Unknown';
                if (!staffMap[sName]) {
                    staffMap[sName] = { 
                        name: sName, businessType: l.assignedUser?.businessType, role: l.assignedUser?.role, assigned: 0,
                        categories: {
                            full: { pending: 0, covered: 0 },
                            upgrade: { pending: 0, covered: 0 },
                            monthly: { pending: 0, covered: 0 },
                            installment: { pending: 0, covered: 0 },
                            nonEnrolled: { pending: 0, covered: 0 },
                            twoMonthDrop: { pending: 0, covered: 0 }
                        }
                    };
                }
                const s = staffMap[sName];
                s.assigned++;

                const isEnrolled = ((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))));
                let unpaidCount = 0;
                if (targetIdx >= 0 && intention !== 'FULL') {
                    for (let i = 0; i <= targetIdx; i++) {
                        const pm = monthlyGroups[i];
                        const hasPaid = pm.ids.some(id => enrolledGroupIds.includes(id));
                        if (!hasPaid) unpaidCount++;
                    }
                }

                let catKey = '';
                if (isEnrolled && intention === 'FULL') catKey = 'full';
                else if (isEnrolled && intention === 'UPGRADE') catKey = 'upgrade';
                else if (isEnrolled && intention === 'MONTHLY') catKey = 'monthly';
                else if (isEnrolled && intention === 'INSTALLMENT') catKey = 'installment';
                else if (!isEnrolled && unpaidCount > 2) catKey = 'twoMonthDrop';
                else if (!isEnrolled) catKey = 'nonEnrolled';
                
                if (catKey) {
                    if (isPending) s.categories[catKey].pending++;
                    else s.categories[catKey].covered++;
                }
            }
        });

        Object.values(monthStats).forEach(ms => {
            ms.dropPercent = ms.expected > 0 ? Math.round((ms.drops / ms.expected) * 100) : 0;
        });

        return {
            monthStats,
            staffBreakdown: Object.values(staffMap).sort((a, b) => b.assigned - a.assigned)
        };
    }, [rawLeads, searchQuery, monthlyGroups, targetMonthName, activePhaseFilter]);

    if (!filters?.selectedBusiness) {
        return <div className="flex justify-center items-center h-[200px] text-slate-500 font-medium">Please select a Campaign/Business to view Paid Campaign metrics.</div>;
    }

    if (loading && rawLeads.length === 0) return <div className="flex justify-center items-center h-[400px] text-indigo-400 animate-pulse font-sans font-bold tracking-wide">Calculating Retention Analytics...</div>;

    const MonthBlock = ({ title, stats, isCurrent }) => (
        <div className={`p-6 rounded-3xl border flex flex-col relative overflow-hidden transition-all duration-500 ${isCurrent ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_8px_30px_rgba(99,102,241,0.15)]' : 'bg-white/5 border-white/10 shadow-xl'}`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isCurrent ? 'text-indigo-400' : 'text-slate-400'}`}>
                <FaCalendarAlt /> {title} ({stats.name})
            </h3>
            
            <div className="flex justify-between items-end mb-6">
                <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Enrolled</p>
                    <h2 className="text-4xl font-black text-white">{stats.total}</h2>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest mb-1">Full Pay</p>
                    <h4 className="text-xl font-bold text-white">{stats.full}</h4>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-1">Upgrade</p>
                    <h4 className="text-xl font-bold text-white">{stats.upgrade}</h4>
                </div>
                <div className="bg-black/40 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-1">Monthly</p>
                    <h4 className="text-xl font-bold text-white">{stats.monthly}</h4>
                </div>
            </div>

            <div className="flex gap-3 mt-auto">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><FaArrowUp size={12}/></div>
                        <div>
                            <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">New Enrolls</p>
                            <h4 className="text-lg font-bold text-white">{stats.newJoins}</h4>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><FaArrowDown size={12}/></div>
                        <div>
                            <p className="text-[9px] text-red-400 font-black uppercase tracking-widest">Drops</p>
                            <h4 className="text-lg font-bold text-white">{stats.drops} <span className="text-[10px] text-red-400/70 ml-1">({stats.dropPercent}%)</span></h4>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const CellStat = ({ pending, covered }) => (
        <div className="flex justify-center items-center gap-2">
            <div className="flex flex-col items-center bg-slate-800/80 border border-slate-700/50 rounded-lg p-1.5 min-w-[40px] shadow-inner">
               <span className="text-[8px] text-slate-400 font-black uppercase leading-none mb-1">Pend</span>
               <span className="text-slate-200 font-bold text-sm leading-none">{pending}</span>
            </div>
            <div className="flex flex-col items-center bg-blue-500/10 border border-blue-500/20 rounded-lg p-1.5 min-w-[40px] shadow-inner">
               <span className="text-[8px] text-blue-400/80 font-black uppercase leading-none mb-1">Cov</span>
               <span className="text-blue-400 font-bold text-sm leading-none">{covered}</span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 font-sans text-slate-200 animate-fade-in p-2 rounded-lg bg-transparent relative">
            
            {/* 1. TOP FILTERS ROW */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-xl gap-4">
                <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
                    {/* Month Filter */}
                    <div className="flex flex-col">
                        <label className="text-[10px] text-fuchsia-400 font-black uppercase tracking-widest mb-1 ml-1">Target Month</label>
                        <select 
                            value={targetMonthName} 
                            onChange={(e) => setTargetMonthName(e.target.value)}
                            className="bg-black/40 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-fuchsia-500 cursor-pointer shadow-inner min-w-[200px]"
                        >
                            <option value="">-- All Active Months --</option>
                            {monthlyGroups.map((g, i) => (
                                <option key={i} value={g.name}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="flex flex-col">
                        <label className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1 ml-1">Date Range</label>
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1 rounded-xl shadow-inner">
                            <button onClick={handleDailyClick} className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all">Today</button>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-semibold outline-none px-2 cursor-pointer" style={{ colorScheme: 'dark' }} />
                            <span className="text-slate-500 text-xs">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-300 text-xs font-semibold outline-none px-2 cursor-pointer" style={{ colorScheme: 'dark' }} />
                            {(startDate || endDate) && <button onClick={handleClearDates} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all mr-1">Clear</button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. OVERALL STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/20 shadow-xl flex flex-col justify-center relative overflow-hidden transition-all">
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><FaCheckSquare size={16}/></div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Total Enrolled (In CRM)</h3>
                    </div>
                    <h2 className="text-3xl font-black text-emerald-400 relative z-10 ml-11">{overallEnrolledStats.inCrmCount} <span className="text-[10px] font-semibold text-emerald-500/50 uppercase tracking-widest">Matching Students</span></h2>
                </div>
                <div className="bg-amber-500/5 backdrop-blur-md p-5 rounded-2xl border border-amber-500/20 shadow-xl flex flex-col justify-center relative overflow-hidden transition-all">
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg"><FaRegSquare size={16}/></div>
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Paid But Not In CRM</h3>
                        </div>
                        <button onClick={exportNotInCrmLeads} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-2 border border-amber-500/20 uppercase tracking-widest shadow-sm">
                            <FaFileExport /> Export List
                        </button>
                    </div>
                    <h2 className="text-3xl font-black text-amber-400 relative z-10 ml-11">{overallEnrolledStats.notInCrmCount} <span className="text-[10px] font-semibold text-amber-500/50 uppercase tracking-widest">Missing Students</span></h2>
                </div>
            </div>

            {/* 3. THREE MONTH BREAKDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <MonthBlock title="Selected Month" stats={metrics.monthStats.m0} isCurrent={true} />
                <MonthBlock title="Previous Month 1" stats={metrics.monthStats.m1} isCurrent={false} />
                <MonthBlock title="Previous Month 2" stats={metrics.monthStats.m2} isCurrent={false} />
            </div>

            {/* 4. AGENT WISE TABLE */}
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col relative overflow-hidden mt-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 relative z-10">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20"><FaUserTie className="text-indigo-400"/></div>
                        Coordinator Breakdown
                    </h3>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-xl">
                            <FaFilter className="text-emerald-500 ml-2" size={12}/>
                            <select 
                                value={activePhaseFilter} 
                                onChange={(e) => setActivePhaseFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="bg-transparent text-emerald-400 font-bold text-xs px-2 py-1 outline-none cursor-pointer"
                            >
                                <option value="ALL">Overall (All Phases)</option>
                                <option value={1}>Phase 1</option>
                                <option value={2}>Phase 2</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar">
                    {metrics.staffBreakdown.length === 0 ? <div className="text-center py-10 text-slate-500 text-sm">No coordinator data available.</div> : (
                        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                            <thead className="text-slate-400 text-[10px] uppercase tracking-wider bg-black/40">
                                <tr>
                                    <th className="py-4 px-4 font-semibold rounded-tl-lg">Coordinator</th>
                                    <th className="py-4 px-2 text-center font-semibold text-emerald-400 border-l border-white/5">FULL</th>
                                    <th className="py-4 px-2 text-center font-semibold text-purple-400 border-l border-white/5">UPGRADE</th>
                                    <th className="py-4 px-2 text-center font-semibold text-blue-400 border-l border-white/5">MONTHLY</th>
                                    <th className="py-4 px-2 text-center font-semibold text-amber-400 border-l border-white/5">INSTALLMENT</th>
                                    <th className="py-4 px-2 text-center font-semibold text-red-400 border-l border-white/5">NON-ENROLLED</th>
                                    <th className="py-4 px-2 text-center font-semibold text-fuchsia-400 border-l border-white/5">2 MONTH DROP</th>
                                    <th className="py-4 px-4 text-right font-semibold rounded-tr-lg border-l border-white/5">Total</th>
                                </tr>
                                <tr className="bg-black/60 border-b border-white/10">
                                    <th className="py-2 px-4 text-[9px] text-slate-500 font-bold">NAME / ROLE</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-2 text-center text-[9px] text-slate-500 font-bold border-l border-white/5">STATS</th>
                                    <th className="py-2 px-4 text-right text-[9px] text-slate-500 font-bold border-l border-white/5">TOTAL ASSIGNED</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.staffBreakdown.map((staff, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                        <td className="py-3 px-4 font-medium text-slate-200">
                                            <div className="flex items-center gap-2">
                                                {staff.name} <BusinessBadge businessType={staff.businessType} role={staff.role} />
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">
                                            <CellStat pending={staff.categories.full.pending} covered={staff.categories.full.covered} />
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors">
                                            <CellStat pending={staff.categories.upgrade.pending} covered={staff.categories.upgrade.covered} />
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors">
                                            <CellStat pending={staff.categories.monthly.pending} covered={staff.categories.monthly.covered} />
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors">
                                            <CellStat pending={staff.categories.installment.pending} covered={staff.categories.installment.covered} />
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-red-500/5 group-hover:bg-red-500/10 transition-colors">
                                            <CellStat pending={staff.categories.nonEnrolled.pending} covered={staff.categories.nonEnrolled.covered} />
                                        </td>
                                        <td className="py-3 px-2 border-l border-white/5 bg-fuchsia-500/5 group-hover:bg-fuchsia-500/10 transition-colors">
                                            <CellStat pending={staff.categories.twoMonthDrop.pending} covered={staff.categories.twoMonthDrop.covered} />
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-white border-l border-white/5 bg-black/20">
                                            {staff.assigned}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            
        </div>
    );
}

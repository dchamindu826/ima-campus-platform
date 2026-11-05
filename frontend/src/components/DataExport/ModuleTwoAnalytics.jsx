import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader2, Users, TrendingDown, Target, BookOpen, UserPlus, Filter } from 'lucide-react';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

export default function ModuleTwoAnalytics({ filters }) {
    const [loading, setLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);

    useEffect(() => {
        if (filters?.selectedBusiness && filters?.selectedBatch) {
            fetchAnalyticsData();
        } else {
            setAnalyticsData(null);
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    const fetchAnalyticsData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/data-export/module-two', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness, batchId: filters.selectedBatch }
            });
            setAnalyticsData(res.data);
        } catch (error) {
            console.error("Module 2 Error:", error);
            toast.error("Failed to load Conversion Analytics");
        }
        setLoading(false);
    };

    const handleExportExcel = () => {
        if (!analyticsData) return toast.error("No data available to export!");
        toast('Excel export logic can be added here!', { icon: '🚧' });
    };

    if (!filters?.selectedBusiness || !filters?.selectedBatch) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Filter className="text-slate-500 opacity-50 mb-3" size={48} />
                <span className="text-slate-400 text-sm font-medium">Please select a campaign & batch above to view Module 02.</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Loader2 className="animate-spin text-purple-500 mb-3" size={40} />
                <span className="text-slate-400 text-sm font-medium">Loading Drops & Distributions...</span>
            </div>
        );
    }

    if (!analyticsData || !analyticsData.subjects || analyticsData.subjects.length === 0) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2 text-slate-400 text-sm font-medium">
                No active data found for this batch.
            </div>
        );
    }

    const { summaryCards, coreAverage, allGroups, monthlyGroups, subjects, distributionData, dropData } = analyticsData;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 mt-2 pb-6">
            
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Target className="text-purple-400" size={24} />
                        Conversion & Drop Analytics
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Analyze inquiries, group distributions, and student drop rates.</p>
                </div>
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                    <FaFileExcel size={16} /> Export to Excel
                </button>
            </div>

            {/* 🔥 1. SUMMARY CARDS (Top Row) 🔥 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-indigo-900/80 to-indigo-950 p-5 rounded-2xl border border-indigo-500/30 shadow-lg">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Users size={12}/> Free Seminar</p>
                    <h2 className="text-3xl font-black text-white">{summaryCards.freeSeminar}</h2>
                </div>
                <div className="bg-gradient-to-br from-blue-900/80 to-blue-950 p-5 rounded-2xl border border-blue-500/30 shadow-lg">
                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Users size={12}/> Open Seminar</p>
                    <h2 className="text-3xl font-black text-white">{summaryCards.openSeminar}</h2>
                </div>
                <div className="bg-gradient-to-br from-cyan-900/80 to-cyan-950 p-5 rounded-2xl border border-cyan-500/30 shadow-lg">
                    <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-1 flex items-center gap-1.5"><UserPlus size={12}/> New Inquiries</p>
                    <h2 className="text-3xl font-black text-white">{summaryCards.newInquiries}</h2>
                </div>
                <div className="bg-gradient-to-br from-emerald-900/80 to-emerald-950 p-5 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1 flex items-center gap-1.5 relative z-10"><Target size={12}/> Real Enrolled</p>
                    <h2 className="text-3xl font-black text-white relative z-10">{summaryCards.realEnrolled}</h2>
                    <Users className="absolute -right-4 -bottom-4 text-white/10" size={80} />
                </div>
                <div className="bg-gradient-to-br from-purple-900/80 to-purple-950 p-5 rounded-2xl border border-purple-500/30 shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1 flex items-center gap-1.5 relative z-10"><BookOpen size={12}/> Core Avg (3/9 Subs)</p>
                    <h2 className="text-3xl font-black text-white relative z-10">{coreAverage}</h2>
                </div>
            </div>

            {/* 🔥 2. GROUP DISTRIBUTION TABLE 🔥 */}
            <div className="bg-[#0f172a] rounded-[2rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-800 bg-[#1e293b]">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Payment Group Distribution</h4>
                    <p className="text-xs text-slate-400 mt-1">Student count registered under each payment plan.</p>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="py-4 px-6 font-black text-slate-400 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] sticky left-0 z-10">Subject</th>
                                {allGroups.map(g => (
                                    <th key={g.id} className="py-4 px-6 font-black text-indigo-300 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] text-center whitespace-nowrap">
                                        {g.name.replace('Payment -', '').trim()}
                                    </th>
                                ))}
                                <th className="py-4 px-6 font-black text-emerald-400 text-xs uppercase tracking-widest border-b border-slate-800 bg-[#1e293b] text-center">Total Enrolled</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {subjects.map((sub, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-6 font-bold text-sm text-slate-200 border-r border-slate-800 bg-[#0f172a] sticky left-0 truncate max-w-[200px]">{sub}</td>
                                    {allGroups.map(g => (
                                        <td key={g.id} className="py-4 px-6 text-center text-sm font-bold text-slate-300 border-r border-slate-800">
                                            {distributionData[sub][g.id]}
                                        </td>
                                    ))}
                                    <td className="py-4 px-6 text-center text-base font-black text-emerald-400 bg-emerald-500/5">
                                        {distributionData[sub]['Total']}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🔥 3. DROP ANALYTICS TABLE 🔥 */}
            <div className="bg-[#0f172a] rounded-[2rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-800 bg-[#1e293b]">
                    <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><TrendingDown size={18}/> Month-over-Month Drop Analytics</h4>
                    <p className="text-xs text-slate-400 mt-1">Number of students who stopped paying compared to the previous month.</p>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="py-4 px-6 font-black text-slate-400 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] sticky left-0 z-10">Subject</th>
                                {monthlyGroups.map((mg, i) => (
                                    <th key={mg.id} className="py-4 px-6 font-black text-slate-300 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] text-center whitespace-nowrap">
                                        {i === 0 ? `Base: ${mg.name.replace('Monthly Payment -', '').trim()}` : mg.name.replace('Monthly Payment -', '').trim()}
                                    </th>
                                ))}
                                <th className="py-4 px-6 font-black text-rose-400 text-xs uppercase tracking-widest border-b border-slate-800 bg-[#1e293b] text-center">Total Subject Drop</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {subjects.map((sub, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-6 font-bold text-sm text-slate-200 border-r border-slate-800 bg-[#0f172a] sticky left-0 truncate max-w-[200px]">{sub}</td>
                                    {monthlyGroups.map((mg, i) => {
                                        const drops = dropData[sub].months[mg.id];
                                        return (
                                            <td key={mg.id} className={`py-4 px-6 text-center text-sm font-bold border-r border-slate-800 ${i === 0 ? 'text-slate-600' : (drops > 0 ? 'text-rose-400' : 'text-slate-400')}`}>
                                                {i === 0 ? '-' : (drops > 0 ? `-${drops}` : '0')}
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 px-6 text-center text-base font-black text-rose-500 bg-rose-500/5">
                                        {dropData[sub].totalSubjectDrops > 0 ? `-${dropData[sub].totalSubjectDrops}` : '0'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-700">
                            <tr>
                                <td className="py-5 px-6 font-black text-rose-400 text-xs uppercase tracking-widest border-r border-slate-800 bg-[#1e293b] sticky left-0">OVERALL BATCH DROPS</td>
                                {monthlyGroups.map((mg, i) => {
                                    let colTotal = 0;
                                    subjects.forEach(sub => { colTotal += dropData[sub].months[mg.id]; });
                                    return (
                                        <td key={mg.id} className="py-5 px-6 text-center text-base font-black text-rose-400 border-r border-slate-800 bg-[#1e293b]">
                                            {i === 0 ? '-' : `-${colTotal}`}
                                        </td>
                                    );
                                })}
                                <td className="py-5 px-6 text-center text-xl font-black text-rose-500 bg-rose-500/10">
                                    -{subjects.reduce((sum, sub) => sum + dropData[sub].totalSubjectDrops, 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

        </div>
    );
}
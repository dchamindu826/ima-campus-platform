import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader2, Users, TrendingDown, Target, BookOpen, UserPlus, Filter, ArrowUpRight, ArrowDownRight, Info, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { FaFileExcel } from 'react-icons/fa';

export default function ModuleOneRetention({ filters }) {
    const [loading, setLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [overallViewMode, setOverallViewMode] = useState('slips');
    const [classType, setClassType] = useState('1'); // '1' = Theory, '2' = Paper, 'ALL' = Combined
    const [availableClassTypes, setAvailableClassTypes] = useState({ hasTheory: true, hasPaper: false });

    const fetchAnalyticsData = async (targetClassType = classType) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/data-export/module-one', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness, batchId: filters.selectedBatch, classType: targetClassType }
            });
            setAnalyticsData(res.data);
            if (res.data?.availableClassTypes) {
                setAvailableClassTypes(res.data.availableClassTypes);
            }
        } catch (error) {
            console.error("Module 1 Error:", error);
            toast.error("Failed to load Retention & Drop Analytics");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (filters?.selectedBusiness && filters?.selectedBatch) {
            fetchAnalyticsData(classType);
        } else {
            setAnalyticsData(null);
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch, classType]);

    const handleExportExcel = () => {
        if (!analyticsData) return toast.error("No data available to export!");
        toast('Excel export logic can be added here!', { icon: '🚧' });
    };

    const downloadAsImage = async (elementId, filename) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const loadingToast = toast.loading('Generating image...');
        try {
            // Find scrollable container to get the true full width
            const scrollContainer = element.querySelector('.overflow-x-auto');
            const targetWidth = scrollContainer ? Math.max(element.offsetWidth, scrollContainer.scrollWidth) : element.offsetWidth;
            
            const dataUrl = await toPng(element, { 
                cacheBust: true, 
                backgroundColor: '#0f172a',
                pixelRatio: 2, // Higher quality
                width: targetWidth,
                style: {
                    width: `${targetWidth}px` // Apply width to the cloned element so it expands fully
                }
            });
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}.png`;
            link.click();
            toast.success('Image exported successfully!', { id: loadingToast });
        } catch (error) {
            console.error('Error generating image:', error);
            toast.error('Failed to generate image.', { id: loadingToast });
        }
    };

    if (!filters?.selectedBusiness || !filters?.selectedBatch) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Filter className="text-slate-500 opacity-50 mb-3" size={48} />
                <span className="text-slate-400 text-sm font-medium">Please select a campaign & batch above to view Module 01.</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Loader2 className="animate-spin text-indigo-500 mb-3" size={40} />
                <span className="text-slate-400 text-sm font-medium">Loading Retention & Drops...</span>
            </div>
        );
    }

    if (!analyticsData || !analyticsData.subjects || analyticsData.subjects.length === 0) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2 gap-4">
                <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700/60 shadow-inner">
                    <button
                        onClick={() => setClassType('1')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            classType === '1'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Theory
                        {availableClassTypes.hasTheory && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block"></span>}
                    </button>
                    <button
                        onClick={() => setClassType('2')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            classType === '2'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Paper
                        {availableClassTypes.hasPaper && <span className="w-1.5 h-1.5 rounded-full bg-pink-300 inline-block animate-pulse"></span>}
                    </button>
                    <button
                        onClick={() => setClassType('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            classType === 'ALL'
                                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Combined
                    </button>
                </div>
                <span className="text-slate-400 text-sm font-medium">No active data found for {classType === '2' ? 'Paper Class' : classType === '1' ? 'Theory Class' : 'this batch'}.</span>
            </div>
        );
    }

    const { summaryCards, coreAverage, allGroups, monthlyGroups, subjects, distributionData, dropData, batchMonths } = analyticsData;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 mt-2 pb-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Target className="text-indigo-400" size={24} />
                        Conversion & Drop Analytics
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Analyze inquiries, group distributions, and student retention rates.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700/60 shadow-inner">
                        <button
                            onClick={() => setClassType('1')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                classType === '1'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Theory
                            {availableClassTypes.hasTheory && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block"></span>}
                        </button>
                        <button
                            onClick={() => setClassType('2')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                classType === '2'
                                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Paper
                            {availableClassTypes.hasPaper && <span className="w-1.5 h-1.5 rounded-full bg-pink-300 inline-block animate-pulse"></span>}
                        </button>
                        <button
                            onClick={() => setClassType('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                classType === 'ALL'
                                    ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Combined
                        </button>
                    </div>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                        <FaFileExcel size={16} /> Export to Excel
                    </button>
                </div>
            </div>

            {/* 🔥 1. SUMMARY CARDS (Top Row) 🔥 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-indigo-900/80 to-indigo-950 p-5 rounded-2xl border border-indigo-500/30 shadow-lg relative overflow-hidden">
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
                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1 flex items-center gap-1.5 relative z-10">
                        <Target size={12}/> Real Enrolled
                        <span title="Total Unique Students who have an APPROVED payment (Excludes free cards). Note: Data Export groups by the month mentioned in the PAYMENT GROUP name, NOT the actual date the slip was submitted." className="cursor-help opacity-70 hover:opacity-100"><Info size={14} /></span>
                    </p>
                    <h2 className="text-3xl font-black text-white relative z-10">{summaryCards.realEnrolled}</h2>
                    <Users className="absolute -right-4 -bottom-4 text-emerald-500/10" size={80} />
                </div>
                <div className="bg-gradient-to-br from-purple-900/80 to-purple-950 p-5 rounded-2xl border border-purple-500/30 shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1 flex items-center gap-1.5 relative z-10"><BookOpen size={12}/> Core Avg (3/9 Subs)</p>
                    <h2 className="text-3xl font-black text-white relative z-10">{coreAverage}</h2>
                </div>
            </div>

            {/* 🔥 2. GROUP DISTRIBUTION TABLE 🔥 */}
            <div id="group-distribution-table" className="bg-[#0f172a] rounded-[2rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-800 bg-[#1e293b] flex justify-between items-start">
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Payment Group Distribution (Slips Count)</h4>
                        <p className="text-xs text-slate-400 mt-1">Payment slip counts registered under each payment plan. <span className="text-indigo-400 font-bold ml-1">*For individual subjects, Slips = Unique Students.</span></p>
                    </div>
                    <button onClick={() => downloadAsImage('group-distribution-table', 'Group_Distribution')} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 p-2 rounded-lg" title="Download as Image">
                        <Download size={18} />
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-b-[2rem]" tabIndex="0">
                    <div className="p-2 bg-slate-800/20 text-center text-[10px] text-slate-400 font-medium uppercase tracking-widest border-b border-slate-800">
                        ( Click here and use Arrow Keys ⬅️ ➡️ to scroll horizontally )
                    </div>
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr>
                                <th className="py-4 px-6 font-black text-slate-400 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] sticky left-0 z-10">Subject</th>
                                {batchMonths?.map(m => (
                                    <th key={m} className="py-4 px-6 font-black text-indigo-300 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] text-center whitespace-nowrap min-w-[180px]">
                                        {m}
                                    </th>
                                ))}
                                <th className="py-4 px-6 font-black text-emerald-400 text-xs uppercase tracking-widest border-b border-slate-800 bg-[#1e293b] text-center">Total Slips</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {subjects.map((sub, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-6 font-bold text-sm text-slate-200 border-r border-slate-800 bg-[#0f172a] sticky left-0 truncate max-w-[200px]">{sub}</td>
                                    {batchMonths?.map(m => {
                                        const cell = distributionData[sub]?.[m] || { FULL: 0, MONTHLY: 0, INSTALLMENT: 0, total: 0 };
                                        return (
                                        <td key={m} className="py-3 px-3 text-center border-r border-slate-800">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xl font-black text-white">{cell.total}</span>
                                                <div className="grid grid-cols-3 gap-2 mt-2 w-full text-[11px] font-black uppercase tracking-wider">
                                                    <div className="flex flex-col items-center bg-indigo-500/20 text-indigo-300 rounded-lg py-1.5 border border-indigo-500/30 shadow-inner"><span>Full</span><span className="text-lg mt-0.5 text-indigo-50">{cell.FULL}</span></div>
                                                    <div className="flex flex-col items-center bg-emerald-500/20 text-emerald-300 rounded-lg py-1.5 border border-emerald-500/30 shadow-inner"><span>Mnth</span><span className="text-lg mt-0.5 text-emerald-50">{cell.MONTHLY}</span></div>
                                                    <div className="flex flex-col items-center bg-orange-500/20 text-orange-300 rounded-lg py-1.5 border border-orange-500/30 shadow-inner"><span>Inst</span><span className="text-lg mt-0.5 text-orange-50">{cell.INSTALLMENT}</span></div>
                                                </div>
                                            </div>
                                        </td>
                                        );
                                    })}
                                    <td className="py-4 px-6 text-center text-base font-black text-emerald-400 bg-emerald-500/5">
                                        {distributionData[sub]['Total']}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-700">
                            <tr>
                                <td className="py-6 px-6 font-black text-indigo-300 text-sm uppercase tracking-widest border-r border-slate-800 bg-[#1e293b] sticky left-0 z-10">OVERALL CLASS SIZE</td>
                                {batchMonths?.map(m => {
                                    let sumFull = 0, sumMnth = 0, sumInst = 0, sumTotal = 0;
                                    subjects.forEach(sub => {
                                        const cell = distributionData[sub]?.[m];
                                        if (cell) {
                                            sumFull += cell.FULL;
                                            sumMnth += cell.MONTHLY;
                                            sumInst += cell.INSTALLMENT;
                                            sumTotal += cell.total;
                                        }
                                    });
                                    const pctFull = sumTotal > 0 ? ((sumFull/sumTotal)*100).toFixed(1) : 0;
                                    const pctMnth = sumTotal > 0 ? ((sumMnth/sumTotal)*100).toFixed(1) : 0;
                                    const pctInst = sumTotal > 0 ? ((sumInst/sumTotal)*100).toFixed(1) : 0;

                                    return (
                                        <td key={m} className="py-4 px-4 text-center border-r border-slate-800 bg-[#1e293b]">
                                            <div className="flex flex-col items-center">
                                                <span className="text-2xl font-black text-white">{sumTotal}</span>
                                                <div className="grid grid-cols-3 gap-2 mt-3 w-full text-[10px] font-black uppercase tracking-wider">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-indigo-400 text-lg">{sumFull}</span>
                                                        <span className="text-indigo-300/50 mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded">{pctFull}% FULL</span>
                                                    </div>
                                                    <div className="flex flex-col items-center border-l border-r border-slate-700/50">
                                                        <span className="text-emerald-400 text-lg">{sumMnth}</span>
                                                        <span className="text-emerald-300/50 mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">{pctMnth}% MNTH</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-orange-400 text-lg">{sumInst}</span>
                                                        <span className="text-orange-300/50 mt-1 bg-orange-500/10 px-1.5 py-0.5 rounded">{pctInst}% INST</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="py-6 px-6 text-center text-xl font-black text-emerald-400 bg-[#1e293b]">
                                    {subjects.reduce((sum, sub) => sum + (distributionData[sub]?.['Total'] || 0), 0)}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-6 px-6 font-black text-emerald-400 text-xs uppercase tracking-widest border-r border-slate-800 bg-[#1e293b]/60 sticky left-0 z-10 flex items-center gap-2"><Users size={16}/> OVERALL UNIQUE STUDENTS</td>
                                {batchMonths?.map(m => (
                                    <td key={`unique-${m}`} className="py-4 px-4 text-center border-r border-slate-800 bg-[#1e293b]/60">
                                        <span className="text-2xl font-black text-emerald-400">{analyticsData.batchOverallUniqueStats?.[m]?.size || 0}</span>
                                    </td>
                                ))}
                                <td className="py-6 px-6 text-center text-xl font-black text-emerald-400 bg-[#1e293b]/60">-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* 🔥 3. DROP & GROWTH ANALYTICS TABLE 🔥 */}
            <div id="drop-growth-table" className="bg-[#0f172a] rounded-[2rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-800 bg-[#1e293b] flex justify-between items-start">
                    <div>
                        <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><TrendingDown size={18}/> Month-over-Month Drop & Growth</h4>
                        <p className="text-xs text-slate-400 mt-1">Number of students who stopped paying (Drops) and new/upgraded students to full payment (Growth). <span className="text-indigo-400 font-bold ml-1">*Subject-level drops track unique students per subject.</span></p>
                    </div>
                    <button onClick={() => downloadAsImage('drop-growth-table', 'Month_Over_Month_Drop_Growth')} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 p-2 rounded-lg" title="Download as Image">
                        <Download size={18} />
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-b-[2rem]" tabIndex="0">
                    <div className="p-2 bg-slate-800/20 text-center text-[10px] text-slate-400 font-medium uppercase tracking-widest border-b border-slate-800">
                        ( Click here and use Arrow Keys ⬅️ ➡️ to scroll horizontally )
                    </div>
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr>
                                <th className="py-4 px-6 font-black text-slate-400 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] sticky left-0 z-10 min-w-[280px]">Subject</th>
                                {batchMonths?.slice(1).map((m, idx) => (
                                    <th key={m} className="py-4 px-6 font-black text-slate-300 text-xs uppercase tracking-widest border-b border-r border-slate-800 bg-[#1e293b] text-center whitespace-nowrap min-w-[280px]">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-slate-500">{batchMonths[idx]}</span>
                                            <span className="text-indigo-400">➡️</span>
                                            <span className="text-slate-200">{m}</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="py-4 px-6 font-black text-indigo-400 text-xs uppercase tracking-widest border-b border-slate-800 bg-[#1e293b] text-center whitespace-nowrap min-w-[180px]">Overall Performance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {subjects.map((sub, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-4 px-6 font-bold text-sm text-slate-200 border-r border-slate-800 bg-[#0f172a] sticky left-0 min-w-[280px] max-w-[350px] whitespace-normal leading-relaxed">{sub}</td>
                                    {batchMonths?.slice(1).map((m) => {
                                        const stats = dropData[sub]?.months?.[m];
                                        return (
                                            <td key={m} className="py-4 px-4 align-top border-r border-slate-800">
                                                {!stats ? <div className="text-center text-slate-600">-</div> : (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        {/* FULL ROW */}
                                                        <div className="flex flex-col bg-indigo-500/10 rounded-md p-2 border border-indigo-500/20 shadow-sm">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Full</span>
                                                                <div className="flex gap-1.5">
                                                                    {stats.FULL.growNew > 0 && <span className="text-emerald-300 text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">+N: {stats.FULL.growNew}</span>}
                                                                    {stats.FULL.growUpg > 0 && <span className="text-indigo-300 text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded font-bold">+U: {stats.FULL.growUpg}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">GROW</span>
                                                                    <span className="text-emerald-400 text-[11px] font-black">+{stats.FULL.grow} <span className="opacity-60 font-normal text-[9px]">({stats.FULL.growPct}%)</span></span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">DROP</span>
                                                                    <span className="text-rose-400 text-[11px] font-black">-{stats.FULL.drop} <span className="opacity-60 font-normal text-[9px]">({stats.FULL.dropPct}%)</span></span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* MNTH ROW */}
                                                        <div className="flex flex-col bg-emerald-500/10 rounded-md p-2 border border-emerald-500/20 shadow-sm">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Mnth</span>
                                                                {stats.MONTHLY.upg > 0 && <span className="text-indigo-300 text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded font-bold">Upg: {stats.MONTHLY.upg}</span>}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">GROW</span>
                                                                    <span className="text-emerald-400 text-[11px] font-black">+{stats.MONTHLY.grow} <span className="opacity-60 font-normal text-[9px]">({stats.MONTHLY.growPct}%)</span></span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">DROP</span>
                                                                    <span className="text-rose-400 text-[11px] font-black">-{stats.MONTHLY.drop} <span className="opacity-60 font-normal text-[9px]">({stats.MONTHLY.dropPct}%)</span></span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* INST ROW */}
                                                        <div className="flex flex-col bg-orange-500/10 rounded-md p-2 border border-orange-500/20 shadow-sm">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-orange-400 text-[10px] font-black uppercase tracking-widest">Inst</span>
                                                                {stats.INSTALLMENT.upg > 0 && <span className="text-indigo-300 text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded font-bold">Upg: {stats.INSTALLMENT.upg}</span>}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">GROW</span>
                                                                    <span className="text-emerald-400 text-[11px] font-black">+{stats.INSTALLMENT.grow} <span className="opacity-60 font-normal text-[9px]">({stats.INSTALLMENT.growPct}%)</span></span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-[#0f172a]/50 px-2 py-1 rounded border border-slate-800/50">
                                                                    <span className="text-slate-400 text-[9px] font-bold">DROP</span>
                                                                    <span className="text-rose-400 text-[11px] font-black">-{stats.INSTALLMENT.drop} <span className="opacity-60 font-normal text-[9px]">({stats.INSTALLMENT.dropPct}%)</span></span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 px-6 text-center border-r border-slate-800 bg-indigo-500/5">
                                        <div className="flex flex-col items-center gap-1 text-sm font-black tracking-widest">
                                            <span className="text-emerald-400 flex items-center gap-1"><ArrowUpRight size={14}/> +{dropData[sub]?.overallGrow || 0}</span>
                                            <span className="text-rose-400 flex items-center gap-1"><ArrowDownRight size={14}/> -{dropData[sub]?.overallDrop || 0}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🔥 4. OVERALL DROP & GROWTH SUMMARY (OUTSIDE TABLE) 🔥 */}
            <div id="overall-batch-drops" className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[2rem] border border-slate-700/50 shadow-xl overflow-hidden p-8 mt-2 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-500 opacity-50"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                    <div>
                        <h4 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3"><TrendingDown className="text-indigo-400" size={28}/> Overall Batch Drops & Conversions</h4>
                        <p className="text-sm text-slate-400 mt-2 font-medium">Monthly aggregated performance across the entire batch.</p>
                    </div>
                    <button onClick={() => downloadAsImage('overall-batch-drops', 'Overall_Batch_Drops')} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors bg-slate-800/80 hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm">
                        <Download size={16} /> Export Image
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {batchMonths?.slice(1).map((m, idx) => {

                        let fullGrow = 0, fullDrop = 0;
                        let fullGrowNew = 0, fullGrowUpg = 0;
                        let mnthGrow = 0, mnthDrop = 0, mnthUpg = 0;
                        let instGrow = 0, instDrop = 0, instUpg = 0;
                        let prevFullSize = 0, prevMnthSize = 0, prevInstSize = 0;
                        
                        subjects.forEach(sub => { 
                            const st = dropData[sub]?.months?.[m];
                            if (st) {
                                fullGrow += st.FULL.grow; fullDrop += st.FULL.drop;
                                fullGrowNew += (st.FULL.growNew || 0); fullGrowUpg += (st.FULL.growUpg || 0);
                                prevFullSize += (st.FULL.prevSize || 0);
                                
                                mnthGrow += st.MONTHLY.grow; mnthDrop += st.MONTHLY.drop; mnthUpg += (st.MONTHLY.upg || 0);
                                prevMnthSize += (st.MONTHLY.prevSize || 0);
                                
                                instGrow += st.INSTALLMENT.grow; instDrop += st.INSTALLMENT.drop; instUpg += (st.INSTALLMENT.upg || 0);
                                prevInstSize += (st.INSTALLMENT.prevSize || 0);
                            }
                        });
                        
                        const calcPct = (val, prevBase) => prevBase > 0 ? ((val / prevBase) * 100).toFixed(1) : 0;
                        
                        const totalGrow = fullGrow + mnthGrow + instGrow;
                        const totalDrop = fullDrop + mnthDrop + instDrop;
                        const totalPrevSize = prevFullSize + prevMnthSize + prevInstSize;
                        
                        return (
                            <div key={m} className="bg-[#1e293b]/50 rounded-[1.5rem] p-6 border border-slate-700/50 flex flex-col gap-6 shadow-lg hover:border-indigo-500/40 transition-all hover:bg-[#1e293b]/80 group">
                                <h5 className="text-xl font-black text-indigo-200 text-center uppercase tracking-widest border-b border-slate-700/50 pb-4 group-hover:text-white transition-colors flex items-center justify-center gap-3">
                                    <span className="text-slate-500">{batchMonths[idx]}</span>
                                    <span className="text-indigo-400">➡️</span>
                                    <span>{m}</span>
                                </h5>
                                
                                {/* TOTAL SUMMARY */}
                                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 flex items-center justify-around shadow-inner mb-2">
                                   <div className="flex flex-col items-center">
                                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">Total Growth</span>
                                      <span className="text-emerald-400 text-2xl font-black">+{totalGrow} <span className="text-[10px] font-bold text-emerald-500/80">({calcPct(totalGrow, totalPrevSize)}%)</span></span>
                                   </div>
                                   <div className="h-10 w-px bg-slate-700/80"></div>
                                   <div className="flex flex-col items-center">
                                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">Total Drop</span>
                                      <span className="text-rose-400 text-2xl font-black">-{totalDrop} <span className="text-[10px] font-bold text-rose-500/80">({calcPct(totalDrop, totalPrevSize)}%)</span></span>
                                   </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                    {/* FULL */}
                                    <div className="flex flex-col bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20 shadow-inner">
                                        <span className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-3 border-b border-indigo-500/20 pb-2 text-center">Full</span>
                                        
                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="flex flex-col items-center text-center bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Growth</span>
                                                <span className="text-emerald-400 text-lg font-black">+{fullGrow} <span className="text-[10px] font-normal opacity-70 block">({calcPct(fullGrow, prevFullSize)}%)</span></span>
                                            </div>
                                            {(fullGrowNew > 0 || fullGrowUpg > 0) && (
                                                <div className="flex justify-center gap-1 -mt-1 mb-1">
                                                    {fullGrowNew > 0 && <span className="text-emerald-300 text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-black block">+N:{fullGrowNew}</span>}
                                                    {fullGrowUpg > 0 && <span className="text-indigo-300 text-[9px] bg-indigo-500/20 px-1.5 py-0.5 rounded font-black block">+U:{fullGrowUpg}</span>}
                                                </div>
                                            )}
                                            
                                            <div className="flex flex-col items-center text-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-auto">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Drop</span>
                                                <span className="text-rose-400 text-lg font-black">-{fullDrop} <span className="text-[10px] font-normal opacity-70 block">({calcPct(fullDrop, prevFullSize)}%)</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* MONTHLY */}
                                    <div className="flex flex-col bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 shadow-inner">
                                        <span className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-3 border-b border-emerald-500/20 pb-2 text-center">Mnth</span>
                                        
                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="flex flex-col items-center text-center bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Growth</span>
                                                <span className="text-emerald-400 text-lg font-black">+{mnthGrow} <span className="text-[10px] font-normal opacity-70 block">({calcPct(mnthGrow, prevMnthSize)}%)</span></span>
                                            </div>
                                            
                                            <div className="flex flex-col items-center text-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-auto">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Drop</span>
                                                <span className="text-rose-400 text-lg font-black">-{mnthDrop} <span className="text-[10px] font-normal opacity-70 block">({calcPct(mnthDrop, prevMnthSize)}%)</span></span>
                                            </div>
                                            
                                            {mnthUpg > 0 && (
                                                <div className="flex flex-col items-center text-center bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20 mt-1">
                                                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Upgraded</span>
                                                    <span className="text-indigo-400 text-sm font-black">{mnthUpg} <span className="text-[9px] font-normal opacity-70">({calcPct(mnthUpg, prevMnthSize)}%)</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* INSTALLMENT */}
                                    <div className="flex flex-col bg-orange-500/10 rounded-xl p-3 border border-orange-500/20 shadow-inner">
                                        <span className="text-orange-400 text-xs font-black uppercase tracking-widest mb-3 border-b border-orange-500/20 pb-2 text-center">Inst</span>
                                        
                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="flex flex-col items-center text-center bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Growth</span>
                                                <span className="text-emerald-400 text-lg font-black">+{instGrow} <span className="text-[10px] font-normal opacity-70 block">({calcPct(instGrow, prevInstSize)}%)</span></span>
                                            </div>
                                            
                                            <div className="flex flex-col items-center text-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-auto">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Drop</span>
                                                <span className="text-rose-400 text-lg font-black">-{instDrop} <span className="text-[10px] font-normal opacity-70 block">({calcPct(instDrop, prevInstSize)}%)</span></span>
                                            </div>
                                            
                                            {instUpg > 0 && (
                                                <div className="flex flex-col items-center text-center bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20 mt-1">
                                                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-0.5">Upgraded</span>
                                                    <span className="text-indigo-400 text-sm font-black">{instUpg} <span className="text-[9px] font-normal opacity-70">({calcPct(instUpg, prevInstSize)}%)</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
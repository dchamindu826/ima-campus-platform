import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Loader2, TrendingUp, TrendingDown, Users, CalendarDays } from 'lucide-react';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx'; // 🔥 Excel Export එකට මේක අත්‍යවශ්‍යයි

export default function ModuleOneMatrix({ filters }) {
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState(null);

    useEffect(() => {
        if (filters?.selectedBusiness && filters?.selectedBatch) {
            fetchMatrixData();
        } else {
            setMatrixData(null);
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    const fetchMatrixData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/admin/data-export/matrix', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    businessId: filters.selectedBusiness,
                    batchId: filters.selectedBatch
                }
            });
            setMatrixData(res.data);
        } catch (error) {
            console.error("Matrix Error:", error);
            toast.error("Failed to load Data Matrix");
        }
        setLoading(false);
    };

    // 🔥 EXCEL EXPORT LOGIC 🔥
    const handleExportExcel = () => {
        if (!matrixData || matrixData.months.length === 0) {
            return toast.error("No data available to export!");
        }

        const toastId = toast.loading("Generating Excel file...");

        try {
            const filteredMonths = matrixData.months.filter(m => !m.name.toLowerCase().includes('full'));
            const sheetData = [];

            // 1. Subjects ටික පේළියෙන් පේළියට (Rows) දානවා
            matrixData.subjects.forEach(sub => {
                const rowData = { "Subject Name": sub };
                
                filteredMonths.forEach((m, index) => {
                    const cell = matrixData.matrix[sub][m.id];
                    const monthName = m.name.replace(/Monthly Payment -/gi, '').trim();
                    
                    // හැම මාසෙකටම අදාල Data Columns විදිහට හැදෙනවා
                    rowData[`[${monthName}] Total Active`] = cell.total;
                    rowData[`[${monthName}] Full Pay`] = cell.full;
                    rowData[`[${monthName}] Monthly`] = cell.monthly;
                    rowData[`[${monthName}] Installment`] = cell.install || 0;
                    
                    // පළවෙනි මාසේ නෙවෙයි නම් Grow/Drop එකත් දානවා
                    if (index > 0) {
                        rowData[`[${monthName}] New Grown`] = cell.grown;
                        rowData[`[${monthName}] Dropped`] = cell.dropped;
                    }
                });
                sheetData.push(rowData);
            });

            // 2. අන්තිමට Overall Summary පේළිය (Bottom Total) දානවා
            const summaryRow = { "Subject Name": "OVERALL BATCH TOTAL" };
            filteredMonths.forEach((m, index) => {
                const sum = matrixData.summary[m.id];
                const monthName = m.name.replace(/Monthly Payment -/gi, '').trim();

                summaryRow[`[${monthName}] Total Active`] = sum.total;
                summaryRow[`[${monthName}] Full Pay`] = sum.full;
                summaryRow[`[${monthName}] Monthly`] = sum.monthly;
                summaryRow[`[${monthName}] Installment`] = sum.install || 0;

                if (index > 0) {
                    summaryRow[`[${monthName}] New Grown`] = sum.grown;
                    summaryRow[`[${monthName}] Dropped`] = sum.dropped;
                }
            });
            sheetData.push(summaryRow);

            // 3. Excel එක Generate කරලා Download කරනවා
            const ws = XLSX.utils.json_to_sheet(sheetData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Matrix_Analytics");
            
            XLSX.writeFile(wb, `IMA_Matrix_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
            toast.success("Excel exported successfully!", { id: toastId });

        } catch (error) {
            console.error("Excel Export Error:", error);
            toast.error("Failed to export Excel file", { id: toastId });
        }
    };

    if (!filters?.selectedBusiness || !filters?.selectedBatch) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Users className="text-slate-500 opacity-50 mb-3" size={48} />
                <span className="text-slate-400 text-sm font-medium">Please select a campaign & batch above to view the matrix.</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2">
                <Loader2 className="animate-spin text-indigo-500 mb-3" size={40} />
                <span className="text-slate-400 text-sm font-medium">Aggregating Monthly Analytics...</span>
            </div>
        );
    }

    if (!matrixData || matrixData.months.length === 0 || matrixData.subjects.length === 0) {
        return (
            <div className="flex flex-col justify-center items-center h-64 bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-sm m-2 text-slate-400 text-sm font-medium">
                No active payment data found for this batch.
            </div>
        );
    }

    const filteredMonths = matrixData.months.filter(m => !m.name.toLowerCase().includes('full'));

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500 mt-2">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays className="text-emerald-400" size={24} />
                        Monthly Progression Cards
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Subject-wise active student count & payment type breakdown per month.</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* 🔥 Export Button onClick Updated 🔥 */}
                    <button 
                        onClick={handleExportExcel} 
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <FaFileExcel size={16} /> Export to Excel
                    </button>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-6 pb-6 custom-scrollbar snap-x items-stretch flex-1">
                {filteredMonths.map((m, monthIndex) => {
                    const isFirstMonth = monthIndex === 0;
                    const summary = matrixData.summary[m.id];
                    const cleanMonthName = m.name.replace(/Monthly Payment -/gi, '').trim();

                    return (
                        <div key={m.id} className="min-w-[380px] max-w-[420px] flex-1 bg-[#0f172a] border border-slate-700/50 rounded-[2rem] shadow-xl flex flex-col snap-center overflow-hidden">
                            
                            {/* Card Header (Month & Total) */}
                            <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-6 relative overflow-hidden shrink-0 border-b border-indigo-500/30">
                                <div className="absolute -right-4 -top-4 opacity-10"><CalendarDays size={120} /></div>
                                <h4 className="text-base font-black text-indigo-100 uppercase tracking-widest mb-4 relative z-10">{cleanMonthName}</h4>
                                
                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider block mb-1">Total Active Students</span>
                                        <span className="text-5xl font-black text-white leading-none drop-shadow-md">{summary.total}</span>
                                    </div>
                                    
                                    {/* Overall Breakdown Grid for the Month */}
                                    <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl backdrop-blur-md border border-white/10">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase">Full</span>
                                            <span className="text-sm font-black text-emerald-100">{summary.full}</span>
                                        </div>
                                        <div className="flex flex-col items-center border-l border-white/10 pl-2">
                                            <span className="text-[9px] text-blue-400 font-bold uppercase">Month</span>
                                            <span className="text-sm font-black text-blue-100">{summary.monthly}</span>
                                        </div>
                                        <div className="flex flex-col items-center border-l border-white/10 pl-2">
                                            <span className="text-[9px] text-amber-400 font-bold uppercase">Install</span>
                                            <span className="text-sm font-black text-amber-100">{summary.install}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body (Subjects List) */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#1e293b]">
                                <div className="flex flex-col gap-4">
                                    {matrixData.subjects.map((sub, idx) => {
                                        const cell = matrixData.matrix[sub][m.id];
                                        
                                        return (
                                            <div key={idx} className="bg-[#0f172a] border border-slate-700 p-5 rounded-2xl flex flex-col gap-4 shadow-sm hover:border-indigo-500/50 transition-colors">
                                                
                                                {/* Subject Name & Total */}
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-sm font-bold text-slate-200 uppercase tracking-wide leading-tight flex-1">{sub}</span>
                                                    <span className="text-2xl font-black text-white bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-700">{cell.total}</span>
                                                </div>
                                                
                                                {/* CLEAR Breakdown Grid */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex flex-col items-center justify-center">
                                                        <span className="text-[10px] text-emerald-500 font-bold uppercase mb-0.5">Full</span>
                                                        <span className="text-sm font-black text-emerald-400">{cell.full}</span>
                                                    </div>
                                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 flex flex-col items-center justify-center">
                                                        <span className="text-[10px] text-blue-500 font-bold uppercase mb-0.5">Monthly</span>
                                                        <span className="text-sm font-black text-blue-400">{cell.monthly}</span>
                                                    </div>
                                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex flex-col items-center justify-center">
                                                        <span className="text-[10px] text-amber-500 font-bold uppercase mb-0.5">Install</span>
                                                        <span className="text-sm font-black text-amber-400">{cell.install}</span>
                                                    </div>
                                                </div>

                                                {/* Individual Growth/Drop */}
                                                {!isFirstMonth && (cell.grown > 0 || cell.dropped > 0) && (
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] font-bold">
                                                        <span className="text-slate-500 uppercase tracking-wider text-[9px]">Changes</span>
                                                        <div className="flex gap-4">
                                                            {cell.grown > 0 && <span className="text-emerald-400 flex items-center gap-1"><TrendingUp size={14}/> +{cell.grown}</span>}
                                                            {cell.dropped > 0 && <span className="text-rose-400 flex items-center gap-1"><TrendingDown size={14}/> -{cell.dropped}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Card Footer (Overall Monthly Drop/Grow) */}
                            {!isFirstMonth && (
                                <div className="bg-[#0f172a] p-5 border-t border-slate-700 shrink-0">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-3">Month-over-Month Comparison</p>
                                    <div className="flex justify-between gap-4">
                                        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center shadow-inner">
                                            <span className="text-emerald-400 text-[10px] font-bold uppercase flex items-center gap-1.5 mb-1"><TrendingUp size={14}/> Grown</span>
                                            <span className="text-xl font-black text-emerald-400">{summary.grown} <span className="text-xs font-bold opacity-70">({summary.grownPct}%)</span></span>
                                        </div>
                                        <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex flex-col items-center justify-center shadow-inner">
                                            <span className="text-rose-400 text-[10px] font-bold uppercase flex items-center gap-1.5 mb-1"><TrendingDown size={14}/> Dropped</span>
                                            <span className="text-xl font-black text-rose-400">{summary.dropped} <span className="text-xs font-bold opacity-70">({summary.droppedPct}%)</span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {isFirstMonth && (
                                <div className="bg-[#0f172a] p-5 border-t border-slate-700 shrink-0 flex items-center justify-center h-[120px]">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Base Month (No prior data)</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
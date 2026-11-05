import React, { useState, useRef, useEffect } from 'react';
import { Search, Users, Activity, CheckCircle, Clock, XCircle, Gift, Tag, Download, ChevronDown, Check } from 'lucide-react';

export default function PaymentFilters({ 
    isAdmin, isSystemAdmin, isFinance, filters, setFilters, businesses, batches, groups, subjects, payments, stats, onOpenStaffStats, onOpenExport
}) {
    const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsSubjectDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = (field, value) => {
        if (field === 'businessId') {
            setFilters(prev => ({ ...prev, [field]: value, batchId: 'All', groupId: 'All', subjectId: [], classType: 'All' }));
        } else if (field === 'batchId') {
            setFilters(prev => ({ ...prev, [field]: value, groupId: 'All', subjectId: [], classType: 'All' }));
        } else {
            setFilters(prev => ({ ...prev, [field]: value }));
        }
    };

    const canViewReports = isSystemAdmin || isAdmin || isFinance;

    // Check if selected batch has Theory, Paper, or BOTH
    const selectedBatchInfo = React.useMemo(() => {
        if (!filters.batchId || filters.batchId === 'All') {
            return { isBatchSelected: false, hasTheory: true, hasPaper: true, hasBoth: true, theoryCount: 0, paperCount: 0 };
        }

        const bIdStr = filters.batchId.toString();
        // Check groups passed in (they belong to this batch)
        const groupHasTheory = groups.some(g => parseInt(g.classType || 1, 10) === 1);
        const groupHasPaper = groups.some(g => parseInt(g.classType || 1, 10) === 2);

        // Also inspect payments matching this batch
        const batchPayments = payments ? payments.filter(p => (p.batchId || p.batch_id)?.toString() === bIdStr) : [];
        const theoryPayments = batchPayments.filter(p => parseInt(p.classType || p.group?.classType || 1, 10) === 1);
        const paperPayments = batchPayments.filter(p => parseInt(p.classType || p.group?.classType || 1, 10) === 2);

        const hasTheory = groupHasTheory || theoryPayments.length > 0;
        const hasPaper = groupHasPaper || paperPayments.length > 0;

        return {
            isBatchSelected: true,
            hasTheory,
            hasPaper,
            hasBoth: hasTheory && hasPaper,
            theoryCount: theoryPayments.length,
            paperCount: paperPayments.length
        };
    }, [filters.batchId, groups, payments]);

    return (
        <div className="mb-8 font-sans transition-all duration-300 relative z-[60]">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(234,179,8,0.12)] hover:border-yellow-500/30 hover:-translate-y-1 transition-all duration-300">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2"><Clock size={14} className="text-yellow-500"/> Pending</p>
                    <h3 className="text-3xl font-black text-white">{stats.pending}</h3>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400"/> Approved</p>
                    <h3 className="text-3xl font-black text-white">{stats.approved}</h3>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(250,204,21,0.12)] hover:border-yellow-400/30 hover:-translate-y-1 transition-all duration-300">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2"><Gift size={14} className="text-yellow-400"/> Free Cards</p>
                    <h3 className="text-3xl font-black text-white">{stats.freeCards}</h3>
                </div>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.12)] hover:border-blue-400/30 hover:-translate-y-1 transition-all duration-300">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2"><Tag size={14} className="text-blue-400"/> Discounts</p>
                    <h3 className="text-3xl font-black text-white">{stats.discounts}</h3>
                </div>
                {canViewReports && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] cursor-pointer hover:bg-white/10 hover:shadow-[0_0_20px_rgba(168,85,247,0.12)] hover:border-purple-500/30 hover:-translate-y-1 transition-all duration-300" onClick={onOpenStaffStats}>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2"><Users size={14} className="text-purple-400"/> Staff Stats</p>
                        <h3 className="text-sm font-extrabold text-purple-400 mt-1 uppercase tracking-widest">Click to View</h3>
                    </div>
                )}
                {canViewReports && onOpenExport && (
                    <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 p-5 rounded-2xl flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] cursor-pointer hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.18)] hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 group" onClick={() => onOpenExport()}>
                        <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-2 group-hover:text-emerald-300 transition-colors">
                            <Download size={14} className="text-emerald-400 group-hover:text-emerald-300 transition-colors"/> Payment Report
                        </p>
                        <h3 className="text-[13px] font-extrabold text-emerald-400 mt-1 uppercase tracking-widest group-hover:text-emerald-300 transition-colors">Generate Report</h3>
                    </div>
                )}
            </div>

            {/* Main Filters Bar */}
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4 transition-all duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative col-span-1 md:col-span-2 lg:col-span-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Search by Student Name or No..." 
                            value={filters.search} 
                            onChange={e => handleChange('search', e.target.value)} 
                            className="w-full bg-slate-900/60 dark:bg-slate-950/40 border border-white/10 focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 rounded-xl pl-11 pr-4 py-3 text-slate-100 placeholder-slate-500 font-medium outline-none transition-all duration-200 shadow-inner text-sm" 
                        />
                    </div>
                    
                    {isAdmin && (
                        <select 
                            value={filters.businessId} 
                            onChange={e => handleChange('businessId', e.target.value)} 
                            className="w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm truncate"
                        >
                            <option value="All" className="bg-slate-900 text-white">All Businesses</option>
                            {businesses.map(biz => <option key={biz.id} value={biz.id} className="bg-slate-900 text-white">{biz.name}</option>)}
                        </select>
                    )}
                    
                    <select 
                        value={filters.batchId} 
                        onChange={e => handleChange('batchId', e.target.value)} 
                        className={`w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm truncate ${!isAdmin ? 'lg:col-span-2' : ''}`}
                    >
                        <option value="All" className="bg-slate-900 text-white">All Batches</option>
                        {batches.map(b => <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>)}
                    </select>
                </div>

                {/* Batch Stream Toggle & Export Bar (Theory vs Paper) */}
                {selectedBatchInfo.isBatchSelected && selectedBatchInfo.hasBoth && (
                    <div className="bg-slate-900/90 border border-brand-accent/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Batch Stream:
                            </span>
                            
                            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => handleChange('classType', 'All')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                        (!filters.classType || filters.classType === 'All')
                                            ? 'bg-brand-accent text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🌐 Both Streams
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleChange('classType', '1')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                                        filters.classType === '1'
                                            ? 'bg-sky-600 text-white shadow-md'
                                            : 'text-sky-400 hover:text-sky-300'
                                    }`}
                                >
                                    📘 Theory Class {selectedBatchInfo.theoryCount > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full text-white">{selectedBatchInfo.theoryCount}</span>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleChange('classType', '2')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                                        filters.classType === '2'
                                            ? 'bg-amber-600 text-white shadow-md'
                                            : 'text-amber-400 hover:text-amber-300'
                                    }`}
                                >
                                    📝 Paper Class {selectedBatchInfo.paperCount > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full text-white">{selectedBatchInfo.paperCount}</span>}
                                </button>
                            </div>
                        </div>

                        {/* Dedicated Export Buttons for Theory & Paper Separately! */}
                        {canViewReports && onOpenExport && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenExport({ classType: '1' })}
                                    className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:-translate-y-0.5"
                                    title="Export Theory Class Payments Report (Excel/Image)"
                                >
                                    <Download size={13} /> Export Theory
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenExport({ classType: '2' })}
                                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:-translate-y-0.5"
                                    title="Export Paper Class Payments Report (Excel/Image)"
                                >
                                    <Download size={13} /> Export Paper
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Single Stream Indicators if not Both */}
                {selectedBatchInfo.isBatchSelected && !selectedBatchInfo.hasBoth && (
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs animate-in fade-in">
                        {selectedBatchInfo.hasTheory ? (
                            <>
                                <span className="font-bold text-sky-400 flex items-center gap-1.5">
                                    📘 Single Stream Batch: Theory Only ({selectedBatchInfo.theoryCount} payments)
                                </span>
                                {canViewReports && onOpenExport && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenExport({ classType: '1' })}
                                        className="px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 rounded-lg font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                                    >
                                        <Download size={12} /> Export Theory Report
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                                    📝 Single Stream Batch: Paper Only ({selectedBatchInfo.paperCount} payments)
                                </span>
                                {canViewReports && onOpenExport && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenExport({ classType: '2' })}
                                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                                    >
                                        <Download size={12} /> Export Paper Report
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <select 
                        value={filters.classType || 'All'} 
                        onChange={e => handleChange('classType', e.target.value)} 
                        className="w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm truncate"
                    >
                        <option value="All" className="bg-slate-900 text-white">All Class Types</option>
                        <option value="1" className="bg-slate-900 text-sky-400 font-bold">📘 Theory Class</option>
                        <option value="2" className="bg-slate-900 text-amber-400 font-bold">📝 Paper Class</option>
                    </select>

                    <select 
                        value={filters.groupId} 
                        onChange={e => handleChange('groupId', e.target.value)} 
                        className="w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm truncate"
                    >
                        <option value="All" className="bg-slate-900 text-white">All Groups</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                {g.name} {parseInt(g.classType || 1, 10) === 2 ? '📝 (Paper)' : '📘 (Theory)'}
                            </option>
                        ))}
                    </select>

                    <div className="relative" ref={dropdownRef}>
                        <div 
                            onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                            className="w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm flex justify-between items-center"
                        >
                            <span className="truncate">
                                {(!filters.subjectId || filters.subjectId === 'All' || filters.subjectId.length === 0)
                                    ? "All Subjects" 
                                    : `${filters.subjectId.length} Subject(s) Selected`}
                            </span>
                            <ChevronDown size={16} className={`transition-transform duration-200 ${isSubjectDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {isSubjectDropdownOpen && (
                            <div className="absolute z-50 top-full mt-2 w-full max-h-60 overflow-y-auto bg-slate-900 border border-white/10 rounded-xl shadow-xl p-2 flex flex-col gap-1 backdrop-blur-md">
                                <div 
                                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg cursor-pointer text-sm text-slate-200 font-medium transition-colors"
                                    onClick={() => {
                                        handleChange('subjectId', []);
                                        setIsSubjectDropdownOpen(false);
                                    }}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${(!filters.subjectId || filters.subjectId === 'All' || filters.subjectId.length === 0) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                        {(!filters.subjectId || filters.subjectId === 'All' || filters.subjectId.length === 0) && <Check size={12} className="text-white" />}
                                    </div>
                                    <span>All Subjects</span>
                                </div>
                                {subjects.map(s => {
                                    const isSelected = Array.isArray(filters.subjectId) 
                                        ? filters.subjectId.map(String).includes(String(s.id))
                                        : (filters.subjectId && filters.subjectId !== 'All' && String(filters.subjectId) === String(s.id));
                                    return (
                                        <div 
                                            key={s.id}
                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg cursor-pointer text-sm text-slate-200 font-medium transition-colors"
                                            onClick={() => {
                                                const current = Array.isArray(filters.subjectId) ? filters.subjectId : (filters.subjectId && filters.subjectId !== 'All' ? [filters.subjectId] : []);
                                                if (isSelected) {
                                                    handleChange('subjectId', current.filter(id => String(id) !== String(s.id)));
                                                } else {
                                                    handleChange('subjectId', [...current, s.id]);
                                                }
                                            }}
                                        >
                                            <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className="truncate">{s.name} ({s.code})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <select 
                        value={filters.method} 
                        onChange={e => handleChange('method', e.target.value)} 
                        className="w-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/60 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-brand-accent/50 cursor-pointer transition-all duration-200 shadow-sm truncate"
                    >
                        <option value="All" className="bg-slate-900 text-white">All Methods (Slip / Online)</option>
                        <option value="Slip" className="bg-slate-900 text-white">Slip Payments</option>
                        <option value="Online" className="bg-slate-900 text-white">Online Payments</option>
                    </select>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-inner transition-all duration-300 w-full">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={14}/> Date Range:</span>
                    
                    <input 
                        type="date" 
                        value={filters.dateFrom} 
                        onChange={e => handleChange('dateFrom', e.target.value)} 
                        className="bg-slate-900/60 dark:bg-slate-950/40 border border-white/10 focus:border-brand-accent/50 rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 outline-none transition-all duration-200 [color-scheme:dark] shadow-sm" 
                    />
                    
                    <span className="text-slate-500 font-bold">To</span>
                    
                    <input 
                        type="date" 
                        value={filters.dateTo} 
                        onChange={e => handleChange('dateTo', e.target.value)} 
                        className="bg-slate-900/60 dark:bg-slate-950/40 border border-white/10 focus:border-brand-accent/50 rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 outline-none transition-all duration-200 [color-scheme:dark] shadow-sm" 
                    />
                    
                    <button 
                        onClick={() => {handleChange('dateFrom', ''); handleChange('dateTo', '');}} 
                        className="text-xs font-extrabold text-rose-400 hover:text-rose-300 hover:scale-[1.03] transition-all duration-200 ml-auto bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-2 rounded-xl border border-rose-500/20 shadow-sm"
                    >
                        Clear Dates
                    </button>
                </div>
            </div>
        </div>
    );
}
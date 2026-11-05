import React, { useState } from 'react';
import { FaUserGraduate, FaSearch, FaKeyboard, FaCheckCircle, FaClock, FaChevronUp, FaChevronDown, FaChartPie, FaExclamationTriangle } from 'react-icons/fa';

export default function CampaignHeader({ stats, activeTab, setActiveTab, activePhase, setActivePhase, statusFilter, setStatusFilter, searchQuery, setSearchQuery, typingMode, setTypingMode, showOnlyDelayed, setShowOnlyDelayed, currentRoundDelayedCount }) {
    const [isStatsExpanded, setIsStatsExpanded] = useState(true);

    return (
        <div className="flex flex-col gap-5 shrink-0">
            
            {/* Header Title & Stats Toggle */}
            <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 p-2 rounded-lg">
                        <FaChartPie className="text-amber-500 text-xl" />
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Campaign Matrix</h2>
                </div>
                <button onClick={() => setIsStatsExpanded(!isStatsExpanded)} className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white bg-slate-900/50 px-4 py-2 rounded-xl transition-colors border border-slate-700">
                    {isStatsExpanded ? <><FaChevronUp /> Hide Details</> : <><FaChevronDown /> Show Details</>}
                </button>
            </div>

            {/* Collapsible Stats Section - Compact Design */}
            {isStatsExpanded && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-wrap lg:flex-nowrap gap-6 shadow-md animate-fade-in-up">
                    <div className="flex gap-8 border-r border-slate-700 pr-8">
                        <div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Assigned</p>
                            <p className="text-2xl font-black text-white">{stats.totalAssigned}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Covered</p>
                            <p className="text-2xl font-black text-amber-400">{stats.totalCovered}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Pending</p>
                            <p className="text-2xl font-black text-slate-300">{stats.totalPending}</p>
                        </div>
                    </div>

                    <div className="flex flex-1 items-center justify-around gap-4 px-4">
                        <div className="text-center">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Round 1</p>
                            <div className="flex gap-3 text-lg font-bold justify-center">
                                <span className="text-emerald-400 flex items-center gap-1.5" title="Covered"><FaCheckCircle size={14}/> {stats.r1Covered}</span>
                                <span className="text-amber-400 flex items-center gap-1.5" title="Pending"><FaClock size={14}/> {stats.r1Pending}</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-700"></div>
                        <div className="text-center">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Round 2</p>
                            <div className="flex gap-3 text-lg font-bold justify-center">
                                <span className="text-emerald-400 flex items-center gap-1.5" title="Covered"><FaCheckCircle size={14}/> {stats.r2Covered}</span>
                                <span className="text-amber-400 flex items-center gap-1.5" title="Pending"><FaClock size={14}/> {stats.r2Pending}</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-700"></div>
                        <div className="text-center">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Round 3</p>
                            <div className="flex gap-3 text-lg font-bold justify-center">
                                <span className="text-emerald-400 flex items-center gap-1.5" title="Covered"><FaCheckCircle size={14}/> {stats.r3Covered}</span>
                                <span className="text-amber-400 flex items-center gap-1.5" title="Pending"><FaClock size={14}/> {stats.r3Pending}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-l border-slate-700 pl-8 flex items-center">
                        <div>
                            <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5"><FaUserGraduate size={12}/> Enrolled (Paid)</p>
                            <p className="text-3xl font-black text-emerald-400 leading-none">{stats.enrolled} <span className="text-base text-emerald-500/70 font-bold">({stats.enrolledPercentage}%)</span></p>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls Bar (Tabs + Filters) */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-800/40 p-2 rounded-2xl border border-slate-700/50">
                
                {/* Tabs */}
                <div className="flex gap-2 w-full lg:w-auto p-1 bg-slate-900/50 rounded-xl overflow-x-auto">
                    <button onClick={() => setActiveTab('ROUND_1')} className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'ROUND_1' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                        Round 1 <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'ROUND_1' ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{stats.r1Total}</span>
                    </button>
                    <button onClick={() => setActiveTab('ROUND_2')} className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'ROUND_2' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                        Round 2 <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'ROUND_2' ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{stats.r2Total}</span>
                    </button>
                    <button onClick={() => setActiveTab('ROUND_3')} className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'ROUND_3' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                        Round 3 <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'ROUND_3' ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{stats.r3Total}</span>
                    </button>
                    
                    <div className="w-px bg-slate-700 mx-1 my-2"></div>

                    <button onClick={() => setActiveTab('ENROLLED')} className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'ENROLLED' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-500 hover:bg-emerald-500/10'}`}>
                        <FaUserGraduate size={14}/> Paid <span className="ml-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400">{stats.enrolled}</span>
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex gap-3 w-full lg:w-auto items-center pr-2">
                    {activeTab !== 'ENROLLED' && (
                        <>
                            <button 
                                onClick={() => setShowOnlyDelayed(!showOnlyDelayed)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2 ${showOnlyDelayed ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-sm' : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800'}`}
                            >
                                <FaExclamationTriangle size={14}/> {showOnlyDelayed ? 'View All' : 'Delayed'}
                                <span className={`px-2 py-0.5 rounded-md text-[10px] ${showOnlyDelayed ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                    {currentRoundDelayedCount || 0}
                                </span>
                            </button>
                            
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)} 
                                className="bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-slate-300 outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            >
                                <option value="ALL">All Status</option>
                                <option value="pending">⏳ Pending</option>
                                <option value="answered">✅ Answered</option>
                                <option value="no_answer">📵 No Answer</option>
                                <option value="reject">❌ Rejected</option>
                            </select>
                        </>
                    )}

                    <div className="relative flex-1 lg:w-56">
                        <FaSearch className="absolute left-3.5 top-3 text-slate-500 text-sm" />
                        <input 
                            type="text" 
                            placeholder="Search Name or Phone..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-all" 
                        />
                    </div>
                    
                    <div className="relative w-24 shrink-0">
                        <FaKeyboard className="absolute left-3 top-3 text-slate-500 text-sm" />
                        <select 
                            value={typingMode} 
                            onChange={(e) => setTypingMode(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-8 pr-2 text-xs font-bold uppercase tracking-wide text-slate-300 outline-none cursor-pointer focus:border-indigo-500 transition-all"
                        >
                            <option value="en">ENG</option>
                            <option value="si-phonetic">SIN</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
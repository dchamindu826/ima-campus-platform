import React from 'react';
import { FaUserGraduate, FaSearch, FaKeyboard, FaChartPie, FaPlus, FaTimes, FaFileExport, FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';

export default function CampaignHeader({ 
    stats, activeCoordinationRound, setActiveCoordinationRound, 
    customRounds, removeCustomRound, addCustomRound, 
    statusFilter, setStatusFilter, searchQuery, setSearchQuery, typingMode, setTypingMode, exportToExcel,
    showOnlyDelayed, setShowOnlyDelayed, currentRoundDelayedCount, setIsStatsOpen,
    activePhaseFilter, setActivePhaseFilter, setShowAddNumbersModal
}) {
    return (
        <div className="flex flex-col gap-4 shrink-0 mb-2">
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { id: 1, label: 'ROUND 1', color: 'indigo', icon: <FaSyncAlt/>, count: stats.r1Assign },
                        { id: 2, label: 'ROUND 2', color: 'amber', icon: <FaSyncAlt/>, count: stats.r2Assign },
                        { id: 3, label: 'NON ENROLLED', color: 'rose', icon: <FaSyncAlt/>, count: stats.r3Assign },
                        { id: 'ENROLLED', label: 'PAID', color: 'emerald', icon: <FaUserGraduate/>, count: stats.totalEnrolled }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveCoordinationRound(tab.id)}
                            className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 shadow-md ${
                                activeCoordinationRound === tab.id 
                                ? `bg-${tab.color}-600 border-${tab.color}-500 text-white shadow-[0_4px_20px_rgba(var(--tw-colors-${tab.color}-500),0.4)] scale-[1.02]` 
                                : 'bg-[#111827] border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            <span className={`flex items-center gap-2 text-xs md:text-sm font-black tracking-widest ${activeCoordinationRound === tab.id ? 'text-white' : ''}`}>
                                {tab.icon} {tab.label}
                            </span>
                            <span className={`text-base md:text-lg font-black bg-black/30 px-3 py-1 rounded-lg ${activeCoordinationRound === tab.id ? 'text-white' : `text-${tab.color}-400`}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                    {customRounds && customRounds.map(r => (
                        <div key={r.roundNum} className="flex items-center group bg-[#111827] rounded-xl border border-slate-800 h-[68px] overflow-hidden">
                            <button onClick={() => setActiveCoordinationRound(r.roundNum)} className={`flex-1 h-full text-xs font-bold uppercase tracking-wider transition-all px-4 ${activeCoordinationRound === r.roundNum ? 'bg-amber-600 text-white shadow-md' : 'text-amber-500 hover:bg-slate-800'}`}>
                                {r.name}
                            </button>
                            <button onClick={(e) => removeCustomRound(r.roundNum, e)} className="px-3 h-full text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all border-l border-slate-800"><FaTimes size={14}/></button>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-4">
                    <button onClick={() => setIsStatsOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform xl:w-48 shrink-0 h-full">
                        <FaChartPie size={18}/> View Stats
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-black/20 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shrink-0 shadow-sm mt-2">
                <div className="flex flex-wrap lg:flex-nowrap w-full lg:w-auto items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-sm" />
                        <input type="text" placeholder="Search Phone or Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors" />
                    </div>

                    <select value={typingMode} onChange={(e) => setTypingMode(e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-white outline-none cursor-pointer focus:border-indigo-500 w-24 shrink-0">
                        <option value="en" className="bg-slate-900 text-white">ENG</option>
                        <option value="si-phonetic" className="bg-slate-900 text-white">SIN</option>
                    </select>

                    {activeCoordinationRound !== 'ENROLLED' && (
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-white outline-none cursor-pointer focus:border-indigo-500">
                            <option value="ALL" className="bg-slate-900 text-white">All Status</option>
                            <option value="pending" className="bg-slate-900 text-white">⏳ Pending</option>
                            <option value="answered" className="bg-slate-900 text-white">✅ Answered</option>
                            <option value="no_answer" className="bg-slate-900 text-white">📵 No Answer</option>
                            <option value="reject" className="bg-slate-900 text-white">❌ Rejected</option>
                        </select>
                    )}

                    {activeCoordinationRound !== 'ENROLLED' && (
                        <button onClick={() => setShowOnlyDelayed(!showOnlyDelayed)} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2 ${showOnlyDelayed ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'}`}>
                            <FaExclamationTriangle size={14}/> Delayed
                        </button>
                    )}

                    <button onClick={exportToExcel} title="Export" className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-colors shadow-sm text-xs font-bold gap-2 ml-auto lg:ml-0">
                        <FaFileExport size={14} /> Export
                    </button>
                </div>

                {activeCoordinationRound !== 'ENROLLED' && (
                    <div className="flex gap-2 w-full lg:w-auto bg-slate-900/80 p-1.5 rounded-xl border border-slate-700">
                        {['ALL', 1, 2, 3].map(ph => (
                            <button key={ph} onClick={() => setActivePhaseFilter(ph)} className={`px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activePhaseFilter === ph ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                                {ph === 'ALL' ? 'All Phases' : `Phase ${ph}`}
                            </button>
                        ))}
                        {activeCoordinationRound > 3 && (
                            <button onClick={() => setShowAddNumbersModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 ml-2">
                                <FaPlus size={10}/> Add
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
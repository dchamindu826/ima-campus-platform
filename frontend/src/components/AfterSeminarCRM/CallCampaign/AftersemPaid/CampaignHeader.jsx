import React from 'react';
import { FaUserGraduate, FaSearch, FaSyncAlt, FaLayerGroup } from 'react-icons/fa';

export default function CampaignHeader({ 
    activeMainTab, setActiveMainTab, 
    activeRound, setActiveRound, 
    activePhase, setActivePhase,
    searchQuery, setSearchQuery,
    tabCounts,
    monthlyGroups,
    selectedGroupName,
    setSelectedGroupName,
    leadViewFilter,
    setLeadViewFilter,
    roundStats = { assigned: 0, covered: 0, pending: 0 }
}) {
    return (
        <div className="flex flex-col gap-4 shrink-0 mb-4">
            
            {/* MONTH FILTER SECTION */}
            {monthlyGroups && monthlyGroups.length > 0 && (
                <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 mb-2 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <FaLayerGroup size={18} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black tracking-wide text-white uppercase">Active Group Period</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Filter enrolled leads by payment month / intake group</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-amber-500 transition-colors w-full md:w-auto">
                                                <select 
                            value={selectedGroupName || ''} 
                            onChange={(e) => setSelectedGroupName(e.target.value)} 
                            className="bg-transparent border-none text-slate-200 text-sm font-bold rounded-lg px-4 py-2 outline-none cursor-pointer w-full md:w-auto appearance-none pr-8 relative"
                            style={{
                                backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 8px center',
                                backgroundSize: '18px'
                            }}
                        >
                            {monthlyGroups.map((group, idx) => (
                                <option key={idx} value={group.name} className="bg-slate-900 text-slate-200">
                                    📅 {group.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            
            {/* TOP MAIN TABS (Like ROUND 1, ROUND 2 in New Inq) */}
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { id: 'FULL', label: 'FULL PAYMENT', color: 'indigo', icon: <FaUserGraduate/> },
                        { id: 'MONTHLY', label: 'MONTHLY PLAN', color: 'amber', icon: <FaSyncAlt/> },
                        { id: 'INSTALLMENT', label: 'INSTALLMENTS', color: 'violet', icon: <FaLayerGroup/> },
                        { id: 'NON_ENROLLED', label: 'NON ENROLLED', color: 'rose', icon: <FaSyncAlt/> }
                    ].map(tab => {
                        const isActive = activeMainTab === tab.id;
                        const count = tabCounts[tab.id] || 0;
                        
                        return (
                            <button 
                                key={tab.id}
                                onClick={() => {
                                    setActiveMainTab(tab.id);
                                }}
                                className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 shadow-md ${
                                    isActive 
                                    ? `bg-${tab.color}-600 border-${tab.color}-500 text-white shadow-[0_4px_20px_rgba(var(--tw-colors-${tab.color}-500),0.4)] scale-[1.02]` 
                                    : 'bg-[#111827] border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className={`flex items-center gap-2 text-xs md:text-sm font-black tracking-widest ${isActive ? 'text-white' : ''}`}>
                                    {tab.icon} {tab.label}
                                </span>
                                <span className={`text-base md:text-lg font-black bg-black/30 px-3 py-1 rounded-lg ${isActive ? 'text-white' : `text-${tab.color}-400`}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-black/20 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shrink-0 shadow-sm mt-2 animate-fade-in">
                
                {/* LEFT: Search, Round dropdown and View filter toggles */}
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Search Box */}
                    <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                        <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-sm" />
                        <input 
                            type="text" 
                            placeholder="Search Phone or Name..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors" 
                        />
                    </div>

                    {/* Round Dropdown */}
                    <select 
                        value={activeRound}
                        onChange={(e) => setActiveRound(parseInt(e.target.value))}
                        className="bg-slate-900/80 border border-slate-700 rounded-xl py-2 px-3 text-xs font-bold uppercase tracking-wide text-white outline-none cursor-pointer focus:border-indigo-500 shrink-0"
                    >
                        <option value={1} className="bg-slate-900 text-white">ROUND 1</option>
                        <option value={2} className="bg-slate-900 text-white">ROUND 2</option>
                    </select>

                    {/* View Filter Toggles (Moved to the side!) */}
                    <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700 shrink-0">
                        <button 
                            onClick={() => setLeadViewFilter('PENDING')} 
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                                leadViewFilter === 'PENDING' 
                                ? 'bg-amber-600 text-white shadow-md font-extrabold' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            ⏳ PENDING
                        </button>
                        <button 
                            onClick={() => setLeadViewFilter('COVERED')} 
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                                leadViewFilter === 'COVERED' 
                                ? 'bg-emerald-600 text-white shadow-md font-extrabold' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            ✅ COVERED
                        </button>
                    </div>
                </div>

                {/* CENTER: Premium Stats Capsules for Selected Round/Phase */}
                <div className="flex items-center gap-4 bg-slate-900/60 px-4 py-2 rounded-xl border border-white/5 shadow-inner shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">Assigned</span>
                        <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{roundStats.assigned}</span>
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">Covered</span>
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{roundStats.covered}</span>
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400 font-extrabold tracking-wider uppercase">Pending</span>
                        <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{roundStats.pending}</span>
                    </div>
                </div>

                {/* RIGHT: PHASE TOGGLES */}
                <div className="flex gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700 shrink-0 w-full xl:w-auto justify-center">
                    {[1, 2, 3].map(ph => (
                        <button 
                            key={ph} 
                            onClick={() => setActivePhase(ph)} 
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                activePhase === ph 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            PHASE {ph}
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
}
import React, { useState, useMemo } from 'react';
import { 
  Users, CheckCircle2, PhoneMissed, XCircle, Clock, 
  BarChart3, LayoutGrid, Table as TableIcon, Search,
  ArrowUpRight, Download, Filter, PhoneCall, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const getLeadOutcomeCategory = (lead) => {
  if (!lead) return 'pending';

  const r2 = lead.roundProgress?.find(r => r.roundNum === 2);
  const r1 = lead.roundProgress?.find(r => r.roundNum === 1);
  const activeRound = r2 || r1 || (lead.roundProgress && lead.roundProgress[0]);

  const rawStatus = (
    activeRound?.callStatus || 
    lead.callStatus || 
    lead.openSemCallStatus || 
    lead.newInqCallStatus || 
    lead.callCenterStatus || 
    'pending'
  ).toString().toLowerCase().trim();

  // Answered / Connected
  if (
    ['answered', 'answer', 'completed', 'enrolled', 'interested', 'registered', 'registered_attended'].includes(rawStatus) ||
    lead.status === 'REGISTERED' ||
    (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED')) ||
    lead.enrollmentStatus === 'PAID'
  ) {
    return 'answered';
  }

  // Reject / Not Interested
  if (
    ['reject', 'rejected', 'not_interested', 'dropped', 'drop'].includes(rawStatus) ||
    lead.isDropped ||
    lead.status === 'DROPPED'
  ) {
    return 'reject';
  }

  // No Answer / Busy
  if (
    ['no_answer', 'no answer', 'busy', 'unreachable', 'not_connected'].includes(rawStatus)
  ) {
    return 'noAnswer';
  }

  return 'pending';
};

export const isCCAgent = (u) => {
  if (!u) return false;
  const role = String(u.role || '').toUpperCase().replace(/ /g, '_');
  const dept = String(u.department || '').toUpperCase().replace(/ /g, '_');

  // Must NOT be Class Coordination, Student, Admin, etc.
  if (dept.includes('CLASS_COORDINATION') || role.includes('CLASS_COORDINAT') || role.includes('STUDENT')) {
    return false;
  }

  return (
    ['CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].some(r => role.includes(r)) ||
    dept === 'CALL_CENTER' ||
    dept.includes('CALL_CENTER')
  );
};

export default function CoordinatorStatsBreakdown({ 
  leads = [], 
  staff = [],
  title = "Call Center Staff Performance Breakdown",
  subtitle = "Staff-wise call outcomes for assigned leads",
  onSelectAgent,
  campaignLabel = "Call Center",
  showAllStaff = false
}) {
  const [viewMode, setViewMode] = useState('table'); // default to 'table' as preferred by user
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('assigned'); // 'assigned' | 'answered' | 'rate' | 'name'

  // Helper: A lead is only considered assigned in Call Center if assigned to a verified CC Agent
  const isAssignedToCC = (l) => {
    if (!l.assignedTo) return false;
    const user = l.assignedUser || (Array.isArray(staff) ? staff.find(s => s.id === l.assignedTo) : null);
    return isCCAgent(user);
  };

  // 1. Compute summary stats
  const summary = useMemo(() => {
    const totalLeads = leads.length;
    // Strictly leads assigned to Call Center callers
    const assignedLeads = leads.filter(isAssignedToCC);
    // Needs assignment or unassigned
    const unassignedLeads = leads.filter(l => !isAssignedToCC(l));
    
    let answered = 0;
    let noAnswer = 0;
    let reject = 0;
    let pending = 0;

    assignedLeads.forEach(l => {
      const cat = getLeadOutcomeCategory(l);
      if (cat === 'answered') answered++;
      else if (cat === 'noAnswer') noAnswer++;
      else if (cat === 'reject') reject++;
      else pending++;
    });

    const covered = answered + noAnswer + reject;
    const responseRate = assignedLeads.length > 0 ? ((covered / assignedLeads.length) * 100).toFixed(1) : '0.0';
    const answerRate = assignedLeads.length > 0 ? ((answered / assignedLeads.length) * 100).toFixed(1) : '0.0';

    return {
      totalLeads,
      totalAssigned: assignedLeads.length,
      unassigned: unassignedLeads.length,
      answered,
      noAnswer,
      reject,
      pending,
      covered,
      responseRate,
      answerRate
    };
  }, [leads, staff]);

  // 2. Compute coordinator-wise breakdown
  const coordinatorStats = useMemo(() => {
    const map = {};

    // If showAllStaff is enabled, initialize only for verified Call Center staff
    if (showAllStaff && Array.isArray(staff)) {
      staff.filter(isCCAgent).forEach(s => {
        if (!s || !s.id) return;
        const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || `Caller #${s.id}`;
        map[s.id] = {
          id: s.id,
          name,
          phone: s.phone || '',
          role: s.role || 'Call Center Agent',
          assigned: 0,
          answered: 0,
          noAnswer: 0,
          reject: 0,
          pending: 0
        };
      });
    }

    leads.filter(isAssignedToCC).forEach(l => {
      const aId = l.assignedTo || l.assignedUser?.id;
      if (!aId) return;

      const user = l.assignedUser || (Array.isArray(staff) ? staff.find(s => s.id === aId) : null);
      if (!isCCAgent(user)) return; // Strictly ignore any non-CC agent!

      const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : `Agent #${aId}`;
      const phone = user?.phone || '';
      const role = user?.role || 'Call Center Agent';

      if (!map[aId]) {
        map[aId] = {
          id: aId,
          name: name || `Agent #${aId}`,
          phone: phone,
          role: role,
          assigned: 0,
          answered: 0,
          noAnswer: 0,
          reject: 0,
          pending: 0
        };
      }

      map[aId].assigned++;
      const cat = getLeadOutcomeCategory(l);
      map[aId][cat]++;
    });

    return Object.values(map).map(agent => {
      const dialed = agent.answered + agent.noAnswer + agent.reject;
      const progressPct = agent.assigned > 0 ? Math.round((dialed / agent.assigned) * 100) : 0;
      const answerPct = agent.assigned > 0 ? Math.round((agent.answered / agent.assigned) * 100) : 0;
      return {
        ...agent,
        dialed,
        progressPct,
        answerPct
      };
    });
  }, [leads]);

  // 3. Filter & Sort coordinators
  const filteredCoordinators = useMemo(() => {
    let list = [...coordinatorStats];

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'assigned') return b.assigned - a.assigned;
      if (sortBy === 'answered') return b.answered - a.answered;
      if (sortBy === 'rate') return b.progressPct - a.progressPct;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [coordinatorStats, searchQuery, sortBy]);

  // 4. Export breakdown to Excel
  const handleExportExcel = () => {
    if (coordinatorStats.length === 0) return;
    const dataToExport = coordinatorStats.map(c => ({
      "Coordinator / Agent Name": c.name,
      "Phone": c.phone || 'N/A',
      "Role": c.role,
      "Total Assigned": c.assigned,
      "Answered": c.answered,
      "No Answer": c.noAnswer,
      "Rejected": c.reject,
      "Pending Action": c.pending,
      "Dialing Progress (%)": `${c.progressPct}%`,
      "Answer Rate (%)": `${c.answerPct}%`
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coordinator_Breakdown");
    XLSX.writeFile(wb, `${campaignLabel}_Coordinator_Breakdown.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full">
      
      {/* ═══════════════ TOP EXECUTIVE KPI SUMMARY BAR ═══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Total In Scope */}
        <div className="bg-slate-900/80 border border-slate-700/80 p-4 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total in Scope</p>
          <h3 className="text-2xl sm:text-3xl font-black text-white">{summary.totalLeads}</h3>
          <span className="text-[10px] text-slate-500 font-bold block mt-1">All Filtered Leads</span>
        </div>

        {/* Assigned */}
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl shadow-lg shadow-blue-500/5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 mb-1">Total Assigned</p>
          <h3 className="text-2xl sm:text-3xl font-black text-blue-300">{summary.totalAssigned}</h3>
          <span className="text-[10px] text-blue-400/80 font-bold block mt-1">Under Callers</span>
        </div>

        {/* Needs Assignment */}
        <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-2xl shadow-lg shadow-purple-500/5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-1">Unassigned</p>
          <h3 className="text-2xl sm:text-3xl font-black text-purple-300">{summary.unassigned}</h3>
          <span className="text-[10px] text-purple-400/80 font-bold block mt-1">Needs Caller</span>
        </div>

        {/* Answered */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl shadow-lg shadow-emerald-500/5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
            <CheckCircle2 size={11} /> Answered
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-emerald-300">{summary.answered}</h3>
          <span className="text-[10px] text-emerald-400/80 font-bold block mt-1">{summary.answerRate}% Connect</span>
        </div>

        {/* No Answer */}
        <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl shadow-lg shadow-orange-500/5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-orange-400 mb-1 flex items-center gap-1">
            <PhoneMissed size={11} /> No Answer
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-orange-300">{summary.noAnswer}</h3>
          <span className="text-[10px] text-orange-400/80 font-bold block mt-1">Pending Next Call</span>
        </div>

        {/* Reject */}
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl shadow-lg shadow-rose-500/5 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-400 mb-1 flex items-center gap-1">
            <XCircle size={11} /> Reject
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-rose-300">{summary.reject}</h3>
          <span className="text-[10px] text-rose-400/80 font-bold block mt-1">Not Interested</span>
        </div>

        {/* Pending */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl shadow-lg shadow-amber-500/5 relative overflow-hidden backdrop-blur-md col-span-2 sm:col-span-1">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
            <Clock size={11} /> Pending
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-amber-300">{summary.pending}</h3>
          <span className="text-[10px] text-amber-400/80 font-bold block mt-1">Awaiting Dial</span>
        </div>
      </div>

      {/* ═══════════════ COORDINATOR PERFORMANCE SECTION ═══════════════ */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-5">
        
        {/* Section Header with Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/20">
                <Users size={16} />
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                {title}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {subtitle} • <span className="text-indigo-400 font-bold">{coordinatorStats.length} Call Center Callers</span> Handling Leads
            </p>
          </div>

          {/* Search, Sort, View Toggle & Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-44 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-red-500 font-medium placeholder:text-slate-500"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-red-500 font-bold cursor-pointer"
            >
              <option value="assigned">Sort: Most Assigned</option>
              <option value="answered">Sort: Most Answered</option>
              <option value="rate">Sort: Highest Coverage %</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="Table View"
              >
                <TableIcon size={15} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="Grid Cards View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={coordinatorStats.length === 0}
              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Export Report to Excel"
            >
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {/* ═══════════════ CARDS VIEW ═══════════════ */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCoordinators.map(c => {
              const donutRadius = 24;
              const donutCircumference = 2 * Math.PI * donutRadius;
              const completedRatio = Math.min(100, Math.max(0, c.progressPct)) / 100;
              const strokeOffset = donutCircumference - (completedRatio * donutCircumference);

              return (
                <div
                  key={c.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-red-500/40 p-4 rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Coordinator Details + Circular Dialing Gauge */}
                    <div className="flex items-center justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-red-300 transition-colors" title={c.name}>
                            {c.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono font-medium truncate">{c.phone || 'Caller'}</span>
                            <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              {c.role || 'Call Center'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Donut Progress Meter */}
                      <div className="relative w-13 h-13 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="26" cy="26" r={donutRadius} className="stroke-slate-800 fill-none" strokeWidth="4.5" />
                          <circle
                            cx="26"
                            cy="26"
                            r={donutRadius}
                            className="stroke-red-500 fill-none transition-all duration-700 ease-out"
                            strokeWidth="4.5"
                            strokeDasharray={donutCircumference}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-[10px] font-black text-white">{c.progressPct}%</span>
                      </div>
                    </div>

                    {/* 4 Outcome Metrics Grid */}
                    <div className="grid grid-cols-4 gap-1.5 bg-[#0a0f1d] p-2.5 rounded-xl border border-white/5 mb-3 text-center">
                      <div className="bg-blue-500/5 p-1.5 rounded-lg border border-blue-500/10">
                        <p className="text-[9px] font-bold text-blue-400 uppercase">Assigned</p>
                        <p className="text-xs sm:text-sm font-black text-blue-200 mt-0.5">{c.assigned}</p>
                      </div>
                      <div className="bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                        <p className="text-[9px] font-bold text-emerald-400 uppercase">Answer</p>
                        <p className="text-xs sm:text-sm font-black text-emerald-300 mt-0.5">{c.answered}</p>
                      </div>
                      <div className="bg-orange-500/5 p-1.5 rounded-lg border border-orange-500/10">
                        <p className="text-[9px] font-bold text-orange-400 uppercase">No Ans</p>
                        <p className="text-xs sm:text-sm font-black text-orange-300 mt-0.5">{c.noAnswer}</p>
                      </div>
                      <div className="bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10">
                        <p className="text-[9px] font-bold text-rose-400 uppercase">Reject</p>
                        <p className="text-xs sm:text-sm font-black text-rose-300 mt-0.5">{c.reject}</p>
                      </div>
                    </div>

                    {/* Multi-segment Progress Bar */}
                    <div className="w-full bg-slate-800/80 rounded-full h-2 flex overflow-hidden mb-3 border border-slate-700/50">
                      {c.assigned > 0 && (
                        <>
                          <div style={{ width: `${(c.answered / c.assigned) * 100}%` }} className="bg-emerald-500 h-full" title={`Answered: ${c.answered}`} />
                          <div style={{ width: `${(c.noAnswer / c.assigned) * 100}%` }} className="bg-orange-500 h-full" title={`No Answer: ${c.noAnswer}`} />
                          <div style={{ width: `${(c.reject / c.assigned) * 100}%` }} className="bg-rose-500 h-full" title={`Reject: ${c.reject}`} />
                          <div style={{ width: `${(c.pending / c.assigned) * 100}%` }} className="bg-amber-500/40 h-full" title={`Pending: ${c.pending}`} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80 text-slate-400">
                    <span className="flex items-center gap-1 font-bold">
                      <Clock size={12} className="text-amber-400" /> Pending: <b className="text-amber-300 font-mono">{c.pending}</b>
                    </span>
                    {onSelectAgent && (
                      <button
                        onClick={() => onSelectAgent(c)}
                        className="text-[10px] bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        View Leads <ArrowUpRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredCoordinators.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white/[0.02] rounded-2xl border border-dashed border-slate-800">
                <Users className="mx-auto mb-2 opacity-30 text-slate-400" size={36} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Call Center staff found in this scope</p>
                <p className="text-[11px] text-slate-500 mt-1">Try selecting a different batch or assign leads to coordinators first.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TABLE VIEW ═══════════════ */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-inner">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b1120] text-slate-400 uppercase font-black text-[11px] border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Call Center Caller</th>
                  <th className="px-4 py-3.5 text-center bg-blue-500/5 text-blue-400 border-l border-slate-800">Assigned</th>
                  <th className="px-4 py-3.5 text-center bg-emerald-500/5 text-emerald-400 border-l border-slate-800">Answered</th>
                  <th className="px-4 py-3.5 text-center bg-orange-500/5 text-orange-400 border-l border-slate-800">No Answer</th>
                  <th className="px-4 py-3.5 text-center bg-rose-500/5 text-rose-400 border-l border-slate-800">Reject</th>
                  <th className="px-4 py-3.5 text-center bg-amber-500/5 text-amber-400 border-l border-slate-800">Pending</th>
                  <th className="px-4 py-3.5 text-center border-l border-slate-800">Coverage</th>
                  {onSelectAgent && <th className="px-4 py-3.5 text-center border-l border-slate-800">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {filteredCoordinators.map((c, i) => (
                  <tr key={c.id || i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-bold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-xs text-white font-black shrink-0 shadow-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-slate-100">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.phone || c.role}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-black text-blue-300 bg-blue-500/5 border-l border-slate-800 text-sm">
                      {c.assigned}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-emerald-300 bg-emerald-500/5 border-l border-slate-800 text-sm">
                      {c.answered}
                      <span className="text-[10px] text-emerald-400/80 block font-normal">{c.answerPct}%</span>
                    </td>
                    <td className="px-4 py-3 text-center font-black text-orange-300 bg-orange-500/5 border-l border-slate-800 text-sm">
                      {c.noAnswer}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-rose-300 bg-rose-500/5 border-l border-slate-800 text-sm">
                      {c.reject}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-amber-300 bg-amber-500/5 border-l border-slate-800 text-sm">
                      {c.pending}
                    </td>
                    <td className="px-4 py-3 text-center border-l border-slate-800">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-black text-slate-200">{c.progressPct}%</span>
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div style={{ width: `${c.progressPct}%` }} className="bg-red-500 h-full rounded-full" />
                        </div>
                      </div>
                    </td>
                    {onSelectAgent && (
                      <td className="px-4 py-3 text-center border-l border-slate-800">
                        <button
                          onClick={() => onSelectAgent(c)}
                          className="text-[10px] bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                        >
                          View Leads
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {filteredCoordinators.length === 0 && (
                  <tr>
                    <td colSpan={onSelectAgent ? 8 : 7} className="text-center py-10 text-slate-500 font-bold">
                      No Call Center staff found in this view
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

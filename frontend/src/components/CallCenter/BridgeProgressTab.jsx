import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { 
  Repeat, Users, PhoneCall, CheckCircle, Clock, AlertCircle, 
  Search, Filter, BarChart3, TrendingUp, UserCheck, PhoneForwarded,
  Layers, ArrowUpRight, Loader2, Sparkles, Building2, Phone,
  ChevronRight, ArrowRight, User
} from 'lucide-react';
import { FaPhoneAlt, FaWhatsapp, FaUserTie } from 'react-icons/fa';

export default function BridgeProgressTab({ businesses = [] }) {
  const [selectedBusiness, setSelectedBusiness] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedCaller, setSelectedCaller] = useState('All');
  const [batches, setBatches] = useState([]);
  const [activeRound, setActiveRound] = useState(1);
  const [activePhase, setActivePhase] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({
    summary: {
      totalAssigned: 0,
      pending: 0,
      answered: 0,
      noAnswer: 0,
      reject: 0,
      enrolled: 0,
      covered: 0,
      responseRate: '0.0',
      progressPct: 0
    },
    agentStats: [],
    callCenterCallers: [],
    phaseStats: {
      1: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 },
      2: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 },
      3: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 }
    },
    businessesSummary: [],
    leads: []
  });

  // Pagination for leads table
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    fetchBridgeProgress();
  }, [selectedBusiness, selectedBatch, selectedCaller, activeRound]);

  useEffect(() => {
    if (selectedBusiness !== 'All' && selectedBusiness !== '') {
      fetchBatchesForBiz(selectedBusiness);
    } else {
      setBatches([]);
      setSelectedBatch('All');
    }
  }, [selectedBusiness]);

  const fetchBatchesForBiz = async (bizId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/admin/batches/${bizId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setBatches(Array.isArray(res.data) ? res.data : (res.data?.batches || []));
    } catch (e) {
      console.error("Failed to load batches", e);
    }
  };

  const fetchBridgeProgress = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/call-center/bridge-progress', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          businessId: selectedBusiness,
          batchId: selectedBatch,
          callerId: selectedCaller,
          round: activeRound
        }
      });
      setProgressData(res.data || {
        summary: {},
        agentStats: [],
        callCenterCallers: [],
        phaseStats: {},
        businessesSummary: [],
        leads: []
      });
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to fetch bridge progress:", error);
      toast.error("Failed to load bridge progress data");
    } finally {
      setLoading(false);
    }
  };

  const { summary = {}, agentStats = [], callCenterCallers = [], phaseStats = {}, businessesSummary = [], leads = [] } = progressData;

  // Filter leads for table
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Phase filter
      if (activePhase !== 'ALL' && l.phase !== parseInt(activePhase)) return false;

      // Status filter
      const st = (l.callStatus || 'pending').toUpperCase();
      if (statusFilter === 'PENDING' && !['PENDING', 'OPEN', 'NEW', ''].includes(st) && ['ANSWERED', 'ANSWER', 'REJECT', 'REJECTED', 'NO_ANSWER'].includes(st)) return false;
      if (statusFilter === 'ANSWERED' && !['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(st)) return false;
      if (statusFilter === 'NO_ANSWER' && st !== 'NO_ANSWER') return false;
      if (statusFilter === 'REJECT' && !['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(st)) return false;
      if (statusFilter === 'ENROLLED' && l.enrollmentStatus !== 'ENROLLED' && l.enrollmentStatus !== 'PAID' && !(l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))) return false;

      // Caller filter
      if (selectedCaller !== 'All' && l.assignedTo !== parseInt(selectedCaller)) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const name = (l.name || '').toLowerCase();
        const phone = (l.phone || '').toLowerCase();
        const caller = (l.assignedUserName || '').toLowerCase();
        const batch = (l.batchName || '').toLowerCase();
        const bizName = (l.businessName || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || caller.includes(q) || batch.includes(q) || bizName.includes(q);
      }

      return true;
    });
  }, [leads, activePhase, statusFilter, selectedCaller, searchQuery]);

  const paginatedLeads = useMemo(() => {
    return filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in space-y-4">
      {/* Header Filters & Round Switch */}
      <div className="bg-[#121a24] p-4 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col xl:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-600/30">
            <PhoneForwarded size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase tracking-wide">
                Handed Over Bridge Call Progress
              </h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-bold uppercase tracking-wider">
                Call Center Callers Only
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Tracking dialing progress for leads handed over by faculty & business coordinators to Call Center
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          {/* Round Toggle */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveRound(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeRound === 1 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Round 01
            </button>
            <button
              onClick={() => setActiveRound(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeRound === 2 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Round 02
            </button>
          </div>

          {/* Business Selector */}
          <div className="w-44 sm:w-52">
            <select
              value={selectedBusiness}
              onChange={(e) => {
                setSelectedBusiness(e.target.value);
                setSelectedBatch('All');
              }}
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="All">All Originating Businesses</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Batch Selector */}
          {selectedBusiness !== 'All' && batches.length > 0 && (
            <div className="w-40 sm:w-48">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="All">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Caller Selector */}
          <div className="w-40 sm:w-48">
            <select
              value={selectedCaller}
              onChange={(e) => setSelectedCaller(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="All">All CC Callers ({callCenterCallers.length})</option>
              {callCenterCallers.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchBridgeProgress}
            className="p-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-xl transition-all flex items-center justify-center shrink-0"
            title="Refresh Data"
          >
            <Repeat size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Originating Businesses Quick Filter Pills */}
      {businessesSummary.length > 0 && (
        <div className="bg-[#121a24]/80 p-3 rounded-2xl border border-slate-800/80 shadow-md flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pl-1">
            <Building2 size={14} className="text-indigo-400" /> Originating Businesses:
          </span>
          <button
            onClick={() => {
              setSelectedBusiness('All');
              setSelectedBatch('All');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedBusiness === 'All'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            All Handed Over
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedBusiness === 'All' ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-400'}`}>
              {summary.totalAssigned || 0}
            </span>
          </button>
          {businessesSummary.map(b => (
            <button
              key={b.id}
              onClick={() => {
                setSelectedBusiness(b.id.toString());
                setSelectedBatch('All');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedBusiness === b.id.toString()
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {b.name}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedBusiness === b.id.toString() ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-400'}`}>
                {b.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={38} />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Loading Handed Over Bridge Calls...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-5 pb-8">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Handed Over</p>
              <h3 className="text-2xl font-black text-white">{summary.totalAssigned || 0}</h3>
              <span className="text-[10px] text-blue-400 font-bold mt-1 block">Assigned to CC</span>
            </div>

            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Pending Calls</p>
              <h3 className="text-2xl font-black text-amber-300">{summary.pending || 0}</h3>
              <span className="text-[10px] text-slate-500 font-bold mt-1 block">Awaiting Dialing</span>
            </div>

            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Answered</p>
              <h3 className="text-2xl font-black text-emerald-300">{summary.answered || 0}</h3>
              <span className="text-[10px] text-emerald-500/80 font-bold mt-1 block">Connected Calls</span>
            </div>

            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">No Answer</p>
              <h3 className="text-2xl font-black text-orange-300">{summary.noAnswer || 0}</h3>
              <span className="text-[10px] text-orange-500/80 font-bold mt-1 block">Pending Phase 2/3</span>
            </div>

            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Rejected</p>
              <h3 className="text-2xl font-black text-rose-300">{summary.reject || 0}</h3>
              <span className="text-[10px] text-rose-500/80 font-bold mt-1 block">Not Interested</span>
            </div>

            <div className="bg-[#121a24] border border-slate-800 p-4 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1">Enrolled / Paid</p>
              <h3 className="text-2xl font-black text-teal-300">{summary.enrolled || 0}</h3>
              <span className="text-[10px] text-teal-500/80 font-bold mt-1 block">Conversions</span>
            </div>

            <div className="bg-[#121a24] border border-indigo-500/30 p-4 rounded-2xl shadow-lg relative overflow-hidden bg-gradient-to-br from-indigo-900/30 to-[#121a24]">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl pointer-events-none"></div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Response Rate</p>
              <h3 className="text-2xl font-black text-indigo-200">{summary.responseRate || '0.0'}%</h3>
              <span className="text-[10px] text-indigo-400/80 font-bold mt-1 block">{summary.progressPct || 0}% Completed</span>
            </div>
          </div>

          {/* Call Center Callers Dialing Progress Grid */}
          <div className="bg-[#121a24] p-5 rounded-3xl border border-slate-700/80 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" /> Call Center Agents Dialing Progress
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Performance breakdown for active Call Center callers handling handed over bridge calls
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedCaller !== 'All' && (
                  <button
                    onClick={() => setSelectedCaller('All')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-bold"
                  >
                    Show All Callers
                  </button>
                )}
                <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full font-bold">
                  {agentStats.length} Callers in View
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agentStats.map(agent => {
                const donutRadius = 26;
                const donutCircumference = 2 * Math.PI * donutRadius;
                const completedPct = Math.min(100, Math.max(0, agent.progressPct || 0)) / 100;
                const donutStrokeDashoffset = donutCircumference - (completedPct * donutCircumference);
                const isSelected = selectedCaller === agent.id.toString();

                return (
                  <div 
                    key={agent.id} 
                    className={`p-4 rounded-2xl shadow-md transition-all group flex flex-col justify-between border ${
                      isSelected 
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-indigo-500/20 ring-1 ring-indigo-500' 
                        : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
                            {agent.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                              {agent.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono font-medium">{agent.phone || 'Caller'}</span>
                              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-semibold">CC Agent</span>
                            </div>
                          </div>
                        </div>

                        {/* Circular Progress Meter */}
                        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full -rotate-90">
                            <circle cx="28" cy="28" r={donutRadius} className="stroke-slate-800 fill-none" strokeWidth="5" />
                            <circle 
                              cx="28" 
                              cy="28" 
                              r={donutRadius} 
                              className="stroke-indigo-500 fill-none transition-all duration-700 ease-out" 
                              strokeWidth="5" 
                              strokeDasharray={donutCircumference} 
                              strokeDashoffset={donutStrokeDashoffset} 
                              strokeLinecap="round" 
                            />
                          </svg>
                          <span className="absolute text-[10px] font-black text-white">{agent.progressPct}%</span>
                        </div>
                      </div>

                      {/* Stats grid: Workload, Answered, No Ans, Reject, Pending */}
                      <div className="grid grid-cols-5 gap-1 bg-black/40 p-2 rounded-xl border border-white/5 mb-3 text-center">
                        <div className="bg-blue-500/5 p-1 rounded-lg">
                          <p className="text-[8px] font-bold text-blue-400 uppercase">Assigned</p>
                          <p className="text-xs font-black text-blue-200 mt-0.5">{agent.totalAssigned}</p>
                        </div>
                        <div className="bg-emerald-500/5 p-1 rounded-lg">
                          <p className="text-[8px] font-bold text-emerald-400 uppercase">Answer</p>
                          <p className="text-xs font-black text-emerald-300 mt-0.5">{agent.answered}</p>
                        </div>
                        <div className="bg-orange-500/5 p-1 rounded-lg">
                          <p className="text-[8px] font-bold text-orange-400 uppercase">No Ans</p>
                          <p className="text-xs font-black text-orange-300 mt-0.5">{agent.noAnswer}</p>
                        </div>
                        <div className="bg-rose-500/5 p-1 rounded-lg">
                          <p className="text-[8px] font-bold text-rose-400 uppercase">Reject</p>
                          <p className="text-xs font-black text-rose-300 mt-0.5">{agent.reject || 0}</p>
                        </div>
                        <div className="bg-amber-500/5 p-1 rounded-lg">
                          <p className="text-[8px] font-bold text-amber-400 uppercase">Pending</p>
                          <p className="text-xs font-black text-amber-300 mt-0.5">{agent.pending}</p>
                        </div>
                      </div>

                      {/* Multi-segment Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-1.5 flex overflow-hidden mb-3 border border-white/5">
                        {agent.totalAssigned > 0 && (
                          <>
                            <div style={{ width: `${(agent.answered / agent.totalAssigned) * 100}%` }} className="bg-emerald-500 h-full" title={`Answered: ${agent.answered}`} />
                            <div style={{ width: `${(agent.noAnswer / agent.totalAssigned) * 100}%` }} className="bg-orange-500 h-full" title={`No Answer: ${agent.noAnswer}`} />
                            <div style={{ width: `${((agent.reject || 0) / agent.totalAssigned) * 100}%` }} className="bg-rose-500 h-full" title={`Reject: ${agent.reject || 0}`} />
                            <div style={{ width: `${(agent.pending / agent.totalAssigned) * 100}%` }} className="bg-amber-500/40 h-full" title={`Pending: ${agent.pending}`} />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5 text-slate-400">
                      <span>Response Rate: <b className="text-indigo-400">{agent.responseRate}%</b></span>
                      <div className="flex items-center gap-2">
                        <span>Enrolled: <b className="text-teal-400">{agent.enrolled}</b></span>
                        <button
                          onClick={() => {
                            if (selectedCaller === agent.id.toString()) {
                              setSelectedCaller('All');
                            } else {
                              setSelectedCaller(agent.id.toString());
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                            isSelected 
                              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' 
                              : 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Clear Filter' : 'Filter Leads'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {agentStats.length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-500 bg-white/[0.02] rounded-2xl border border-dashed border-slate-800">
                  <Users className="mx-auto mb-2 opacity-40 text-indigo-400" size={32} />
                  <p className="text-xs font-bold">No Call Center callers found for the selected filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Leads List Section with Search & Outcome Filters */}
          <div className="bg-[#121a24] rounded-3xl border border-slate-700/80 shadow-xl overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider mr-1">
                  <Filter size={14} className="text-indigo-400" /> Outcomes:
                </span>
                {['ALL', 'PENDING', 'ANSWERED', 'NO_ANSWER', 'REJECT', 'ENROLLED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'All Leads' : st}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search name, phone, caller, batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500 placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-white/10 rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#1e293b] uppercase text-[10px] text-slate-400 border-b border-slate-700 font-black tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Student Contact</th>
                    <th className="px-5 py-3.5">Originating Business & Batch</th>
                    <th className="px-5 py-3.5">Assigned CC Caller</th>
                    <th className="px-5 py-3.5 text-center">Round / Phase</th>
                    <th className="px-5 py-3.5 text-center">Outcome Status</th>
                    <th className="px-5 py-3.5">Remarks / Notes</th>
                    <th className="px-5 py-3.5">Last Dialed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {paginatedLeads.map(l => {
                    const st = (l.callStatus || 'pending').toUpperCase();
                    let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                    if (['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(st)) {
                      badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                    } else if (st === 'NO_ANSWER') {
                      badgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/30';
                    } else if (['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(st)) {
                      badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                    }

                    return (
                      <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">
                          <div>{l.name || 'Student Lead'}</div>
                          <span className="text-[11px] text-slate-400 font-mono font-medium">{l.phone}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            {l.businessName}
                          </div>
                          <span className="text-[10px] text-indigo-400 font-semibold pl-3 block">{l.batchName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                            <FaUserTie size={10} /> {l.assignedUserName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="font-mono font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            R{l.coordinationRound || 1} - P{l.phase || 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${badgeClass}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs truncate text-slate-300 font-medium">
                          {l.feedback || <span className="text-slate-600 italic">No remark added</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">
                          {l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('en-GB') : '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <AlertCircle className="mx-auto mb-2 opacity-30" size={32} />
                        No handed over bridge leads match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
              <span className="text-slate-400 font-bold">
                Showing {filteredLeads.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} Handed Over Leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 font-bold"
                >
                  Previous
                </button>
                <span className="text-slate-300 font-bold px-2">Page {currentPage} of {totalPages || 1}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

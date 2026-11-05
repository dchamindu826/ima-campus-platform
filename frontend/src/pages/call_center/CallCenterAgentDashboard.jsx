import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  PhoneCall, Loader, ChevronLeft, Calendar, Search,
  PhoneForwarded, Megaphone, Target, PieChart, Activity, Repeat,
  Filter, Clock, CheckCircle, UserMinus, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import LeadCallCard from '../../components/CallCenter/LeadCallCard';
import ChatArea from '../../components/CoordinatorCRM/ChatArea';
import RightSidePanel from '../../components/CoordinatorCRM/RightSidePanel';
import ContactSidebar from '../../components/CoordinatorCRM/ContactSidebar';
import { FaTimes } from 'react-icons/fa';

export default function CallCenterAgentDashboard() {
  const { tab } = useParams(); // 'overview', 'free-sem', 'after-sem'
  const navigate = useNavigate();
  
  // Views: 'buckets' (default for tab) | 'detail' (when a biz card is clicked)
  const [view, setView] = useState('buckets');
  
  // Overview Data (powers the business cards)
  const [overviewData, setOverviewData] = useState({ AFTER_SEMINAR: [], FREE_SEMINAR: [], BRIDGE: [] });
  const [loading, setLoading] = useState(true);

  // Detail View State
  const [selectedBiz, setSelectedBiz] = useState(null); // { id, name, campaignType }
  const [leads, setLeads] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chatModalLead, setChatModalLead] = useState(null);
  
  const [activeRound, setActiveRound] = useState(1);
  const [activePhase, setActivePhase] = useState(1);
  const [batchFilter, setBatchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    // If tab changes, reset to buckets view
    setView('buckets');
    setSelectedBiz(null);
  }, [tab]);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (view === 'detail' && selectedBiz) {
      fetchBusinessLeads();
    }
  }, [view, selectedBiz]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/agent-v2/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverviewData(response.data || { AFTER_SEMINAR: [], FREE_SEMINAR: [], BRIDGE: [] });
    } catch (error) {
      console.error("Overview fetch error", error);
      toast.error("Failed to load dashboard overview.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessLeads = async (keepCurrentPage = false) => {
    if (!keepCurrentPage) setDetailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/agent-v2/business-leads', {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          campaignType: selectedBiz.campaignType,
          businessId: selectedBiz.id
        }
      });
      setLeads(response.data || []);
      if (!keepCurrentPage) setCurrentPage(1); 
    } catch (error) {
      console.error("Leads fetch error", error);
      toast.error("Failed to load leads for this business.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveLead = async (leadId, roundNum, data) => {
    try {
      const token = localStorage.getItem('token');
      // Optimistic update so UI immediately reflects remarks and outcome
      setLeads(prevLeads => prevLeads.map(l => {
        if (l.id !== leadId) return l;
        if (roundNum === 2) {
          const existingRps = l.roundProgress || [];
          const r2Index = existingRps.findIndex(r => r.roundNum === 2);
          const updatedR2 = {
            roundNum: 2,
            phase: data.callOutcome === 'NO_ANSWER' ? Math.min(3, (l.roundData?.phase || 1) + 1) : (l.roundData?.phase || 1),
            callStatus: data.callOutcome || l.roundData?.callStatus,
            callMethod: data.callMethod || l.roundData?.callMethod,
            callAttempt: data.attempts || l.roundData?.callAttempt,
            feedback: data.feedback !== undefined ? data.feedback : l.roundData?.feedback
          };
          const newRps = r2Index >= 0 
            ? existingRps.map((r, i) => i === r2Index ? { ...r, ...updatedR2 } : r)
            : [...existingRps, updatedR2];
          return {
            ...l,
            feedback: data.feedback !== undefined ? data.feedback : l.feedback,
            callCenterStatus: ['ANSWERED', 'REJECT'].includes((data.callOutcome || '').toUpperCase()) ? 'completed' : l.callCenterStatus,
            roundProgress: newRps
          };
        } else {
          return {
            ...l,
            callStatus: data.callOutcome || l.callStatus,
            callMethod: data.callMethod || l.callMethod,
            callAttempt: data.attempts || l.callAttempt,
            feedback: data.feedback !== undefined ? data.feedback : l.feedback,
            phase: data.callOutcome === 'NO_ANSWER' ? Math.min(3, (l.phase || 1) + 1) : (l.phase || 1),
            callCenterStatus: ['ANSWERED', 'REJECT'].includes((data.callOutcome || '').toUpperCase()) ? 'completed' : l.callCenterStatus
          };
        }
      }));

      await axios.post('/call-center/agent-v2/update-progress', {
        leadId,
        roundNum,
        ...data
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Lead progress saved!");
      fetchBusinessLeads(true);
      fetchOverview(); // Refresh counts
    } catch (error) {
      console.error("Save lead error", error);
      toast.error("Failed to update lead.");
      fetchBusinessLeads(true);
    }
  };

  const handleOpenChat = (lead) => {
    setChatModalLead(lead);
  };

  // Helper to get active round data for a lead
  const getLeadRoundData = (l, round) => {
    if (round === 1) {
      return {
        phase: l.phase || 1,
        callStatus: l.callStatus || 'pending',
        callCenterStatus: l.callCenterStatus || 'pending',
        callMethod: l.callMethod || 'Direct Call',
        callAttempt: l.callAttempt || 1,
        feedback: l.feedback || ''
      };
    } else {
      const r2 = l.roundProgress?.find(rp => rp.roundNum === 2);
      if (!r2) return null; // Means this lead is not in Round 2
      return {
        phase: r2.phase || 1,
        callStatus: r2.callStatus || 'pending',
        callCenterStatus: r2.callStatus?.toUpperCase() === 'ANSWERED' || r2.callStatus?.toUpperCase() === 'REJECT' ? 'completed' : 'pending',
        callMethod: r2.callMethod || 'Direct Call',
        callAttempt: r2.callAttempt || 1,
        feedback: r2.feedback || l.feedback || '' // Carry over feedback if round 2 is empty
      };
    }
  };

  // Helper to determine if callStatus is Pending
  const isPendingCallStatus = (st) => {
    const s = (st || 'PENDING').toUpperCase();
    if (!s || s === 'PENDING' || s === 'NEW' || s === 'OPEN' || s === 'NOT_CALLED') return true;
    if (!['ANSWERED', 'ANSWER', 'REJECT', 'REJECTED', 'NO_ANSWER', 'CALL_AGAIN', 'FOLLOW_UP', 'NOT_INTERESTED', 'ENROLLED'].includes(s)) return true;
    return false;
  };

  // Compute filtered leads (Batch Filter + Search Query)
  const batchFilteredLeads = leads.filter(l => {
    if (batchFilter !== 'All' && l.batch?.id !== parseInt(batchFilter)) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const name = (l.name || l.studentName || '').toLowerCase();
      const phone = (l.phone || l.contactNumber || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    }
    return true;
  });
  
  // Leads for the current round
  const roundLeads = batchFilteredLeads.map(l => {
    const rData = getLeadRoundData(l, activeRound);
    if (!rData) return null;
    return { ...l, roundData: rData };
  }).filter(Boolean); // Remove leads that don't have this round

  const phaseLeadsAll = roundLeads.filter(l => l.roundData.phase === activePhase);
  
  // Dynamic outcome counts for current phase
  const countPending = phaseLeadsAll.filter(l => isPendingCallStatus(l.roundData.callStatus)).length;
  const countNoAnswer = phaseLeadsAll.filter(l => (l.roundData.callStatus || '').toUpperCase() === 'NO_ANSWER').length;
  const countAnswered = phaseLeadsAll.filter(l => ['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes((l.roundData.callStatus || '').toUpperCase())).length;
  const countReject = phaseLeadsAll.filter(l => ['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes((l.roundData.callStatus || '').toUpperCase())).length;
  const countPaid = phaseLeadsAll.filter(l => l.enrollmentStatus === 'ENROLLED' || l.roundData.enrollmentStatus === 'ENROLLED').length;

  const phaseLeads = phaseLeadsAll.filter(l => {
    const statusUpper = (l.roundData.callStatus || 'PENDING').toUpperCase();
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return isPendingCallStatus(l.roundData.callStatus);
    if (statusFilter === 'NO_ANSWER') return statusUpper === 'NO_ANSWER';
    if (statusFilter === 'ANSWERED') return ['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(statusUpper);
    if (statusFilter === 'REJECT') return ['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(statusUpper);
    if (statusFilter === 'PAID') return l.enrollmentStatus === 'ENROLLED' || l.roundData.enrollmentStatus === 'ENROLLED';
    return true;
  });

  const paginatedLeads = phaseLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(phaseLeads.length / ITEMS_PER_PAGE);

  // Stats for the active round
  const totalAssigned = roundLeads.length;
  const pending = roundLeads.filter(l => isPendingCallStatus(l.roundData.callStatus)).length;
  const noAnswer = roundLeads.filter(l => (l.roundData.callStatus || '').toUpperCase() === 'NO_ANSWER').length;
  const covered = roundLeads.filter(l => ['ANSWERED', 'REJECT', 'REJECTED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP', 'NOT_INTERESTED'].includes((l.roundData.callStatus || '').toUpperCase())).length;
  const responseRate = totalAssigned > 0 
    ? ((covered / totalAssigned) * 100).toFixed(1)
    : 0;

  // Auto-switch to phase with pending leads when leads load
  useEffect(() => {
    if (roundLeads.length > 0) {
      const firstPendingPhase = [1, 2, 3].find(ph => {
        return roundLeads.some(l => l.roundData.phase === ph && isPendingCallStatus(l.roundData.callStatus));
      });
      if (firstPendingPhase) {
        if (firstPendingPhase !== activePhase) setActivePhase(firstPendingPhase);
        setStatusFilter('PENDING');
      } else {
        // 0 uncalled pending leads -> default to 'ALL' so agent sees their leads!
        setStatusFilter('ALL');
      }
    }
  }, [leads, activeRound]);

  const handlePendingFilterClick = () => {
    setStatusFilter('PENDING');
    setCurrentPage(1);
    if (countPending === 0) {
      const targetPhase = [1, 2, 3].find(ph => roundLeads.some(l => l.roundData.phase === ph && isPendingCallStatus(l.roundData.callStatus)));
      if (targetPhase) {
        setActivePhase(targetPhase);
        toast.success(`Switched to Phase 0${targetPhase} with pending leads!`);
      }
    }
  };
  
  // Batches for the filter
  const uniqueBatches = [...new Set(leads.map(l => l.batch?.id).filter(Boolean))];

  const hasPendingInBatch = (bId) => {
    return leads.some(l => {
      if (l.batch?.id !== bId) return false;
      const rData = getLeadRoundData(l, activeRound);
      if (!rData) return false;
      return !['ANSWERED', 'REJECT', 'COMPLETED'].includes(rData.callStatus?.toUpperCase());
    });
  };

  const getImageUrl = (imageName) => {
    if (!imageName || imageName === 'default.png' || imageName === 'null') return null;
    const base = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : '';
    return `${base}/storage/icons/${imageName}`;
  };

  const renderBusinessCards = (items, campType) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.length === 0 ? (
        <div className="col-span-full py-10 bg-white/5 border border-white/5 rounded-3xl text-center text-slate-500 font-bold">
          No assignments available in this bucket.
        </div>
      ) : (
        items.map(item => (
          <div 
            key={item.business.id}
            onClick={() => {
              setSelectedBiz({ id: item.business.id, name: item.business.name, campaignType: campType });
              setView('detail');
            }}
            className="relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-3xl p-6 transition-all cursor-pointer group shadow-lg overflow-hidden"
          >
            {/* Pending Badge on Corner */}
            <div className="absolute top-0 right-0 bg-rose-500 text-white font-black text-xs px-3 py-1 rounded-bl-xl shadow-md">
              {item.pending} PENDING
            </div>
            
            <div className="flex justify-between items-start mb-4 mt-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform overflow-hidden">
                {item.business.logo ? (
                  <img src={getImageUrl(item.business.logo) || '/logo.png'} alt="logo" className="w-full h-full object-contain p-1" onError={(e) => { e.target.src = '/logo.png'; }} />
                ) : (
                  <Target size={24} />
                )}
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-200 mb-2 truncate">{item.business.name}</h3>
            <div className="w-full bg-[#0F172A] rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(item.completed / Math.max(item.totalAssigned, 1)) * 100}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-bold">
              <span>{item.completed} Covered</span>
              <span>{item.totalAssigned} Total Assigned</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const currentTab = tab || 'overview';

  return (
    <div className="p-0 text-slate-100 bg-transparent min-h-screen">
      {view === 'buckets' && (
        <div className="fade-in">
          <div className="mb-8 border-b border-white/5 pb-6">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 flex items-center gap-3 capitalize">
              {currentTab === 'overview' ? <PieChart className="text-emerald-400" /> : 
               currentTab === 'free-sem' ? <Megaphone className="text-blue-400" /> : 
               currentTab === 'bridge' ? <Repeat className="text-indigo-400" /> : 
               <Calendar className="text-purple-400" />} 
              {currentTab.replace('-', ' ')}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {currentTab === 'overview' ? "Global caller statistics" : "Select a business card to start dialing assigned leads."}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="animate-spin text-emerald-500 text-4xl" />
            </div>
          ) : (
            <>
              {currentTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Calculate Global Stats */}
                  {(() => {
                    const allItems = [...overviewData.FREE_SEMINAR, ...overviewData.AFTER_SEMINAR, ...(overviewData.BRIDGE || [])];
                    const tAssigned = allItems.reduce((acc, i) => acc + i.totalAssigned, 0);
                    const tPending = allItems.reduce((acc, i) => acc + i.pending, 0);
                    const tCovered = allItems.reduce((acc, i) => acc + i.completed, 0);
                    const tRate = tAssigned > 0 ? ((tCovered / tAssigned) * 100).toFixed(1) : 0;
                    return (
                      <>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Assigned</span>
                          <div className="text-4xl font-black text-white mt-2">{tAssigned}</div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl">
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Total Covered</span>
                          <div className="text-4xl font-black text-emerald-400 mt-2">{tCovered}</div>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl">
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Total Pending</span>
                          <div className="text-4xl font-black text-rose-400 mt-2">{tPending}</div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Avg Response Rate</span>
                          <div className="text-4xl font-black text-blue-400 mt-2">{tRate}%</div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
              {currentTab === 'free-sem' && renderBusinessCards(overviewData.FREE_SEMINAR, 'FREE_SEMINAR')}
              {currentTab === 'after-sem' && renderBusinessCards(overviewData.AFTER_SEMINAR, 'AFTER_SEMINAR')}
              {currentTab === 'bridge' && renderBusinessCards(overviewData.BRIDGE || [], 'BRIDGE')}
            </>
          )}
        </div>
      )}

      {view === 'detail' && selectedBiz && (
        <div className="fade-in">
          {/* Header & Back */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <button 
              onClick={() => setView('buckets')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-bold"
            >
              <ChevronLeft size={18} /> Back to {currentTab.replace('-', ' ')}
            </button>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md">
              <span className="text-xs font-bold text-slate-400">Campaign:</span>
              <span className="text-sm font-black text-emerald-400">{selectedBiz.campaignType.replace('_', ' ')}</span>
              <span className="text-slate-600">|</span>
              <span className="text-sm font-black text-white">{selectedBiz.name}</span>
            </div>
          </div>

          {/* Batch Filter & Rounds */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-6 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              
              {/* Rounds Buttons & Stats */}
              <div className="flex flex-col md:flex-row gap-6 items-center flex-1">
                {selectedBiz?.campaignType !== 'FREE_SEMINAR' && (
                  <div className="flex gap-2 bg-[#0F172A]/80 p-1.5 rounded-2xl">
                    <button 
                      onClick={() => { setActiveRound(1); setActivePhase(1); setCurrentPage(1); }}
                      className={`px-6 py-3 rounded-xl font-black uppercase tracking-wider transition-all ${activeRound === 1 ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      Round 01
                    </button>
                    <button 
                      onClick={() => { setActiveRound(2); setActivePhase(1); setCurrentPage(1); }}
                      className={`px-6 py-3 rounded-xl font-black uppercase tracking-wider transition-all ${activeRound === 2 ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      Round 02
                    </button>
                  </div>
                )}

                <div className="flex gap-4 items-center bg-[#0F172A]/80 p-3 px-6 rounded-3xl border border-white/10 shadow-inner">
                  <div className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs mr-2">Round Stats</div>
                  
                  <button 
                    onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${statusFilter === 'ALL' ? 'bg-white/15 ring-1 ring-white/30 text-white' : 'hover:bg-white/5 opacity-80'}`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Assigned</span>
                    <span className="text-xl font-black text-white">{totalAssigned}</span>
                  </button>
                  
                  <div className="w-px h-8 bg-white/10 mx-1"></div>
                  
                  <button 
                    onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); }}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${statusFilter === 'PENDING' ? 'bg-rose-500/25 ring-1 ring-rose-500/50 text-rose-300' : 'hover:bg-rose-500/10 opacity-80'}`}
                  >
                    <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-0.5">Pending</span>
                    <span className="text-xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{pending}</span>
                  </button>
                  
                  <div className="w-px h-8 bg-white/10 mx-1"></div>
                  
                  <button 
                    onClick={() => { setStatusFilter('NO_ANSWER'); setCurrentPage(1); }}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${statusFilter === 'NO_ANSWER' ? 'bg-orange-500/25 ring-1 ring-orange-500/50 text-orange-300' : 'hover:bg-orange-500/10 opacity-80'}`}
                  >
                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-0.5">No Answer</span>
                    <span className="text-xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{noAnswer}</span>
                  </button>
                  
                  <div className="w-px h-8 bg-white/10 mx-1"></div>
                  
                  <button 
                    onClick={() => { setStatusFilter('ANSWERED'); setCurrentPage(1); }}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all ${statusFilter === 'ANSWERED' ? 'bg-emerald-500/25 ring-1 ring-emerald-500/50 text-emerald-300' : 'hover:bg-emerald-500/10 opacity-80'}`}
                  >
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">Covered</span>
                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{covered}</span>
                  </button>
                  
                  <div className="w-px h-8 bg-white/10 mx-1"></div>
                  
                  <div className="flex flex-col items-center px-3 py-1.5">
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">Response</span>
                    <span className="text-xl font-black text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">{responseRate}%</span>
                  </div>
                </div>
              </div>

              {/* Search Bar & Batch Filter Container */}
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                {/* Search Bar */}
                <div className="min-w-[260px] flex-1 lg:flex-none">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Search Student / Phone</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search name or number..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-[#0F172A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-red-500 placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-white/10 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Filter */}
                <div className="min-w-[240px] flex-1 lg:flex-none">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Filter by Batch</label>
                  <div className="relative">
                    <select 
                      value={batchFilter}
                      onChange={(e) => { setBatchFilter(e.target.value); setCurrentPage(1); }}
                      className="w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500 appearance-none"
                    >
                      <option value="All">All Batches</option>
                      {uniqueBatches.map(bId => {
                        const bName = leads.find(l => l.batch?.id === bId)?.batch?.name;
                        const hasPending = hasPendingInBatch(bId);
                        return <option key={bId} value={bId}>{bName} {hasPending ? '🔴 (Pending)' : ''}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Outcome Filter Pills Bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-[#0F172A]/70 p-3 px-5 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1.5 shrink-0">
                <Filter size={14} className="text-emerald-400" /> Filter Outcome:
              </span>
              <button
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-200 text-slate-900 border-white shadow-md font-black'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                All ({phaseLeadsAll.length})
              </button>
              <button
                onClick={handlePendingFilterClick}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 font-black'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
                }`}
              >
                <Clock size={12}/> Pending ({countPending})
              </button>
              <button
                onClick={() => { setStatusFilter('NO_ANSWER'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                  statusFilter === 'NO_ANSWER'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/30 font-black'
                    : 'bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/20'
                }`}
              >
                <PhoneCall size={12}/> No Answer ({countNoAnswer})
              </button>
              <button
                onClick={() => { setStatusFilter('ANSWERED'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                  statusFilter === 'ANSWERED'
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30 font-black'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                }`}
              >
                <CheckCircle size={12}/> Answered / Follow up ({countAnswered})
              </button>
              <button
                onClick={() => { setStatusFilter('REJECT'); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                  statusFilter === 'REJECT'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30 font-black'
                    : 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20'
                }`}
              >
                <UserMinus size={12}/> Rejected ({countReject})
              </button>
              {countPaid > 0 && (
                <button
                  onClick={() => { setStatusFilter('PAID'); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    statusFilter === 'PAID'
                      ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/30 font-black'
                      : 'bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20'
                  }`}
                >
                  <Sparkles size={12}/> Paid ({countPaid})
                </button>
              )}
            </div>
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                className="text-xs text-slate-400 hover:text-white underline font-bold px-2 shrink-0"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="flex gap-6">
            {/* Left Sidebar for Phases */}
            <div className="w-28 shrink-0 flex flex-col gap-3">
              {[1, 2, 3].map(ph => {
                const phLeads = roundLeads.filter(l => l.roundData.phase === ph);
                const phPending = phLeads.filter(l => isPendingCallStatus(l.roundData.callStatus)).length;
                return (
                  <button
                    key={ph}
                    onClick={() => { setActivePhase(ph); setCurrentPage(1); setStatusFilter('ALL'); }}
                    className={`flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all relative overflow-hidden px-2 ${
                      activePhase === ph 
                        ? 'bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20 ring-2 ring-rose-400' 
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-70">Phase</span>
                    <span className="text-2xl font-black">0{ph}</span>
                    {phLeads.length > 0 && (
                      <div className="mt-1.5 flex flex-col items-center gap-1 w-full">
                        <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-300">{phLeads.length} leads</span>
                        {phPending > 0 ? (
                          <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black animate-pulse shadow-sm">
                            🔴 {phPending} Pending
                          </span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold">
                            ✓ Done
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Main Leads Grid */}
            <div className="flex-1">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader className="animate-spin text-emerald-500 text-4xl" />
                </div>
              ) : paginatedLeads.length === 0 ? (
                <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
                  <PhoneCall className="text-slate-600 mx-auto mb-4" size={48} />
                  <h3 className="text-xl font-bold text-slate-400">No Leads Found</h3>
                  <p className="text-slate-500 mt-2">There are no leads in Phase {activePhase} for Round {activeRound}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedLeads.map((lead, index) => (
                    <LeadCallCard 
                      key={`${lead.id}_r${activeRound}`} 
                      lead={lead} 
                      roundData={lead.roundData}
                      activeRound={activeRound}
                      index={(currentPage - 1) * ITEMS_PER_PAGE + index} 
                      onSave={handleSaveLead}
                      onOpenChat={handleOpenChat}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 font-bold text-sm">Page {currentPage} of {totalPages}</span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* POPUP CHAT MODAL */}
      {chatModalLead && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
          <div className="w-[98vw] max-w-[1600px] h-[95vh] md:h-[92vh] bg-[#0f172a] rounded-3xl flex flex-col border border-slate-700 shadow-2xl overflow-hidden relative">
            
            <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] p-4 flex justify-between items-center border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
                <h3 className="text-white font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                  Live CRM Chat <span className="text-blue-400 border-l border-slate-600 pl-2 ml-1">{chatModalLead.phone}</span>
                </h3>
              </div>
              <button onClick={() => {
                setChatModalLead(null);
                fetchOverview();
              }} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest border border-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <FaTimes /> Close Workspace
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
              <div className="hidden md:flex shrink-0 border-r border-slate-800 h-full overflow-hidden">
                <ContactSidebar 
                  activeMode="CALL_CAMPAIGN" 
                  selectedLead={chatModalLead} 
                  setSelectedLead={setChatModalLead}
                  filters={{ selectedBusiness: selectedBiz?.id, selectedBatch: batchFilter }}
                />
              </div>
              <ChatArea selectedLead={chatModalLead} />
              <div className="hidden lg:block h-full shrink-0 border-l border-slate-800">
                <RightSidePanel selectedLead={chatModalLead} activeMode="CALL_CAMPAIGN" selectedBusiness={selectedBiz?.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { Loader2, PhoneCall, CheckCircle2, AlertCircle, Award, ChevronDown, ChevronUp, Clock, UserCheck } from 'lucide-react';
import { FaSave, FaCommentDots, FaSearch, FaKeyboard, FaChartPie, FaPhoneAlt, FaWhatsapp, FaUserGraduate, FaCheckCircle, FaClock, FaTimes, FaChevronUp, FaChevronDown } from 'react-icons/fa';

export default function BridgeStaffExecution({ filters, setChatModalLead, externalSearch, onLeadsLoaded }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState({});
    
    // UI States
    const [searchQuery, setSearchQuery] = useState(externalSearch || '');
    const [activePhase, setActivePhase] = useState(1);
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, pending, answered, no_answer, reject
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 40; 
    const [typingMode, setTypingMode] = useState('en');

    const [sessionEnrolled, setSessionEnrolled] = useState({ total: 0, full: 0, monthly: 0, installment: 0 });
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

    const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;
    const rawRole = JSON.parse(localStorage.getItem('user'))?.role || '';

    useEffect(() => {
        if (externalSearch !== undefined) {
            setSearchQuery(externalSearch);
        }
    }, [externalSearch]);

    useEffect(() => {
        fetchBridgeCampaignLeads();
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    const fetchBridgeCampaignLeads = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/leads', {
                headers: { Authorization: `Bearer ${token}` }, 
                params: {
                    tab: 'ASSIGNED',
                    staffId: currentUserId,
                    loggedUserRole: rawRole,
                    businessId: filters?.selectedBusiness || '', 
                    batchId: filters?.selectedBatch || '',
                    source: 'bridge_transfer',
                    limit: 5000
                }
            });
            
            const activeLeads = (res.data.leads || []).filter(l => 
                l.source === 'bridge_transfer' && 
                (!(l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))
            );
            setLeads(activeLeads.map(l => ({ ...l, savedCallStatus: l.callStatus })));
            if (onLeadsLoaded) onLeadsLoaded(activeLeads.length);
            
            const loadedDrafts = {};
            activeLeads.forEach(l => {
                const savedDraft = localStorage.getItem(`draft_bridge_${l.id}`);
                if (savedDraft) loadedDrafts[l.id] = savedDraft;
            });
            setDrafts(loadedDrafts);
            setSessionEnrolled({ total: 0, full: 0, monthly: 0, installment: 0 });
        } catch (error) { 
            console.error("Failed to load bridge campaign leads:", error); 
            toast.error("Failed to load bridge campaign leads"); 
        }
        setLoading(false);
    };

    const handleUpdateLocalLead = (id, field, value) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handleSaveCallData = async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        const feedback = drafts[leadId] !== undefined ? drafts[leadId] : (lead.feedback || '');
        const targetStatus = lead.callStatus || 'pending';
        const targetAttempt = parseInt(lead.callAttempt || lead.attemptCount || 1);
        const targetMethod = lead.callMethod || 'direct';

        let targetPhase = lead.phase || 1;
        if (targetStatus === 'no_answer') {
            if (targetPhase === 1) targetPhase = 2;
            else if (targetPhase === 2) targetPhase = 3;
        }

        const loadToast = toast.loading("Saving call data...");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/leads/update-call', {
                leadId, 
                campaignContext: 'BRIDGE',
                method: targetMethod, 
                status: targetStatus,
                callStatus: targetStatus,
                callAttempt: targetAttempt,
                phase: targetPhase,
                feedback,
                coordinationRound: lead.coordinationRound || 1,
                paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED'
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Saved successfully!", { id: loadToast });
            
            if (lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_'))) {
                setSessionEnrolled(prev => ({
                    total: prev.total + 1,
                    full: lead.paymentIntention === 'FULL' ? prev.full + 1 : prev.full,
                    monthly: lead.paymentIntention === 'MONTHLY' ? prev.monthly + 1 : prev.monthly,
                    installment: lead.paymentIntention === 'INSTALLMENT' ? prev.installment + 1 : prev.installment
                }));
                setLeads(prev => prev.filter(l => l.id !== leadId));
            } else {
                setLeads(prev => prev.map(l => {
                    if (l.id === leadId) {
                        return { 
                            ...l, 
                            callStatus: targetStatus, 
                            savedCallStatus: targetStatus,
                            callAttempt: targetAttempt,
                            attemptCount: targetAttempt,
                            callMethod: targetMethod,
                            feedback: feedback, 
                            phase: targetPhase 
                        };
                    }
                    return l;
                }));
            }
            
            const newDrafts = { ...drafts };
            delete newDrafts[leadId];
            setDrafts(newDrafts);
            localStorage.removeItem(`draft_bridge_${leadId}`);
        } catch (error) { 
            console.error("Save error:", error);
            toast.error("Failed to save data.", { id: loadToast }); 
        }
    };

    // Phase counts calculation
    const p1Count = useMemo(() => leads.filter(l => (l.phase || 1) === 1).length, [leads]);
    const p2Count = useMemo(() => leads.filter(l => l.phase === 2).length, [leads]);
    const p3Count = useMemo(() => leads.filter(l => l.phase === 3).length, [leads]);

    const phaseFilteredLeads = useMemo(() => {
        return leads.filter(l => {
            const matchesPhase = (l.phase || 1) === activePhase;
            const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'pending' ? (!l.savedCallStatus || l.savedCallStatus === 'pending') : l.savedCallStatus === statusFilter);
            const matchesSearch = !searchQuery || l.phone.includes(searchQuery) || (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesPhase && matchesStatus && matchesSearch;
        });
    }, [leads, activePhase, statusFilter, searchQuery]);

    const sortedFilteredLeads = useMemo(() => {
        return [...phaseFilteredLeads].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }, [phaseFilteredLeads]);

    const totalPages = Math.ceil(sortedFilteredLeads.length / itemsPerPage);
    const paginatedLeads = useMemo(() => {
        return sortedFilteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [sortedFilteredLeads, currentPage, itemsPerPage]);

    const totalAssigned = leads.length + sessionEnrolled.total;
    const covered = leads.filter(l => l.callStatus && l.callStatus !== 'pending').length + sessionEnrolled.total;
    const pending = leads.filter(l => !l.callStatus || l.callStatus === 'pending').length;
    const responseRate = totalAssigned > 0 ? Math.round((covered / totalAssigned) * 100) : 0;

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] text-indigo-400 font-sans">
                <Loader2 className="animate-spin mb-4" size={36} />
                <span className="text-sm font-semibold tracking-wide text-slate-300">Loading Bridge Campaign Execution...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4 font-sans text-slate-200 transition-colors duration-300">
            
            {/* Header Title & Collapsible Stats Section */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
                            <FaChartPie className="text-indigo-400 text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                                Bridge Transfers Campaign
                                <span className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                                    {totalAssigned} Leads Assigned
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">Execution Workspace & Lead Management</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} 
                        className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 px-4 py-2.5 rounded-xl transition-all border border-slate-700 hover:border-slate-600 shadow-sm"
                    >
                        {isStatsCollapsed ? <><FaChevronDown size={12} /> Show Stats</> : <><FaChevronUp size={12} /> Hide Stats</>}
                    </button>
                </div>

                {!isStatsCollapsed && (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-wrap lg:flex-nowrap gap-6 shadow-md backdrop-blur-md animate-fade-in-up">
                        <div className="flex gap-8 border-r border-slate-700/80 pr-8">
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <PhoneCall size={12} className="text-indigo-400"/> Assigned
                                </p>
                                <p className="text-2xl font-black text-white">{totalAssigned}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <CheckCircle2 size={12} className="text-amber-400"/> Covered
                                </p>
                                <p className="text-2xl font-black text-amber-400">{covered}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <AlertCircle size={12} className="text-rose-400"/> Pending
                                </p>
                                <p className="text-2xl font-black text-slate-300">{pending}</p>
                            </div>
                        </div>

                        {/* Middle Phase / Completion Breakdown */}
                        <div className="flex flex-1 items-center justify-around gap-4 px-4">
                            <div className="text-center">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Phase 1</p>
                                <p className="text-lg font-black text-indigo-400">{p1Count}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-700"></div>
                            <div className="text-center">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Phase 2</p>
                                <p className="text-lg font-black text-purple-400">{p2Count}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-700"></div>
                            <div className="text-center">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Phase 3</p>
                                <p className="text-lg font-black text-pink-400">{p3Count}</p>
                            </div>
                        </div>

                        {/* Right Enrolled Stats */}
                        <div className="border-l border-slate-700/80 pl-8 flex items-center gap-6">
                            <div>
                                <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Award size={14} className="text-emerald-400"/> Enrolled (Paid)
                                </p>
                                <p className="text-2xl font-black text-emerald-400">{sessionEnrolled.total}</p>
                            </div>
                            <div className="flex flex-col gap-1 text-[11px] font-bold">
                                <span className="text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20">Full: {sessionEnrolled.full}</span>
                                <span className="text-blue-300 bg-blue-500/10 px-3 py-1 rounded-md border border-blue-500/20">Monthly: {sessionEnrolled.monthly}</span>
                                <span className="text-amber-300 bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/20">Install: {sessionEnrolled.installment}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Bar (Phase Tabs + Filters + Search) */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-800/40 p-2.5 rounded-2xl border border-slate-700/50 shrink-0">
                
                {/* Phase Selection Tabs */}
                <div className="flex gap-2 w-full lg:w-auto p-1 bg-slate-900/50 rounded-xl overflow-x-auto border border-slate-800">
                    <button 
                        onClick={() => { setActivePhase(1); setCurrentPage(1); }} 
                        className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activePhase === 1 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        Phase 1 <span className={`px-2 py-0.5 rounded text-[10px] ${activePhase === 1 ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{p1Count}</span>
                    </button>
                    <button 
                        onClick={() => { setActivePhase(2); setCurrentPage(1); }} 
                        className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activePhase === 2 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        Phase 2 <span className={`px-2 py-0.5 rounded text-[10px] ${activePhase === 2 ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{p2Count}</span>
                    </button>
                    <button 
                        onClick={() => { setActivePhase(3); setCurrentPage(1); }} 
                        className={`flex-shrink-0 px-6 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activePhase === 3 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        Phase 3 <span className={`px-2 py-0.5 rounded text-[10px] ${activePhase === 3 ? 'bg-black/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{p3Count}</span>
                    </button>
                </div>
                
                {/* Filters, Search & Typing Mode */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
                    
                    {/* Rate Bar */}
                    <div className="hidden sm:flex items-center gap-2.5 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-700/80">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rate: {responseRate}%</span>
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div style={{ width: `${responseRate}%` }} className="bg-indigo-500 h-full transition-all"></div>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <select 
                        value={statusFilter} 
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} 
                        className="bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-slate-300 outline-none cursor-pointer focus:border-indigo-500 transition-all"
                    >
                        <option value="ALL">All Status</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="answered">✅ Answered</option>
                        <option value="no_answer">📵 No Answer</option>
                        <option value="reject">❌ Rejected</option>
                    </select>

                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px] lg:w-60">
                        <FaSearch className="absolute left-3.5 top-3 text-slate-500 text-sm" />
                        <input 
                            type="text" 
                            placeholder="Search Name or Phone..." 
                            value={searchQuery} 
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium text-slate-200 outline-none focus:border-indigo-500 placeholder-slate-500 transition-all" 
                        />
                    </div>

                    {/* Language / Typing Mode */}
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

            {/* Leads List Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-10 pr-1">
                {paginatedLeads.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-20 text-slate-500 bg-slate-800/30 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-sm mt-4">
                        <CheckCircle2 size={48} className="mb-4 opacity-30 text-emerald-500" />
                        <h3 className="text-lg font-bold text-slate-400">No leads found in Phase {activePhase}</h3>
                        <p className="text-xs text-slate-500 mt-1">Try changing filters or searching with another keyword.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {paginatedLeads.map((lead, index) => {
                            const realIndex = (currentPage - 1) * itemsPerPage + index + 1;
                            const currentRemark = drafts[lead.id] !== undefined ? drafts[lead.id] : (lead.feedback || '');
                            const isPending = !lead.callStatus || lead.callStatus === 'pending';
                            
                            return (
                                <div 
                                    key={lead.id} 
                                    className={`bg-slate-800/80 backdrop-blur-md rounded-2xl transition-all duration-200 overflow-hidden border flex flex-col justify-between shadow-sm hover:shadow-md ${isPending ? 'border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.05)]' : 'border-slate-700 hover:border-slate-600'}`}
                                >
                                    {/* Card Header */}
                                    <div className="p-4 border-b border-slate-700/60 bg-slate-900/40">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isPending ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                                    {realIndex}
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold text-sm tracking-wide ${isPending ? 'text-rose-400' : 'text-slate-100'}`}>
                                                        {lead.phone ? lead.phone.split('_')[0] : 'No Phone'}
                                                    </h4>
                                                    <p className="text-xs font-medium text-slate-400 truncate max-w-[140px]">
                                                        {lead.name || 'Unknown Student'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="bg-slate-800 border border-slate-700 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                                    Phase {lead.phase || 1}
                                                </span>
                                                <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded border ${lead.callStatus === 'answered' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : lead.callStatus === 'no_answer' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : lead.callStatus === 'reject' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                    {lead.callStatus ? lead.callStatus.replace('_', ' ') : 'PENDING'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body Form */}
                                    <div className="p-4 flex flex-col gap-3 flex-1 bg-slate-900/20">
                                        
                                        {/* Status & Pay Plan Selectors */}
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Status</label>
                                                <select 
                                                    disabled 
                                                    value={lead.enrollmentStatus || 'NON_ENROLLED'} 
                                                    onChange={(e) => handleUpdateLocalLead(lead.id, 'enrollmentStatus', e.target.value)} 
                                                    className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none opacity-80 cursor-not-allowed"
                                                >
                                                    <option value="NON_ENROLLED">Non-Enrolled</option>
                                                    <option value="ENROLLED">Enrolled (Paid)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Pay Plan</label>
                                                <select 
                                                    value={lead.paymentIntention || 'NOT_DECIDED'} 
                                                    onChange={(e) => handleUpdateLocalLead(lead.id, 'paymentIntention', e.target.value)} 
                                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                                >
                                                    <option value="NOT_DECIDED">Not Decided</option>
                                                    <option value="FULL">Full</option>
                                                    <option value="MONTHLY">Monthly</option>
                                                    <option value="INSTALLMENT">Installment</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Method & Attempt Selectors */}
                                        <div className="flex gap-2.5">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Method</label>
                                                <select 
                                                    value={lead.callMethod || 'direct'} 
                                                    onChange={(e) => handleUpdateLocalLead(lead.id, 'callMethod', e.target.value)} 
                                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                                >
                                                    <option value="direct">Direct Call</option>
                                                    <option value="whatsapp">WhatsApp</option>
                                                    <option value="3cx">3CX</option>
                                                </select>
                                            </div>
                                            <div className="w-16 shrink-0">
                                                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Att.</label>
                                                <select 
                                                    value={lead.callAttempt || lead.attemptCount || 1} 
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        handleUpdateLocalLead(lead.id, 'callAttempt', val);
                                                        handleUpdateLocalLead(lead.id, 'attemptCount', val);
                                                    }} 
                                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-1 py-1.5 outline-none text-center focus:border-indigo-500 transition-colors cursor-pointer"
                                                >
                                                    {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Remarks Textarea */}
                                        <div className="flex-1 flex flex-col min-h-[75px]">
                                            <label className="text-[10px] font-bold text-slate-400 mb-1 flex justify-between items-center uppercase tracking-wider">
                                                Call Remarks
                                                {typingMode === 'si-phonetic' && <span className="text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px]">SIN</span>}
                                            </label>
                                            <textarea 
                                                value={currentRemark} 
                                                onChange={(e) => { 
                                                    setDrafts(prev => ({ ...prev, [lead.id]: e.target.value })); 
                                                    localStorage.setItem(`draft_bridge_${lead.id}`, e.target.value); 
                                                }} 
                                                placeholder="Type comprehensive feedback..." 
                                                className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none resize-none custom-scrollbar focus:border-indigo-500 transition-colors" 
                                            />
                                        </div>

                                        {/* Dual Call Buttons */}
                                        <div className="flex gap-2 w-full mt-1">
                                            <button 
                                                onClick={(e) => { e.preventDefault(); toast.error('Direct Calling via system ready soon', { icon: '📞' }); }} 
                                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all border border-blue-500/30"
                                            >
                                                <FaPhoneAlt size={11} /> Normal Call
                                            </button>

                                            {lead.waCallPermissionExpiry && new Date(lead.waCallPermissionExpiry) > new Date() ? (
                                                <button 
                                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg py-1.5 text-xs font-bold flex flex-col items-center justify-center shadow-md shadow-emerald-500/20 transition-all leading-none border border-emerald-500/30"
                                                >
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <FaWhatsapp size={13} /> WhatsApp Call
                                                    </div>
                                                    <span className="text-[8px] font-mono text-emerald-100 bg-black/20 px-1 py-0.5 rounded">
                                                        Ends: {Math.max(0, Math.ceil((new Date(lead.waCallPermissionExpiry) - new Date()) / (1000 * 60 * 60 * 24)))} Days
                                                    </span>
                                                </button>
                                            ) : null}
                                        </div>

                                        {/* Call Status & Action Footer */}
                                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-700/60">
                                            <select 
                                                onChange={(e) => handleUpdateLocalLead(lead.id, 'callStatus', e.target.value)} 
                                                value={lead.callStatus || 'pending'} 
                                                className={`w-full text-xs font-black uppercase tracking-wider rounded-lg px-2 py-2 outline-none border text-center transition-colors shadow-sm cursor-pointer ${isPending ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : lead.callStatus === 'answered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : lead.callStatus === 'no_answer' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : lead.callStatus === 'reject' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
                                            >
                                                <option className="bg-slate-900 text-slate-300" value="pending">⏳ PENDING</option>
                                                <option className="bg-slate-900 text-emerald-400" value="answered">✅ ANSWERED</option>
                                                <option className="bg-slate-900 text-amber-400" value="no_answer">📵 NO ANSWER</option>
                                                <option className="bg-slate-900 text-rose-400" value="reject">❌ REJECTED</option>
                                            </select>
                                            
                                            <div className="flex gap-2 w-full">
                                                <button 
                                                    onClick={() => handleSaveCallData(lead.id)} 
                                                    className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:scale-[1.02] outline-none"
                                                >
                                                    <FaSave size={13}/> SAVE
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); if (typeof setChatModalLead === 'function') setChatModalLead(lead); }} 
                                                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3.5 rounded-lg flex items-center justify-center relative transition-colors shadow-sm"
                                                >
                                                    <FaCommentDots size={15}/>
                                                    {(lead.unreadCount || 0) > 0 && (
                                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900"></span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-4 border-t border-slate-700/60 mt-auto shrink-0 transition-colors">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1} 
                        className="px-5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors outline-none"
                    >
                        Previous
                    </button>
                    <span className="text-xs font-bold text-slate-400 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-700">
                        Page <span className="text-white font-black">{currentPage}</span> of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages} 
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors shadow-md outline-none"
                    >
                        Next Page
                    </button>
                </div>
            )}
        </div>
    );
}
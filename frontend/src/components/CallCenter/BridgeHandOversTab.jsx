import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { Repeat, ChevronRight, Users, Loader2, Building2, UserCheck, PlayCircle, Phone, User, Calendar, CheckCircle2, Filter, BarChart3 } from 'lucide-react';
import { FaUserTie } from 'react-icons/fa';
import CoordinatorStatsBreakdown from './CoordinatorStatsBreakdown';

export default function BridgeHandOversTab({ staff = [] }) {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBizId, setSelectedBizId] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState('All');
    const [bridgeSubTab, setBridgeSubTab] = useState('breakdown'); // 'breakdown' | 'assignment'
    const [fetchedStaff, setFetchedStaff] = useState([]);
    
    const [checkedLeads, setCheckedLeads] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [bulkCount, setBulkCount] = useState('');

    useEffect(() => {
        fetchHandovers();
        fetchStaffList();
    }, []);

    const fetchStaffList = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/call-center/manager/staff', { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            if (Array.isArray(res.data) && res.data.length > 0) {
                setFetchedStaff(res.data);
            }
        } catch(e) {
            console.error("Failed to load staff in BridgeHandOversTab", e);
        }
    };

    const fetchHandovers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/bridge/call-center/handovers', { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setBusinesses(res.data.data || []);
        } catch (error) {
            console.error("Failed to load bridge handovers");
            toast.error("Failed to load bridge handovers");
        }
        setLoading(false);
    };

    const selectedBiz = React.useMemo(() => {
        if (!selectedBizId) return null;
        return businesses.find(b => b.businessId === selectedBizId) || null;
    }, [businesses, selectedBizId]);

    const detailedLeads = React.useMemo(() => {
        return selectedBiz?.leads || [];
    }, [selectedBiz]);

    const batches = React.useMemo(() => {
        const map = new Map();
        detailedLeads.forEach(l => {
            if (l.batch && l.batch.id) {
                map.set(l.batch.id, l.batch);
            }
        });
        return Array.from(map.values());
    }, [detailedLeads]);

    const batchFilteredLeads = React.useMemo(() => {
        if (selectedBatch === 'All') return detailedLeads;
        return detailedLeads.filter(l => l.batchId === parseInt(selectedBatch) || l.batch?.id === parseInt(selectedBatch));
    }, [detailedLeads, selectedBatch]);

    const availableAgents = React.useMemo(() => {
        const map = new Map();
        [...staff, ...fetchedStaff].forEach(s => {
            if (s && s.id && !map.has(s.id)) {
                map.set(s.id, s);
            }
        });
        return Array.from(map.values());
    }, [staff, fetchedStaff]);

    const handleBulkSelectTop = () => {
        const pendingLeadsList = detailedLeads.filter(l => l.callCenterStatus === 'pending_approval');
        const amt = parseInt(bulkCount);
        if (isNaN(amt) || amt <= 0) {
            setCheckedLeads(pendingLeadsList.map(l => l.id));
            toast.success(`Selected all ${pendingLeadsList.length} pending leads!`);
            return;
        }
        const leadsToSelect = pendingLeadsList.slice(0, amt).map(l => l.id);
        setCheckedLeads(leadsToSelect);
        toast.success(`Selected top ${leadsToSelect.length} pending leads!`);
    };

    const handleApproveAndAssign = async () => {
        if (checkedLeads.length === 0) return toast.error("Select leads first");
        if (!selectedAgent) return toast.error("Select an agent to assign");

        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/bridge/call-center/approve', {
                leadIds: checkedLeads,
                staffId: selectedAgent
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success(`Successfully approved and assigned ${checkedLeads.length} leads!`);
            setCheckedLeads([]);
            setSelectedAgent('');
            fetchHandovers();
        } catch (error) {
            toast.error("Failed to process handovers");
        }
        setIsProcessing(false);
    };

    const handleStartRoundTwo = async () => {
        if (!selectedBiz) return;
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/bridge/call-center/start-round-two', {
                businessId: selectedBiz.businessId
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Round 2 has been initialized for the assigned bridge leads!");
            fetchHandovers();
        } catch (error) {
            toast.error("Failed to start Round 2");
        }
        setIsProcessing(false);
    };

    const toggleLeadCheck = (leadId) => {
        setCheckedLeads(prev => prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]);
    };

    const handleSelectAll = (isPendingOnly = false) => {
        let targetLeads = detailedLeads;
        if (isPendingOnly) {
            targetLeads = detailedLeads.filter(l => l.callCenterStatus === 'pending_approval');
        }

        if (checkedLeads.length === targetLeads.length && targetLeads.length > 0) {
            setCheckedLeads([]);
        } else {
            setCheckedLeads(targetLeads.map(l => l.id));
        }
    };

    // Calculate sub stats
    const pendingApprovalCount = detailedLeads.filter(l => l.callCenterStatus === 'pending_approval').length;
    const assignedCount = detailedLeads.filter(l => l.callCenterStatus !== 'pending_approval' && l.assignedTo).length;

    if (loading && !selectedBiz) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="animate-spin mb-4 text-indigo-500" size={32} />
                <p className="font-bold uppercase tracking-widest text-sm">Loading Bridge Data...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in flex flex-col h-full space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-indigo-200 uppercase tracking-wider">
                    <Repeat className="text-indigo-400" />
                    Bridge Hand Overs
                </h2>
                {selectedBiz && (
                    <button 
                        onClick={() => { setSelectedBizId(null); setCheckedLeads([]); }}
                        className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors text-slate-200 flex items-center gap-2 border border-white/5"
                    >
                        <ChevronRight className="rotate-180" size={16}/> Back to Businesses
                    </button>
                )}
            </div>

            {!selectedBiz ? (
                // BUSINESS CARDS VIEW
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-8">
                    {businesses.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-500 bg-slate-800/30 rounded-3xl border border-slate-700/50 border-dashed">
                            <Repeat className="mx-auto mb-4 opacity-50" size={48} />
                            <h3 className="text-xl font-bold text-slate-300 mb-2">No Handovers Yet</h3>
                            <p className="text-sm">Coordinators have not handed over any bridge leads to the call center.</p>
                        </div>
                    ) : (
                        businesses.map((biz) => {
                            const pendingCount = biz.leads.filter(l => l.callCenterStatus === 'pending_approval').length;
                            const assignedCount = biz.leads.filter(l => l.callCenterStatus !== 'pending_approval' && l.assignedTo).length;
                            
                            return (
                                <div 
                                    key={biz.businessId}
                                    onClick={() => setSelectedBizId(biz.businessId)}
                                    className="group cursor-pointer bg-[#0f172a]/80 backdrop-blur-3xl border border-white/10 hover:border-indigo-500/50 p-8 rounded-[2rem] flex flex-col gap-6 transition-all duration-500 hover:-translate-y-2 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_16px_64px_0_rgba(99,102,241,0.2)] relative overflow-hidden"
                                >
                                    <div className="absolute -top-24 -right-24 w-64 h-64 blur-[80px] opacity-20 pointer-events-none rounded-full bg-indigo-500 transition-opacity duration-700 group-hover:opacity-50"></div>
                                    <div className="absolute -bottom-24 -left-24 w-64 h-64 blur-[80px] opacity-10 pointer-events-none rounded-full bg-purple-500 transition-opacity duration-700 group-hover:opacity-30"></div>
                                    
                                    <div className="flex items-start justify-between relative z-10">
                                        <div className="flex items-center gap-6">
                                            <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.2)] group-hover:scale-105 transition-transform duration-500">
                                                {biz.businessLogo && biz.businessLogo !== 'null' ? (
                                                    <img src={`${axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : ''}/storage/icons/${biz.businessLogo}`} alt="logo" className="w-16 h-16 object-contain" onError={(e) => e.target.style.display='none'} />
                                                ) : (
                                                    <Building2 className="text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" size={40} />
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 group-hover:to-indigo-300 transition-colors duration-500">{biz.businessName}</h3>
                                                <span className="text-sm font-bold uppercase tracking-widest text-indigo-400/80">Business Bridge Pool</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 mt-2 relative z-10">
                                        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Handovers</span>
                                            <span className="text-3xl font-black text-white">{biz.count}</span>
                                        </div>
                                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500/80 mb-1">Pending Approval</span>
                                            <span className="text-3xl font-black text-rose-400">{pendingCount}</span>
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 mb-1">Assigned Workload</span>
                                            <span className="text-3xl font-black text-emerald-400">{assignedCount}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-300 transition-colors relative z-10 group-hover:border-indigo-500/30">
                                        Manage Bridge Leads <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                // DETAILED LEADS VIEW
                <div className="flex-1 flex flex-col gap-6 animate-fade-in-up">
                    
                    {/* Top Switcher Bar: Business Name, Batch Filter & View Toggle */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-[#0f172a]/90 border border-slate-700/80 p-4 rounded-2xl gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <Building2 size={16} className="text-indigo-400" /> {selectedBiz.businessName}
                            </span>
                            {batches.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Filter size={14} className="text-indigo-400" />
                                    <select
                                        value={selectedBatch}
                                        onChange={(e) => { setSelectedBatch(e.target.value); setCheckedLeads([]); }}
                                        className="bg-[#1e293b] border border-slate-600 text-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="All">All Batches Overview</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700/80 gap-1 w-full sm:w-auto">
                            <button
                                onClick={() => setBridgeSubTab('breakdown')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                    bridgeSubTab === 'breakdown' 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <BarChart3 size={14} /> Coordinator Breakdown
                            </button>
                            <button
                                onClick={() => setBridgeSubTab('assignment')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                    bridgeSubTab === 'assignment' 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Users size={14} /> Assign & Leads Pool
                            </button>
                        </div>
                    </div>

                    {bridgeSubTab === 'breakdown' ? (
                        <div className="animate-fade-in pb-4">
                            <CoordinatorStatsBreakdown 
                                leads={batchFilteredLeads}
                                staff={availableAgents}
                                title="Bridge Caller Performance Breakdown"
                                subtitle={`Bridge staff breakdown for ${selectedBiz.businessName} • ${batches.find(b => b.id === parseInt(selectedBatch))?.name || 'All Batches'}`}
                                campaignLabel="Bridge"
                                onSelectAgent={(agent) => {
                                    setSelectedAgent(agent.id.toString());
                                    setBridgeSubTab('assignment');
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Top Action Bar */}
                            <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 border border-white/10 p-5 rounded-[24px] gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Handed Over</p>
                                        <p className="text-2xl font-black text-white">{batchFilteredLeads.length}</p>
                                    </div>
                                    <div className="w-px h-10 bg-white/10"></div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Pending Approval</p>
                                        <p className="text-2xl font-black text-rose-300">{batchFilteredLeads.filter(l => l.callCenterStatus === 'pending_approval').length}</p>
                                    </div>
                                    <div className="w-px h-10 bg-white/10"></div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Assigned Workload</p>
                                        <p className="text-2xl font-black text-emerald-300">{batchFilteredLeads.filter(l => l.callCenterStatus !== 'pending_approval' && l.assignedTo).length}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button 
                                        onClick={handleStartRoundTwo}
                                        disabled={isProcessing || assignedCount === 0}
                                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 transition-all border border-indigo-400/50 w-full md:w-auto justify-center"
                                    >
                                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                                        Start Round 2
                                    </button>
                                </div>
                            </div>

                    {/* Table and Assignment section */}
                    <div className="bg-black/40 border border-white/10 rounded-[24px] flex flex-col overflow-hidden flex-1 shadow-2xl">
                        
                        {/* Action Header */}
                        <div className="bg-white/5 p-4 border-b border-white/10 flex flex-col xl:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto">
                                <div className="text-xs font-black text-slate-200 bg-black/50 px-4 py-2.5 rounded-xl border border-white/10 shadow-inner">
                                    {checkedLeads.length} Selected
                                </div>
                                <button 
                                    onClick={() => handleSelectAll(true)}
                                    className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Select All Pending ({pendingApprovalCount})
                                </button>
                                {checkedLeads.length > 0 && (
                                    <button 
                                        onClick={() => setCheckedLeads([])}
                                        className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                    >
                                        Clear
                                    </button>
                                )}
                                <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-xl">
                                    <input 
                                        type="number" 
                                        placeholder="Amt" 
                                        value={bulkCount} 
                                        onChange={(e) => setBulkCount(e.target.value)}
                                        className="w-16 bg-transparent text-xs font-bold text-center text-white outline-none px-2 py-1"
                                        min="1"
                                        max={pendingApprovalCount}
                                    />
                                    <button 
                                        onClick={handleBulkSelectTop}
                                        className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all border border-white/10"
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full xl:w-auto">
                                <select 
                                    value={selectedAgent} 
                                    onChange={(e) => setSelectedAgent(e.target.value)}
                                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500 font-bold uppercase tracking-wider flex-1 xl:flex-none"
                                >
                                    <option value="">-- Choose Agent to Assign --</option>
                                    {availableAgents.map(member => (
                                        <option key={member.id} value={member.id}>{member.firstName} {member.lastName} ({member.role || 'Staff'})</option>
                                    ))}
                                </select>
                                <button 
                                    onClick={handleApproveAndAssign}
                                    disabled={checkedLeads.length === 0 || isProcessing || !selectedAgent}
                                    className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 shrink-0"
                                >
                                    Approve & Assign ({checkedLeads.length})
                                </button>
                            </div>
                        </div>

                        {/* Table View */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-slate-400 text-[11px] uppercase font-black tracking-widest sticky top-0 bg-[#0f172a]/95 backdrop-blur-xl z-10 border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-5 w-12 rounded-tl-xl">
                                            <input 
                                                type="checkbox" 
                                                checked={checkedLeads.length > 0 && checkedLeads.length === detailedLeads.length}
                                                onChange={() => handleSelectAll()}
                                                className="w-4 h-4 rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-6 py-5">Student Information</th>
                                        <th className="px-6 py-5">Handovers Status</th>
                                        <th className="px-6 py-5">Assigned Dialer</th>
                                        <th className="px-6 py-5 rounded-tr-xl">Round Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {detailedLeads.map(lead => {
                                        const isPending = lead.callCenterStatus === 'pending_approval';
                                        return (
                                            <tr key={lead.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                                                <td className="px-6 py-4">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={checkedLeads.includes(lead.id)}
                                                        onChange={() => toggleLeadCheck(lead.id)}
                                                        className="w-4 h-4 rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 shrink-0 shadow-inner group-hover:border-indigo-500/30 transition-colors">
                                                            <User size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-100 text-[15px] group-hover:text-indigo-300 transition-colors">
                                                                {lead.name || 'Unknown Student'}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold tracking-wide mt-1">
                                                                <Phone size={12} className="text-indigo-400/70" /> 
                                                                <span className="bg-slate-800/50 px-2 py-0.5 rounded text-indigo-200/90 border border-slate-700/50">{lead.phone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isPending ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[inset_0_0_10px_rgba(244,63,94,0.1)]">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                                                            Pending Approval
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">
                                                            <CheckCircle2 size={12} />
                                                            Approved
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {lead.assignedUser ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-black shadow-lg shadow-indigo-500/20">
                                                                {lead.assignedUser.firstName.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-slate-200 text-sm">
                                                                {lead.assignedUser.firstName} {lead.assignedUser.lastName}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                            <Users size={12} /> Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 bg-indigo-900/30 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-black text-indigo-300 shadow-sm">
                                                        <Repeat size={12} className="text-indigo-400" />
                                                        Round {lead.coordinationRound || 1}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {detailedLeads.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                                No leads found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  </>
                )}
              </div>
            )}
        </div>
    );
}

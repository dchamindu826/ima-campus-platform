import React, { useState, useEffect } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { Users, Loader2, ArrowRight, PhoneForwarded } from 'lucide-react';
import { FaCheckCircle, FaUserTie, FaSearch, FaFileExcel, FaCalendarAlt } from 'react-icons/fa';
import BusinessBadge from '../../common/BusinessBadge';

export default function BridgeTransfersTab({ filters, allBatches }) {
    const [pendingLeads, setPendingLeads] = useState([]);
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [pushing, setPushing] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [bulkAmount, setBulkAmount] = useState(''); 

    const [coordinators, setCoordinators] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');

    const [loadingStats, setLoadingStats] = useState(true);
    
    // Date Range States
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [bridgeStats, setBridgeStats] = useState({
        totalTransferred: 0, totalContacted: 0, totalPending: 0, totalEnrolled: 0, totalReplied: 0, staffBreakdown: []
    });

    useEffect(() => {
        if (filters?.selectedBusiness) {
            fetchBridgeData();
            fetchCoordinators();
        } else {
            setPendingLeads([]);
            setBridgeStats({ totalTransferred: 0, totalContacted: 0, totalPending: 0, totalEnrolled: 0, staffBreakdown: [] });
            setLoadingStats(false);
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch, startDate, endDate]);

    const fetchCoordinators = async () => {
        try {
            const token = localStorage.getItem('token');
            const [staffRes, bizRes] = await Promise.all([
                axios.get('/admin/staff', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
            ]);
            
            let staffList = (staffRes.data || []).filter(s => 
                s?.role && ['COORDINATOR', 'CALLER', 'STAFF', 'MANAGER', 'ASS MANAGER', 'CALL CENTER AGENT'].includes(s.role.toUpperCase())
            );
            
            // Filter by selected business
            if (filters?.selectedBusiness) {
                const selectedBizId = String(filters.selectedBusiness).trim();
                const selectedBizObj = (bizRes.data || []).find(b => String(b.id) === selectedBizId);
                let selectedBizName = selectedBizObj ? selectedBizObj.name.toLowerCase().trim() : '';

                if (!selectedBizName && allBatches && allBatches.length > 0) {
                    const batchWithBiz = allBatches.find(b => String(b.business?.id) === selectedBizId);
                    if (batchWithBiz && batchWithBiz.business) {
                        selectedBizName = batchWithBiz.business.name.toLowerCase().trim();
                    }
                }
                
                staffList = staffList.filter(s => {
                    if (!s.businessType) return false;
                    const cBizList = String(s.businessType).toLowerCase().split(',').map(b => b.trim());
                    return cBizList.includes(selectedBizId.toLowerCase()) || 
                           (selectedBizName && cBizList.some(biz => biz.includes(selectedBizName) || selectedBizName.includes(biz))) ||
                           String(s.businessId) === selectedBizId;
                });
            }
            
            setCoordinators(staffList);
        } catch (e) { console.error("Failed to load staff", e); }
    };

    const fetchBridgeData = async () => {
        if (!filters?.selectedBusiness) return;

        setLoadingStats(true);
        const token = localStorage.getItem('token');
        try {
            const params = { 
                businessId: filters.selectedBusiness, 
                batchId: filters.selectedBatch || 'ALL',
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };

            const pendingRes = await axios.get('/after-seminar-crm/bridge/pending', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setPendingLeads(pendingRes.data.leads || []);
            setSelectedLeads([]);

            const statsRes = await axios.get('/after-seminar-crm/stats/bridge', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            if (statsRes.data) setBridgeStats(statsRes.data);
        } catch (error) { 
            toast.error("Error loading Bridge Analytics"); 
            setBridgeStats({ totalTransferred: 0, totalContacted: 0, totalPending: 0, totalEnrolled: 0, staffBreakdown: [] });
        }
        setLoadingStats(false);
    };

    const handleDailyClick = () => {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
    };

    const filteredLeads = pendingLeads.filter(l => 
        l.phone.includes(searchQuery) || (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleBulkSelect = () => {
        const amount = parseInt(bulkAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid number");
            return;
        }
        if (amount > filteredLeads.length) {
            toast.error(`Only ${filteredLeads.length} leads available to select.`);
            setSelectedLeads(filteredLeads.map(l => l.id));
        } else {
            const leadsToSelect = filteredLeads.slice(0, amount).map(l => l.id);
            setSelectedLeads(leadsToSelect);
            toast.success(`Selected top ${amount} leads!`);
        }
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) setSelectedLeads([]);
        else setSelectedLeads(filteredLeads.map(l => l.id));
    };

    const toggleLead = (id) => {
        if (selectedLeads.includes(id)) setSelectedLeads(selectedLeads.filter(l => l !== id));
        else setSelectedLeads([...selectedLeads, id]);
    };

    const handlePushToCampaign = async (isHandover = false) => {
        if (selectedLeads.length === 0) return toast.error("Select leads to transfer.");
        if (!isHandover && !selectedStaff) return toast.error("Please select a coordinator to assign leads.");
        
        setPushing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/bridge/push', {
                leadIds: selectedLeads,
                businessId: filters.selectedBusiness,
                batchId: filters.selectedBatch,
                staffId: isHandover ? null : selectedStaff,
                handoverToCallCenter: isHandover
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            if (isHandover) {
                toast.success(`Handed over ${selectedLeads.length} leads to the Call Center!`);
            } else {
                toast.success(`Successfully pushed & assigned ${selectedLeads.length} leads!`);
            }
            
            setBulkAmount('');
            setSelectedStaff('');
            fetchBridgeData(); 
        } catch (error) { toast.error("Failed to transfer leads"); }
        setPushing(false);
    };

    const handleExportSelected = () => {
        if (selectedLeads.length === 0) return toast.error("No leads selected to export.");

        const leadsToExport = filteredLeads.filter(l => selectedLeads.includes(l.id));
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student Name,Phone Number,Status\n"; 

        leadsToExport.forEach(row => {
            const name = row.name ? row.name.replace(/,/g, '') : 'Unknown';
            const phone = row.phone || '';
            const status = row.status || 'NEW';
            csvContent += `${name},${phone},${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Bridge_Leads_BIZ_${filters.selectedBusiness}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success("Successfully exported selected leads!");
    };

    if (!filters?.selectedBusiness) {
        return (
            <div className="flex flex-col justify-center items-center h-[500px] text-slate-500 font-sans tracking-wide animate-fade-in-up">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-xl backdrop-blur-xl">
                    <ArrowRight size={40} className="text-slate-600 opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-slate-300">Workspace Pending</h2>
                <p className="mt-2 text-sm">Please select a Business Campaign to access the Bridge Transfer Hub.</p>
            </div>
        );
    }

    const conversionRate = bridgeStats.totalTransferred > 0 ? Math.round((bridgeStats.totalEnrolled / bridgeStats.totalTransferred) * 100) : 0;
    const unassignedCount = bridgeStats.totalTransferred - bridgeStats.staffBreakdown.reduce((sum, s) => sum + s.assigned, 0);

    return (
        <div className="space-y-8 font-sans text-slate-200 animate-fade-in-up">
            
            {/* Header & Date Filters - Premium Glassmorphism */}
            <div className="flex flex-col xl:flex-row justify-between items-center bg-white/5 backdrop-blur-2xl p-5 rounded-[24px] border border-white/10 shadow-2xl gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 z-10">
                    <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                        <ArrowRight size={22} className="rotate-[-45deg]"/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Bridge Transfer Hub</h2>
                        <p className="text-[11px] text-indigo-200 font-bold uppercase tracking-[0.2em] mt-0.5 opacity-80">Free Seminar to After Seminar</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap bg-black/20 p-2 rounded-2xl border border-white/5 z-10">
                    <button 
                        onClick={handleDailyClick}
                        className="px-5 py-2.5 bg-white/10 hover:bg-indigo-500/20 hover:text-indigo-300 text-white border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        Today
                    </button>

                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1 rounded-xl">
                        <input 
                            type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                            className="bg-transparent text-slate-300 text-[11px] font-bold outline-none px-3 py-1 cursor-pointer"
                            style={{colorScheme: 'dark'}}
                        />
                        <span className="text-slate-500 text-[10px] font-black uppercase">to</span>
                        <input 
                            type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} 
                            className="bg-transparent text-slate-300 text-[11px] font-bold outline-none px-3 py-1 cursor-pointer"
                            style={{colorScheme: 'dark'}}
                        />
                    </div>

                    {(startDate || endDate) && (
                        <button 
                            onClick={handleClearDates}
                            className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                {[
                    { label: 'Pending in Free', value: pendingLeads.length, color: 'text-slate-100', bg: 'bg-white/5 border-white/10', glow: '' },
                    { label: 'Total Transferred', value: bridgeStats.totalTransferred, color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/20', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]' },
                    { label: 'Un-Assigned', value: unassignedCount, color: 'text-indigo-400', bg: 'bg-indigo-500/5 border-indigo-500/20', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.1)]' },
                    { label: 'Student Replies', value: bridgeStats.totalReplied || 0, color: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/20', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30 relative overflow-hidden' },
                    { label: 'Pending Calls', value: bridgeStats.totalPending, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/20', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.1)]' },
                    { label: 'Total Enrolled', value: bridgeStats.totalEnrolled, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]', extra: `(${conversionRate}% Rate)` }
                ].map((stat, idx) => (
                    <div key={idx} className={`p-6 rounded-[20px] backdrop-blur-md border ${stat.bg} ${stat.glow} flex flex-col justify-center transition-transform hover:scale-[1.02] duration-300`}>
                        {idx === 3 && <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/20 rounded-full blur-xl animate-pulse pointer-events-none"></div>}
                        <p className={`text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 ${stat.color} relative z-10`}>{stat.label}</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <h2 className={`text-3xl font-black ${stat.color}`}>{stat.value}</h2>
                            {stat.extra && <span className={`text-[10px] font-bold uppercase tracking-wider ${stat.color} opacity-70`}>{stat.extra}</span>}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* LEFT: TRANSFER WORKSPACE */}
                <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col relative h-[650px]">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                    
                    <div className="p-6 border-b border-white/5 bg-white/[0.02] relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-wide">
                                    <Users className="text-indigo-400" size={20} /> Transfer Workspace
                                </h3>
                                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">Select and push leads to execution phase</p>
                            </div>
                            <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl text-xs font-black shadow-inner">
                                {selectedLeads.length} Selected
                            </div>
                        </div>

                        {/* Search & Bulk */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <FaSearch className="absolute left-4 top-3.5 text-slate-400 text-sm" />
                                <input type="text" placeholder="Search by phone or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-indigo-500 shadow-inner transition-all placeholder:text-slate-600" />
                            </div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Amt" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} className="w-20 bg-black/40 border border-white/10 rounded-2xl py-3 px-3 text-xs font-bold text-center text-white outline-none focus:border-indigo-500 shadow-inner" min="1" max={filteredLeads.length} />
                                <button onClick={handleBulkSelect} className="bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest px-4 rounded-2xl transition-all border border-white/10 shadow-sm">Select</button>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-hidden relative z-10">
                        {loadingStats ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className="animate-spin mb-4 text-indigo-500" size={32}/> 
                                <p className="text-xs font-bold uppercase tracking-widest">Loading Transfer Pool...</p>
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-emerald-500/60 p-10 text-center">
                                <FaCheckCircle size={48} className="mb-4 opacity-50 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                                <p className="text-sm font-black uppercase tracking-widest">Pool Empty</p>
                                <p className="text-[10px] mt-2 opacity-80 uppercase tracking-widest">No pending leads matching criteria</p>
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto custom-scrollbar p-3">
                                <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-y-2">
                                    <thead className="text-slate-400 text-[10px] uppercase font-black tracking-widest sticky top-0 bg-transparent z-20">
                                        <tr>
                                            <th className="px-4 py-2 w-10">
                                                <input type="checkbox" checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                                            </th>
                                            <th className="px-4 py-2">Lead details</th>
                                            <th className="px-4 py-2 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.map((l) => (
                                            <tr key={l.id} className={`transition-all duration-200 cursor-pointer group ${selectedLeads.includes(l.id) ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] hover:bg-white/[0.05] border-transparent'}`} onClick={() => toggleLead(l.id)}>
                                                <td className="px-4 py-4 rounded-l-2xl border-y border-l border-inherit">
                                                    <input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={() => {}} className="w-4 h-4 rounded cursor-pointer accent-indigo-500 pointer-events-none" />
                                                </td>
                                                <td className="px-4 py-4 border-y border-inherit">
                                                    <h4 className="font-black text-white text-sm tracking-wide">{l.name || 'Unknown'}</h4>
                                                    <p className="font-mono text-slate-400 text-[11px] mt-1">{l.phone}</p>
                                                </td>
                                                <td className="px-4 py-4 text-right rounded-r-2xl border-y border-r border-inherit">
                                                    <span className="px-3 py-1.5 bg-black/40 text-slate-300 text-[9px] font-black rounded-lg uppercase tracking-widest border border-white/5 shadow-inner">
                                                        {l.status || 'NEW'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Action Area */}
                    <div className="p-5 border-t border-white/5 bg-white/[0.02] backdrop-blur-3xl z-20 shrink-0">
                        <div className="flex flex-col gap-4">
                            {/* Coordinator Assignment */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select 
                                    value={selectedStaff} 
                                    onChange={(e) => setSelectedStaff(e.target.value)}
                                    className="bg-black/50 text-[11px] font-black uppercase tracking-widest text-slate-300 border border-white/10 rounded-2xl px-4 py-3.5 outline-none focus:border-indigo-500 flex-1 shadow-inner cursor-pointer"
                                >
                                    <option value="">-- Select Coordinator --</option>
                                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                                </select>
                                <button 
                                    onClick={() => handlePushToCampaign(false)} 
                                    disabled={selectedLeads.length === 0 || pushing || !selectedStaff}
                                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border border-indigo-400/50"
                                >
                                    {pushing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                    Transfer & Assign
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="h-px bg-white/10 flex-1"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">OR</span>
                                <div className="h-px bg-white/10 flex-1"></div>
                            </div>

                            {/* Call Center Handover */}
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handlePushToCampaign(true)} 
                                    disabled={selectedLeads.length === 0 || pushing}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500/30 group"
                                >
                                    <PhoneForwarded size={16} className="group-hover:-rotate-12 transition-transform" />
                                    Hand Over to Call Center
                                </button>
                                {selectedLeads.length > 0 && (
                                    <button 
                                        onClick={handleExportSelected} 
                                        className="flex items-center justify-center gap-2 px-4 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all"
                                        title="Export CSV"
                                    >
                                        <FaFileExcel size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: STAFF PERFORMANCE */}
                <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-2xl flex flex-col h-[650px] overflow-hidden relative">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="p-6 border-b border-white/5 bg-white/[0.02] relative z-10 shrink-0">
                        <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-wide">
                            <FaUserTie className="text-blue-400" size={18} /> Staff Performance Matrix
                        </h3>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">Analytics for bridge leads assignment</p>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative z-10">
                        <div className="space-y-6">
                            {bridgeStats.staffBreakdown.length === 0 ? (
                                <div className="text-center py-20 text-slate-500 font-bold text-sm uppercase tracking-widest">No leads assigned yet.</div>
                            ) : (
                                (() => {
                                    const callCenterRoles = ['Call Center Agent', 'CALLER'];
                                    const callCenterStaff = bridgeStats.staffBreakdown.filter(s => callCenterRoles.includes(s.role));
                                    const coordinatorStaff = bridgeStats.staffBreakdown.filter(s => !callCenterRoles.includes(s.role));

                                    const renderStaffCard = (staff, idx) => {
                                        const rate = staff.assigned > 0 ? Math.round((staff.enrolled / staff.assigned) * 100) : 0;
                                        const isHigh = rate > 50;
                                        const isMid = rate > 20 && rate <= 50;
                                        
                                        return (
                                            <div key={idx} className="bg-black/30 border border-white/5 p-5 rounded-[20px] hover:border-white/10 transition-all group shadow-sm mb-4">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-black shadow-inner">
                                                            {staff.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-white text-sm tracking-wide">{staff.name}</h4>
                                                            <BusinessBadge businessType={staff.businessType} role={staff.role} />
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${isHigh ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isMid ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                            {rate}% Success
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-3">
                                                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Assigned</p>
                                                        <p className="font-mono text-sm font-bold text-slate-300">{staff.assigned}</p>
                                                    </div>
                                                    <div className="bg-blue-500/5 rounded-xl p-3 text-center border border-blue-500/10">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-500/70 mb-1">Covered</p>
                                                        <p className="font-mono text-sm font-bold text-blue-400">{staff.contacted}</p>
                                                    </div>
                                                    <div className="bg-rose-500/5 rounded-xl p-3 text-center border border-rose-500/10">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-rose-500/70 mb-1">Pending</p>
                                                        <p className="font-mono text-sm font-bold text-rose-400">{staff.pending}</p>
                                                    </div>
                                                    <div className="bg-emerald-500/5 rounded-xl p-3 text-center border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80 mb-1">Enrolled</p>
                                                        <p className="font-mono text-sm font-bold text-emerald-400">{staff.enrolled}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <>
                                            {coordinatorStaff.length > 0 && (
                                                <div className="mb-6">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-white/10 pb-2">Coordinators</h4>
                                                    {coordinatorStaff.map((staff, idx) => renderStaffCard(staff, `coord-${idx}`))}
                                                </div>
                                            )}
                                            {callCenterStaff.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 border-b border-blue-500/20 pb-2">Call Center Agents</h4>
                                                    {callCenterStaff.map((staff, idx) => renderStaffCard(staff, `caller-${idx}`))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
import React, { useEffect, useState, useMemo } from 'react';
import axios from '../../api/axios';
import { BarChart2, MessageCircle, PhoneCall, Users, Percent, Download, Clock, Plus, Upload, Megaphone, Search, AlertCircle, CheckCircle, Trash2, UserPlus, Lock, User, Phone, RefreshCw, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCall } from '../../contexts/CallContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid , PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

export default function ManagerCampaignStats({ filters }) {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const rawRole = user.role || '';
    const userRole = rawRole.toUpperCase().replace(/ /g, '_');
    
    const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
    const isManager = ['MANAGER', 'ASS_MANAGER'].includes(userRole);

    const { socket } = useCall();

    const [data, setData] = useState({ summary: {}, report: [], msgReport: [] });
    const [allLeads, setAllLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState('CALLS');
    const [phase, setPhase] = useState('All');
    const [timeFilter, setTimeFilter] = useState('all');
    
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [templates, setTemplates] = useState([]);
    const [tplForm, setTplForm] = useState({ name: '', category: 'MARKETING', headerType: 'NONE', headerText: '', bodyText: '', footerText: '' });
    const [tplFile, setTplFile] = useState(null);
    const [tplButtons, setTplButtons] = useState([]); 

    const [searchQuery, setSearchQuery] = useState('');
    const [bcastType, setBcastType] = useState('24H'); 
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [bcastMessage, setBcastMessage] = useState('');
    const [bcastTemplate, setBcastTemplate] = useState('');
    const [bcastFile, setBcastFile] = useState(null);
    const [bcastResults, setBcastResults] = useState(null);

    const [handoverPage, setHandoverPage] = useState(1);
    const [handoverSearch, setHandoverSearch] = useState('');
    const [handoverStatusFilter, setHandoverStatusFilter] = useState('ALL');
    const [handoverStaffFilter, setHandoverStaffFilter] = useState('ALL');
    const [checkedHandoverLeads, setCheckedHandoverLeads] = useState([]);
    const [handoverBulkCount, setHandoverBulkCount] = useState('');
    const [handoverSelectedLeads, setHandoverSelectedLeads] = useState([]);
    const HANDOVER_ITEMS_PER_PAGE = 50;
    
    const [sendingBcast, setSendingBcast] = useState(false);
    const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0 });

    const [teamMembers, setTeamMembers] = useState([]);
    const [teamForm, setTeamForm] = useState({ firstName: '', lastName: '', phone: '', password: '' });
    const [teamLoading, setTeamLoading] = useState(false);

    useEffect(() => { 
        fetchStats(); 
        fetchAllLeads();
        fetchTeam(); 
        if (activeTab === 'TEMPLATES') fetchTemplates();
    }, [filters?.selectedBusiness, filters?.selectedBatch, phase, timeFilter, startDate, endDate, activeTab]); 

    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => {
            fetchStats();
            fetchAllLeads();
        };
        socket.on('call_history_updated', handleUpdate);
        return () => socket.off('call_history_updated', handleUpdate);
    }, [socket, filters?.selectedBusiness, filters?.selectedBatch, phase, timeFilter, startDate, endDate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            let start = timeFilter === 'today' ? new Date().setHours(0,0,0,0) : timeFilter === 'all' ? new Date('2020-01-01').toISOString() : new Date(startDate).toISOString();
            let end = timeFilter === 'today' ? new Date().setHours(23,59,59,999) : timeFilter === 'all' ? new Date('2030-01-01').toISOString() : new Date(endDate).toISOString();

            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            const targetBatchId = filters?.selectedBatch || user.batchId;

            const token = localStorage.getItem('token');
            const res = await axios.get('/coordinator-crm/campaign-stats', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: targetBusinessId, batchId: targetBatchId, phase, startDate: start, endDate: end }
            });
            setData(res.data);
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    const fetchAllLeads = async () => {
        try { 
            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            const targetBatchId = filters?.selectedBatch || user.batchId;
            const token = localStorage.getItem('token');
            const res = await axios.get('/coordinator-crm/all-leads', { 
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: targetBusinessId, batchId: targetBatchId }
            }); 
            setAllLeads(Array.isArray(res.data) ? res.data : (res.data?.data || [])); 
        } catch(e) {}
    };

    const fetchTemplates = async () => {
        try { 
            const targetBusinessId = filters?.selectedBusiness || user.businessId || "";
            const targetBatchId = filters?.selectedBatch || user.batchId || "";
            
            const token = localStorage.getItem('token');
            const res = await axios.get('/coordinator-crm/meta-templates', { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                params: { 
                    businessId: String(targetBusinessId), 
                    batchId: String(targetBatchId),
                    t: Date.now() 
                }
            }); 
            const safeData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setTemplates(safeData); 
        } catch(e) {
            console.error("Template Fetch Error:", e);
            toast.error(e.response?.data?.error || "Failed to load Meta Templates!");
            setTemplates([]); 
        }
    };

    const fetchTeam = async () => {
        try { 
            const token = localStorage.getItem('token');
            const [staffRes, bizRes] = await Promise.all([
                axios.get('/admin/staff', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            
            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            const safeStaffData = Array.isArray(staffRes.data) ? staffRes.data : (staffRes.data?.data || []);
            let coords = safeStaffData.filter(s => s.role && ['COORDINATOR', 'CALLER', 'MANAGER'].includes(s.role.toUpperCase()));
            
            if (targetBusinessId && bizRes.data) {
                const safeBizData = Array.isArray(bizRes.data) ? bizRes.data : (bizRes.data?.data || []);
                const selectedBizObj = safeBizData.find(b => String(b.id) === String(targetBusinessId));
                const bizName = selectedBizObj ? selectedBizObj.name : '';

                coords = coords.filter(c => {
                    const cBizList = String(c.businessType || '').toLowerCase().split(',').map(b => b.trim());
                    const selBizName = String(bizName).toLowerCase().trim();
                    const selBizId = String(targetBusinessId).toLowerCase().trim();
                    const cBizIdStr = String(c.businessId || '').toLowerCase().trim();
                    
                    return (cBizIdStr === selBizId) || cBizList.includes(selBizId) || cBizList.some(biz => biz === selBizName || biz.includes(selBizName));
                });
            }
            setTeamMembers(coords); 
        } catch(e) { console.error("Failed to load team", e); }
    };

    const exportAllLeads = () => {
        let csvContent = "Name,Phone,Status,Phase,AssignedTo\n";
        allLeads.forEach(l => { csvContent += `"${l.name || 'Unknown'}","${l.phone}","${l.callStatus || 'NEW'}","${l.phase}","${l.assignedTo || 'Unassigned'}"\n`; });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); 
        link.setAttribute("href", url);
        link.setAttribute("download", `All_CRM_Leads.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const submitTemplate = async (e) => {
        e.preventDefault();
        const loadToast = toast.loading("Submitting to Meta...");
        try {
            const formData = new FormData();
            formData.append('name', tplForm.name);
            formData.append('category', tplForm.category);
            formData.append('headerType', tplForm.headerType);
            formData.append('headerText', tplForm.headerText);
            formData.append('bodyText', tplForm.bodyText);
            formData.append('footerText', tplForm.footerText);
            formData.append('buttons', JSON.stringify(tplButtons));
            if (tplFile) formData.append('media', tplFile);

            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            formData.append('businessId', targetBusinessId);

            const token = localStorage.getItem('token');
            await axios.post('/coordinator-crm/meta-templates', formData, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Template Created successfully!", { id: loadToast });
            setTplForm({ name: '', category: 'MARKETING', headerType: 'NONE', headerText: '', bodyText: '', footerText: '' });
            setTplButtons([]); 
            setTplFile(null); 
            
            setTimeout(() => {
                fetchTemplates();
            }, 1500);

        } catch (err) { 
            toast.error(err.response?.data?.error || "Failed", { id: loadToast }); 
        }
    };

    const deleteTemplate = async (name) => {
        if(!window.confirm(`Delete template ${name}?`)) return;
        try { 
            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            const token = localStorage.getItem('token');
            await axios.delete(`/coordinator-crm/meta-templates/${name}`, { 
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: targetBusinessId } 
            }); 
            toast.success("Deleted"); 
            fetchTemplates(); 
        } catch(e) { toast.error("Delete failed"); }
    };

    const toggleLeadSelection = (id) => {
        setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const is24hActive = (dateString) => (new Date() - new Date(dateString)) < (24 * 60 * 60 * 1000);
    const filteredBroadcastLeads = allLeads.filter(l => l.phone.includes(searchQuery) || (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())));

    const handleSelectAllValid = () => {
        const validIds = filteredBroadcastLeads.filter(l => bcastType === 'TEMPLATE' || is24hActive(l.updatedAt)).map(l => l.id);
        if (selectedLeads.length > 0 && selectedLeads.length === validIds.length) { setSelectedLeads([]); } else { setSelectedLeads(validIds); }
    };

    const handleSelectNHandover = () => {
        const n = parseInt(handoverBulkCount);
        if (isNaN(n) || n <= 0) return toast.error("Enter a valid number");
        const validLeads = handoverPaginated.filter(l => !l.isCallCenter && l.callCenterRequestStatus !== 'REQUESTED');
        const idsToSelect = validLeads.slice(0, n).map(l => l.id);
        setHandoverSelectedLeads([...new Set([...handoverSelectedLeads, ...idsToSelect])]);
        toast.success(`Selected top ${idsToSelect.length} valid leads`);
    };

    const handleHandoverSubmit = async () => {
        if (handoverSelectedLeads.length === 0) return toast.error("Select leads first");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/call-center/request-transfer', { leadIds: handoverSelectedLeads }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Successfully requested call center transfer!");
            setHandoverSelectedLeads([]);
            fetchStats();
        } catch (err) {
            toast.error("Failed to request transfer");
        }
    };

    const toggleHandoverLead = (id) => {
        setHandoverSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const filteredHandoverLeads = useMemo(() => {
        return allLeads.filter(l => {
            if (handoverSearch) {
                const search = handoverSearch.toLowerCase();
                const name = String(l.name || '').toLowerCase();
                const phone = String(l.phone || '').toLowerCase();
                if (!name.includes(search) && !phone.includes(search)) return false;
            }
            if (handoverStatusFilter !== 'ALL') {
                if (handoverStatusFilter === 'UNASSIGNED') {
                    if (l.assignedTo) return false;
                } else if (handoverStatusFilter === 'ASSIGNED') {
                    if (!l.assignedTo) return false;
                    if (handoverStaffFilter !== 'ALL' && l.assignedTo !== parseInt(handoverStaffFilter)) return false;
                } else if (handoverStatusFilter === 'CALL_CENTER') {
                    if (!l.isCallCenter) return false;
                }
            }
            return true;
        });
    }, [allLeads, handoverSearch, handoverStatusFilter, handoverStaffFilter]);

    const handoverPaginated = useMemo(() => {
        const start = (handoverPage - 1) * HANDOVER_ITEMS_PER_PAGE;
        return filteredHandoverLeads.slice(start, start + HANDOVER_ITEMS_PER_PAGE);
    }, [filteredHandoverLeads, handoverPage]);

    const handleBroadcast = async () => {
        if (selectedLeads.length === 0) return toast.error("Select leads first!");
        
        if (bcastType === 'TEMPLATE' && !bcastTemplate) return toast.error("Please select a template!");
        if (bcastType === '24H' && !bcastMessage && !bcastFile) return toast.error("Please add a message or file!");

        if(!window.confirm(`Are you sure you want to broadcast to ${selectedLeads.length} leads? Salli kapenawa!`)) return;

        setSendingBcast(true);
        setBroadcastProgress({ current: 0, total: selectedLeads.length });
        setBcastResults(null); 
        
        let totalSuccess = 0;
        let totalFailed = 0;
        let allReasons = [];

        const chunkSize = 50; 
        
        for (let i = 0; i < selectedLeads.length; i += chunkSize) {
            const chunk = selectedLeads.slice(i, i + chunkSize);
            
            const formData = new FormData();
            formData.append('leadIds', JSON.stringify(chunk));
            formData.append('type', bcastType);
            formData.append('message', bcastMessage);

            if (bcastType === 'TEMPLATE' && bcastTemplate) {
                const [tplName, tplLang] = bcastTemplate.split('|');
                formData.append('templateName', tplName);
                formData.append('templateLanguage', tplLang || 'en_US');
            } else {
                formData.append('templateName', bcastTemplate);
            }

            if (bcastFile) formData.append('media', bcastFile);

            try {
                const token = localStorage.getItem('token');
                const res = await axios.post('/coordinator-crm/broadcast', formData, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                
                totalSuccess += res.data.success || 0;
                totalFailed += res.data.failed || 0;
                allReasons = [...allReasons, ...(res.data.reasons || [])];
                
            } catch (e) { 
                console.error("Chunk failed", e);
                totalFailed += chunk.length;
            }

            setBroadcastProgress({ current: Math.min(i + chunkSize, selectedLeads.length), total: selectedLeads.length });
            
            if (i + chunkSize < selectedLeads.length) {
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
        }

        setBcastResults({ success: totalSuccess, failed: totalFailed, reasons: allReasons });
        toast.success(`Broadcast completed! Sent: ${totalSuccess}, Failed: ${totalFailed}`);
        setSendingBcast(false);
    };

    const handleAddTeamMember = async (e) => {
        e.preventDefault();
        setTeamLoading(true);
        try {
            const token = localStorage.getItem('token');
            const bizRes = await axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } });
            const safeBizData = Array.isArray(bizRes.data) ? bizRes.data : (bizRes.data?.data || []);
            const selectedBizObj = safeBizData.find(b => String(b.id) === String(filters?.selectedBusiness));
            const bizNameToSave = selectedBizObj ? selectedBizObj.name : String(filters?.selectedBusiness);

            const payload = {
                ...teamForm,
                businessType: bizNameToSave,
                department: 'Class Coordination',
                role: 'CALLER'
            };

            await axios.post('/admin/staff', payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Caller Added Successfully!");
            setTeamForm({ firstName: '', lastName: '', phone: '', password: '' });
            fetchTeam();
        } catch (error) { toast.error(error.response?.data?.error || "Failed to add caller"); }
        setTeamLoading(false);
    };

    const deleteTeamMember = async (id) => {
        if (!window.confirm("Remove this caller?")) return;
        try { 
            const token = localStorage.getItem('token');
            await axios.delete(`/admin/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } }); 
            toast.success("Caller Removed!"); 
            fetchTeam(); 
        } catch (error) { toast.error("Failed to remove"); }
    };

    const handleStartRound = async (campaignType) => {
        if (!window.confirm(`Are you sure you want to start Round 2 for ${campaignType}? This will reset all assigned leads to pending for another round of calls.`)) return;
        try {
            const token = localStorage.getItem('token');
            const targetBusinessId = filters?.selectedBusiness || user.businessId;
            await axios.post('/api/call-center/manager/start-round', {
                businessId: targetBusinessId,
                campaignType: campaignType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Round 2 started successfully for ${campaignType}!`);
            fetchStats();
            fetchAllLeads();
        } catch (error) {
            console.error("Start round error", error);
            toast.error("Failed to start Round 2.");
        }
    };

    const displayMsgReport = useMemo(() => {
        const rawMsgReport = data?.msgReport || [];
        if (!filters?.selectedBusiness || !teamMembers || teamMembers.length === 0) return rawMsgReport;

        const filtered = [];
        teamMembers.forEach(member => {
            const existing = rawMsgReport.find(r => r.agentName === member.firstName);
            if (existing) filtered.push(existing);
            else filtered.push({
                agentName: member.firstName,
                uniqueSent: 0, uniqueReceived: 0
            });
        });
        return filtered;
    }, [data?.msgReport, teamMembers, filters?.selectedBusiness]);

    const isCallCenterRole = (role) => {
        const r = String(role).toUpperCase().replace(/ /g, '_');
        return ['CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(r);
    };

    const coordReport = useMemo(() => {
        const rawReport = data?.report || [];
        const allCoordStats = rawReport.filter(r => !isCallCenterRole(r.role));
        
        if (filters?.selectedBusiness && teamMembers && teamMembers.length > 0) {
            const filtered = [];
            teamMembers.forEach(member => {
                if (!isCallCenterRole(member.role)) {
                    const existing = allCoordStats.find(r => r.agentName === member.firstName);
                    if (existing) {
                        filtered.push(existing);
                    } else {
                        filtered.push({
                            agentName: member.firstName,
                            role: member.role,
                            assigned: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0
                        });
                    }
                }
            });
            return filtered;
        }
        return allCoordStats;
    }, [data?.report, teamMembers, filters?.selectedBusiness]);

    const ccReport = useMemo(() => (data?.report || []).filter(r => isCallCenterRole(r.role)), [data?.report]);

    const coordStats = useMemo(() => {
        const covered = coordReport.reduce((acc, curr) => acc + curr.answered + curr.noAnswer + curr.reject, 0);
        const pending = coordReport.reduce((acc, curr) => acc + curr.pending, 0);
        const assigned = coordReport.reduce((acc, curr) => acc + curr.assigned, 0);
        const rate = assigned > 0 ? Math.round((covered / assigned) * 100) : 0;
        return { covered, pending, assigned, rate };
    }, [coordReport]);

    const ccStats = useMemo(() => {
        const covered = ccReport.reduce((acc, curr) => acc + curr.answered + curr.noAnswer + curr.reject, 0);
        const pending = ccReport.reduce((acc, curr) => acc + curr.pending, 0);
        const assigned = ccReport.reduce((acc, curr) => acc + curr.assigned, 0);
        const rate = assigned > 0 ? Math.round((covered / assigned) * 100) : 0;
        return { covered, pending, assigned, rate };
    }, [ccReport]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row justify-between gap-4 bg-[#1e293b] p-4 rounded-2xl border border-white/5 shadow-md">
                <div className="flex gap-2 bg-[#0f172a] p-1 rounded-xl overflow-x-auto custom-scrollbar">
                    <button onClick={() => setActiveTab('CALLS')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'CALLS' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Call Progress</button>
                    <button onClick={() => setActiveTab('WHATSAPP')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'WHATSAPP' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>WhatsApp Metrics</button>
                    <button onClick={() => setActiveTab('TEMPLATES')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'TEMPLATES' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Meta Templates</button>
                    <button onClick={() => setActiveTab('BROADCAST')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'BROADCAST' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Broadcast</button>
                    {(isSystemAdmin || isManager) && <button onClick={() => setActiveTab('CALL_CENTER_STATS')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'CALL_CENTER_STATS' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>Call Center Stats</button>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {(activeTab === 'CALLS' || activeTab === 'WHATSAPP') && (
                        <>
                            <select value={phase} onChange={e=>setPhase(e.target.value)} className="bg-[#0f172a] text-slate-300 text-sm p-2 rounded-lg border border-slate-700 outline-none">
                                <option value="All">All Phases</option>
                                <option value="1">Phase 1</option>
                                <option value="2">Phase 2</option>
                                <option value="3">Phase 3</option>
                            </select>
                            <select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)} className="bg-[#0f172a] text-slate-300 text-sm p-2 rounded-lg border border-slate-700 outline-none">
                                <option value="all">Overall (All Data)</option>
                                <option value="today">Today Only</option>
                                <option value="custom">Date Range</option>
                            </select>
                            {timeFilter === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input type="datetime-local" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-[#0f172a] text-slate-300 text-xs p-2 rounded-lg border border-slate-700 outline-none" style={{colorScheme: 'dark'}}/>
                                    <span className="text-slate-500 font-bold">TO</span>
                                    <input type="datetime-local" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-[#0f172a] text-slate-300 text-xs p-2 rounded-lg border border-slate-700 outline-none" style={{colorScheme: 'dark'}}/>
                                </div>
                            )}
                        </>
                    )}
                    <button onClick={exportAllLeads} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-lg whitespace-nowrap"><Download size={16}/> Export Full CRM</button>
                </div>
            </div>

            {loading && (activeTab === 'CALLS' || activeTab === 'WHATSAPP') ? <div className="text-center py-10 text-slate-500">Loading metrics...</div> : (
                <>
                    {activeTab === 'CALLS' && (
                        <div className="flex flex-col gap-10">
                            {/* ===================== COORDINATOR PROGRESS ===================== */}
                            <div>
                                <h2 className="text-xl font-black text-white mb-6 border-b border-white/5 pb-4 flex items-center gap-2"><PhoneCall className="text-emerald-400" size={24}/> Coordinator Progress</h2>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden">
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Leads</p>
                                        <h3 className="text-2xl font-bold text-white">{data?.summary?.totalLeads || 0}</h3>
                                        <div className="absolute bottom-0 right-0 flex">
                                            {data?.summary?.unassignedLeads > 0 && (
                                                <div className="bg-red-500/20 text-red-400 px-3 py-1 text-[10px] font-black border-t border-l border-red-500/30">
                                                    {data.summary.unassignedLeads} UNASSIGNED
                                                </div>
                                            )}
                                            {ccStats?.assigned > 0 && (
                                                <div className="bg-orange-500/20 text-orange-400 px-3 py-1 text-[10px] font-black border-t border-l border-orange-500/30">
                                                    {ccStats.assigned} CALL CENTER
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Total Assigned</p>
                                        <h3 className="text-2xl font-bold text-indigo-400">{coordStats.assigned} <span className="text-[10px] text-slate-500 font-normal">Coordinators</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Covered Leads</p>
                                        <h3 className="text-2xl font-bold text-emerald-400">{coordStats.covered} <span className="text-[10px] text-slate-500 font-normal">Contacted</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Pending Leads</p>
                                        <h3 className="text-2xl font-bold text-blue-400">{coordStats.pending} <span className="text-[10px] text-slate-500 font-normal">Remaining</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Response Rate</p>
                                        <h3 className="text-2xl font-bold text-amber-400">{coordStats.rate}%</h3>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
                                    <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
                                        <table className="w-full text-left text-sm text-slate-300">
                                            <thead className="bg-black/40 text-slate-400 text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-4">Coordinator</th>
                                                    <th className="p-4 text-center">Assigned</th>
                                                    <th className="p-4 text-center text-blue-400">Pending</th>
                                                    <th className="p-4 text-center text-emerald-400">Answered</th>
                                                    <th className="p-4 text-center text-amber-400">No Answer</th>
                                                    <th className="p-4 text-center text-rose-400">Reject</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {coordReport.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-white/5">
                                                        <td className="p-4 font-bold text-white">{row.agentName}</td>
                                                        <td className="p-4 text-center">{row.assigned}</td>
                                                        <td className="p-4 text-center font-bold text-blue-400">{row.pending}</td>
                                                        <td className="p-4 text-center font-bold text-emerald-400">{row.answered}</td>
                                                        <td className="p-4 text-center font-bold text-amber-400">{row.noAnswer}</td>
                                                        <td className="p-4 text-center font-bold text-rose-400">{row.reject}</td>
                                                    </tr>
                                                ))}
                                                {coordReport.length === 0 && <tr><td colSpan="6" className="text-center p-8 text-slate-500 italic">No coordinator stats available</td></tr>}
                                                {coordReport.length > 0 && (
                                                    <tr className="bg-[#0f172a]/80 font-black border-t-2 border-white/10">
                                                        <td className="p-4 text-white uppercase tracking-wider text-sm">TOTAL</td>
                                                        <td className="p-4 text-center">{coordStats.assigned}</td>
                                                        <td className="p-4 text-center text-blue-400">{coordStats.pending}</td>
                                                        <td className="p-4 text-center text-emerald-400">{coordReport.reduce((sum, r) => sum + r.answered, 0)}</td>
                                                        <td className="p-4 text-center text-amber-400">{coordReport.reduce((sum, r) => sum + r.noAnswer, 0)}</td>
                                                        <td className="p-4 text-center text-rose-400">{coordReport.reduce((sum, r) => sum + r.reject, 0)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                                        <h3 className="text-sm font-bold text-white mb-4">Coordinator Performance</h3>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={coordReport} barSize={12}> 
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                    <XAxis dataKey="agentName" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#1e293b', border: '1px solid #ffffff10', borderRadius: '8px'}} />
                                                    <Bar dataKey="answered" name="Answered" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="noAnswer" name="No Answer" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="reject" name="Reject" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ===================== CALL CENTER PROGRESS ===================== */}
                            <div>
                                <h2 className="text-xl font-black text-white mb-6 border-b border-white/5 pb-4 flex items-center gap-2"><PhoneCall className="text-rose-500" size={24}/> Call Center Progress</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Total Assigned in CC</p>
                                        <h3 className="text-2xl font-bold text-indigo-400">{ccStats.assigned} <span className="text-[10px] text-slate-500 font-normal">Callers</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Covered Leads</p>
                                        <h3 className="text-2xl font-bold text-emerald-400">{ccStats.covered} <span className="text-[10px] text-slate-500 font-normal">Contacted</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Pending Leads</p>
                                        <h3 className="text-2xl font-bold text-blue-400">{ccStats.pending} <span className="text-[10px] text-slate-500 font-normal">Remaining</span></h3>
                                    </div>
                                    <div className="bg-slate-800 p-5 rounded-2xl border border-white/5 shadow-lg">
                                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Response Rate</p>
                                        <h3 className="text-2xl font-bold text-amber-400">{ccStats.rate}%</h3>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
                                    <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
                                        <table className="w-full text-left text-sm text-slate-300">
                                            <thead className="bg-black/40 text-slate-400 text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-4">Caller</th>
                                                    <th className="p-4 text-center">Assigned</th>
                                                    <th className="p-4 text-center text-blue-400">Pending</th>
                                                    <th className="p-4 text-center text-emerald-400">Answered</th>
                                                    <th className="p-4 text-center text-amber-400">No Answer</th>
                                                    <th className="p-4 text-center text-rose-400">Reject</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {ccReport.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-white/5">
                                                        <td className="p-4 font-bold text-white">{row.agentName}</td>
                                                        <td className="p-4 text-center">{row.assigned}</td>
                                                        <td className="p-4 text-center font-bold text-blue-400">{row.pending}</td>
                                                        <td className="p-4 text-center font-bold text-emerald-400">{row.answered}</td>
                                                        <td className="p-4 text-center font-bold text-amber-400">{row.noAnswer}</td>
                                                        <td className="p-4 text-center font-bold text-rose-400">{row.reject}</td>
                                                    </tr>
                                                ))}
                                                {ccReport.length === 0 && <tr><td colSpan="6" className="text-center p-8 text-slate-500 italic">No call center stats available</td></tr>}
                                                {ccReport.length > 0 && (
                                                    <tr className="bg-[#0f172a]/80 font-black border-t-2 border-white/10">
                                                        <td className="p-4 text-white uppercase tracking-wider text-sm">TOTAL</td>
                                                        <td className="p-4 text-center">{ccStats.assigned}</td>
                                                        <td className="p-4 text-center text-blue-400">{ccStats.pending}</td>
                                                        <td className="p-4 text-center text-emerald-400">{ccReport.reduce((sum, r) => sum + r.answered, 0)}</td>
                                                        <td className="p-4 text-center text-amber-400">{ccReport.reduce((sum, r) => sum + r.noAnswer, 0)}</td>
                                                        <td className="p-4 text-center text-rose-400">{ccReport.reduce((sum, r) => sum + r.reject, 0)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                                        <h3 className="text-sm font-bold text-white mb-4">Call Center Performance</h3>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={ccReport} barSize={12}> 
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                    <XAxis dataKey="agentName" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#1e293b', border: '1px solid #ffffff10', borderRadius: '8px'}} />
                                                    <Bar dataKey="answered" name="Answered" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="noAnswer" name="No Answer" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="reject" name="Reject" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'WHATSAPP' && (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {displayMsgReport.map((r, i) => (
                                    <div key={i} className="bg-[#1e293b]/40 hover:bg-[#1e293b]/80 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-lg transition-all relative group overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-blue-500/20 transition-all"></div>
                                        
                                        <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-slate-300 font-bold shadow-inner">
                                                {r.agentName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-base tracking-wide">{r.agentName}</h4>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WhatsApp Activity</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-10 h-10 bg-blue-500/10 rounded-full blur-xl"></div>
                                                <p className="text-[10px] font-black uppercase text-blue-400 mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> OUTBOUND</p>
                                                <div className="flex items-end gap-1.5">
                                                    <span className="text-2xl font-black text-white leading-none">{r.uniqueSent}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Leads</span>
                                                </div>
                                                <div className="mt-2 text-[10px] font-semibold text-slate-500 flex justify-between items-center bg-black/20 px-2 py-1 rounded-md border border-white/5">
                                                    <span>Total Msgs:</span>
                                                    <span className="text-blue-300 font-bold">{r.totalSent || 0}</span>
                                                </div>
                                            </div>

                                            <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-10 h-10 bg-emerald-500/10 rounded-full blur-xl"></div>
                                                <p className="text-[10px] font-black uppercase text-emerald-400 mb-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> INBOUND</p>
                                                <div className="flex items-end gap-1.5">
                                                    <span className="text-2xl font-black text-white leading-none">{r.uniqueReceived}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Leads</span>
                                                </div>
                                                <div className="mt-2 text-[10px] font-semibold text-slate-500 flex justify-between items-center bg-black/20 px-2 py-1 rounded-md border border-white/5">
                                                    <span>Total Msgs:</span>
                                                    <span className="text-emerald-300 font-bold">{r.totalReceived || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                                <h3 className="text-sm font-bold text-white mb-4">Unique User Interaction Trends</h3>
                                <div style={{ width: '100%', height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={displayMsgReport}> 
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis dataKey="agentName" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} />
                                            <Line type="monotone" dataKey="uniqueSent" name="Leads Contacted" stroke="#3b82f6" strokeWidth={3} dot={{r:4}} />
                                            <Line type="monotone" dataKey="uniqueReceived" name="Leads Replied" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'TEMPLATES' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Plus className="text-purple-500"/> Create Meta Template</h3>
                                <form onSubmit={submitTemplate} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-slate-400">Name</label><input type="text" required value={tplForm.name} onChange={e=>setTplForm({...tplForm, name: e.target.value.toLowerCase().replace(/ /g, '_')})} className="w-full bg-[#0f172a] text-white p-2.5 rounded-lg border border-slate-700 mt-1" /></div>
                                        <div><label className="text-xs font-bold text-slate-400">Category</label><select value={tplForm.category} onChange={e=>setTplForm({...tplForm, category: e.target.value})} className="w-full bg-[#0f172a] text-white p-2.5 rounded-lg border border-slate-700 mt-1"><option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option></select></div>
                                    </div>
                                    <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                        <label className="text-xs font-bold text-slate-400 mb-2 block">Header Media</label>
                                        <div className="flex gap-4 mb-3">
                                            {['NONE', 'TEXT', 'IMAGE', 'DOCUMENT'].map(type => (
                                                <label key={type} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="radio" checked={tplForm.headerType === type} onChange={() => setTplForm({...tplForm, headerType: type})} className="accent-purple-500"/> {type}</label>
                                            ))}
                                        </div>
                                        {tplForm.headerType === 'TEXT' && <input type="text" value={tplForm.headerText} onChange={e=>setTplForm({...tplForm, headerText: e.target.value})} className="w-full bg-[#0f172a] text-white p-2 rounded-lg border border-slate-700" placeholder="Header Title" />}
                                        {['IMAGE', 'DOCUMENT'].includes(tplForm.headerType) && <input type="file" onChange={e=>setTplFile(e.target.files[0])} className="w-full text-slate-400 text-sm" />}
                                    </div>
                                    <div><label className="text-xs font-bold text-slate-400">Body Text (Use {'{{1}}'} for variables)</label><textarea required rows="3" value={tplForm.bodyText} onChange={e=>setTplForm({...tplForm, bodyText: e.target.value})} className="w-full bg-[#0f172a] text-white p-2.5 rounded-lg border border-slate-700 mt-1 custom-scrollbar"></textarea></div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 flex justify-between items-center">Buttons (Max 3) <button type="button" onClick={() => tplButtons.length < 3 && setTplButtons([...tplButtons, {text: ''}])} className="text-purple-400">+ Add</button></label>
                                        {tplButtons.map((btn, i) => (
                                            <div key={i} className="flex gap-2 mt-2">
                                                <input type="text" value={btn.text} onChange={e=>{let n=[...tplButtons]; n[i].text=e.target.value; setTplButtons(n);}} placeholder="Button Text" className="flex-1 bg-[#0f172a] text-white p-2 rounded-lg border border-slate-700" />
                                                <button type="button" onClick={()=>{let n=[...tplButtons]; n.splice(i,1); setTplButtons(n)}} className="text-red-400 p-2"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl shadow-lg">Submit to Meta</button>
                                </form>
                            </div>

                            <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-xl shadow-xl max-h-[600px] overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white">Existing Templates</h3>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); fetchTemplates(); }} 
                                        className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all hover:bg-purple-500/20"
                                    >
                                        <RefreshCw size={14}/> Refresh
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {templates.length === 0 ? <p className="text-slate-500 text-sm">No templates found.</p> : templates.map(t => (
                                        <div key={t.id} className="bg-black/30 p-4 rounded-xl border border-white/5 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-white font-bold">{t.name}</h4>
                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded ${t.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : t.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{t.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 uppercase">{t.language} | {t.category}</p>
                                            </div>
                                            <button onClick={() => deleteTemplate(t.name)} className="text-red-400 hover:text-red-300 p-2 bg-red-500/10 rounded-lg"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'BROADCAST' && (
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1 bg-[#1e293b]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex flex-col max-h-[600px]">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users size={18}/> Audience ({selectedLeads.length} Selected)</h3>
                                    <button onClick={handleSelectAllValid} className="text-xs font-bold text-blue-400 hover:underline">
                                        {selectedLeads.length > 0 && selectedLeads.length === filteredBroadcastLeads.filter(l => bcastType === 'TEMPLATE' || is24hActive(l.updatedAt)).length ? "Unselect All" : "Select All Valid"}
                                    </button>
                                </div>
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                                    <input type="text" placeholder="Search numbers..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-amber-500" />
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                    {filteredBroadcastLeads.map(lead => {
                                        const isActive = is24hActive(lead.updatedAt);
                                        const disabled = bcastType === '24H' && !isActive;
                                        return (
                                            <label key={lead.id} className={`flex items-center justify-between p-3 rounded-xl border ${disabled ? 'bg-slate-800/50 border-transparent opacity-50' : 'bg-black/30 border-white/5 cursor-pointer hover:border-white/20'}`}>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" disabled={disabled} checked={selectedLeads.includes(lead.id)} onChange={() => toggleLeadSelection(lead.id)} className="accent-amber-500 w-4 h-4"/>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{lead.phone}</p>
                                                        <p className="text-slate-500 text-xs">{lead.name || 'No Name'}</p>
                                                    </div>
                                                </div>
                                                {isActive ? <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md">24H ACTIVE</span> : <span className="px-2 py-1 bg-slate-700 text-slate-400 text-[10px] font-black rounded-md">INACTIVE</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="w-full lg:w-[400px] flex flex-col gap-6">
                                <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-xl shadow-xl">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Megaphone size={18}/> Send Broadcast</h3>
                                    
                                    <div className="flex gap-2 p-1 bg-[#0f172a] rounded-xl mb-4">
                                        <button onClick={() => {setBcastType('24H'); setSelectedLeads([]);}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${bcastType === '24H' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>24H Message</button>
                                        <button onClick={() => {setBcastType('TEMPLATE'); setSelectedLeads([]);}} className={`flex-1 py-2 text-xs font-bold rounded-lg ${bcastType === 'TEMPLATE' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Template</button>
                                    </div>

                                    {bcastType === '24H' ? (
                                        <>
                                            <p className="text-[10px] text-amber-400 mb-2 leading-tight">Only users who interacted within the last 24 hours can receive free-form messages.</p>
                                            <textarea rows="3" value={bcastMessage} onChange={e=>setBcastMessage(e.target.value)} placeholder="Custom message..." className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 custom-scrollbar resize-none mb-3"></textarea>
                                            <input type="file" onChange={e=>setBcastFile(e.target.files[0])} className="w-full text-slate-400 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300" />
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-[10px] text-blue-400 mb-2 leading-tight">Templates can be sent to anyone. If your template has variables or a Header Media, add them below.</p>
                                            <select value={bcastTemplate} onChange={e=>setBcastTemplate(e.target.value)} className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 mb-3">
    <option value="">Select Approved Template...</option>
    {templates.filter(t => t.status === 'APPROVED').map(t => (
        // 🔥 FIX: නමයි Language එකයි දෙකම Value එකට දැම්මා
        <option key={t.id} value={`${t.name}|${t.language}`}>
            {t.name} ({t.language})
        </option>
    ))}
</select>
                                            
                                            <textarea rows="2" value={bcastMessage} onChange={e=>setBcastMessage(e.target.value)} placeholder="Variable Text (e.g. Hi there!)" className="w-full bg-[#0f172a] text-white p-3 rounded-xl border border-slate-700 custom-scrollbar resize-none mb-3"></textarea>
                                            <input type="file" onChange={e=>setBcastFile(e.target.files[0])} className="w-full text-slate-400 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300" />
                                        </>
                                    )}

                                    {sendingBcast && broadcastProgress.total > 0 && (
                                        <div className="mt-4 mb-2">
                                            <div className="flex justify-between text-xs text-amber-400 mb-1 font-bold">
                                                <span>Sending Messages... Please don't refresh!</span>
                                                <span>{broadcastProgress.current} / {broadcastProgress.total}</span>
                                            </div>
                                            <div className="w-full bg-slate-800 rounded-full h-2.5">
                                                <div 
                                                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-300" 
                                                    style={{ width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleBroadcast} 
                                        disabled={sendingBcast} 
                                        className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sendingBcast ? 'Broadcasting... Wait' : `Fire Broadcast to ${selectedLeads.length}`}
                                    </button>
                                </div>

                                {bcastResults && (
                                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 shadow-inner">
                                        <h4 className="text-white font-bold mb-3">Broadcast Results</h4>
                                        <div className="flex gap-4 mb-4">
                                            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-center">
                                                <p className="text-emerald-400 text-2xl font-black">{bcastResults.success}</p>
                                                <p className="text-[10px] text-emerald-500/70 font-bold uppercase">Success</p>
                                            </div>
                                            <div className="flex-1 bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-center">
                                                <p className="text-red-400 text-2xl font-black">{bcastResults.failed}</p>
                                                <p className="text-[10px] text-red-500/70 font-bold uppercase">Failed</p>
                                            </div>
                                        </div>
                                        {bcastResults.reasons?.length > 0 && (
                                            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                                                {bcastResults.reasons.map((r, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-xs bg-red-500/5 p-2 rounded border border-red-500/10">
                                                        <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5"/>
                                                        <div><span className="font-bold text-slate-300">{r.phone}:</span> <span className="text-slate-500">{r.error}</span></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'CALL_CENTER_STATS' && (
                        <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col min-h-[500px]">
                            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><PhoneCall size={20} className="text-orange-500" /> Call Center Detailed Stats</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="bg-gradient-to-br from-orange-900/40 to-slate-900 border border-orange-500/30 p-6 rounded-2xl">
                                    <p className="text-orange-400 text-xs font-bold uppercase mb-2">Total Handed Over</p>
                                    <h2 className="text-4xl font-black text-white">{allLeads.filter(l => l.isCallCenter || l.callCenterRequestStatus === 'REQUESTED').length}</h2>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl">
                                    <p className="text-indigo-400 text-xs font-bold uppercase mb-2">Currently Assigned</p>
                                    <h2 className="text-4xl font-black text-white">{allLeads.filter(l => l.isCallCenter && l.assignedTo).length}</h2>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/30 p-6 rounded-2xl">
                                    <p className="text-emerald-400 text-xs font-bold uppercase mb-2">Covered by Call Center</p>
                                    <h2 className="text-4xl font-black text-white">{allLeads.filter(l => l.isCallCenter && l.callCenterStatus === 'completed').length}</h2>
                                </div>
                                <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 p-6 rounded-2xl">
                                    <p className="text-blue-400 text-xs font-bold uppercase mb-2">Pending in Call Center</p>
                                    <h2 className="text-4xl font-black text-white">{allLeads.filter(l => l.isCallCenter && l.callCenterStatus === 'pending').length}</h2>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                                <div className="bg-black/30 border border-white/5 rounded-2xl p-6">
                                    <h4 className="text-sm font-bold text-slate-300 mb-4">Handovers vs Coverage Status</h4>
                                    <div style={{ width: '100%', height: '300px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Pending Handover Requests', value: allLeads.filter(l => !l.isCallCenter && l.callCenterRequestStatus === 'REQUESTED').length, fill: '#f59e0b' },
                                                        { name: 'In Call Center (Pending)', value: allLeads.filter(l => l.isCallCenter && l.callCenterStatus === 'pending').length, fill: '#3b82f6' },
                                                        { name: 'Completed by Call Center', value: allLeads.filter(l => l.isCallCenter && l.callCenterStatus === 'completed').length, fill: '#10b981' }
                                                    ]}
                                                    cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                                                >
                                                    <Cell key="cell-0" fill="#f59e0b" />
                                                    <Cell key="cell-1" fill="#3b82f6" />
                                                    <Cell key="cell-2" fill="#10b981" />
                                                </Pie>
                                                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #ffffff10', borderRadius: '8px'}} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-black/30 border border-white/5 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                                    <h4 className="text-sm font-bold text-slate-300 mb-2">Need to assign more leads?</h4>
                                    <p className="text-xs text-slate-500 mb-6">Use the Hand Over tab to send more leads to the call center queue.</p>
                                    <button onClick={() => {setActiveTab('HANDOVER'); }} className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
                                        <PhoneCall size={18}/> Go to Hand Over
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'HANDOVER' && (
                        <div className="bg-[#1e293b]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col min-h-[700px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><PhoneCall size={20} className="text-rose-500" /> Call Center Handover</h3>
                                <div className="flex gap-2 text-sm text-slate-400">
                                    <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-lg border border-rose-500/30">Total Leads: {filteredHandoverLeads.length}</span>
                                </div>
                            </div>
                            
                            {/* Handover Filters */}
                            <div className="flex flex-wrap items-center gap-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or phone..." 
                                        value={handoverSearch} 
                                        onChange={e => setHandoverSearch(e.target.value)} 
                                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-rose-500" 
                                    />
                                </div>
                                <select 
                                    value={handoverStatusFilter} 
                                    onChange={e => setHandoverStatusFilter(e.target.value)} 
                                    className="bg-[#0f172a] text-slate-300 text-sm p-2 rounded-xl border border-slate-700 outline-none"
                                >
                                    <option value="ALL">All CRM Leads</option>
                                    <option value="UNASSIGNED">Unassigned Leads</option>
                                    <option value="ASSIGNED">Assigned Leads</option>
                                    <option value="CALL_CENTER">In Call Center</option>
                                </select>
                                
                                {handoverStatusFilter === 'ASSIGNED' && (
                                    <select 
                                        value={handoverStaffFilter} 
                                        onChange={e => setHandoverStaffFilter(e.target.value)} 
                                        className="bg-[#0f172a] text-slate-300 text-sm p-2 rounded-xl border border-slate-700 outline-none"
                                    >
                                        <option value="ALL">All Coordinators</option>
                                        {teamMembers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Bulk Selection Bar */}
                            <div className="flex justify-between items-center bg-rose-500/5 p-3 rounded-xl border border-rose-500/20 mb-4 flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-300">Bulk Select:</span>
                                    <input 
                                        type="number" 
                                        placeholder="Count" 
                                        value={handoverBulkCount} 
                                        onChange={e => setHandoverBulkCount(e.target.value)} 
                                        className="w-24 bg-[#0f172a] border border-slate-700 text-white rounded-lg p-2 text-sm outline-none text-center" 
                                    />
                                    <button 
                                        onClick={handleSelectNHandover} 
                                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm"
                                    >
                                        Select First N
                                    </button>
                                    {handoverSelectedLeads.length > 0 && (
                                        <button 
                                            onClick={() => setHandoverSelectedLeads([])} 
                                            className="text-slate-400 hover:text-white text-sm font-medium underline ml-2"
                                        >
                                            Clear Selection
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-rose-400">{handoverSelectedLeads.length} Selected</span>
                                    <button 
                                        onClick={handleHandoverSubmit}
                                        disabled={handoverSelectedLeads.length === 0}
                                        className={`flex items-center gap-2 font-bold py-2 px-5 rounded-xl transition-all shadow-lg ${handoverSelectedLeads.length > 0 ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                    >
                                        <Send size={16} />
                                        Hand Over
                                    </button>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="flex-1 overflow-auto custom-scrollbar border border-white/5 rounded-xl bg-black/40">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-[#0f172a] text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-white/10">
                                        <tr>
                                            <th className="p-3 w-12 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    onChange={e => {
                                                        const validIds = handoverPaginated.filter(l => !l.isCallCenter && l.callCenterRequestStatus !== 'REQUESTED').map(l => l.id);
                                                        if (e.target.checked) {
                                                            const newSelection = [...new Set([...handoverSelectedLeads, ...validIds])];
                                                            setHandoverSelectedLeads(newSelection);
                                                        } else {
                                                            setHandoverSelectedLeads(handoverSelectedLeads.filter(id => !validIds.includes(id)));
                                                        }
                                                    }}
                                                    checked={handoverPaginated.length > 0 && handoverPaginated.filter(l => !l.isCallCenter && l.callCenterRequestStatus !== 'REQUESTED').every(l => handoverSelectedLeads.includes(l.id))}
                                                    className="w-4 h-4 accent-rose-500 rounded" 
                                                />
                                            </th>
                                            <th className="p-3">Name</th>
                                            <th className="p-3">Phone</th>
                                            <th className="p-3">Coordinator</th>
                                            <th className="p-3">Call Center Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {handoverPaginated.map(lead => {
                                            const isCC = lead.isCallCenter;
                                            const reqStatus = lead.callCenterRequestStatus; // REQUESTED, APPROVED, REJECTED
                                            const status = lead.callCenterStatus; // pending, completed
                                            const assignedStaff = teamMembers.find(m => m.id === lead.assignedTo);
                                            const isTransferable = !isCC && reqStatus !== 'REQUESTED';

                                            return (
                                                <tr key={lead.id} className="hover:bg-white/5">
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={handoverSelectedLeads.includes(lead.id)}
                                                            onChange={() => toggleHandoverLead(lead.id)}
                                                            disabled={!isTransferable}
                                                            className="w-4 h-4 accent-rose-500 rounded" 
                                                        />
                                                    </td>
                                                    <td className="p-3 font-medium text-white">{lead.name || '-'}</td>
                                                    <td className="p-3 text-slate-400 font-mono">{lead.phone}</td>
                                                    <td className="p-3">
                                                        {assignedStaff ? <span className="text-blue-400 font-bold text-xs">{assignedStaff.firstName} {assignedStaff.lastName}</span> : <span className="text-slate-500 text-xs italic">Unassigned</span>}
                                                    </td>
                                                    <td className="p-3">
                                                        {isCC && status === 'completed' ? (
                                                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/30 flex items-center gap-1 w-max"><CheckCircle size={10} /> Completed</span>
                                                        ) : isCC ? (
                                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-lg border border-blue-500/30 flex items-center gap-1 w-max"><Clock size={10} /> In Call Center</span>
                                                        ) : reqStatus === 'REQUESTED' ? (
                                                            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded-lg border border-amber-500/30 flex items-center gap-1 w-max"><Clock size={10} /> Pending Approval</span>
                                                        ) : reqStatus === 'REJECTED' ? (
                                                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-black rounded-lg border border-red-500/30 flex items-center gap-1 w-max"><AlertCircle size={10} /> Rejected</span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-700 w-max block">Not Requested</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {handoverPaginated.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-8 text-center text-slate-500">No leads found matching criteria.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
                                <p className="text-xs text-slate-500">
                                    Showing {(handoverPage - 1) * HANDOVER_ITEMS_PER_PAGE + 1} to {Math.min(handoverPage * HANDOVER_ITEMS_PER_PAGE, filteredHandoverLeads.length)} of {filteredHandoverLeads.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setHandoverPage(Math.max(1, handoverPage - 1))}
                                        disabled={handoverPage === 1}
                                        className="p-1.5 bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-white bg-[#0f172a] px-3 py-1.5 rounded-lg border border-slate-700">
                                        Page {handoverPage}
                                    </span>
                                    <button 
                                        onClick={() => setHandoverPage(handoverPage + 1)}
                                        disabled={handoverPage * HANDOVER_ITEMS_PER_PAGE >= filteredHandoverLeads.length}
                                        className="p-1.5 bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
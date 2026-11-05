import React, { useState, useEffect, useMemo } from 'react';
import { 
    PhoneIncoming, 
    PhoneMissed, 
    PhoneOff, 
    PhoneCall, 
    Calendar, 
    Clock, 
    Download, 
    Filter, 
    Search, 
    BarChart3, 
    CheckCircle2, 
    XCircle, 
    User, 
    Building2, 
    Layers, 
    RefreshCw, 
    ExternalLink, 
    X, 
    AlertTriangle,
    TrendingDown,
    Activity,
    ShieldCheck,
    Hourglass,
    CheckCheck,
    MessageCircle,
    CalendarDays,
    Send
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPhoneAlt, FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../../contexts/CallContext';

export default function InboundMissedCallsReportModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { startOutboundCall, socket } = useCall();

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    
    const sevenDaysAgoStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    }, []);

    const [startDate, setStartDate] = useState(sevenDaysAgoStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [startTime, setStartTime] = useState(''); 
    const [endTime, setEndTime] = useState('');     
    const [selectedBusiness, setSelectedBusiness] = useState('ALL');
    const [selectedBatch, setSelectedBatch] = useState('ALL');
    const [selectedAgent, setSelectedAgent] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL'); 
    const [selectedDirection, setSelectedDirection] = useState('INBOUND'); 
    const [searchQuery, setSearchQuery] = useState('');

    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [agents, setAgents] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState({
        summary: {
            totalCalls: 0,
            inboundTotal: 0,
            outboundTotal: 0,
            completedCalls: 0,
            missedCalls: 0,
            rejectedCalls: 0,
            missedRate: 0,
            totalDuration: 0,
            avgDuration: 0
        },
        logs: [],
        hourlyBreakdown: [],
        agentBreakdown: [],
        batchBreakdown: []
    });

    // View tabs: 'LOGS' (Call Logs), 'REQUESTS' (Call Permission Requests Tracker), 'HOURLY', 'AGENTS'
    const [activeViewTab, setActiveViewTab] = useState('LOGS');

    // Call Permission Requests State
    const [permRequests, setPermRequests] = useState([]);
    const [permCounts, setPermCounts] = useState({ active: 0, pending: 0, rejected: 0, expired: 0, total: 0 });
    const [permStatusTab, setPermStatusTab] = useState('ALL'); // ALL, PENDING, ACTIVE, EXPIRED, REJECTED
    const [permLoading, setPermLoading] = useState(false);

    // Fetch businesses, batches, agents
    useEffect(() => {
        if (!isOpen) return;
        const fetchFilters = async () => {
            try {
                const [bizRes, staffRes, batchRes] = await Promise.allSettled([
                    api.get('/admin/whatsapp-call/businesses').catch(() => api.get('/admin/businesses')),
                    api.get('/admin/staff'),
                    api.get('/admin/whatsapp-call/batches').catch(() => api.get('/admin/manager/batches-full'))
                ]);
                if (bizRes.status === 'fulfilled') {
                    const data = bizRes.value.data;
                    setBusinesses(Array.isArray(data) ? data : (data?.businesses || []));
                }
                if (staffRes.status === 'fulfilled') {
                    const data = staffRes.value.data;
                    setAgents(Array.isArray(data) ? data : (data?.staff || []));
                }
                if (batchRes.status === 'fulfilled') {
                    const data = batchRes.value.data;
                    setBatches(Array.isArray(data) ? data : (data?.batches || []));
                }
            } catch (e) {
                console.error("Failed to load initial filters", e);
            }
        };
        fetchFilters();
    }, [isOpen]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (startTime) params.append('startTime', startTime);
            if (endTime) params.append('endTime', endTime);
            if (selectedBusiness !== 'ALL') params.append('businessId', selectedBusiness);
            if (selectedBatch !== 'ALL') params.append('batchId', selectedBatch);
            if (selectedAgent !== 'ALL') params.append('agentId', selectedAgent);
            if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
            if (selectedDirection !== 'ALL') params.append('direction', selectedDirection);

            params.append('_t', Date.now());
            console.log("=== FRONTEND FETCH REPORT URL ===", `/admin/whatsapp-call/report?${params.toString()}`);
            const res = await api.get(`/admin/whatsapp-call/report?${params.toString()}`);
            if (res.data) {
                console.log("=== FRONTEND RECEIVED LOGS ===", res.data.logs?.length);
                setReportData(res.data);
            }
        } catch (error) {
            console.error("Error fetching call report:", error);
            toast.error("Failed to generate call report");
        } finally {
            setLoading(false);
        }
    };

    const fetchPermissions = async () => {
        setPermLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('status', permStatusTab);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (selectedBusiness !== 'ALL') params.append('businessId', selectedBusiness);
            if (selectedBatch !== 'ALL') params.append('batchId', selectedBatch);
            if (selectedAgent !== 'ALL') params.append('staffId', selectedAgent);

            const res = await api.get(`/after-seminar-crm/leads/call-permissions?${params.toString()}`);
            if (res.data) {
                setPermRequests(res.data.leads || []);
                if (res.data.counts) {
                    setPermCounts(res.data.counts);
                }
            }
        } catch (error) {
            console.error("Error fetching call permissions in report:", error);
        } finally {
            setPermLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchReport();
            fetchPermissions();
        }
    }, [isOpen, startDate, endDate, startTime, endTime, selectedBusiness, selectedBatch, selectedAgent, selectedStatus, selectedDirection, permStatusTab]);

    useEffect(() => {
        if (!isOpen || !socket) return;
        const handleUpdate = () => {
            fetchReport();
            fetchPermissions();
        };
        socket.on('call_history_updated', handleUpdate);
        return () => socket.off('call_history_updated', handleUpdate);
    }, [isOpen, socket, startDate, endDate, startTime, endTime, selectedBusiness, selectedBatch, selectedAgent, selectedStatus, selectedDirection, permStatusTab]);

    const filteredBatches = useMemo(() => {
        if (selectedBusiness === 'ALL') return batches;
        return batches.filter(b => String(b.businessId) === String(selectedBusiness) || String(b.business?.id) === String(selectedBusiness));
    }, [batches, selectedBusiness]);

    const filteredLogs = useMemo(() => {
        if (!reportData.logs) return [];
        let list = reportData.logs;

        // Apply strict date range filter on frontend
        if (startDate || endDate) {
            const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
            const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Infinity;
            list = list.filter(log => {
                const logMs = new Date(log.createdAt).getTime();
                return logMs >= startMs && logMs <= endMs;
            });
        }

        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase().trim();
        return list.filter(log => {
            const phone = String(log.leadPhone || '').toLowerCase();
            const name = String(log.leadName || log.lead?.name || '').toLowerCase();
            const batch = String(log.batchName || log.lead?.batchName || '').toLowerCase();
            const agent = String(log.agent?.firstName || '') + ' ' + String(log.agent?.lastName || '');
            return phone.includes(q) || name.includes(q) || batch.includes(q) || agent.toLowerCase().includes(q);
        });
    }, [reportData.logs, searchQuery, startDate, endDate]);

    const dynamicSummary = useMemo(() => {
        const total = filteredLogs.length;
        let missed = 0;
        let completed = 0;
        let rejected = 0;
        let totalDuration = 0;

        filteredLogs.forEach(c => {
            const st = (c.status || '').toUpperCase();
            if (st === 'COMPLETED' || st === 'ANSWERED') completed++;
            else if (st === 'REJECTED' || st === 'BUSY') rejected++;
            else missed++;
            totalDuration += (c.duration || 0);
        });

        const missedRate = total > 0 ? ((missed / total) * 100).toFixed(0) : 0;
        const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

        return {
            total,
            inboundTotal: total,
            missedCalls: missed,
            completedCalls: completed,
            rejectedCalls: rejected,
            missedRate,
            avgDuration,
            totalDuration
        };
    }, [filteredLogs]);

    const filteredPerms = useMemo(() => {
        if (!permRequests) return [];
        if (!searchQuery.trim()) return permRequests;
        const q = searchQuery.toLowerCase().trim();
        return permRequests.filter(l => {
            const phone = String(l.phone || '').toLowerCase();
            const name = String(l.name || '').toLowerCase();
            const batch = String(l.batch?.name || '').toLowerCase();
            const agent = String(l.assignedUser?.firstName || '') + ' ' + String(l.assignedUser?.lastName || '');
            return phone.includes(q) || name.includes(q) || batch.includes(q) || agent.toLowerCase().includes(q);
        });
    }, [permRequests, searchQuery]);

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const getStatusInfo = (lead) => {
        const status = lead.waCallPermissionStatus;
        const expiry = lead.waCallPermissionExpiry;
        
        if (status === 'PENDING') {
            return {
                label: 'Pending Approval (Sent)',
                badge: 'Pending',
                color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                canCall: false
            };
        }
        if (status === 'DISALLOWED') {
            return {
                label: 'Declined by Student',
                badge: 'Declined',
                color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                canCall: false
            };
        }
        if (status === 'ALLOWED') {
            if (!expiry) {
                return {
                    label: 'Always Allowed (Permanent)',
                    badge: 'Permanent',
                    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold',
                    canCall: true,
                    isExpired: false
                };
            }
            const diffMs = new Date(expiry) - new Date();
            if (diffMs <= 0) {
                return {
                    label: 'Permission Expired',
                    badge: 'Expired',
                    color: 'bg-slate-700/50 text-slate-400 border-slate-600',
                    canCall: false,
                    isExpired: true
                };
            }
            const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            if (diffHours <= 24) {
                return {
                    label: `Ends in ${diffHours}h`,
                    badge: `${diffHours}h left`,
                    color: 'bg-teal-500/20 text-teal-300 border-teal-500/30 font-black',
                    canCall: true,
                    isExpired: false
                };
            }
            return {
                label: `Ends in ${diffDays} Days`,
                badge: `${diffDays}d left`,
                color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold',
                canCall: true,
                isExpired: false
            };
        }

        return {
            label: status || 'NONE',
            badge: status || 'NONE',
            color: 'bg-slate-800 text-slate-400 border-slate-700',
            canCall: false
        };
    };

    const handleExportExcel = () => {
        if (activeViewTab === 'REQUESTS') {
            if (!filteredPerms || filteredPerms.length === 0) {
                toast.error("No call permission records to export");
                return;
            }

            const rows = filteredPerms.map((l, index) => {
                const cleanPhone = l.phone ? l.phone.split('_BIZ')[0].split('_')[0] : '';
                const statusInfo = getStatusInfo(l);
                return {
                    "No": index + 1,
                    "Request Date": l.waCallPermissionRequestedAt ? new Date(l.waCallPermissionRequestedAt).toLocaleDateString() : (l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : 'N/A'),
                    "Request Time": l.waCallPermissionRequestedAt ? new Date(l.waCallPermissionRequestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    "Student Phone": cleanPhone || l.phone,
                    "Student Name": l.name || 'Unknown',
                    "Business": l.batch?.business?.name || 'N/A',
                    "Batch": l.batch?.name || 'N/A',
                    "Assigned Coordinator": l.assignedUser ? `${l.assignedUser.firstName || ''} ${l.assignedUser.lastName || ''}`.trim() : 'Unassigned',
                    "Permission Status": statusInfo.label,
                    "Expiration Date/Time": l.waCallPermissionExpiry ? new Date(l.waCallPermissionExpiry).toLocaleString() : 'Permanent'
                };
            });

            const wb = XLSX.utils.book_new();
            const wsData = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, wsData, "Call Permission Requests");

            const fileName = `Call_Permission_Requests_Report_${startDate}_${endDate}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success(`Exported ${filteredPerms.length} call permission records to Excel!`);
            return;
        }

        if (!filteredLogs || filteredLogs.length === 0) {
            toast.error("No call records to export");
            return;
        }

        const rows = filteredLogs.map((c, index) => ({
            "No": index + 1,
            "Date": new Date(c.createdAt).toLocaleDateString(),
            "Time": new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            "Phone": c.leadPhone || 'N/A',
            "Student Name": c.leadName || c.lead?.name || 'Unknown',
            "Direction": c.direction || 'INBOUND',
            "Status": c.status || 'MISSED',
            "Duration (Sec)": c.duration || 0,
            "Duration (Formatted)": formatDuration(c.duration),
            "Business": c.business?.name || 'N/A',
            "Batch": c.batchName || c.lead?.batchName || 'N/A',
            "Handled By Agent": c.agent ? `${c.agent.firstName || ''} ${c.agent.lastName || ''}`.trim() : 'Unanswered / System',
            "Call ID": c.id
        }));

        const summaryRows = [
            { "Metric": "Report Date Range", "Value": `${startDate || 'Start'} to ${endDate || 'End'}` },
            { "Metric": "Time Range", "Value": `${startTime || '00:00'} to ${endTime || '23:59'}` },
            { "Metric": "Total Inbound Calls", "Value": reportData.summary.inboundTotal },
            { "Metric": "Total Missed Calls", "Value": reportData.summary.missedCalls },
            { "Metric": "Total Answered / Completed", "Value": reportData.summary.completedCalls },
            { "Metric": "Total Rejected Calls", "Value": reportData.summary.rejectedCalls },
            { "Metric": "Missed Call Rate", "Value": `${reportData.summary.missedRate}%` },
            { "Metric": "Average Talk Time", "Value": formatDuration(reportData.summary.avgDuration) },
            { "Metric": "Total Talk Time", "Value": formatDuration(reportData.summary.totalDuration) }
        ];

        const wb = XLSX.utils.book_new();
        const wsData = XLSX.utils.json_to_sheet(rows);
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary KPI");
        XLSX.utils.book_append_sheet(wb, wsData, "Call Details");

        const fileName = `Missed_Inbound_Calls_Report_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`Exported ${filteredLogs.length} call records to Excel!`);
    };

    const handleOpenChat = (leadOrLog) => {
        const phone = leadOrLog.leadPhone || leadOrLog.phone || '';
        const cleanPhone = phone ? phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '') : '';
        if (cleanPhone) {
            if (onClose) onClose();
            let path = '/workspace/after-seminar-crm';
            if (leadOrLog.campaignType === 'FREE_SEMINAR') {
                path = '/workspace/crm';
            }
            navigate(`${path}?search=${cleanPhone}`);
        }
    };

    const handleCallBack = (log) => {
        if (!startOutboundCall) {
            toast.error("Call engine not ready");
            return;
        }
        startOutboundCall({
            lead: {
                id: log.lead?.id || null,
                name: log.leadName || log.lead?.name || log.leadPhone,
                phone: log.leadPhone
            },
            businessId: log.businessId,
            campaignType: log.campaignType || 'AFTER_SEMINAR'
        });
    };

    const handleCallLead = (lead) => {
        if (!startOutboundCall) {
            toast.error("Call engine not ready");
            return;
        }
        const bizId = lead.batch?.businessId || lead.batch?.business?.id;
        startOutboundCall({
            lead: {
                id: lead.id,
                name: lead.name,
                phone: lead.phone
            },
            businessId: bizId,
            campaignType: lead.campaignType || 'AFTER_SEMINAR'
        });
    };

    if (!isOpen) return null;

    const { summary, hourlyBreakdown, agentBreakdown } = reportData;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0B1120] border border-emerald-500/30 w-full max-w-7xl h-[90vh] rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#0B1120] to-emerald-950/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                            <Activity size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-white tracking-wide">
                                    Incoming Calls & Permission Requests Analytics Report
                                </h2>
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black px-2 py-0.5 rounded-full">
                                    Live CRM Analytics
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Filter calls, track missed rates, monitor WhatsApp call requests sent to students, and export to Excel
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportExcel}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all hover:scale-105 cursor-pointer"
                            title="Export current view to Excel (.xlsx)"
                        >
                            <Download size={15} /> Export Excel
                        </button>
                        <button 
                            onClick={() => { fetchReport(); fetchPermissions(); }}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} className={(loading || permLoading) ? 'animate-spin text-emerald-400' : ''} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-xl border border-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="p-4 bg-slate-900/70 border-b border-white/5 space-y-3 shrink-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Calendar size={11} className="text-emerald-400" /> Start Date
                            </label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Calendar size={11} className="text-emerald-400" /> End Date
                            </label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={11} className="text-teal-400" /> Start Time
                            </label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Clock size={11} className="text-teal-400" /> End Time
                            </label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Building2 size={11} className="text-blue-400" /> Business
                            </label>
                            <select 
                                value={selectedBusiness} 
                                onChange={(e) => {
                                    setSelectedBusiness(e.target.value);
                                    setSelectedBatch('ALL');
                                }} 
                                className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">🏢 All Businesses</option>
                                {businesses.map(b => ( <option key={b.id} value={b.id}>{b.name}</option> ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Layers size={11} className="text-purple-400" /> Batch
                            </label>
                            <select 
                                value={selectedBatch} 
                                onChange={(e) => setSelectedBatch(e.target.value)} 
                                className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">📁 All Batches {selectedBusiness !== 'ALL' ? `(${filteredBatches.length})` : ''}</option>
                                {filteredBatches.map(b => ( <option key={b.id} value={b.id}>{b.name}</option> ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <User size={11} className="text-cyan-400" /> Coordinator / Staff
                            </label>
                            <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="w-full bg-black/50 border border-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-emerald-500 cursor-pointer">
                                <option value="ALL">👤 All Staff</option>
                                {agents.map(a => ( <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option> ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 text-[11px] font-bold">
                                <button onClick={() => setActiveViewTab('LOGS')} className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${activeViewTab === 'LOGS' ? 'bg-emerald-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                    <PhoneIncoming size={12} /> Call Logs ({filteredLogs.length})
                                </button>
                                <button onClick={() => setActiveViewTab('REQUESTS')} className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${activeViewTab === 'REQUESTS' ? 'bg-teal-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                    <ShieldCheck size={13} className="text-teal-300" /> Call Requests & Approvals ({permCounts.total})
                                </button>
                                <button onClick={() => setActiveViewTab('HOURLY')} className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${activeViewTab === 'HOURLY' ? 'bg-indigo-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                    <BarChart3 size={12} /> Hourly Peak Analysis
                                </button>
                                <button onClick={() => setActiveViewTab('AGENTS')} className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${activeViewTab === 'AGENTS' ? 'bg-purple-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                    <User size={12} /> Staff Breakdown
                                </button>
                            </div>

                            {activeViewTab === 'LOGS' && (
                                <div className="flex gap-2">
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[11px] font-semibold">
                                        <button onClick={() => setSelectedDirection('INBOUND')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedDirection === 'INBOUND' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Inbound</button>
                                        <button onClick={() => setSelectedDirection('OUTBOUND')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedDirection === 'OUTBOUND' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Outbound</button>
                                        <button onClick={() => setSelectedDirection('ALL')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedDirection === 'ALL' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>All</button>
                                    </div>
                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[11px] font-semibold">
                                        <button onClick={() => setSelectedStatus('ALL')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedStatus === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>All Status</button>
                                        <button onClick={() => setSelectedStatus('MISSED')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedStatus === 'MISSED' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Missed</button>
                                        <button onClick={() => setSelectedStatus('COMPLETED')} className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${selectedStatus === 'COMPLETED' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Answered</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative min-w-[260px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search phone, student or staff..." className="w-full bg-black/50 border border-white/10 pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 rounded-xl outline-none focus:border-emerald-500" />
                            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><X size={12} /></button>}
                        </div>
                    </div>
                </div>

                {/* KPI Summary Cards Bar */}
                {activeViewTab === 'REQUESTS' ? (
                    <div className="px-6 py-3 bg-black/40 border-b border-white/5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                        <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl"><span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Send size={11} className="text-teal-400" /> Requests Sent</span><p className="text-xl font-black text-white mt-1">{permCounts.total}</p></div>
                        <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> Active Allowed</span><p className="text-xl font-black text-emerald-400 mt-1">{permCounts.active}</p></div>
                        <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1"><Hourglass size={11} className="text-amber-400" /> Pending Approvals</span><p className="text-xl font-black text-amber-400 mt-1">{permCounts.pending}</p></div>
                        <div className="p-2.5 bg-slate-900/60 border border-slate-600/50 rounded-xl"><span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Clock size={11} className="text-slate-400" /> Expired Requests</span><p className="text-xl font-black text-slate-300 mt-1">{permCounts.expired}</p></div>
                        <div className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1"><XCircle size={11} className="text-rose-400" /> Student Declined</span><p className="text-xl font-black text-rose-400 mt-1">{permCounts.rejected}</p></div>
                        <div className="p-2.5 bg-teal-950/20 border border-teal-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-teal-300 flex items-center gap-1"><ShieldCheck size={11} className="text-teal-400" /> Approval Rate</span><p className="text-xl font-black text-teal-300 mt-1">{permCounts.total > 0 ? ((permCounts.active / permCounts.total) * 100).toFixed(1) : 0}%</p></div>
                    </div>
                ) : (
                    <div className="px-6 py-3 bg-black/40 border-b border-white/5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                        <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl"><span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><PhoneIncoming size={12} className="text-emerald-400" /> Total Inbound</span><p className="text-xl font-black text-white mt-1">{dynamicSummary.inboundTotal}</p></div>
                        <div className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1"><PhoneMissed size={12} className="text-rose-400" /> Missed Calls</span><p className="text-xl font-black text-rose-400 mt-1">{dynamicSummary.missedCalls}</p></div>
                        <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> Answered Calls</span><p className="text-xl font-black text-emerald-400 mt-1">{dynamicSummary.completedCalls}</p></div>
                        <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1"><PhoneOff size={12} className="text-amber-400" /> Rejected / Busy</span><p className="text-xl font-black text-amber-400 mt-1">{dynamicSummary.rejectedCalls}</p></div>
                        <div className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-xl"><span className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1"><TrendingDown size={12} className="text-rose-400" /> Missed Rate</span><p className="text-xl font-black text-rose-400 mt-1">{dynamicSummary.missedRate}%</p></div>
                        <div className="p-2.5 bg-slate-900/60 border border-white/10 rounded-xl"><span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><Clock size={12} className="text-teal-400" /> Avg Talk Time</span><p className="text-xl font-black text-teal-300 mt-1">{formatDuration(dynamicSummary.avgDuration)}</p></div>
                    </div>
                )}

                {/* Content View Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/50">
                    {/* TAB 1: CALL LOGS */}
                    {activeViewTab === 'LOGS' && (
                        loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <RefreshCw className="animate-spin text-emerald-400 mb-3" size={28} />
                                <span className="font-bold text-sm">Loading Call Report & Analytics...</span>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
                                <PhoneIncoming size={36} className="opacity-30 mb-2" />
                                <p className="text-white font-bold text-sm">No Call Records Found</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting your date range, time range or filters.</p>
                            </div>
                        ) : (
                            <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/50 shadow-xl">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-900 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-white/10">
                                            <th className="px-4 py-3">Date & Time</th>
                                            <th className="px-4 py-3">Caller / Phone</th>
                                            <th className="px-4 py-3">Student Name</th>
                                            <th className="px-4 py-3">Business & Batch</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Duration</th>
                                            <th className="px-4 py-3">Agent</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredLogs.map((log) => {
                                            const callDate = new Date(log.createdAt);
                                            const isMissed = log.status === 'MISSED' || log.status === 'NO_ANSWER';
                                            const isCompleted = log.status === 'COMPLETED';
                                            const isRejected = log.status === 'REJECTED';
                                            const bizName = log.business?.name || log.lead?.batch?.business?.name || null;
                                            const bizColor = log.business?.color || '#10b981';

                                            return (
                                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 text-slate-300">
                                                        <div className="font-bold text-white">{callDate.toLocaleDateString()}</div>
                                                        <div className="text-[10px] text-slate-400">{callDate.toLocaleTimeString()}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-white">{log.leadPhone || 'N/A'}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-200">{log.leadName || log.lead?.name || 'Unknown'}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {bizName && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10" style={{ backgroundColor: `${bizColor}20`, color: bizColor }}>{bizName}</span>}
                                                            <span className="text-[11px] text-slate-400 font-medium">{log.batchName || log.lead?.batchName || 'General'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {isMissed ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30"><PhoneMissed size={11} /> Missed Call</span> : isCompleted ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><CheckCircle2 size={11} /> Answered</span> : isRejected ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30"><PhoneOff size={11} /> Rejected</span> : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{log.status}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-200">{formatDuration(log.duration)}</td>
                                                    <td className="px-4 py-3 text-slate-300">
                                                        {log.agent ? <div className="flex items-center gap-1.5 font-bold text-white"><User size={13} className="text-emerald-400" />{log.agent.firstName} {log.agent.lastName}</div> : <span className="text-slate-500 italic text-[11px]">Unanswered</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => handleCallBack(log)} 
                                                                className="p-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/30 transition-all cursor-pointer" 
                                                                title="WhatsApp Call Student"
                                                            >
                                                                <PhoneCall size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleOpenChat(log)} 
                                                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-white/10 transition-colors cursor-pointer" 
                                                                title="Open CRM Chat"
                                                            >
                                                                <ExternalLink size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {/* TAB 2: CALL PERMISSION REQUESTS & APPROVALS */}
                    {activeViewTab === 'REQUESTS' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-white/10">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button onClick={() => setPermStatusTab('ALL')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${permStatusTab === 'ALL' ? 'bg-slate-700 text-white font-black' : 'text-slate-400 hover:text-white'}`}>All Requests ({permCounts.total})</button>
                                    <button onClick={() => setPermStatusTab('ACTIVE')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${permStatusTab === 'ACTIVE' ? 'bg-emerald-600 text-white font-black' : 'text-emerald-400 hover:bg-emerald-950/30'}`}><CheckCircle2 size={12} /> Allowed (Active) ({permCounts.active})</button>
                                    <button onClick={() => setPermStatusTab('PENDING')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${permStatusTab === 'PENDING' ? 'bg-amber-600 text-white font-black' : 'text-amber-400 hover:bg-amber-950/30'}`}><Hourglass size={12} /> Pending Approval ({permCounts.pending})</button>
                                    <button onClick={() => setPermStatusTab('EXPIRED')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${permStatusTab === 'EXPIRED' ? 'bg-slate-600 text-white font-black' : 'text-slate-400 hover:bg-slate-800'}`}><Clock size={12} /> Expired ({permCounts.expired})</button>
                                    <button onClick={() => setPermStatusTab('REJECTED')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${permStatusTab === 'REJECTED' ? 'bg-rose-600 text-white font-black' : 'text-rose-400 hover:bg-rose-950/30'}`}><XCircle size={12} /> Declined ({permCounts.rejected})</button>
                                </div>
                            </div>

                            {permLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <RefreshCw className="animate-spin text-teal-400 mb-3" size={28} />
                                    <span className="font-bold text-sm">Loading Call Permission Requests...</span>
                                </div>
                            ) : filteredPerms.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
                                    <ShieldCheck size={36} className="opacity-30 mb-2" />
                                    <p className="text-white font-bold text-sm">No Call Permission Requests Found</p>
                                    <p className="text-xs text-slate-400 mt-1">No requests match the selected status or filters.</p>
                                </div>
                            ) : (
                                <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/50 shadow-xl">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-900 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-white/10">
                                                <th className="px-4 py-3">#</th>
                                                <th className="px-4 py-3">Request Sent Time</th>
                                                <th className="px-4 py-3">Student WhatsApp & Name</th>
                                                <th className="px-4 py-3">Business & Batch</th>
                                                <th className="px-4 py-3">Assigned Coordinator</th>
                                                <th className="px-4 py-3">Permission Status & Expiry</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredPerms.map((lead, index) => {
                                                const cleanPhone = lead.phone ? lead.phone.split('_BIZ')[0].split('_')[0] : '';
                                                const statusInfo = getStatusInfo(lead);
                                                const reqDate = lead.waCallPermissionRequestedAt ? new Date(lead.waCallPermissionRequestedAt) : (lead.updatedAt ? new Date(lead.updatedAt) : null);
                                                const expiryDate = lead.waCallPermissionExpiry ? new Date(lead.waCallPermissionExpiry) : null;

                                                return (
                                                    <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3 text-slate-500 font-bold">{index + 1}</td>
                                                        <td className="px-4 py-3 text-slate-300">
                                                            {reqDate ? (
                                                                <div>
                                                                    <div className="font-bold text-white">{reqDate.toLocaleDateString()}</div>
                                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} className="text-teal-400" />{reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                                </div>
                                                            ) : <span className="text-slate-500 italic text-[11px]">N/A</span>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-white">{cleanPhone || lead.phone}</div>
                                                            <div className="text-[11px] text-slate-300 font-semibold mt-0.5">{lead.name || <span className="text-slate-500 italic">No Name</span>}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-0.5 items-start">
                                                                {lead.batch?.business?.name && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">{lead.batch.business.name}</span>}
                                                                <span className="text-[11px] text-slate-400 font-medium">{lead.batch?.name || 'General Batch'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-300">
                                                            {lead.assignedUser ? <div className="flex items-center gap-1.5 font-bold text-white"><User size={13} className="text-teal-400" />{lead.assignedUser.firstName} {lead.assignedUser.lastName}</div> : <span className="text-slate-500 italic text-[11px]">Unassigned</span>}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusInfo.color}`}>
                                                                    {statusInfo.canCall && <CheckCircle2 size={11} />}
                                                                    {lead.waCallPermissionStatus === 'PENDING' && <Hourglass size={11} />}
                                                                    {lead.waCallPermissionStatus === 'DISALLOWED' && <XCircle size={11} />}
                                                                    {statusInfo.label}
                                                                </span>
                                                                {expiryDate && <span className="text-[10px] text-slate-400 flex items-center gap-1"><CalendarDays size={10} className="text-teal-400" /> Expires: {expiryDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} {expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {statusInfo.canCall && <button onClick={() => handleCallLead(lead)} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 shadow-emerald-900/30 cursor-pointer"><PhoneCall size={10} /> Call</button>}
                                                                <button onClick={() => handleOpenChat(lead)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border border-white/10 cursor-pointer"><MessageCircle size={10} /> Chat</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: HOURLY PEAK ANALYSIS */}
                    {activeViewTab === 'HOURLY' && (
                        <div className="space-y-6">
                            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                                    <BarChart3 className="text-emerald-400" size={18} />
                                    Hourly Call Distribution & Missed Peak Analysis (24 Hours)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {hourlyBreakdown.map((h) => {
                                        const missedPercentage = h.total > 0 ? Math.round((h.missed / h.total) * 100) : 0;
                                        return (
                                            <div key={h.hour} className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-black text-white">{h.label}</span>
                                                    <span className="text-slate-400 font-bold">{h.total} Calls</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                    <div className="bg-emerald-500 h-full" style={{ width: `${h.total > 0 ? (h.completed / h.total) * 100 : 0}%` }} title={`Answered: ${h.completed}`} />
                                                    <div className="bg-rose-500 h-full" style={{ width: `${h.total > 0 ? (h.missed / h.total) * 100 : 0}%` }} title={`Missed: ${h.missed}`} />
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                    <span className="text-emerald-400 font-semibold">Answered: {h.completed}</span>
                                                    <span className="text-rose-400 font-semibold">Missed: {h.missed} ({missedPercentage}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: STAFF BREAKDOWN */}
                    {activeViewTab === 'AGENTS' && (
                        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                            <h3 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                                <User className="text-emerald-400" size={18} />
                                Staff / Coordinator Handled Performance
                            </h3>
                            <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/50">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-900 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-white/10">
                                            <th className="px-4 py-3">Coordinator / Staff</th>
                                            <th className="px-4 py-3">Total Calls Handled</th>
                                            <th className="px-4 py-3">Answered</th>
                                            <th className="px-4 py-3">Missed / Unanswered</th>
                                            <th className="px-4 py-3">Total Talk Time</th>
                                            <th className="px-4 py-3">Answer Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {agentBreakdown.map(agent => {
                                            const ansRate = agent.total > 0 ? Math.round((agent.completed / agent.total) * 100) : 0;
                                            return (
                                                <tr key={agent.agentId || 'unassigned'} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-white flex items-center gap-2"><User size={13} className="text-emerald-400" />{agent.name}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-200">{agent.total}</td>
                                                    <td className="px-4 py-3 font-bold text-emerald-400">{agent.completed}</td>
                                                    <td className="px-4 py-3 font-bold text-rose-400">{agent.missed}</td>
                                                    <td className="px-4 py-3 text-slate-300">{formatDuration(agent.duration)}</td>
                                                    <td className="px-4 py-3 font-black text-slate-200"><span className={`px-2 py-0.5 rounded-md text-[10px] ${ansRate >= 80 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{ansRate}%</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-950 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-400 shrink-0">
                    <div>
                        {activeViewTab === 'REQUESTS' ? (
                            <span>
                                Showing <strong className="text-white">{filteredPerms.length}</strong> Call Permission Requests between{' '}
                                <strong className="text-white">{startDate || 'Any'}</strong> and{' '}
                                <strong className="text-white">{endDate || 'Any'}</strong>
                            </span>
                        ) : (
                            <span>
                                Showing <strong className="text-white">{filteredLogs.length}</strong> calls between{' '}
                                <strong className="text-white">{startDate || 'Any'}</strong> and{' '}
                                <strong className="text-white">{endDate || 'Any'}</strong>
                                {startTime && endTime && (
                                    <span> (Time: <strong className="text-emerald-400">{startTime} - {endTime}</strong>)</span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors cursor-pointer">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

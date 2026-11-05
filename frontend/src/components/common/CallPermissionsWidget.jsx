import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaWhatsapp, 
    FaPhone, 
    FaSearch, 
    FaTimes, 
    FaCheckCircle, 
    FaClock, 
    FaUser, 
    FaExternalLinkAlt, 
    FaSyncAlt, 
    FaFilter,
    FaExclamationTriangle,
    FaFileExcel,
    FaBan,
    FaHourglassHalf,
    FaCalendarAlt
} from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function CallPermissionsWidget({ asModal = false, onClose }) {
    const { startOutboundCall, socket } = useCall();
    const navigate = useNavigate();

    const loggedUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}') || {};
        } catch {
            return {};
        }
    }, []);

    const roleUpper = (loggedUser?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const deptUpper = (loggedUser?.department || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const isStudent = roleUpper === 'STUDENT' || roleUpper === 'USER';
    const isExcludedDept = ['DELIVERY', 'FINANCE', 'PHYSICAL', 'SOCIAL_MEDIA', 'TECHNICAL'].includes(deptUpper);
    const isSuperOrAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(roleUpper);
    const isCoordinator = ['COORDINATOR', 'CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(roleUpper) || ['CLASS_COORDINATION', 'CALL_CENTER'].includes(deptUpper);
    const isAllowedManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(roleUpper) && !isExcludedDept;
    const isCrmEligible = (isSuperOrAdmin || isCoordinator || isAllowedManager) && !isExcludedDept && !isStudent;
    const isManagerOrAdmin = isSuperOrAdmin || (isAllowedManager && !isExcludedDept);

    const [leads, setLeads] = useState([]);
    const [counts, setCounts] = useState({ active: 0, pending: 0, rejected: 0, expired: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [statusTab, setStatusTab] = useState('ACTIVE'); // 'ACTIVE', 'PENDING', 'REJECTED', 'EXPIRED', 'ALL'
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState('ALL');
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('ALL');
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('ALL');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch businesses, batches & staff if manager
    useEffect(() => {
        if (!isManagerOrAdmin) return;
        const fetchFilters = async () => {
            try {
                const [bizRes, staffRes, batchRes] = await Promise.allSettled([
                    axios.get('/admin/whatsapp-call/businesses').catch(() => axios.get('/admin/businesses')),
                    axios.get('/admin/staff'),
                    axios.get('/admin/whatsapp-call/batches').catch(() => axios.get('/admin/manager/batches-full'))
                ]);
                if (bizRes.status === 'fulfilled') {
                    const data = bizRes.value.data;
                    setBusinesses(Array.isArray(data) ? data : (data?.businesses || []));
                }
                if (staffRes.status === 'fulfilled') {
                    const data = staffRes.value.data;
                    setStaffList(Array.isArray(data) ? data : (data?.staff || []));
                }
                if (batchRes.status === 'fulfilled') {
                    const data = batchRes.value.data;
                    setBatches(Array.isArray(data) ? data : (data?.batches || []));
                }
            } catch (err) {
                console.error("Failed to fetch filter options:", err);
            }
        };
        fetchFilters();
    }, [isManagerOrAdmin]);

    const fetchPermissions = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const params = {
                status: statusTab,
                search: debouncedSearch
            };
            if (selectedBusiness !== 'ALL') params.businessId = selectedBusiness;
            if (selectedBatch !== 'ALL') params.batchId = selectedBatch;
            if (selectedStaff !== 'ALL') params.staffId = selectedStaff;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await axios.get('/after-seminar-crm/leads/call-permissions', { params });
            if (res.data) {
                setLeads(res.data.leads || []);
                if (res.data.counts) {
                    setCounts(res.data.counts);
                }
            }
        } catch (error) {
            console.error("Failed to fetch call permissions:", error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, [statusTab, debouncedSearch, selectedBusiness, selectedBatch, selectedStaff, startDate, endDate]);

    // Listen for real-time socket events
    useEffect(() => {
        if (!socket) return;

        const handleGranted = (data) => {
            toast.success(`🎉 Call Permission Granted: ${data.phone || 'Student'}!`, {
                icon: '📞',
                duration: 5000
            });
            fetchPermissions(false);
        };

        const handleUpdated = () => {
            fetchPermissions(false);
        };

        socket.on('wa_call_permission_granted', handleGranted);
        socket.on('wa_call_permission_updated', handleUpdated);

        return () => {
            socket.off('wa_call_permission_granted', handleGranted);
            socket.off('wa_call_permission_updated', handleUpdated);
        };
    }, [socket]);

    const getStatusInfo = (lead) => {
        const status = lead.waCallPermissionStatus;
        const expiry = lead.waCallPermissionExpiry;

        if (status === 'PENDING') {
            return {
                label: 'Pending Approval',
                badge: 'Awaiting Student',
                color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
                canCall: false,
                isPending: true
            };
        }

        if (status === 'DISALLOWED') {
            return {
                label: 'Rejected by Student',
                badge: 'Declined',
                color: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
                canCall: false,
                isRejected: true
            };
        }

        if (status === 'ALLOWED') {
            if (!expiry) {
                return {
                    label: 'Always Allowed (Permanent)',
                    badge: 'Permanent',
                    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
                color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
        if (!leads || leads.length === 0) {
            toast.error("No call request records to export");
            return;
        }

        const rows = leads.map((l, idx) => {
            const cleanPhone = l.phone ? l.phone.split('_BIZ')[0].split('_')[0] : '';
            const statusInfo = getStatusInfo(l);
            return {
                "No": idx + 1,
                "Request Date": l.waCallPermissionRequestedAt ? new Date(l.waCallPermissionRequestedAt).toLocaleDateString() : (l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : 'N/A'),
                "Request Time": l.waCallPermissionRequestedAt ? new Date(l.waCallPermissionRequestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                "Phone": cleanPhone,
                "Student Name": l.name || 'Unknown',
                "Call Permission Status": l.waCallPermissionStatus,
                "Status Detail": statusInfo.label,
                "Expiry Date": l.waCallPermissionExpiry ? new Date(l.waCallPermissionExpiry).toLocaleString() : 'Permanent',
                "Business": l.batch?.business?.name || 'N/A',
                "Batch": l.batch?.name || 'N/A',
                "Assigned Staff": l.assignedUser ? `${l.assignedUser.firstName || ''} ${l.assignedUser.lastName || ''}`.trim() : 'Unassigned',
                "Lead ID": l.id
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Call Requests History");
        XLSX.writeFile(wb, `Call_Requests_History_${statusTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success(`Exported ${leads.length} records to Excel!`);
    };

    const handleCallStudent = (lead) => {
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

    const handleOpenChat = (lead) => {
        const cleanPhone = lead.phone ? lead.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '') : '';
        
        let path = '/workspace/after-seminar-crm';
        if (lead.campaignType === 'FREE_SEMINAR') {
            path = '/workspace/crm';
        }

        if (onClose) onClose();
        navigate(`${path}?search=${cleanPhone}`);
    };

    if (!isCrmEligible) return null;

    return (
        <div className={asModal ? "fixed bottom-16 right-6 w-[520px] max-w-[calc(100vw-2rem)] bg-[#0B1120]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.25)] flex flex-col max-h-[660px] h-[640px] z-[9999] animate-fade-in-up overflow-hidden" : "w-full bg-[#0B1120]/95 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl flex flex-col h-[640px]"}>
            {/* Top Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-emerald-500/30 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-inner">
                        <FaWhatsapp size={18} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-black text-sm tracking-wide flex items-center gap-1.5">
                                WhatsApp Call Requests History
                            </h3>
                            <span className="bg-emerald-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                {counts.active} Allowed
                            </span>
                        </div>
                        <p className="text-slate-400 text-[10px] font-medium">History of call permission requests sent to students</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={handleExportExcel}
                        className="bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        title="Export to Excel"
                    >
                        <FaFileExcel size={11} /> Export
                    </button>
                    <button 
                        onClick={() => fetchPermissions(true)} 
                        className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        title="Refresh List"
                    >
                        <FaSyncAlt size={12} className={loading ? 'animate-spin text-emerald-400' : ''} />
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="Close"
                        >
                            <FaTimes size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="p-3 bg-slate-900/60 border-b border-white/5 space-y-2.5 shrink-0">
                {/* Status Tabs */}
                <div className="grid grid-cols-5 gap-1 p-1 bg-black/40 rounded-xl border border-white/10 text-[10px] font-bold">
                    <button 
                        onClick={() => setStatusTab('ACTIVE')} 
                        className={`py-1 px-1.5 rounded-lg transition-all text-center truncate ${statusTab === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
                        title="Active Allowed Permissions"
                    >
                        Allowed ({counts.active})
                    </button>
                    <button 
                        onClick={() => setStatusTab('PENDING')} 
                        className={`py-1 px-1.5 rounded-lg transition-all text-center truncate ${statusTab === 'PENDING' ? 'bg-amber-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
                        title="Pending student response"
                    >
                        Pending ({counts.pending || 0})
                    </button>
                    <button 
                        onClick={() => setStatusTab('REJECTED')} 
                        className={`py-1 px-1.5 rounded-lg transition-all text-center truncate ${statusTab === 'REJECTED' ? 'bg-rose-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
                        title="Rejected by student"
                    >
                        Denied ({counts.rejected || 0})
                    </button>
                    <button 
                        onClick={() => setStatusTab('EXPIRED')} 
                        className={`py-1 px-1.5 rounded-lg transition-all text-center truncate ${statusTab === 'EXPIRED' ? 'bg-slate-700 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
                        title="Expired permissions"
                    >
                        Expired ({counts.expired || 0})
                    </button>
                    <button 
                        onClick={() => setStatusTab('ALL')} 
                        className={`py-1 px-1.5 rounded-lg transition-all text-center truncate ${statusTab === 'ALL' ? 'bg-blue-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'}`}
                        title="All Request History"
                    >
                        All ({counts.total || 0})
                    </button>
                </div>

                {/* Search Bar & Date Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <FaSearch size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search student name or phone..."
                            className="w-full bg-black/40 border border-white/10 pl-7 pr-6 py-1 text-xs text-white placeholder-slate-500 rounded-xl outline-none focus:border-emerald-500 transition-colors"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <FaTimes size={9} />
                            </button>
                        )}
                    </div>
                    
                    <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-black/40 border border-white/10 text-[10px] text-white rounded-xl px-2 py-1 outline-none focus:border-emerald-500"
                        title="Filter by request date"
                    />
                </div>

                {/* Manager / Admin Dropdowns */}
                {isManagerOrAdmin && (
                    <div className="flex gap-1.5">
                        {businesses.length > 0 && (
                            <select 
                                value={selectedBusiness} 
                                onChange={(e) => setSelectedBusiness(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 text-[10px] font-bold text-slate-300 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">🏢 All Biz</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        {batches.length > 0 && (
                            <select 
                                value={selectedBatch} 
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 text-[10px] font-bold text-slate-300 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">📁 All Batches</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        {staffList.length > 0 && (
                            <select 
                                value={selectedStaff} 
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 text-[10px] font-bold text-slate-300 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">👤 All Staff</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>{s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim()}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}
            </div>

            {/* Leads List */}
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500 text-xs">
                        <FaSyncAlt className="animate-spin text-emerald-400 mb-2" size={20} />
                        <span>Loading call requests history...</span>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500 text-center px-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 mb-2">
                            <FaWhatsapp size={22} className="opacity-40" />
                        </div>
                        <p className="text-white font-bold text-xs">No Call Requests Found</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[260px]">
                            {searchQuery ? "No matching students found for your search query." : "When call permission requests are sent to students, their approval history appears here."}
                        </p>
                    </div>
                ) : (
                    leads.map(lead => {
                        const statusInfo = getStatusInfo(lead);
                        const cleanPhone = lead.phone ? lead.phone.split('_BIZ')[0].split('_')[0] : '';
                        const bizName = lead.batch?.business?.name || lead.batch?.name || null;
                        const bizColor = lead.batch?.business?.color || '#10b981';
                        const reqDate = lead.waCallPermissionRequestedAt ? new Date(lead.waCallPermissionRequestedAt) : (lead.updatedAt ? new Date(lead.updatedAt) : null);

                        return (
                            <div 
                                key={lead.id}
                                className="p-3 rounded-xl border bg-slate-900/80 hover:bg-slate-800/90 transition-all border-white/10 hover:border-emerald-500/40 shadow-sm"
                            >
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-black text-sm tracking-wide truncate">
                                                {cleanPhone}
                                            </span>
                                            {bizName && (
                                                <span 
                                                    className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-white/10 truncate max-w-[120px]"
                                                    style={{ backgroundColor: `${bizColor}20`, color: bizColor }}
                                                >
                                                    {bizName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-300 text-xs font-semibold truncate mt-0.5">
                                            {lead.name || 'Student'}
                                        </p>
                                    </div>

                                    {/* Permission Status Pill */}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border shrink-0 ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                </div>

                                {/* Meta details */}
                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 truncate">
                                        {lead.assignedUser ? (
                                            <span className="flex items-center gap-1 text-slate-300 truncate">
                                                <FaUser size={9} className="text-emerald-400" /> {lead.assignedUser.firstName || lead.assignedUser.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 italic">Unassigned</span>
                                        )}
                                        {reqDate && (
                                            <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-slate-400 flex items-center gap-1">
                                                    <FaCalendarAlt size={9} className="text-teal-400" />
                                                    {reqDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex items-center gap-1.5">
                                        {statusInfo.canCall && (
                                            <button
                                                onClick={() => handleCallStudent(lead)}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 shadow-emerald-900/30"
                                                title="Call Now via WhatsApp WebRTC"
                                            >
                                                <FaPhone size={9} /> Call
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenChat(lead)}
                                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border border-white/10"
                                            title="Open CRM & Chat"
                                        >
                                            <FaExternalLinkAlt size={9} /> Chat
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Status bar */}
            <div className="px-4 py-2 bg-black/50 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-400 shrink-0">
                <span>Total Requests: <strong className="text-white">{counts.total}</strong></span>
                <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                        <FaHourglassHalf size={10} /> Pending: {counts.pending || 0}
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <FaCheckCircle size={10} /> Allowed: {counts.active}
                    </span>
                </div>
            </div>
        </div>
    );
}

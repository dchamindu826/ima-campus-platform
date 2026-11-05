import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from '../../api/axios';
import { 
    FaPhoneSlash, 
    FaTimes, 
    FaSearch, 
    FaCheck, 
    FaUserCheck, 
    FaCalendarAlt, 
    FaBuilding, 
    FaUsers, 
    FaChartBar, 
    FaPhoneAlt, 
    FaWhatsapp, 
    FaSync, 
    FaRegClock, 
    FaCheckCircle, 
    FaTimesCircle, 
    FaExclamationTriangle, 
    FaChevronRight, 
    FaSave, 
    FaRedoAlt, 
    FaExternalLinkAlt, 
    FaCommentDots,
    FaPaperPlane
} from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BusinessBadge from './BusinessBadge';
import { useCall } from '../../contexts/CallContext';

export default function StaffMissedCallTasksDrawer({ isOpen, onClose, onTaskCompleted }) {
    const navigate = useNavigate();
    const { startOutboundCall, socket } = useCall?.() || {};
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'COMPLETED' | 'ALL'
    const [tasks, setTasks] = useState([]);
    const [summary, setSummary] = useState({ total: 0, pending: 0, completed: 0, answered: 0 });
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Local state for editing draft remark/outcome per task
    const [taskDrafts, setTaskDrafts] = useState({});
    const [savingTaskId, setSavingTaskId] = useState(null);
    const [localPermissions, setLocalPermissions] = useState({}); // taskId -> 'ALLOWED' | 'PENDING' | 'NONE'

    useEffect(() => {
        if (tasks.length > 0) {
            const initialPerms = {};
            tasks.forEach(t => {
                if (t.waCallPermissionStatus) {
                    initialPerms[t.id] = t.waCallPermissionStatus;
                }
            });
            setLocalPermissions(initialPerms);
        }
    }, [tasks]);

    const getTaskPermissionStatus = useCallback((task) => {
        if (task.waCallPermissionStatus === 'ALLOWED') return 'ALLOWED';
        return localPermissions[task.id] || task.waCallPermissionStatus || 'NONE';
    }, [localPermissions]);

    const fetchMyTasks = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/missed-call-tasks/my-tasks', {
                params: {
                    date: activeTab === 'COMPLETED' ? selectedDate : undefined,
                    status: activeTab === 'ALL' ? undefined : activeTab
                },
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.success) {
                setTasks(res.data.tasks || []);
                setSummary(res.data.summary || { total: 0, pending: 0, completed: 0, answered: 0 });
            }
        } catch (error) {
            console.error("Failed to fetch my missed call tasks:", error);
            if (!silent) toast.error("Failed to load your assigned missed call tasks");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [selectedDate, activeTab]);

    useEffect(() => {
        if (isOpen) {
            fetchMyTasks();
        }
    }, [isOpen, fetchMyTasks]);

    // Socket listener for live assignment notifications
    useEffect(() => {
        if (!socket) return;
        const handleNewAssignment = () => {
            toast.success("New missed call task assigned to you!", { icon: '📞' });
            fetchMyTasks(true);
        };
        socket.on('missed_call_task_assigned', handleNewAssignment);
        return () => {
            socket.off('missed_call_task_assigned', handleNewAssignment);
        };
    }, [socket, fetchMyTasks]);

    // Handle draft field change
    const handleDraftChange = (taskId, field, value) => {
        setTaskDrafts(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                [field]: value
            }
        }));
    };

    // Helper to format clean phone
    const getCleanPhone = (phone) => {
        const raw = String(phone || '').split('_')[0].replace(/[^0-9]/g, '');
        return raw.startsWith('0') ? '94' + raw.substring(1) : raw;
    };

    // Helper to format call time safely
    const formatCallTime = (task) => {
        const rawDate = task.callTime || task.createdAt || task.missedAt;
        if (!rawDate) return 'N/A';
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Save/Complete outcome
    const handleSaveOutcome = async (task) => {
        const draft = taskDrafts[task.id] || {};
        const outcome = draft.outcome || task.callOutcome || task.outcome || 'ANSWERED';
        const remarks = draft.remarks !== undefined ? draft.remarks : (task.remarks || '');
        const callAttempts = draft.callAttempts !== undefined ? draft.callAttempts : (task.callAttempts || 1);

        if (!outcome) {
            return toast.error("Please select a call outcome.");
        }

        setSavingTaskId(task.id);
        const loadToast = toast.loading("Saving call outcome...");
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/missed-call-tasks/update-outcome', {
                taskId: task.id,
                callOutcome: outcome,
                outcome: outcome,
                remarks,
                callAttempts,
                status: 'COMPLETED',
                isCompleted: true
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.success) {
                toast.success("Task updated & marked completed!", { id: loadToast });
                // Clean draft
                setTaskDrafts(prev => {
                    const next = { ...prev };
                    delete next[task.id];
                    return next;
                });
                fetchMyTasks(true);
                if (onTaskCompleted) onTaskCompleted();
            } else {
                toast.error(res.data?.message || "Failed to update task", { id: loadToast });
            }
        } catch (error) {
            console.error("Save outcome error:", error);
            toast.error(error.response?.data?.message || "Failed to save outcome", { id: loadToast });
        } finally {
            setSavingTaskId(null);
        }
    };

    // Quick trigger outbound call
    const handleCallNow = (task) => {
        if (!startOutboundCall) {
            return toast.error("WhatsApp calling service not initialized");
        }
        const cleanPhone = getCleanPhone(task.phone);
        if (!cleanPhone) {
            return toast.error("Invalid phone number for call");
        }

        // Prime audio sink on direct user gesture so browser never blocks WebRTC incoming sound
        try {
            const sink = document.getElementById('webrtc-remote-audio-sink') || document.querySelector('audio');
            if (sink) sink.play().catch(() => {});
        } catch (e) {}

        const targetCampaign = (task.source === 'AFTER_SEMINAR' || Boolean(task.batchId)) ? 'AFTER_SEMINAR' : (task.source || 'FREE_SEMINAR');

        startOutboundCall({
            lead: {
                id: task.existingLeadId || task.leadId || null,
                phone: cleanPhone,
                name: task.studentName || task.name || cleanPhone,
                businessId: task.businessId,
                batchId: task.batchId,
                batch: task.batch,
                business: task.business
            },
            businessId: task.businessId,
            campaignType: targetCampaign
        });
        
        // Auto increment attempts draft
        const currentDraft = taskDrafts[task.id] || {};
        const currentAttempts = currentDraft.callAttempts !== undefined ? currentDraft.callAttempts : (task.callAttempts || 0);
        handleDraftChange(task.id, 'callAttempts', currentAttempts + 1);
    };

    // Send WhatsApp Call Permission Template
    const handleSendPermission = async (task) => {
        const currentStatus = getTaskPermissionStatus(task);
        if (currentStatus === 'ALLOWED') {
            return toast.success("Call permission is already approved by student! You can place calls directly via WA.", { icon: '✅' });
        }
        if (currentStatus === 'PENDING') {
            return toast("Call permission request already sent! Waiting for student to accept on WhatsApp.", { icon: '⏳' });
        }

        const toastId = toast.loading("Sending WhatsApp call permission template...");
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/whatsapp-call/send-permission-request', {
                to: task.phone,
                businessId: task.businessId,
                campaignType: task.batch?.business?.id ? 'AFTER_SEMINAR' : (task.source || 'FREE_SEMINAR')
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data?.success) {
                const newStatus = res.data.status || 'PENDING';
                setLocalPermissions(prev => ({ ...prev, [task.id]: newStatus }));

                if (newStatus === 'ALLOWED' || res.data.alreadyAllowed) {
                    toast.success(res.data.message || "Call permission is already approved by student! You can call directly.", { id: toastId, duration: 6000, icon: '✅' });
                } else if (res.data.alreadySent) {
                    toast(res.data.message || "A call permission request was already sent to this student recently. Waiting for approval.", { id: toastId, duration: 6000, icon: '⏳' });
                } else {
                    toast.success(res.data.message || "Call permission template sent to student's WhatsApp! 📩", { id: toastId, duration: 6000 });
                }
            } else {
                toast.error(res.data?.error || res.data?.message || "Failed to send permission request", { id: toastId, duration: 5000 });
            }
        } catch (err) {
            console.error("Send permission error:", err);
            const msg = err.response?.data?.error || err.response?.data?.message || "Failed to send call permission template";
            toast.error(msg, { id: toastId, duration: 5000 });
        }
    };

    // Open WhatsApp Chat Directly in CRM (Same Tab, Close Drawer, Select ALL Tab)
    const handleOpenCrmChat = (task) => {
        const clean = getCleanPhone(task.phone);
        if (!clean) return toast.error("Invalid phone number");
        const isAfterSeminar = task.source === 'AFTER_SEMINAR' || Boolean(task.batchId) || Boolean(task.batch);
        const path = isAfterSeminar ? '/workspace/after-seminar-crm' : '/workspace/crm';
        if (onClose) onClose();
        navigate(`${path}?search=${clean}&tab=ALL`);
    };

    // Open Phone Dialer
    const handleNormalDial = (task) => {
        const clean = getCleanPhone(task.phone);
        if (!clean) return toast.error("Invalid phone number");
        window.open(`tel:${clean}`, '_self');
    };

    // Filter tasks by search query
    const filteredTasks = useMemo(() => {
        if (!searchQuery.trim()) return tasks;
        const q = searchQuery.toLowerCase().trim();
        return tasks.filter(t => 
            (t.phone && t.phone.toLowerCase().includes(q)) ||
            (t.studentName && t.studentName.toLowerCase().includes(q)) ||
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.business?.name && t.business.name.toLowerCase().includes(q)) ||
            (t.batch?.name && t.batch.name.toLowerCase().includes(q)) ||
            (t.remarks && t.remarks.toLowerCase().includes(q))
        );
    }, [tasks, searchQuery]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            <div 
                className="w-full max-w-2xl bg-[#0b111e] border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden animate-slide-left text-slate-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 bg-[#111c30] border-b border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                            <FaPhoneSlash size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                Assigned Missed Call Tasks
                                {summary.pending > 0 && (
                                    <span className="px-2 py-0.5 text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full animate-pulse">
                                        {summary.pending} Pending
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-400">Handle incoming missed calls distributed by your manager</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchMyTasks()}
                            disabled={loading}
                            title="Refresh"
                            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <FaSync size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            <FaTimes size={16} />
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Bar */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-[#0e1726] border-b border-white/5 shrink-0 text-center">
                    <div className="bg-[#152238] p-2 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total</span>
                        <span className="text-base font-black text-white">{summary.total}</span>
                    </div>
                    <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                        <span className="text-[10px] text-rose-400 font-bold block uppercase tracking-wider">Pending</span>
                        <span className="text-base font-black text-rose-400">{summary.pending}</span>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">Completed</span>
                        <span className="text-base font-black text-emerald-400">{summary.completed}</span>
                    </div>
                    <div className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20">
                        <span className="text-[10px] text-blue-400 font-bold block uppercase tracking-wider">Answered</span>
                        <span className="text-base font-black text-blue-400">{summary.answered}</span>
                    </div>
                </div>

                {/* Filters & Tabs */}
                <div className="p-3 bg-[#0d1522] border-b border-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    {/* Status Tabs */}
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('PENDING')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'PENDING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Pending ({summary.pending})
                        </button>
                        <button
                            onClick={() => setActiveTab('COMPLETED')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Completed ({summary.completed})
                        </button>
                        <button
                            onClick={() => setActiveTab('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'ALL'
                                    ? 'bg-white/10 text-white border border-white/10 shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            All ({summary.total})
                        </button>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
                        <FaCalendarAlt size={12} className="text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent text-xs text-slate-200 font-semibold outline-none cursor-pointer"
                        />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 bg-[#0b111e] border-b border-white/5 shrink-0">
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by phone, name, business, batch, remarks..."
                            className="w-full bg-[#131c2d] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-all"
                        />
                    </div>
                </div>

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p className="text-xs font-semibold">Loading your assigned tasks...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 mb-3 border border-white/5">
                                <FaCheckCircle size={28} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-400">No Missed Call Tasks Found</h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                {activeTab === 'PENDING' 
                                    ? "Great job! You have no pending missed call tasks for this date."
                                    : "No tasks match your selected filters."}
                            </p>
                        </div>
                    ) : (
                        filteredTasks.map(task => {
                            const draft = taskDrafts[task.id] || {};
                            const currentOutcome = draft.outcome !== undefined ? draft.outcome : (task.callOutcome || task.outcome || 'ANSWERED');
                            const currentRemarks = draft.remarks !== undefined ? draft.remarks : (task.remarks || '');
                            const currentAttempts = draft.callAttempts !== undefined ? draft.callAttempts : (task.callAttempts || 0);
                            const isCompleted = task.status === 'COMPLETED';
                            const displayName = task.studentName || task.name;

                            return (
                                <div
                                    key={task.id}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        isCompleted
                                            ? 'bg-[#101b2b]/60 border-white/5 opacity-85'
                                            : 'bg-[#121e33] border-amber-500/20 shadow-lg shadow-black/20 hover:border-amber-500/40'
                                    }`}
                                >
                                    {/* Task Card Top Row */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md ${
                                                isCompleted 
                                                    ? 'bg-emerald-600' 
                                                    : 'bg-gradient-to-tr from-amber-600 to-rose-600'
                                            }`}>
                                                <FaPhoneSlash size={16} />
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-white tracking-wide">
                                                        {task.phone}
                                                    </span>
                                                    {displayName && displayName !== task.phone && (
                                                        <span className="text-xs font-semibold text-slate-300">
                                                            ({displayName})
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta Info */}
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {task.business && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                                                            <FaBuilding size={9} /> {task.business.name}
                                                        </span>
                                                    )}
                                                    {task.batch && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                            {task.batch.name}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                                        <FaRegClock size={9} /> {formatCallTime(task)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge & Actions */}
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            {isCompleted ? (
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider flex items-center gap-1 ${
                                                    (task.callOutcome || task.outcome) === 'ANSWERED'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                        : (task.callOutcome || task.outcome) === 'NO_ANSWER'
                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                        : (task.callOutcome || task.outcome) === 'REJECTED'
                                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                }`}>
                                                    <FaCheckCircle size={10} /> {task.callOutcome || task.outcome || 'COMPLETED'}
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                                                    Pending Callback
                                                </span>
                                            )}

                                             {/* Action Call Buttons Group */}
                                            <div className="flex items-center gap-1.5 mt-1">
                                                {/* Main System WhatsApp VoIP Call */}
                                                <button
                                                    onClick={() => handleCallNow(task)}
                                                    title="Call student directly via WhatsApp Calling API & Audio Engine"
                                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/40 flex items-center gap-1.5 active:scale-95"
                                                >
                                                    <FaWhatsapp size={14} className="animate-pulse" />
                                                    <span>Call via WA</span>
                                                </button>

                                                {/* Send WhatsApp Call Permission Request Status & Button */}
                                                {(() => {
                                                    const permStatus = getTaskPermissionStatus(task);
                                                    if (permStatus === 'ALLOWED') {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => toast.success("Call permission is already allowed by student! In-app WA calls will connect.", { icon: '✅' })}
                                                                title="Call permission is approved by student"
                                                                className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                                            >
                                                                <FaCheckCircle size={11} className="text-emerald-400" />
                                                                <span>Allowed</span>
                                                            </button>
                                                        );
                                                    }
                                                    if (permStatus === 'PENDING') {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => toast("Call permission request already sent! Waiting for student to accept on WhatsApp.", { icon: '⏳' })}
                                                                title="Permission request already sent. Waiting for student to accept."
                                                                className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                                            >
                                                                <FaRegClock size={11} className="text-amber-400 animate-pulse" />
                                                                <span>Waiting</span>
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendPermission(task)}
                                                            title="Send WhatsApp Call Permission Request Template to student"
                                                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                                                        >
                                                            <FaPaperPlane size={11} />
                                                            <span>Req Perm</span>
                                                        </button>
                                                    );
                                                })()}

                                                {/* Open WhatsApp Chat Directly in CRM */}
                                                <button
                                                    onClick={() => handleOpenCrmChat(task)}
                                                    title="Open WhatsApp Chat in CRM"
                                                    className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                                                >
                                                    <FaCommentDots size={13} />
                                                </button>

                                                {/* Direct Regular Phone Call */}
                                                <button
                                                    onClick={() => handleNormalDial(task)}
                                                    title="Direct Cellular / Phone Call (tel:)"
                                                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                                                >
                                                    <FaPhoneAlt size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action & Feedback Card Area */}
                                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
                                        {/* Outcome Buttons */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                                Call Outcome:
                                            </label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {[
                                                    { id: 'ANSWERED', label: 'Answered', color: 'emerald' },
                                                    { id: 'NO_ANSWER', label: 'No Answer', color: 'amber' },
                                                    { id: 'REJECTED', label: 'Rejected', color: 'rose' },
                                                    { id: 'CALL_AGAIN', label: 'Call Again', color: 'blue' }
                                                ].map(opt => {
                                                    const isSelected = currentOutcome === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => handleDraftChange(task.id, 'outcome', opt.id)}
                                                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border ${
                                                                isSelected
                                                                    ? opt.id === 'ANSWERED'
                                                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                                                                        : opt.id === 'NO_ANSWER'
                                                                        ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                                                                        : opt.id === 'REJECTED'
                                                                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                                                                        : 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                                                                    : 'bg-black/30 text-slate-400 border-white/5 hover:border-white/20 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Attempts & Remarks Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                            {/* Attempts counter */}
                                            <div className="sm:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                    Attempts:
                                                </label>
                                                <div className="flex items-center bg-black/30 border border-white/5 rounded-xl p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDraftChange(task.id, 'callAttempts', Math.max(0, currentAttempts - 1))}
                                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center font-bold text-xs"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="flex-1 text-center text-xs font-black text-white">
                                                        {currentAttempts}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDraftChange(task.id, 'callAttempts', currentAttempts + 1)}
                                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center font-bold text-xs"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Remarks input */}
                                            <div className="sm:col-span-3">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                    Remarks / Notes:
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentRemarks}
                                                    onChange={e => handleDraftChange(task.id, 'remarks', e.target.value)}
                                                    placeholder="e.g. Student answered, inquired about course schedule..."
                                                    className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Save Button */}
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                disabled={savingTaskId === task.id}
                                                onClick={() => handleSaveOutcome(task)}
                                                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white rounded-xl text-xs font-black shadow-md shadow-amber-900/30 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
                                            >
                                                {savingTaskId === task.id ? (
                                                    <>
                                                        <Loader2 size={13} className="animate-spin" />
                                                        <span>Saving...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaSave size={12} />
                                                        <span>{isCompleted ? 'Update Feedback' : 'Save & Complete'}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-[#111c30] border-t border-white/10 flex items-center justify-between shrink-0 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <FaRegClock size={12} />
                        Auto-refreshes on task assignment
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-xs transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

import React, { useState, useEffect } from 'react';
import { 
    X, 
    CheckCircle2, 
    Clock, 
    User, 
    Calendar, 
    AlertCircle, 
    RotateCcw, 
    Send, 
    Loader2, 
    FileText,
    Play,
    Paperclip,
    ExternalLink,
    Ban,
    UserCheck,
    Timer,
    Sparkles,
    Video,
    Image as ImageIcon,
    UploadCloud,
    Check
} from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

export default function SocialMediaTaskTimelineModal({ task, isOpen, onClose, loggedInUser, onTaskUpdated }) {
    const [correctionNote, setCorrectionNote] = useState('');
    const [showCorrectionInput, setShowCorrectionInput] = useState(false);
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [assignedToId, setAssignedToId] = useState('');
    const [assignDueDate, setAssignDueDate] = useState('');
    const [assignNote, setAssignNote] = useState('');
    const [deliverableUrl, setDeliverableUrl] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Identify user role permissions
    const role = (loggedInUser?.role || '').toUpperCase();
    const dept = loggedInUser?.department || '';
    const isSystemAdmin = role === 'SYSTEM_ADMIN' || role === 'ADMIN';
    const isSocialMediaManager = isSystemAdmin || role === 'SOCIAL_MEDIA_MANAGER' || role === 'SOCIAL MEDIA MANAGER' || (role === 'MANAGER' && dept === 'Social Media');
    const isSocialMediaStaff = role === 'SOCIAL_MEDIA_STAFF' || role === 'SOCIAL MEDIA STAFF' || dept === 'Social Media';
    const isAssignedEditor = isSystemAdmin || isSocialMediaManager || (task?.assignedToId && task?.assignedToId === loggedInUser?.id);
    const isBusinessManager = !isSocialMediaManager && !isSocialMediaStaff;

    const getBackendBase = () => {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        if (protocol === 'https:') return `https://${host}`;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
        return `http://${host}:5000`;
    };

    useEffect(() => {
        if (isOpen && task) {
            if (task.dueDate) {
                try {
                    setAssignDueDate(new Date(task.dueDate).toISOString().split('T')[0]);
                } catch(e) {}
            }
            
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            axios.get('/social-media/staff', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    setStaffList(list);
                    if (list.length > 0 && !assignedToId) {
                        setAssignedToId(list[0].id);
                    }
                })
                .catch(err => console.error("Error fetching SM staff", err));
        }
    }, [isOpen, task]);

    if (!isOpen || !task) return null;

    const history = Array.isArray(task.history) ? task.history : [];

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    let attachmentsList = [];
    if (task.attachmentUrl) {
        try {
            if (task.attachmentUrl.startsWith('[')) {
                attachmentsList = JSON.parse(task.attachmentUrl);
            } else {
                attachmentsList = [task.attachmentUrl];
            }
        } catch (e) {
            attachmentsList = [task.attachmentUrl];
        }
    }

    const handleAction = async (action, note = '', extraData = {}) => {
        setIsSubmitting(true);
        const loadToast = toast.loading("Updating Job Card status...");

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.put('/social-media/tasks/stage', {
                taskId: task.id,
                action,
                note,
                deliverableUrl,
                ...extraData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(res.data.message || "Status updated.", { id: loadToast });
            setShowCorrectionInput(false);
            setCorrectionNote('');
            setDeliverableUrl('');
            if (onTaskUpdated) onTaskUpdated(res.data.task);
            onClose();
        } catch (error) {
            console.error("Error updating task stage:", error);
            toast.error(error.response?.data?.error || "Failed to update stage", { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!assignedToId) return toast.error("Please select an editor from Social Media staff");

        setIsSubmitting(true);
        const loadToast = toast.loading("Allocating Job Card to Editor...");

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.put('/social-media/tasks/assign', {
                taskId: task.id,
                assignedToId: parseInt(assignedToId),
                dueDate: assignDueDate || task.dueDate,
                note: assignNote
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Job Card allocated to editor successfully.", { id: loadToast });
            setShowAssignForm(false);
            if (onTaskUpdated) onTaskUpdated(res.data.task);
            onClose();
        } catch (error) {
            console.error("Error assigning task:", error);
            toast.error(error.response?.data?.error || "Failed to assign editor", { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) return toast.error("Please state the reason for declining");

        setIsSubmitting(true);
        const loadToast = toast.loading("Declining Job Card...");

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.put('/social-media/tasks/reject', {
                taskId: task.id,
                reason: rejectionReason
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Job Card declined.", { id: loadToast });
            setShowRejectForm(false);
            if (onTaskUpdated) onTaskUpdated(res.data.task);
            onClose();
        } catch (error) {
            console.error("Error rejecting task:", error);
            toast.error(error.response?.data?.error || "Failed to decline Job Card", { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 text-left animate-fade-in">
            <div className="bg-slate-900/95 border border-white/15 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-2xl relative">
                
                {/* Header */}
                <div className="bg-white/5 px-6 py-5 border-b border-white/10 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-slate-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                                {task.businessName || 'General Business'}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 flex items-center gap-1">
                                {task.taskType === 'VIDEO' ? <Video size={12} /> : <ImageIcon size={12} />}
                                {task.taskType === 'VIDEO' ? 'Video Reel' : 'Flyer / Post'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">Job Card #{task.id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-white line-clamp-1">{task.title}</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    
                    {/* Metadata Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-white/10 text-xs">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Requested By</span>
                            <span className="font-semibold text-white truncate block">{task.requestedByName}</span>
                            <span className="text-[9px] text-slate-500">Business Manager</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Assigned Editor</span>
                            <span className="font-semibold text-slate-200 truncate block">{task.assignedToName || 'Pending Allocation'}</span>
                            <span className="text-[9px] text-slate-500">Social Media Team</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Target Due Date</span>
                            <span className="font-semibold text-slate-200 block">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Current Status</span>
                            <span className="font-bold text-indigo-400 block">{task.status?.replace('_', ' ')}</span>
                        </div>
                    </div>

                    {/* Description */}
                    {task.description && (
                        <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/10">
                            <h4 className="text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                                <FileText size={14} className="text-indigo-400" /> Requirements & Copy Details
                            </h4>
                            <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* Reference Attachments */}
                    {attachmentsList.length > 0 && (
                        <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/10">
                            <h4 className="text-xs font-bold text-slate-200 mb-2.5 flex items-center gap-1.5">
                                <Paperclip size={14} className="text-indigo-400" /> Reference Assets & Images ({attachmentsList.length})
                            </h4>
                            <div className="space-y-2">
                                {attachmentsList.map((url, idx) => {
                                    const fullUrl = url.startsWith('http') ? url : `${getBackendBase()}${url}`;
                                    const filename = url.split('/').pop() || `Attachment #${idx + 1}`;
                                    return (
                                        <a 
                                            key={idx} 
                                            href={fullUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 text-xs transition-all group"
                                        >
                                            <span className="text-slate-200 truncate max-w-[400px] font-medium">{filename}</span>
                                            <span className="text-xs text-indigo-400 group-hover:text-indigo-300 font-bold flex items-center gap-1">
                                                View File <ExternalLink size={12} />
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lifecycle Audit Trail */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Clock size={14} className="text-indigo-400" /> Job Card Workflow Timeline
                        </h4>

                        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-white/15">
                            
                            {/* 1. Request Stage */}
                            <div className="relative">
                                <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900 shadow-sm"></div>
                                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-xs">
                                    <div className="flex justify-between items-center text-slate-400 mb-1">
                                        <span className="font-bold text-white">Job Card Submitted by Business Manager</span>
                                        <span className="text-[10px] text-slate-400">{formatDate(task.requestDate)}</span>
                                    </div>
                                    <p className="text-slate-400 text-[11px]">Sent to Social Media Department by {task.requestedByName}.</p>
                                </div>
                            </div>

                            {/* 2. Assigned Stage */}
                            {task.assignedDate && (
                                <div className="relative">
                                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900 shadow-sm"></div>
                                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-xs">
                                        <div className="flex justify-between items-center text-slate-400 mb-1">
                                            <span className="font-bold text-white">Allocated to Social Media Editor</span>
                                            <span className="text-[10px] text-slate-400">{formatDate(task.assignedDate)}</span>
                                        </div>
                                        <p className="text-slate-400 text-[11px]">Social Media Manager allocated to {task.assignedToName}.</p>
                                    </div>
                                </div>
                            )}

                            {/* 3. Editing Started Stage */}
                            {task.startedDate && (
                                <div className="relative">
                                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-900 shadow-sm"></div>
                                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-xs">
                                        <div className="flex justify-between items-center text-slate-400 mb-1">
                                            <span className="font-bold text-white">Artwork / Reel Production Commenced</span>
                                            <span className="text-[10px] text-slate-400">{formatDate(task.startedDate)}</span>
                                        </div>
                                        <p className="text-slate-400 text-[11px]">Editor started working on deliverable.</p>
                                    </div>
                                </div>
                            )}

                            {/* 4. Finished Draft */}
                            {task.finishedDate && (
                                <div className="relative">
                                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-slate-900 shadow-sm"></div>
                                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-xs">
                                        <div className="flex justify-between items-center text-slate-400 mb-1">
                                            <span className="font-bold text-white">Draft Delivered (Awaiting Business Approval)</span>
                                            <span className="text-[10px] text-slate-400">{formatDate(task.finishedDate)}</span>
                                        </div>
                                        <p className="text-slate-400 text-[11px]">Editor submitted artwork for review by Business Manager.</p>
                                    </div>
                                </div>
                            )}

                            {/* 5. Correction Cycle history */}
                            {history.filter(h => h.stage === 'CORRECTION_REQUESTED' || h.correctionDurationText).map((item, idx) => {
                                if (item.stage === 'CORRECTION_REQUESTED') {
                                    return (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-slate-900 shadow-sm"></div>
                                            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-orange-500/30 text-xs">
                                                <div className="flex justify-between items-center text-orange-400 mb-1">
                                                    <span className="font-bold">Business Manager Requested Changes</span>
                                                    <span className="text-[10px] text-slate-500">{formatDate(item.timestamp)}</span>
                                                </div>
                                                <p className="text-slate-300 text-[11px]">{item.note}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                if (item.correctionDurationText) {
                                    return (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-slate-900 shadow-sm"></div>
                                            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-teal-500/30 text-xs">
                                                <div className="flex justify-between items-center text-teal-400 mb-1">
                                                    <span className="font-bold">Revised Deliverable Re-submitted</span>
                                                    <span className="text-[10px] text-slate-500">{formatDate(item.timestamp)}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5">
                                                    <Timer size={13} className="text-teal-400" />
                                                    <span>Turnaround time in revision: <strong className="text-white">{item.correctionDurationText}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}

                            {/* 6. Completed Stage */}
                            {task.completedDate && (
                                <div className="relative">
                                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-sm"></div>
                                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/30 text-xs">
                                        <div className="flex justify-between items-center text-emerald-400 mb-1">
                                            <span className="font-bold">Approved & Finalized by Business Manager ✅</span>
                                            <span className="text-[10px] text-slate-500">{formatDate(task.completedDate)}</span>
                                        </div>
                                        <p className="text-slate-300 text-[11px]">Job Card closed and approved for publishing.</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Social Media Manager Action: Assign Editor Form */}
                    {showAssignForm && isSocialMediaManager && (
                        <form onSubmit={handleAssign} className="bg-slate-950/90 p-5 rounded-2xl border border-indigo-500/30 space-y-3">
                            <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                <UserCheck size={15} className="text-indigo-400" /> Allocate to Social Media Editor
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Editor *</label>
                                    <select 
                                        value={assignedToId} 
                                        onChange={(e) => setAssignedToId(e.target.value)}
                                        required
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Choose Editor --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role || 'Editor'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Editor Deadline</label>
                                    <input 
                                        type="date"
                                        value={assignDueDate}
                                        onChange={(e) => setAssignDueDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Instructions for Editor</label>
                                <input 
                                    type="text"
                                    placeholder="Priority notes or instructions for the editor..."
                                    value={assignNote}
                                    onChange={(e) => setAssignNote(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowAssignForm(false)} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30">Confirm Allocation</button>
                            </div>
                        </form>
                    )}

                    {/* Social Media Manager Action: Decline Job Card Form */}
                    {showRejectForm && isSocialMediaManager && (
                        <form onSubmit={handleReject} className="bg-slate-950/90 p-5 rounded-2xl border border-rose-500/30 space-y-3">
                            <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                                <Ban size={15} /> Decline Job Card
                            </h4>
                            <textarea 
                                rows={2}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain reason to the Business Manager (e.g. missing copy or assets)..."
                                required
                                className="w-full bg-slate-900 border border-rose-500/30 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowRejectForm(false)} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/30">Confirm Decline</button>
                            </div>
                        </form>
                    )}

                    {/* Business Manager Action: Request Correction Form */}
                    {showCorrectionInput && (
                        <div className="bg-slate-950/90 p-5 rounded-2xl border border-amber-500/30 space-y-3">
                            <label className="block text-xs font-bold text-amber-300">
                                Describe Required Changes / Corrections:
                            </label>
                            <textarea 
                                rows={2}
                                value={correctionNote}
                                onChange={(e) => setCorrectionNote(e.target.value)}
                                placeholder="Specify text modifications, font adjustments, or timing fixes needed..."
                                className="w-full bg-slate-900 border border-amber-500/30 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowCorrectionInput(false)} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                                <button 
                                    disabled={!correctionNote.trim() || isSubmitting}
                                    onClick={() => handleAction('REQUEST_CORRECTION', correctionNote)}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/30"
                                >
                                    Send Correction Request to Editor
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls based on User Role */}
                <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex items-center justify-between shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                        Close
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                        
                        {/* 1. PENDING APPROVAL STAGE */}
                        {task.status === 'PENDING_APPROVAL' && (
                            <>
                                {isSocialMediaManager ? (
                                    <>
                                        <button 
                                            disabled={isSubmitting}
                                            onClick={() => { setShowRejectForm(true); setShowAssignForm(false); }}
                                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
                                        >
                                            Decline Job Card
                                        </button>
                                        <button 
                                            disabled={isSubmitting}
                                            onClick={() => { setShowAssignForm(true); setShowRejectForm(false); }}
                                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <UserCheck size={15} /> Allocate to Social Media Editor
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                            <Clock size={13} className="text-amber-400 animate-spin" /> Waiting for Social Media Department Allocation
                                        </span>
                                        <button 
                                            disabled={isSubmitting}
                                            onClick={() => handleAction('CANCEL')}
                                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                                        >
                                            Withdraw Request
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 2. ASSIGNED STAGE (Editor commences work) */}
                        {task.status === 'ASSIGNED' && (
                            <>
                                {isAssignedEditor ? (
                                    <button 
                                        disabled={isSubmitting}
                                        onClick={() => handleAction('START')}
                                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-sky-600/30 cursor-pointer"
                                    >
                                        <Play size={14} /> Start Production
                                    </button>
                                ) : (
                                    <span className="text-xs text-blue-300 font-semibold bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                        <User size={13} /> Allocated to {task.assignedToName} (Production Pending)
                                    </span>
                                )}
                            </>
                        )}

                        {/* 3. IN PRODUCTION OR CORRECTION STAGE (Editor finishes draft) */}
                        {(task.status === 'IN_PROGRESS' || task.status === 'CORRECTION_REQUESTED') && (
                            <>
                                {isAssignedEditor ? (
                                    <button 
                                        disabled={isSubmitting}
                                        onClick={() => handleAction(task.status === 'CORRECTION_REQUESTED' ? 'SUBMIT_CORRECTION' : 'FINISH_DRAFT')}
                                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/30 cursor-pointer"
                                    >
                                        <Send size={14} /> {task.status === 'CORRECTION_REQUESTED' ? 'Submit Revised Artwork' : 'Submit Draft to Business Manager'}
                                    </button>
                                ) : (
                                    <span className="text-xs text-sky-300 font-semibold bg-sky-500/15 border border-sky-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                        <Clock size={13} className="text-sky-400" /> Editor is Actively Working on Job Card
                                    </span>
                                )}
                            </>
                        )}

                        {/* 4. FINISHED REVIEW STAGE (Business Manager approves or requests changes) */}
                        {task.status === 'FINISHED_REVIEW' && (
                            <>
                                {(!isSocialMediaStaff || isSocialMediaManager) ? (
                                    <>
                                        <button 
                                            disabled={isSubmitting}
                                            onClick={() => setShowCorrectionInput(true)}
                                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <RotateCcw size={14} /> Request Correction
                                        </button>
                                        <button 
                                            disabled={isSubmitting}
                                            onClick={() => handleAction('APPROVE_OK')}
                                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                                        >
                                            <CheckCircle2 size={15} /> Approve & Finalize Deliverable
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-xs text-purple-300 font-semibold bg-purple-500/15 border border-purple-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                        <Sparkles size={13} /> Draft Submitted. Waiting for Business Manager Approval.
                                    </span>
                                )}
                            </>
                        )}

                        {/* 5. COMPLETED STAGE */}
                        {task.status === 'COMPLETED' && (
                            <span className="text-xs text-emerald-300 font-bold bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                <Check size={14} className="text-emerald-400" /> Completed & Closed
                            </span>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { Wrench, CheckCircle2, Clock, MessageSquare, Plus, X, Upload, Loader2, ArrowRight, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

export default function SystemTasksAdmin() {
    const [tasks, setTasks] = useState([]);
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING or RESOLVED
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
    const [loading, setLoading] = useState(false);

    // Modal state for manual task creation
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTopic, setNewTopic] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newFiles, setNewFiles] = useState([]);
    const [newPreviews, setNewPreviews] = useState([]);
    const [creating, setCreating] = useState(false);
    const manualFileInputRef = useRef(null);

    // Remarks editing state
    const [remarksState, setRemarksState] = useState({}); // task.id -> string

    // Selected image lightbox state
    const [selectedImage, setSelectedImage] = useState(null);

    // Date range filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchTasks();
    }, [activeTab, page, startDate, endDate]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            let url = `/system-tasks/admin?page=${page}&status=${activeTab}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            
            const res = await axios.get(url);
            setTasks(res.data.tasks);
            setPagination(res.data.pagination);
            
            // Initialize remarks edit state
            const initialRemarks = {};
            res.data.tasks.forEach(t => {
                initialRemarks[t.id] = t.remark || '';
            });
            setRemarksState(initialRemarks);
        } catch (error) {
            console.error("Failed to fetch system tasks:", error);
            toast.error("Failed to load system tasks.");
        } finally {
            setLoading(false);
        }
    };

    const handleRemarkChange = (id, value) => {
        setRemarksState({
            ...remarksState,
            [id]: value
        });
    };

    const handleUpdateTask = async (id, status) => {
        const remark = remarksState[id];
        const toastId = toast.loading("Updating task...");
        try {
            await axios.put(`/system-tasks/admin/${id}`, {
                status,
                remark: remark ? remark.trim() : null
            });
            toast.success("Task updated successfully!", { id: toastId });
            fetchTasks();
        } catch (error) {
            console.error("Failed to update task:", error);
            toast.error("Failed to update task status.", { id: toastId });
        }
    };

    // Helper to format documents/images static links dynamically
    const getAttachmentUrl = (filename) => {
        if (!filename) return '';
        const apiBase = axios.defaults.baseURL || '/api';
        const assetBase = apiBase.replace('/api', '') + '/api/storage/documents/';
        return `${assetBase}${filename}`;
    };

    // Parse image filename arrays
    const parseImages = (imagesStr) => {
        if (!imagesStr) return [];
        try {
            return JSON.parse(imagesStr);
        } catch (e) {
            return imagesStr.split(',').filter(Boolean);
        }
    };

    // Manual creation handler
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (newFiles.length + files.length > 5) {
            toast.error("Max 5 attachments allowed.");
            return;
        }

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        const invalid = files.some(f => !allowedTypes.includes(f.type));
        if (invalid) {
            toast.error("Only image attachments (.png, .jpg, .jpeg, .webp) are allowed.");
            return;
        }

        setNewFiles([...newFiles, ...files]);
        const previews = files.map(file => URL.createObjectURL(file));
        setNewPreviews([...newPreviews, ...previews]);
    };

    const removeFile = (index) => {
        const updated = [...newFiles];
        updated.splice(index, 1);
        setNewFiles(updated);

        const updatedPreviews = [...newPreviews];
        URL.revokeObjectURL(updatedPreviews[index]);
        updatedPreviews.splice(index, 1);
        setNewPreviews(updatedPreviews);
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTopic.trim()) {
            toast.error("Please enter a topic.");
            return;
        }
        if (!newDesc.trim()) {
            toast.error("Please enter description.");
            return;
        }

        setCreating(true);
        const toastId = toast.loading("Creating task...");

        try {
            const formData = new FormData();
            formData.append("topic", newTopic.trim());
            formData.append("description", newDesc.trim());

            newFiles.forEach((file) => {
                formData.append("images", file);
            });

            await axios.post('/system-tasks/admin', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.success("System task created successfully!", { id: toastId });
            
            // Reset
            setNewTopic('');
            setNewDesc('');
            setNewFiles([]);
            newPreviews.forEach(p => URL.revokeObjectURL(p));
            setNewPreviews([]);
            setIsCreateModalOpen(false);
            
            // Go to pending page 1
            setActiveTab('PENDING');
            setPage(1);
            fetchTasks();
        } catch (error) {
            console.error("Failed to create admin manual task:", error);
            const msg = error.response?.data?.error || "Failed to create task.";
            toast.error(msg, { id: toastId });
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="w-full animate-fade-in pb-10 text-left">
            
            {/* Top Title Bar */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        <Wrench className="text-brand-accent w-7 h-7" />
                        System Task Center
                    </h2>
                    <p className="text-sm font-medium text-gray-300 mt-1">
                        Track, remark, and resolve staff reported issues and system tasks.
                    </p>
                </div>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold border border-rose-500/25 px-5 py-2.5 rounded-xl shadow-lg hover:shadow-rose-500/35 transition-all text-sm cursor-pointer"
                >
                    <Plus size={16} /> Create Task
                </button>
            </div>

            {/* Premium Filtering Tabs */}
            <div className="flex border-b border-white/10 mb-6 gap-2 shrink-0">
                <button
                    onClick={() => { setActiveTab('PENDING'); setPage(1); }}
                    className={`py-3.5 px-6 font-bold text-xs uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'PENDING' 
                        ? 'border-brand-accent text-white bg-white/5' 
                        : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Clock size={15} className="text-amber-500" />
                    Pending Tasks
                </button>
                <button
                    onClick={() => { setActiveTab('RESOLVED'); setPage(1); }}
                    className={`py-3.5 px-6 font-bold text-xs uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'RESOLVED' 
                        ? 'border-brand-accent text-white bg-white/5' 
                        : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    Resolved History
                </button>
            </div>

            {/* Premium Date Filters Card & Calendar Shortcuts */}
            <div className="flex flex-col gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl mb-6 shadow-xl backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                            <Clock size={14} className="text-brand-accent" /> Calendar Filter:
                        </span>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                className="bg-black/60 border border-white/15 text-xs text-white px-3.5 py-2 rounded-xl outline-none focus:border-brand-accent transition-all cursor-pointer shadow-inner"
                            />
                            <span className="text-gray-500 text-xs font-black uppercase">to</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                className="bg-black/60 border border-white/15 text-xs text-white px-3.5 py-2 rounded-xl outline-none focus:border-brand-accent transition-all cursor-pointer shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Quick Date Presets */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                setStartDate(today);
                                setEndDate(today);
                                setPage(1);
                            }}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition-colors border border-white/5"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => {
                                const yest = new Date();
                                yest.setDate(yest.getDate() - 1);
                                const dateStr = yest.toISOString().split('T')[0];
                                setStartDate(dateStr);
                                setEndDate(dateStr);
                                setPage(1);
                            }}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition-colors border border-white/5"
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => {
                                const p7 = new Date();
                                p7.setDate(p7.getDate() - 7);
                                setStartDate(p7.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                                setPage(1);
                            }}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition-colors border border-white/5"
                        >
                            Last 7 Days
                        </button>
                        <button
                            onClick={() => {
                                const p30 = new Date();
                                p30.setDate(p30.getDate() - 30);
                                setStartDate(p30.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                                setPage(1);
                            }}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition-colors border border-white/5"
                        >
                            Last 30 Days
                        </button>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold rounded-lg transition-colors border border-rose-500/30 flex items-center gap-1"
                            >
                                <X size={12} /> Clear Filter
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List Body with Date Breakdown */}
            {loading ? (
                <div className="min-h-[40vh] flex items-center justify-center">
                    <Loader2 size={40} className="animate-spin text-brand-accent" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-black/20 border border-white/10 backdrop-blur-xl rounded-2xl p-16 text-center text-gray-400">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-30 text-white" />
                    <p className="font-bold text-lg text-white">No tasks found</p>
                    <p className="text-xs text-gray-400 mt-1">There are no operational tasks registered under this status for the selected period.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Render Tasks grouped by Date for Breakdown View */}
                    {Object.entries(
                        tasks.reduce((groups, task) => {
                            const dateStr = new Date(task.updatedAt || task.createdAt).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            });
                            if (!groups[dateStr]) groups[dateStr] = [];
                            groups[dateStr].push(task);
                            return groups;
                        }, {})
                    ).map(([dateLabel, dateTasks]) => (
                        <div key={dateLabel} className="space-y-4">
                            {/* Date Header Badge */}
                            <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                                <div className="bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                                    <Clock size={14} />
                                    <span>{dateLabel}</span>
                                </div>
                                <span className="text-xs font-bold text-gray-400">
                                    {dateTasks.length} {dateTasks.length === 1 ? 'task' : 'tasks'} {activeTab === 'RESOLVED' ? 'resolved' : 'pending'}
                                </span>
                            </div>

                            <div className="space-y-4">
                                {dateTasks.map((task) => {
                                    const taskImages = parseImages(task.images);
                                    
                                    return (
                            <div key={task.id} className="bg-black/20 border border-white/10 backdrop-blur-xl rounded-2xl p-5 md:p-6 transition-all hover:bg-black/30 shadow-md">
                                {/* Submitter Details Block & Date */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4 mb-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-black text-sm text-white">{task.staffName}</span>
                                        <span className="bg-white/10 text-gray-300 text-[9px] font-bold px-2 py-0.5 rounded border border-white/10">
                                            Dept: {task.department || 'N/A'}
                                        </span>
                                        <span className="bg-brand-accent/20 text-brand-accent text-[9px] font-black px-2 py-0.5 rounded border border-brand-accent/20 uppercase">
                                            Biz: {task.businessName || 'N/A'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {new Date(task.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span>
                                </div>

                                {/* Content: Topic and Description */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-black text-white">{task.topic}</h3>
                                    <div className="bg-black/45 border border-white/5 p-4 rounded-xl text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                        {task.description}
                                    </div>
                                </div>

                                {/* Attachment screenshots if any */}
                                {taskImages.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Attachments</p>
                                        <div className="flex flex-wrap gap-2.5">
                                            {taskImages.map((img, i) => (
                                                <div 
                                                    key={i} 
                                                    onClick={() => setSelectedImage(getAttachmentUrl(img))}
                                                    className="w-20 h-20 rounded-xl border border-white/10 overflow-hidden bg-black/30 cursor-zoom-in relative group aspect-square hover:border-brand-accent transition-all"
                                                >
                                                    <img src={getAttachmentUrl(img)} alt="task upload" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <Eye size={16} className="text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Action Panel (Remark and Resolve Toggle) */}
                                <div className="border-t border-white/5 mt-5 pt-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                    {/* Remark Field */}
                                    <div className="w-full md:flex-1 space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">System Admin Remark</label>
                                        <textarea
                                            value={remarksState[task.id] || ''}
                                            onChange={(e) => handleRemarkChange(task.id, e.target.value)}
                                            placeholder="Write remarks here (e.g. fix karada, no issue...)"
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-accent outline-none transition-all resize-none h-14"
                                        />
                                    </div>

                                    {/* State Save Buttons */}
                                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                                        {activeTab === 'PENDING' ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateTask(task.id, 'RESOLVED')}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-emerald-500 shadow-md cursor-pointer transition-colors"
                                                >
                                                    <CheckCircle2 size={14} /> Resolve Task
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateTask(task.id, 'PENDING')}
                                                    className="flex-1 md:flex-none bg-white/15 hover:bg-white/20 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/5 cursor-pointer transition-colors"
                                                >
                                                    Save Remark
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateTask(task.id, 'PENDING')}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-amber-500 shadow-md cursor-pointer transition-colors"
                                                >
                                                    <Clock size={14} /> Reopen Task
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateTask(task.id, 'RESOLVED')}
                                                    className="flex-1 md:flex-none bg-white/15 hover:bg-white/20 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/5 cursor-pointer transition-colors"
                                                >
                                                    Save Remark
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex justify-between items-center bg-black/20 border border-white/10 backdrop-blur-xl rounded-2xl p-4 mt-6">
                            <span className="text-xs text-gray-400 font-bold">
                                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2.5 bg-white/10 border border-white/5 rounded-xl text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                    disabled={page === pagination.pages}
                                    className="p-2.5 bg-white/10 border border-white/5 rounded-xl text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MANUAL CREATE TASK MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-[#0B1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-white font-black text-sm flex items-center gap-2">
                                <Plus className="text-brand-accent w-4 h-4" />
                                Create Manual System Task
                            </h3>
                            <button 
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleCreateTask} className="p-5 overflow-y-auto custom-scrollbar space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Topic / Title</label>
                                <input 
                                    type="text"
                                    value={newTopic}
                                    onChange={(e) => setNewTopic(e.target.value)}
                                    placeholder="Enter topic..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-accent outline-none transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Description / Details</label>
                                <textarea 
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    placeholder="Provide detailed instructions or issue definitions..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-accent outline-none transition-all resize-none h-28"
                                    required
                                />
                            </div>

                            {/* Screenshots upload */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Attachments ({newFiles.length}/5)</label>
                                
                                {newPreviews.length > 0 && (
                                    <div className="grid grid-cols-5 gap-2 pb-1">
                                        {newPreviews.map((preview, idx) => (
                                            <div key={idx} className="relative group aspect-square rounded-lg border border-white/10 overflow-hidden bg-black/25">
                                                <img src={preview} alt="preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="absolute -top-1 -right-1 bg-red-600/90 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors shadow-sm"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => manualFileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 py-3 rounded-xl transition-all cursor-pointer"
                                >
                                    <Upload size={16} className="text-gray-400" />
                                    <span className="text-xs font-bold text-gray-300">Attach Screenshots</span>
                                </button>
                                <input 
                                    type="file"
                                    ref={manualFileInputRef}
                                    onChange={handleFileChange}
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2 border-t border-white/5">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-rose-950/40 text-white text-xs font-extrabold py-2.5 rounded-xl flex justify-center items-center gap-1.5 shadow-lg shadow-rose-500/20 cursor-pointer"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Create Task
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded-xl border border-white/5 cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LIGHTBOX / ZOOM MODE */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/40 p-2 rounded-full"
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={selectedImage} 
                        alt="fullscreen lightbox" 
                        className="max-w-full max-h-[92vh] object-contain rounded-lg shadow-2xl border border-white/10 animate-fade-in"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
                    />
                </div>
            )}

        </div>
    );
}

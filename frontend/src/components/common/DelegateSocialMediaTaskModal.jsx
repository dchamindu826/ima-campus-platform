import React, { useState, useEffect } from 'react';
import { Send, X, Calendar, Building2, User, FileText, Tag, Loader2, Upload, Trash2, Paperclip, Video, Image as ImageIcon, Sparkles } from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

export default function DelegateSocialMediaTaskModal({ isOpen, onClose, loggedInUser, onSuccess }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [businessId, setBusinessId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [taskType, setTaskType] = useState('POST'); // 'POST' or 'VIDEO'
    const [businesses, setBusinesses] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);

    const managerName = loggedInUser 
        ? `${loggedInUser.firstName || ''} ${loggedInUser.lastName || ''}`.trim() || loggedInUser.name || 'Manager'
        : 'Manager';
    
    const todayStr = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });

    useEffect(() => {
        if (isOpen) {
            axios.get('/businesses')
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);
                    setBusinesses(list);
                    if (list.length > 0 && !businessId) {
                        setBusinessId(list[0].id);
                    }
                })
                .catch(err => console.error("Error fetching businesses", err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMultipleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (attachments.length + files.length > 5) {
            return toast.error("Maximum 5 files can be attached.");
        }

        setIsUploadingFiles(true);
        const loadToast = toast.loading(`Uploading ${files.length} file(s)...`);

        try {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));

            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.post('/social-media/upload-files', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });

            const uploadedUrls = res.data.fileUrls || [];
            setAttachments(prev => [...prev, ...uploadedUrls]);
            toast.success(`${uploadedUrls.length} file(s) attached.`, { id: loadToast });
        } catch (err) {
            console.error("Files upload failed", err);
            toast.error("Failed to upload attachments", { id: loadToast });
        } finally {
            setIsUploadingFiles(false);
            e.target.value = '';
        }
    };

    const handleRemoveAttachment = (indexToRemove) => {
        setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return toast.error("Please enter a task title");
        if (!dueDate) return toast.error("Please select a due date");

        setIsSubmitting(true);
        const loadToast = toast.loading("Submitting delegation task...");

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            await axios.post('/social-media/tasks', {
                title: title.trim(),
                description: description.trim(),
                businessId: businessId ? parseInt(businessId) : null,
                dueDate,
                attachments,
                attachmentUrl: attachments.length > 0 ? (attachments.length === 1 ? attachments[0] : JSON.stringify(attachments)) : null,
                taskType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Task delegated to Social Media team successfully.", { id: loadToast });
            setTitle('');
            setDescription('');
            setDueDate('');
            setAttachments([]);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error delegating social media task", error);
            toast.error(error.response?.data?.error || "Failed to submit task", { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 text-left animate-fade-in">
            <div className="bg-slate-900/95 border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-2xl relative">
                
                {/* Header */}
                <div className="bg-white/5 px-6 py-5 border-b border-white/10 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
                            <Send size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Delegate Social Media Task</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Assigned by {managerName} • {todayStr}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    
                    {/* Deliverable Type Toggle */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Deliverable Type *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setTaskType('POST')}
                                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                    taskType === 'POST'
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/50 shadow-lg shadow-indigo-600/30'
                                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <ImageIcon size={16} /> Flyer / Post
                            </button>
                            <button
                                type="button"
                                onClick={() => setTaskType('VIDEO')}
                                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                    taskType === 'VIDEO'
                                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400/50 shadow-lg shadow-pink-600/30'
                                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Video size={16} /> Video Reel
                            </button>
                        </div>
                    </div>

                    {/* Target Business Brand */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Target Business Brand
                        </label>
                        <select 
                            value={businessId}
                            onChange={(e) => setBusinessId(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                        >
                            <option value="" className="bg-slate-900">-- General Campaign / All Brands --</option>
                            {businesses.map(b => (
                                <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Task Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Task Title *
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. 2027 A/L Revision Seminar Promotional Flyer"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>

                    {/* Description / Requirements */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Details & Content Requirements
                        </label>
                        <textarea 
                            rows={3}
                            placeholder="Specify texts to include, target audience, dimensions, or specific requirements..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all custom-scrollbar"
                        />
                    </div>

                    {/* Target Due Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Target Due Date *
                        </label>
                        <input 
                            type="date" 
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all [color-scheme:dark]"
                        />
                    </div>

                    {/* Attachments */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                            Reference Attachments (Images or Documents)
                        </label>
                        <label className="w-full bg-slate-950/60 hover:bg-white/5 border border-dashed border-white/20 hover:border-indigo-400/50 rounded-2xl px-4 py-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2">
                            {isUploadingFiles ? (
                                <Loader2 size={16} className="animate-spin text-indigo-400" />
                            ) : (
                                <Upload size={16} className="text-slate-400" />
                            )}
                            <span className="text-xs font-semibold text-slate-300">
                                {attachments.length > 0 ? `+ Add More (${attachments.length}/5)` : 'Upload Reference Files'}
                            </span>
                            <input 
                                type="file" 
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.zip"
                                onChange={handleMultipleFileUpload}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Attached list */}
                    {attachments.length > 0 && (
                        <div className="space-y-1.5 bg-slate-950/80 p-3.5 rounded-2xl border border-white/10">
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">
                                Attached Files ({attachments.length}):
                            </span>
                            <div className="space-y-1.5">
                                {attachments.map((url, idx) => {
                                    const filename = url.split('/').pop() || `File #${idx + 1}`;
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                                            <span className="text-slate-300 truncate max-w-[280px] font-medium">{filename}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveAttachment(idx)}
                                                className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t border-white/10 flex justify-end gap-3 shrink-0">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting || isUploadingFiles}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            Submit Delegation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

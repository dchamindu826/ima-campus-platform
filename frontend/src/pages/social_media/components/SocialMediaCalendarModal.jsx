import React, { useState } from 'react';
import { X, Calendar, Image as ImageIcon, FileText, Tag, Send, Loader2, Upload, Check } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';

export default function SocialMediaCalendarModal({ isOpen, onClose, selectedDate, onSuccess }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [scheduledDate, setScheduledDate] = useState(selectedDate || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    if (!isOpen) return null;

    const getBackendBase = () => {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        if (protocol === 'https:') return `https://${host}`;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
        return `http://${host}:5000`;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploadingImage(true);
        const loadToast = toast.loading("Uploading image file...");
        
        try {
            const formData = new FormData();
            formData.append('image', file);

            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.post('/social-media/upload-image', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });

            setImageUrl(res.data.imageUrl);
            toast.success("Image uploaded successfully!", { id: loadToast });
        } catch (err) {
            console.error("Image upload failed", err);
            toast.error("Failed to upload image file", { id: loadToast });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return toast.error('Title is required');
        if (!scheduledDate) return toast.error('Scheduled date is required');

        setIsSubmitting(true);
        const loadToast = toast.loading('Saving calendar event...');

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            await axios.post('/social-media/calendar', {
                title,
                description,
                imageUrl,
                scheduledDate
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Calendar event saved successfully!', { id: loadToast });
            setTitle('');
            setDescription('');
            setImageUrl('');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving calendar entry:', error);
            toast.error(error.response?.data?.error || 'Failed to save event', { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="bg-[#1e293b] px-6 py-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Calendar size={18} className="text-[#E00A14]" /> Add Calendar Event / Post
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Tag size={13} className="text-cyan-400" /> Event Title *
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g. October Intake Announcement"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E00A14]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-rose-400" /> Scheduled Date & Time *
                        </label>
                        <input 
                            type="datetime-local" 
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            required
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E00A14] [color-scheme:dark]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <FileText size={13} className="text-indigo-400" /> Description / Post Copy
                        </label>
                        <textarea 
                            rows={3}
                            placeholder="Post details, captions, hashtags..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E00A14] custom-scrollbar"
                        />
                    </div>

                    {/* Actual File Upload Section */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <ImageIcon size={13} className="text-emerald-400" /> Upload Event Image
                        </label>
                        
                        <div className="flex items-center gap-3">
                            <label className="flex-1 bg-[#1e293b] hover:bg-[#28374d] border border-dashed border-white/20 hover:border-emerald-400/50 rounded-xl p-3 text-center cursor-pointer transition-all group flex items-center justify-center gap-2">
                                {isUploadingImage ? (
                                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                                ) : (
                                    <Upload size={16} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
                                )}
                                <span className="text-xs font-bold text-slate-300 group-hover:text-white">
                                    {imageUrl ? 'Change Image File' : 'Choose Image File'}
                                </span>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Image Preview Thumbnail */}
                        {imageUrl && (
                            <div className="mt-2.5 flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                                <img 
                                    src={imageUrl.startsWith('http') ? imageUrl : `${getBackendBase()}${imageUrl}`} 
                                    alt="Preview" 
                                    className="w-12 h-12 rounded-lg object-cover border border-white/10" 
                                />
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                        <Check size={12} /> Image Attached
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate block">{imageUrl}</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setImageUrl('')}
                                    className="text-slate-400 hover:text-rose-400 p-1"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting || isUploadingImage}
                            className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#E00A14] text-white hover:bg-[#E00A14]/90 flex items-center gap-2 shadow-lg shadow-[#E00A14]/20 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Save Event
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

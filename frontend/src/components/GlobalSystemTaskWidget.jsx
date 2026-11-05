import React, { useState, useEffect, useRef } from 'react';
import { Wrench, X, Upload, Image, Loader2 } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function GlobalSystemTaskWidget({ loggedInUser, asModal, onClose }) {
    const [isOpen, setIsOpen] = useState(asModal ? true : false);

    const [topic, setTopic] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!loggedInUser) return;
        const roleUpper = loggedInUser.role?.toUpperCase();
        if (roleUpper === 'STUDENT' || roleUpper === 'USER') return;

        // Fetch counts initially and poll every 30 seconds
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, [loggedInUser]);

    const fetchPendingCount = async () => {
        try {
            const res = await axios.get('/system-tasks/pending-count');
            setPendingCount(res.data.count || 0);
        } catch (error) {
            console.error("Failed to fetch pending task count:", error);
        }
    };

    // Only display widget for staff members (not student/user roles)
    if (!loggedInUser) return null;
    const roleUpper = loggedInUser.role?.toUpperCase();
    if (roleUpper === 'STUDENT' || roleUpper === 'USER') return null;

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        
        // Limit total attachments to 5
        if (images.length + selectedFiles.length > 5) {
            toast.error("You can attach up to 5 images only.");
            return;
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        const invalid = selectedFiles.some(f => !allowedTypes.includes(f.type));
        if (invalid) {
            toast.error("Only image attachments (.png, .jpg, .jpeg, .webp) are allowed.");
            return;
        }

        const newImages = [...images, ...selectedFiles];
        setImages(newImages);

        const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
        setImagePreviews([...imagePreviews, ...newPreviews]);
    };

    const removeImage = (index) => {
        const updatedImages = [...images];
        updatedImages.splice(index, 1);
        setImages(updatedImages);

        const updatedPreviews = [...imagePreviews];
        URL.revokeObjectURL(updatedPreviews[index]); // Free memory
        updatedPreviews.splice(index, 1);
        setImagePreviews(updatedPreviews);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!topic.trim()) {
            toast.error("Please provide a topic.");
            return;
        }
        if (!description.trim()) {
            toast.error("Please describe the issue/task.");
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading("Submitting report to System Admin...");

        try {
            const formData = new FormData();
            formData.append("topic", topic.trim());
            formData.append("description", description.trim());
            
            images.forEach((file) => {
                formData.append("images", file);
            });

            await axios.post('/system-tasks', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.success("Issue submitted successfully!", { id: toastId });
            handleFormSuccess();
        } catch (error) {
            console.error("Failed to submit system task:", error);
            const errMsg = error.response?.data?.error || "Failed to submit. Try again.";
            toast.error(errMsg, { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (asModal && onClose) onClose();
        else setIsOpen(false);
    };

    const handleFormSuccess = () => {
        setTopic('');
        setDescription('');
        setImages([]);
        imagePreviews.forEach(p => URL.revokeObjectURL(p));
        setImagePreviews([]);
        handleClose();
    };

    return (

        <div className={asModal ? "" : "fixed bottom-6 right-24 z-[9999]"}>
            {!asModal && (
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`bg-brand-accent hover:bg-brand-accent/90 text-white w-14 h-14 rounded-full flex justify-center items-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 relative border-2 border-white/20 ${pendingCount > 0 ? 'animate-[pulse_1.8s_infinite]' : ''}`}
                    title="Report System Issue / Request Help"
                >
                    <Wrench size={22} className={isOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex justify-center items-center rounded-full border-2 border-[#0B1120] animate-bounce shadow-md">
                            {pendingCount}
                        </span>
                    )}
                </button>
            )}

            {isOpen && (
                <div className={asModal ? "fixed bottom-24 right-6 w-96 max-h-[600px] h-[600px] z-[9999] bg-[#0B1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col backdrop-blur-2xl" : "absolute bottom-16 right-0 w-96 bg-[#0B1120]/95 border border-white/10 rounded-2xl shadow-2xl animate-fade-in-up flex flex-col max-h-[600px] overflow-hidden backdrop-blur-2xl"}>
                    <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="text-white font-black flex items-center gap-2 text-sm">
                            <Wrench className="text-brand-accent w-4 h-4"/> 
                            Report Issue / Request Task
                        </h3>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                            <X size={18}/>
                        </button>
                    </div>
                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-left">
                        {/* Submitter details badge */}
                        <div className="bg-white/5 border border-white/5 p-2.5 rounded-xl text-xs space-y-1">
                            <p className="text-gray-400 font-medium">Reporting As:</p>
                            <div className="flex flex-wrap items-center gap-2 font-bold text-white">
                                <span>{loggedInUser.firstName} {loggedInUser.lastName}</span>
                                <span className="bg-brand-accent/20 text-brand-accent border border-brand-accent/30 text-[9px] px-1.5 py-0.5 rounded uppercase">{loggedInUser.role}</span>
                                {loggedInUser.department && (
                                    <span className="bg-white/10 text-gray-300 border border-white/10 text-[9px] px-1.5 py-0.5 rounded">{loggedInUser.department}</span>
                                )}
                            </div>
                        </div>

                        {/* Topic field */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Topic / Title</label>
                            <input 
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="E.g., Slip upload failing, finance matrix sorting..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-accent outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Description field */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Description</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the error, exact steps, and impact..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-accent outline-none transition-all resize-none h-24"
                                required
                            />
                        </div>

                        {/* Image Attachments */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Screenshots ({images.length}/5)</label>
                            
                            {/* Selected previews */}
                            {imagePreviews.length > 0 && (
                                <div className="grid grid-cols-5 gap-2 pb-2">
                                    {imagePreviews.map((preview, i) => (
                                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20">
                                            <img src={preview} alt="upload preview" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                className="absolute -top-1 -right-1 bg-red-600/90 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors shadow-md z-10"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Custom File Selector */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 py-3 rounded-xl transition-all cursor-pointer"
                            >
                                <Upload size={16} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-300">Choose Images</span>
                            </button>
                            <input 
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <button 
                                type="submit"
                                disabled={submitting}
                                className="flex-1 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-rose-950/40 text-white text-xs font-extrabold py-2.5 rounded-xl flex justify-center items-center gap-1.5 shadow-lg shadow-rose-500/20 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Report
                                    </>
                                )}
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded-xl border border-white/5 cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

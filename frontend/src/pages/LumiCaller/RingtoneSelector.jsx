import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { Music, Play, Square, Upload, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const RingtoneSelector = ({ businessId, currentRingtone, onRingtoneAssigned }) => {
    const [ringtones, setRingtones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [playing, setPlaying] = useState(null);
    const audioRef = useRef(new Audio());
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchRingtones();
        }
        return () => {
            audioRef.current.pause();
        };
    }, [isOpen]);

    const fetchRingtones = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/ringtones');
            setRingtones(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load ringtones");
        }
        setLoading(false);
    };

    const handlePlay = (e, url, name) => {
        e.stopPropagation();
        if (playing === name) {
            audioRef.current.pause();
            setPlaying(null);
        } else {
            audioRef.current.src = api.defaults.baseURL.replace('/api', '') + `/storage/ringtone/${url}`;
            audioRef.current.play();
            setPlaying(name);
        }
    };

    const handleAssign = async (e, ringtoneName) => {
        e.stopPropagation();
        try {
            await api.post('/admin/ringtones/assign', { businessId, ringtoneName });
            toast.success("Ringtone assigned successfully!");
            onRingtoneAssigned(ringtoneName);
            fetchRingtones();
            setIsOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to assign ringtone");
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('ringtone', file);

        try {
            toast.loading("Uploading...", { id: 'upload' });
            await api.post('/admin/ringtones/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Uploaded successfully!", { id: 'upload' });
            fetchRingtones();
        } catch (error) {
            toast.error("Upload failed", { id: 'upload' });
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 transition-colors"
            >
                <Music size={14} className="text-emerald-400" />
                {currentRingtone || 'Select Ringtone'}
            </button>

            {isOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 w-64 bg-[#1a2332] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/20">
                        <span className="text-sm font-bold text-white">Business Ringtone</span>
                        <button onClick={() => fileInputRef.current?.click()} className="text-emerald-400 hover:text-emerald-300">
                            <Upload size={16} />
                        </button>
                        <input 
                            type="file" 
                            accept="audio/mp3" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleUpload} 
                        />
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="text-center text-xs text-gray-400 p-4">Loading...</div>
                        ) : ringtones.length === 0 ? (
                            <div className="text-center text-xs text-gray-400 p-4">No ringtones found</div>
                        ) : ringtones.map((r, i) => {
                            const isSelected = currentRingtone === r.name;
                            const isUsedByOther = r.usedBy && r.usedBy.id !== businessId;
                            
                            return (
                                <div 
                                    key={i} 
                                    className={`flex items-center justify-between p-2 rounded-lg text-sm ${isSelected ? 'bg-emerald-500/20 border border-emerald-500/30' : 'hover:bg-white/5'} transition-colors`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <button 
                                            onClick={(e) => handlePlay(e, r.url, r.name)}
                                            className={`p-1.5 rounded-full ${playing === r.name ? 'bg-rose-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                        >
                                            {playing === r.name ? <Square size={12} /> : <Play size={12} />}
                                        </button>
                                        <div className="flex flex-col truncate">
                                            <span className={`truncate ${isSelected ? 'text-emerald-400 font-bold' : 'text-gray-300'}`}>{r.name}</span>
                                            {isUsedByOther && <span className="text-[9px] text-rose-400">Used by {r.usedBy.name}</span>}
                                        </div>
                                    </div>
                                    
                                    {!isUsedByOther && !isSelected && (
                                        <button 
                                            onClick={(e) => handleAssign(e, r.name)}
                                            className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600 transition-colors"
                                        >
                                            Select
                                        </button>
                                    )}
                                    {isSelected && <CheckCircle size={16} className="text-emerald-400" />}
                                    {isUsedByOther && <XCircle size={16} className="text-rose-400" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RingtoneSelector;

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../api/axios';
import { FaBan, FaTimes, FaSearch, FaUnlock, FaCalendarAlt, FaUserTie } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BlockedListModal({ isOpen, onClose, onUnblockSuccess, crmPrefix = '/after-seminar-crm' }) {
    const [blockedList, setBlockedList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [unblockingPhone, setUnblockingPhone] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchBlockedList();
        }
    }, [isOpen]);

    const fetchBlockedList = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${crmPrefix}/leads/blocked-list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedList(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load blocked list", err);
            toast.error("Failed to load blocked numbers");
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (phone) => {
        if (!window.confirm(`Are you sure you want to unblock ${phone}?`)) return;
        setUnblockingPhone(phone);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${crmPrefix}/leads/unblock`, { phone }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Number ${phone} has been unblocked!`);
            setBlockedList(prev => prev.filter(item => item.phone !== phone));
            if (onUnblockSuccess) onUnblockSuccess(phone);
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to unblock number");
        } finally {
            setUnblockingPhone(null);
        }
    };

    if (!isOpen) return null;

    const filtered = blockedList.filter(item => {
        const q = search.toLowerCase().trim();
        const pMatch = item.phone && item.phone.toLowerCase().includes(q);
        const rMatch = item.reason && item.reason.toLowerCase().includes(q);
        const uMatch = item.blockedByUser && `${item.blockedByUser.firstName} ${item.blockedByUser.lastName}`.toLowerCase().includes(q);
        return pMatch || rMatch || uMatch;
    });

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#121a24] border border-slate-700/80 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-red-950/40 via-[#1a2430] to-[#121a24] border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
                            <FaBan size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                                Blocked Numbers List
                                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                                    {blockedList.length}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400">Manage all suppressed phone numbers and their block reasons</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-800 bg-[#0f172a]/60 shrink-0">
                    <div className="relative">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                        <input 
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by phone number, reason, or staff..."
                            className="w-full bg-[#1a2430] border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-red-500 placeholder-slate-500 transition-colors shadow-inner"
                        />
                    </div>
                </div>

                {/* List Body */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2.5 custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="animate-spin text-red-400" size={28} />
                            <span className="text-xs font-bold uppercase tracking-wider">Loading Blocked Numbers...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                            <FaBan size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                            <p className="text-sm font-semibold">{search ? 'No matching blocked numbers found' : 'No blocked numbers in the system'}</p>
                        </div>
                    ) : (
                        filtered.map((item) => (
                            <div 
                                key={item.id || item.phone} 
                                className="p-3.5 bg-[#1a2430]/80 border border-slate-700/60 rounded-2xl hover:border-red-500/40 transition-all flex items-center justify-between gap-3 shadow-md"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-base font-black text-white tracking-wide truncate">
                                            {item.phone}
                                        </h4>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                            BLOCKED
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium truncate mb-1">
                                        Reason: <span className="text-amber-400 font-semibold">{item.reason || 'Not specified'}</span>
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                                        {item.createdAt && (
                                            <span className="flex items-center gap-1">
                                                <FaCalendarAlt size={10} className="text-slate-500" />
                                                {new Date(item.createdAt).toLocaleDateString('en-GB')} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {item.blockedByUser && (
                                            <span className="flex items-center gap-1 text-indigo-300 font-medium">
                                                <FaUserTie size={10} className="text-indigo-400" />
                                                By: {item.blockedByUser.firstName} ({item.blockedByUser.role})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    disabled={unblockingPhone === item.phone}
                                    onClick={() => handleUnblock(item.phone)}
                                    className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 hover:border-emerald-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-50"
                                >
                                    {unblockingPhone === item.phone ? (
                                        <Loader2 className="animate-spin" size={13} />
                                    ) : (
                                        <FaUnlock size={11} />
                                    )}
                                    Unblock
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

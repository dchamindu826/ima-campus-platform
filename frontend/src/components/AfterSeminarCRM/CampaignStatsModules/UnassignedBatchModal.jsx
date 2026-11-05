import React, { useState, useEffect } from 'react';
import axios from '../../../api/axios';
import { FaTimes, FaLayerGroup, FaCheckCircle, FaSearch, FaCommentDots, FaUser, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function UnassignedBatchModal({ isOpen, onClose, businessId, onBatchAssigned }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedLeadIds, setSelectedLeadIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [lockedBatchesMap, setLockedBatchesMap] = useState({});

    // Chat Modal State
    const [chatLead, setChatLead] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [loadingChat, setLoadingChat] = useState(false);

    useEffect(() => {
        if (isOpen && businessId) {
            fetchUnassignedLeads();
            fetchBusinessBatches();
            fetchCampaignLocks();
        }
    }, [isOpen, businessId]);

    const fetchCampaignLocks = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/campaign-lock-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.lockedMap) {
                setLockedBatchesMap(res.data.lockedMap);
            }
        } catch (e) {
            console.error("fetchCampaignLocks error:", e);
        }
    };

    const fetchUnassignedLeads = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/unassigned-batch-leads', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId }
            });
            const fetched = res.data.leads || [];
            setLeads(fetched);
            setSelectedLeadIds(fetched.map(l => l.id)); // Default select all
        } catch (error) {
            toast.error("Failed to fetch unassigned batch leads");
        } finally {
            setLoading(false);
        }
    };

    const fetchBusinessBatches = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/business-batches', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId }
            });
            setBatches(res.data || []);
        } catch (error) {
            console.error("Failed to fetch business batches:", error);
        }
    };

    const handleOpenChat = async (lead) => {
        setChatLead(lead);
        setLoadingChat(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/after-seminar-crm/lead-chat/${lead.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChatMessages(res.data.messages || []);
        } catch (error) {
            toast.error("Failed to load chat history");
        } finally {
            setLoadingChat(false);
        }
    };

    const toggleLeadSelection = (id) => {
        if (selectedLeadIds.includes(id)) {
            setSelectedLeadIds(selectedLeadIds.filter(i => i !== id));
        } else {
            setSelectedLeadIds([...selectedLeadIds, id]);
        }
    };

    const handleSelectAll = () => {
        if (selectedLeadIds.length === filteredLeads.length) {
            setSelectedLeadIds([]);
        } else {
            setSelectedLeadIds(filteredLeads.map(l => l.id));
        }
    };

    const isTargetBatchLocked = Boolean(selectedBatchId && lockedBatchesMap[selectedBatchId]);
    const hasOpenSemLead = leads.some(l => selectedLeadIds.includes(l.id) && (l.inquiryType === 'OPEN_SEMINAR' || l.inquiryType === 'NORMAL'));

    const handleAssignToBatch = async () => {
        if (!selectedBatchId) {
            toast.error("Please select a target Batch");
            return;
        }
        if (selectedLeadIds.length === 0) {
            toast.error("Please select at least one lead");
            return;
        }
        if (isTargetBatchLocked && hasOpenSemLead) {
            toast.error("Open Seminar campaign for this batch is locked! Cannot assign Open Seminar leads to it.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/assign-leads-to-batch', {
                leadIds: selectedLeadIds,
                targetBatchId: selectedBatchId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(`Successfully assigned ${selectedLeadIds.length} leads to batch!`);
            onClose();
            if (onBatchAssigned) onBatchAssigned();
        } catch (error) {
            const errMsg = error.response?.data?.error || "Failed to assign leads to batch";
            toast.error(errMsg);
        }
    };

    if (!isOpen) return null;

    const filteredLeads = leads.filter(l => 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.phone.includes(searchQuery)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
            <div className="bg-[#0F172A] border border-white/10 rounded-3xl w-full max-w-5xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-center pb-5 border-b border-white/10 mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                            <FaLayerGroup size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Unassigned Batch Leads (After Seminar CRM)</h2>
                            <p className="text-xs text-slate-400">Assign AFTER_SEMINAR leads with missing batch IDs to a specific batch</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 relative z-10">
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                        <FaSearch className="text-slate-400 mr-2" size={14} />
                        <input
                            type="text"
                            placeholder="Search name or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none w-full"
                        />
                    </div>

                    <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="bg-black/40 border border-white/10 text-xs text-white rounded-xl px-4 py-2 outline-none cursor-pointer"
                    >
                        <option value="" className="bg-slate-900">Select Target Batch...</option>
                        {batches.map(b => (
                            <option key={b.id} value={b.id} className="bg-slate-900">
                                {b.name} {lockedBatchesMap[b.id] ? '🔒 [Open Sem Locked]' : ''}
                            </option>
                        ))}
                    </select>

                    <button
                        disabled={isTargetBatchLocked && hasOpenSemLead}
                        onClick={handleAssignToBatch}
                        className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                            isTargetBatchLocked && hasOpenSemLead
                                ? 'bg-slate-800 text-slate-500 border border-red-500/30 opacity-40 cursor-not-allowed pointer-events-none'
                                : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                        title={isTargetBatchLocked && hasOpenSemLead ? "Open Seminar is locked for this batch" : ""}
                    >
                        {isTargetBatchLocked && hasOpenSemLead ? <FaLock size={14} className="text-red-400" /> : <FaCheckCircle size={14} />} 
                        {isTargetBatchLocked && hasOpenSemLead ? 'Campaign Locked' : `Assign ${selectedLeadIds.length} Leads`}
                    </button>
                </div>

                {isTargetBatchLocked && hasOpenSemLead && (
                    <div className="mb-4 p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2 relative z-10">
                        <FaLock className="text-red-400 shrink-0" />
                        <span><strong>Campaign Locked:</strong> Target batch Open Seminar campaign is locked by Manager/Admin. Cannot allocate Open Seminar leads to this batch.</span>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500 animate-pulse">Loading unassigned leads...</div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">No unassigned After Seminar batch leads found.</div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 bg-[#0F172A] z-10">
                                    <th className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                                            onChange={handleSelectAll}
                                            className="cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Phone</th>
                                    <th className="p-3">Campaign</th>
                                    <th className="p-3">Inquiry Type</th>
                                    <th className="p-3 text-right">Chat Preview</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLeads.map(l => (
                                    <tr key={l.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedLeadIds.includes(l.id)}
                                                onChange={() => toggleLeadSelection(l.id)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-3 font-semibold text-white">{l.name}</td>
                                        <td className="p-3 font-mono text-slate-300">{l.phone}</td>
                                        <td className="p-3 text-indigo-400">{l.campaignType}</td>
                                        <td className="p-3 text-amber-400">{l.inquiryType}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => handleOpenChat(l)}
                                                className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition-all"
                                            >
                                                <FaCommentDots size={12} /> View Chat
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Chat Preview Modal */}
            {chatLead && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in font-sans">
                    <div className="bg-[#0F172A] border border-white/10 rounded-3xl w-full max-w-lg p-6 flex flex-col max-h-[80vh] shadow-[0_0_50px_rgba(0,0,0,0.9)]">
                        <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                                    <FaUser size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">{chatLead.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-mono">{chatLead.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setChatLead(null)} className="p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-lg">
                                <FaTimes size={14} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {loadingChat ? (
                                <div className="text-center py-8 text-slate-500 animate-pulse text-xs">Loading chat history...</div>
                            ) : chatMessages.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-xs">No chat messages found for this lead.</div>
                            ) : (
                                chatMessages.map(msg => (
                                    <div key={msg.id} className={`flex flex-col ${msg.direction === 'OUTBOUND' || msg.direction === 'outbound' ? 'items-end' : 'items-start'}`}>
                                        <div className={`p-3 rounded-2xl max-w-[85%] text-xs ${msg.direction === 'OUTBOUND' || msg.direction === 'outbound' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                                            <p>{msg.message}</p>
                                            <span className="text-[9px] text-slate-400 mt-1 block text-right">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

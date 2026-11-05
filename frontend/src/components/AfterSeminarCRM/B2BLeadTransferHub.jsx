import React, { useState, useEffect } from 'react';
import { FaTimes, FaExchangeAlt, FaHistory, FaSearch, FaCheckSquare, FaInbox, FaPaperPlane, FaSpinner, FaChevronDown } from 'react-icons/fa';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

export default function B2BLeadTransferHub({ isOpen, onClose, currentBusinessId }) {
    const [activeTab, setActiveTab] = useState('TRANSFER');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [targetBusiness, setTargetBusiness] = useState('');
    const [transferRemark, setTransferRemark] = useState('');

    const [availableLeads, setAvailableLeads] = useState([]);
    const [inboxHistory, setInboxHistory] = useState([]);
    const [sentHistory, setSentHistory] = useState([]);
    const [apiBusinesses, setApiBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [visibleCount, setVisibleCount] = useState(50);

    useEffect(() => {
        if (isOpen) {
            fetchBusinesses();
            if (currentBusinessId) {
                fetchLeads();
                fetchHistory();
            }
        } else {
            setAvailableLeads([]);
            setSelectedLeads([]);
            setSearchQuery('');
            setTargetBusiness('');
            setTransferRemark('');
            setActiveTab('TRANSFER');
            setVisibleCount(50);
        }
    }, [isOpen, currentBusinessId]);

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/admin/manager/batches-full');
            const uniqueBiz = [];
            const bizMap = new Map();
            (res.data || []).forEach(b => {
                if (b.business && !bizMap.has(b.business.id)) {
                    bizMap.set(b.business.id, true);
                    uniqueBiz.push(b.business);
                }
            });
            setApiBusinesses(uniqueBiz);
        } catch (error) {
            console.error("Failed to load businesses", error);
        }
    };

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/leads/master-directory', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: currentBusinessId }
            });
            
            const formattedLeads = (res.data.leads || []).map(l => ({
                id: l.id,
                name: l.name || 'Unknown',
                phone: l.phone ? l.phone.split('_')[0] : 'No Phone',
                course: l.inquiryType?.replace('_', ' ') || 'Normal Inquiry'
            }));
            
            setAvailableLeads(formattedLeads);
        } catch (error) {
            toast.error("Failed to load leads.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/leads/b2b-history', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: currentBusinessId }
            });
            setInboxHistory(res.data.inbox || []);
            setSentHistory(res.data.sent || []);
        } catch (error) {}
    };

    useEffect(() => {
        if (activeTab === 'INBOX') {
            setInboxHistory(prev => prev.map(item => ({ ...item, isNew: false })));
        }
    }, [activeTab]);

    if (!isOpen) return null;

    const filteredLeads = availableLeads.filter(l => 
        l.phone.includes(searchQuery) || l.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedLeads = filteredLeads.slice(0, visibleCount);

    const toggleLeadSelection = (id) => {
        setSelectedLeads(prev => prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedLeads.length === displayedLeads.length) setSelectedLeads([]);
        else setSelectedLeads(displayedLeads.map(l => l.id));
    };

    const handleTransfer = async () => {
        if (selectedLeads.length === 0) return toast.error("Please select at least one lead to transfer.");
        if (!targetBusiness) return toast.error("Please select a destination business unit.");
        
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/leads/b2b-transfer', { 
                leadIds: selectedLeads, 
                targetBusinessId: targetBusiness,
                sourceBusinessId: currentBusinessId,
                transferRemark: transferRemark
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            toast.success(`Successfully transferred ${selectedLeads.length} leads!`);
            setSelectedLeads([]);
            setTargetBusiness('');
            setTransferRemark('');
            onClose(); 
            window.location.reload(); 
        } catch (error) {
            toast.error("Transfer failed. Please try again.");
        }
    };

    const availableDestinationBusinesses = apiBusinesses.filter(b => String(b.id) !== String(currentBusinessId));

    // 🔥 ID එකෙන් Business එකේ ඇත්ත නම හොයාගන්න Function එක 🔥
    const getBusinessName = (id) => {
        const biz = apiBusinesses.find(b => String(b.id) === String(id));
        return biz ? biz.name : `Business Unit ${id}`;
    };

    return (
        <div className="fixed inset-0 z-[300] bg-[#020617]/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0f172a] w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col overflow-hidden border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                
                <div className="bg-[#1e293b] px-6 py-5 flex justify-between items-center border-b border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl"><FaExchangeAlt size={22}/></div>
                        <div>
                            <h3 className="text-white font-black text-xl tracking-wide uppercase">B2B Lead Transfer Hub</h3>
                            <p className="text-slate-400 text-xs mt-1 font-medium">Transfer leads between business units</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-3 rounded-xl transition-all shadow-sm">
                        <FaTimes size={18} />
                    </button>
                </div>

                <div className="flex bg-[#1e293b] border-b border-slate-700 p-2 gap-2 shrink-0">
                    <button onClick={() => setActiveTab('TRANSFER')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5'}`}>
                        <FaPaperPlane /> Send Leads
                    </button>
                    <button onClick={() => setActiveTab('INBOX')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeTab === 'INBOX' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5'}`}>
                        <FaInbox /> Received Inbox
                        {inboxHistory.some(h => h.isNew) && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>}
                    </button>
                    <button onClick={() => setActiveTab('SENT')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'SENT' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:bg-white/5'}`}>
                        <FaHistory /> Transfer History
                    </button>
                </div>

                <div className="flex-1 overflow-hidden p-6 bg-transparent flex flex-col">
                    
                    {/* 🚀 SEND LEADS TAB */}
                    {activeTab === 'TRANSFER' && (
                        <div className="flex flex-col h-full gap-4 animate-fade-in overflow-hidden">
                            <div className="flex gap-4 shrink-0">
                                <div className="relative flex-1">
                                    <FaSearch className="absolute left-4 top-3.5 text-slate-400 text-sm" />
                                    <input 
                                        type="text" placeholder="Search leads by phone or name to transfer..." 
                                        value={searchQuery} 
                                        onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(50); }}
                                        className="w-full bg-[#1e293b] border border-slate-600 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-amber-500 shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="flex-1 border border-slate-700 rounded-2xl overflow-hidden bg-[#1e293b] flex flex-col">
                                {isLoading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-indigo-400">
                                        <FaSpinner className="animate-spin text-3xl mb-3" />
                                        <p className="text-sm font-bold animate-pulse">Loading Leads...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-[#0f172a] text-slate-400 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-700">
                                                <tr>
                                                    <th className="py-4 px-4 w-10 text-center">
                                                        <button onClick={handleSelectAll} className="text-slate-400 hover:text-amber-400 transition-colors">
                                                            <FaCheckSquare size={16} className={selectedLeads.length > 0 && selectedLeads.length === displayedLeads.length ? 'text-amber-500' : ''} />
                                                        </button>
                                                    </th>
                                                    <th className="py-4 px-4 font-black">Lead Details</th>
                                                    <th className="py-4 px-4 font-black">Inquiry Type</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/50">
                                                {displayedLeads.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="text-center py-12 text-slate-500 font-bold">No leads found.</td>
                                                    </tr>
                                                ) : (
                                                    displayedLeads.map(l => (
                                                        <tr key={l.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => toggleLeadSelection(l.id)}>
                                                            <td className="py-3 px-4 text-center">
                                                                <input type="checkbox" checked={selectedLeads.includes(l.id)} readOnly className="w-4 h-4 accent-amber-500 rounded bg-slate-800 border-slate-600" />
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <h4 className="text-slate-100 font-black text-sm">{l.phone}</h4>
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase">{l.name}</p>
                                                            </td>
                                                            <td className="py-3 px-4 text-xs text-slate-400 font-bold">
                                                                <span className="bg-slate-800 px-2 py-1 rounded-md border border-slate-700">{l.course}</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        
                                        {filteredLeads.length > visibleCount && (
                                            <div className="flex justify-center p-4 border-t border-slate-700/50">
                                                <button 
                                                    onClick={() => setVisibleCount(prev => prev + 50)}
                                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-6 py-2.5 rounded-full transition-all border border-slate-600"
                                                >
                                                    <FaChevronDown /> Load More Leads ({visibleCount} of {filteredLeads.length})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700 flex flex-col gap-3 shrink-0">
                                <input 
                                    type="text" 
                                    placeholder="Add a remark or instruction for the receiving unit (Optional)..." 
                                    value={transferRemark} 
                                    onChange={(e) => setTransferRemark(e.target.value)}
                                    className="w-full bg-[#0f172a] border border-slate-600 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:border-amber-500 shadow-inner placeholder-slate-500"
                                />
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm font-bold text-slate-300"><span className="text-amber-400 text-lg">{selectedLeads.length}</span> Selected</span>
                                    <div className="flex gap-3 flex-1 justify-end">
                                        <select value={targetBusiness} onChange={(e) => setTargetBusiness(e.target.value)} className="bg-[#0f172a] border border-slate-600 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 min-w-[250px] shadow-inner">
                                            <option value="">Select Destination Business Unit...</option>
                                            {availableDestinationBusinesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <button onClick={handleTransfer} disabled={selectedLeads.length === 0 || !targetBusiness} className={`px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${selectedLeads.length > 0 && targetBusiness ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] hover:scale-105' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                                            Transfer Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 📥 INBOX TAB */}
                    {activeTab === 'INBOX' && (
                        <div className="flex flex-col gap-4 animate-fade-in overflow-y-auto custom-scrollbar h-full">
                            {inboxHistory.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 mt-10">
                                    <FaInbox className="text-6xl mb-4 opacity-20" />
                                    <p className="font-bold text-sm uppercase tracking-widest">No Incoming Transfers</p>
                                </div>
                            ) : (
                                inboxHistory.map(item => (
                                    <div key={item.id} className="bg-[#1e293b] p-5 rounded-2xl border border-emerald-500/20 shadow-md flex flex-col relative shrink-0">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                                        <div className="flex justify-between items-center mb-4 pl-2">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{item.date}</p>
                                                <h4 className="text-white font-black text-sm tracking-wide">
                                                    Received from: <span className="text-emerald-400">{getBusinessName(item.fromBizId)}</span>
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black text-white">{item.leads?.length || 0}</span>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Leads Added</p>
                                            </div>
                                        </div>
                                        
                                        {/* 🔥 ළමයිගේ ලිස්ට් එකයි Note එකයි පෙන්නනවා 🔥 */}
                                        <div className="bg-[#0f172a] rounded-xl p-3 flex flex-col gap-2 border border-slate-700/50">
                                            {item.leads?.map(l => (
                                                <div key={l.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1e293b] p-3 rounded-lg border border-slate-700 gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-200">{l.phone}</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{l.name}</span>
                                                    </div>
                                                    {l.remark && l.remark !== 'No specific remark' && (
                                                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-lg max-w-full sm:max-w-[250px] truncate" title={l.remark}>
                                                            <span className="font-bold mr-1">Note:</span>{l.remark}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 📤 SENT HISTORY TAB */}
                    {activeTab === 'SENT' && (
                        <div className="flex flex-col gap-4 animate-fade-in overflow-y-auto custom-scrollbar h-full">
                            {sentHistory.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 mt-10">
                                    <FaPaperPlane className="text-6xl mb-4 opacity-20" />
                                    <p className="font-bold text-sm uppercase tracking-widest">No Outgoing Transfers</p>
                                </div>
                            ) : (
                                sentHistory.map(item => (
                                    <div key={item.id} className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700 shadow-md flex flex-col relative opacity-80 shrink-0">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500"></div>
                                        <div className="flex justify-between items-center mb-4 pl-2">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{item.date}</p>
                                                <h4 className="text-white font-black text-sm tracking-wide">
                                                    Sent to: <span className="text-indigo-400">{getBusinessName(item.toBizId)}</span>
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black text-white">{item.leads?.length || 0}</span>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Leads Transferred</p>
                                            </div>
                                        </div>
                                        
                                        {/* 🔥 යවපු ළමයිගේ ලිස්ට් එකයි Note එකයි පෙන්නනවා 🔥 */}
                                        <div className="bg-[#0f172a] rounded-xl p-3 flex flex-col gap-2 border border-slate-700/50">
                                            {item.leads?.map(l => (
                                                <div key={l.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1e293b] p-3 rounded-lg border border-slate-700 gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-200">{l.phone}</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{l.name}</span>
                                                    </div>
                                                    {l.remark && l.remark !== 'No specific remark' && (
                                                        <div className="bg-slate-800 text-slate-400 border border-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg max-w-full sm:max-w-[250px] truncate" title={l.remark}>
                                                            <span className="font-bold mr-1">Note:</span>{l.remark}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
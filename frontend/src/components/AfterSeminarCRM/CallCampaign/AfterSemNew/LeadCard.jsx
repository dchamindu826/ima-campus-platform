import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaLock, FaUnlock, FaSave, FaCommentDots, FaArrowRight, FaChevronDown, FaChevronUp, FaExclamationTriangle, FaBell, FaTimes, FaCheckCircle, FaTrash, FaPhoneAlt, FaWhatsapp, FaBan } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../../../../api/axios';
import { useCall } from '../../../../contexts/CallContext';

export default function LeadCard({ lead, timer, drafts, activeTab, typingMode, handleUpdateLocalLead, handleLocalCallStatusChange, handleRemarkTyping, handleSaveCallData, handlePushToNextRound, setChatModalLead, isManager, handleTempUnlock }) {
    
    if (!lead) return null;

    const { startOutboundCall } = useCall();
    const [isExpanded, setIsExpanded] = useState(lead?.callStatus === 'pending' || !lead?.callStatus);
    const currentRemark = drafts?.[lead.id] !== undefined ? drafts[lead.id] : (lead?.feedback || '');
    const isLate = timer?.type === 'danger' && activeTab !== 'ENROLLED';
    const isLocked = lead?.isLocked || false; 
    
    // 🔥 Rule 03 FIX: Save කරනකම් Dropdown අගයන් තියාගන්න Local State එක 🔥
    const [localData, setLocalData] = useState({
        callStatus: lead.callStatus || 'pending',
        enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED',
        paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
        callMethod: lead.callMethod || 'direct',
        callAttempt: lead.callAttempt || 1
    });

    useEffect(() => {
        if (lead) {
            setLocalData({
                callStatus: lead.callStatus || 'pending',
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED',
                paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
                callMethod: lead.callMethod || 'direct',
                callAttempt: lead.callAttempt || 1
            });
        }
    }, [lead.callStatus, lead.enrollmentStatus, lead.paymentIntention, lead.callMethod, lead.callAttempt]);

    const invalidPending = lead.isLocked && localData.callStatus === 'pending';

    const [showReminder, setShowReminder] = useState(false);
    const [existingReminderId, setExistingReminderId] = useState(null);
    const [remindDate, setRemindDate] = useState('');
    const [remindTime, setRemindTime] = useState('');
    const [remindNote, setRemindNote] = useState('');
    const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);

    // 🔥 Rule 04: Next Round යන්නේ Answer හෝ Reject නම් විතරයි, ඒකත් දවස් 5 කට පස්සේ 🔥
    const canPushRound = useMemo(() => {
        if (activeTab === 'ENROLLED' || String(activeTab).includes('3')) return false; 
        if (localData.callStatus !== 'answered' && localData.callStatus !== 'reject') return false; 

        const updatedAtTime = new Date(lead?.updatedAt || lead?.createdAt).getTime();
        const isReady = (new Date().getTime() - updatedAtTime) >= (5 * 24 * 60 * 60 * 1000); 
        return isReady;
    }, [lead, activeTab, localData.callStatus]);

    const handleOpenReminderModal = async (e) => {
        e.preventDefault();
        const loadToast = toast.loading("Loading reminder details...");
        try {
            const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
            const agentId = loggedUser.id || loggedUser.userId;
            
            const res = await axios.get(`/reminders/my-reminders?agentId=${agentId}`);
            const existing = res.data.find(r => r.leadId === lead.id);

            if (existing) {
                setExistingReminderId(existing.id);
                const d = new Date(existing.remindAt);
                setRemindDate(d.toISOString().split('T')[0]);
                setRemindTime(d.toTimeString().slice(0, 5));
                setRemindNote(existing.note || '');
            } else {
                setExistingReminderId(null);
                setRemindDate(''); setRemindTime(''); setRemindNote('');
            }
            toast.dismiss(loadToast);
            setShowReminder(true);
        } catch (error) {
            toast.error("Failed to load data.", { id: loadToast });
        }
    };

    const handleSetReminder = async () => {
        if (!remindDate || !remindTime) return toast.error("Please select a date and time!");
        setIsSubmittingReminder(true);
        const loadToast = toast.loading(existingReminderId ? "Updating reminder..." : "Setting reminder...");
        
        try {
            const token = localStorage.getItem('token');
            const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
            const agentId = loggedUser.id || loggedUser.userId;
            const formattedDate = new Date(`${remindDate}T${remindTime}:00`).toISOString();
            
            if (existingReminderId) {
                await axios.put('/reminders/edit', { reminderId: existingReminderId, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success("Reminder updated successfully!", { id: loadToast });
            } else {
                await axios.post('/reminders/create', { leadId: lead.id, agentId: agentId, leadType: lead.inquiryType || 'UNKNOWN', phone: lead.phone, name: lead.name, round: lead.coordinationRound || 1, phase: lead.phase || 1, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success("Reminder set successfully!", { id: loadToast });
            }
            setShowReminder(false);
        } catch (error) {
            toast.error("Operation failed.", { id: loadToast });
        } finally {
            setIsSubmittingReminder(false);
        }
    };

    const handleDeleteReminder = async () => {
        if (!window.confirm("Are you sure you want to delete this reminder?")) return;
        setIsSubmittingReminder(true);
        const loadToast = toast.loading("Deleting reminder...");
        try {
            await axios.delete(`/reminders/delete/${existingReminderId}`);
            toast.success("Reminder deleted!", { id: loadToast });
            setShowReminder(false);
        } catch (error) {
            toast.error("Failed to delete.", { id: loadToast });
        } finally {
            setIsSubmittingReminder(false);
        }
    };

    // 🔥 Rule 03 FIX: Save Button එක එබුවම විතරක් API යවනවා 🔥
    const handleLocalSave = () => {
        // Parent එකේ API Function එකට Status එක යවනවා
        handleSaveCallData(lead.id, localData.callStatus);
        
        // no_answer නම් Dropdown එක Pending වලට හරවලා පෙන්නනවා (Phase එක Backend එකෙන් හැදෙනවා)
        if (localData.callStatus === 'no_answer') {
            setLocalData(prev => ({ ...prev, callStatus: 'pending' }));
        }
    };

    const handleSendCallRequest = async (e) => {
        e.preventDefault();
        const loadToast = toast.loading("Sending call request...");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/leads/send-call-request', { leadId: lead.id }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Request sent successfully!", { id: loadToast });
            if (typeof handleUpdateLocalLead === 'function') {
                handleUpdateLocalLead(lead.id, 'waCallPermissionStatus', 'PENDING');
            }
        } catch (error) {
            toast.error("Failed to send request.", { id: loadToast });
        }
    };

    return (
        <div className={`bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border ${((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_')))) ? 'border-emerald-500/30' : (isLate ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-white/10 hover:border-white/20')} transition-all duration-200 shadow-sm flex flex-col`}>
            
            <div onClick={() => setIsExpanded(!isExpanded)} className="p-3 flex justify-between items-start cursor-pointer relative bg-black/10 hover:bg-black/20 transition-colors">
                <div className="flex gap-3 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 shadow-inner">
                        {lead.realIndex || 1}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <h4 className="font-black text-[15px] text-white flex items-center gap-1.5 truncate tracking-wide">
                            {lead.phone} {isLocked && <div className="flex items-center gap-1 bg-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-400 ml-2 border border-rose-500/30"><FaLock size={8}/> Locked</div>}
                            {lead?.isBlocked && <div className="flex items-center gap-1 bg-red-600/30 text-red-300 px-2 py-0.5 rounded text-[10px] font-black ml-2 border border-red-500/50 shadow-sm tracking-wider"><FaBan size={9}/> Blocked Number</div>}
                        </h4>
                        <p className="text-xs font-medium text-slate-400 truncate w-full mt-0.5">{lead.name || 'No Name Provided'}</p>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                    {timer && activeTab !== 'ENROLLED' && (
                        <span className={`text-[10px] font-bold flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-md ${timer.type === 'danger' ? 'text-red-400 border border-red-500/30' : timer.type === 'warning' ? 'text-amber-400 border border-amber-500/30' : timer.type === 'success' ? 'text-emerald-400 border border-emerald-500/30' : 'text-slate-400 border border-slate-500/30'}`}>
                            {timer.type === 'danger' ? <FaExclamationTriangle size={8}/> : '⏳'} {timer.text}
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded border shadow-sm ${localData.callStatus === 'answered' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : localData.callStatus === 'no_answer' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : localData.callStatus === 'reject' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-white/5 text-slate-300 border-white/10'}`}>
                            {localData.callStatus ? localData.callStatus.replace('_', ' ') : 'PENDING'}
                        </span>
                        {isExpanded ? <FaChevronUp size={12} className="text-slate-400" /> : <FaChevronDown size={12} className="text-slate-400" />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 bg-black/20 border-t border-white/10 flex flex-col gap-3 flex-1">
                    {lead?.isBlocked && (
                        <div className="bg-red-500/20 border border-red-500/40 p-2.5 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2">
                            <FaBan className="text-red-400 shrink-0" size={14}/>
                            <div className="flex-1">
                                <span className="text-white font-black">This number is BLOCKED.</span>
                                {lead?.blockedReason && <span className="block text-[11px] font-normal text-red-200 mt-0.5">Reason: {lead.blockedReason}</span>}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Status</label>
                            <select disabled value={localData.enrollmentStatus} onChange={(e) => setLocalData({...localData, enrollmentStatus: e.target.value})} className="w-full bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none opacity-80 cursor-not-allowed">
                                <option value="NON_ENROLLED" className="bg-slate-800">Non-Enrolled</option>
                                <option value="PAYMENT_PROCESSING" className="bg-slate-800 text-yellow-400">Payment Processing</option>
                                <option value="ENROLLED" className="bg-slate-800 text-emerald-400">Enrolled</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Pay Plan</label>
                            <select disabled={isLocked} value={localData.paymentIntention} onChange={(e) => setLocalData({...localData, paymentIntention: e.target.value})} className="w-full bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                                <option value="NOT_DECIDED" className="bg-slate-800">Not Decided</option>
                                <option value="FULL" className="bg-slate-800 text-indigo-400">Full</option>
                                <option value="MONTHLY" className="bg-slate-800 text-blue-400">Monthly</option>
                                <option value="INSTALLMENT" className="bg-slate-800 text-amber-400">Installment</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Method</label>
                            <select disabled={isLocked} value={localData.callMethod} onChange={(e) => setLocalData({...localData, callMethod: e.target.value})} className="w-full bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                                <option value="direct" className="bg-slate-800">Direct Call</option>
                                <option value="whatsapp" className="bg-slate-800">WhatsApp</option>
                                <option value="3cx" className="bg-slate-800">3CX</option>
                            </select>
                        </div>
                        <div className="w-16 shrink-0">
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Att.</label>
                            <select disabled={isLocked} value={localData.callAttempt} onChange={(e) => setLocalData({...localData, callAttempt: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-lg px-1 py-1.5 outline-none text-center focus:border-indigo-500 transition-colors cursor-pointer">
                                {[1,2,3,4,5].map(r => <option key={r} value={r} className="bg-slate-800">{r}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[70px]">
                        <label className="text-[10px] font-bold text-slate-400 mb-1 flex justify-between items-center">
                            Remarks 
                            {typingMode === 'si-phonetic' && <span className="text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px]">SIN</span>}
                        </label>
                        <textarea 
                            disabled={isLocked}
                            value={currentRemark} onChange={(e) => handleRemarkTyping(lead.id, e.target.value)} 
                            placeholder="Add your notes..." 
                            className={`flex-1 w-full bg-black/30 border border-white/10 focus:border-indigo-500 rounded-lg p-2 text-xs font-medium text-slate-200 outline-none resize-none custom-scrollbar transition-colors`} 
                        />
                    </div>

                    {/* Dual Call Buttons */}
                    <div className="flex gap-2 w-full mt-3 mb-2">
                        <button onClick={(e) => { e.preventDefault(); toast.error('Coming Soon', { icon: '🚧' }); }} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all border border-blue-500/30">
                            <FaPhoneAlt size={12} /> Normal Call
                        </button>

                        {lead.waCallPermissionStatus === 'ALLOWED' && (!lead.waCallPermissionExpiry || new Date(lead.waCallPermissionExpiry) > new Date()) ? (
                            <button onClick={() => {
                                if (startOutboundCall) {
                                    startOutboundCall({ lead, businessId: lead.batch?.businessId, campaignType: 'AFTER_SEMINAR' });
                                } else if (typeof onInitiateCall === 'function') {
                                    onInitiateCall(lead);
                                } else if (onOpenChat) {
                                    onOpenChat(lead);
                                }
                            }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg py-1.5 text-xs font-bold flex flex-col items-center justify-center shadow-md shadow-emerald-500/20 transition-all leading-none border border-emerald-500/30">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <FaWhatsapp size={14} /> WhatsApp Call
                                </div>
                                <span className="text-[9px] font-mono text-emerald-100 bg-black/20 px-1.5 py-0.5 rounded">
                                    {lead.waCallPermissionExpiry ? `Ends: ${Math.max(0, Math.ceil((new Date(lead.waCallPermissionExpiry) - new Date()) / (1000 * 60 * 60 * 24)))} Days` : 'Always Allowed'}
                                </span>
                            </button>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-2 mt-auto">
                        <select disabled={isLocked} onChange={(e) => setLocalData({...localData, callStatus: e.target.value})} value={localData.callStatus} className={`w-full text-xs font-black uppercase tracking-wider rounded-lg px-2 py-2 outline-none border text-center transition-colors shadow-sm bg-white/10 text-white border-white/20 focus:border-indigo-500 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <option value="pending" className="bg-slate-800 text-slate-300">⏳ PENDING</option>
                            <option value="answered" className="bg-slate-800 text-emerald-400">✅ ANSWERED</option>
                            <option value="no_answer" className="bg-slate-800 text-amber-400">📵 NO ANSWER</option>
                            <option value="reject" className="bg-slate-800 text-rose-400">❌ REJECTED</option>
                        </select>
                        
                        <div className="flex gap-2 w-full">
                            <button disabled={invalidPending} onClick={handleLocalSave} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-transform bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:scale-[1.02]`}>
                                <FaSave size={12}/> SAVE
                            </button>
                            <button onClick={(e) => { e.preventDefault(); if(typeof setChatModalLead === 'function') setChatModalLead(lead); }} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-3.5 rounded-lg flex items-center justify-center relative transition-colors shadow-sm">
                                <FaCommentDots size={14}/>
                                {(lead?.unreadCount || 0) > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-800 shadow-sm"></span>}
                            </button>
                            
                            <button onClick={handleOpenReminderModal} title="Set a Reminder" className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3.5 rounded-lg flex items-center justify-center transition-colors shadow-sm">
                                <FaBell size={14}/>
                            </button>

                            <button 
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (lead.isBlocked) {
                                        if (window.confirm(`Unblock ${lead.phone}?`)) {
                                            try {
                                                const token = localStorage.getItem('token');
                                                await axios.post('/after-seminar-crm/leads/unblock', { leadId: lead.id, phone: lead.phone }, { headers: { Authorization: `Bearer ${token}` } });
                                                lead.isBlocked = false;
                                                toast.success("Unblocked");
                                                if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', false);
                                            } catch (err) { toast.error("Failed to unblock"); }
                                        }
                                    } else {
                                        const reason = window.prompt(`Block number ${lead.phone}? Enter reason:`, "Spam / Harassment");
                                        if (reason !== null) {
                                            try {
                                                const token = localStorage.getItem('token');
                                                await axios.post('/after-seminar-crm/leads/block', { leadId: lead.id, phone: lead.phone, reason }, { headers: { Authorization: `Bearer ${token}` } });
                                                lead.isBlocked = true;
                                                toast.success("Number blocked");
                                                if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', true);
                                            } catch (err) { toast.error("Failed to block"); }
                                        }
                                    }
                                }} 
                                title={lead.isBlocked ? "Unblock Number" : "Block Number"} 
                                className={`px-3 rounded-lg flex items-center justify-center transition-colors shadow-sm ${lead.isBlocked ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10'}`}
                            >
                                <FaBan size={13}/>
                            </button>
                        </div>

                        {canPushRound && (
                            <button onClick={() => handlePushToNextRound(lead.id, lead.coordinationRound || 1, localData.callStatus)} className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 uppercase transition-colors shadow-sm">
                                Push To Round {(lead.coordinationRound || 1) + 1} <FaArrowRight size={10} />
                            </button>
                        )}
                        
                        {isLocked && isManager && handleTempUnlock && (
                            <button onClick={() => handleTempUnlock(lead.id)} className="w-full bg-white/5 text-blue-400 border border-white/10 text-[10px] font-bold py-2 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors mt-1"><FaUnlock size={10} className="mr-1"/> Unlock Lead</button>
                        )}
                    </div>
                </div>
            )}

            {/* REMINDER MODAL */}
            {showReminder && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
                            <h3 className="text-white font-bold flex items-center gap-2 text-lg"><FaBell className="text-amber-500"/> {existingReminderId ? 'Update Reminder' : 'Set Reminder'}</h3>
                            <button onClick={() => setShowReminder(false)} className="text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"><FaTimes size={14}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex justify-center items-center font-black text-xs shrink-0">{lead.realIndex || 1}</div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white tracking-wide truncate">{lead.phone}</p>
                                    <p className="text-[10px] text-amber-400 uppercase tracking-widest truncate">{lead.name || 'Student'}</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
                                    <input type="date" value={remindDate} onChange={e=>setRemindDate(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500 mt-1" min={new Date().toISOString().split('T')[0]}/>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time</label>
                                    <input type="time" value={remindTime} onChange={e=>setRemindTime(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500 mt-1"/>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Note (Optional)</label>
                                <textarea value={remindNote} onChange={e=>setRemindNote(e.target.value)} placeholder="e.g. Call after 5PM, father will answer..." className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 mt-1 resize-none h-20 custom-scrollbar"></textarea>
                            </div>
                            
                            {existingReminderId ? (
                                <div className="flex gap-2 mt-2">
                                    <button disabled={isSubmittingReminder} onClick={handleSetReminder} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex justify-center items-center gap-2">
                                        {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaSave size={14}/>} Update
                                    </button>
                                    <button disabled={isSubmittingReminder} onClick={handleDeleteReminder} className="px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-lg shadow-rose-500/20 flex justify-center items-center">
                                        {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaTrash size={14}/>}
                                    </button>
                                </div>
                            ) : (
                                <button disabled={isSubmittingReminder} onClick={handleSetReminder} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl mt-2 transition-all flex justify-center items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50">
                                    {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaCheckCircle size={16}/>} Save Reminder
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
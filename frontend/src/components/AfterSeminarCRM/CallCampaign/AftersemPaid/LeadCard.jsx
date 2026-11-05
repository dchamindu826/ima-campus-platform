import React, { useState, useEffect } from 'react';
import { FaLock, FaSave, FaCommentDots, FaChevronDown, FaChevronUp, FaBell, FaBan } from 'react-icons/fa';
import axios from '../../../../api/axios';
import toast from 'react-hot-toast';

export default function LeadCard({ 
    lead, realIndex, drafts, handleUpdateLocalLead, 
    handleDraftRemark, handleSaveCallData, setChatModalLead 
}) {
    if (!lead) return null;

    const [isExpanded, setIsExpanded] = useState(lead?.callStatus === 'pending' || !lead?.callStatus);
    const currentRemark = drafts?.[lead.id] !== undefined ? drafts[lead.id] : (lead?.feedback || '');
    const isLocked = lead?.isLocked || false; 
    
    // Save කරනකම් Dropdown අගයන් තියාගන්න Local State එක
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

    const handleLocalSave = () => {
        // Parent එකේ API Function එකට Status එක යවනවා
        handleUpdateLocalLead(lead.id, 'enrollmentStatus', localData.enrollmentStatus);
        handleUpdateLocalLead(lead.id, 'paymentIntention', localData.paymentIntention);
        handleUpdateLocalLead(lead.id, 'callMethod', localData.callMethod);
        handleUpdateLocalLead(lead.id, 'callAttempt', localData.callAttempt);
        handleUpdateLocalLead(lead.id, 'callStatus', localData.callStatus);
        
        handleSaveCallData(lead.id, localData);
        
        if (localData.callStatus === 'no_answer') {
            setLocalData(prev => ({ ...prev, callStatus: 'pending' }));
        }
    };

    return (
        <div className={`bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-200 shadow-sm flex flex-col`}>
            
            <div onClick={() => setIsExpanded(!isExpanded)} className="p-3 flex justify-between items-start cursor-pointer relative bg-black/10 hover:bg-black/20 transition-colors">
                <div className="flex gap-3 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 shadow-inner">
                        {realIndex}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <h4 className="font-black text-[15px] text-white flex items-center gap-1.5 truncate tracking-wide">
                            {lead.phone} {isLocked && <FaLock size={10} className="text-rose-500"/>}
                            {lead?.isBlocked && <div className="flex items-center gap-1 bg-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 ml-2 border border-red-500/30"><FaBan size={8}/> Blocked</div>}
                        </h4>
                        <p className="text-xs font-medium text-slate-400 truncate w-full mt-0.5">{lead.name || 'No Name Provided'}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button className="text-slate-400 hover:text-white p-1 rounded-md bg-white/5">
                        {isExpanded ? <FaChevronUp size={12}/> : <FaChevronDown size={12}/>}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3.5 flex flex-col gap-3 flex-1 border-t border-white/10 bg-black/20">
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">Status</label>
                            <select disabled={isLocked} value={localData.enrollmentStatus} onChange={(e) => setLocalData({...localData, enrollmentStatus: e.target.value})} className="w-full bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                                <option value="NON_ENROLLED" className="bg-slate-800">Non Enrolled</option>
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
                        </label>
                        <textarea 
                            disabled={isLocked}
                            value={currentRemark} onChange={(e) => handleDraftRemark(lead.id, e.target.value)} 
                            placeholder="Add your notes..." 
                            className={`flex-1 w-full bg-black/30 border border-white/10 focus:border-indigo-500 rounded-lg p-2 text-xs font-medium text-slate-200 outline-none resize-none custom-scrollbar transition-colors`} 
                        />
                    </div>

                    <div className="flex flex-col gap-2 mt-auto">
                        <select onChange={(e) => setLocalData({...localData, callStatus: e.target.value})} value={localData.callStatus} className={`w-full text-xs font-black uppercase tracking-wider rounded-lg px-2 py-2 outline-none border text-center transition-colors shadow-sm bg-white/10 text-white border-white/20 focus:border-indigo-500 cursor-pointer`}>
                            <option value="pending" className="bg-slate-800 text-slate-300">⏳ PENDING</option>
                            <option value="answered" className="bg-slate-800 text-emerald-400">✅ ANSWERED</option>
                            <option value="no_answer" className="bg-slate-800 text-amber-400">📵 NO ANSWER</option>
                            <option value="reject" className="bg-slate-800 text-rose-400">❌ REJECTED</option>
                        </select>
                        
                        <div className="flex gap-2 w-full">
                            <button disabled={isLocked} onClick={handleLocalSave} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-transform bg-indigo-600 hover:bg-indigo-500 text-white shadow-md hover:scale-[1.02]`}>
                                <FaSave size={12}/> SAVE
                            </button>
                            <button onClick={(e) => { e.preventDefault(); if(typeof setChatModalLead === 'function') setChatModalLead(lead); }} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-3.5 rounded-lg flex items-center justify-center relative transition-colors shadow-sm">
                                <FaCommentDots size={14}/>
                                {(lead?.unreadCount || 0) > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-800 shadow-sm"></span>}
                            </button>
                            <button 
                                onClick={async (e) => {
                                    e.preventDefault();
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
                                className={`px-3.5 rounded-lg flex items-center justify-center transition-colors shadow-sm ${lead.isBlocked ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/10 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10'}`}
                            >
                                <FaBan size={14}/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
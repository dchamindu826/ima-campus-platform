import React, { useState, useEffect } from 'react';
import { MessageCircle, Bell, Check, Phone, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { FaPhoneAlt, FaWhatsapp } from 'react-icons/fa';
import axios from '../../api/axios';
import OutboundDialerModal from '../AfterSeminarCRM/CRM/OutboundDialerModal';
import { useCall } from '../../contexts/CallContext';

export default function LeadCallCard({ lead, roundData, activeRound, index, onSave, onOpenChat, onInitiateCall, isReadOnly = false, isFrozen = false, onOpenReminder }) {
  const { startOutboundCall } = useCall();
  // Use roundData if available (passed from dashboard), else fallback to lead base fields
  const data = roundData || lead;
  
  const [showDialerModal, setShowDialerModal] = useState(false);
  const [callMethod, setCallMethod] = useState(data.callMethod || 'Direct Call');
  const [attempts, setAttempts] = useState(data.callAttempt || 1);
  const [remarks, setRemarks] = useState(data.feedback || '');
  
  // Set call outcome to what's in DB or PENDING
  const initialOutcome = ['ANSWERED', 'REJECT', 'NO_ANSWER'].includes(data.callStatus?.toUpperCase()) 
    ? data.callStatus.toUpperCase() 
    : 'PENDING';
    
  const [callOutcome, setCallOutcome] = useState(initialOutcome);

  useEffect(() => {
    setCallMethod(data.callMethod || 'Direct Call');
    setAttempts(data.callAttempt || 1);
    setRemarks(data.feedback || '');
    const outcome = ['ANSWERED', 'REJECT', 'NO_ANSWER'].includes(data.callStatus?.toUpperCase()) 
      ? data.callStatus.toUpperCase() 
      : 'PENDING';
    setCallOutcome(outcome);
  }, [lead.id, activeRound, data.callStatus, data.feedback, data.callMethod, data.callAttempt]);

  const handleSave = () => {
    if (callOutcome === 'PENDING' && !remarks.trim()) {
      toast.error('Please select a Call Outcome or enter Remarks before saving.');
      return;
    }
    onSave(lead.id, activeRound, {
      callMethod,
      attempts,
      feedback: remarks,
      callOutcome: callOutcome !== 'PENDING' ? callOutcome : (data.callStatus || 'PENDING')
    });
  };

  const isDisabled = isReadOnly || isFrozen;

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
    <div className={`bg-[#1e1b4b]/80 backdrop-blur-md rounded-2xl border ${isDisabled ? 'border-slate-500/50 opacity-80' : 'border-indigo-500/20 hover:border-indigo-400/50'} p-5 shadow-xl mb-2 transition-all group relative overflow-hidden`}>
      {isFrozen && !isReadOnly && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-10">
          <span className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm border border-slate-600 shadow-lg">FROZEN (Wait until next call day)</span>
        </div>
      )}
      {/* Top Section */}
      <div className="flex justify-between items-start mb-4 pb-4 border-b border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black shadow-inner">
            {index + 1}
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-tight tracking-wide">{lead.phone?.split('_')[0]}</h3>
            <p className="text-slate-400 text-sm font-medium">~ {lead.name || 'Unknown'}</p>
          </div>
        </div>
        
        {/* Call Method Display */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Method</span>
          <select 
            disabled={isDisabled}
            value={callMethod}
            onChange={(e) => setCallMethod(e.target.value)}
            className="bg-[#312e81]/50 border border-indigo-500/30 rounded-lg px-2 py-1 text-xs font-bold text-indigo-200 outline-none focus:border-indigo-400 appearance-none text-right disabled:opacity-50"
          >
            <option value="Direct Call" className="bg-[#0f172a] text-indigo-200">Direct Call</option>
            <option value="WhatsApp" className="bg-[#0f172a] text-indigo-200">WhatsApp</option>
            <option value="3CX" className="bg-[#0f172a] text-indigo-200">3CX</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-5">
        <div className="col-span-8">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Outcome</label>
          <div className="relative">
            <select 
              disabled={isDisabled}
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              className={`w-full bg-[#312e81]/30 border rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none transition-colors disabled:opacity-50
                ${callOutcome === 'PENDING' ? 'border-amber-500/30 text-amber-400 focus:border-amber-500/60' : 
                  callOutcome === 'ANSWERED' ? 'border-emerald-500/30 text-emerald-400 focus:border-emerald-500/60' : 
                  callOutcome === 'NO_ANSWER' ? 'border-blue-500/30 text-blue-400 focus:border-blue-500/60' : 
                  'border-rose-500/30 text-rose-400 focus:border-rose-500/60'}`}
            >
              <option value="PENDING">⌛ PENDING</option>
              <option value="ANSWERED">✅ ANSWERED</option>
              <option value="NO_ANSWER">🔇 NO ANSWER</option>
              <option value="REJECT">❌ REJECT</option>
            </select>
          </div>
        </div>
        <div className="col-span-4">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Att.</label>
          <select 
            disabled={isDisabled}
            value={attempts}
            onChange={(e) => setAttempts(Number(e.target.value))}
            className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2.5 text-sm font-black text-rose-400 outline-none focus:border-rose-500 appearance-none text-center disabled:opacity-50"
          >
            {[1,2,3,4,5].map(n => <option key={n} value={n} className="bg-[#0f172a] text-rose-400 font-bold">{n}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Remarks</label>
        <textarea 
          disabled={isDisabled}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add your notes..."
          className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 resize-none placeholder-indigo-300/30 transition-colors disabled:opacity-50"
        />
      </div>

      {/* Dual Call Buttons */}
      <div className="flex gap-2 w-full mb-4">
        <button onClick={(e) => { e.preventDefault(); toast.error('Coming Soon', { icon: '🚧' }); }} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all border border-blue-500/30">
            <FaPhoneAlt size={12} /> Normal Call
        </button>

        {lead.waCallPermissionStatus === 'ALLOWED' && (!lead.waCallPermissionExpiry || new Date(lead.waCallPermissionExpiry) > new Date()) ? (
            <button onClick={() => { if (startOutboundCall) { startOutboundCall({ lead, businessId: lead.batch?.businessId, campaignType: lead.campaignType || 'FREE_SEMINAR' }); } else if (typeof onInitiateCall === 'function') { onInitiateCall(lead); } else { setShowDialerModal(true); } }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg py-1.5 text-xs font-bold flex flex-col items-center justify-center shadow-md shadow-emerald-500/20 transition-all leading-none border border-emerald-500/30">
                <div className="flex items-center gap-1.5 mb-1">
                    <FaWhatsapp size={14} /> WhatsApp Call
                </div>
                <span className="text-[9px] font-mono text-emerald-100 bg-black/20 px-1.5 py-0.5 rounded">
                    {lead.waCallPermissionExpiry ? `Ends: ${Math.max(0, Math.ceil((new Date(lead.waCallPermissionExpiry) - new Date()) / (1000 * 60 * 60 * 24)))} Days` : 'Always Allowed'}
                </span>
            </button>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button 
          onClick={() => onOpenChat && onOpenChat(lead)}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700/80 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
        >
          <MessageCircle size={14} className="group-hover:scale-110 transition-transform" /> Chat
        </button>

        <button 
          onClick={() => onOpenReminder && onOpenReminder(lead)}
          title="Set a Reminder"
          className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3.5 rounded-xl flex items-center justify-center transition-colors shadow-sm group"
        >
          <Bell size={14} className="group-hover:scale-110 transition-transform" />
        </button>
        
        {!isReadOnly && (
          <button 
            onClick={handleSave}
            disabled={isFrozen}
            className={`flex-1 rounded-xl py-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md ${
              isFrozen 
                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed' 
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/20'
            }`}
          >
            <Check size={14} /> SAVE
          </button>
        )}
      </div>

      <OutboundDialerModal 
        isOpen={showDialerModal} 
        onClose={() => setShowDialerModal(false)} 
        selectedLead={lead}
        businessId={lead.batch?.businessId}
        campaignType={lead.campaignType || "FREE_SEMINAR"} 
      />
    </div>
  );
}

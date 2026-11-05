import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../api/axios';
import { PhoneCall, Loader, PieChart, Target, Calendar, PhoneForwarded, Megaphone, Activity, Repeat, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LeadCallCard from '../CallCenter/LeadCallCard';
import ChatArea from './ChatArea';
import RightSidePanel from './RightSidePanel';
import ContactSidebar from './ContactSidebar';
import { FaTimes, FaBell, FaSave, FaTrash, FaCheckCircle } from 'react-icons/fa';

export default function StaffCampaignExecution({ filters, redirectLead }) {
  const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;
  const rawRole = JSON.parse(localStorage.getItem('user'))?.role || '';
  
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activePhase, setActivePhase] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [chatModalLead, setChatModalLead] = useState(null);

  // Reminder Logic
  const [showReminder, setShowReminder] = useState(false);
  const [reminderLead, setReminderLead] = useState(null);
  const [existingReminderId, setExistingReminderId] = useState(null);
  const [remindDate, setRemindDate] = useState('');
  const [remindTime, setRemindTime] = useState('');
  const [remindNote, setRemindNote] = useState('');
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);

  useEffect(() => {
    fetchAssignedLeads();
  }, [filters?.selectedBusiness, filters?.selectedBatch]);

  useEffect(() => {
    if (redirectLead) {
      setSearchQuery(redirectLead.phone);
      setActivePhase(redirectLead.phase || 1);
      setCurrentPage(1);
      setStatusFilter('ALL');
    }
  }, [redirectLead]);

  const fetchAssignedLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(rawRole.toUpperCase().replace(/ /g, '_'));

      const res = await axios.get('/coordinator-crm/leads', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          tab: 'ASSIGNED',
          staffId: currentUserId,
          loggedUserRole: rawRole,
          businessId: filters?.selectedBusiness || '',
          batchId: filters?.selectedBatch || '',
          limit: 5000
        }
      });
      
      const sortedLeads = (res.data.leads || []).sort((a, b) => a.id - b.id);
      setLeads(sortedLeads);
    } catch (error) {
      toast.error("Failed to load campaign leads");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLead = async (leadId, roundNum, data) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/coordinator-crm/leads/update-call', {
        leadId, 
        method: data.callMethod || 'Direct Call', 
        status: data.callOutcome === 'PENDING' ? 'pending' : data.callOutcome.toLowerCase(), 
        feedback: data.feedback,
        coordinationRound: data.attempts || 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Saved successfully!");
      
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          let newPhase = l.phase;
          const statusLower = data.callOutcome.toLowerCase();
          if (statusLower === 'no_answer') {
            if (l.phase === 1) newPhase = 2;
            else if (l.phase === 2) newPhase = 3;
          }
          
          let finalCallStatus = statusLower;
          if (newPhase !== l.phase) {
            finalCallStatus = 'pending';
          }

          return { 
            ...l, 
            callStatus: finalCallStatus, 
            feedback: data.feedback, 
            phase: newPhase,
            callMethod: data.callMethod,
            callAttempt: data.attempts
          };
        }
        return l;
      }));
    } catch (error) {
      toast.error("Failed to save data.");
    }
  };

  const handleOpenChat = (lead) => {
    setChatModalLead(lead);
  };

  const handleOpenReminderModal = async (lead) => {
      setReminderLead(lead);
      const now = new Date();
      setRemindDate(now.toISOString().split('T')[0]);
      setRemindTime('');
      setRemindNote('');
      setExistingReminderId(null);
      
      try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`/reminders/my-reminders?agentId=${currentUserId}&status=active`, { headers: { Authorization: `Bearer ${token}` } });
          const existing = res.data.find(r => r.leadId === lead.id);
          if (existing) {
              const d = new Date(existing.remindAt);
              setRemindDate(d.toISOString().split('T')[0]);
              setRemindTime(d.toTimeString().slice(0, 5));
              setRemindNote(existing.note || '');
              setExistingReminderId(existing.id);
          }
      } catch (e) {
          console.error("Failed to check existing reminder", e);
      }
      setShowReminder(true);
  };

  const handleSetReminder = async () => {
      if (!remindDate || !remindTime || !remindNote) return toast.error("Date, Time and Note are required");
      setIsSubmittingReminder(true);
      const loadToast = toast.loading(existingReminderId ? "Updating reminder..." : "Setting reminder...");
      try {
          const token = localStorage.getItem('token');
          const formattedDate = new Date(`${remindDate}T${remindTime}:00`).toISOString();
          
          if (existingReminderId) {
              await axios.put('/reminders/edit', { reminderId: existingReminderId, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
              toast.success("Reminder updated successfully!", { id: loadToast });
          } else {
              await axios.post('/reminders/create', { leadId: reminderLead.id, agentId: currentUserId, leadType: 'FREE_SEMINAR', phone: reminderLead.phone, name: reminderLead.name, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
              toast.success("Reminder set successfully!", { id: loadToast });
          }
          setShowReminder(false);
      } catch (e) { toast.error("Failed to set reminder", { id: loadToast }); }
      finally { setIsSubmittingReminder(false); }
  };

  const handleDeleteReminder = async () => {
      if (!window.confirm("Delete this reminder?")) return;
      setIsSubmittingReminder(true);
      const loadToast = toast.loading("Deleting reminder...");
      try {
          await axios.delete(`/reminders/delete/${existingReminderId}`);
          toast.success("Reminder deleted!", { id: loadToast });
          setShowReminder(false);
      } catch (e) { toast.error("Failed to delete", { id: loadToast }); }
      finally { setIsSubmittingReminder(false); }
  };

    // Calculate phase-specific leads
    let phaseLeads = leads.filter(l => l?.phase === activePhase);

    if (statusFilter !== 'ALL') {
      phaseLeads = phaseLeads.filter(l => (l.callStatus || 'pending').toUpperCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      phaseLeads = phaseLeads.filter(l => 
        l.phone?.toLowerCase().includes(q) || 
        l.name?.toLowerCase().includes(q)
      );
    }
    // Sort logic: Pending ones first, then others. Within group, newest updated first.
    phaseLeads.sort((a, b) => {
      const statusA = (a.callStatus || 'PENDING').toUpperCase();
      const statusB = (b.callStatus || 'PENDING').toUpperCase();
      
      const isPendingA = statusA === 'PENDING';
      const isPendingB = statusB === 'PENDING';
      
      if (isPendingA && !isPendingB) return -1;
      if (!isPendingA && isPendingB) return 1;
      
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    const paginatedLeads = phaseLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(phaseLeads.length / ITEMS_PER_PAGE);

    // Stats calculated dynamically for the activePhase!
    const totalAssigned = phaseLeads.length;
    const pending = phaseLeads.filter(l => (l.callStatus || 'PENDING').toUpperCase() === 'PENDING').length;
    const noAnswer = phaseLeads.filter(l => (l.callStatus || '').toUpperCase() === 'NO_ANSWER').length;
    const covered = totalAssigned - pending; // In a given phase, if it's not pending, it's covered!
    const responseRate = totalAssigned > 0 
      ? ((phaseLeads.filter(l => ['ANSWERED', 'REJECT'].includes(l.callStatus?.toUpperCase())).length / totalAssigned) * 100).toFixed(1)
      : 0;

  return (
    <div className="fade-in w-full h-full pb-10 custom-scrollbar overflow-y-auto">
      {/* Top Bar matching CallCenter detail view */}
      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          <div className="flex flex-col md:flex-row gap-6 items-center flex-1">
            <div className="flex gap-6 items-center bg-[#0F172A]/50 p-4 px-8 rounded-3xl border border-white/5 shadow-inner">
              <div className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs mr-4">Campaign Stats</div>
              <div className="flex flex-col items-center"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Assigned</span><span className="text-2xl font-black text-white">{totalAssigned}</span></div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-center"><span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mb-1">Pending</span><span className="text-2xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{pending}</span></div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-center"><span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">No Answer</span><span className="text-2xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{noAnswer}</span></div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-center"><span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Covered</span><span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{covered}</span></div>
              <div className="w-px h-10 bg-white/10 mx-2"></div>
              <div className="flex flex-col items-center"><span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Response</span><span className="text-2xl font-black text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">{responseRate}%</span></div>
            </div>
          </div>

          <div className="hidden lg:block text-right">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Campaign Mode</span>
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-black text-sm inline-block shadow-[0_0_15px_rgba(16,185,129,0.2)]">FREE SEMINAR</span>
          </div>

        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition-all shadow-inner"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all shadow-inner cursor-pointer min-w-[200px]"
        >
          <option value="ALL" className="bg-slate-900 text-white">All Statuses</option>
          <option value="PENDING" className="bg-slate-900 text-white">Pending</option>
          <option value="ANSWERED" className="bg-slate-900 text-emerald-400">Answered</option>
          <option value="NO_ANSWER" className="bg-slate-900 text-rose-400">No Answer</option>
          <option value="REJECT" className="bg-slate-900 text-red-500">Reject</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar for Phases */}
        <div className="w-24 shrink-0 flex flex-col gap-3">
          {[1, 2, 3].map(ph => {
            const phCount = leads.filter(l => l.phase === ph).length;
            return (
              <button
                key={ph}
                onClick={() => { setActivePhase(ph); setCurrentPage(1); }}
                className={`flex flex-col items-center justify-center py-4 rounded-2xl transition-all relative overflow-hidden ${
                  activePhase === ph 
                    ? 'bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' 
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Phase</span>
                <span className="text-2xl font-black">0{ph}</span>
                {phCount > 0 && (
                  <span className="mt-2 bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-bold">{phCount} leads</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Leads Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="animate-spin text-emerald-500 text-4xl" />
            </div>
          ) : paginatedLeads.length === 0 ? (
            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl shadow-xl">
              <PhoneCall className="text-slate-600 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-bold text-slate-400">No Leads Found</h3>
              <p className="text-slate-500 mt-2">There are no leads in Phase {activePhase} for your current filters.</p>
            </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedLeads.map((lead, index) => (
                    <LeadCallCard 
                      key={lead.id} 
                      lead={{
                        ...lead,
                        businessId: lead.businessId || lead.batch?.businessId || filters?.selectedBusiness,
                        batch: lead.batch ? {
                          ...lead.batch,
                          businessId: lead.batch?.businessId || lead.businessId || filters?.selectedBusiness
                        } : { businessId: filters?.selectedBusiness }
                      }} 
                      activeRound={activePhase}
                      index={(currentPage - 1) * ITEMS_PER_PAGE + index} 
                      onSave={handleSaveLead}
                      onOpenChat={handleOpenChat}
                      onOpenReminder={handleOpenReminderModal}
                    />
                ))}
              </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all shadow-md"
              >
                Previous
              </button>
              <span className="text-slate-400 font-bold text-sm bg-[#0F172A] px-4 py-2 rounded-xl border border-white/5 shadow-inner">Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all shadow-md"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* POPUP CHAT MODAL */}
      {chatModalLead && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
          <div className="w-[98vw] max-w-[1600px] h-[95vh] md:h-[92vh] bg-[#0f172a] rounded-3xl flex flex-col border border-slate-700 shadow-2xl overflow-hidden relative">
            
            <div className="bg-gradient-to-r from-[#1e293b] to-[#0f172a] p-4 flex justify-between items-center border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
                <h3 className="text-white font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                  Live CRM Chat <span className="text-blue-400 border-l border-slate-600 pl-2 ml-1">{chatModalLead.phone}</span>
                </h3>
              </div>
              <button onClick={() => {
                setChatModalLead(null);
                fetchAssignedLeads(); 
              }} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest border border-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <FaTimes /> Close Workspace
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
              <div className="hidden md:flex shrink-0 border-r border-slate-800 h-full overflow-hidden">
                <ContactSidebar 
                  activeMode="CALL_CAMPAIGN" 
                  selectedLead={chatModalLead} 
                  setSelectedLead={setChatModalLead}
                  filters={filters}
                />
              </div>
              <ChatArea selectedLead={chatModalLead} />
              <div className="hidden lg:block h-full shrink-0 border-l border-slate-800">
                <RightSidePanel 
                    selectedLead={chatModalLead} 
                    activeMode="CALL_CAMPAIGN" 
                    selectedBusiness={filters?.selectedBusiness}
                    onBatchAssigned={(leadId, batchId) => {
                        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, batchId } : l));
                        if (chatModalLead && chatModalLead.id === leadId) {
                            setChatModalLead(prev => ({ ...prev, batchId }));
                        }
                    }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Popup */}
      {showReminder && reminderLead && createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-fade-in-up">
                  <div className="bg-[#0f172a] p-4 flex justify-between items-center border-b border-slate-700">
                      <h3 className="text-white font-bold flex items-center gap-2 text-lg"><FaBell className="text-amber-500"/> {existingReminderId ? 'Update Reminder' : 'Set Reminder'}</h3>
                      <button onClick={() => setShowReminder(false)} className="text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"><FaTimes size={14}/></button>
                  </div>
                  <div className="p-5 space-y-4">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Student / Lead</p>
                          <p className="text-white font-black">{reminderLead.phone}</p>
                          <p className="text-slate-500 text-sm">{reminderLead.name || 'Unknown'}</p>
                      </div>
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Date</label>
                              <input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition-colors" />
                          </div>
                          <div className="flex-1">
                              <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Time</label>
                              <input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition-colors" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Note to yourself</label>
                          <textarea value={remindNote} onChange={(e) => setRemindNote(e.target.value)} placeholder="e.g. Call back about installment plan..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 transition-colors h-24 resize-none" />
                      </div>
                      {existingReminderId ? (
                          <div className="flex gap-2 pt-2">
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

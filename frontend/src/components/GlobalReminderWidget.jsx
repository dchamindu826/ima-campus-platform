import React, { useState, useEffect } from 'react';
import { FaBell, FaTimes, FaCheckCircle, FaTrash, FaEdit, FaSave, FaHistory, FaPhone, FaWhatsapp, FaExternalLinkAlt, FaSyncAlt } from 'react-icons/fa';
import axios from '../api/axios'; 
import toast from 'react-hot-toast';
import { useCall } from '../contexts/CallContext';
import { useNavigate } from 'react-router-dom';

export default function GlobalReminderWidget({ asModal, onClose }) {
    const { startOutboundCall } = useCall();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(asModal ? true : false);
    const [mainTab, setMainTab] = useState('REMINDERS'); // 'REMINDERS' or 'CALL_ALLOWED'
    const [reminderSubTab, setReminderSubTab] = useState('ACTIVE'); // 'ACTIVE' or 'COMPLETED'
    
    const [reminders, setReminders] = useState([]);
    const [completedReminders, setCompletedReminders] = useState([]);
    const [callAllowedLeads, setCallAllowedLeads] = useState([]);
    const [callPermsCount, setCallPermsCount] = useState(0);

    const [editingId, setEditingId] = useState(null);
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [editNote, setEditNote] = useState('');

    const [isCreatingPersonal, setIsCreatingPersonal] = useState(false);
    const [newPersonalDate, setNewPersonalDate] = useState('');
    const [newPersonalTime, setNewPersonalTime] = useState('');
    const [newPersonalNote, setNewPersonalNote] = useState('');
    const [newPersonalRepeat, setNewPersonalRepeat] = useState(false);

    const audioRef = React.useRef(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
    const agentId = loggedUser?.id || loggedUser?.userId;
    const roleUpper = (loggedUser?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const deptUpper = (loggedUser?.department || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const isStudent = roleUpper === 'STUDENT' || roleUpper === 'USER';
    const isExcludedDept = ['DELIVERY', 'FINANCE', 'PHYSICAL', 'SOCIAL_MEDIA', 'TECHNICAL'].includes(deptUpper);
    const isSuperOrAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(roleUpper);
    const isCoordinator = ['COORDINATOR', 'CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(roleUpper) || ['CLASS_COORDINATION', 'CALL_CENTER'].includes(deptUpper);
    const isAllowedManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(roleUpper) && !isExcludedDept;
    const isCrmEligible = (isSuperOrAdmin || isCoordinator || isAllowedManager) && !isExcludedDept && !isStudent;

    useEffect(() => {
        if (!agentId || !isCrmEligible) return;
        fetchReminders();
        fetchCallAllowed();
        const interval = setInterval(() => {
            fetchReminders();
            fetchCallAllowed();
        }, 60000); 
        return () => clearInterval(interval);
    }, [agentId, isCrmEligible]);

    const notifiedReminders = React.useRef(new Set());

    useEffect(() => {
        if (!reminders.length || !isCrmEligible) return;
        const now = new Date().getTime();
        const dueReminders = reminders.filter(r => new Date(r.remindAt).getTime() <= now && !r.isCompleted);
        
        const newDueReminders = dueReminders.filter(r => !notifiedReminders.current.has(r.id));

        if (newDueReminders.length > 0) {
            newDueReminders.forEach(r => notifiedReminders.current.add(r.id));
            
            toast(`⏰ You have ${newDueReminders.length} new due call reminder${newDueReminders.length > 1 ? 's' : ''}`, {
                id: 'reminders_due_summary_' + Date.now(),
                duration: 4500,
                icon: '🔔'
            });
            
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error("Audio play error", e));
                setIsPlayingAudio(true);
            }
        } else if (dueReminders.length === 0) {
            notifiedReminders.current.clear();
            if (audioRef.current && isPlayingAudio) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                setIsPlayingAudio(false);
            }
        }
    }, [reminders, isCrmEligible]);

    const fetchReminders = async () => {
        try {
            const [activeRes, completedRes] = await Promise.allSettled([
                axios.get(`/reminders/my-reminders?agentId=${agentId}&status=active`),
                axios.get(`/reminders/my-reminders?agentId=${agentId}&status=completed`)
            ]);

            if (activeRes.status === 'fulfilled' && Array.isArray(activeRes.value.data)) {
                setReminders(activeRes.value.data.map(r => ({ ...r, notifiedLocally: false })));
            }
            if (completedRes.status === 'fulfilled' && Array.isArray(completedRes.value.data)) {
                setCompletedReminders(completedRes.value.data);
            }
        } catch (error) { 
            console.error("Failed to fetch reminders", error); 
        }
    };

    const fetchCallAllowed = async () => {
        try {
            const res = await axios.get('/after-seminar-crm/leads/call-permissions?status=ACTIVE');
            if (res.data?.leads) {
                setCallAllowedLeads(res.data.leads);
                setCallPermsCount(res.data.counts?.active || res.data.leads.length);
            }
        } catch (error) {
            console.error("Failed to fetch call permissions:", error);
        }
    };

    const handleClear = async (id) => {
        try {
            await axios.post('/reminders/mark-done', { reminderId: id });
            fetchReminders();
            toast.success("Reminder Marked as Done!");
        } catch (error) { toast.error("Failed to clear"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this reminder?")) return;
        try {
            await axios.delete(`/reminders/delete/${id}`);
            fetchReminders();
            toast.success("Reminder Deleted!");
        } catch (error) { toast.error("Failed to delete"); }
    };

    const startEdit = (r) => {
        setEditingId(r.id);
        const d = new Date(r.remindAt);
        setEditDate(d.toISOString().split('T')[0]);
        setEditTime(d.toTimeString().slice(0, 5));
        setEditNote(r.note || '');
    };

    const saveEdit = async (id) => {
        try {
            const formattedDate = new Date(`${editDate}T${editTime}:00`).toISOString();
            await axios.put('/reminders/edit', { reminderId: id, remindAt: formattedDate, note: editNote });
            notifiedReminders.current.delete(id); // Allow it to trigger again after editing
            toast.success("Reminder Updated!");
            setEditingId(null);
            fetchReminders();
        } catch (error) { toast.error("Failed to update"); }
    };

    const handleRedirect = (type, phone) => {
        let path = '/workspace/campaign/new-inquiries';
        if (type === 'OPEN_SEMINAR') path = '/workspace/campaign/open-seminar';
        else if (type === 'NORMAL') path = '/workspace/campaign/open-seminar';

        localStorage.setItem('global_search_query', phone);
        window.location.href = `${path}?search=${phone}`;
        handleClose();
    };

    const handleCallStudent = (lead) => {
        if (!startOutboundCall) {
            toast.error("Call engine not ready");
            return;
        }
        const bizId = lead.batch?.businessId || lead.batch?.business?.id;
        startOutboundCall({
            lead: {
                id: lead.id,
                name: lead.name,
                phone: lead.phone
            },
            businessId: bizId,
            campaignType: lead.campaignType || 'AFTER_SEMINAR'
        });
    };

    const handleOpenChat = (lead) => {
        const cleanPhone = lead.phone ? lead.phone.split('_')[0].replace(/[^0-9]/g, '') : '';
        let path = lead.campaignType === 'FREE_SEMINAR' ? '/workspace/crm' : '/workspace/after-seminar-crm';
        handleClose();
        navigate(`${path}?search=${cleanPhone}`);
    };

    const handleClose = () => {
        if (asModal && onClose) onClose();
        else setIsOpen(false);
    };

    const handleCreatePersonal = async () => {
        try {
            if (!newPersonalTime || !newPersonalNote) return toast.error("Time and Note are required");
            if (!newPersonalRepeat && !newPersonalDate) return toast.error("Date is required for one-time reminders");
            
            let dateToUse = newPersonalDate;
            if (newPersonalRepeat) {
                const now = new Date();
                const [h, m] = newPersonalTime.split(':');
                const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
                if (target < now) {
                    target.setDate(target.getDate() + 1);
                }
                dateToUse = target.toISOString().split('T')[0];
            }

            const formattedDate = new Date(`${dateToUse}T${newPersonalTime}:00`).toISOString();
            
            await axios.post('/reminders/create', {
                agentId,
                note: newPersonalNote,
                remindAt: formattedDate,
                isPersonal: true,
                isRepeat: newPersonalRepeat,
                repeatTime: newPersonalRepeat ? newPersonalTime : null,
                phone: 'PERSONAL',
                name: 'My Reminder'
            });
            toast.success("Personal Reminder Created!");
            setIsCreatingPersonal(false);
            setNewPersonalNote('');
            setNewPersonalTime('');
            setNewPersonalDate('');
            setNewPersonalRepeat(false);
            fetchReminders();
        } catch (error) { toast.error("Failed to create reminder"); }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingAudio(false);
        }
    };

    if (!agentId || !isCrmEligible) return null;

    return (
        <div className={asModal ? "" : "fixed bottom-6 right-6 z-[9999]"}>
            {!asModal && (
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-amber-500 hover:bg-amber-400 text-white w-14 h-14 rounded-full flex justify-center items-center shadow-lg shadow-amber-500/30 transition-transform hover:scale-110 relative border-2 border-white/20"
                >
                    <FaBell size={24} className={reminders.some(r => new Date(r.remindAt) <= new Date()) ? 'animate-bounce' : ''} />
                    {(reminders.length > 0 || callPermsCount > 0) && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex justify-center items-center rounded-full border-2 border-[#0f172a]">
                            {reminders.length + callPermsCount}
                        </span>
                    )}
                </button>
            )}

            {isOpen && (
                <div className={asModal ? "fixed bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl animate-fade-in-up flex flex-col max-h-[550px] h-[520px] z-[9999] overflow-hidden" : "absolute bottom-16 right-0 w-96 max-w-[calc(100vw-2rem)] bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl animate-fade-in-up flex flex-col max-h-[550px] h-[520px] z-[9999] overflow-hidden"}>
                    <audio ref={audioRef} src="/reminder_ringtone.mp3" onEnded={() => setIsPlayingAudio(false)} />
                    {/* Header */}
                    <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 rounded-t-2xl flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <FaBell className="text-amber-400" size={16}/>
                            <h3 className="text-white font-bold text-sm">Reminders & Call Permissions</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {isPlayingAudio && (
                                <button onClick={stopAudio} className="text-rose-400 font-bold text-xs border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded shadow animate-pulse">Stop Alarm</button>
                            )}
                            <button onClick={() => { fetchReminders(); fetchCallAllowed(); }} className="text-slate-400 hover:text-white p-1" title="Refresh">
                                <FaSyncAlt size={12}/>
                            </button>
                            <button onClick={handleClose} className="text-slate-400 hover:text-white p-1" title="Close"><FaTimes size={14}/></button>
                        </div>
                    </div>

                    {/* Main Tabs (Reminders vs Call Allowed) */}
                    <div className="flex bg-black/40 border-b border-slate-800 p-1 text-xs font-bold shrink-0">
                        <button 
                            onClick={() => setMainTab('REMINDERS')} 
                            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mainTab === 'REMINDERS' ? 'bg-amber-500 text-black font-black shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <FaBell size={11} /> Reminders ({reminders.length})
                        </button>
                        <button 
                            onClick={() => setMainTab('CALL_ALLOWED')} 
                            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${mainTab === 'CALL_ALLOWED' ? 'bg-emerald-600 text-white font-black shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <FaWhatsapp size={12} className="text-emerald-400" /> Call Allowed ({callPermsCount})
                        </button>
                    </div>

                    {/* Reminders Tab Content */}
                    {mainTab === 'REMINDERS' && (
                        <>
                            {/* Sub-tab: Upcoming vs History */}
                            <div className="flex justify-between items-center px-3 py-1.5 bg-slate-900/60 border-b border-white/5 text-[11px] font-semibold shrink-0">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setReminderSubTab('ACTIVE')} 
                                        className={`px-2 py-0.5 rounded transition-colors ${reminderSubTab === 'ACTIVE' ? 'text-amber-400 font-bold underline' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Upcoming ({reminders.length})
                                    </button>
                                    <button 
                                        onClick={() => setReminderSubTab('COMPLETED')} 
                                        className={`px-2 py-0.5 rounded transition-colors ${reminderSubTab === 'COMPLETED' ? 'text-emerald-400 font-bold underline' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Completed / Past ({completedReminders.length})
                                    </button>
                                </div>
                                <button onClick={() => setIsCreatingPersonal(true)} className="bg-amber-500 hover:bg-amber-400 text-black px-2 py-1 rounded font-bold transition-colors">+ Personal</button>
                            </div>

                            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
                                {isCreatingPersonal && (
                                    <div className="p-3 rounded-xl border bg-black/40 border-amber-500/30 space-y-3 mb-2 animate-fade-in-up">
                                        <h4 className="text-white text-xs font-bold border-b border-white/10 pb-1 flex justify-between">
                                            <span>Create Personal Reminder</span>
                                            <button onClick={() => setIsCreatingPersonal(false)} className="text-slate-500 hover:text-white"><FaTimes size={10}/></button>
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] text-slate-300 flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={newPersonalRepeat} onChange={(e) => setNewPersonalRepeat(e.target.checked)} className="accent-amber-500"/>
                                                Repeat Daily
                                            </label>
                                        </div>
                                        <div className="flex gap-2">
                                            {!newPersonalRepeat && (
                                                <input type="date" value={newPersonalDate} onChange={e=>setNewPersonalDate(e.target.value)} className="flex-1 bg-slate-800/80 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500" />
                                            )}
                                            <input type="time" value={newPersonalTime} onChange={e=>setNewPersonalTime(e.target.value)} className="w-24 bg-slate-800/80 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500" />
                                        </div>
                                        <textarea value={newPersonalNote} onChange={e=>setNewPersonalNote(e.target.value)} placeholder="What needs to be done?" className="w-full bg-slate-800/80 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500 resize-none h-16"></textarea>
                                        <button onClick={handleCreatePersonal} className="w-full bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black py-2 rounded flex justify-center items-center shadow-lg transition-colors">
                                            Save Reminder
                                        </button>
                                    </div>
                                )}
                                {reminderSubTab === 'ACTIVE' ? (
                                    reminders.length === 0 ? (
                                        <p className="text-center text-slate-500 text-xs py-10 font-medium">No upcoming reminders scheduled.</p>
                                    ) : (
                                        reminders.map(r => {
                                            const isPastDue = new Date(r.remindAt) <= new Date();
                                            const isEditing = editingId === r.id;

                                            return (
                                                <div key={r.id} className={`p-3 rounded-xl border ${isPastDue ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
                                                    {!isEditing ? (
                                                        <>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div 
                                                                    className={`cursor-pointer group ${r.isPersonal ? '' : 'hover:underline'}`}
                                                                    onClick={() => {
                                                                        if(!r.isPersonal) handleRedirect(r.leadType, r.phone);
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className={`font-black text-sm ${isPastDue ? 'text-rose-400' : 'text-white'}`}>{r.phone === 'PERSONAL' ? 'Personal Note' : r.phone}</p>
                                                                        {r.isRepeat && <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded border border-amber-500/30 uppercase font-black">Daily</span>}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{r.name || 'Personal'}</p>
                                                                </div>
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex shrink-0 h-fit ${isPastDue ? 'bg-rose-500 text-white' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                    {new Date(r.remindAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </span>
                                                            </div>
                                                            {r.note && <p className="text-xs text-slate-300 italic mb-3 bg-black/20 p-2 rounded-lg">{r.note}</p>}
                                                            
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <button onClick={() => handleClear(r.id)} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1"><FaCheckCircle/> Done</button>
                                                                <button onClick={() => startEdit(r)} className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-colors"><FaEdit size={12}/></button>
                                                                <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-colors"><FaTrash size={12}/></button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="flex gap-2">
                                                                {!r.isRepeat && <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} className="flex-1 bg-black/40 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500" />}
                                                                <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} className="w-20 bg-black/40 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500" />
                                                            </div>
                                                            <textarea value={editNote} onChange={e=>setEditNote(e.target.value)} className="w-full bg-black/40 border border-slate-700 text-xs text-white p-1.5 rounded outline-none focus:border-amber-500 resize-none h-12"></textarea>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => saveEdit(r.id)} className="flex-1 bg-amber-500 text-white text-[10px] font-bold py-1.5 rounded flex justify-center items-center gap-1"><FaSave/> Save</button>
                                                                <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-700 text-white text-[10px] font-bold py-1.5 rounded">Cancel</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )
                                ) : (
                                    completedReminders.length === 0 ? (
                                        <p className="text-center text-slate-500 text-xs py-10 font-medium">No completed reminders found.</p>
                                    ) : (
                                        completedReminders.map(r => (
                                            <div key={r.id} className="p-3 rounded-xl border bg-black/20 border-white/5 opacity-80 hover:opacity-100 transition-opacity">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-300 line-through">{r.phone}</p>
                                                        <p className="text-[10px] text-slate-500">{r.name || 'Student'}</p>
                                                    </div>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold">
                                                        Completed
                                                    </span>
                                                </div>
                                                {r.note && <p className="text-xs text-slate-400 italic mb-2">{r.note}</p>}
                                                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-white/5 pt-1.5">
                                                    <span>{new Date(r.remindAt).toLocaleDateString()} {new Date(r.remindAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <button onClick={() => handleDelete(r.id)} className="text-rose-400 hover:text-rose-300 p-1" title="Delete record"><FaTrash size={10}/></button>
                                                </div>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </>
                    )}

                    {/* Call Allowed Tab Content */}
                    {mainTab === 'CALL_ALLOWED' && (
                        <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
                            {callAllowedLeads.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-xs">
                                    <FaWhatsapp size={24} className="mx-auto mb-2 opacity-30 text-emerald-400" />
                                    <p className="font-bold text-white">No Call Allowed Leads</p>
                                    <p className="text-[11px] text-slate-400 mt-1">Students who permit calls on WhatsApp will show up here.</p>
                                </div>
                            ) : (
                                callAllowedLeads.map(lead => {
                                    const cleanPhone = lead.phone ? lead.phone.split('_')[0] : '';
                                    const bizName = lead.batch?.business?.name || lead.batch?.name;
                                    
                                    return (
                                        <div key={lead.id} className="p-3 rounded-xl border bg-slate-900/80 border-white/10 hover:border-emerald-500/40 transition-all shadow-sm">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-white font-black text-sm">{cleanPhone}</span>
                                                        {bizName && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black uppercase">{bizName}</span>}
                                                    </div>
                                                    <p className="text-slate-300 text-xs font-semibold">{lead.name || 'Student'}</p>
                                                </div>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    {lead.waCallPermissionExpiry ? 'Temporary' : 'Always Allowed'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                                                <span className="text-[10px] text-slate-400">
                                                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleCallStudent(lead)}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-all shadow-sm shadow-emerald-900/30"
                                                    >
                                                        <FaPhone size={8} /> Call
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenChat(lead)}
                                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border border-white/10"
                                                    >
                                                        <FaExternalLinkAlt size={8} /> Open
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
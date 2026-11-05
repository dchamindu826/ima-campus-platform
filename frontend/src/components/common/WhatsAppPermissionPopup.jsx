import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaWhatsapp, FaTimes, FaCheckCircle, FaPhone, FaListUl, FaChevronLeft, FaChevronRight, FaMinus, FaExternalLinkAlt } from 'react-icons/fa';
import { useCall } from '../../contexts/CallContext';
import api from '../../api/axios';
import CallPermissionsWidget from './CallPermissionsWidget';

export default function WhatsAppPermissionPopup() {
    const { socket, startOutboundCall } = useCall();
    const user = JSON.parse(localStorage.getItem('user') || '{}') || {};
    const roleUpper = (user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const deptUpper = (user?.department || '').toUpperCase().replace(/[\s_-]+/g, '_');

    const isExcludedDept = ['DELIVERY', 'FINANCE', 'PHYSICAL', 'SOCIAL_MEDIA', 'TECHNICAL'].includes(deptUpper);
    const isStudent = roleUpper === 'STUDENT' || roleUpper === 'USER';
    const isSuperOrAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(roleUpper);
    const isCoordinator = ['COORDINATOR', 'CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(roleUpper) || ['CLASS_COORDINATION', 'CALL_CENTER'].includes(deptUpper);
    const isAllowedManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(roleUpper) && !isExcludedDept;

    const isEligible = (isSuperOrAdmin || isCoordinator || isAllowedManager) && !isExcludedDept && !isStudent;
    const isManagerOrAdmin = isSuperOrAdmin || (isAllowedManager && !isExcludedDept);

    const [popups, setPopups] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showWidgetModal, setShowWidgetModal] = useState(false);
    const navigate = useNavigate();

    // Play audio notification chime
    const playChime = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Failed to play chime audio:", e);
        }
    };

    // Fetch existing unnotified permissions on mount
    useEffect(() => {
        if (!isEligible) return;

        const fetchUnnotified = async () => {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            if (!token) return;

            try {
                const res = await api.get('/after-seminar-crm/leads/unnotified-permissions');
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    setPopups(res.data);
                    playChime();
                }
            } catch (error) {
                console.error("Failed to fetch unnotified permissions:", error);
            }
        };
        fetchUnnotified();
    }, [isEligible]);

    // Listen to real-time socket events
    useEffect(() => {
        if (!socket || !isEligible) return;
        
        const handlePermissionGranted = (data) => {
            if (!isManagerOrAdmin && data.assignedTo && String(data.assignedTo) !== String(user?.id)) {
                return;
            }
            playChime();
            setPopups(prev => {
                const targetId = data.leadId || data.id;
                if (prev.find(p => p.id === targetId)) return prev;
                return [{ ...data, id: targetId }, ...prev];
            });
            setIsMinimized(false);
            setCurrentIndex(0);
        };

        socket.on('wa_call_permission_granted', handlePermissionGranted);
        return () => {
            socket.off('wa_call_permission_granted', handlePermissionGranted);
        };
    }, [socket, user?.id, isManagerOrAdmin, isEligible]);

    const handleDismiss = async (id, e) => {
        if (e) e.stopPropagation();
        setPopups(prev => {
            const updated = prev.filter(p => p.id !== id);
            if (currentIndex >= updated.length && updated.length > 0) {
                setCurrentIndex(updated.length - 1);
            }
            return updated;
        });
        try {
            await api.post('/after-seminar-crm/leads/mark-permission-notified', { leadId: id });
        } catch (error) {
            console.error("Failed to dismiss permission:", error);
        }
    };

    const handleDismissAll = async (e) => {
        if (e) e.stopPropagation();
        const idsToDismiss = popups.map(p => p.id);
        setPopups([]);
        setCurrentIndex(0);
        try {
            await Promise.all(idsToDismiss.map(id => 
                api.post('/after-seminar-crm/leads/mark-permission-notified', { leadId: id }).catch(() => {})
            ));
        } catch (error) {
            console.error("Failed to dismiss all:", error);
        }
    };

    const handleCallDirectly = (lead, e) => {
        if (e) e.stopPropagation();
        handleDismiss(lead.id);

        if (!startOutboundCall) {
            handleClick(lead);
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

    const handleClick = async (lead) => {
        try {
            await api.post('/after-seminar-crm/leads/mark-permission-notified', { leadId: lead.id });
        } catch (error) {
            console.error("Failed to mark as notified:", error);
        }
        
        setPopups(prev => {
            const updated = prev.filter(p => p.id !== lead.id);
            if (currentIndex >= updated.length && updated.length > 0) {
                setCurrentIndex(updated.length - 1);
            }
            return updated;
        });

        const cleanPhone = lead.phone ? lead.phone.split('_')[0].replace(/[^0-9]/g, '') : '';

        if (lead.campaignType === 'FREE_SEMINAR') {
            navigate(`/workspace/crm?search=${cleanPhone}`);
        } else {
            navigate(`/workspace/after-seminar-crm?search=${cleanPhone}`);
        }
    };

    if (!isEligible) return null;

    if (popups.length === 0) {
        return (
            <>
                {showWidgetModal && (
                    <CallPermissionsWidget asModal={true} onClose={() => setShowWidgetModal(false)} />
                )}
            </>
        );
    }

    const currentLead = popups[Math.min(currentIndex, popups.length - 1)] || popups[0];

    return (
        <>
            {showWidgetModal && (
                <CallPermissionsWidget asModal={true} onClose={() => setShowWidgetModal(false)} />
            )}

            <div className="fixed bottom-5 right-24 z-[9999] pointer-events-auto select-none">
                {isMinimized ? (
                    /* Minimized Pill View */
                    <div 
                        onClick={() => setIsMinimized(false)}
                        className="bg-slate-900/95 hover:bg-slate-800 border border-emerald-500/60 rounded-full px-4 py-2.5 shadow-[0_0_25px_rgba(16,185,129,0.4)] cursor-pointer flex items-center gap-3 transition-all hover:scale-105"
                        title="Click to view Call Allowed reminders"
                    >
                        <div className="relative">
                            <FaWhatsapp size={18} className="text-emerald-400 animate-pulse" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        </div>
                        <span className="text-emerald-300 font-black text-xs uppercase tracking-wider">
                            Call Allowed ({popups.length})
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowWidgetModal(true); }}
                            className="bg-emerald-600/40 hover:bg-emerald-500 text-emerald-200 hover:text-white px-2 py-0.5 rounded-full text-[10px] font-bold"
                            title="Open full list"
                        >
                            View All
                        </button>
                    </div>
                ) : (
                    /* Single Compact Card View */
                    <div className="w-80 bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 rounded-2xl shadow-[0_0_35px_rgba(16,185,129,0.35)] overflow-hidden transition-all">
                        {/* Header */}
                        <div className="bg-emerald-600/25 px-3.5 py-2 flex justify-between items-center border-b border-emerald-500/40">
                            <div className="flex items-center gap-2">
                                <FaWhatsapp size={15} className="text-emerald-400 animate-pulse" />
                                <h4 className="text-emerald-300 font-black text-[11px] uppercase tracking-wider">
                                    Call Granted
                                </h4>
                                {popups.length > 1 && (
                                    <span className="bg-emerald-500/30 text-emerald-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                        {currentIndex + 1}/{popups.length}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                                {popups.length > 1 && (
                                    <div className="flex items-center mr-1 bg-black/30 rounded-lg p-0.5">
                                        <button 
                                            onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : popups.length - 1))}
                                            className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-white/10 rounded transition-colors"
                                            title="Previous Lead"
                                        >
                                            <FaChevronLeft size={10} />
                                        </button>
                                        <button 
                                            onClick={() => setCurrentIndex(prev => (prev < popups.length - 1 ? prev + 1 : 0))}
                                            className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-white/10 rounded transition-colors"
                                            title="Next Lead"
                                        >
                                            <FaChevronRight size={10} />
                                        </button>
                                    </div>
                                )}
                                
                                <button
                                    onClick={() => setShowWidgetModal(true)}
                                    className="text-emerald-400 hover:text-white text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
                                    title="View All Allowed Leads"
                                >
                                    <FaListUl size={10} /> All
                                </button>
                                
                                <button 
                                    onClick={() => setIsMinimized(true)}
                                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                                    title="Minimize"
                                >
                                    <FaMinus size={10} />
                                </button>
                                
                                <button 
                                    onClick={(e) => handleDismiss(currentLead.id, e)}
                                    className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-white/10 transition-colors"
                                    title="Dismiss this lead"
                                >
                                    <FaTimes size={11} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-3.5 flex gap-3 items-center">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                                <FaCheckCircle size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-sm tracking-wide truncate">
                                    {currentLead.phone?.split('_')[0]}
                                </p>
                                <p className="text-slate-300 text-xs font-semibold truncate">
                                    {currentLead.name || 'Student'}
                                </p>
                                {currentLead.expiry ? (
                                    <span className="inline-block mt-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                                        Temp (7 Days)
                                    </span>
                                ) : (
                                    <span className="inline-block mt-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                                        Always Allowed
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={(e) => handleCallDirectly(currentLead, e)}
                                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 hover:scale-105 transition-all shrink-0"
                                title="Call directly"
                            >
                                <FaPhone size={11} /> Call
                            </button>
                        </div>

                        {/* Footer Action Bar */}
                        <div className="bg-emerald-950/60 border-t border-emerald-500/20 px-3 py-1.5 flex items-center justify-between text-[10px]">
                            <button 
                                onClick={() => handleClick(currentLead)}
                                className="text-emerald-300 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                                <span>Open CRM Chat</span> <FaExternalLinkAlt size={9} />
                            </button>
                            {popups.length > 1 && (
                                <button 
                                    onClick={handleDismissAll}
                                    className="text-slate-400 hover:text-red-400 font-semibold transition-colors"
                                >
                                    Dismiss All ({popups.length})
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

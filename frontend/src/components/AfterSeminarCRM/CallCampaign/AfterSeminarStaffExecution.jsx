import React, { useState, useEffect, useRef } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useCall } from '../../../contexts/CallContext';

import AfterSeminarOpenSem from './AfterSemOpen/AfterSeminarOpenSem';
import AfterSeminarNewInq from './AfterSemNew/AfterSeminarNewInq';
import AfterSeminarPaidCampaign from './AftersemPaid/AfterSeminarPaidCampaign';
import BridgeStaffExecution from "./BridgeStaffExecution";

export default function AfterSeminarStaffExecution({ filters, allBatches, setSelectedLead, externalTab, campaignSearchPhone, onLeadsLoaded }) {
    const { socket } = useCall?.() || {};
    const [activeTab, setActiveTab] = useState('OPEN_SEM'); 
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [drafts, setDrafts] = useState({});
    const activeLoadingTabRef = useRef('OPEN_SEM');

    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN'].includes(currentUser?.role?.toUpperCase().replace(/ /g, '_'));

    useEffect(() => {
        if (!socket) return;
        const handleBlocked = (data) => {
            if (data?.phone) {
                const phoneSuffix = String(data.phone).slice(-9);
                setLeads(prev => prev.map(l => {
                    const lSuffix = String(l.phone || '').split('_')[0].slice(-9);
                    if (lSuffix === phoneSuffix || l.id === data.leadId) {
                        return { ...l, isBlocked: true, blockedReason: data.reason };
                    }
                    return l;
                }));
            }
        };
        const handleUnblocked = (data) => {
            if (data?.phone) {
                const phoneSuffix = String(data.phone).slice(-9);
                setLeads(prev => prev.map(l => {
                    const lSuffix = String(l.phone || '').split('_')[0].slice(-9);
                    if (lSuffix === phoneSuffix || l.id === data.leadId) {
                        return { ...l, isBlocked: false, blockedReason: null };
                    }
                    return l;
                }));
            }
        };
        socket.on('lead_blocked', handleBlocked);
        socket.on('lead_unblocked', handleUnblocked);
        return () => {
            socket.off('lead_blocked', handleBlocked);
            socket.off('lead_unblocked', handleUnblocked);
        };
    }, [socket]);

    useEffect(() => {
        if (externalTab) setActiveTab(externalTab);
    }, [externalTab]);

    useEffect(() => {
        activeLoadingTabRef.current = activeTab;
        if (activeTab === 'OPEN_SEM' || activeTab === 'NEW_INQ') {
            fetchRegularLeads();
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch, activeTab]);

    const fetchRegularLeads = async () => {
        const currentRequestTab = activeTab;
        activeLoadingTabRef.current = currentRequestTab;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/leads', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    tab: 'ASSIGNED',
                    staffId: currentUser?.id,
                    loggedUserRole: currentUser?.role,
                    businessId: filters?.selectedBusiness || '', 
                    batchId: filters?.selectedBatch || '',
                    inquiryType: currentRequestTab === 'OPEN_SEM' ? 'OPEN_SEMINAR,NORMAL' : 'NEW_INQ',
                    limit: 1000
                }
            });
            
            // Race condition check: only update if active tab is still the one requested!
            if (activeLoadingTabRef.current !== currentRequestTab) {
                return;
            }
            
            const regularLeads = (res.data.leads || []).filter(l => l.source !== 'bridge_transfer');
            setLeads(regularLeads);
            if (onLeadsLoaded) onLeadsLoaded(regularLeads.length);

            const loadedDrafts = {};
            regularLeads.forEach(l => {
                const batchDraftKey = `draft_remark_as_${l.id}_${l.batchId || 'default'}`;
                let savedDraft = localStorage.getItem(batchDraftKey);
                const legacyDraft = localStorage.getItem(`draft_remark_as_${l.id}`);
                
                // If the lead is pending and has no feedback in DB, clear stale drafts from previous campaigns
                if (legacyDraft) {
                    if (l.callStatus === 'pending' || !l.feedback) {
                        localStorage.removeItem(`draft_remark_as_${l.id}`);
                    } else if (!savedDraft) {
                        savedDraft = legacyDraft;
                    }
                }
                if (savedDraft && (l.callStatus !== 'pending' || l.feedback)) {
                    loadedDrafts[l.id] = savedDraft;
                }
            });
            setDrafts(loadedDrafts);
        } catch (error) {
            if (activeLoadingTabRef.current === currentRequestTab) {
                toast.error("Failed to load assigned leads");
            }
        }
        if (activeLoadingTabRef.current === currentRequestTab) {
            setLoading(false);
        }
    };

    const handleUpdateLocalLead = (id, field, value) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    // 🔥 FIX: සේව් කරපු ගමන් අලුතින් Data අරන් UI එක Update කිරීම 🔥
    const handleSaveCallData = async (leadId, overrideStatus = null) => {
        const lead = leads.find(l => l.id === leadId);
        const feedback = drafts[leadId] || '';
        
        const finalStatus = overrideStatus || lead.callStatus || 'pending'; 

        const loadToast = toast.loading("Saving call data...");

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/after-seminar-crm/leads/update-call', {
                leadId, 
                method: lead.callMethod || 'direct', 
                status: finalStatus, 
                feedback,
                coordinationRound: lead.coordinationRound || 1,
                paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED'
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Saved successfully!", { id: loadToast });

            // Drafts අයින් කරනවා
            const newDrafts = { ...drafts };
            delete newDrafts[leadId];
            setDrafts(newDrafts);
            localStorage.removeItem(`draft_remark_as_${leadId}`);
            if (lead?.batchId) {
                localStorage.removeItem(`draft_remark_as_${leadId}_${lead.batchId}`);
            }

            // 🔥 අලුතෙන් මුළු ලිස්ට් එකම ගන්නෙ නැතුව Local Update කරනවා! (ගොඩක් වෙලා යන එක නවත්තන්න)
            if (res.data && res.data.lead) {
                setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...res.data.lead } : l));
            }
            
        } catch (error) { 
            toast.error("Failed to save data.", { id: loadToast }); 
        }
    };

    const handleTempUnlock = async (leadId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/leads/unlock', { leadId }, { headers: { Authorization: `Bearer ${token}` }});
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, isLocked: false } : l));
            toast.success("Lead Temporarily Unlocked!");
        } catch (e) { toast.error("Failed to unlock lead."); }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden font-sans antialiased text-slate-200 bg-transparent">
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-1">
                {loading && (activeTab === 'OPEN_SEM' || activeTab === 'NEW_INQ') ? (
                    <div className="flex justify-center items-center h-full text-slate-400">
                        <Loader2 className="animate-spin mr-2" size={20}/> Loading Assigned Leads...
                    </div>
                ) : (
                    <>
                        {activeTab === 'OPEN_SEM' && (
                            <div className="animate-fade-in-up h-full">
                                <AfterSeminarOpenSem 
                                    leads={leads} drafts={drafts} setDrafts={setDrafts} 
                                    handleUpdateLocalLead={handleUpdateLocalLead} handleSaveCallData={handleSaveCallData} 
                                    handleTempUnlock={handleTempUnlock} setChatModalLead={setSelectedLead} 
                                    isManager={isManager} allBatches={allBatches} filters={filters}
                                    externalSearch={campaignSearchPhone}
                                />
                            </div>
                        )}

                        {activeTab === 'NEW_INQ' && (
                            <div className="animate-fade-in-up h-full">
                                <AfterSeminarNewInq 
                                    leads={leads} drafts={drafts} setDrafts={setDrafts} 
                                    handleUpdateLocalLead={handleUpdateLocalLead} handleSaveCallData={handleSaveCallData} 
                                    handleTempUnlock={handleTempUnlock} setChatModalLead={setSelectedLead} 
                                    isManager={isManager} allBatches={allBatches} filters={filters}
                                    externalSearch={campaignSearchPhone}
                                />
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'BRIDGE' && (
                    <div className="animate-fade-in-up h-full">
                        <BridgeStaffExecution filters={filters} setChatModalLead={setSelectedLead} externalSearch={campaignSearchPhone} onLeadsLoaded={onLeadsLoaded} />
                    </div>
                )}

                {activeTab === 'PAID' && (
                    <div className="animate-fade-in-up h-full">
                        <AfterSeminarPaidCampaign filters={filters} setChatModalLead={setSelectedLead} externalSearch={campaignSearchPhone} onLeadsLoaded={onLeadsLoaded} />
                    </div>
                )}
            </div>
        </div>
    );
}
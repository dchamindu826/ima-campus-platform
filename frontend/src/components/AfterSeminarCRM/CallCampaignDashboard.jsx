import React, { useState, useEffect } from 'react';
import { FaFilter, FaRobot, FaPowerOff, FaTimes } from 'react-icons/fa';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import useLocalStorageState from '../../hooks/useLocalStorageState';

import AfterSeminarManagerCampaignStats from './AfterSeminarManagerCampaignStats';
import AfterSeminarStaffExecution from './CallCampaign/AfterSeminarStaffExecution';
import AfterSeminarChatArea from './CRM/AfterSeminarChatArea';
import AfterSeminarRightPanel from './CRM/AfterSeminarRightPanel';

export default function CallCampaignDashboard({ campaignType }) {
    const [user, setUser] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useLocalStorageState('callCamp_selectedBusiness', '');
    const [selectedBatch, setSelectedBatch] = useLocalStorageState('callCamp_selectedBatch', '');
    const [isFollowUpOn, setIsFollowUpOn] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [campaignSearchPhone, setCampaignSearchPhone] = useState('');
    const [batchLeadsCount, setBatchLeadsCount] = useState(null);

    useEffect(() => {
        setBatchLeadsCount(null);
    }, [selectedBusiness, selectedBatch, campaignType]);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch (e) {}
        }
        fetchBusinessesAndBatches();

        // 🔥 URL eken searchPhone parameter eka gannawa
        const params = new URLSearchParams(window.location.search);
        const phoneParam = params.get('searchPhone');
        if (phoneParam) {
            setCampaignSearchPhone(phoneParam);
        }
    }, []);

    const fetchBusinessesAndBatches = async () => {
        try {
            const res = await axios.get('/admin/manager/batches-full');
            const allBatches = res.data || [];
            setBatches(allBatches);

            const uniqueBiz = [];
            const bizMap = new Map();
            allBatches.forEach(b => {
                if (b.business && !bizMap.has(b.business.id)) {
                    bizMap.set(b.business.id, true);
                    uniqueBiz.push(b.business);
                }
            });
            setBusinesses(uniqueBiz);
        } catch (err) { console.error("Error fetching batches:", err); }
    };

    const rawRole = user?.role || JSON.parse(localStorage.getItem('user'))?.role || '';
    const userRole = rawRole.toUpperCase().replace(/ /g, '_');
    
    const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
    // Manager saha System Admin dennatama isManager True wenawa
    const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN'].includes(userRole);

    const displayBusinesses = React.useMemo(() => {
        if (isAdmin) return businesses;
        const userBizList = user?.businessType 
            ? String(user.businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
            : [];
        const userBizId = user?.businessId ? String(user.businessId) : null;

        const matched = businesses.filter(biz => {
            const isManagerOf = (biz.head_manager_id && String(biz.head_manager_id) === String(user?.id)) ||
                                (biz.ass_manager_id && String(biz.ass_manager_id) === String(user?.id));
            const matchesId = userBizId && String(biz.id) === userBizId;
            const matchesType = userBizList.some(b => 
                b === String(biz.id) ||
                b === biz.name.toLowerCase().trim() ||
                biz.name.toLowerCase().trim().includes(b) ||
                b.includes(biz.name.toLowerCase().trim())
            );
            return isManagerOf || matchesId || matchesType;
        });

        return matched.length > 0 ? matched : businesses;
    }, [businesses, isAdmin, user]);

    useEffect(() => {
        if (!isAdmin && displayBusinesses.length > 0) {
            const isValid = displayBusinesses.some(b => String(b.id) === String(selectedBusiness));
            if (!selectedBusiness || !isValid) {
                setSelectedBusiness(String(displayBusinesses[0].id));
            }
        }
    }, [displayBusinesses, isAdmin, selectedBusiness, setSelectedBusiness]);

    const displayBatches = batches.filter(b => {
        if (selectedBusiness) return String(b.businessId) === String(selectedBusiness);
        return true;
    });

    let activeBusinessId = selectedBusiness || '';
    
    // For admins, they MUST select a business if they want to view leads, unless it's COORD_PROGRESS
    const needsToSelectBusiness = isAdmin && !selectedBusiness && campaignType !== 'COORD_PROGRESS' && campaignType !== 'COORD_TRACKING';

    const getCampaignTitle = () => {
        if (campaignType === 'OVERALL') return 'Campaign Master Analytics';
        if (campaignType === 'OPEN_SEM') return 'Open Seminar Campaign';
        if (campaignType === 'NEW_INQ') return 'New Inquiries Campaign';
        if (campaignType === 'BRIDGE') return 'Bridge Transfers Campaign';
        if (campaignType === 'PAID') return 'Enrolled Students Campaign';
        if (campaignType === 'COORD_PROGRESS' || campaignType === 'COORD_TRACKING') return 'Class Coordination Managers - Coordinator Tracking';
        return 'Call Campaign';
    };

    return (
        <div className="h-full flex flex-col gap-5 animate-fade-in-up text-slate-200 relative overflow-hidden">
            
            {/* Header / Filters Section */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white/5 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-xl shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-white tracking-wide uppercase px-2 drop-shadow-md">
                        {getCampaignTitle()}
                    </h2>
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto">
                    {/* Animated Batch Leads Count */}
                    {!isManager && batchLeadsCount !== null && (
                        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.2)] animate-fade-in-up">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300/70">Assigned Leads</span>
                            <div className="bg-indigo-500 text-white text-sm font-black px-2.5 py-0.5 rounded-lg shadow-sm animate-pulse">
                                {batchLeadsCount}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5">
                        <FaFilter className="text-slate-500 ml-2 shrink-0" />
                        <select value={selectedBusiness} onChange={(e) => { setSelectedBusiness(e.target.value); setSelectedBatch(''); }} className="bg-black/40 border border-white/10 text-slate-300 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-brand-accent transition-all cursor-pointer">
                            {displayBusinesses.length > 1 && <option value="">Select Business (All)</option>}
                            {displayBusinesses.map(biz => <option key={biz.id} value={biz.id} className="bg-slate-900">{biz.name}</option>)}
                        </select>

                        <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} className="bg-black/40 border border-white/10 text-slate-300 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-brand-accent transition-all cursor-pointer">
                            <option value="">Select Batch (All)</option>
                            <option value="UNASSIGNED" className="bg-slate-900 text-yellow-400 font-bold">⚠️ Unassigned (No Batch)</option>
                            {displayBatches.map(b => <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {needsToSelectBusiness ? (
                <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-xl border border-white/10 animate-fade-in-up">
                    <FaFilter className="text-6xl text-slate-600 mb-4 opacity-20" />
                    <h2 className="text-xl font-bold text-slate-400 tracking-tight">Select a Business to Load Campaign Workspace</h2>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
                    
                    {/* 🔥 1. STATS SECTION (For Managers/Admins Only) 🔥 */}
                    {isManager && (
                        <div className="flex-1 animate-fade-in-down h-full">
                            <AfterSeminarManagerCampaignStats 
                                filters={{ selectedBusiness: activeBusinessId, selectedBatch }} 
                                allBatches={displayBatches} 
                                campaignType={campaignType}
                            />
                        </div>
                    )}

                    {/* 🔥 2. LEADS BOARD SECTION (For Coordinators/Staff Only) 🔥 */}
                    {/* Manager/Admin nemei nam (!isManager) saha OVERALL tab eka nemei nam witharak leads penwanawa */}
                    {!isManager && campaignType !== 'OVERALL' && (
                        <div className="flex-1 bg-transparent min-h-[500px]">
                            <AfterSeminarStaffExecution 
                                filters={{ selectedBusiness: activeBusinessId, selectedBatch }} 
                                allBatches={displayBatches} 
                                setSelectedLead={setSelectedLead} 
                                externalTab={campaignType} 
                                campaignSearchPhone={campaignSearchPhone} 
                                onLeadsLoaded={setBatchLeadsCount}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 💬 CHAT MODAL SESSION */}
            {selectedLead && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:pl-[300px] animate-fade-in">
                    <div className="bg-[#090E17]/95 backdrop-blur-3xl w-full max-w-[1500px] h-full max-h-[90vh] rounded-[32px] flex flex-col overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
                        
                        <div className="bg-white/5 px-8 py-5 flex justify-between items-center border-b border-white/10">
                            <div>
                                <h3 className="text-white font-black text-xl tracking-tight uppercase">Campaign Contact Session</h3>
                                <p className="text-brand-accent text-xs font-bold mt-0.5 opacity-80">Currently engaging with: {selectedLead.phone}</p>
                            </div>
                            <button onClick={() => setSelectedLead(null)} className="bg-white/5 hover:bg-brand-accent/20 text-slate-400 hover:text-brand-accent p-2.5 rounded-2xl transition-all border border-white/10">
                                <FaTimes size={20} />
                            </button>
                        </div>

                        <div className="flex-1 flex gap-4 p-6 h-[calc(100%-75px)] bg-transparent overflow-hidden">
                            <AfterSeminarChatArea selectedLead={selectedLead} businessId={activeBusinessId} />
                            <AfterSeminarRightPanel 
                                selectedLead={selectedLead} 
                                activeMode={'CALL_CAMPAIGN'} 
                                activeBusinessId={activeBusinessId} 
                                onBatchAssigned={(leadId, batchId) => {
                                    setSelectedLead(prev => prev.id === leadId ? { ...prev, batchId: parseInt(batchId) } : prev);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
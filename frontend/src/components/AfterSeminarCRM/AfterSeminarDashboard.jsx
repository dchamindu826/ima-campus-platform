import React, { useState, useEffect } from 'react';
import { FaWhatsapp, FaFilter, FaRobot, FaPowerOff } from 'react-icons/fa';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import useLocalStorageState from '../../hooks/useLocalStorageState';

// CRM Folder Imports
import AfterSeminarContactSidebar from './CRM/AfterSeminarContactSidebar';
import AfterSeminarChatArea from './CRM/AfterSeminarChatArea';
import AfterSeminarRightPanel from './CRM/AfterSeminarRightPanel';
import { BarChart, Users, PhoneCall, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import AgentStatusDropdown from '../../components/CoordinatorCRM/AgentStatusDropdown';
import WhatsAppBusinessNumberBadge from '../common/WhatsAppBusinessNumberBadge';
import MissedCallsNavButton from '../common/MissedCallsNavButton';

export default function AfterSeminarDashboard() {
  const [user, setUser] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [selectedBusiness, setSelectedBusiness] = useLocalStorageState('afterSem_selectedBusiness', '');
  const [selectedBatch, setSelectedBatch] = useLocalStorageState('afterSem_selectedBatch', '');

  const [isFollowUpOn, setIsFollowUpOn] = useState(false);
  const [isOpenSemOn, setIsOpenSemOn] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    let parsedUser = { role: 'SYSTEM_ADMIN' };

    if (storedUser) {
      try { parsedUser = JSON.parse(storedUser); setUser(parsedUser); } catch(e) {}
    } else setUser(parsedUser); 

    fetchBusinessesAndBatches();
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

  const needsToSelectBusiness = isAdmin && !selectedBusiness;

  useEffect(() => {
    if(activeBusinessId) {
      fetchFollowUpStatus(activeBusinessId);
      fetchOpenSemStatus(activeBusinessId);
    } else {
      setIsFollowUpOn(false);
      setIsOpenSemOn(false);
    }
  }, [activeBusinessId]);

  const fetchFollowUpStatus = async (bizId) => {
    try {
      const res = await axios.get(`/after-seminar-crm/followup-status?businessId=${bizId}`);
      setIsFollowUpOn(res.data.isOn);
    } catch (error) { console.error("Failed to load status"); }
  };

  const fetchOpenSemStatus = async (bizId) => {
    try {
      const res = await axios.get(`/after-seminar-crm/opensem-status?businessId=${bizId}`);
      setIsOpenSemOn(res.data.isOn);
    } catch (error) { console.error("Failed to load open sem status"); }
  };

  const handleToggleFollowUp = async () => {
    if(!activeBusinessId) return toast.error("Please select a business first.");
    const newStatus = !isFollowUpOn;
    setIsFollowUpOn(newStatus);
    try {
      await axios.post('/after-seminar-crm/toggle-followup', { businessId: activeBusinessId, isOn: newStatus });
      if (newStatus) toast.success("Auto Follow-Up STARTED!", { icon: '🚀' });
      else toast.error("Auto Follow-Up STOPPED!", { icon: '🛑' });
    } catch (error) {
      setIsFollowUpOn(!newStatus); 
      toast.error("Failed to update");
    }
  };

  const handleToggleOpenSem = async () => {
    const newStatus = !isOpenSemOn;
    setIsOpenSemOn(newStatus);
    try {
      await axios.post('/after-seminar-crm/toggle-opensem', { businessId: activeBusinessId, isOn: newStatus });
      if (newStatus) toast.success("Open Seminar Mode ACTIVATED!", { icon: '🔓' });
      else toast.error("Open Seminar Mode DEACTIVATED!", { icon: '🔒' });
    } catch (error) {
      setIsOpenSemOn(!newStatus); 
      toast.error("Failed to update Open Sem mode");
    }
  };

  const handleRedirectToCampaign = (lead) => {
      let path = '/workspace/campaign/open-seminar';
      if (lead.source === 'bridge_transfer' && (!(lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_'))))) path = '/workspace/campaign/bridge-transfers';
      else if (((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_'))))) path = '/workspace/campaign/paid-students';
      else if (lead.inquiryType === 'NEW_INQ') path = '/workspace/campaign/new-inquiries';
      
      // 🔥 Phone number eka URL parameter ekak widiyata add karanawa
      if (lead.phone) {
          path += `?searchPhone=${encodeURIComponent(lead.phone)}`;
      }
      
      window.location.href = path; 
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in-up text-slate-200 relative">
      
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 bg-slate-900/60 backdrop-blur-xl p-2 px-3 rounded-2xl border border-white/10 shadow-xl shrink-0 relative z-50">
        {/* Left Side: Branding + WA Badge + Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-2 mr-0.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <FaWhatsapp className="text-emerald-400" size={17} />
            </div>
            <span className="text-xs sm:text-sm font-black tracking-wider text-white uppercase whitespace-nowrap">
              After Seminar CRM
            </span>
          </div>

          {selectedBusiness && selectedBusiness !== 'ALL' && (
            <>
              <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
              <WhatsAppBusinessNumberBadge businessId={selectedBusiness} campaignType="AFTER_SEMINAR" />
            </>
          )}

          <div className="w-px h-5 bg-white/10 mx-0.5 hidden md:block"></div>

          {/* Action Tools on the Left */}
          <AgentStatusDropdown />
          <MissedCallsNavButton />

          {isManager && (
            <button
              type="button"
              onClick={handleToggleOpenSem}
              disabled={needsToSelectBusiness}
              className={`h-9 inline-flex items-center gap-1.5 px-2.5 rounded-xl font-bold text-xs transition-all border whitespace-nowrap shadow-sm select-none ${
                isOpenSemOn
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400 shadow-amber-950/30'
                  : 'bg-slate-800/60 hover:bg-slate-800/90 text-slate-300 hover:text-white border-white/10 hover:border-white/20'
              } ${needsToSelectBusiness ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Toggle Open Seminar Mode"
            >
              <FaPowerOff size={11} className={isOpenSemOn ? 'text-amber-400' : 'text-slate-400'} />
              <span>{isOpenSemOn ? 'Open Sem: ON' : 'Open Sem: OFF'}</span>
            </button>
          )}
        </div>

        {/* Right Side: Filters Group */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <div className="h-9 inline-flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-2 shadow-inner">
            <FaFilter className="text-slate-400 shrink-0" size={10} />
            
            <select
              value={selectedBusiness}
              onChange={(e) => { setSelectedBusiness(e.target.value); setSelectedBatch(''); }}
              className="bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer hover:text-white border-0 py-1 max-w-[130px] sm:max-w-[150px] truncate"
            >
              {displayBusinesses.length > 1 && <option value="" className="bg-slate-900">Select Business (All)</option>}
              {displayBusinesses.map(biz => <option key={biz.id} value={biz.id} className="bg-slate-900">{biz.name}</option>)}
            </select>

            <div className="w-px h-3.5 bg-white/10"></div>

            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer hover:text-white border-0 py-1 max-w-[125px] sm:max-w-[145px] truncate"
            >
              <option value="" className="bg-slate-900">Select Batch (All)</option>
              <option value="UNASSIGNED" className="bg-slate-900 text-amber-400 font-bold">⚠️ Unassigned</option>
              {displayBatches.map(b => <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {needsToSelectBusiness ? (
        <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-xl border border-white/10 animate-fade-in-up">
          <FaFilter className="text-6xl text-slate-600 mb-4 opacity-20" />
          <h2 className="text-xl font-bold text-slate-400 tracking-tight">Select a Business to Start</h2>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 h-[calc(100%-6rem)] overflow-hidden">
          <AfterSeminarContactSidebar 
            activeMode={'CRM'} 
            selectedLead={selectedLead} 
            setSelectedLead={setSelectedLead} 
            filters={{ selectedBusiness: activeBusinessId, selectedBatch }} 
            onRedirectToCampaign={handleRedirectToCampaign} 
          />
          {selectedLead ? (
            <>
              <AfterSeminarChatArea selectedLead={selectedLead} businessId={activeBusinessId} />
              <AfterSeminarRightPanel 
                selectedLead={selectedLead} 
                activeMode={'CRM'} 
                activeBusinessId={activeBusinessId} 
                onBatchAssigned={(leadId, batchId) => {
                    setSelectedLead(prev => prev.id === leadId ? { ...prev, batchId: parseInt(batchId) } : prev);
                }}
              />
            </>
          ) : (
            <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-slate-400 shadow-xl border border-white/10">
              <FaWhatsapp className="text-6xl text-slate-600 mb-4 opacity-20" />
              <h2 className="text-xl font-bold text-slate-400 tracking-tight">Select a lead to start CRM chatting</h2>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
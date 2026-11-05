import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ContactSidebar from '../../components/CoordinatorCRM/ContactSidebar';
import ChatArea from '../../components/CoordinatorCRM/ChatArea';
import RightSidePanel from '../../components/CoordinatorCRM/RightSidePanel';
import CallCampaignModule from '../../components/CoordinatorCRM/CallCampaignModule';
import CoordinatorOverview from '../../components/CoordinatorCRM/CoordinatorOverview';
import DedicatedCoordinatorOverview from '../../components/CoordinatorCRM/DedicatedCoordinatorOverview';
import MissedCallsNavButton from '../../components/common/MissedCallsNavButton';
import AgentStatusDropdown from '../../components/CoordinatorCRM/AgentStatusDropdown';
import WhatsAppBusinessNumberBadge from '../../components/common/WhatsAppBusinessNumberBadge';
import { FaWhatsapp, FaHeadset, FaFilter, FaChartBar, FaRobot, FaPowerOff } from 'react-icons/fa';
import { LayoutDashboard } from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import useLocalStorageState from '../../hooks/useLocalStorageState';

export default function CoordinatorDashboard({ loggedInUser }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  
  const [activeMode, setActiveMode] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const modeParam = searchParams.get('mode');
    if (modeParam === 'CALL_CAMPAIGN') return 'CALL_CAMPAIGN';
    if (modeParam === 'STATS') return 'STATS';
    return window.location.pathname.includes('/workspace/crm') ? 'CRM' : 'OVERVIEW';
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const modeParam = searchParams.get('mode');
    if (modeParam === 'CALL_CAMPAIGN') {
       setActiveMode('CALL_CAMPAIGN');
    } else if (modeParam === 'STATS') {
       setActiveMode('STATS');
    } else {
       const isCrmPath = location.pathname.includes('/workspace/crm');
       setActiveMode(isCrmPath ? 'CRM' : 'OVERVIEW');
    }
  }, [location.pathname, location.search]);

  const [selectedLead, setSelectedLead] = useState(null);
  const [redirectLead, setRedirectLead] = useState(null);
  
  const handleRedirectToCampaign = (lead) => {
    setRedirectLead(lead);
    setActiveMode('CALL_CAMPAIGN');
  };
  
  const [businesses, setBusinesses] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [selectedBusiness, setSelectedBusiness] = useLocalStorageState('freeSem_selectedBusiness', '');
  const [selectedBatch, setSelectedBatch] = useLocalStorageState('freeSem_selectedBatch', '');

  const [isFollowUpOn, setIsFollowUpOn] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch(e) {}
    } else {
      setUser({ role: 'SYSTEM_ADMIN' }); 
    }
    fetchBusinessesAndBatches();
    fetchFollowUpStatus();
  }, []);

  const fetchBusinessesAndBatches = async () => {
    try {
      const res = await axios.get('/admin/manager/batches-full');
      const allBatches = res.data;
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
      
      // 🔥 FIX: Auto-select eka ain kala. Dan user ma business eka select karanna ona 🔥

    } catch (err) { console.error("Error fetching dropdown data:", err); }
  };

  const fetchFollowUpStatus = async () => {
    try {
      const res = await axios.get('/coordinator-crm/followup-status');
      setIsFollowUpOn(res.data.isOn);
    } catch (error) { console.error("Failed to load follow-up status"); }
  };

  const handleToggleFollowUp = async () => {
    const newStatus = !isFollowUpOn;
    setIsFollowUpOn(newStatus);
    try {
      await axios.post('/coordinator-crm/toggle-followup', { isOn: newStatus });
      if (newStatus) toast.success("Auto Follow-Up Engine STARTED!", { icon: '🚀' });
      else toast.error("Auto Follow-Up Engine STOPPED!", { icon: '🛑' });
    } catch (error) {
      setIsFollowUpOn(!newStatus); 
      toast.error("Failed to update status");
    }
  };

  const rawRole = user?.role || JSON.parse(localStorage.getItem('user'))?.role || '';
  const userRole = rawRole.toUpperCase().replace(/ /g, '_'); 
  const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(userRole);
  const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);

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
    if (!isAdmin) {
      if (displayBusinesses.length > 0) {
        const isValid = displayBusinesses.some(b => String(b.id) === String(selectedBusiness));
        if (!selectedBusiness || !isValid) {
          setSelectedBusiness(String(displayBusinesses[0].id));
        }
      } else if (selectedBusiness !== '') {
        setSelectedBusiness('');
      }
    }
  }, [displayBusinesses, isAdmin, selectedBusiness, setSelectedBusiness]);

  const displayBatches = selectedBusiness 
    ? batches.filter(b => b.businessId === parseInt(selectedBusiness))
    : batches;

  const needsToSelectBusiness = (isAdmin || isManager) && !selectedBusiness;

  const isCrm = activeMode === 'CRM';

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in-up text-slate-300">
      
      {true && (
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 bg-slate-900/60 backdrop-blur-xl p-2 px-3 rounded-2xl border border-white/10 shadow-xl shrink-0 relative z-50">
        
        {/* Left Side: Branding + WA Badge + Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-2 mr-0.5 shrink-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isCrm ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-emerald-500/20' : 'bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-blue-500/20'
            }`}>
              {isCrm ? <FaWhatsapp size={17} /> : <FaChartBar size={17} />}
            </div>
            <span className="text-xs sm:text-sm font-black tracking-wider text-white uppercase whitespace-nowrap">
              {isCrm ? 'FREE SEMINAR CRM' : activeMode === 'STATS' ? 'FREE SEM CAMPAIGN STATS' : 'COORDINATOR DASHBOARD'}
            </span>
          </div>

          {selectedBusiness && selectedBusiness !== 'ALL' && (
            <>
              <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
              <WhatsAppBusinessNumberBadge businessId={selectedBusiness} campaignType="FREE_SEMINAR" />
            </>
          )}

          <div className="w-px h-5 bg-white/10 mx-0.5 hidden md:block"></div>

          {(isAdmin || isManager) && activeMode === 'CRM' && (
            <button 
              type="button"
              onClick={() => setActiveMode('OVERVIEW')}
              className="h-9 px-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20 flex items-center gap-1.5 shadow-sm select-none"
            >
              <LayoutDashboard size={13} className="text-blue-400" /> ADMIN DASHBOARD
            </button>
          )} 

          <AgentStatusDropdown />
          <MissedCallsNavButton />
        </div>

        {/* Right Side: Filters Group */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto relative">
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
              {displayBatches.map(b => <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Main Content Area */}
      {needsToSelectBusiness ? (
        <div className="flex-1 bg-[#1a2430] rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-xl border border-white/5 animate-fade-in-up">
          <FaFilter className="text-6xl text-slate-600 mb-4 opacity-50" />
          <h2 className="text-xl font-semibold text-slate-300">Select a Business to Start</h2>
          <p className="text-sm mt-1">Please select a business from the top dropdown filter to load the data.</p>
        </div>
      ) : activeMode === 'OVERVIEW' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            {!isAdmin && !isManager ? (
               <DedicatedCoordinatorOverview selectedBusiness={selectedBusiness} selectedBatch={selectedBatch} />
            ) : (
               <CoordinatorOverview 
                 loggedInUser={user} 
                 setActiveMode={setActiveMode} 
                 selectedBusiness={selectedBusiness} 
                 selectedBatch={selectedBatch} 
               />
            )}
        </div>
      ) : activeMode === 'CRM' ? (
        <div className="flex-1 flex gap-4 h-[calc(100%-6rem)] overflow-hidden">
          <ContactSidebar 
            activeMode={activeMode} 
            selectedLead={selectedLead} 
            setSelectedLead={setSelectedLead}
            filters={{ selectedBusiness, selectedBatch }}
            onRedirectToCampaign={handleRedirectToCampaign}
          />

          {selectedLead ? (
            <>
              <ChatArea selectedLead={selectedLead} businessId={selectedBusiness} />
              <RightSidePanel 
                selectedLead={selectedLead} 
                activeMode={activeMode} 
                selectedBusiness={selectedBusiness} 
                availableBatches={displayBatches}
                onBatchAssigned={(leadId, batchId) => {
                  setSelectedLead(prev => prev && prev.id === leadId ? { ...prev, batchId } : prev);
                }}
              />
            </>
          ) : (
            <div className="flex-1 bg-[#23303f] rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-xl border border-white/5">
              <FaWhatsapp className="text-6xl text-slate-600 mb-4 opacity-50" />
              <h2 className="text-xl font-semibold text-slate-300">Select a lead to start</h2>
              <p className="text-sm mt-1">Choose a contact from the left panel</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
            <CallCampaignModule 
                loggedInUser={user} 
                filters={{ selectedBusiness, selectedBatch }} 
                setActiveMode={setActiveMode}
                setSelectedLead={setSelectedLead}
                forceStatsView={activeMode === 'STATS'}
                redirectLead={redirectLead}
            />
        </div>
      )}
    </div>
  );
}
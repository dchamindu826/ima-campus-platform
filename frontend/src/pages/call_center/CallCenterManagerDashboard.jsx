import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../../api/axios';
import { 
  LayoutDashboard, Users, CheckCircle, Clock, ArrowRightLeft, 
  Sparkles, UserCheck, UserMinus, ChevronRight, PhoneCall, 
  Loader, Building2, Briefcase, BarChart3, Filter, ShieldAlert,
  AlertCircle, Ghost, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import OverviewTab from '../../components/CallCenter/OverviewTab';
import BridgeHandOversTab from '../../components/CallCenter/BridgeHandOversTab';
import BridgeProgressTab from '../../components/CallCenter/BridgeProgressTab';
import CoordinatorStatsBreakdown from '../../components/CallCenter/CoordinatorStatsBreakdown';

import DelegateSocialMediaTaskModal from '../../components/common/DelegateSocialMediaTaskModal';

export default function CallCenterManagerDashboard() {
  const { tab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tab || 'overview';

  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [stats, setStats] = useState({
    totalRequested: 0,
    totalUnassigned: 0,
    totalAssigned: 0,
    totalCompleted: 0,
    totalLeads: 0,
    pendingLeads: 0
  });
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [unassignedLeads, setUnassignedLeads] = useState([]); 
  
  const [selectedBizCard, setSelectedBizCard] = useState(null); 
  const [activeSubTab, setActiveSubTab] = useState('needs-assignment'); 
  const [detailedLeads, setDetailedLeads] = useState([]); 

  const [staff, setStaff] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [checkedLeads, setCheckedLeads] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    firstName: '', lastName: '', phone: '', nic: '', password: '', role: 'Staff', department: 'Call Center', businessType: 'All'
  });

  useEffect(() => {
    fetchBusinesses();
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchStats();
    if (activeTab === 'free-sem' || activeTab === 'after-sem') {
      const cType = activeTab === 'free-sem' ? 'FREE_SEMINAR' : 'AFTER_SEMINAR';
      fetchPendingRequests(cType);
      fetchUnassignedLeads(cType);
    }
    setCheckedLeads([]);
    setSelectedBizCard(null); 
    setSelectedBatch('All');
    setActiveSubTab('needs-assignment');
  }, [activeTab]);

  useEffect(() => {
    if (selectedBizCard) {
      fetchBatches(selectedBizCard.id);
      fetchDetailedLeads(selectedBizCard.id);
    }
  }, [selectedBizCard]);

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem('token');
      // FIXED: Using axios wrapper which uses interceptors correctly
      const response = await axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } });
      setBusinesses(response.data || []);
    } catch (error) { console.error("Failed to load businesses", error); }
  };

  const fetchBatches = async (bizId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/admin/batches/${bizId}`, { headers: { Authorization: `Bearer ${token}` } });
      setBatches(Array.isArray(res.data) ? res.data : (res.data?.batches || []));
    } catch (error) { console.error("Failed to fetch batches", error); }
  };

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/manager/staff', { headers: { Authorization: `Bearer ${token}` } });
      setStaff(response.data || []);
    } catch (error) { console.error("Failed to load staff list", error); }
  };

  const handleGhostLogin = async (staffId) => {
    try {
      const toastId = toast.loading("Switching to Ghost Mode...");
      const token = localStorage.getItem('token');
      const res = await axios.post(`/auth/ghost-login/${staffId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.token && res.data.user) {
        localStorage.setItem('admin_token', localStorage.getItem('token'));
        localStorage.setItem('admin_user', localStorage.getItem('user'));
        const { password, ...safeUser } = res.data.user;
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(safeUser));
        toast.success("Switched to Ghost Mode successfully!", { id: toastId });
        window.location.href = '/login';
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Ghost login failed.");
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/stats', { headers: { Authorization: `Bearer ${token}` }, params: { businessId: 'All' } });
      setStats(response.data || {});
    } catch (error) { console.error("Failed to load stats", error); }
  };

  const fetchPendingRequests = async (campaignType) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/pending-requests', { headers: { Authorization: `Bearer ${token}` }, params: { businessId: 'All' } });
      const allReqs = response.data || [];
      setPendingRequests(allReqs.filter(r => r.campaignType === campaignType));
    } catch (error) { console.error("Failed to fetch pending requests", error); }
    finally { setLoading(false); }
  };

  const fetchUnassignedLeads = async (campaignType) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/call-center/manager/leads', {
        headers: { Authorization: `Bearer ${token}` },
        params: { businessId: 'All', tab: 'unassigned', campaignType }
      });
      setUnassignedLeads(response.data || []);
    } catch (error) { console.error("Failed to fetch leads", error); } 
    finally { setLoading(false); }
  };

  const fetchDetailedLeads = async (bizId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let response;
      if (activeTab === 'free-sem' || activeTab === 'after-sem') {
        const campaignType = activeTab === 'free-sem' ? 'FREE_SEMINAR' : 'AFTER_SEMINAR';
        const pendingRes = await axios.get('/call-center/pending-requests', { headers: { Authorization: `Bearer ${token}` }, params: { businessId: bizId } });
        const allRes = await axios.get('/call-center/manager/leads', { headers: { Authorization: `Bearer ${token}` }, params: { businessId: bizId, campaignType } });
        
        let pending = pendingRes.data || [];
        pending = pending.filter(p => p.campaignType === campaignType);
        
        response = [...pending, ...(allRes.data || [])];
        const uniqueIds = new Set();
        response = response.filter(l => {
          if (uniqueIds.has(l.id)) return false;
          uniqueIds.add(l.id);
          return true;
        });
      }
      setDetailedLeads(response);
    } catch (error) { console.error("Failed to fetch detailed leads", error); }
    finally { setLoading(false); }
  };

  const handleProcessHandover = async (leadIds, action) => {
    if (leadIds.length === 0) return toast.error("Select leads first");
    try {
      const token = localStorage.getItem('token');
      await axios.post('/call-center/process-transfer', { leadIds, action }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Successfully ${action.toLowerCase()}ed ${leadIds.length} transfers!`);
      fetchStats();
      fetchPendingRequests();
      if (selectedBizCard) fetchDetailedLeads(selectedBizCard.id);
      setCheckedLeads([]);
    } catch (error) { toast.error("Failed to process requests"); }
  };

  const handleBulkAssign = async () => {
    if (checkedLeads.length === 0) return toast.error("Please select leads first!");
    if (!selectedAgent) return toast.error("Please select an agent!");
    try {
      const token = localStorage.getItem('token');
      await axios.post('/call-center/manager/assign', { leadIds: checkedLeads, agentId: selectedAgent }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Assigned ${checkedLeads.length} leads to agent!`);
      setCheckedLeads([]);
      fetchStats();
      fetchStaff();
      if (activeTab === 'free-sem' || activeTab === 'after-sem') fetchUnassignedLeads(activeTab === 'free-sem' ? 'FREE_SEMINAR' : 'AFTER_SEMINAR');
      if (selectedBizCard) fetchDetailedLeads(selectedBizCard.id);
    } catch (error) { toast.error("Failed to assign leads"); }
  };

  const handleOpenCreateStaff = () => {
    setEditingStaff(null);
    setStaffForm({ firstName: '', lastName: '', phone: '', nic: '', password: '', role: 'Call Center Agent', department: 'Call Center', businessType: 'All' });
    setShowStaffModal(true);
  };
  const handleOpenEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({ firstName: member.firstName, lastName: member.lastName, phone: member.phone, nic: member.nic || '', password: '', role: member.role || 'Call Center Agent', department: 'Call Center', businessType: 'All' });
    setShowStaffModal(true);
  };
  const handleStaffFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editingStaff) {
        await axios.put(`/admin/staff/${editingStaff.id}`, staffForm, { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Staff profile updated!");
      } else {
        if (!staffForm.password) return toast.error("Password is required!");
        await axios.post('/admin/staff', staffForm, { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Staff login created!");
      }
      setShowStaffModal(false);
      fetchStaff();
    } catch (error) { toast.error(error.response?.data?.error || "Failed to save profile"); }
  };
  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm("Are you absolutely sure?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/admin/staff/${staffId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Staff deleted!");
      fetchStaff();
    } catch (error) { toast.error("Failed to delete staff"); }
  };

  const handleStartRound2 = async () => {
    if (!selectedBusiness) return;
    try {
      const token = localStorage.getItem('token');
      const campaignType = activeTab === 'free-sem' ? 'FREE_SEMINAR' : 'AFTER_SEMINAR';
      await axios.post('/call-center/manager/start-round', {
        businessId: selectedBusiness.id,
        campaignType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Round 2 has been initialized for assigned leads.");
      fetchDetailedLeads(selectedBusiness.id); // Refresh
    } catch (error) {
      toast.error("Failed to start Round 2");
      console.error(error);
    }
  };

  const toggleLeadCheck = (leadId) => {
    setCheckedLeads(prev => prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]);
  };
  const handleSelectAll = (activeList) => {
    if (checkedLeads.length === activeList.length) setCheckedLeads([]);
    else setCheckedLeads(activeList.map(l => l.id));
  };

  const getLevel1List = () => {
    const uniqueIds = new Set();
    const combined = [...pendingRequests, ...unassignedLeads].filter(l => {
      if (uniqueIds.has(l.id)) return false;
      uniqueIds.add(l.id);
      return true;
    });
    return combined;
  };

  const [sortOrder, setSortOrder] = useState('NEWEST'); // 'NEWEST' or 'OLDEST'
  const [allocateCount, setAllocateCount] = useState('');

  const isCCAgent = (u) => {
    if (!u) return false;
    const role = String(u.role || '').toUpperCase().replace(/ /g, '_');
    const dept = String(u.department || '').toUpperCase().replace(/ /g, '_');
    return ['CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(role) || dept === 'CALL_CENTER';
  };

  const getFilteredDetailedLeads = () => {
    let list = [...detailedLeads];
    if (selectedBatch !== 'All') {
      list = list.filter(l => l.batchId === parseInt(selectedBatch));
    }
    if (activeSubTab === 'pending-handovers') {
      list = list.filter(l => l.callCenterRequestStatus === 'REQUESTED');
    } else if (activeSubTab === 'needs-assignment') {
      list = list.filter(l => (l.callCenterRequestStatus === 'APPROVED' || l.isCallCenter) && (!l.assignedTo || !isCCAgent(l.assignedUser)));
    } else if (activeSubTab === 'assigned') {
      list = list.filter(l => l.assignedTo !== null && isCCAgent(l.assignedUser));
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(l => {
        const name = (l.name || l.studentName || '').toLowerCase();
        const phone = (l.phone || l.contactNumber || '').toLowerCase();
        const agent = (l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : '').toLowerCase();
        return name.includes(q) || phone.includes(q) || agent.includes(q);
      });
    }

    // Sort order (Newest first vs Oldest first)
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
    });

    return list;
  };

  const handleQuickSelectCount = (countVal) => {
    const list = getFilteredDetailedLeads();
    if (countVal === 'ALL') {
      setCheckedLeads(list.map(l => l.id));
      setAllocateCount(String(list.length));
      toast.success(`Selected all ${list.length} leads!`);
      return;
    }
    const count = parseInt(countVal);
    if (isNaN(count) || count <= 0) {
      setCheckedLeads([]);
      setAllocateCount('');
      return;
    }
    setAllocateCount(String(count));
    const targetSlice = list.slice(0, count).map(l => l.id);
    setCheckedLeads(targetSlice);
    toast.success(`Selected top ${targetSlice.length} ${sortOrder === 'NEWEST' ? 'newest' : 'oldest'} leads!`);
  };

  const filteredLeads = getFilteredDetailedLeads();
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


  const getImageUrl = (imageName) => {
    if (!imageName || imageName === 'default.png' || imageName === 'null') return '/logo.png';
    return `${axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : 'https://imacampus.online'}/storage/icons/${imageName}`;
  };

  const getSidebarLinkClass = (tabName) => {
    return `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-bold ${
      activeTab === tabName 
        ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/30' 
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
    }`;
  };

  const SubTabBtn = ({ id, label }) => (
    <button 
      onClick={() => { setActiveSubTab(id); setCheckedLeads([]); }}
      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
        activeSubTab === id 
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-0 text-slate-100 bg-transparent flex flex-col min-h-screen">
      

      <div className="flex-1 w-full flex flex-col gap-8">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative flex-1 min-h-[600px] overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center rounded-3xl z-40">
              <Loader className="animate-spin text-red-500 text-4xl" />
            </div>
          )}

          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'bridge-handovers' && <BridgeHandOversTab staff={staff} />}
          {activeTab === 'bridge-progress' && <BridgeProgressTab businesses={businesses} />}

          {(activeTab === 'free-sem' || activeTab === 'after-sem') && (
            <div className="animate-fade-in flex flex-col h-full">
              <h2 className="text-xl font-extrabold flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
                <span className="flex items-center gap-2 text-red-200 uppercase tracking-wider">
                  
                  {activeTab === 'free-sem' && <PhoneCall className="text-red-400" />}
                  {activeTab === 'after-sem' && <Users className="text-red-400" />}
                  
                  {activeTab === 'free-sem' && 'Free Seminar Leads Pool'}
                  {activeTab === 'after-sem' && 'After Seminar Leads Pool'}
                </span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsDelegateModalOpen(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl border border-indigo-400/30 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    <span>🚀</span> Delegate Work to Social Media
                  </button>
                  {selectedBizCard && (
                    <button 
                      onClick={() => { setSelectedBizCard(null); setSelectedBatch('All'); setCheckedLeads([]); setActiveSubTab('needs-assignment'); }}
                      className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors text-slate-200 flex items-center gap-2"
                    >
                      <ChevronRight className="rotate-180" size={16}/> Back to Businesses
                    </button>
                  )}
                </div>
              </h2>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {!selectedBizCard ? (
                  <>
                    {businesses.length === 0 && !loading ? (
                      <div className="flex flex-col items-center justify-center h-64 bg-slate-800/30 rounded-3xl border border-slate-700/50 border-dashed">
                        <AlertCircle className="text-red-400 mb-4 opacity-50" size={48} />
                        <h3 className="text-xl font-bold text-slate-300 mb-2">No Businesses Found</h3>
                        <p className="text-slate-500 text-sm">Please check your permissions or contact an administrator.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-8">
                        {businesses.map(biz => {
                          const bizList = getLevel1List().filter(l => l.batch?.businessId === biz.id || (l.phone && l.phone.includes(`_BIZ_${biz.id}`)));
                          const pendingCount = bizList.length;
                          
                          return (
                            <div 
                              key={biz.id}
                              onClick={() => {
                                setSelectedBizCard(biz);
                                setSelectedBatch('All');
                                setCheckedLeads([]);
                                const hasPendingReqs = pendingRequests.some(l => l.batch?.businessId === biz.id);
                                setActiveSubTab(hasPendingReqs ? 'pending-handovers' : 'needs-assignment');
                              }}
                              className="group cursor-pointer bg-white/[0.05] backdrop-blur-2xl hover:border-red-500/50 border border-white/10 p-6 md:p-8 rounded-[2rem] flex flex-col gap-6 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-lg relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 pointer-events-none rounded-full bg-red-500 transition-opacity group-hover:opacity-40"></div>
                              
                              {pendingCount > 0 && (
                                <div className="absolute top-6 right-6 bg-rose-600/90 backdrop-blur-sm text-white text-xs font-black px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(219,39,119,0.5)] z-20 flex items-center gap-1.5 border border-rose-500/50 animate-pulse">
                                  <ShieldAlert size={14}/> {pendingCount} Pending
                                </div>
                              )}

                              <div className="flex-1 w-full bg-black/40 rounded-2xl flex items-center justify-center p-8 relative aspect-video border border-white/5 overflow-hidden">
                                
                                {biz.logo ? (
                                  <img src={getImageUrl(biz.logo)} alt="logo" className="w-full h-full object-contain relative z-0 group-hover:scale-110 transition-transform duration-700" onError={(e) => e.target.src = '/logo.png'} />
                                ) : (
                                  <Building2 className="text-red-400/50 w-24 h-24 relative z-0 group-hover:scale-110 transition-transform duration-700" />
                                )}
                              </div>

                              <div className="relative z-20 shrink-0">
                                <h3 className="text-xl font-black text-slate-200 group-hover:text-red-300 transition-colors line-clamp-1">{biz.name}</h3>
                                <div className="mt-2 flex items-center text-red-400 text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                                  View Campaigns <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="animate-fade-in-up flex flex-col h-full">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4 bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {selectedBizCard.logo ? (
                            <img src={getImageUrl(selectedBizCard.logo)} alt="logo" className="w-full h-full object-cover" onError={(e) => e.target.src = '/logo.png'} />
                          ) : (
                            <Building2 className="text-red-400" size={24} />
                          )}
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">{selectedBizCard.name}</h3>
                          <div className="flex items-center gap-2 mt-2">
                            <Filter size={14} className="text-red-400" />
                            <select 
                              value={selectedBatch} 
                              onChange={(e) => { setSelectedBatch(e.target.value); setCheckedLeads([]); }}
                              className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:border-red-500 outline-none font-bold"
                            >
                              <option value="All">All Batches Overview</option>
                              {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex bg-[#0f172a] p-1.5 rounded-2xl border border-slate-700 gap-1 overflow-x-auto">
                        <SubTabBtn id="pending-handovers" label="Pending Approvals" />
                        <SubTabBtn id="needs-assignment" label="Unassigned Pool" />
                        <SubTabBtn id="assigned" label="Assigned Leads" />
                        <SubTabBtn id="overview" label="Stats Overview" />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pb-4">
                      {activeSubTab === 'overview' ? (
                        <div className="animate-fade-in pb-4">
                          <CoordinatorStatsBreakdown 
                            leads={detailedLeads.filter(l => selectedBatch === 'All' || l.batchId === parseInt(selectedBatch))}
                            staff={staff}
                            title="Coordinator Performance Breakdown"
                            subtitle={
                              selectedBatch === 'All'
                                ? `All Batches Overview • ${selectedBizCard?.name || 'Business Leads Pool'}`
                                : `${batches.find(b => b.id === parseInt(selectedBatch))?.name || 'Selected Batch'} • ${selectedBizCard?.name || 'Business Leads Pool'}`
                            }
                            campaignLabel={activeTab === 'free-sem' ? 'Free_Seminar' : 'After_Seminar'}
                            onSelectAgent={(agent) => {
                              setSearchQuery(agent.name);
                              setActiveSubTab('assigned');
                            }}
                          />
                        </div>
                      ) : (
                        <div className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-700 flex flex-col h-full animate-fade-in shadow-xl">
                          {(activeSubTab === 'pending-handovers' || activeSubTab === 'needs-assignment' || activeSubTab === 'assigned') && (
                            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                              {/* Search Bar Input */}
                              <div className="relative w-full md:w-80">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                  type="text"
                                  placeholder="Search name, phone, caller..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-white outline-none focus:border-red-500 placeholder:text-slate-500"
                                />
                                {searchQuery && (
                                  <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-white/10 rounded-full w-4 h-4 flex items-center justify-center"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                <span className="text-sm font-bold text-slate-400 whitespace-nowrap">
                                  {activeSubTab === 'assigned' ? `${filteredLeads.length} Total Assigned` : `${checkedLeads.length} Selected`}
                                </span>
                              
                              {activeSubTab === 'pending-handovers' ? (
                                <div className="flex gap-2">
                                  <button onClick={() => handleProcessHandover(checkedLeads, 'APPROVE')} className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/10">
                                    Approve Requests
                                  </button>
                                  <button onClick={() => handleProcessHandover(checkedLeads, 'REJECT')} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 px-6 py-2.5 rounded-xl text-sm font-bold transition-all">
                                    Reject Requests
                                  </button>
                                </div>
                              ) : activeSubTab === 'assigned' ? (
                                <button onClick={handleStartRound2} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                                  Start Round 2
                                </button>
                              ) : (
                                <div className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
                                   {/* Order & Count Allocation Section */}
                                   <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto bg-slate-900/60 p-2 px-3 rounded-2xl border border-slate-700/60">
                                     <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                                       <button
                                         onClick={() => { setSortOrder('NEWEST'); if (allocateCount) handleQuickSelectCount(allocateCount); }}
                                         className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${sortOrder === 'NEWEST' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                       >
                                         Newest First ⬇️
                                       </button>
                                       <button
                                         onClick={() => { setSortOrder('OLDEST'); if (allocateCount) handleQuickSelectCount(allocateCount); }}
                                         className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${sortOrder === 'OLDEST' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                       >
                                         Oldest First ⬆️
                                       </button>
                                     </div>

                                     <div className="flex items-center gap-2">
                                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Count:</span>
                                       <input
                                         type="number"
                                         min="1"
                                         max={filteredLeads.length}
                                         placeholder="e.g. 50"
                                         value={allocateCount}
                                         onChange={(e) => handleQuickSelectCount(e.target.value)}
                                         className="w-20 bg-slate-900 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-red-500 text-center"
                                       />
                                     </div>

                                     <div className="flex items-center gap-1">
                                       {[10, 25, 50, 100].map(cnt => (
                                         <button
                                           key={cnt}
                                           onClick={() => handleQuickSelectCount(cnt)}
                                           className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                             allocateCount === String(cnt) 
                                               ? 'bg-orange-500 text-white border-orange-400 font-black shadow-md' 
                                               : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                           }`}
                                         >
                                           {cnt}
                                         </button>
                                       ))}
                                       <button
                                         onClick={() => handleQuickSelectCount('ALL')}
                                         className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                           checkedLeads.length === filteredLeads.length && filteredLeads.length > 0
                                             ? 'bg-orange-500 text-white border-orange-400 font-black shadow-md' 
                                             : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                         }`}
                                       >
                                         All ({filteredLeads.length})
                                       </button>
                                     </div>
                                   </div>

                                   {/* Agent Selector & Assign Button */}
                                   <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                     <select 
                                       value={selectedAgent} 
                                       onChange={(e) => setSelectedAgent(e.target.value)}
                                       className="bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none w-full sm:w-auto font-medium"
                                     >
                                        <option value="">-- Choose Agent to Assign --</option>
                                        {staff.map(member => (
                                          <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>
                                        ))}
                                      </select>
                                      <button onClick={handleBulkAssign} className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 whitespace-nowrap">
                                        Assign Workload ({checkedLeads.length})
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm text-slate-300">
                              <thead className="bg-[#1e293b] text-xs uppercase text-slate-400 border-b border-slate-700 font-black">
                                <tr>
                                  {(activeSubTab === 'pending-handovers' || activeSubTab === 'needs-assignment') && (
                                    <th className="px-5 py-4 w-12">
                                      <input 
                                        type="checkbox" 
                                        checked={checkedLeads.length > 0 && checkedLeads.length === filteredLeads.length}
                                        onChange={() => handleSelectAll(getFilteredDetailedLeads())}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-600 focus:ring-red-600"
                                      />
                                    </th>
                                  )}
                                  <th className="px-5 py-4">Student Name</th>
                                  <th className="px-5 py-4">Contact</th>
                                  <th className="px-5 py-4">Batch</th>
                                  {activeSubTab === 'assigned' && <th className="px-5 py-4">Assigned To</th>}
                                  {activeSubTab === 'assigned' && <th className="px-5 py-4">Status</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {paginatedLeads.map(lead => (
                                  <tr key={lead.id} className="hover:bg-slate-800/80 transition-colors">
                                    {(activeSubTab === 'pending-handovers' || activeSubTab === 'needs-assignment') && (
                                      <td className="px-5 py-4">
                                        <input 
                                          type="checkbox" 
                                          checked={checkedLeads.includes(lead.id)}
                                          onChange={() => toggleLeadCheck(lead.id)}
                                          className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-600 focus:ring-red-600"
                                        />
                                      </td>
                                    )}
                                    <td className="px-5 py-4 font-bold text-white">{lead.name || 'No Name'}</td>
                                    <td className="px-5 py-4">{lead.phone}</td>
                                    <td className="px-5 py-4 text-xs font-bold text-orange-300 bg-orange-500/5 rounded-r-none">{lead.batch?.name || '-'}</td>
                                    {activeSubTab === 'assigned' && (
                                      <td className="px-5 py-4 text-emerald-400 font-bold">
                                        {lead.assignedUser?.firstName} {lead.assignedUser?.lastName}
                                        {!lead.assignedUser && lead.callCenterRequestStatus === 'APPROVED' && <span className="text-slate-400 italic">Approved, Pending Agent</span>}
                                      </td>
                                    )}
                                    {activeSubTab === 'assigned' && (
                                       <td className="px-5 py-4 text-xs font-bold">
                                         {(() => {
                                           const cStatus = (lead.callStatus || lead.roundProgress?.[0]?.callStatus || '').toUpperCase();
                                           const centerStatus = (lead.callCenterStatus || '').toLowerCase();
                                           if (centerStatus === 'completed' || ['ANSWERED', 'ANSWER', 'REJECT', 'REJECTED'].includes(cStatus)) {
                                             return (
                                               <span className="px-3 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10">
                                                 COMPLETED
                                               </span>
                                             );
                                           }
                                           if (cStatus === 'NO_ANSWER' || centerStatus === 'no_answer') {
                                             return (
                                               <span className="px-3 py-1.5 rounded-lg border bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-sm shadow-orange-500/10">
                                                 NO ANSWER
                                               </span>
                                             );
                                           }
                                           return (
                                             <span className="px-3 py-1.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10">
                                               PENDING
                                             </span>
                                           );
                                         })()}
                                       </td>
                                     )}
                                  </tr>
                                ))}
                                {filteredLeads.length === 0 && (
                                  <tr>
                                    <td colSpan={activeSubTab === 'assigned' ? 6 : 5} className="text-center py-12 text-slate-500">
                                      <AlertCircle className="mx-auto mb-3 opacity-30" size={32} />
                                      No leads found in this view.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <span className="text-sm font-bold text-slate-400">
                              Showing {filteredLeads.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} Entries
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
                              >
                                Previous
                              </button>
                              <span className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-bold border border-slate-600">
                                {currentPage} / {totalPages || 1}
                              </span>
                              <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="animate-fade-in h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-red-200 uppercase tracking-wider">
                  <UserCheck className="text-red-400" /> Manage Dialer Agents
                </h2>
                <button 
                  onClick={handleOpenCreateStaff}
                  className="bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transition-all flex items-center gap-2"
                >
                  <UserCheck size={16}/> Add New Agent
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
                  {staff.map(member => (
                    <div key={member.id} className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-slate-700 hover:border-red-500/50 rounded-[2rem] p-6 shadow-xl relative overflow-hidden transition-all flex flex-col justify-between group">
                      <div className="absolute -right-10 -top-10 w-32 h-32 blur-[50px] opacity-20 pointer-events-none rounded-full bg-orange-500 transition-opacity group-hover:opacity-40"></div>
                      <div className="flex items-start justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white font-black flex items-center justify-center text-2xl shadow-lg">
                            {member.firstName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">{member.firstName} {member.lastName}</h3>
                            <span className="text-xs text-orange-300 bg-orange-500/20 px-2 py-1 rounded-md border border-orange-500/30 font-bold mt-1 inline-block">{member.phone}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 relative z-10 flex-wrap">
                        <button 
                          onClick={() => handleGhostLogin(member.id)} 
                          className="flex-1 flex items-center justify-center gap-1.5 text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600 py-2.5 rounded-xl transition-all text-xs font-bold border border-purple-500/30 shadow-md hover:shadow-purple-500/30"
                          title="Ghost login as this caller/agent"
                        >
                          <Ghost size={14}/> Ghost Login
                        </button>
                        <button onClick={() => handleOpenEditStaff(member)} className="flex-1 flex items-center justify-center gap-1.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 py-2.5 rounded-xl transition-all text-xs font-bold border border-white/5">
                          <Briefcase size={14}/> Edit
                        </button>
                        <button onClick={() => handleDeleteStaff(member.id)} className="flex-1 flex items-center justify-center gap-1.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 py-2.5 rounded-xl transition-all text-xs font-bold border border-rose-500/20 hover:border-rose-500 shadow-sm">
                          <UserMinus size={14}/> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="animate-fade-in h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-red-200 uppercase tracking-wider">
                  <BarChart3 className="text-red-400" /> Callers Progress Overview
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                  {staff.map(member => {
                    const isComplete = member.completed > 0;
                    const pending = member.totalAssigned - member.completed;
                    const ratio = member.totalAssigned > 0 ? Math.round((member.completed / member.totalAssigned) * 100) : 0;
                    
                    const donutRadius = 40;
                    const donutCircumference = 2 * Math.PI * donutRadius;
                    const completedPct = ratio / 100;
                    const donutStrokeDashoffset = donutCircumference - (completedPct * donutCircumference);

                    return (
                      <div key={member.id} className="bg-white/[0.03] backdrop-blur-md border border-slate-700/60 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all hover:border-red-500/30 group">
                        <div className="absolute top-0 right-0 w-40 h-40 blur-[60px] opacity-10 pointer-events-none rounded-full bg-red-500 transition-opacity group-hover:opacity-20"></div>
                        <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-4 relative z-10">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-orange-600 text-white font-black flex items-center justify-center text-xl shadow-lg">
                            {member.firstName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">{member.firstName} {member.lastName}</h3>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Agent Dialing Stats</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex-1 space-y-5">
                            <div>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Workload</p>
                              <p className="text-4xl font-black text-slate-200 mt-1">{member.totalAssigned}</p>
                            </div>
                            <div className="flex gap-8 bg-black/20 p-3 rounded-2xl border border-white/5 w-max">
                              <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Completed</p>
                                <p className="text-2xl font-black text-emerald-400">{member.completed}</p>
                              </div>
                              <div className="w-px bg-white/10 my-1"></div>
                              <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pending</p>
                                <p className="text-2xl font-black text-rose-400">{pending}</p>
                              </div>
                            </div>
                          </div>
                          <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="64" cy="64" r={donutRadius} className="stroke-[#0F172A] fill-none" strokeWidth="12" />
                              <circle cx="64" cy="64" r={donutRadius} className="stroke-red-500 fill-none transition-all duration-1000 ease-out" strokeWidth="12" strokeDasharray={donutCircumference} strokeDashoffset={donutStrokeDashoffset} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.5))' }} />
                            </svg>
                            <div className="absolute text-center mt-1">
                              <span className="text-2xl font-black text-white block">{ratio}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {staff.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                      <BarChart3 className="mx-auto text-orange-500 mb-4 opacity-50" size={56} />
                      <p className="text-xl font-bold text-slate-300">No Metrics Available</p>
                      <p className="text-sm mt-2">Assign workload to agents to see progress.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {showStaffModal && (
        <div className="fixed inset-0 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1e293b] rounded-[2rem] w-full max-w-md overflow-hidden border border-slate-700 shadow-2xl animate-fade-in-up">
            <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 p-6 border-b border-white/5 flex items-center gap-4">
              <div className="bg-red-500/20 p-3 rounded-2xl text-red-400 shadow-inner">
                <Users size={24} />
              </div>
              <h2 className="text-2xl font-black text-white">{editingStaff ? 'Edit Agent Profile' : 'Create Agent'}</h2>
            </div>
            
            <form onSubmit={handleStaffFormSubmit} className="p-8">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">First Name</label>
                    <input type="text" required value={staffForm.firstName} onChange={e => setStaffForm({...staffForm, firstName: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none transition-all font-bold" placeholder="e.g. John"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Last Name</label>
                    <input type="text" required value={staffForm.lastName} onChange={e => setStaffForm({...staffForm, lastName: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none transition-all font-bold" placeholder="e.g. Doe"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Phone Number (Username)</label>
                  <input type="tel" required value={staffForm.phone} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none transition-all font-bold tracking-wider" placeholder="07XXXXXXXX"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Password {editingStaff && <span className="text-amber-400 text-[10px] ml-2">(Leave blank to keep unchanged)</span>}</label>
                  <input type="text" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none transition-all font-bold tracking-widest" placeholder={editingStaff ? "••••••••" : "Enter password"}/>
                </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowStaffModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl transition-all border border-slate-600">Cancel</button>
                <button type="submit" className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-[0_0_20px_rgba(147,51,234,0.4)] text-white font-black py-3.5 rounded-xl transition-all">
                  {editingStaff ? 'Save Changes' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delegate Social Media Task Modal */}
      <DelegateSocialMediaTaskModal 
        isOpen={isDelegateModalOpen} 
        onClose={() => setIsDelegateModalOpen(false)} 
        loggedInUser={loggedInUser} 
      />
    </div>
  );
}

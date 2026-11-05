import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../../api/axios'; 
import { resolveAvatarUrl } from '../../utils/avatarUtils';
import { FaSearch, FaUserCircle, FaUserPlus, FaFileImport, FaTimes, FaCheckSquare, FaEnvelopeOpenText, FaEnvelope, FaUserMinus, FaClock, FaLock, FaUserCheck, FaHeadset, FaHistory, FaCommentDots, FaLayerGroup, FaFilter, FaChartBar, FaWhatsapp, FaExchangeAlt, FaBan } from 'react-icons/fa';
import { FiPhoneIncoming, FiPhoneOutgoing, FiPhoneMissed } from 'react-icons/fi';
import toast from 'react-hot-toast';
import CustomSelect from '../common/CustomSelect';
import BusinessBadge from '../common/BusinessBadge';
import InboundMissedCallsReportModal from '../common/InboundMissedCallsReportModal';
import CallPermissionsWidget from '../common/CallPermissionsWidget';
import BlockedListModal from '../common/BlockedListModal';
import { useCall } from '../../contexts/CallContext';

export default function ContactSidebar({ activeMode, selectedLead, setSelectedLead, filters, onRedirectToCampaign }) {
  const { socket } = useCall?.() || {};
  const rawRole = JSON.parse(localStorage.getItem('user'))?.role || '';
  const userRole = rawRole.toUpperCase().replace(' ', '_');
  const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);
  const location = useLocation();
  const initialUrlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialSearch = initialUrlParams.get('search') || initialUrlParams.get('searchQuery') || '';
  const initialTab = initialUrlParams.get('tab') ? initialUrlParams.get('tab').toUpperCase() : (initialSearch ? 'ALL' : (isManager ? 'NEW' : 'ASSIGNED'));
  const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [callHistoryMode, setCallHistoryMode] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [activeCallTab, setActiveCallTab] = useState('INBOUND');
  const [availableBatches, setAvailableBatches] = useState([]);
  const [callBatchFilter, setCallBatchFilter] = useState(filters?.selectedBatch || '');
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callTabCounts, setCallTabCounts] = useState({ INBOUND: 0, OUTBOUND: 0, MISSED: 0, NEW_INQUIRY: 0 });
  const [tabCounts, setTabCounts] = useState({ NEW: 0, IMPORTED: 0, ASSIGNED: 0, ALL: 0 });
  const [unreadCounts, setUnreadCounts] = useState({ NEW: 0, IMPORTED: 0, ASSIGNED: 0, ALL: 0 });
  const [activeSessionLeadId, setActiveSessionLeadId] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false); 
  const [coordinators, setCoordinators] = useState([]);
  const [quickAssignStaffId, setQuickAssignStaffId] = useState('');
  const [assignTargetBatchId, setAssignTargetBatchId] = useState('');
  
  const [checkedLeads, setCheckedLeads] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [manualAssignStaffId, setManualAssignStaffId] = useState('');
  
  const [staffFilter, setStaffFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [autoAssignData, setAutoAssignData] = useState([]);
  const [masterToggle, setMasterToggle] = useState(true);
  const [csvFile, setCsvFile] = useState(null);

  const displayBatches = useMemo(() => {
      if (!availableBatches || !Array.isArray(availableBatches)) return [];
      if (filters?.selectedBusiness) {
          return availableBatches.filter(b => String(b.businessId) === String(filters.selectedBusiness));
      }
      return availableBatches;
  }, [availableBatches, filters?.selectedBusiness]);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch);

  useEffect(() => {
    if (filters?.selectedBatch !== undefined) {
      setCallBatchFilter(filters.selectedBatch || '');
    }
  }, [filters?.selectedBatch]);

  useEffect(() => {
    if (filters?.selectedBusiness) {
      const fetchBatches = async () => {
        try {
          const res = await axios.get(`/admin/batches/${filters.selectedBusiness}`);
          const batchList = Array.isArray(res.data) ? res.data : (res.data?.batches || []);
          setAvailableBatches(batchList);
        } catch (e) {
          try {
            const res2 = await axios.get('/admin/manager/batches-full');
            const filtered = (res2.data || []).filter(b => b.businessId === parseInt(filters.selectedBusiness));
            setAvailableBatches(filtered);
          } catch(err) {}
        }
      };
      fetchBatches();
    }
  }, [filters?.selectedBusiness]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchVal = params.get('search') || params.get('searchQuery');
    const tabVal = params.get('tab');
    if (tabVal) {
      setActiveTab(tabVal.toUpperCase());
    } else if (searchVal) {
      setActiveTab('ALL');
    }
    if (searchVal && searchVal !== searchQuery) {
      setSearchQuery(searchVal);
      setDebouncedSearchQuery(searchVal);
    }
  }, [location.search]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { phone, rawPhone, avatar } = e.detail || {};
      if (!avatar) return;
      setLeads(prevLeads => prevLeads.map(l => {
        const lClean = String(l.phone || '').split('_')[0].replace(/[^0-9]/g, '');
        const pClean = String(phone || '').split('_')[0].replace(/[^0-9]/g, '');
        const rawClean = String(rawPhone || '').split('_')[0].replace(/[^0-9]/g, '');
        const lRawClean = String(l.rawPhone || '').split('_')[0].replace(/[^0-9]/g, '');
        
        const isMatch = (pClean && lClean && (lClean.endsWith(pClean.slice(-9)) || pClean.endsWith(lClean.slice(-9)))) ||
                        (rawClean && lRawClean && (lRawClean.endsWith(rawClean.slice(-9)) || rawClean.endsWith(lRawClean.slice(-9))));
        if (isMatch) {
          return { ...l, avatar, image: avatar };
        }
        return l;
      }));
    };
    window.addEventListener('lead-avatar-updated', handleAvatarUpdate);
    return () => window.removeEventListener('lead-avatar-updated', handleAvatarUpdate);
  }, []);

  const formatDate = (dateString) => {
      if (!dateString) return '';
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + 
             d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds) => {
      if (!seconds) return '0s';
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
  };

  const fetchCalls = React.useCallback(async (silent = false) => {
      if (!filters?.selectedBusiness) return;
      if (!silent) setCallsLoading(true);
      try {
          const res = await axios.get('/admin/whatsapp-call/logs', { 
              params: { 
                  businessId: filters.selectedBusiness, 
                  batchId: callBatchFilter || filters?.selectedBatch || undefined,
                  callTab: activeCallTab 
              } 
          });
          if (res.data && res.data.logs) {
              setCalls(res.data.logs || []);
              if (res.data.counts) {
                  setCallTabCounts(res.data.counts);
              }
          } else if (Array.isArray(res.data)) {
              setCalls(res.data);
          }
      } catch (error) {
          if (!silent) toast.error("Failed to fetch call history");
      } finally {
          if (!silent) setCallsLoading(false);
      }
  }, [filters?.selectedBusiness, callBatchFilter, filters?.selectedBatch, activeCallTab]);

  useEffect(() => {
    if (callHistoryMode && filters?.selectedBusiness) {
        fetchCalls(false);

        const interval = setInterval(() => {
            fetchCalls(true);
        }, 8000);

        if (socket) {
            const handleUpdate = () => fetchCalls(true);
            socket.on('call_history_updated', handleUpdate);
            socket.on('whatsapp_call_disconnected', handleUpdate);
            socket.on('incoming_wa_call', handleUpdate);
            socket.on('whatsapp_call_answered_by_other', handleUpdate);

            return () => {
                clearInterval(interval);
                socket.off('call_history_updated', handleUpdate);
                socket.off('whatsapp_call_disconnected', handleUpdate);
                socket.off('incoming_wa_call', handleUpdate);
                socket.off('whatsapp_call_answered_by_other', handleUpdate);
            };
        }

        return () => clearInterval(interval);
    }
  }, [callHistoryMode, fetchCalls, socket, filters?.selectedBusiness]);
  const [assigneeGroup, setAssigneeGroup] = useState('COORDINATOR');
  const [ccStatus, setCcStatus] = useState('PENDING');
  const [ccStaff, setCcStaff] = useState([]);
  const [ccCounts, setCcCounts] = useState({ PENDING: 0, APPROVED: 0 });
  
  // 🔥 LOAD MORE STATE 🔥
  const [visibleCount, setVisibleCount] = useState(50);

  // 🔥 24-Hour Timer Auto Refresh 🔥
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000); 
      return () => clearInterval(timer);
  }, []);

  // 🔥 Reset visible count when tab or search changes 🔥
  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, debouncedSearchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchLeads = async (showLoading = true) => {
    // 🔥 STRICT BLOCKER: Business eka thoranakam backend ekata call yanne na 🔥
    if (isManager && (!filters || !filters.selectedBusiness)) {
        setLeads([]);
        setTabCounts({ NEW: 0, IMPORTED: 0, ASSIGNED: 0, ALL: 0 });
        setLoading(false);
        return;
    }

    if (showLoading) setLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/coordinator-crm/leads`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
                tab: activeTab, 
                campaignType: 'FREE_SEMINAR', 
                staffPhase: phaseFilter, 
                status: statusFilter, 
                staffId: staffFilter,
                loggedUserRole: rawRole,
                businessId: filters?.selectedBusiness || '', 
                batchId: (debouncedSearchQuery && activeTab === 'ALL') ? '' : (filters?.selectedBatch || ''),
                searchQuery: debouncedSearchQuery,
                assigneeGroup,
                ccStatus
            }
        });

      let fetchedLeads = response.data.leads || [];
      if (activeTab === 'NEW') {
          if (!isManager) fetchedLeads = fetchedLeads.filter(l => l.assignedTo === parseInt(currentUserId));
          else fetchedLeads = fetchedLeads.filter(l => l.assignedTo === null);
      } else if (activeTab === 'ASSIGNED') {
          if (assigneeGroup === 'COORDINATOR') {
              fetchedLeads = fetchedLeads.filter(l => l.assignedTo !== null);
          } else if (assigneeGroup === 'CALL_CENTER') {
              fetchedLeads = fetchedLeads.filter(l => l.isCallCenter === true);
          }
      }
      
      setLeads(fetchedLeads);
      setTabCounts(response.data.counts || {});
      setUnreadCounts(response.data.unreadCounts || { NEW: 0, IMPORTED: 0, ASSIGNED: 0, ALL: 0 });
      setTotalUnread(response.data.totalUnread || 0);
      setCcCounts({
          PENDING: response.data.ccPendingCount || 0,
          APPROVED: response.data.ccApprovedCount || 0
      });
    } catch (error) {
        if(showLoading) toast.error("Failed to load leads"); 
    }
    if (showLoading) setLoading(false);
  };

  const fetchCoordinatorsAndQuotas = async () => {
    if (isManager && (!filters || !filters.selectedBusiness)) {
        setCoordinators([]);
        setAutoAssignData([]);
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const [staffRes, quotaRes, bizRes, ccStaffRes] = await Promise.all([ 
          axios.get('/admin/staff', { headers: { Authorization: `Bearer ${token}` } }), 
          axios.get('/coordinator-crm/leads/auto-assign-quotas', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/call-center/manager/staff', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setCcStaff(ccStaffRes.data || []);
      
      let coords = staffRes.data.filter(s => 
          s?.role && ['COORDINATOR', 'CALLER', 'STAFF', 'MANAGER'].includes(s?.role.toUpperCase())
      );
          
      if (filters?.selectedBusiness) {
          const selectedBizObj = bizRes.data.find(b => String(b.id) === String(filters.selectedBusiness));
          const bizName = selectedBizObj ? selectedBizObj.name : '';

          coords = coords.filter(c => {
              const cBizList = String(c.businessType || '').toLowerCase().split(',').map(b => b.trim());
              const selBizId = String(filters.selectedBusiness).toLowerCase().trim();
              const selBizName = String(bizName).toLowerCase().trim();
              
              return cBizList.includes('all') || cBizList.includes(selBizId) || cBizList.some(biz => biz.includes(selBizName)) || String(c.businessId) === String(filters.selectedBusiness);
          });
      }
      
      setCoordinators(coords);

      const merged = coords.map(c => {
        const q = quotaRes.data.find(x => x.staffId === c.id);
        return { staffId: c.id, name: `${c.firstName} (${c.role})`, quotaAmount: q ? q.quotaAmount : 0, isActive: q ? q.isActive : false };
      });
      setAutoAssignData(merged);
    } catch (error) { console.error("Data load error", error); }
  };

  useEffect(() => { fetchCoordinatorsAndQuotas(); }, [filters?.selectedBusiness, filters?.selectedBatch]);


  const fetchBlockedCount = async () => {
      try {
          const token = localStorage.getItem('token');
          const res = await axios.get('/coordinator-crm/leads/blocked-list', {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (Array.isArray(res.data)) {
              setBlockedCount(res.data.length);
          }
      } catch (e) {}
  };

  useEffect(() => { 
      fetchLeads(true); 
      fetchBlockedCount();
      setCheckedLeads([]); 
      const interval = setInterval(() => { fetchLeads(false); }, 60000);

      let handleSocketUpdate;
      let handleLeadBlocked;
      let handleLeadUnblocked;

      if (socket) {
          handleSocketUpdate = () => fetchLeads(false);

          handleLeadBlocked = (data) => {
              if (data?.phone) {
                  const phoneSuffix = String(data.phone).replace(/[^0-9]/g, '').slice(-9);
                  if (selectedLead) {
                      const selSuffix = String(selectedLead.phone || '').replace(/[^0-9]/g, '').slice(-9);
                      if (selSuffix === phoneSuffix || selectedLead.id === data.leadId) {
                          setSelectedLead(null);
                      }
                  }
              }
              fetchBlockedCount();
              fetchLeads(false);
          };

          handleLeadUnblocked = () => {
              fetchBlockedCount();
              fetchLeads(false);
          };

          socket.on('lead_updated', handleSocketUpdate);
          socket.on('lead_blocked', handleLeadBlocked);
          socket.on('lead_unblocked', handleLeadUnblocked);
          socket.on('new_inbound_message', handleSocketUpdate);
      }

      return () => {
          clearInterval(interval);
          if (socket) {
              if (handleSocketUpdate) socket.off('lead_updated', handleSocketUpdate);
              if (handleLeadBlocked) socket.off('lead_blocked', handleLeadBlocked);
              if (handleLeadUnblocked) socket.off('lead_unblocked', handleLeadUnblocked);
              if (handleSocketUpdate) socket.off('new_inbound_message', handleSocketUpdate);
          }
      };
  }, [activeTab, staffFilter, phaseFilter, statusFilter, filters?.selectedBusiness, filters?.selectedBatch, assigneeGroup, ccStatus, debouncedSearchQuery, socket]);

  const handleSelectAll = () => {
    if (checkedLeads.length === leads.length) setCheckedLeads([]); else setCheckedLeads(leads.map(l => l.id));
  };

  // 🔥 ACTION DISPATCHERS 🔥
  const handleBulkAction = async (action, assignStaffId = null, specificLeads = null, targetBatchId = null) => {
    const leadsToProcess = specificLeads || checkedLeads;
    if (leadsToProcess.length === 0) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('/coordinator-crm/leads/bulk-action', { 
          action, 
          leadIds: leadsToProcess, 
          staffId: assignStaffId,
          batchId: targetBatchId 
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Action applied successfully!");
      if (!specificLeads) {
          setCheckedLeads([]);
          setQuickAssignStaffId('');
      }
      fetchLeads(true);
    } catch (e) { toast.error(e.response?.data?.error || "Action failed"); }
  };

  const handleHandOverToCallCenter = async () => {
    if (checkedLeads.length === 0) return toast.error("Please select leads to hand over");
    try {
      const token = localStorage.getItem('token');
      await axios.post('/call-center/request-transfer', { leadIds: checkedLeads }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Successfully requested handover to call center!");
      setCheckedLeads([]);
      fetchLeads(true);
    } catch (e) {
      toast.error("Failed to hand over leads");
    }
  };

  
  const handleAssignSubmit = async (e, type) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (type === 'bulk') {
        if (!manualAssignStaffId) return toast.error("Please select a staff member to assign");
        await axios.post('/coordinator-crm/leads/assign', { 
            type: 'bulk', 
            count: e.target.count.value, 
            sort: e.target.sort.value, 
            staffId: manualAssignStaffId,
            batchId: assignTargetBatchId || filters?.selectedBatch,
            businessId: filters?.selectedBusiness
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post('/coordinator-crm/leads/assign', { type: 'auto', autoAssignConfig: autoAssignData }, { headers: { Authorization: `Bearer ${token}` } });
      }
      toast.success("Assignment rules saved!");
      setShowAssignModal(false); 
      setAssignTargetBatchId('');
      fetchLeads(true);
    } catch (error) { toast.error(error.response?.data?.error || "Assignment Failed"); }
  };

  const handleBulkImport = () => {
    if (!filters?.selectedBatch) return toast.error("⚠️ Please select a Batch from the top right dropdown first!");
    if (!csvFile) return toast.error("Please select a CSV file first!");
    const reader = new FileReader();
    reader.onload = async (evt) => {
        const text = evt.target.result;
        const rows = text.split('\n');
        let leadsList = [];
        rows.forEach(row => {
            const cols = row.split(',');
            if (cols[0] && cols[0].trim() !== '') leadsList.push({ number: cols[0].trim(), name: cols[1] ? cols[1].trim() : '' });
        });
        if (leadsList.length === 0) return toast.error("No valid data found in CSV");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/coordinator-crm/leads/import', { 
                isBulk: true, 
                leadsList, 
                batchId: filters.selectedBatch,
                businessId: filters.selectedBusiness
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(`${leadsList.length} Leads Imported!`);
            setShowImportModal(false); setCsvFile(null); fetchLeads(true);
        } catch (error) { toast.error("Bulk import failed!"); }
    };
    reader.readAsText(csvFile);
  };

  const handleLeadClick = async (lead) => {
      setSelectedLead(lead);
      if (lead.unreadCount > 0) {
          setActiveSessionLeadId(lead.id);
          setLeads(prevLeads => prevLeads.map(l => l.id === lead.id ? { ...l, unreadCount: 0 } : l));
          try {
              const token = localStorage.getItem('token');
              await axios.post('/coordinator-crm/leads/bulk-action', { action: 'MARK_READ', leadIds: [lead.id] }, { headers: { Authorization: `Bearer ${token}` } });
          } catch (e) {
              console.error("Failed to mark as read in DB");
          }
      } else {
          setActiveSessionLeadId(null);
      }
  };

  // 🔥 OPTIMIZED SEARCH & SESSION PINNING 🔥
  const filteredLeads = useMemo(() => {
      let currentLeads = leads.filter(lead => !lead.isBlocked && lead.status !== 'BLOCKED');

      if (searchQuery) {
          const q = String(searchQuery).toLowerCase().trim();
          currentLeads = currentLeads.filter(lead => {
              const phoneMatch = lead.phone ? String(lead.phone).toLowerCase().includes(q) : false;
              const nameMatch = lead.name ? String(lead.name).toLowerCase().includes(q) : false;
              return phoneMatch || nameMatch;
          });
      }
      
      // If an unread chat is currently active in this session, keep it pinned on top
      // When the user opens the NEXT chat, activeSessionLeadId changes/clears, and the previous chat drops below unread chats!
      if (activeSessionLeadId) {
          const activeLead = currentLeads.find(l => l.id === activeSessionLeadId);
          if (activeLead) {
              const otherUnread = currentLeads.filter(l => l.id !== activeSessionLeadId && l.unreadCount > 0);
              const otherRead = currentLeads.filter(l => l.id !== activeSessionLeadId && l.unreadCount === 0);
              return [activeLead, ...otherUnread, ...otherRead];
          }
      }

      return currentLeads;
  }, [leads, searchQuery, activeSessionLeadId]);

  // 🔥 LOAD MORE LOGIC 🔥
  const displayedLeads = filteredLeads.slice(0, visibleCount);

  const tabs = [
    { id: 'NEW', label: 'New', total: tabCounts.NEW, unread: unreadCounts.NEW },
    { id: 'IMPORTED', label: 'Import', total: tabCounts.IMPORTED, unread: unreadCounts.IMPORTED },
    { id: 'ASSIGNED', label: 'Assigned', total: tabCounts.ASSIGNED, unread: unreadCounts.ASSIGNED },
    { id: 'ALL', label: 'All', total: tabCounts.ALL, unread: unreadCounts.ALL }
  ];

  const callTabs = [
    { id: 'INBOUND', label: 'Inbound', count: callTabCounts.INBOUND },
    { id: 'OUTBOUND', label: 'Outbound', count: callTabCounts.OUTBOUND },
    { id: 'MISSED', label: 'Missed', count: callTabCounts.MISSED },
    { id: 'NEW_INQUIRY', label: 'New Inq', count: callTabCounts.NEW_INQUIRY }
  ];

  const getStatusIcon = (status, direction) => {
      if (status === 'MISSED' || status === 'REJECTED' || status === 'NO_ANSWER') {
          return <div className="p-2 bg-red-500/20 text-red-400 rounded-lg"><FiPhoneMissed size={16} /></div>;
      }
      if (direction === 'INBOUND') {
          return <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><FiPhoneIncoming size={16} /></div>;
      }
      return <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><FiPhoneOutgoing size={16} /></div>;
  };

  const displayedCalls = useMemo(() => {
    if (!searchQuery) return calls;
    const q = searchQuery.toLowerCase().trim();
    return calls.filter(c => {
      const phoneMatch = c.leadPhone && String(c.leadPhone).toLowerCase().includes(q);
      const nameMatch = c.leadName && String(c.leadName).toLowerCase().includes(q);
      const batchMatch = c.batchName && String(c.batchName).toLowerCase().includes(q);
      return phoneMatch || nameMatch || batchMatch;
    });
  }, [calls, searchQuery]);

  const handleOpenChat = async (call) => {
      try {
          let phoneRaw = call.leadPhone || '';
          let cleanPhone = phoneRaw.replace(/[^0-9]/g, '');
          let localPhone = cleanPhone.startsWith('94') ? '0' + cleanPhone.substring(2) : cleanPhone;

          let targetLead = call.lead;

          // If lead object isn't already populated with an id, resolve or create it via backend
          if (!targetLead || !targetLead.id) {
              const token = localStorage.getItem('token');
              const res = await axios.post('/coordinator-crm/leads/resolve', {
                  phone: phoneRaw,
                  name: call.leadName || 'Inquiry Contact',
                  businessId: filters?.selectedBusiness || call.businessId,
                  batchId: filters?.selectedBatch || call.batchId,
                  campaignType: call.campaignType || (call.isNewInquiry ? 'NEW_INQ' : 'FREE_SEMINAR')
              }, { headers: { Authorization: `Bearer ${token}` } });

              if (res.data?.success && res.data.lead) {
                  targetLead = res.data.lead;
              }
          }

          if (targetLead) {
              // Ensure lead exists in our local leads array
              setLeads(prev => {
                  const exists = prev.some(l => l.id === targetLead.id);
                  if (exists) {
                      return prev.map(l => l.id === targetLead.id ? { ...l, ...targetLead } : l);
                  }
                  return [targetLead, ...prev];
              });

              // Switch directly to contacts view, clear search filter, and select the lead to open chat
              setCallHistoryMode(false);
              setSearchQuery('');
              setSelectedLead(targetLead);
              toast.success(`Chat opened with ${targetLead.name || targetLead.phone || localPhone}`);
          }
      } catch (error) {
          console.error("Error opening chat from call history:", error);
          toast.error("Failed to open chat");
      }
  };

  return (
    <div className="w-[380px] xl:w-[440px] bg-[#1a2430] rounded-3xl flex flex-col overflow-hidden shrink-0 border border-white/10 shadow-2xl relative">
      {checkedLeads.length > 0 ? (
        <div className="p-3.5 bg-[#082015] border-b border-emerald-500/40 flex flex-col gap-2.5 relative z-30 shadow-lg">
          <div className="flex justify-between items-center text-white">
            <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
              <FaCheckSquare className="text-emerald-400" /> {checkedLeads.length} Lead{checkedLeads.length > 1 ? 's' : ''} Selected
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleSelectAll} 
                title="Select All" 
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md text-white text-[10px] font-bold transition-all flex items-center gap-1"
              >
                <FaCheckSquare size={10} /> Select All
              </button>
              <button 
                onClick={() => setCheckedLeads([])} 
                title="Clear Selection"
                className="p-1 bg-white/10 hover:bg-red-500/80 rounded-md text-white/80 hover:text-white transition-all"
              >
                <FaTimes size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
             <button 
               onClick={() => handleBulkAction('MARK_READ')} 
               title="Mark as Read" 
               className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-all"
             >
               <FaEnvelopeOpenText size={12} />
             </button>
             <button 
               onClick={() => handleBulkAction('MARK_UNREAD')} 
               title="Mark as Unread" 
               className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-all"
             >
               <FaEnvelope size={12} />
             </button>

             <button 
               onClick={() => handleBulkAction('CONVERT_TO_NEW_INQ')} 
               title="Convert Selected to New Inquiry (Moves assigned leads to New Inquiry Call Campaign)" 
               className="px-2 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition-all"
             >
               <FaExchangeAlt size={10} /> To New Inq
             </button>
             <button 
               onClick={() => handleBulkAction('CONVERT_TO_OPEN_SEM')} 
               title="Convert Selected to Open Seminar (Moves assigned leads to Open Seminar Call Campaign)" 
               className="px-2 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition-all"
             >
               <FaExchangeAlt size={10} /> To Open Sem
             </button>

             <button 
               onClick={handleHandOverToCallCenter} 
               title="Allocate / Handover to Call Center" 
               className="px-2.5 py-1.5 bg-orange-600/80 hover:bg-orange-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow transition-all"
             >
               <FaHeadset size={11} /> Call Center
             </button>

             {isManager && (
                <>
                   <button 
                     onClick={() => setShowAssignModal(true)} 
                     title="Open Bulk Assign Modal" 
                     className="px-2.5 py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow transition-all"
                   >
                      <FaUserPlus size={11} /> Bulk Modal
                   </button>
                   <button 
                     onClick={() => handleBulkAction('UNASSIGN')} 
                     title="Unassign Leads" 
                     className="p-1.5 bg-red-500/20 hover:bg-red-500 rounded-lg text-red-300 hover:text-white text-xs transition-all"
                   >
                     <FaUserMinus size={12} />
                   </button>
                </>
             )}
          </div>

          {/* Quick Staff Assign & Batch Allocation for Selected Leads */}
          {isManager && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20">
              <div className="w-full">
                <CustomSelect 
                    value={quickAssignStaffId}
                    onChange={(e) => {
                        const staffVal = e.target.value;
                        setQuickAssignStaffId(staffVal);
                        if (staffVal) {
                            handleBulkAction('ASSIGN', staffVal);
                        }
                    }}
                    className="w-full text-xs"
                    placeholder="Assign to Staff..."
                    options={[
                        { value: '', label: 'Assign to Staff...' },
                        ...coordinators.filter(c => c).map(c => ({
                            value: c.id, 
                            label: <div className="flex items-center gap-1 text-[11px]">{c.firstName} ({c.role === 'CALLER' ? 'Team' : 'Staff'}) <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                        })),
                        ...ccStaff.filter(c => c).map(c => ({
                            value: c.id,
                            label: <div className="flex items-center gap-1 text-[11px]">{c.firstName} (Call Center) <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                        }))
                    ]}
                />
              </div>

              <div>
                <select 
                    value=""
                    onChange={(e) => {
                        const targetBatch = e.target.value;
                        if (targetBatch) {
                            handleBulkAction('ASSIGN_BATCH', null, null, targetBatch);
                        }
                    }}
                    className="w-full bg-[#0f172a] border border-slate-700 hover:border-emerald-500 text-slate-300 rounded-xl p-2 text-xs outline-none focus:border-emerald-500 font-medium transition-colors"
                >
                    <option value="">Allocate to Batch...</option>
                    {displayBatches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 border-b border-white/10 bg-[#161f2c]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              {callHistoryMode ? (
                <>
                  <FaHistory className="text-indigo-400" /> CALL HISTORY
                </>
              ) : (
                'CONTACTS'
              )}
            </h2>
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowReportModal(true)} 
                  title="CRM Call & Permission Analytics Report"
                  className="p-2.5 rounded-xl border transition-all bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/30"
                >
                  <FaChartBar size={16}/>
                </button>
                <button 
                  onClick={() => setShowBlockedModal(true)} 
                  title="Blocked Numbers List"
                  className="p-2.5 rounded-xl border transition-all bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border-rose-500/30 relative shadow-sm"
                >
                  <FaBan size={16}/>
                  {blockedCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
                      {blockedCount}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setCallHistoryMode(!callHistoryMode)} 
                  title={callHistoryMode ? "Switch to Contacts" : "Switch to Call History"}
                  className={`p-2.5 rounded-xl border transition-all ${
                    callHistoryMode 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' 
                      : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-500/30'
                  }`}
                >
                  <FaHistory size={16}/>
                </button>
                <button onClick={() => setShowImportModal(true)} className="p-2.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-500/30 transition-all"><FaFileImport size={16}/></button>
              
              {isManager && (
                 <button onClick={() => setShowAssignModal(true)} className="p-2.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-500/30 transition-all"><FaUserPlus size={16}/></button>
              )}
            </div>
          </div>
          
          <div className="relative mb-3">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={callHistoryMode ? "Search calls by number, name or batch..." : "Search by number or name..."} 
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 shadow-inner" 
            />
          </div>
          
          <div className="flex justify-between items-center bg-[#0f172a] p-1 rounded-xl border border-slate-800 gap-1">
            {callHistoryMode ? (
              callTabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveCallTab(tab.id)} className={`relative flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${activeCallTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  <span className="text-[11px] font-bold tracking-widest uppercase">{tab.label}</span>
                  <span className="text-[9px] font-medium opacity-70 mt-0.5">Total: {tab.count ?? 0}</span>
                </button>
              ))
            ) : (
              tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  <span className="text-[11px] font-bold tracking-widest uppercase">{tab.label}</span>
                  <span className="text-[9px] font-medium opacity-60 mt-0.5">Total: {tab.total || 0}</span>
                  {tab.unread > 0 && <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-md">{tab.unread}</span>}
                </button>
              ))
            )}
          </div>

          {!callHistoryMode && activeTab === 'ASSIGNED' && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-800 gap-1">
                <button onClick={() => setAssigneeGroup('COORDINATOR')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${assigneeGroup === 'COORDINATOR' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Coordinators</button>
                <button onClick={() => setAssigneeGroup('CALL_CENTER')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${assigneeGroup === 'CALL_CENTER' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Call Center</button>
              </div>

              {assigneeGroup === 'COORDINATOR' && isManager && (
                <div className="grid grid-cols-3 gap-2">
                  <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500">
                    <option value="">Staff: All</option>
                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.firstName}</option>)}
                  </select>
                  <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500">
                    <option value="">Phase: All</option>
                    <option value="1">Phase 1</option>
                    <option value="2">Phase 2</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500">
                    <option value="">Status: All</option>
                    <option value="pending">Pending</option>
                    <option value="answered">Answered</option>
                    <option value="no_answer">No Answer</option>
                  </select>
                </div>
              )}

              {assigneeGroup === 'CALL_CENTER' && (
                <>
                  <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-800 gap-1">
                    <button onClick={() => setCcStatus('PENDING')} className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${ccStatus === 'PENDING' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      Pending ({ccCounts.PENDING})
                    </button>
                    <button onClick={() => setCcStatus('APPROVED')} className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${ccStatus === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      Approved ({ccCounts.APPROVED})
                    </button>
                  </div>
                  {isManager && (
                    <div className="grid grid-cols-3 gap-2">
                      <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500">
                        <option value="">Staff: All</option>
                        {ccStaff.map(s => <option key={s.id} value={s.id}>{s.firstName}</option>)}
                      </select>
                      <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500">
                        <option value="">Phase: All</option>
                        <option value="1">Phase 1</option>
                        <option value="2">Phase 2</option>
                      </select>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500">
                        <option value="">Status: All</option>
                        <option value="pending">Pending</option>
                        <option value="answered">Answered</option>
                        <option value="no_answer">No Answer</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!callHistoryMode && activeTab === 'NEW' && isManager && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500">
                  <option value="">Phase: All</option>
                  <option value="1">Phase 1</option>
                  <option value="2">Phase 2</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-500">
                  <option value="">Status: All</option>
                  <option value="pending">Pending</option>
                  <option value="answered">Answered</option>
                  <option value="no_answer">No Answer</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEAD LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative p-3">
        {loading || callsLoading ? (
           <div className="flex justify-center items-center py-10">
             <div className="w-8 h-8 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
           </div>
        ) : callHistoryMode ? (
           displayedCalls.length === 0 ? ( <div className="text-center text-slate-600 text-sm mt-10 font-medium">No calls found in the history.</div> ) : (
             <div className="space-y-2.5">
                 {displayedCalls.map(call => {
                     const clean = (call.leadPhone || '').replace(/[^0-9]/g, '');
                     const formattedPhone = clean.startsWith('94') ? '0' + clean.substring(2) : clean;
                     return (
                         <div 
                             key={call.id} 
                             onClick={() => handleOpenChat(call)}
                             className="group flex flex-col p-3 bg-[#121a24] hover:bg-[#1e293b] rounded-2xl border border-white/5 hover:border-indigo-500/50 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/10 relative overflow-hidden"
                         >
                             <div className="flex items-start justify-between gap-2 mb-2">
                                 <div className="flex items-center gap-2.5 min-w-0">
                                     {getStatusIcon(call.status, call.direction)}
                                     <div className="min-w-0">
                                         {call.leadName ? (
                                             <h4 className="font-bold text-[14px] text-white truncate group-hover:text-indigo-300 transition-colors">
                                                 {call.leadName}
                                             </h4>
                                         ) : null}
                                         <div className="font-bold text-slate-300 text-[13px] tracking-wide flex items-center gap-1.5">
                                             <span>{formattedPhone}</span>
                                         </div>
                                     </div>
                                 </div>
                                 
                                 <div className="flex flex-col items-end shrink-0 gap-1">
                                     <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                         call.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                         call.status === 'MISSED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                         'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                     }`}>
                                         {call.status}
                                     </span>
                                     {call.duration > 0 && (
                                         <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                             {formatDuration(call.duration)}
                                         </span>
                                     )}
                                 </div>
                             </div>

                             {/* Date & Time Row */}
                             <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-2 bg-[#090d12]/60 px-2.5 py-1 rounded-lg border border-white/5">
                                 <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                                     <FaClock size={11} className="text-slate-400" />
                                     <span>{formatDate(call.createdAt)}</span>
                                 </div>
                                 {call.agent?.firstName && (
                                     <span className="text-[10px] text-indigo-300 font-semibold truncate max-w-[120px]">
                                         👤 {call.agent.firstName}
                                     </span>
                                 )}
                             </div>

                             <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                                 <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                     {call.batchName ? (
                                         <span className="bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[160px] flex items-center gap-1">
                                             <FaLayerGroup size={10} className="shrink-0 text-indigo-400" />
                                             <span className="truncate">{call.batchName}</span>
                                         </span>
                                     ) : (
                                         <span className="text-[10px] text-slate-500 italic">No Batch</span>
                                     )}
                                 </div>
                                 
                                 <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                                     <FaCommentDots size={13}/>
                                     <span>Open Chat</span>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>
           )
        ) : filteredLeads.length === 0 ? ( <div className="text-center text-slate-600 text-sm mt-10 font-medium">No contacts found.</div> ) : (
          <div className="space-y-2">
            {displayedLeads.map(lead => {
                
              // 🔥 24-Hour Active Window Logic 🔥
              const leadTime = new Date(lead.lastMessageAt || lead.updatedAt || lead.createdAt);
              const hoursPassed = (currentTime.getTime() - leadTime.getTime()) / (1000 * 60 * 60);

              let overlayClass = 'bg-[#121a24] border-transparent hover:border-white/10'; // Default
              let timeIcon = null;

              if (hoursPassed >= 24) {
                  overlayClass = 'bg-red-900/20 border-red-500/30 hover:border-red-500/50'; 
                  timeIcon = <span className="text-[9px] text-red-400 font-bold flex items-center gap-1"><FaClock/> Expired</span>;
              } else if (hoursPassed >= 20) {
                  overlayClass = 'bg-yellow-900/20 border-yellow-500/30 hover:border-yellow-500/50'; 
                  timeIcon = <span className="text-[9px] text-yellow-400 font-bold flex items-center gap-1"><FaClock/> Expiring Soon</span>;
              } else {
                  overlayClass = 'bg-emerald-900/20 border-emerald-500/30 hover:border-emerald-500/50'; 
                  timeIcon = <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><FaCheckSquare/> Active Window</span>;
              }

              if (selectedLead?.id === lead.id) {
                  overlayClass = 'bg-[#0f172a] border-blue-500 shadow-md shadow-blue-500/20';
              }

              return (
              <div key={lead.id} className={`p-3 rounded-2xl mb-2 transition-all flex gap-3 items-center border ${overlayClass}`}>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                   <input type="checkbox" checked={checkedLeads.includes(lead.id)} onChange={(e) => { if (e.target.checked) setCheckedLeads([...checkedLeads, lead.id]); else setCheckedLeads(checkedLeads.filter(id => id !== lead.id)); }} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => handleLeadClick(lead)}>
                  <img 
                    src={resolveAvatarUrl([lead.image, lead.avatar], lead.phone, axios.defaults.baseURL)} 
                    alt="DP" 
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-700/60 shadow-sm"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = resolveAvatarUrl(null, lead.phone, axios.defaults.baseURL);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      
                      <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[15px] text-slate-200 leading-none">{lead.phone}</h4>
                              {lead.isBlocked && (
                                  <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5" title={`Blocked: ${lead.blockedReason || 'No reason specified'}`}>
                                      <FaBan size={9} /> BLOCKED
                                  </span>
                              )}
                              {lead.unreadCount > 0 && (
                                  <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 rounded-full shadow-md shadow-red-500/40">
                                      {lead.unreadCount}
                                  </span>
                              )}
                          </div>
                          
                          {lead.assignedUser ? (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                  <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">👤 {lead.assignedUser.firstName} {lead.assignedUser.lastName} <BusinessBadge businessType={lead.assignedUser.businessType} role={lead.assignedUser.role} /></span>
                                  {lead.isCallCenter && <span className="text-[9px] w-max bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Call Center</span>}
                              </div>
                          ) : (
                              <div className="flex flex-col gap-1 mt-1">
                                  {lead.isCallCenter && <span className="text-[9px] w-max bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Call Center</span>}
                                  {!lead.assignedTo && (
                                      <button onClick={(e) => { e.stopPropagation(); handleBulkAction('ASSIGN', currentUserId, [lead.id]); }} className="text-[9px] w-max bg-emerald-600/80 hover:bg-emerald-500 text-white px-2 py-1 rounded shadow-md flex items-center gap-1 transition-all">
                                         <FaUserCheck size={10}/> Assign to me
                                      </button>
                                  )}
                              </div>
                          )}
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0 ml-2 gap-1.5">
                          <div className="text-right">
                              <span className="text-[10px] text-emerald-500 font-bold block mb-0.5">{new Date(lead.lastMessageAt || lead.updatedAt).toLocaleDateString('en-GB')}</span>
                              <span className="text-[9px] text-slate-500 block">{new Date(lead.lastMessageAt || lead.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          {onRedirectToCampaign && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onRedirectToCampaign(lead); }}
                                className="mt-1 text-[10px] bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-400 border border-blue-500/30 px-2 py-1 rounded-md transition-all flex items-center gap-1 font-bold shadow-md"
                                title="Open in Campaign"
                              >
                                  <FaHeadset size={10} /> Campaign
                              </button>
                          )}
                      </div>
                    </div>


                    <div className="flex justify-between items-end mt-1">
                      <p className="text-[11px] font-medium text-slate-500 truncate w-[60%]">{lead.lastMessage || 'No messages'}</p>
                      <div className="flex flex-col items-end gap-1">
                          {timeIcon}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )})}
            
            {/* 🔥 LOAD MORE BUTTON 🔥 */}
            {filteredLeads.length > visibleCount && (
                <div className="flex justify-center mt-4 mb-2">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 50)} 
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold py-2 px-6 rounded-full transition-colors shadow-lg"
                    >
                        Load More Leads
                    </button>
                </div>
            )}
          </div>
        )}
      </div>

      {/* ASSIGN MODAL */}
      {showAssignModal && isManager && (
         <div className="absolute inset-0 z-50 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a2430] border border-slate-700 rounded-3xl p-5 w-[90%] shadow-2xl max-h-[90%] overflow-y-auto custom-scrollbar">
               <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaUserPlus className="text-emerald-500"/> Assign Leads</h3>
                  <button onClick={()=>setShowAssignModal(false)} className="text-slate-500 hover:text-white"><FaTimes/></button>
               </div>
               
               <form onSubmit={(e) => handleAssignSubmit(e, 'bulk')} className="bg-[#121a24] p-4 rounded-xl border border-slate-800 mb-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-widest">Manual Assign</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sort Order</label>
                        <select name="sort" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none">
                           <option value="newest">Newest First</option>
                           <option value="oldest">Oldest First</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Lead Count</label>
                        <input name="count" type="number" placeholder="Lead Count" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none" />
                     </div>
                     <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Target Batch (Optional)</label>
                        <select 
                             value={assignTargetBatchId} 
                             onChange={(e) => setAssignTargetBatchId(e.target.value)}
                             className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                         >
                             <option value="">Filter/Assign by Batch (Optional)...</option>
                             {displayBatches.map(b => (
                                 <option key={b.id} value={b.id}>{b.name}</option>
                             ))}
                         </select>
                     </div>
                  </div>
                  <div className="mb-3">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Coordinator / Call Center Staff</label>
                     <CustomSelect 
                         value={manualAssignStaffId}
                         onChange={(e) => setManualAssignStaffId(e.target.value)}
                         className="w-full"
                         placeholder="Select Coordinator / Team..."
                         options={[
                             { value: '', label: 'Select Coordinator / Team...' },
                             ...coordinators.filter(c => c).map(c => ({
                                 value: c.id, 
                                 label: <div className="flex items-center gap-1.5">{c.firstName} ({c.role === 'CALLER' ? 'Team' : 'Staff'}) <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                             })),
                             ...ccStaff.filter(c => c).map(c => ({
                                 value: c.id,
                                 label: <div className="flex items-center gap-1.5">{c.firstName} (Call Center) <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                             }))
                         ]}
                     />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest transition-colors">Assign Selected Leads</button>
               </form>

               <form onSubmit={(e) => handleAssignSubmit(e, 'auto')} className="bg-[#121a24] p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Auto Assign</h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={masterToggle} onChange={()=>setMasterToggle(!masterToggle)} />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                     {autoAssignData.map((staff, idx) => (
                        <div key={staff.staffId} className="flex items-center justify-between bg-[#1a2430] p-2 rounded-lg border border-slate-700">
                           <div className="flex items-center gap-2">
                              <input type="checkbox" checked={staff.isActive} onChange={(e) => {
                                    let newData = [...autoAssignData]; newData[idx].isActive = e.target.checked; setAutoAssignData(newData);
                              }} className="accent-blue-600"/>
                              <span className="text-xs font-bold text-slate-300 truncate w-32">{staff.name}</span>
                           </div>
                           <input type="number" value={staff.quotaAmount} onChange={(e) => {
                                 let newData = [...autoAssignData]; newData[idx].quotaAmount = parseInt(e.target.value) || 0; setAutoAssignData(newData);
                           }} className="w-16 bg-[#0f172a] border border-slate-600 text-center text-white rounded p-1 text-xs outline-none" placeholder="Quota"/>
                        </div>
                     ))}
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-widest">Save Settings</button>
               </form>
            </div>
         </div>
      )}

      {/* IMPORT MODAL WITH CSV UPLOAD */}
      {showImportModal && (
         <div className="absolute inset-0 z-50 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-[#1a2430] border border-slate-700 rounded-2xl p-5 w-full shadow-2xl">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaFileImport className="text-blue-500"/> Import Leads</h3>
                  <button onClick={()=>setShowImportModal(false)} className="text-slate-500 hover:text-white"><FaTimes/></button>
               </div>
               
               <div className="bg-[#121a24] p-4 rounded-xl border border-slate-800 mb-3">
                  <h4 className="text-sm font-bold text-blue-400 mb-1">Bulk Import (CSV)</h4>
                  <p className="text-[10px] text-slate-500 mb-3">Upload a CSV file. Format: Column 1 = Phone, Column 2 = Name (Optional).</p>
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} className="w-full text-slate-400 text-xs mb-3 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-900 file:text-blue-400" />
                  <button onClick={handleBulkImport} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm">Upload & Import</button>
               </div>

               <div className="bg-[#121a24] p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-emerald-400 mb-3">Single Import</h4>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!filters?.selectedBatch) return toast.error("⚠️ Please select a Batch from the top right dropdown first!");
                    const token = localStorage.getItem('token');
                    await axios.post('/coordinator-crm/leads/import', { 
                        number: e.target.phone.value, 
                        name: e.target.name.value, 
                        isBulk: false, 
                        batchId: filters.selectedBatch,
                        businessId: filters.selectedBusiness
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success("Imported successfully");
                    setShowImportModal(false);
                    fetchLeads(true);
                  }}>
                    <input name="phone" type="text" placeholder="Phone Number" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 mb-2 text-sm outline-none" />
                    <input name="name" type="text" placeholder="Name (Optional)" className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 mb-3 text-sm outline-none" />
                    <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm">Import Single</button>
                  </form>
               </div>
             </div>
         </div>
      )}

      {showReportModal && (
          <InboundMissedCallsReportModal 
              isOpen={showReportModal} 
              onClose={() => setShowReportModal(false)} 
          />
      )}

      {showPermissionsModal && (
          <CallPermissionsWidget 
              asModal={true}
              onClose={() => setShowPermissionsModal(false)} 
          />
      )}

      <BlockedListModal
          isOpen={showBlockedModal}
          onClose={() => setShowBlockedModal(false)}
          onUnblockSuccess={() => {
              fetchBlockedCount();
              fetchLeads(true);
          }}
          crmPrefix="/coordinator-crm"
      />
    </div>
  );
}
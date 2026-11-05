import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from '../../../api/axios'; 
import { resolveAvatarUrl } from '../../../utils/avatarUtils';
import { FaSearch, FaUserCircle, FaUserPlus, FaFileImport, FaTimes, FaCheckSquare, FaEnvelopeOpenText, FaEnvelope, FaUserMinus, FaLock, FaBullhorn, FaCommentDots, FaPaperPlane, FaUserCheck, FaHeadset, FaClock, FaHistory, FaLayerGroup, FaFilter, FaChartBar, FaWhatsapp, FaShieldAlt, FaExchangeAlt, FaBan } from 'react-icons/fa';
import { FiPhoneMissed, FiPhoneIncoming, FiPhoneOutgoing } from 'react-icons/fi';
import CustomSelect from '../../common/CustomSelect';
import BusinessBadge from '../../common/BusinessBadge';
import InboundMissedCallsReportModal from '../../common/InboundMissedCallsReportModal';
import CallPermissionsWidget from '../../common/CallPermissionsWidget';
import BlockedListModal from '../../common/BlockedListModal';
import { useCall } from '../../../contexts/CallContext';

export default function AfterSeminarContactSidebar({ activeMode, selectedLead, setSelectedLead, filters, onRedirectToCampaign }) {
  const { socket } = useCall?.() || {};
  const rawRole = JSON.parse(localStorage.getItem('user'))?.role || '';
  const userRole = rawRole.toUpperCase().replace(' ', '_');
  const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);
  const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;

  const location = useLocation();
  const initialParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialSearchQuery = initialParams.get('searchQuery') || initialParams.get('search') || '';
  const initialTab = initialParams.get('tab') ? initialParams.get('tab').toUpperCase() : (initialSearchQuery ? 'ALL' : (isManager ? 'NEW_INQ' : 'ASSIGNED'));

  const [activeTab, setActiveTab] = useState(initialTab);
  const [newSubTab, setNewSubTab] = useState('OPEN_SEMINAR'); 
  const [callHistoryMode, setCallHistoryMode] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [activeCallTab, setActiveCallTab] = useState('INBOUND');
  const [callBatchFilter, setCallBatchFilter] = useState(filters?.selectedBatch || '');
  const [availableBatches, setAvailableBatches] = useState([]);
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false); 
  const [callTabCounts, setCallTabCounts] = useState({ INBOUND: 0, OUTBOUND: 0, MISSED: 0, NEW_INQUIRY: 0 }); 
  
  const [leads, setLeads] = useState([]);
  const [activeSessionLeadId, setActiveSessionLeadId] = useState(null);
  const [tabCounts, setTabCounts] = useState({ NEW: 0, NEW_INQ: 0, ASSIGNED: 0, ALL: 0, OPEN_SEMINAR: 0, IMPORTED: 0 });
  const [unreadCounts, setUnreadCounts] = useState({ NEW: 0, NEW_INQ: 0, ASSIGNED: 0, ALL: 0, OPEN_SEMINAR: 0, IMPORTED: 0 });
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false); 
  const [coordinators, setCoordinators] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatchToAssign, setSelectedBatchToAssign] = useState('');
  const [modalBatchId, setModalBatchId] = useState('');
  const [quickAssignStaffId, setQuickAssignStaffId] = useState('');
  const [bulkAssignType, setBulkAssignType] = useState('OPEN_SEMINAR');
  
  const [checkedLeads, setCheckedLeads] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false); 
  const [csvFile, setCsvFile] = useState(null); 
  const [manualAssignStaffId, setManualAssignStaffId] = useState('');
  const [ccStaff, setCcStaff] = useState([]);
  const [assignTargetBatchId, setAssignTargetBatchId] = useState('');
  
  const [assignConfirmation, setAssignConfirmation] = useState(null);
  const [lockedBatchesMap, setLockedBatchesMap] = useState({});

  useEffect(() => {
    const fetchLockStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/after-seminar-crm/campaign-lock-status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.lockedMap) {
          setLockedBatchesMap(res.data.lockedMap);
        }
      } catch (err) {}
    };
    fetchLockStatus();
  }, []);

  useEffect(() => {
    setActiveSessionLeadId(null);
  }, [activeTab, newSubTab]);

  const displayBatches = useMemo(() => {
      if (!batches || !Array.isArray(batches)) return [];
      if (filters?.selectedBusiness) {
          return batches.filter(b => String(b.businessId) === String(filters.selectedBusiness));
      }
      return batches;
  }, [batches, filters?.selectedBusiness]);
  
  const [staffFilter, setStaffFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedInqFilter, setAssignedInqFilter] = useState('');
  const [roundFilter, setRoundFilter] = useState('');
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearchQuery);

  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearchQuery(searchQuery);
      }, 500);
      return () => clearTimeout(handler);
  }, [searchQuery]);
  
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const searchVal = params.get('searchQuery') || params.get('search');
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

  const [visibleCount, setVisibleCount] = useState(50);

  // 🔥 ALUTH STATE: Pagination wenuwen 🔥
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1); // Background polling waladi current page eka track karanna
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalUnreadMatching, setTotalUnreadMatching] = useState(0);

  const [subTabStats, setSubTabStats] = useState({
      OPEN_SEMINAR: { total: 0, unread: 0 },
      NEW_INQ: { total: 0, unread: 0 }
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000); 
      return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      setVisibleCount(50);
  }, [activeTab, newSubTab, searchQuery]);

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

  // 🔥 UPDATE: Pagination variables (fetchPage, fetchLimit) api call ekata yawanawa 🔥
  const fetchLeads = async (showLoading = true, fetchPage = 1, fetchLimit = 50) => {
    if (showLoading) setLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/after-seminar-crm/leads`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
                tab: (activeTab === 'IMPORTED' || activeTab === 'NEW_INQ') ? 'NEW' : activeTab, 
                subTab: (activeTab === 'NEW' || activeTab === 'NEW_INQ') ? (newSubTab === 'OPEN_SEMINAR' ? 'OPEN_SEMINAR,NORMAL' : newSubTab) : '',
                paymentGroup: groupFilter,
                status: statusFilter, 
                staffId: staffFilter,
                inquiryType: activeTab === 'ASSIGNED' ? (assignedInqFilter === 'OPEN_SEMINAR' ? 'OPEN_SEMINAR,NORMAL' : assignedInqFilter) : '', 
                round: roundFilter, 
                loggedUserId: currentUserId, 
                loggedUserRole: rawRole,
                businessId: filters?.selectedBusiness || '', 
                batchId: (debouncedSearchQuery && activeTab === 'ALL') ? '' : (filters?.selectedBatch || ''),
                searchQuery: debouncedSearchQuery,
                unassignedOnly: unassignedOnlyFilter ? 'true' : 'false',
                page: fetchPage,     // Backend ekata yawanawa
                limit: fetchLimit,   // Backend ekata yawanawa
                excludeColdBridge: 'true' // 🔥 Hide bridge transfers that have never messaged us 🔥
            }
        });

      let fetchedLeads = response.data.leads || [];
      
      if (activeTab === 'NEW' || activeTab === 'NEW_INQ') { 
          setSubTabStats({
              OPEN_SEMINAR: { 
                  total: response.data.openSemMatching !== undefined ? response.data.openSemMatching : (response.data.counts?.OPEN_SEMINAR || 0), 
                  unread: response.data.openSemUnreadMatching !== undefined ? response.data.openSemUnreadMatching : (response.data.unreadCounts?.OPEN_SEMINAR || 0) 
              },
              NEW_INQ: { 
                  total: response.data.newInqMatching !== undefined ? response.data.newInqMatching : (response.data.counts?.NEW_INQ || 0), 
                  unread: response.data.newInqUnreadMatching !== undefined ? response.data.newInqUnreadMatching : (response.data.unreadCounts?.NEW_INQ || 0) 
              }
          });
      } else if (activeTab === 'IMPORTED') {
          if (!isManager) {
              fetchedLeads = fetchedLeads.filter(l => l.assignedTo === parseInt(currentUserId) && ['import', 'bulk_import'].includes(l.source));
          } else {
              fetchedLeads = fetchedLeads.filter(l => l.assignedTo === null && ['import', 'bulk_import'].includes(l.source));
          }
      } else if (activeTab === 'ASSIGNED') {
          fetchedLeads = fetchedLeads.filter(l => l.assignedTo !== null);
      }
      
      // 🔥 UPDATE: Page 1 nam replace karanawa, naththam parana ekata ekathu karanawa (Append) 🔥
      if (fetchPage === 1) {
          setLeads(fetchedLeads);
      } else {
          setLeads(prev => {
              const existingIds = new Set(prev.map(l => l.id));
              const newUnique = fetchedLeads.filter(l => !existingIds.has(l.id));
              return [...prev, ...newUnique];
          });
      }

      setHasMore(response.data.leads?.length === fetchLimit); // Thawa leads thiyenawada balanawa

      setTabCounts(response.data.counts || {});
      setUnreadCounts(response.data.unreadCounts || { NEW: 0, NEW_INQ: 0, ASSIGNED: 0, ALL: 0, OPEN_SEMINAR: 0, IMPORTED: 0 });
      setTotalUnread(response.data.totalUnread || 0);
      setTotalMatching(response.data.totalMatching || 0);
      setTotalUnreadMatching(response.data.totalUnreadMatching !== undefined ? response.data.totalUnreadMatching : 0);
    } catch (error) {
        if(showLoading) toast.error("Failed to load leads"); 
    }
    if (showLoading) setLoading(false);
  };

  const fetchCoordinatorsAndQuotas = async () => {
    try {
      const token = localStorage.getItem('token');
      const [staffRes, bizRes, batchRes] = await Promise.all([ 
          axios.get('/admin/staff', { headers: { Authorization: `Bearer ${token}` } }), 
          axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/admin/manager/batches-full', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setBatches(batchRes.data || []);
      let coords = (staffRes.data || []).filter(s => {
          if (!s?.role) return false;
          const r = String(s.role).toUpperCase().replace(/ /g, '_');
          const dept = String(s.department || '').toUpperCase().replace(/ /g, '_');
          return ['COORDINATOR', 'MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ASS_MANAGER'].includes(r) && 
                 !r.includes('CALL') && 
                 dept !== 'CALL_CENTER';
      });
      if (filters?.selectedBusiness) {
          const selectedBizObj = bizRes.data.find(b => String(b.id) === String(filters.selectedBusiness));
          const bizName = selectedBizObj ? selectedBizObj.name : '';
          coords = coords.filter(c => {
              if (!c.businessType) return false;
              const cBizList = String(c.businessType).toLowerCase().split(',').map(b => b.trim());
              const selBizId = String(filters.selectedBusiness).toLowerCase().trim();
              const selBizName = String(bizName).toLowerCase().trim();
              
              return cBizList.includes('all') || cBizList.includes(selBizId) || cBizList.some(biz => biz.includes(selBizName)) || String(c.businessId) === String(filters.selectedBusiness);
          });
      }
      setCoordinators(coords);
    } catch (error) { console.error("Data load error", error); }
  };

  useEffect(() => { fetchCoordinatorsAndQuotas(); }, [filters?.selectedBusiness, filters?.selectedBatch]);

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
                  callTab: activeCallTab, 
                  campaignType: 'AFTER_SEMINAR' 
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
  useEffect(() => { 
      // Filter ekak maru unama page 1 ta reset wenawa
      setPage(1);
      pageRef.current = 1;
      fetchLeads(true, 1, 50); 
      setCheckedLeads([]); 

      const fetchBlockedCount = async () => {
          try {
              const token = localStorage.getItem('token');
              const res = await axios.get('/after-seminar-crm/leads/blocked-list', {
                  headers: { Authorization: `Bearer ${token}` }
              });
              if (Array.isArray(res.data)) {
                  setBlockedCount(res.data.length);
              }
          } catch (e) {}
      };

      fetchBlockedCount();

      // Fast polling (10s)
      const interval = setInterval(() => { 
          fetchLeads(false, 1, pageRef.current * 50); 
      }, 10000);

      let handleSocketUpdate;
      let handleLeadBlocked;
      let handleLeadUnblocked;

      if (socket) {
          handleSocketUpdate = () => {
              fetchLeads(false, 1, pageRef.current * 50);
          };

          handleLeadBlocked = (data) => {
              if (data?.phone) {
                  const phoneSuffix = String(data.phone).slice(-9);
                  if (selectedLead) {
                      const selSuffix = String(selectedLead.phone || '').split('_')[0].slice(-9);
                      if (selSuffix === phoneSuffix || selectedLead.id === data.leadId) {
                          setSelectedLead(null);
                      }
                  }
              }
              fetchBlockedCount();
              fetchLeads(false, 1, pageRef.current * 50);
          };

          handleLeadUnblocked = () => {
              fetchBlockedCount();
              fetchLeads(false, 1, pageRef.current * 50);
          };

          socket.on('new_inbound_message', handleSocketUpdate);
          socket.on('lead_updated', handleSocketUpdate);
          socket.on('new_message', handleSocketUpdate);
          socket.on('lead_blocked', handleLeadBlocked);
          socket.on('lead_unblocked', handleLeadUnblocked);
      }

      return () => {
          clearInterval(interval);
          if (socket) {
              socket.off('new_inbound_message', handleSocketUpdate);
              socket.off('lead_updated', handleSocketUpdate);
              socket.off('new_message', handleSocketUpdate);
              socket.off('lead_blocked', handleLeadBlocked);
              socket.off('lead_unblocked', handleLeadUnblocked);
          }
      };
  }, [activeTab, newSubTab, staffFilter, groupFilter, statusFilter, assignedInqFilter, roundFilter, unassignedOnlyFilter, filters?.selectedBusiness, filters?.selectedBatch, debouncedSearchQuery, socket]);

  useEffect(() => {
      if (initialSearchQuery && leads.length > 0 && !selectedLead) {
          const match = leads.find(l => l.phone && l.phone.includes(initialSearchQuery));
          if (match) handleLeadClick(match);
      }
  }, [leads, initialSearchQuery, selectedLead]);

  const handleSelectAll = async () => { 
      if (checkedLeads.length >= leads.length && checkedLeads.length > 0) {
          setCheckedLeads([]); 
      } else {
          const loadToast = toast.loading("Selecting all matching leads...");
          try {
              const token = localStorage.getItem('token');
              const response = await axios.get(`/after-seminar-crm/leads`, {
                  headers: { Authorization: `Bearer ${token}` },
                  params: { 
                      tab: (activeTab === 'IMPORTED' || activeTab === 'NEW_INQ') ? 'NEW' : activeTab, 
                      paymentGroup: groupFilter,
                      status: statusFilter, 
                      staffId: staffFilter,
                      inquiryType: activeTab === 'ASSIGNED' ? (assignedInqFilter === 'OPEN_SEMINAR' ? 'OPEN_SEMINAR,NORMAL' : assignedInqFilter) : '', 
                      subTab: (activeTab === 'NEW' || activeTab === 'NEW_INQ') ? (newSubTab === 'OPEN_SEMINAR' ? 'OPEN_SEMINAR,NORMAL' : newSubTab) : '',
                      round: roundFilter, 
                      loggedUserId: currentUserId, 
                      loggedUserRole: rawRole,
                      businessId: filters?.selectedBusiness || '', 
                      batchId: filters?.selectedBatch || '',
                      searchQuery: debouncedSearchQuery,
                      unassignedOnly: unassignedOnlyFilter ? 'true' : 'false',
                      excludeColdBridge: 'true',
                      fetchAllIds: 'true'
                  }
              });
              setCheckedLeads(response.data.ids || []);
              toast.success(`Selected ${response.data.ids?.length || 0} leads`, { id: loadToast });
          } catch (e) {
              toast.error("Failed to select all leads", { id: loadToast });
          }
      }
  };

  const handleBulkAction = async (action, assignStaffId = null, specificLeads = null, targetBatchId = null) => {
    const leadsToProcess = specificLeads || checkedLeads;
    if (leadsToProcess.length === 0) return;

    if (action === 'ASSIGN') {
        setAssignConfirmation({
            type: 'selected',
            staffId: assignStaffId,
            leadIds: leadsToProcess,
            batchId: targetBatchId
        });
        return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('/after-seminar-crm/leads/bulk-action', { 
          action, 
          leadIds: leadsToProcess, 
          staffId: assignStaffId, 
          batchId: targetBatchId 
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Action applied successfully!");
      if (!specificLeads) setCheckedLeads([]); 
      fetchLeads(false, 1, pageRef.current * 50); // Refresh current list
    } catch (e) { toast.error(e.response?.data?.error || "Action failed"); }
  };

  const handleHandOverToCallCenter = async () => {
    if (checkedLeads.length === 0) return toast.error("Please select leads to hand over");
    try {
      const token = localStorage.getItem('token');
      await axios.post('/call-center/request-transfer', { leadIds: checkedLeads }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Successfully requested handover to call center!");
      setCheckedLeads([]);
      fetchLeads(false, 1, pageRef.current * 50);
    } catch (e) {
      toast.error("Failed to hand over leads");
    }
  };

  const handleSendTestFollowUp = async () => {
    if (checkedLeads.length !== 1) return toast.error("Please select exactly ONE lead to test.");
    const loadToast = toast.loading("Sending test follow-up...");
    try {
        const token = localStorage.getItem('token');
        await axios.post('/after-seminar-crm/leads/test-followup', { leadId: checkedLeads[0] }, { headers: { Authorization: `Bearer ${token}` }});
        toast.success("Test message sent successfully!", { id: loadToast });
        setCheckedLeads([]);
    } catch(err) {
        toast.error("Failed to send test message.", { id: loadToast });
    }
  };

  const handleOpenAssignModal = () => {
      const defaultType = (activeTab === 'NEW_INQ' || (activeTab === 'NEW' && newSubTab === 'NEW_INQ')) ? 'NEW_INQ' : 'OPEN_SEMINAR';
      setBulkAssignType(defaultType);
      setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e, type) => {
    e.preventDefault();
    if (type === 'bulk') {
        if (!manualAssignStaffId) return toast.error("Please select a staff member to assign");
        const chosenInqType = bulkAssignType || e.target.assignType?.value || 'OPEN_SEMINAR';
        const currentSource = (activeTab === 'NEW_INQ' || activeTab === 'NEW') ? (newSubTab === 'OPEN_SEMINAR' ? 'OPEN_SEMINAR' : 'NEW_INQ') : activeTab;
        const targetBatch = assignTargetBatchId || filters?.selectedBatch;
        const formData = {
            type: 'bulk',
            count: e.target.count.value,
            sort: e.target.sort.value,
            staffId: manualAssignStaffId,
            batchId: targetBatch,
            businessId: filters?.selectedBusiness,
            assignType: chosenInqType,
            sourceTab: currentSource,
            sourceInquiryType: chosenInqType || currentSource
        };
        setAssignConfirmation({
            type: 'bulk_form',
            formData: formData,
            batchId: targetBatch
        });
        setShowAssignModal(false);
    }
  };

  const executeAssignment = async (assignType, targetBatchId = null) => {
      try {
          const token = localStorage.getItem('token');
          const batchToUse = targetBatchId || modalBatchId || assignConfirmation?.batchId || assignConfirmation?.formData?.batchId || assignTargetBatchId || filters?.selectedBatch;
          const cleanBatch = (batchToUse && batchToUse !== 'ALL') ? batchToUse : undefined;

          // Block Open Seminar assignment if batch is locked
          if ((assignType === 'OPEN_SEMINAR' || assignType === 'NORMAL') && cleanBatch && cleanBatch !== 'UNASSIGNED' && lockedBatchesMap[cleanBatch]) {
              return toast.error("Opening Seminar campaign for this batch is currently locked by Management. Cannot assign leads to it.");
          }

          if (assignConfirmation.type === 'selected') {
              await axios.post('/after-seminar-crm/leads/bulk-action', {
                  action: 'ASSIGN',
                  leadIds: assignConfirmation.leadIds,
                  staffId: assignConfirmation.staffId,
                  assignType: assignType,
                  batchId: cleanBatch === 'UNASSIGNED' ? null : cleanBatch
              }, { headers: { Authorization: `Bearer ${token}` } });
              setCheckedLeads([]);
          } else if (assignConfirmation.type === 'bulk_form') {
              await axios.post('/after-seminar-crm/leads/assign', {
                  ...assignConfirmation.formData,
                  batchId: cleanBatch,
                  assignType: assignType || assignConfirmation.formData?.assignType
              }, { headers: { Authorization: `Bearer ${token}` } });
          }
          toast.success("Leads Assigned Successfully!");
          setAssignConfirmation(null);
          setModalBatchId('');
          setQuickAssignStaffId('');
          fetchLeads(false, 1, pageRef.current * 50); // Refresh
      } catch (error) {
          toast.error(error.response?.data?.error || "Assignment Failed");
      }
  };

  const handleLeadClick = async (lead) => {
      setSelectedLead(lead);
      if (lead.unreadCount > 0) {
          // Keep this unread chat pinned at the top of the unread list while the coordinator is working on it.
          // When the coordinator clicks the NEXT chat, this pin moves to the new chat, and this one drops below unread chats!
          setActiveSessionLeadId(lead.id);
          setLeads(prevLeads => prevLeads.map(l => l.id === lead.id ? { ...l, unreadCount: 0 } : l));
          setTotalUnreadMatching(prev => Math.max(0, prev - 1));
          setUnreadCounts(prev => ({
              ...prev,
              [activeTab]: Math.max(0, (prev[activeTab] || 0) - 1),
              ALL: Math.max(0, (prev.ALL || 0) - 1)
          }));
          try {
              const token = localStorage.getItem('token');
              await axios.post('/after-seminar-crm/leads/bulk-action', { action: 'MARK_READ', leadIds: [lead.id] }, { headers: { Authorization: `Bearer ${token}` } });
          } catch (e) {}
      } else {
          // If coordinator clicked an already read lead, clear the session pin so previously answered leads settle below unread
          setActiveSessionLeadId(null);
      }
  };

  const filteredLeads = useMemo(() => {
      let result = leads.filter(lead => !lead.isBlocked && lead.status !== 'BLOCKED');

      if (searchQuery) {
          const q = String(searchQuery).toLowerCase().trim();
          result = result.filter(lead => {
              const phoneMatch = lead.phone ? String(lead.phone).toLowerCase().includes(q) : false;
              const nameMatch = lead.name ? String(lead.name).toLowerCase().includes(q) : false;
              return phoneMatch || nameMatch;
          });
      }

      // 🔥 PIN ACTIVE UNREAD CHAT ON TOP WHILE VIEWING 🔥
      // Only when coordinator opens the NEXT chat does this lead drop down below the unread list!
      if (activeSessionLeadId) {
          const activeLead = result.find(l => l.id === activeSessionLeadId);
          if (activeLead) {
              const otherUnread = result.filter(l => l.id !== activeSessionLeadId && l.unreadCount > 0);
              const otherRead = result.filter(l => l.id !== activeSessionLeadId && l.unreadCount === 0);
              return [activeLead, ...otherUnread, ...otherRead];
          }
      }

      return result;
  }, [leads, searchQuery, activeSessionLeadId]);

  const getAssignedStats = () => {
      if (activeTab === 'ASSIGNED' && (staffFilter || groupFilter || statusFilter || assignedInqFilter || roundFilter)) {
          return { total: totalMatching, unread: totalUnreadMatching };
      }
      return { total: tabCounts.ASSIGNED || 0, unread: unreadCounts.ASSIGNED || 0 };
  };

  const assignedStats = getAssignedStats();
  const totalNewCount = subTabStats.OPEN_SEMINAR.total + subTabStats.NEW_INQ.total;
  const totalNewUnread = subTabStats.OPEN_SEMINAR.unread + subTabStats.NEW_INQ.unread;

  const tabs = [
    { id: 'NEW_INQ', label: 'New', total: totalNewCount, unread: totalNewUnread }, 
    { id: 'IMPORTED', label: 'Imported', total: tabCounts.IMPORTED || 0, unread: unreadCounts.IMPORTED || 0 }, 
    { id: 'ASSIGNED', label: 'Assigned', total: assignedStats.total, unread: assignedStats.unread },
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
                  campaignType: call.campaignType || (call.isNewInquiry ? 'NEW_INQ' : 'AFTER_SEMINAR')
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

  const displayedLeads = filteredLeads;

  return (
    <div className="w-[380px] xl:w-[440px] bg-[#1a2430] rounded-2xl flex flex-col overflow-hidden shrink-0 border border-white/10 shadow-xl relative">
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
                     onClick={handleOpenAssignModal} 
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
                        { value: '', label: 'Assign to Coordinator...' },
                        ...coordinators.filter(c => c).map(c => ({
                            value: c.id, 
                            label: <div className="flex items-center gap-1 text-[11px]">{c.firstName} <BusinessBadge businessType={c.businessType} role={c.role} /></div>
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
        <div className="p-5 bg-[#121a24] border-b border-white/5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-black text-slate-200 tracking-wider uppercase flex items-center gap-2">
              {callHistoryMode ? (
                <>
                  <FaHistory className="text-indigo-400" /> CALL HISTORY
                </>
              ) : (
                'Contacts'
              )}
            </h3>
            <div className="flex gap-2">
                <button 
                  onClick={() => setShowReportModal(true)} 
                  title="CRM Call & Permission Analytics Report"
                  className="p-2.5 rounded-lg border transition-all bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/30"
                >
                  <FaChartBar size={16}/>
                </button>
                <button 
                  onClick={() => setShowBlockedModal(true)} 
                  title="Blocked Numbers List"
                  className="p-2.5 rounded-lg border transition-all bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border-rose-500/30 relative shadow-sm"
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
                  className={`p-2.5 rounded-lg border transition-all ${
                    callHistoryMode 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30' 
                      : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border-indigo-500/30'
                  }`}
                >
                  <FaHistory size={16}/>
                </button>
                <button onClick={() => setShowImportModal(true)} className="p-2.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-500/30 transition-all"><FaFileImport size={16}/></button>
              
              {isManager && (
                 <button onClick={handleOpenAssignModal} className="p-2.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-500/30 transition-all"><FaUserPlus size={16}/></button>
              )}
            </div>
          </div>
          
          <div className="relative mb-4">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder={callHistoryMode ? "Search calls by number, name..." : "Search loaded leads..."} 
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-base text-slate-200 focus:outline-none focus:border-emerald-600 shadow-inner" 
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
                  <span className="text-[10px] font-bold tracking-widest uppercase">{tab.label}</span>
                  <span className="text-[9px] font-medium opacity-60 mt-0.5">Total: {tab.total || 0}</span>
                  {tab.unread > 0 && <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-md">{tab.unread}</span>}
                </button>
              ))
            )}
          </div>

          {!callHistoryMode && (activeTab === 'NEW' || activeTab === 'NEW_INQ') && (
             <div className="flex gap-2 mt-3 bg-[#0f172a] p-1.5 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setNewSubTab('OPEN_SEMINAR')} 
                  className={`relative flex-1 flex justify-center items-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newSubTab === 'OPEN_SEMINAR' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                  <FaBullhorn size={12}/> Open Sem ({subTabStats.OPEN_SEMINAR.total})
                  {subTabStats.OPEN_SEMINAR.unread > 0 && (
                      <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-md">{subTabStats.OPEN_SEMINAR.unread}</span>
                  )}
                </button>
                <button 
                  onClick={() => setNewSubTab('NEW_INQ')} 
                  className={`relative flex-1 flex justify-center items-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${newSubTab === 'NEW_INQ' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                  <FaCommentDots size={12}/> New Inq ({subTabStats.NEW_INQ.total})
                  {subTabStats.NEW_INQ.unread > 0 && (
                      <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-md">{subTabStats.NEW_INQ.unread}</span>
                  )}
                </button>
             </div>
          )}

          {!callHistoryMode && activeTab === 'ALL' && (
            <div className="flex justify-between items-center bg-[#0f172a] p-2 rounded-xl border border-slate-800 mt-3">
               <span className="text-slate-300 text-[10px] font-bold uppercase tracking-wider pl-2">Unassigned Only</span>
               <label className="relative inline-flex items-center cursor-pointer">
                 <input type="checkbox" className="sr-only peer" checked={unassignedOnlyFilter} onChange={(e) => setUnassignedOnlyFilter(e.target.checked)} />
                 <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
               </label>
            </div>
          )}

          {!callHistoryMode && activeTab === 'ASSIGNED' && (
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex gap-2">
                <CustomSelect 
                  value={staffFilter}
                  onChange={e=>setStaffFilter(e.target.value)} 
                  className="flex-[1.5]"
                  placeholder="All Staff"
                  options={[
                      { value: '', label: 'All Staff' },
                      ...coordinators.filter(c => c).map(c => ({
                          value: c.id, 
                          label: <div className="flex items-center gap-1.5">{c.firstName} <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                      }))
                  ]}
                />
                
                <select onChange={e=>setAssignedInqFilter(e.target.value)} value={assignedInqFilter} className="flex-1 bg-[#0f172a] text-slate-300 text-[10px] font-bold uppercase rounded-lg px-2 py-2 border border-slate-700 outline-none">
                  <option value="">All Types</option>
                  <option value="OPEN_SEMINAR">Open Seminar</option>
                  <option value="NEW_INQ">New Inquiry</option>
                </select>
                
                <select onChange={e=>setGroupFilter(e.target.value)} value={groupFilter} className="flex-1 bg-[#0f172a] text-slate-300 text-[10px] font-bold uppercase rounded-lg px-2 py-2 border border-slate-700 outline-none">
                  <option value="">Group</option>
                  <option value="FULL">Full Payment</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="INSTALLMENT">Installment</option>
                  <option value="NOT_DECIDED">Not Decided</option>
                </select>
              </div>

              <div className="flex gap-2">
                <select onChange={e=>setRoundFilter(e.target.value)} value={roundFilter} className="flex-1 bg-[#0f172a] text-slate-300 text-[10px] font-bold uppercase rounded-lg px-2 py-2 border border-slate-700 outline-none">
                  <option value="">All Rounds</option>
                  <option value="1">Round 1</option>
                  <option value="2">Round 2</option>
                  <option value="3">Round 3</option>
                  <option value="4">Round 4</option>
                  <option value="5">Round 5</option>
                </select>

                <select onChange={e=>setStatusFilter(e.target.value)} value={statusFilter} className="flex-1 bg-[#0f172a] text-slate-300 text-[10px] font-bold uppercase rounded-lg px-2 py-2 border border-slate-700 outline-none">
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="answered">Answered</option>
                  <option value="no_answer">No Answer</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEAD LIST / CALLS LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[#1a2430]">
        {callHistoryMode ? (
            callsLoading ? (
                <div className="flex justify-center items-center py-10">
                    <div className="w-8 h-8 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : calls.length === 0 ? (
                <div className="text-center text-slate-600 text-sm mt-10 font-medium">No calls found in the history.</div>
            ) : (
                <div className="space-y-2.5">
                    {calls.map(call => {
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
        ) : (
          loading && leads.length === 0 ? ( <div className="flex justify-center mt-10"><div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div></div> ) 
          : filteredLeads.length === 0 ? ( <div className="text-center text-slate-600 text-sm mt-10 font-medium">No contacts found.</div> ) : (
            <>
            {displayedLeads.map(lead => {
                
              const leadTime = new Date(lead.lastMessageAt || lead.updatedAt || lead.createdAt);
              const hoursPassed = (currentTime.getTime() - leadTime.getTime()) / (1000 * 60 * 60);

              let overlayClass = ''; 
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
                              {lead.unreadCount > 0 && (
                                  <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 rounded-full shadow-md shadow-red-500/40">
                                      {lead.unreadCount}
                                  </span>
                              )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {lead.name && (
                                  <span className="text-[11px] font-semibold text-slate-300">{lead.name}</span>
                              )}
                              {((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_')))) && (
                                  <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm border border-emerald-600">Enrolled</span>
                              )}
                              {lead.isBlocked && (
                                  <span className="bg-red-500/20 text-red-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm border border-red-500/30 flex items-center gap-1">
                                      <FaBan size={8}/> Blocked
                                  </span>
                              )}
                          </div>
                          
                          {lead.assignedUser && !['CALL_CENTER_AGENT', 'CALLER', 'CALL_CENTER'].includes(String(lead.assignedUser.role || '').toUpperCase().replace(/ /g, '_')) ? (
                              <span className="text-[10px] text-blue-400 font-semibold mt-0.5 flex items-center gap-1">👤 {lead.assignedUser.firstName} {lead.assignedUser.lastName} <BusinessBadge businessType={lead.assignedUser.businessType} role={lead.assignedUser.role} /></span>
                          ) : (
                              (!lead.assignedTo || ['CALL_CENTER_AGENT', 'CALLER', 'CALL_CENTER'].includes(String(lead.assignedUser?.role || '').toUpperCase().replace(/ /g, '_'))) && (
                                  <button onClick={(e) => { e.stopPropagation(); handleBulkAction('ASSIGN', currentUserId, [lead.id]); }} className="text-[9px] w-max bg-emerald-600/80 hover:bg-emerald-500 text-white px-2 py-1 rounded shadow-md flex items-center gap-1 transition-all mt-1">
                                     <FaUserCheck size={10}/> Assign to me
                                  </button>
                              )
                          )}
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0 ml-2 gap-1.5">
                          <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold block mb-0.5">{new Date(lead.lastMessageAt || lead.updatedAt).toLocaleDateString('en-GB')}</span>
                              <span className="text-[9px] text-slate-500 block">{new Date(lead.lastMessageAt || lead.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          
                          {(String(lead.assignedTo) === String(currentUserId) || isManager) && (
                              <button 
                                  onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (onRedirectToCampaign) onRedirectToCampaign(lead);
                                      else toast.error("Campaign router is missing!");
                                  }} 
                                  title="Open in Call Campaign"
                                  className="w-7 h-7 rounded-full bg-indigo-600/20 hover:bg-indigo-500 text-indigo-400 hover:text-white flex items-center justify-center transition-all shadow-md border border-indigo-500/30"
                              >
                                  <FaHeadset size={12} />
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

            {/* 🔥 UPDATE: Load More Leads Button 🔥 */}
            {hasMore && !searchQuery && (
                <div className="flex justify-center mt-4 mb-2">
                    <button 
                        onClick={() => {
                            const nextPage = page + 1;
                            setPage(nextPage);
                            pageRef.current = nextPage;
                            fetchLeads(true, nextPage, 50);
                        }} 
                        disabled={loading}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-bold py-2 px-6 rounded-full transition-colors shadow-lg"
                    >
                        {loading ? 'Loading...' : 'Load More Leads'}
                    </button>
                </div>
            )}
          </>
          )
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
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Bulk Manual Assign</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                     <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Inquiry Type</label>
                        <select 
                           name="assignType" 
                           value={bulkAssignType} 
                           onChange={(e) => setBulkAssignType(e.target.value)}
                           className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                        >
                           <option 
                             value="OPEN_SEMINAR"
                             disabled={Boolean(assignTargetBatchId && lockedBatchesMap[assignTargetBatchId])}
                           >
                             {assignTargetBatchId && lockedBatchesMap[assignTargetBatchId] ? '🔒 Open Seminar Inquiries (Locked)' : 'Open Seminar Inquiries'}
                           </option>
                           <option value="NEW_INQ">Normal Inbox Inquiries</option>
                           <option 
                             value="NORMAL"
                             disabled={Boolean(assignTargetBatchId && lockedBatchesMap[assignTargetBatchId])}
                           >
                             {assignTargetBatchId && lockedBatchesMap[assignTargetBatchId] ? '🔒 Imported Leads (Locked)' : 'Imported Leads (Open Seminar)'}
                           </option>
                        </select>
                     </div>

                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sort Order</label>
                        <select name="sort" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none">
                           <option value="newest">Newest First</option>
                           <option value="oldest">Oldest First</option>
                        </select>
                     </div>

                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Lead Count</label>
                        <input name="count" type="number" placeholder="Count" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 text-xs outline-none" />
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
                                 <option key={b.id} value={b.id}>
                                   {b.name} {lockedBatchesMap[b.id] ? '🔒 [Open Sem Locked]' : ''}
                                 </option>
                             ))}
                         </select>
                     </div>
                  </div>

                  <div className="mb-3">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Coordinator</label>
                     <CustomSelect 
                         value={manualAssignStaffId}
                         onChange={(e) => setManualAssignStaffId(e.target.value)}
                         className="w-full"
                         placeholder="Select Coordinator..."
                         options={[
                             { value: '', label: 'Select Coordinator...' },
                             ...coordinators.filter(c => c).map(c => ({
                                 value: c.id, 
                                 label: <div className="flex items-center gap-1.5">{c.firstName} <BusinessBadge businessType={c.businessType} role={c.role} /></div>
                             }))
                         ]}
                     />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest transition-colors">Assign Leads</button>
               </form>
            </div>
         </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
         <div className="absolute inset-0 z-50 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-[#1a2430] border border-slate-700 rounded-2xl p-5 w-full shadow-2xl">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><FaFileImport className="text-blue-500"/> Import Leads</h3>
                  <button onClick={()=>setShowImportModal(false)} className="text-slate-500 hover:text-white"><FaTimes/></button>
               </div>

               <div className="bg-[#121a24] p-3 rounded-xl border border-slate-800 mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Import To:</label>
                      {filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch] && (
                          <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 bg-red-950/40 px-2 py-0.5 rounded border border-red-500/30">
                              <FaLock size={10} /> Open Sem Locked
                          </span>
                      )}
                  </div>
                  <select 
                      id="importTargetTab" 
                      defaultValue={filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch] ? 'NEW_INQ' : 'OPEN_SEMINAR'}
                      className="w-full bg-[#1a2430] border border-slate-700 text-emerald-400 font-bold rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                  >
                      <option 
                          value="OPEN_SEMINAR" 
                          disabled={filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch]}
                          className={filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch] ? 'text-red-400 bg-slate-900 opacity-40' : ''}
                      >
                          {filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch] ? '🔒 Open Seminar Tab (Locked)' : 'Open Seminar Tab'}
                      </option>
                      <option value="NEW_INQ">New Inquiry Tab (Inbox)</option>
                  </select>
               </div>
               
               <div className="bg-[#121a24] p-4 rounded-xl border border-slate-800 mb-3">
                  <h4 className="text-sm font-bold text-blue-400 mb-1">Bulk Import (CSV)</h4>
                  <p className="text-[10px] text-slate-500 mb-3">Upload a CSV file. Format: Column 1 = Phone, Column 2 = Name (Optional).</p>
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} className="w-full text-slate-400 text-xs mb-3 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-900 file:text-blue-400" />
                  <button onClick={() => {
                      if (!csvFile) return toast.error("Please select a CSV file first!");
                      const targetTab = document.getElementById('importTargetTab').value;
                      if (targetTab === 'OPEN_SEMINAR' && filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch]) {
                          return toast.error("Open Seminar campaign for this batch is locked by Manager/Admin!");
                      }
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
                              await axios.post('/after-seminar-crm/leads/import', { 
                                  isBulk: true, 
                                  leadsList,
                                  batchId: filters?.selectedBatch,
                                  businessId: filters?.selectedBusiness,
                                  inquiryType: targetTab
                              }, { headers: { Authorization: `Bearer ${token}` } });
                              toast.success(`${leadsList.length} Leads Imported to ${targetTab}!`);
                              setShowImportModal(false); setCsvFile(null); fetchLeads(true, 1, 50); // Refresh
                          } catch (error) { toast.error("Bulk import failed!"); }
                      };
                      reader.readAsText(csvFile);
                  }} className="w-full bg-blue-600 hover:bg-blue-500 transition-colors text-white font-bold py-2 rounded-lg text-sm">Upload & Import</button>
               </div>

               <div className="bg-[#121a24] p-4 rounded-xl border border-slate-800">
                  <h4 className="text-sm font-bold text-emerald-400 mb-3">Single Import</h4>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const targetTab = document.getElementById('importTargetTab').value;
                    if (targetTab === 'OPEN_SEMINAR' && filters?.selectedBatch && filters?.selectedBatch !== 'ALL' && lockedBatchesMap[filters?.selectedBatch]) {
                        return toast.error("Open Seminar campaign for this batch is locked by Manager/Admin!");
                    }
                    const token = localStorage.getItem('token');
                    try {
                        await axios.post('/after-seminar-crm/leads/import', { 
                            number: e.target.phone.value, 
                            name: e.target.name.value, 
                            isBulk: false,
                            batchId: filters?.selectedBatch,
                            businessId: filters?.selectedBusiness,
                            inquiryType: targetTab
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        toast.success(`Imported successfully to ${targetTab}`);
                        setShowImportModal(false);
                        fetchLeads(true, 1, 50); // Refresh
                    } catch(err) {
                        toast.error("Import failed");
                    }
                  }}>
                    <input name="phone" type="text" placeholder="Phone Number" required className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 mb-2 text-sm outline-none" />
                    <input name="name" type="text" placeholder="Name (Optional)" className="w-full bg-[#1a2430] border border-slate-700 text-slate-300 rounded-lg p-2 mb-3 text-sm outline-none" />
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-bold py-2 rounded-lg text-sm">Import Single</button>
                  </form>
               </div>
             </div>
         </div>
      )}

      {assignConfirmation && (() => {
          const effectiveBatch = modalBatchId || assignConfirmation?.batchId || filters?.selectedBatch;
          const isConfirmOpenSemLocked = Boolean(effectiveBatch && effectiveBatch !== 'ALL' && lockedBatchesMap[effectiveBatch]);
          return (
          <div className="absolute inset-0 z-[60] bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1a2430] border border-slate-700 rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl animate-fade-in">
                  <div className="text-center mb-4">
                      <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
                          <FaUserCheck size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">Assign Leads</h3>
                      <p className="text-xs text-slate-400">
                         {assignConfirmation.type === 'selected' ? `Assigning ${assignConfirmation.leadIds?.length || 0} selected lead(s)` : 'Bulk Assign Confirmation'}
                      </p>
                  </div>

                  {/* Target Batch selector in Confirmation */}
                  <div className="mb-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Target Batch (Optional)</label>
                      <select 
                          value={modalBatchId || assignConfirmation?.batchId || ''} 
                          onChange={(e) => setModalBatchId(e.target.value)}
                          className="w-full bg-[#0f172a] border border-slate-700 text-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500"
                      >
                          <option value="">Keep current batch / Default</option>
                          {displayBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                  {b.name} {lockedBatchesMap[b.id] ? '🔒 [Open Sem Locked]' : ''}
                              </option>
                          ))}
                      </select>
                  </div>

                  {isConfirmOpenSemLocked && (
                      <div className="mb-3 p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl text-[11px] text-red-300 flex items-start gap-2">
                          <FaLock size={13} className="text-red-400 mt-0.5 shrink-0" />
                          <span><strong>Campaign Locked:</strong> Open Seminar for this batch is locked by Manager/Admin. Leads cannot be assigned to Open Seminar.</span>
                      </div>
                  )}

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Select Inquiry Type:</label>
                  <div className="flex flex-col gap-2.5">
                      <button
                          disabled={isConfirmOpenSemLocked}
                          onClick={() => {
                              if (isConfirmOpenSemLocked) {
                                  toast.error("Open Seminar campaign for this batch is locked!");
                                  return;
                              }
                              executeAssignment('OPEN_SEMINAR', modalBatchId);
                          }}
                          className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${
                              isConfirmOpenSemLocked
                                  ? 'bg-slate-800 text-slate-500 border border-red-500/30 opacity-40 cursor-not-allowed pointer-events-none'
                                  : 'bg-purple-600 hover:bg-purple-500 text-white'
                          }`}
                          title={isConfirmOpenSemLocked ? "Open Seminar is locked for this batch" : "Assign to Open Seminar"}
                      >
                          {isConfirmOpenSemLocked ? <FaLock size={14} className="text-red-400" /> : <FaBullhorn size={14} />} 
                          {isConfirmOpenSemLocked ? 'Open Seminar (Locked)' : 'Open Seminar'}
                      </button>
                      <button
                          onClick={() => executeAssignment('NEW_INQ', modalBatchId)}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                      >
                          <FaCommentDots size={14} /> Normal Inquiry (Inbox)
                      </button>
                  </div>

                  <button
                      onClick={() => { setAssignConfirmation(null); setModalBatchId(''); }}
                      className="w-full mt-3 text-slate-400 hover:text-white text-xs font-bold py-2 transition-colors"
                  >
                      Cancel Assignment
                  </button>
              </div>
          </div>
          );
      })()}

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

      {showBlockedModal && (
          <BlockedListModal
              isOpen={showBlockedModal}
              onClose={() => setShowBlockedModal(false)}
              onUnblockSuccess={() => {
                  fetchBlockedCount();
                  fetchLeads(true);
              }}
              crmPrefix="/after-seminar-crm"
          />
      )}
    </div>
  );
}
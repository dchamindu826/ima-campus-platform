import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import axios from '../../../api/axios';
import { resolveAvatarUrl } from '../../../utils/avatarUtils';
import { FaPhoneAlt, FaCheckCircle, FaTimesCircle, FaUserSecret, FaKey, FaMapMarkerAlt, FaGraduationCap, FaCreditCard, FaTimes, FaArrowsAlt, FaChevronRight, FaChevronLeft, FaLayerGroup, FaBan, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useCall } from '../../../contexts/CallContext';

export default function RightSidePanel({ selectedLead, activeMode, activeBusinessId, onBatchAssigned }) {
  const { startOutboundCall } = useCall();
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  // 🔥 BATCH ALLOCATION STATE 🔥
  const [batches, setBatches] = useState([]);
  const [selectedBatchToAssign, setSelectedBatchToAssign] = useState('');
  const [isAssigningBatch, setIsAssigningBatch] = useState(false);
  const [lockedBatchesMap, setLockedBatchesMap] = useState({});

  // 🔥 DRAG AND DROP STATE 🔥
  const [iframePos, setIframePos] = useState({ x: 50, y: 50 });
  const [ghostIframe, setGhostIframe] = useState(null);
  const [originalAdminSession, setOriginalAdminSession] = useState(null);

  // 🔥 MINIMIZE STATE 🔥
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (selectedLead?.phone) {
      fetchStudentData();
      setSelectedBatchToAssign(selectedLead.batchId?.toString() || '');
    } else {
      setSelectedBatchToAssign('');
    }
  }, [selectedLead, selectedLead?.batchId]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get('/admin/manager/batches-full');
        setBatches(res.data || []);
      } catch (err) {
        console.error("Failed to load batches", err);
      }
    };

    const fetchLockStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/after-seminar-crm/campaign-lock-status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.lockedMap) {
          setLockedBatchesMap(res.data.lockedMap);
        }
      } catch (err) {
        console.error("Failed to load campaign lock map", err);
      }
    };

    fetchBatches();
    fetchLockStatus();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/coordinator-crm/lead-details/${selectedLead.phone}`);
      setStudentDetails(res.data);
    } catch (error) {
      console.error("Error fetching student details", error);
    }
    setLoading(false);
  };

  const handleAssignBatch = async () => {
    if (!selectedBatchToAssign) return toast.error("Please select a batch first.");
    
    // Open Seminar locked for this batch: Open Seminar leads are refused; new (NORMAL) leads
    // are allocated as New Inquiries by the server.
    const isLeadInOpenSem = selectedLead?.inquiryType === 'OPEN_SEMINAR';
    if (isLeadInOpenSem && lockedBatchesMap[selectedBatchToAssign]) {
      return toast.error("The Opening Seminar campaign for this batch is currently locked by Management. Cannot allocate Open Seminar leads to it.");
    }

    setIsAssigningBatch(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/after-seminar-crm/leads/update-batch', {
        leadId: selectedLead.id,
        batchId: selectedBatchToAssign
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      toast.success(res?.data?.inquiryType === 'NEW_INQ' ? "Assigned as a New Inquiry (Open Seminar is locked for this batch)" : "Batch successfully assigned!");
      if (onBatchAssigned) {
        onBatchAssigned(selectedLead.id, selectedBatchToAssign);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to assign batch.");
    } finally {
      setIsAssigningBatch(false);
    }
  };

  const handleGhostLogin = async () => {
      if(!window.confirm(`Are you sure you want to log in as ${studentDetails.student.firstName}?`)) return;
      try {
          toast.loading("Initiating Ghost Login...", { id: "ghost" });
          
          const res = await axios.post('/admin/ghost-login', { studentId: studentDetails.student.id });
          
          if (res.data.token) {
              const currentToken = localStorage.getItem('token');
              const currentUser = localStorage.getItem('user');
              setOriginalAdminSession({ token: currentToken, user: currentUser });

              localStorage.setItem('token', res.data.token);
              localStorage.setItem('user', JSON.stringify(res.data.user));
              
              setIframePos({ x: window.innerWidth / 2 - 450, y: window.innerHeight / 2 - 300 });
              setGhostIframe('/student/dashboard');
              toast.success("Ghost Login Active!", { id: "ghost" });
          }
      } catch (error) {
          toast.error("Ghost login failed. Check backend route path.", { id: "ghost" });
      }
  };

  const closeGhostLogin = () => {
      if (originalAdminSession) {
          localStorage.setItem('token', originalAdminSession.token);
          localStorage.setItem('user', originalAdminSession.user);
      }
      setGhostIframe(null);
      toast.success("Restored Admin Session.");
  };

  const handleResetPassword = async (e) => {
      e.preventDefault();
      try {
          await axios.post('/coordinator-crm/reset-password', { studentId: studentDetails.student.id, newPassword });
          toast.success("Password successfully reset!");
          setShowResetModal(false);
          setNewPassword('');
      } catch (error) {
          toast.error("Password reset failed.");
      }
  };

  const getPaymentOption = (payment) => {
      if (!payment) return "N/A";
      let typeStr = payment.payment_type === 1 ? "Monthly" : payment.payment_type === 2 ? "Installment" : "Full Payment";
      return `${typeStr} via ${payment.method || 'Slip'}`;
  };

  const handleDragStart = (e) => {
      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = iframePos.x;
      const startPosY = iframePos.y;

      const onMouseMove = (moveEvent) => {
          setIframePos({
              x: startPosX + (moveEvent.clientX - startX),
              y: startPosY + (moveEvent.clientY - startY),
          });
      };

      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  // 🔥 INQUIRY TYPE CHANGER 🔥
  const handleInquiryTypeChange = async (e) => {
      const newType = e.target.value;

      // Check if trying to move to OPEN_SEMINAR when batch is locked
      if ((newType === 'OPEN_SEMINAR' || newType === 'NORMAL') && selectedLead?.batchId && lockedBatchesMap[selectedLead.batchId]) {
          return toast.error("Opening Seminar campaign for this batch is locked by Management. Cannot move lead to Open Seminar.");
      }

      const load = toast.loading(`Moving lead to ${newType}...`);
      try {
          const token = localStorage.getItem('token');
          await axios.post('/after-seminar-crm/leads/update-call', {
              leadId: selectedLead.id,
              inquiryType: newType,
              // Backend ekata yawanna ona anith values tika (Default ewa lead eke thiyena ewa yanawa update wena gaman)
              method: selectedLead.callMethod,
              status: selectedLead.callStatus,
              coordinationRound: selectedLead.coordinationRound,
              paymentIntention: selectedLead.paymentIntention,
              enrollmentStatus: selectedLead.enrollmentStatus
          }, { headers: { Authorization: `Bearer ${token}` } });
          
          toast.success(`Lead successfully moved!`, { id: load });
          setTimeout(() => window.location.reload(), 1000); // UI Refresh to update lists
      } catch (err) {
          toast.error(err.response?.data?.error || "Failed to move lead", { id: load });
      }
  };

  // 🔥 Extract Business ID from Phone and Filter Batches 🔥
  const bizMatch = selectedLead?.phone?.match(/_BIZ_(\d+)/);
  const leadBizId = activeBusinessId || (bizMatch ? bizMatch[1] : null);
  const displayBatches = leadBizId ? batches.filter(b => String(b.businessId) === String(leadBizId)) : batches;

  const currentAvatarUrl = resolveAvatarUrl(
    studentDetails?.student?.image || selectedLead?.avatar || selectedLead?.image,
    selectedLead?.phone,
    axios.defaults.baseURL
  );

  return (
    <div className={`${isMinimized ? 'w-[70px]' : 'w-[300px] xl:w-[320px]'} transition-all duration-300 ease-in-out bg-[#23303f] rounded-2xl flex flex-col shrink-0 overflow-hidden text-slate-400 border border-white/5 shadow-lg relative`}>
      
      {isMinimized ? (
         <div className="h-full w-full flex flex-col items-center py-6 cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => setIsMinimized(false)} title="Expand Panel">
            <button className="p-2 bg-black/20 group-hover:bg-blue-600/20 rounded-full hover:text-white mb-6 text-slate-500 group-hover:text-blue-400 transition-colors">
                <FaChevronLeft size={16} />
            </button>
            <div className="w-12 h-12 rounded-full border border-emerald-500/40 overflow-hidden shadow-md shrink-0 bg-[#2a3942] flex items-center justify-center">
              {currentAvatarUrl ? (
                <img 
                  src={currentAvatarUrl} 
                  alt={selectedLead.name || 'U'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = resolveAvatarUrl(null, selectedLead.phone, axios.defaults.baseURL);
                  }}
                />
              ) : (
                <span className="text-xl font-bold text-slate-300">
                  {selectedLead.name ? selectedLead.name.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </div>
         </div>
      ) : (
         <>
          <div className="bg-[#1a2430] p-6 flex flex-col items-center justify-center border-b border-white/5 relative">
            <button onClick={() => setIsMinimized(true)} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full hover:bg-black/40 hover:text-white transition-colors text-slate-400" title="Minimize Panel">
               <FaChevronRight size={14}/>
            </button>

            <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 overflow-hidden mb-3 shadow-xl shrink-0 bg-[#2a3942] flex items-center justify-center">
              {currentAvatarUrl ? (
                <img 
                  src={currentAvatarUrl} 
                  alt={selectedLead.name || 'U'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = resolveAvatarUrl(null, selectedLead.phone, axios.defaults.baseURL);
                  }}
                />
              ) : (
                <span className="text-3xl font-bold text-slate-300">
                  {selectedLead.name ? selectedLead.name.charAt(0).toUpperCase() : 'U'}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-center text-slate-200">{selectedLead.name || 'Unknown Lead'}</h2>
            <div className="flex items-center gap-2 mt-2 text-xs bg-[#0b141a] px-3 py-1.5 rounded-full border border-slate-700 text-emerald-400">
              <FaPhoneAlt size={10} /> {selectedLead.phone}
            </div>
            {selectedLead?.waCallPermissionStatus === 'ALLOWED' && (
              <button 
                onClick={() => startOutboundCall && startOutboundCall({ lead: selectedLead, businessId: selectedLead?.batch?.businessId, campaignType: selectedLead?.campaignType || 'AFTER_SEMINAR' })}
                className="w-full mt-3 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02]"
              >
                <FaPhoneAlt size={11} /> Call via WhatsApp (Allowed)
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#23303f]">
            
            {/* LEAD STATUS */}
            <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 mb-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lead Status</h3>
                {selectedLead.isBlocked && (
                  <span className="bg-red-500/20 text-red-400 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                    <FaBan size={8}/> Blocked
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-400">Phase</span>
                <span className="text-xs font-bold text-emerald-500">Phase {selectedLead.phase}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-400">Call Status</span>
                <span className="text-sm font-semibold capitalize text-slate-300">{selectedLead.callStatus}</span>
              </div>

              {/* 🔥 INQUIRY TAB MOVER 🔥 */}
              {(() => {
                const isCurrentBatchLocked = Boolean(selectedLead?.batchId && lockedBatchesMap[selectedLead.batchId]);
                return (
                  <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-700/50 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-400">Inquiry Tab</span>
                      <select 
                        value={selectedLead.inquiryType || 'NEW_INQ'}
                        onChange={handleInquiryTypeChange}
                        className={`text-[10px] font-bold border rounded-lg px-2 py-1.5 outline-none cursor-pointer uppercase tracking-wider ${
                          isCurrentBatchLocked && (selectedLead.inquiryType === 'OPEN_SEMINAR' || selectedLead.inquiryType === 'NORMAL')
                            ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                            : 'bg-[#0f172a] text-emerald-400 border-slate-600'
                        }`}
                      >
                        <option value="NEW_INQ">New Inbox</option>
                        <option 
                          value="OPEN_SEMINAR" 
                          disabled={isCurrentBatchLocked && selectedLead.inquiryType !== 'OPEN_SEMINAR'}
                          className={isCurrentBatchLocked && selectedLead.inquiryType !== 'OPEN_SEMINAR' ? 'text-slate-500 bg-slate-900 opacity-40' : ''}
                        >
                          {isCurrentBatchLocked && selectedLead.inquiryType !== 'OPEN_SEMINAR' ? '🔒 Open Seminar (Locked)' : 'Open Seminar'}
                        </option>
                        <option value="NORMAL">Imported (Normal)</option>
                      </select>
                    </div>
                    {isCurrentBatchLocked && (
                      <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                        <FaLock size={9} /> Open Seminar Campaign Locked for Batch
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 🔥 QUICK LEAD ACTIONS (BLOCK / UNBLOCK) 🔥 */}
            <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 mb-4 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Security & Access</h3>
              {selectedLead.isBlocked ? (
                <button 
                  onClick={async () => {
                    if (!window.confirm(`Are you sure you want to unblock ${selectedLead.phone}?`)) return;
                    try {
                      const token = localStorage.getItem('token');
                      await axios.post('/after-seminar-crm/leads/unblock', { leadId: selectedLead.id, phone: selectedLead.phone }, { headers: { Authorization: `Bearer ${token}` } });
                      selectedLead.isBlocked = false;
                      toast.success(`Unblocked ${selectedLead.phone}`);
                      setTimeout(() => window.location.reload(), 600);
                    } catch (e) {
                      toast.error("Failed to unblock");
                    }
                  }}
                  className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <FaBan size={12}/> Unblock Phone Number
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    const reason = window.prompt(`Enter block reason for ${selectedLead.phone}:`, "Spam / Unwanted");
                    if (reason === null) return;
                    try {
                      const token = localStorage.getItem('token');
                      await axios.post('/after-seminar-crm/leads/block', { leadId: selectedLead.id, phone: selectedLead.phone, reason }, { headers: { Authorization: `Bearer ${token}` } });
                      selectedLead.isBlocked = true;
                      toast.success(`Blocked ${selectedLead.phone}`);
                      setTimeout(() => window.location.reload(), 600);
                    } catch (e) {
                      toast.error("Failed to block");
                    }
                  }}
                  className="w-full bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <FaBan size={12}/> Block Phone Number
                </button>
              )}
            </div>

            {/* 🔥 BATCH ALLOCATION SECTION 🔥 */}
            {(() => {
              const isLeadInOpenSem = selectedLead?.inquiryType === 'OPEN_SEMINAR';
              const isSelectedBatchLocked = Boolean(selectedBatchToAssign && lockedBatchesMap[selectedBatchToAssign]);
              const shouldDisableAllocation = isLeadInOpenSem && isSelectedBatchLocked;
              const willBecomeNewInquiry = !isLeadInOpenSem && isSelectedBatchLocked;

              return (
                <div className={`p-4 rounded-xl border border-white/5 mb-4 shadow-sm transition-all ${
                  shouldDisableAllocation ? 'bg-red-950/20 border-red-500/30' : 'bg-[#1a2430]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <FaLayerGroup /> Allocate to Batch
                    </h3>
                    {shouldDisableAllocation && (
                      <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                        <FaLock size={8} /> Open Sem Locked
                      </span>
                    )}
                  </div>
                  <select 
                    value={selectedBatchToAssign} 
                    onChange={(e) => setSelectedBatchToAssign(e.target.value)}
                    className={`w-full mb-3 p-2 text-xs bg-[#0f172a] border rounded-lg outline-none transition-colors ${
                      shouldDisableAllocation 
                        ? 'border-red-500/50 text-red-300' 
                        : 'border-slate-700 text-slate-300 focus:border-emerald-600'
                    }`}
                  >
                    <option value="">-- Unassigned (Select Batch) --</option>
                    {displayBatches.map(b => {
                      const isLocked = Boolean(lockedBatchesMap[b.id]);
                      return (
                        <option 
                          key={b.id} 
                          value={b.id}
                          className={isLocked ? 'text-rose-400 bg-slate-900' : ''}
                        >
                          {b.name} {isLocked ? (selectedLead?.inquiryType === 'OPEN_SEMINAR' ? '🔒 [Open Sem Locked]' : '(→ New Inquiry)') : ''}
                        </option>
                      );
                    })}
                  </select>

                  {shouldDisableAllocation && (
                    <p className="text-[10px] text-rose-400/90 mb-2.5 leading-snug">
                      ⚠️ Opening Seminar campaign for this batch is locked. Open Seminar lead allocations are disabled.
                    </p>
                  )}
                  {willBecomeNewInquiry && (
                    <p className="text-[10px] text-amber-300/90 mb-2.5 leading-snug">
                      ℹ️ Open Seminar is locked for this batch — this lead will be added as a <b>New Inquiry</b>.
                    </p>
                  )}

                  <button 
                    onClick={handleAssignBatch}
                    disabled={isAssigningBatch || shouldDisableAllocation}
                    className={`w-full font-bold py-2 rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${
                      shouldDisableAllocation
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-40 cursor-not-allowed pointer-events-none'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50'
                    }`}
                  >
                    {isAssigningBatch ? 'Saving...' : shouldDisableAllocation ? '🔒 Campaign Locked' : 'Save Batch'}
                  </button>
                </div>
              );
            })()}

            {/* SYSTEM RECORDS */}
            <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">System Records</h3>
              
              {loading ? (
                <div className="animate-pulse flex flex-col gap-2">
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                </div>
              ) : studentDetails?.isEnrolled ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-900/50 text-xs">
                        <FaCheckCircle size={14}/> Registered Student
                    </div>

                    <div className="space-y-2.5">
                        <div className="text-xs">
                            <span className="text-slate-500 block mb-0.5">Full Name & ID</span>
                            <span className="text-slate-200 font-semibold">{studentDetails.student.firstName} {studentDetails.student.lastName} (ID: {studentDetails.student.id})</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 block mb-0.5"><FaMapMarkerAlt className="inline mr-1"/> Address</span>
                            <span className="text-slate-300">{studentDetails.student.addressHouseNo}, {studentDetails.student.addressStreet}, {studentDetails.student.city}</span>
                        </div>
                        
                        {(() => {
                            const uniqueEnrollments = studentDetails.student.payments?.reduce((acc, p) => {
                                const key = `${p.businessId}_${p.batchId}_${p.classType || p.group?.classType || 1}`;
                                if (!acc[key]) {
                                    acc[key] = { ...p, courses: p.courses ? [...p.courses] : [] };
                                } else {
                                    if(p.courses) {
                                        const existingCourseIds = acc[key].courses.map(c => c.id);
                                        const newCourses = p.courses.filter(c => !existingCourseIds.includes(c.id));
                                        acc[key].courses = [...acc[key].courses, ...newCourses];
                                    }
                                }
                                return acc;
                            }, {});
                            return uniqueEnrollments ? Object.values(uniqueEnrollments).map((payment, idx) => (
                                <div key={idx} className={idx > 0 ? "mt-4" : ""}>
                                    <div className="text-xs mt-3 pt-3 border-t border-slate-700">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-slate-500"><FaGraduationCap className="inline mr-1"/> Enrollment #{idx + 1}</span>
                                            {payment.classType === 2 || payment.group?.classType === 2 ? (
                                                <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">📝 Paper Class</span>
                                            ) : (
                                                <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">📘 Theory Class</span>
                                            )}
                                        </div>
                                        <span className="text-blue-300 font-bold block">{payment.business?.name}</span>
                                        <span className="text-slate-400 block">{payment.batch?.name}</span>
                                    </div>
                                    <div className="text-xs mt-2">
                                        <span className="text-slate-500 block mb-0.5">Enrolled Subjects</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {payment.courses?.map(c => (
                                                <span key={c.id} className="bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700">{c.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-xs mt-3">
                                        <span className="text-slate-500 block mb-0.5"><FaCreditCard className="inline mr-1"/> Payment Option</span>
                                        <span className="text-emerald-400 font-semibold">{getPaymentOption(payment)}</span>
                                    </div>
                                </div>
                            )) : null;
                        })()}
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-700 space-y-2">
                        <button onClick={handleGhostLogin} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                            <FaUserSecret size={14}/> Ghost Login
                        </button>
                        <button onClick={() => setShowResetModal(true)} className="w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                            <FaKey size={12}/> Reset Password
                        </button>
                    </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-amber-500 font-medium bg-[#3a2512]/30 p-3 rounded-lg border border-[#3a2512] text-xs leading-relaxed shadow-inner">
                  <FaTimesCircle className="shrink-0 text-base mt-0.5" /> 
                  Not registered in the main system yet.
                </div>
              )}
            </div>
          </div>
         </>
      )}

      {showResetModal && (
         <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-5 w-full shadow-2xl">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2"><FaKey/> Reset Password</h3>
                     <button onClick={()=>setShowResetModal(false)} className="text-slate-500 hover:text-white"><FaTimes/></button>
                 </div>
                 <form onSubmit={handleResetPassword}>
                     <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter new password" required className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg p-3 mb-4 text-sm outline-none focus:border-amber-500" />
                     <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-lg">Confirm Reset</button>
                 </form>
             </div>
         </div>
      )}

      {ghostIframe && createPortal(
          <div className="fixed inset-0 z-[99999] pointer-events-none">
              <div 
                  className="absolute pointer-events-auto bg-white flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.5)] border border-slate-600 rounded-2xl overflow-hidden"
                  style={{
                      left: `${iframePos.x}px`,
                      top: `${iframePos.y}px`,
                      width: '1100px',
                      height: '700px',
                      resize: 'both',
                      minWidth: '400px',
                      minHeight: '300px'
                  }}
              >
                  <div 
                      onMouseDown={handleDragStart}
                      className="w-full bg-[#1e293b] border-b border-slate-700 px-4 py-3 flex justify-between items-center z-10 shrink-0 cursor-move"
                  >
                      <div className="flex items-center gap-3 pointer-events-none">
                          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                              <FaArrowsAlt size={16} />
                          </div>
                          <div>
                              <h3 className="text-white font-bold text-sm">Ghost Login Active</h3>
                              <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest">Landscape Dashboard</p>
                          </div>
                      </div>
                      <button 
                          onMouseDown={(e) => e.stopPropagation()} 
                          onClick={closeGhostLogin} 
                          className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all text-xs uppercase tracking-widest"
                      >
                          <FaTimes size={12} /> Close
                      </button>
                  </div>
                  
                  <div className="flex-1 w-full bg-[#f8fafc]">
                      <iframe src={ghostIframe} className="w-full h-full border-none" title="Ghost Login View"></iframe>
                  </div>
              </div>
          </div>,
          document.body
      )}

    </div>
  );
}
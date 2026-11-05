import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import axios from '../../api/axios';
import { resolveAvatarUrl } from '../../utils/avatarUtils';
import { FaPhoneAlt, FaCheckCircle, FaTimesCircle, FaUserSecret, FaKey, FaMapMarkerAlt, FaGraduationCap, FaCreditCard, FaTimes, FaArrowsAlt, FaChevronRight, FaChevronLeft, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useCall } from '../../contexts/CallContext';

export default function RightSidePanel({ selectedLead, activeMode, selectedBusiness, onBatchAssigned, availableBatches }) {
  const { startOutboundCall } = useCall();
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [lastResetPassword, setLastResetPassword] = useState(null);
  // 🔥 DRAG AND DROP STATE 🔥
  const [iframePos, setIframePos] = useState({ x: 50, y: 50 });
  const [ghostIframe, setGhostIframe] = useState(null);
  const [originalAdminSession, setOriginalAdminSession] = useState(null);

  // 🔥 MINIMIZE STATE 🔥
  const [isMinimized, setIsMinimized] = useState(false);

  // 🔥 BATCH ALLOCATION STATE 🔥
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [allocating, setAllocating] = useState(false);
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

  // 🔥 CALL ACTIONS STATE (for Call Center Mode) 🔥
  const [callMethod, setCallMethod] = useState('Direct Call');
  const [callOutcome, setCallOutcome] = useState('PENDING');
  const [feedbackRemarks, setFeedbackRemarks] = useState('');
  const [updatingCallStatus, setUpdatingCallStatus] = useState(false);

  useEffect(() => {
    if (selectedLead?.phone) fetchStudentData();
    if (selectedLead?.batchId) {
      setSelectedBatchId(selectedLead.batchId.toString());
    } else {
      setSelectedBatchId('');
    }
    if (selectedLead) {
      setCallMethod(selectedLead.callMethod || 'Direct Call');
      const outcome = ['ANSWERED', 'REJECT', 'NO_ANSWER'].includes(selectedLead.callStatus?.toUpperCase())
        ? selectedLead.callStatus.toUpperCase()
        : 'PENDING';
      setCallOutcome(outcome);
      setFeedbackRemarks(selectedLead.feedback || '');
    }
  }, [selectedLead]);

  useEffect(() => {
    if (availableBatches && Array.isArray(availableBatches) && availableBatches.length > 0) {
      setBatches(availableBatches);
    } else {
      fetchBatches();
    }
  }, [selectedBusiness, availableBatches]);

  const fetchBatches = async () => {
    try {
      if (selectedBusiness) {
        const res = await axios.get(`/admin/batches/${selectedBusiness}`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.batches || []);
        if (list && list.length > 0) {
          setBatches(list);
          return;
        }
      }
      const res = await axios.get('/admin/manager/batches-full');
      const allBatches = Array.isArray(res.data) ? res.data : (res.data?.batches || []);
      const filtered = selectedBusiness
        ? allBatches.filter(b => b.businessId === parseInt(selectedBusiness))
        : allBatches;
      setBatches(filtered);
    } catch (error) {
      console.error("Error fetching batches", error);
      try {
        const resLanding = await axios.get('/public/landing-data');
        if (resLanding.data && resLanding.data.businesses) {
          let allBatches = [];
          if (selectedBusiness) {
            const biz = resLanding.data.businesses.find(b => b.id === parseInt(selectedBusiness));
            allBatches = biz ? (biz.batches || []) : [];
          } else {
            allBatches = resLanding.data.businesses.flatMap(biz => biz.batches || []);
          }
          if (allBatches.length > 0) setBatches(allBatches);
        }
      } catch (e) {}
    }
  };

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
              
              // Set initial position centered
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
          setLastResetPassword(newPassword);
      } catch (error) {
          toast.error("Password reset failed.");
      }
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(lastResetPassword);
      toast.success("Password Copied!");
      setTimeout(() => { setShowResetModal(false); setLastResetPassword(null); setNewPassword(''); }, 1000); 
  };

  const getPaymentOption = (payment) => {
      if (!payment) return "N/A";
      let typeStr = payment.payment_type === 1 ? "Monthly" : payment.payment_type === 2 ? "Installment" : "Full Payment";
      return `${typeStr} via ${payment.method || 'Slip'}`;
  };

  // 🔥 DRAG HANDLER LOGIC 🔥
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

  const handleAllocateBatch = async () => {
      if (!selectedBatchId) return toast.error("Please select a batch to allocate");
      try {
          setAllocating(true);
          const token = localStorage.getItem('token');
          await axios.post('/coordinator-crm/leads/update-batch', {
              leadId: selectedLead.id,
              batchId: selectedBatchId
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success("Lead successfully allocated to batch!");
          // Trigger local state update
          if (onBatchAssigned) {
             onBatchAssigned(selectedLead.id, parseInt(selectedBatchId));
          } else if (selectedLead) {
             selectedLead.batchId = parseInt(selectedBatchId);
          }
      } catch (error) {
          toast.error("Failed to allocate batch.");
      } finally {
          setAllocating(false);
      }
  };

  const currentAvatarUrl = resolveAvatarUrl(
    studentDetails?.student?.image || selectedLead?.avatar || selectedLead?.image,
    selectedLead?.phone,
    axios.defaults.baseURL
  );

  return (
    <div className={`${isMinimized ? 'w-[70px]' : 'w-[300px] xl:w-[320px]'} transition-all duration-300 ease-in-out bg-[#23303f] rounded-2xl flex flex-col shrink-0 overflow-hidden text-slate-400 border border-white/5 shadow-lg relative`}>
      
      {isMinimized ? (
         // Minimized View
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
         // Expanded View
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
                onClick={() => startOutboundCall && startOutboundCall({ lead: selectedLead, businessId: selectedLead?.batch?.businessId, campaignType: selectedLead?.campaignType || 'FREE_SEMINAR' })}
                className="w-full mt-3 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-[1.02]"
              >
                <FaPhoneAlt size={11} /> Call via WhatsApp (Allowed)
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#23303f]">
            <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 mb-4 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Lead Status</h3>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-400">Phase</span>
                <span className="text-xs font-bold text-emerald-500">Phase {selectedLead.phase}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-400">Call Status</span>
                <span className="text-sm font-semibold capitalize text-slate-300">{selectedLead.callStatus}</span>
              </div>
            </div>

            <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">System Records</h3>
              
              {loading ? (
                <div className="animate-pulse flex flex-col gap-2">
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                </div>
              ) : studentDetails?.isEnrolled ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-900/50">
                      <img 
                        src={resolveAvatarUrl(studentDetails.student.image, selectedLead?.phone, axios.defaults.baseURL)} 
                        alt="Profile" 
                        className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 shadow-sm shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = resolveAvatarUrl(null, selectedLead?.phone, axios.defaults.baseURL);
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                          <FaCheckCircle size={13}/> Registered Student
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium truncate block">
                          {studentDetails.student.firstName} {studentDetails.student.lastName}
                        </span>
                      </div>
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

            {/* 🔥 BATCH ALLOCATION UI 🔥 */}
            {(() => {
              const isLeadInOpenSem = selectedLead?.inquiryType === 'OPEN_SEMINAR';
              const isSelectedBatchLocked = Boolean(selectedBatchId && lockedBatchesMap[selectedBatchId]);
              const shouldDisableAllocation = isLeadInOpenSem && isSelectedBatchLocked;

              return (
                <div className={`p-4 rounded-xl border border-white/5 shadow-sm mt-4 transition-all ${
                  shouldDisableAllocation ? 'bg-red-950/20 border-red-500/30' : 'bg-[#1a2430]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch Allocation</h3>
                    {shouldDisableAllocation && (
                      <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                        <FaLock size={8} /> Open Sem Locked
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">Allocate this lead to an active Free Seminar batch manually.</p>
                  <select 
                    value={selectedBatchId} 
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className={`w-full mb-3 p-2 text-xs bg-[#0f172a] border rounded-lg outline-none transition-colors ${
                      shouldDisableAllocation 
                        ? 'border-red-500/50 text-red-300' 
                        : 'border-slate-700 text-slate-300 focus:border-emerald-700'
                    }`}
                  >
                    <option value="">Select Batch...</option>
                    {batches.map(b => {
                      const isLocked = isLeadInOpenSem && Boolean(lockedBatchesMap[b.id]);
                      return (
                        <option 
                          key={b.id} 
                          value={b.id}
                          className={isLocked ? 'text-rose-400 bg-slate-900' : ''}
                        >
                          {b.name} {isLocked ? '🔒 [Open Sem Locked]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {shouldDisableAllocation && (
                    <p className="text-[10px] text-rose-400/90 mb-2.5 leading-snug">
                      ⚠️ Opening Seminar campaign for this batch is locked. Open Seminar lead allocations are disabled.
                    </p>
                  )}

                  <button 
                    onClick={handleAllocateBatch} 
                    disabled={allocating || !selectedBatchId || shouldDisableAllocation}
                    className={`w-full font-bold py-2 rounded-lg transition-all shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      shouldDisableAllocation
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-40 cursor-not-allowed pointer-events-none'
                        : 'bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white'
                    }`}
                  >
                    {allocating ? 'Allocating...' : shouldDisableAllocation ? '🔒 Campaign Locked' : 'Allocate to Batch'}
                  </button>
                </div>
              );
            })()}

            {activeMode === 'CALL_CAMPAIGN' && (
              <div className="mt-4 bg-[#1e3a8a]/10 p-4 rounded-xl border border-blue-900/30 shadow-sm">
                 <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">Call Actions</h3>
                 
                 <div className="grid grid-cols-2 gap-2 mb-3">
                   <div>
                     <label className="text-[10px] text-slate-400 font-bold block mb-1">Method</label>
                     <select 
                       value={callMethod}
                       onChange={(e) => setCallMethod(e.target.value)}
                       className="w-full p-2 text-xs bg-[#0f172a] border border-slate-700 text-slate-300 rounded-lg outline-none focus:border-blue-700"
                     >
                       <option value="Direct Call">Direct Call</option>
                       <option value="WhatsApp">WhatsApp</option>
                       <option value="3CX">3CX</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] text-slate-400 font-bold block mb-1">Outcome</label>
                     <select 
                       value={callOutcome}
                       onChange={(e) => setCallOutcome(e.target.value)}
                       className={`w-full p-2 text-xs bg-[#0f172a] border rounded-lg outline-none font-bold ${
                         callOutcome === 'ANSWERED' ? 'text-emerald-400 border-emerald-500/40' :
                         callOutcome === 'NO_ANSWER' ? 'text-blue-400 border-blue-500/40' :
                         callOutcome === 'REJECT' ? 'text-rose-400 border-rose-500/40' :
                         'text-amber-400 border-amber-500/40'
                       }`}
                     >
                       <option value="PENDING">⌛ PENDING</option>
                       <option value="ANSWERED">✅ ANSWERED</option>
                       <option value="NO_ANSWER">🔇 NO ANSWER</option>
                       <option value="REJECT">❌ REJECT</option>
                     </select>
                   </div>
                 </div>

                 <label className="text-[10px] text-slate-400 font-bold block mb-1">Remarks</label>
                 <textarea 
                    value={feedbackRemarks}
                    onChange={(e) => setFeedbackRemarks(e.target.value)}
                    className="w-full p-2 text-sm bg-[#0f172a] border border-slate-700 text-slate-300 rounded-lg outline-none focus:border-blue-700 mb-3 placeholder-slate-600 resize-none" 
                    rows="3" 
                    placeholder="Enter feedback/remarks here..."
                 ></textarea>

                 <button 
                   onClick={async () => {
                     if (!selectedLead?.id) return;
                     setUpdatingCallStatus(true);
                     try {
                       const token = localStorage.getItem('token');
                       await axios.post('/call-center/agent-v2/update-progress', {
                         leadId: selectedLead.id,
                         roundNum: selectedLead.coordinationRound || 1,
                         callMethod,
                         callOutcome: callOutcome !== 'PENDING' ? callOutcome : (selectedLead.callStatus || 'PENDING'),
                         feedback: feedbackRemarks,
                         attempts: selectedLead.callAttempt || 1
                       }, {
                         headers: { Authorization: `Bearer ${token}` }
                       });
                       if (selectedLead) {
                         selectedLead.feedback = feedbackRemarks;
                         if (callOutcome !== 'PENDING') selectedLead.callStatus = callOutcome;
                         selectedLead.callMethod = callMethod;
                       }
                       toast.success("Call status & remarks updated!");
                     } catch (err) {
                       console.error("Update call status error:", err);
                       toast.error("Failed to update call status & remarks.");
                     } finally {
                       setUpdatingCallStatus(false);
                     }
                   }}
                   disabled={updatingCallStatus}
                   className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-slate-100 font-semibold py-2 rounded-lg transition-colors shadow-md text-sm flex items-center justify-center gap-2"
                 >
                   {updatingCallStatus ? 'Updating...' : 'Update Status & Remarks'}
                 </button>
              </div>
            )}
          </div>
         </>
      )}

      {showResetModal && (
         <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-5 w-full shadow-2xl">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2"><FaKey/> Reset Password</h3>
                     <button onClick={()=>{setShowResetModal(false); setLastResetPassword(null); setNewPassword('');}} className="text-slate-500 hover:text-white"><FaTimes/></button>
                 </div>
                 {lastResetPassword ? (
                     <div className="animate-in zoom-in duration-300">
                         <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center mb-4 shadow-inner">
                             <FaCheckCircle className="text-emerald-400 mx-auto mb-2" size={28} />
                             <p className="text-emerald-400 font-bold text-[10px] uppercase mb-1">Password Changed!</p>
                             <p className="text-white text-lg font-mono tracking-widest bg-black/40 py-2 rounded-lg border border-white/5 mt-2 shadow-inner select-all">{lastResetPassword}</p>
                         </div>
                         <button onClick={copyToClipboard} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-lg uppercase">
                             Copy Password & Close
                         </button>
                     </div>
                 ) : (
                     <form onSubmit={handleResetPassword}>
                         <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter new password" required className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg p-3 mb-4 text-sm outline-none focus:border-amber-500" />
                         <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-lg">Confirm Reset</button>
                     </form>
                 )}
             </div>
         </div>
      )}

      {/* 🔥 Ghost Login Floating Resizable Window 🔥 */}
      {ghostIframe && createPortal(
          <div className="fixed inset-0 z-[99999] pointer-events-none">
              <div 
                  className="absolute pointer-events-auto bg-white flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.5)] border border-slate-600 rounded-2xl overflow-hidden"
                  style={{
                      left: `${iframePos.x}px`,
                      top: `${iframePos.y}px`,
                      width: '900px',
                      height: '600px',
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
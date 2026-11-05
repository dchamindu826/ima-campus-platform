import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../../api/axios';
import { FaSearch, FaCommentDots, FaArrowRight, FaTimes, FaBell, FaSave, FaTrash, FaCheckCircle, FaExclamationCircle, FaUser, FaMapMarkerAlt, FaGraduationCap, FaCreditCard, FaInfoCircle, FaFileExcel, FaPhoneAlt, FaWhatsapp, FaClock, FaBan } from 'react-icons/fa';
import { Target, PhoneCall, Check, Loader, BookOpen, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import CoordinatorGoalTrackerWidget from '../../CampaignStatsModules/CoordinatorGoalTrackerWidget';

export default function AfterSeminarOpenSem({ leads, allBatches, filters, drafts, setDrafts, handleUpdateLocalLead, handleSaveCallData, setChatModalLead, isManager, handleTempUnlock, externalSearch }) {

    const [activeRound, setActiveRound] = useState('r1');
    const [activePhase, setActivePhase] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState(externalSearch || '');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, DELAYED
    const [currentPage, setCurrentPage] = useState(1);
    const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);
    const [guidanceLang, setGuidanceLang] = useState('SI');

    const [currentTime, setCurrentTime] = useState(new Date().getTime());
    const [campaignStats, setCampaignStats] = useState(null);

    useEffect(() => {
        if (filters?.selectedBusiness) {
            const token = localStorage.getItem('token');
            axios.get('/after-seminar-crm/stats/open-seminar', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    businessId: filters.selectedBusiness,
                    batchId: filters.selectedBatch || 'ALL'
                }
            }).then(res => {
                if (res.data) setCampaignStats(res.data);
            }).catch(err => {
                console.error("Failed to fetch open seminar stats for tracker widget", err);
            });
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    const handleCopy = (text, label) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success(`${label} copied!`, { style: { background: '#0F172A', color: '#fff', border: '1px solid #334155' } });
            }).catch(() => toast.error(`Failed to copy ${label}`));
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success(`${label} copied!`, { style: { background: '#0F172A', color: '#fff', border: '1px solid #334155' } });
            } catch (err) {
                toast.error(`Failed to copy ${label}.`);
            }
            textArea.remove();
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().getTime());
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const [showReminder, setShowReminder] = useState(false);
    const [reminderLead, setReminderLead] = useState(null);
    const [existingReminderId, setExistingReminderId] = useState(null);
    const [remindDate, setRemindDate] = useState('');
    const [remindTime, setRemindTime] = useState('');
    const [remindNote, setRemindNote] = useState('');
    const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);

    const [draftStatus, setDraftStatus] = useState({});
    const [draftAttempt, setDraftAttempt] = useState({});
    const [draftMethod, setDraftMethod] = useState({});
    const [viewMode, setViewMode] = useState('TILE'); // 'TILE' or 'TABLE'
    
    const [studentDetailsLead, setStudentDetailsLead] = useState(null);
    const [studentDetailsData, setStudentDetailsData] = useState(null);
    const [isStudentDetailsLoading, setIsStudentDetailsLoading] = useState(false);

    useEffect(() => {
        if (studentDetailsLead?.phone) {
            setIsStudentDetailsLoading(true);
            const phone = studentDetailsLead.phone.split('_')[0].replace(/[^0-9]/g, '');
            axios.get(`/coordinator-crm/lead-details/${phone}`)
                .then(res => {
                    setStudentDetailsData(res.data);
                    setIsStudentDetailsLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching student details", err);
                    toast.error("Failed to fetch student details.");
                    setIsStudentDetailsLoading(false);
                });
        } else {
            setStudentDetailsData(null);
        }
    }, [studentDetailsLead]);

    const getPaymentOption = (payment) => {
        if (!payment) return "N/A";
        let typeStr = payment.payment_type === 1 ? "Monthly" : payment.payment_type === 2 ? "Installment" : "Full Payment";
        return `${typeStr} via ${payment.method || 'Slip'}`;
    };

    const ITEMS_PER_PAGE = 20;

    const openSemLeads = Array.isArray(leads) ? leads.filter(l => l?.inquiryType === 'OPEN_SEMINAR' || l?.inquiryType === 'NORMAL' || !l?.inquiryType) : [];

    const isLeadDelayed = (l) => {
        if (((((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_')))) || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))) return false;
        if (l.isPast) return false;

        const startTime = new Date(l.assignedAt || l.createdAt).getTime();
        const now = new Date().getTime();
        const diffMs = now - startTime;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

        const currentRound = l.coordinationRound || 1;

        if (currentRound === 1) {
            return diffMs > sevenDaysMs;
        } else if (currentRound === 2) {
            return diffMs > fourteenDaysMs;
        }
        return false;
    };

    const isLeadPending = (l) => {
        return !l.callStatus || l.callStatus === 'pending' || l.callStatus === '';
    };

    const isAutoPushedToNonEnrolled = (l) => {
        if (((((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))) return false;
        if ((l.coordinationRound || 1) === 2) {
            const startTime = new Date(l.assignedAt || l.createdAt).getTime();
            const diffMs = new Date().getTime() - startTime;
            const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
            return diffMs > fourteenDaysMs;
        }
        return false;
    };

    const getRoundData = (lead, targetRoundStr) => {
        const currentRound = lead.coordinationRound || 1;
        let targetRoundNum = 1;
        if (targetRoundStr === 'r2') targetRoundNum = 2;
        
        if (targetRoundStr === 'enrolled' || targetRoundStr === 'non_enrolled') {
            return { ...lead, isCurrent: true, isPast: false };
        }

        if (currentRound < targetRoundNum) return null;

        if (currentRound === targetRoundNum) {
            return {
                ...lead,
                isPast: false,
                isCurrent: true,
            };
        }

        if (currentRound > targetRoundNum) {
            return null; // As requested, lead should disappear from Round 1 once it moves to Round 2
        }
        return null;
    };

    const baseRoundLeads = useMemo(() => {
        let baseLeads = openSemLeads;
        if (activeRound === 'enrolled') {
            baseLeads = baseLeads.filter(l => ((((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))));
        } else if (activeRound === 'non_enrolled') {
            baseLeads = baseLeads.filter(l => {
                if (((((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))) return false;
                if (l?.coordinationRound === 3) return true;
                if (isAutoPushedToNonEnrolled(l)) return true;
                
                return false;
            });
        } else {
            baseLeads = baseLeads
                .filter(l => (!(((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))))
                .filter(l => {
                    if (isAutoPushedToNonEnrolled(l)) return false;
                    return true;
                })
                .map(l => getRoundData(l, activeRound))
                .filter(Boolean);
        }
        return baseLeads;
    }, [openSemLeads, activeRound]);

    const filteredLeads = useMemo(() => {
        let filtered = baseRoundLeads;

        if (activePhase !== 'ALL') filtered = filtered.filter(l => l?.phase === activePhase);

        if (statusFilter === 'PENDING') {
            filtered = filtered.filter(isLeadPending);
        } else if (statusFilter === 'DELAYED') {
            filtered = filtered.filter(isLeadDelayed);
        } else if (statusFilter === 'NO_ANSWER') {
            filtered = filtered.filter(l => l.callStatus === 'no_answer');
        } else if (statusFilter === 'REJECT') {
            filtered = filtered.filter(l => l.callStatus === 'reject');
        }

        if (activeRound === 'r1') {
            filtered = filtered.filter(l => (l?.coordinationRound || 1) === 1);
        } else if (activeRound === 'r2') {
            filtered = filtered.filter(l => (l?.coordinationRound || 1) === 2);
        }

        if (searchQuery) {
            const sq = searchQuery.toLowerCase();
            filtered = filtered.filter(l => l?.phone?.includes(sq) || (l?.name && l?.name?.toLowerCase().includes(sq)));
        }

        const checkIsFrozen = (l) => {
            if (!l || !l.assignedAt) return false;
            if (l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID') return false;
            const round = l.openSemRound || l.coordinationRound || 1;
            if (round === 2) {
                const startTime = new Date(l.assignedAt).getTime();
                const diffDays = (new Date().getTime() - startTime) / (1000 * 60 * 60 * 24);
                return diffDays < 6;
            }
            return false;
        };

        filtered.sort((a, b) => {
            const aFrozen = checkIsFrozen(a) ? 1 : 0;
            const bFrozen = checkIsFrozen(b) ? 1 : 0;

            // 1. Unfrozen (Active) leads come FIRST (0), Frozen leads come LAST (1)
            if (aFrozen !== bFrozen) {
                return aFrozen - bFrozen;
            }

            const aRejected = a?.callStatus === 'reject';
            const bRejected = b?.callStatus === 'reject';
            
            // 2. Always put rejected leads at the very bottom
            if (aRejected && !bRejected) return 1;
            if (!aRejected && bRejected) return -1;

            // 3. If BOTH are frozen: sort by unfreezing SOONEST first (oldest assignedAt first: 1D, 2D... then 5D, 6D)
            if (aFrozen && bFrozen) {
                const aTime = new Date(a?.assignedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.assignedAt || b?.createdAt || 0).getTime();
                return aTime - bTime;
            }

            if (activeRound === 'r2') {
                const aAnswered = a?.callStatus === 'answered';
                const bAnswered = b?.callStatus === 'answered';

                // Answered leads go to the bottom (just above Rejects)
                if (aAnswered && !bAnswered) return 1;
                if (!aAnswered && bAnswered) return -1;

                const aPending = isLeadPending(a);
                const bPending = isLeadPending(b);
                
                // Pending leads at the top
                if (aPending && !bPending) return -1;
                if (!aPending && bPending) return 1;
                
                // Sort the rest (No Answer, etc.) by oldest first
                const aTime = new Date(a?.updatedAt || a?.assignedAt || 0).getTime();
                const bTime = new Date(b?.updatedAt || b?.assignedAt || 0).getTime();
                return aTime - bTime; // Ascending: oldest first
            } else {
                // For others, newest assigned first (LIFO)
                const aTime = new Date(a?.assignedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.assignedAt || b?.createdAt || 0).getTime();
                return bTime - aTime; // Descending: newest first
            }
        });

        return filtered;
    }, [baseRoundLeads, activePhase, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        let totalAssigned = 0;
        let currentlyInRound = 0;
        let pending = 0;
        let answered = 0;
        let noAnswer = 0;
        let reject = 0;
        let delayed = 0;
        let movedToR2 = 0;
        let movedToNonEnrolled = 0;
        let movedToPaid = 0;
        let responseRate = 0;

        if (activeRound === 'r1') {
            totalAssigned = openSemLeads.length;
            
            const r1CurrentLeads = openSemLeads.filter(l => (l?.coordinationRound || 1) === 1 && (!(l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))));
            currentlyInRound = r1CurrentLeads.length;
            
            pending = r1CurrentLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            noAnswer = r1CurrentLeads.filter(l => l.callStatus === 'no_answer').length;
            reject = r1CurrentLeads.filter(l => l.callStatus === 'reject').length;
            delayed = r1CurrentLeads.filter(l => isLeadDelayed(l)).length;
            answered = totalAssigned - pending - noAnswer - reject;
            
            movedToR2 = openSemLeads.filter(l => (l?.coordinationRound || 1) > 1 && (!(l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))).length;
            
            const enrolledCount = openSemLeads.filter(l => ((((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))).length;
            responseRate = totalAssigned > 0 ? ((enrolledCount / totalAssigned) * 100).toFixed(1) : 0;
            
        } else if (activeRound === 'r2') {
            const r2ArrivedLeads = openSemLeads.filter(l => (l?.coordinationRound || 1) >= 2);
            totalAssigned = r2ArrivedLeads.length;
            
            const r2CurrentLeads = r2ArrivedLeads.filter(l => (l?.coordinationRound || 1) === 2 && (!(l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) && !isAutoPushedToNonEnrolled(l));
            currentlyInRound = r2CurrentLeads.length;
            
            pending = r2CurrentLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            noAnswer = r2CurrentLeads.filter(l => l.callStatus === 'no_answer').length;
            reject = r2CurrentLeads.filter(l => l.callStatus === 'reject').length;
            delayed = r2CurrentLeads.filter(l => isLeadDelayed(l)).length;
            answered = totalAssigned - pending - noAnswer - reject;
            
            movedToNonEnrolled = r2ArrivedLeads.filter(l => (l?.coordinationRound === 3 || isAutoPushedToNonEnrolled(l)) && (!(l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))).length;
            movedToPaid = r2ArrivedLeads.filter(l => ((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))).length;
            
            const r2EnrolledCount = r2ArrivedLeads.filter(l => ((((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_'))))).length;
            responseRate = totalAssigned > 0 ? ((r2EnrolledCount / totalAssigned) * 100).toFixed(1) : 0;
            
        } else if (activeRound === 'non_enrolled') {
            const nonEnrolledLeads = openSemLeads.filter(l => (!(l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))) && (l?.coordinationRound === 3 || isAutoPushedToNonEnrolled(l)));
            totalAssigned = nonEnrolledLeads.length;
            currentlyInRound = totalAssigned;
            pending = nonEnrolledLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            noAnswer = nonEnrolledLeads.filter(l => l.callStatus === 'no_answer').length;
            reject = nonEnrolledLeads.filter(l => l.callStatus === 'reject').length;
            delayed = nonEnrolledLeads.filter(l => isLeadDelayed(l)).length;
            answered = totalAssigned - pending - noAnswer - reject;
        } else if (activeRound === 'enrolled') {
            const enrolledLeads = openSemLeads.filter(l => ((l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID' || (l?.enrollmentStatus && l?.enrollmentStatus.startsWith('ENROLLED_')))));
            totalAssigned = enrolledLeads.length;
            currentlyInRound = totalAssigned;
        }

        return { totalAssigned, currentlyInRound, pending, answered, noAnswer, reject, delayed, movedToR2, movedToNonEnrolled, movedToPaid, responseRate };
    }, [openSemLeads, activeRound]);

    const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleRemarkChange = (leadId, value) => {
        setDrafts(prev => ({ ...prev, [leadId]: value }));
        const lead = leads.find(l => l.id === leadId);
        if (lead?.batchId) {
            localStorage.setItem(`draft_remark_as_${leadId}_${lead.batchId}`, value);
        }
        localStorage.setItem(`draft_remark_as_${leadId}`, value);
    };

    const handleEnrollmentChange = (leadId, val) => {
        if (val === 'NON_ENROLLED') {
            handleUpdateLocalLead(leadId, 'paymentIntention', 'NOT_DECIDED');
            handleUpdateLocalLead(leadId, 'enrollmentStatus', 'NON_ENROLLED');
        } else {
            const plan = val.split('_')[1]; // FULL, MONTHLY, INSTALLMENT
            handleUpdateLocalLead(leadId, 'paymentIntention', plan);
            handleUpdateLocalLead(leadId, 'enrollmentStatus', 'ENROLLED');
        }
    };

    const handleLocalSaveCallData = async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        const feedback = drafts[leadId] || lead.feedback || '';
        const finalStatus = draftStatus[leadId] || lead.callStatus || 'pending';
        const finalAttempt = draftAttempt[leadId] || lead.callAttempt || 1;
        const finalMethod = draftMethod[leadId] || lead.callMethod || 'direct';

        if (finalStatus === 'pending') {
            toast.error('Please select an Outcome before saving.');
            return;
        }

        const loadToast = toast.loading("Saving progress...");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/after-seminar-crm/leads/update-call', {
                leadId,
                method: finalMethod,
                callAttempt: finalAttempt,
                status: finalStatus,
                feedback,
                coordinationRound: lead.coordinationRound || 1,
                paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED',
                campaignContext: 'OPEN_SEMINAR',
                isNonEnrolledTab: activeRound === 'non_enrolled'
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success("Progress saved successfully!", { id: loadToast });

            const newDrafts = { ...drafts };
            delete newDrafts[leadId];
            setDrafts(newDrafts);
            localStorage.removeItem(`draft_remark_as_${leadId}`);
            if (lead?.batchId) {
                localStorage.removeItem(`draft_remark_as_${leadId}_${lead.batchId}`);
            }

            handleUpdateLocalLead(leadId, 'feedback', feedback);
            handleUpdateLocalLead(leadId, 'callStatus', finalStatus);
            handleUpdateLocalLead(leadId, 'callAttempt', finalAttempt);
            handleUpdateLocalLead(leadId, 'callMethod', finalMethod);

            let currentRound = lead.coordinationRound || 1;

            if (finalStatus === 'reject') {
                handleUpdateLocalLead(leadId, 'callStatus', 'reject');
            } else if (currentRound === 1) {
                if (finalStatus === 'answered') {
                    handleUpdateLocalLead(leadId, 'coordinationRound', 2);
                    handleUpdateLocalLead(leadId, 'phase', 1);
                    handleUpdateLocalLead(leadId, 'callStatus', 'pending');
                    handleUpdateLocalLead(leadId, 'isWaitingForRound2', true); 
                } else if (finalStatus === 'no_answer') {
                    handleUpdateLocalLead(leadId, 'phase', 1);
                    handleUpdateLocalLead(leadId, 'callStatus', 'no_answer');
                }
            } else if (currentRound === 2) {
                 if (finalStatus === 'no_answer') {
                     handleUpdateLocalLead(leadId, 'phase', 1);
                     handleUpdateLocalLead(leadId, 'callStatus', 'no_answer');
                 }
            }

            setDraftStatus(prev => { const n = {...prev}; delete n[leadId]; return n; });
            setDraftAttempt(prev => { const n = {...prev}; delete n[leadId]; return n; });
            setDraftMethod(prev => { const n = {...prev}; delete n[leadId]; return n; });
        } catch (error) {
            toast.error("Failed to save progress.", { id: loadToast });
        }
    };

    const handlePushToNextRound = async (leadId, currentRound, callStatus, phase) => {
        if (callStatus === 'pending' || !callStatus) return toast.error("Change Status before pushing!");
        if (callStatus === 'reject') return toast.error("Rejected leads cannot be pushed to the next round.");
        
        if (callStatus !== 'answered') {
            return toast.error("Only 'Answered' leads can be pushed to the next round.");
        }

        if (!window.confirm(`Move this lead to the next round? Remarks will be kept, but status will reset.`)) return;

        const loadToast = toast.loading("Moving lead to next round...");
        try {
            await axios.post('/after-seminar-crm/leads/bulk-action', { action: 'CHANGE_ROUND', leadIds: [leadId], targetRound: currentRound + 1 }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            toast.success("Lead pushed successfully!", { id: loadToast });
            setTimeout(() => window.location.reload(), 800);
        } catch (e) { toast.error("Failed to push lead.", { id: loadToast }); }
    };

    const handleOpenReminderModal = async (lead, e) => {
        if(e) e.preventDefault();
        setReminderLead(lead);
        const loadToast = toast.loading("Loading reminder details...");
        try {
            const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
            const agentId = loggedUser.id || loggedUser.userId;
            const res = await axios.get(`/reminders/my-reminders?agentId=${agentId}`);
            const existing = res.data.find(r => r.leadId === lead.id);

            if (existing) {
                setExistingReminderId(existing.id);
                const d = new Date(existing.remindAt);
                setRemindDate(d.toISOString().split('T')[0]);
                setRemindTime(d.toTimeString().slice(0, 5));
                setRemindNote(existing.note || '');
            } else {
                setExistingReminderId(null);
                setRemindDate(''); setRemindTime(''); setRemindNote('');
            }
            toast.dismiss(loadToast);
            setShowReminder(true);
        } catch (error) {
            toast.error("Failed to load data.", { id: loadToast });
        }
    };

    const handleSetReminder = async () => {
        if (!remindDate || !remindTime) return toast.error("Please select a date and time!");
        setIsSubmittingReminder(true);
        const loadToast = toast.loading(existingReminderId ? "Updating reminder..." : "Setting reminder...");
        try {
            const token = localStorage.getItem('token');
            const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
            const agentId = loggedUser.id || loggedUser.userId;
            const formattedDate = new Date(`${remindDate}T${remindTime}:00`).toISOString();
            
            if (existingReminderId) {
                await axios.put('/reminders/edit', { reminderId: existingReminderId, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success("Reminder updated successfully!", { id: loadToast });
            } else {
                await axios.post('/reminders/create', { leadId: reminderLead.id, agentId: agentId, leadType: reminderLead.inquiryType || 'UNKNOWN', phone: reminderLead.phone, name: reminderLead.name, round: reminderLead.coordinationRound || 1, phase: reminderLead.phase || 1, remindAt: formattedDate, note: remindNote }, { headers: { Authorization: `Bearer ${token}` } });
                toast.success("Reminder set successfully!", { id: loadToast });
            }
            setShowReminder(false);
        } catch (error) { toast.error("Operation failed.", { id: loadToast }); } 
        finally { setIsSubmittingReminder(false); }
    };

    const handleDeleteReminder = async () => {
        if (!window.confirm("Are you sure you want to delete this reminder?")) return;
        setIsSubmittingReminder(true);
        const loadToast = toast.loading("Deleting reminder...");
        try {
            await axios.delete(`/reminders/delete/${existingReminderId}`);
            toast.success("Reminder deleted!", { id: loadToast });
            setShowReminder(false);
        } catch (error) { toast.error("Failed to delete.", { id: loadToast }); } 
        finally { setIsSubmittingReminder(false); }
    };

    const getTimerDataText = (lead) => {
        if (!lead) return null;
        if (((((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_')))) || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_'))))) return null;
        if (lead.isPast) return null;

        const startTime = new Date(lead.assignedAt || lead.createdAt).getTime();
        const diffMs = currentTime - startTime;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        const currentRound = lead.coordinationRound || 1;

        if (currentRound === 1) {
            const timeLeftMs = sevenDaysMs - diffMs;
            
            if (timeLeftMs > 0) {
                const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                return { text: `⏳ ${days}d ${hours}h ${mins}m LEFT`, type: 'warning', isLate: false };
            } else {
                const lateMs = Math.abs(timeLeftMs);
                const days = Math.floor(lateMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((lateMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((lateMs % (1000 * 60 * 60)) / (1000 * 60));
                return { text: `⚠️ -${days}d ${hours}h ${mins}m LATE`, type: 'danger', isLate: true };
            }
        } else if (currentRound === 2) {
            if (lead.isWaitingForRound2) {
                const waitTimeLeft = sevenDaysMs - diffMs;
                if (waitTimeLeft > 0) {
                    const days = Math.floor(waitTimeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((waitTimeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    return { text: `❄️ FREEZE ${days}d ${hours}h`, type: 'frozen', isLate: false };
                }
            }
            
            // For Round 2 active (after 7 days), countdown to 14 days max limit
            const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
            const r2TimeLeftMs = fourteenDaysMs - diffMs;
            
            if (r2TimeLeftMs > 0) {
                const days = Math.floor(r2TimeLeftMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((r2TimeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                return { text: `⏳ R2: ${days}d ${hours}h LEFT`, type: 'warning', isLate: false };
            } else {
                return { text: `⚠️ 14-DAY LIMIT REACHED`, type: 'danger', isLate: true };
            }
        }
        return null;
    };

    const exportToExcel = () => {
        if (!filteredLeads || filteredLeads.length === 0) {
            toast.error("No leads available to export.");
            return;
        }

        const cleanDigits = (num) => (num ? String(num).replace(/[^0-9]/g, '') : '');

        const getBatchName = (l) => {
            if (l?.batch?.name) return l.batch.name;
            if (l?.batchName) return l.batchName;
            if (l?.batchId && allBatches) {
                const found = allBatches.find(b => String(b.id) === String(l.batchId));
                if (found?.name) return found.name;
            }
            if (filters?.selectedBatch && allBatches) {
                const found = allBatches.find(b => String(b.id) === String(filters.selectedBatch));
                if (found?.name) return found.name;
            }
            return "-";
        };

        const data = filteredLeads.map((l, index) => {
            const rawPrimary = l.phone ? l.phone.split('_')[0].trim() : '-';
            const primSuffix = cleanDigits(rawPrimary).slice(-9);

            const candidates = [];
            if (l.registeredUser?.optionalPhone) candidates.push(l.registeredUser.optionalPhone);
            if (l.registeredUser?.phone) candidates.push(l.registeredUser.phone);
            if (l.registeredUser?.whatsapp) candidates.push(l.registeredUser.whatsapp);
            if (l.optionalPhone) candidates.push(l.optionalPhone);
            if (l.secondPhone) candidates.push(l.secondPhone);

            const secondaryList = candidates.filter(num => {
                const cClean = cleanDigits(num);
                return cClean && cClean.length >= 7 && cClean.slice(-9) !== primSuffix;
            });
            const uniqueSec = [...new Set(secondaryList)];
            const secPhone = uniqueSec.length > 0 ? uniqueSec[0] : '-';

            const studentName = (l.registeredUser ? `${l.registeredUser.firstName || ''} ${l.registeredUser.lastName || ''}`.trim() : '') || l.name || '-';
            const webName = l.registeredUser ? `${l.registeredUser.firstName || ''} ${l.registeredUser.lastName || ''}`.trim() : '-';
            const waName = l.name || '-';

            const outcome = l.callStatus === 'answered' ? 'Answered' :
                            l.callStatus === 'reject' ? 'Reject' :
                            l.callStatus === 'no_answer' ? 'No Answer' : 'Pending';

            const method = l.callMethod === '3cx' ? '3CX' :
                           l.callMethod === 'whatsapp' ? 'WhatsApp' :
                           l.callMethod === 'direct' ? 'Direct Call' : (l.callMethod || 'Direct Call');

            const enrollment = l.enrollmentStatus === 'NON_ENROLLED' ? 'Non-Enrolled' :
                               l.enrollmentStatus === 'ENROLLED_FULL' ? 'Enrolled - Full' :
                               l.enrollmentStatus === 'ENROLLED_MONTHLY' ? 'Enrolled - Monthly' :
                               l.enrollmentStatus === 'ENROLLED_INSTALLMENT' ? 'Enrolled - Installment' :
                               (l.enrollmentStatus || 'Non-Enrolled');

            // Remarks History
            const r1Remark = l.roundProgress?.find(r => r.roundNum === 1)?.feedback 
                || (l.openSemRound === 1 || l.coordinationRound === 1 ? (l.openSemFeedback || l.newInqFeedback || l.feedback) : '')
                || "-";
            const r2Remark = l.roundProgress?.find(r => r.roundNum === 2)?.feedback 
                || (l.openSemRound === 2 || l.coordinationRound === 2 ? (l.openSemFeedback || l.newInqFeedback || l.feedback) : '')
                || "-";
            const nonEnrolledRemark = l.roundProgress?.find(r => r.roundNum === 3)?.feedback 
                || l.coordinationRemark 
                || l.nonEnrolledReason 
                || (l.openSemRound === 3 || l.coordinationRound === 3 ? (l.openSemFeedback || l.newInqFeedback || l.feedback) : '')
                || "-";

            // Coordinator
            const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const assignedCoordinator = (l.assignedUser ? `${l.assignedUser.firstName || ''} ${l.assignedUser.lastName || ''}`.trim() : '')
                || l.assignedUserName
                || (loggedUser?.firstName && (!l.assignedTo || String(l.assignedTo) === String(loggedUser.id)) ? `${loggedUser.firstName} ${loggedUser.lastName || ''}`.trim() : '')
                || "-";

            return {
                "#": index + 1,
                "Student Name": studentName,
                "Web Registered Name": webName,
                "WhatsApp Name": waName,
                "Primary Phone": rawPrimary,
                "Secondary Phone": secPhone,
                "Batch": getBatchName(l),
                "Assigned Coordinator": assignedCoordinator,
                "Outcome": outcome,
                "Attempt": l.callAttempt || 1,
                "Method": method,
                "Enrollment": enrollment,
                "Round 1 Remark": r1Remark,
                "Round 2 Remark": r2Remark,
                "Non-Enrolled Remarks": nonEnrolledRemark,
                "Assigned Date": l.assignedAt ? new Date(l.assignedAt).toLocaleDateString() : (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "-")
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 25 },
            { wch: 22 },
            { wch: 20 },
            { wch: 18 },
            { wch: 18 },
            { wch: 28 },
            { wch: 22 },
            { wch: 14 },
            { wch: 10 },
            { wch: 14 },
            { wch: 16 },
            { wch: 32 },
            { wch: 32 },
            { wch: 35 },
            { wch: 14 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Non Enrolled Leads");
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Open_Seminar_Non_Enrolled_Leads_${dateStr}.xlsx`);
        toast.success(`Exported ${filteredLeads.length} leads successfully!`);
    };

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-y-auto custom-scrollbar font-sans text-slate-100">
            <div className="fade-in">

                {/* Header matching CallCenterAgentDashboard detail view */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 flex items-center gap-3">
                        <Target className="text-emerald-400" />
                        OPEN SEMINAR CAMPAIGN
                    </h1>
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md shadow-sm">
                        <span className="text-xs font-bold text-slate-400">Campaign:</span>
                        <span className="text-sm font-black text-emerald-400">OPEN SEMINAR</span>
                        <div className="w-px h-5 bg-white/10 mx-1"></div>
                        <button
                            onClick={() => setIsGuidanceModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            <BookOpen size={14} /> Read Guidance
                        </button>
                    </div>
                </div>

                {/* 🔥 CONVERSION GOALS & LEVEL PROGRESS TRACKER WIDGET 🔥 */}
                {(() => {
                    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
                    const myStaffStat = campaignStats?.staffBreakdown?.find(s => 
                        (s.staffId && currentUser?.id && String(s.staffId) === String(currentUser.id)) ||
                        (s.id && currentUser?.id && String(s.id) === String(currentUser.id)) ||
                        (s.name && currentUser?.firstName && s.name.toLowerCase().includes(currentUser.firstName.toLowerCase()))
                    );

                    const myAssignedCount = myStaffStat?.overall?.assigned ?? openSemLeads.length;
                    const myEnrolledCount = myStaffStat?.overall?.enrolled ?? openSemLeads.filter(l => l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))).length;
                    
                    const totalGroupAssigned = campaignStats?.totalAssigned || myAssignedCount;
                    const totalGroupEnrolled = campaignStats?.totalEnrolled || myEnrolledCount;
                    
                    const targetIndGoal = campaignStats?.batchGoals?.targetIndividualGoal ?? 40;
                    const targetGrpGoal = campaignStats?.batchGoals?.targetGroupGoal ?? 50;

                    return (
                        <CoordinatorGoalTrackerWidget
                            myAssigned={myAssignedCount}
                            myEnrolled={myEnrolledCount}
                            totalGroupAssigned={totalGroupAssigned}
                            totalGroupEnrolled={totalGroupEnrolled}
                            targetIndividualGoal={targetIndGoal}
                            targetGroupGoal={targetGrpGoal}
                            staffBreakdown={campaignStats?.staffBreakdown || []}
                        />
                    );
                })()}

                {/* Top Round Buttons (Moved Outside) */}
                <div className="flex gap-2 bg-[#0F172A]/80 p-2 rounded-2xl flex-wrap shadow-inner mb-6 w-max border border-white/5">
                    <button
                        onClick={() => { setActiveRound('r1'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-sm ${activeRound === 'r1' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Round 1 (Within 7 days)
                    </button>
                    <button
                        onClick={() => { setActiveRound('r2'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-sm ${activeRound === 'r2' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Round 2 (Within 7 days)
                    </button>
                    <button
                        onClick={() => { setActiveRound('non_enrolled'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-sm ${activeRound === 'non_enrolled' ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Non Enrolled (After 14 days)
                    </button>
                    <button
                        onClick={() => { setActiveRound('enrolled'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-sm ${activeRound === 'enrolled' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Paid
                    </button>
                </div>

                {/* Stats & Filters Box */}
                <div className="sticky top-0 z-40 bg-[#0F172A]/95 border border-white/10 p-6 rounded-3xl mb-6 backdrop-blur-xl shadow-lg shadow-black/50">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

                        {/* Stats Section */}
                        <div className="flex gap-4 items-center bg-[#0F172A]/50 p-4 px-6 rounded-3xl border border-white/5 shadow-inner flex-wrap w-full xl:w-auto overflow-x-auto custom-scrollbar">
                            <div className="flex flex-col items-center"><span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1" title="Leads currently sitting in this Round">In Round</span><span className="text-xl font-black text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]">{stats.currentlyInRound}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pending</span><span className="text-xl font-black text-amber-400">{stats.pending}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Answered</span><span className="text-xl font-black text-indigo-300">{stats.answered}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1">No Answer</span><span className="text-xl font-black text-slate-200">{stats.noAnswer}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Reject</span><span className="text-xl font-black text-red-400">{stats.reject}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>
                            
                            {(activeRound === 'r1') && (
                                <>
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Moved to R2</span><span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{stats.movedToR2}</span></div>
                                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                                </>
                            )}
                            
                            {(activeRound === 'r2') && (
                                <>
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">To Non-Enrolled</span><span className="text-xl font-black text-slate-400">{stats.movedToNonEnrolled}</span></div>
                                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                                    
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">To Paid</span><span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{stats.movedToPaid}</span></div>
                                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                                </>
                            )}

                            <div className="flex flex-col items-center"><span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1" title="Conversion Rate">Rate</span><span className="text-xl font-black text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">{stats.responseRate}%</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mb-1">Delayed</span><span className="text-xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{stats.delayed}</span></div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-col gap-3 min-w-[300px] w-full xl:w-auto">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Filters:</span>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'PENDING' ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-[#0F172A] border border-white/10 text-amber-400 hover:bg-white/5'}`}
                                >
                                    ⏳ PENDING
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'DELAYED' ? 'ALL' : 'DELAYED'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'DELAYED' ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-[#0F172A] border border-white/10 text-rose-400 hover:bg-white/5'}`}
                                >
                                    ⚠️ DELAYED
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'NO_ANSWER' ? 'ALL' : 'NO_ANSWER'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'NO_ANSWER' ? 'bg-slate-500 text-white shadow-[0_0_10px_rgba(100,116,139,0.5)]' : 'bg-[#0F172A] border border-white/10 text-slate-400 hover:bg-white/5'}`}
                                >
                                    🔇 NO ANSWER
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'REJECT' ? 'ALL' : 'REJECT'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'REJECT' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-[#0F172A] border border-white/10 text-red-400 hover:bg-white/5'}`}
                                >
                                    ❌ REJECT
                                </button>
                                {statusFilter !== 'ALL' && (
                                    <button
                                        onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        <FaTimes size={10} /> CLEAR
                                    </button>
                                )}
                            </div>

                            <div className="relative flex gap-2">
                                {activeRound === 'non_enrolled' && (
                                    <button 
                                        onClick={exportToExcel}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                                    >
                                        <FaFileExcel size={14} /> EXPORT EXCEL
                                    </button>
                                )}
                                <div className="relative flex-1">
                                    <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-sm" />
                                    <input type="text" placeholder="Search leads by phone or name..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full bg-[#0F172A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500 shadow-inner" />
                                </div>
                                <div className="flex bg-[#0F172A] border border-white/10 rounded-xl overflow-hidden p-1">
                                    <button
                                        onClick={() => setViewMode('TILE')}
                                        className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${viewMode === 'TILE' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        TILES
                                    </button>
                                    <button
                                        onClick={() => setViewMode('TABLE')}
                                        className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        TABLE
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Main Leads Grid */}
                    <div className="flex-1">
                        {paginatedLeads.length === 0 ? (
                            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl shadow-lg">
                                <PhoneCall className="text-slate-600 mx-auto mb-4" size={48} />
                                <h3 className="text-xl font-bold text-slate-400">No Leads Found</h3>
                                <p className="text-slate-500 mt-2">There are no leads matching your current filters.</p>
                            </div>
                        ) : (
                            viewMode === 'TILE' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {paginatedLeads.map((lead, index) => {
                                    const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                                    const isLeadPending = lead.callStatus === 'pending' || !lead.callStatus;
                                    const currentRemark = isLeadPending
                                        ? (drafts[lead.id] || '')
                                        : (drafts[lead.id] !== undefined ? drafts[lead.id] : (lead.feedback || ''));
                                    const isDraft = drafts[lead.id] !== undefined && drafts[lead.id] !== lead.feedback;

                                    const callOutcome = lead.callStatus || 'pending';
                                    const canPushRound = activeRound !== 'enrolled' && activeRound !== 'non_enrolled' && (
                                        (lead.phase === 1 && callOutcome === 'answered') ||
                                        (lead.phase === 2 && (callOutcome === 'answered' || callOutcome === 'no_answer'))
                                    );

                                    let enrollmentValue = 'NON_ENROLLED';
                                    if (lead.paymentIntention === 'FULL') enrollmentValue = 'ENROLLED_FULL';
                                    else if (lead.paymentIntention === 'MONTHLY') enrollmentValue = 'ENROLLED_MONTHLY';
                                    else if (lead.paymentIntention === 'INSTALLMENT') enrollmentValue = 'ENROLLED_INSTALLMENT';
                                    else enrollmentValue = 'NON_ENROLLED';

                                    const timerData = getTimerDataText(lead);
                                    
                                    let isFrozen = lead.isLocked || false;
                                    if (activeRound === 'enrolled' || activeRound === 'non_enrolled') {
                                        isFrozen = false;
                                    } else if ((lead.coordinationRound || 1) === 1) {
                                        isFrozen = false;
                                    } else if ((lead.coordinationRound || 1) === 2) {
                                        isFrozen = timerData?.type === 'frozen';
                                    }
                                    const isDisabled = lead.isPast || isFrozen;
                                    const isFirstReject = lead.callStatus === 'reject' && (index === 0 || paginatedLeads[index - 1].callStatus !== 'reject');
                                    const hasUnsavedChanges = isDraft || 
                                        (draftStatus[lead.id] !== undefined && draftStatus[lead.id] !== (lead.callStatus || 'pending')) ||
                                        (draftAttempt[lead.id] !== undefined && draftAttempt[lead.id] !== (lead.callAttempt || 1)) ||
                                        (draftMethod[lead.id] !== undefined && draftMethod[lead.id] !== (lead.callMethod || 'direct'));

                                    return (
                                        <React.Fragment key={`frag-${lead.id}`}>
                                            {isFirstReject && (
                                                <div className="col-span-1 md:col-span-2 xl:col-span-3 mt-4 border-t border-rose-500/30 pt-6 mb-2">
                                                    <h3 className="text-rose-400 font-black uppercase tracking-widest flex items-center gap-2">
                                                        <FaExclamationCircle size={18} /> Rejected Leads
                                                    </h3>
                                                    <p className="text-slate-500 text-[10px] mt-1 font-bold">These leads will remain in this round but are separated for clarity.</p>
                                                </div>
                                            )}
                                            <div key={lead.id} className={`bg-[#1e1b4b]/80 backdrop-blur-md rounded-2xl border ${isDisabled ? 'border-slate-500/50 opacity-80' : 'border-indigo-500/20 hover:border-indigo-400/50'} p-5 shadow-xl transition-all group flex flex-col relative`}>
                                            {isFrozen && !lead.isPast && (
                                                <div className="absolute inset-0 bg-slate-900/60 rounded-2xl backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
                                                    <span className="bg-[#0f172a] text-indigo-300 font-black px-5 py-2.5 rounded-xl text-[13px] tracking-widest border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.2)] uppercase">
                                                        {timerData?.text ? `FROZEN (${timerData.text.replace(/[^a-zA-Z0-9:\-\s]/g, '').trim()})` : 'FROZEN'}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Top Section */}
                                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-indigo-500/20">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black shadow-inner relative">
                                                        {realIndex}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-white leading-tight tracking-wide flex items-center gap-1.5 flex-wrap">
                                                            {lead.phone?.split('_')[0]}
                                                            {lead.isBlocked && (
                                                                <span className="flex items-center gap-1 bg-red-600/30 text-red-300 px-2 py-0.5 rounded text-[10px] font-black border border-red-500/50 shadow-sm tracking-wider">
                                                                    <FaBan size={9}/> Blocked Number
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <div className="flex flex-col gap-0.5 mt-1">
                                                            <p className="text-slate-400 text-[10px] font-bold uppercase truncate max-w-[150px]">WA: {lead.name || 'Unknown'}</p>
                                                            {lead.registeredUser && (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <p 
                                                                        onMouseEnter={() => setStudentDetailsLead(lead)}
                                                                        onMouseLeave={() => setStudentDetailsLead(null)}
                                                                        className="text-emerald-400 text-[10px] font-bold uppercase leading-tight w-full break-words cursor-pointer hover:underline" 
                                                                        title="View Details"
                                                                    >
                                                                        WEB: {lead.registeredUser.firstName} {lead.registeredUser.lastName}
                                                                    </p>
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                                        {lead.registeredUser.phone && lead.phone?.split('_')[0].slice(-9) !== lead.registeredUser.phone.slice(-9) && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <p className="text-indigo-300 text-xs font-bold truncate">Web Pri: {lead.registeredUser.phone}</p>
                                                                                <button 
                                                                                    onClick={() => handleCopy(lead.registeredUser.phone, 'Web primary number')}
                                                                                    className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
                                                                                    title="Copy Web Primary Number"
                                                                                >
                                                                                    <Copy size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {lead.registeredUser.optionalPhone && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <p className="text-indigo-300 text-xs font-bold truncate">Web Sec: {lead.registeredUser.optionalPhone}</p>
                                                                                <button 
                                                                                    onClick={() => handleCopy(lead.registeredUser.optionalPhone, 'Web secondary number')}
                                                                                    className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
                                                                                    title="Copy Web Secondary Number"
                                                                                >
                                                                                    <Copy size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {timerData && (
                                                                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold tracking-widest uppercase shadow-sm border backdrop-blur-md transition-all
                                                                    ${timerData.type === 'danger' ? 'bg-gradient-to-r from-rose-500/20 to-red-600/20 text-rose-300 border-rose-500/40 shadow-rose-500/20 animate-pulse' : 
                                                                    timerData.type === 'warning' ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/20' : 
                                                                    timerData.type === 'frozen' ? 'bg-gradient-to-r from-slate-700/60 to-slate-800/60 text-slate-300 border-slate-600/50 shadow-slate-900/40' :
                                                                    'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'}`}
                                                                >
                                                                    <span className="drop-shadow-md">{timerData.text}</span>
                                                                </span>
                                                            )}
                                                            {hasUnsavedChanges && (
                                                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                                                                    ⚠️ UNSAVED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Blocked Alert Banner */}
                                            {lead.isBlocked && (
                                                <div className="mb-4 bg-red-500/20 border border-red-500/40 p-2.5 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2">
                                                    <FaBan className="text-red-400 shrink-0" size={14}/>
                                                    <div className="flex-1">
                                                        <span className="text-white font-black">This number is BLOCKED.</span>
                                                        {lead.blockedReason && <span className="block text-[11px] font-normal text-red-200 mt-0.5">Reason: {lead.blockedReason}</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Grid for Outcome, Attempt, and Open Sem Fields */}
                                            <div className="grid grid-cols-12 gap-3 mb-4">
                                                <div className="col-span-8">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Outcome</label>
                                                    <select
                                                        disabled={isDisabled}
                                                        value={draftStatus[lead.id] || lead.callStatus || 'pending'}
                                                        onChange={(e) => setDraftStatus(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                        className={`w-full bg-[#312e81]/30 border rounded-xl px-2 py-2 text-xs font-bold outline-none appearance-none transition-colors disabled:opacity-50
                                                            ${(draftStatus[lead.id] || lead.callStatus || 'pending') === 'pending' ? 'border-amber-500/30 text-amber-400' :
                                                                (draftStatus[lead.id] || lead.callStatus || 'pending') === 'answered' ? 'border-emerald-500/30 text-emerald-400' :
                                                                    (draftStatus[lead.id] || lead.callStatus || 'pending') === 'no_answer' ? 'border-blue-500/30 text-blue-400' :
                                                                        'border-rose-500/30 text-rose-400'}`}
                                                    >
                                                        <option value="pending" className="bg-[#0f172a] text-amber-400">⌛ PENDING</option>
                                                        <option value="answered" className="bg-[#0f172a] text-emerald-400">✅ ANSWERED</option>
                                                        <option value="no_answer" className="bg-[#0f172a] text-blue-400">🔇 NO ANSWER</option>
                                                        <option value="reject" className="bg-[#0f172a] text-rose-400">❌ REJECT</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Att.</label>
                                                    <select
                                                        disabled={isDisabled}
                                                        value={draftAttempt[lead.id] || lead.callAttempt || 1}
                                                        onChange={(e) => setDraftAttempt(prev => ({ ...prev, [lead.id]: parseInt(e.target.value) }))}
                                                        className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-2 text-xs font-black text-rose-400 outline-none focus:border-rose-500 appearance-none text-center disabled:opacity-50"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n} className="bg-[#0f172a] text-rose-400">{n}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-12 gap-3 mb-4">
                                                <div className="col-span-6">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Method</label>
                                                    <select
                                                        disabled={isDisabled}
                                                        value={draftMethod[lead.id] || lead.callMethod || 'direct'}
                                                        onChange={(e) => setDraftMethod(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                        className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-2 py-2 text-xs font-bold text-indigo-200 outline-none appearance-none disabled:opacity-50"
                                                    >
                                                        <option value="direct" className="bg-[#0f172a]">Direct Call</option>
                                                        <option value="whatsapp" className="bg-[#0f172a]">WhatsApp</option>
                                                        <option value="3cx" className="bg-[#0f172a]">3CX</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-6">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Enrollment</label>
                                                    <select
                                                        disabled={true}
                                                        value={enrollmentValue}
                                                        onChange={(e) => handleEnrollmentChange(lead.id, e.target.value)}
                                                        className={`w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-2 py-2 text-xs font-bold outline-none appearance-none disabled:opacity-50 cursor-not-allowed ${((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_')))) ? 'text-emerald-400 border-emerald-500/30' : 'text-indigo-200'}`}
                                                    >
                                                        <option value="NON_ENROLLED" className="bg-[#0f172a]">Non-Enrolled</option>
                                                        <option value="ENROLLED_FULL" className="bg-[#0f172a]">Enrolled - Full</option>
                                                        <option value="ENROLLED_MONTHLY" className="bg-[#0f172a]">Enrolled - Monthly</option>
                                                        <option value="ENROLLED_INSTALLMENT" className="bg-[#0f172a]">Enrolled - Install</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mb-4 relative flex-1 flex flex-col">
                                                {/* Round 1 Remark */}
                                                {((lead.coordinationRound || 1) >= 2 || activeRound === 'non_enrolled') && lead.roundProgress?.find(r => r.roundNum === 1)?.feedback && (
                                                    <div className="mb-2">
                                                        <label className="block text-[10px] font-bold text-amber-400/70 uppercase tracking-widest mb-1 ml-1">Round 1 Remark (Read-Only)</label>
                                                        <div className="w-full bg-[#312e81]/20 border border-amber-500/20 rounded-xl px-3 py-2 text-[11px] text-amber-100/70 overflow-y-auto max-h-[60px] custom-scrollbar italic">
                                                            {lead.roundProgress.find(r => r.roundNum === 1).feedback}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Round 2 Remark */}
                                                {(activeRound === 'non_enrolled') && lead.roundProgress?.find(r => r.roundNum === 2)?.feedback && (
                                                    <div className="mb-2">
                                                        <label className="block text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest mb-1 ml-1">Round 2 Remark (Read-Only)</label>
                                                        <div className="w-full bg-[#312e81]/20 border border-emerald-500/20 rounded-xl px-3 py-2 text-[11px] text-emerald-100/70 overflow-y-auto max-h-[60px] custom-scrollbar italic">
                                                            {lead.roundProgress.find(r => r.roundNum === 2).feedback}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                                    {activeRound === 'non_enrolled' ? 'Non-Enrolled Remarks' : lead.coordinationRound === 2 ? 'Round 2 Remarks' : 'Round 1 Remarks'}
                                                </label>
                                                <textarea
                                                    disabled={isDisabled}
                                                    rows="2"
                                                    value={currentRemark}
                                                    onChange={(e) => handleRemarkChange(lead.id, e.target.value)}
                                                    placeholder="Add your notes..."
                                                    className="w-full flex-1 bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none placeholder-indigo-300/30 transition-colors custom-scrollbar disabled:opacity-50"
                                                />
                                                {isDraft && <span className="absolute -top-2 right-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-400 shadow-sm">DRAFT</span>}
                                            </div>

                                            {/* Dual Call Buttons */}
                                            <div className="flex gap-2 w-full mb-3">
                                                <button onClick={(e) => { e.preventDefault(); toast.error('Coming Soon', { icon: '🚧' }); }} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all border border-blue-500/30">
                                                    <FaPhoneAlt size={12} /> Normal Call
                                                </button>

                                                {lead.waCallPermissionExpiry && new Date(lead.waCallPermissionExpiry) > new Date() ? (
                                                    <button className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg py-1.5 text-xs font-bold flex flex-col items-center justify-center shadow-md shadow-emerald-500/20 transition-all leading-none border border-emerald-500/30">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <FaWhatsapp size={14} /> WhatsApp Call
                                                        </div>
                                                        <span className="text-[9px] font-mono text-emerald-100 bg-black/20 px-1.5 py-0.5 rounded">
                                                            Ends: {Math.max(0, Math.ceil((new Date(lead.waCallPermissionExpiry) - new Date()) / (1000 * 60 * 60 * 24)))} Days
                                                        </span>
                                                    </button>
                                                ) : null}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    disabled={isDisabled}
                                                    onClick={() => handleLocalSaveCallData(lead.id)}
                                                    className={`flex-[1.5] font-black text-xs uppercase tracking-widest rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none ${
                                                        hasUnsavedChanges 
                                                            ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] hover:shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-pulse border border-amber-300" 
                                                            : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] border border-rose-500"
                                                    }`}
                                                >
                                                    <Check size={16} strokeWidth={3} /> {hasUnsavedChanges ? "SAVE NOW!" : "SAVE"}
                                                </button>

                                                <button
                                                    onMouseEnter={() => setStudentDetailsLead(lead)}
                                                    onMouseLeave={() => setStudentDetailsLead(null)}
                                                    className="flex-1 bg-sky-600/30 hover:bg-sky-500/50 border border-sky-400/50 text-sky-200 p-2.5 rounded-xl flex items-center justify-center transition-all transform hover:-translate-y-0.5"
                                                    title="Student Details"
                                                >
                                                    <FaUser size={14} />
                                                </button>

                                                <button
                                                    onClick={() => setChatModalLead(lead)}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white p-2.5 rounded-xl flex items-center justify-center relative z-20 transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] transform hover:-translate-y-0.5"
                                                    title="Open Chat"
                                                >
                                                    <FaCommentDots size={14} />
                                                    {lead.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>}
                                                    {lead.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-[#1e1b4b]"></span>}
                                                </button>

                                                <button
                                                    disabled={isDisabled || lead.isBlocked}
                                                    onClick={(e) => handleOpenReminderModal(lead, e)}
                                                    title="Set a Reminder"
                                                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <FaBell size={14} />
                                                </button>

                                                <button
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (lead.isBlocked) {
                                                            if (window.confirm(`Unblock ${lead.phone}?`)) {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    await axios.post('/after-seminar-crm/leads/unblock', { leadId: lead.id, phone: lead.phone }, { headers: { Authorization: `Bearer ${token}` } });
                                                                    lead.isBlocked = false;
                                                                    toast.success("Unblocked");
                                                                    if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', false);
                                                                } catch (err) { toast.error("Failed to unblock"); }
                                                            }
                                                        } else {
                                                            const reason = window.prompt(`Block number ${lead.phone}? Enter reason:`, "Spam / Abusive");
                                                            if (reason !== null) {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    await axios.post('/after-seminar-crm/leads/block', { leadId: lead.id, phone: lead.phone, reason }, { headers: { Authorization: `Bearer ${token}` } });
                                                                    lead.isBlocked = true;
                                                                    lead.blockedReason = reason;
                                                                    toast.success("Number blocked");
                                                                    if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', true);
                                                                } catch (err) { toast.error("Failed to block"); }
                                                            }
                                                        }
                                                    }}
                                                    title={lead.isBlocked ? "Unblock Number" : "Block Number"}
                                                    className={`flex-1 p-2.5 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:-translate-y-0.5 ${
                                                        lead.isBlocked 
                                                            ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-500/30' 
                                                            : 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10'
                                                    }`}
                                                >
                                                    <FaBan size={14} />
                                                </button>
                                            </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto bg-[#1e1b4b]/80 backdrop-blur-md rounded-2xl border border-indigo-500/20 shadow-xl">
                                    <table className="w-full text-left border-collapse min-w-[1200px]">
                                        <thead>
                                            <tr className="bg-indigo-900/40 text-indigo-300 text-[10px] uppercase tracking-widest border-b border-indigo-500/20">
                                                <th className="p-4 font-black w-16 text-center">#</th>
                                                <th className="p-4 font-black w-64">Lead Details</th>
                                                <th className="p-4 font-black w-48 text-center">Outcome & Att.</th>
                                                <th className="p-4 font-black w-48 text-center">Method & Enroll</th>
                                                <th className="p-4 font-black min-w-[200px]">Remarks</th>
                                                <th className="p-4 font-black w-32 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-indigo-500/10">
                                            {paginatedLeads.map((lead, index) => {
                                                const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                                                const isLeadPending = lead.callStatus === 'pending' || !lead.callStatus;
                                    const currentRemark = isLeadPending
                                        ? (drafts[lead.id] || '')
                                        : (drafts[lead.id] !== undefined ? drafts[lead.id] : (lead.feedback || ''));
                                                const isDraft = drafts[lead.id] !== undefined && drafts[lead.id] !== lead.feedback;
                                                
                                                let enrollmentValue = 'NON_ENROLLED';
                                                if (lead.paymentIntention === 'FULL') enrollmentValue = 'ENROLLED_FULL';
                                                else if (lead.paymentIntention === 'MONTHLY') enrollmentValue = 'ENROLLED_MONTHLY';
                                                else if (lead.paymentIntention === 'INSTALLMENT') enrollmentValue = 'ENROLLED_INSTALLMENT';

                                                const timerData = getTimerDataText(lead);
                                                let isFrozen = lead.isLocked || false;
                                                if (activeRound === 'enrolled' || activeRound === 'non_enrolled') {
                                                    isFrozen = false;
                                                } else if ((lead.coordinationRound || 1) === 1) {
                                                    isFrozen = false;
                                                } else if ((lead.coordinationRound || 1) === 2) {
                                                    isFrozen = timerData?.type === 'frozen';
                                                }
                                                
                                                const isDisabled = lead.isPast || isFrozen;
                                                const hasUnsavedChanges = isDraft || 
                                                    (draftStatus[lead.id] !== undefined && draftStatus[lead.id] !== (lead.callStatus || 'pending')) ||
                                                    (draftAttempt[lead.id] !== undefined && draftAttempt[lead.id] !== (lead.callAttempt || 1)) ||
                                                    (draftMethod[lead.id] !== undefined && draftMethod[lead.id] !== (lead.callMethod || 'direct'));

                                                return (
                                                    <tr key={lead.id} className={`group hover:bg-white/5 transition-colors ${isDisabled ? 'opacity-70' : ''}`}>
                                                        <td className="p-4 align-top text-center">
                                                            <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs">
                                                                {realIndex}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <h3 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                                                                {lead.phone?.split('_')[0]}
                                                                {lead.isBlocked && (
                                                                    <span className="flex items-center gap-1 bg-red-600/30 text-red-300 px-1.5 py-0.5 rounded text-[9px] font-black border border-red-500/50 shadow-sm">
                                                                        <FaBan size={8}/> BLOCKED
                                                                    </span>
                                                                )}
                                                            </h3>
                                                            <div className="flex flex-col gap-0.5 mt-1">
                                                                <p className="text-slate-400 text-[10px] font-bold uppercase truncate max-w-[150px]" title="WhatsApp Name">WA: {lead.name || 'Unknown'}</p>
                                                                {lead.registeredUser && (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <p 
                                                                            onMouseEnter={() => setStudentDetailsLead(lead)}
                                                                            onMouseLeave={() => setStudentDetailsLead(null)}
                                                                            className="text-emerald-400 text-[10px] font-bold uppercase leading-tight w-full break-words cursor-pointer hover:underline" 
                                                                            title="View Details"
                                                                        >
                                                                            WEB: {lead.registeredUser.firstName} {lead.registeredUser.lastName}
                                                                        </p>
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                                            {lead.registeredUser.phone && lead.phone?.split('_')[0].slice(-9) !== lead.registeredUser.phone.slice(-9) && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <p className="text-indigo-300 text-xs font-bold truncate">Web Pri: {lead.registeredUser.phone}</p>
                                                                                    <button 
                                                                                        onClick={() => handleCopy(lead.registeredUser.phone, 'Web primary number')}
                                                                                        className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
                                                                                        title="Copy Web Primary Number"
                                                                                    >
                                                                                        <Copy size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                            {lead.registeredUser.optionalPhone && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <p className="text-indigo-300 text-xs font-bold truncate">Web Sec: {lead.registeredUser.optionalPhone}</p>
                                                                                    <button 
                                                                                        onClick={() => handleCopy(lead.registeredUser.optionalPhone, 'Web secondary number')}
                                                                                        className="text-indigo-400/50 hover:text-indigo-300 transition-colors"
                                                                                        title="Copy Web Secondary Number"
                                                                                    >
                                                                                        <Copy size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {timerData && (
                                                                    <span className="mt-1 inline-block w-max px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-300">
                                                                        {timerData.text}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                <select
                                                                    disabled={isDisabled}
                                                                    value={draftStatus[lead.id] || lead.callStatus || 'pending'}
                                                                    onChange={(e) => setDraftStatus(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                                    className={`w-full bg-[#312e81]/30 border rounded-lg px-2 py-1.5 text-xs font-bold outline-none disabled:opacity-50 ${(draftStatus[lead.id] || lead.callStatus || 'pending') === 'pending' ? 'border-amber-500/30 text-amber-400' : (draftStatus[lead.id] || lead.callStatus || 'pending') === 'answered' ? 'border-emerald-500/30 text-emerald-400' : (draftStatus[lead.id] || lead.callStatus || 'pending') === 'no_answer' ? 'border-blue-500/30 text-blue-400' : 'border-rose-500/30 text-rose-400'}`}
                                                                >
                                                                    <option value="pending" className="bg-[#0f172a]">⌛ PENDING</option>
                                                                    <option value="answered" className="bg-[#0f172a]">✅ ANSWERED</option>
                                                                    <option value="no_answer" className="bg-[#0f172a]">🔇 NO ANSWER</option>
                                                                    <option value="reject" className="bg-[#0f172a]">❌ REJECT</option>
                                                                </select>
                                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                                    <span>ATTEMPT</span>
                                                                    <select
                                                                        disabled={isDisabled}
                                                                        value={draftAttempt[lead.id] || lead.callAttempt || 1}
                                                                        onChange={(e) => setDraftAttempt(prev => ({ ...prev, [lead.id]: parseInt(e.target.value) }))}
                                                                        className="bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5 text-rose-400 outline-none disabled:opacity-50"
                                                                    >
                                                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n} className="bg-[#0f172a] text-rose-400">{n}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                <select
                                                                    disabled={isDisabled}
                                                                    value={draftMethod[lead.id] || lead.callMethod || 'direct'}
                                                                    onChange={(e) => setDraftMethod(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                                    className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-200 outline-none disabled:opacity-50"
                                                                >
                                                                    <option value="direct" className="bg-[#0f172a]">Direct</option>
                                                                    <option value="whatsapp" className="bg-[#0f172a]">WhatsApp</option>
                                                                    <option value="3cx" className="bg-[#0f172a]">3CX</option>
                                                                </select>
                                                                <select
                                                                    disabled={true}
                                                                    value={enrollmentValue}
                                                                    onChange={(e) => handleEnrollmentChange(lead.id, e.target.value)}
                                                                    className={`w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none disabled:opacity-50 cursor-not-allowed ${((lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID' || (lead.enrollmentStatus && lead.enrollmentStatus.startsWith('ENROLLED_')))) ? 'text-emerald-400 border-emerald-500/30' : 'text-indigo-200'}`}
                                                                >
                                                                    <option value="NON_ENROLLED" className="bg-[#0f172a]">Non-Enrolled</option>
                                                                    <option value="ENROLLED_FULL" className="bg-[#0f172a]">Full</option>
                                                                    <option value="ENROLLED_MONTHLY" className="bg-[#0f172a]">Monthly</option>
                                                                    <option value="ENROLLED_INSTALLMENT" className="bg-[#0f172a]">Installment</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-2 relative">
                                                                {((lead.coordinationRound || 1) >= 2 || activeRound === 'non_enrolled') && lead.roundProgress?.find(r => r.roundNum === 1)?.feedback && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-amber-400/70 uppercase">R1:</span>
                                                                        <div className="bg-[#312e81]/20 border border-amber-500/20 rounded p-1.5 text-[10px] text-amber-100/70 italic max-h-12 overflow-y-auto custom-scrollbar">
                                                                            {lead.roundProgress.find(r => r.roundNum === 1).feedback}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {(activeRound === 'non_enrolled') && lead.roundProgress?.find(r => r.roundNum === 2)?.feedback && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-emerald-400/70 uppercase">R2:</span>
                                                                        <div className="bg-[#312e81]/20 border border-emerald-500/20 rounded p-1.5 text-[10px] text-emerald-100/70 italic max-h-12 overflow-y-auto custom-scrollbar">
                                                                            {lead.roundProgress.find(r => r.roundNum === 2).feedback}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <textarea
                                                                    disabled={isDisabled}
                                                                    rows="2"
                                                                    value={currentRemark}
                                                                    onChange={(e) => handleRemarkChange(lead.id, e.target.value)}
                                                                    placeholder={activeRound === 'non_enrolled' ? 'Non-Enrolled Notes...' : lead.coordinationRound === 2 ? 'Round 2 Notes...' : 'Round 1 Notes...'}
                                                                    className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-lg p-2 text-[11px] text-slate-300 outline-none focus:border-indigo-500 resize-none disabled:opacity-50 custom-scrollbar"
                                                                />
                                                                {isDraft && <span className="absolute bottom-2 right-2 bg-yellow-500 text-black text-[8px] font-black px-1 rounded shadow-sm pointer-events-none">D</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    disabled={isDisabled}
                                                                    onClick={() => handleLocalSaveCallData(lead.id)}
                                                                    className={`w-full font-black text-[10px] uppercase tracking-widest rounded-lg py-2 flex items-center justify-center gap-1 transition-all disabled:opacity-50 ${hasUnsavedChanges ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white animate-pulse" : "bg-indigo-600/50 hover:bg-indigo-500/50 text-indigo-200 border border-indigo-500/30"}`}
                                                                >
                                                                    <Check size={12} strokeWidth={3} /> {hasUnsavedChanges ? "SAVE NOW!" : "SAVE"}
                                                                </button>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onMouseEnter={() => setStudentDetailsLead(lead)}
                                                                        onMouseLeave={() => setStudentDetailsLead(null)}
                                                                        className="flex-1 bg-sky-600/30 hover:bg-sky-500/50 border border-sky-400/50 text-sky-200 p-1.5 rounded-lg flex justify-center transition-colors"
                                                                        title="Student Details"
                                                                    >
                                                                        <FaUser size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setChatModalLead(lead)}
                                                                        className="flex-1 bg-indigo-600/30 hover:bg-indigo-500/50 border border-indigo-500/30 text-white p-1.5 rounded-lg flex justify-center transition-colors relative"
                                                                        title="Open Chat"
                                                                    >
                                                                        <FaCommentDots size={12} />
                                                                        {lead.unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
                                                                    </button>
                                                                    <button
                                                                        disabled={isDisabled || lead.isBlocked}
                                                                        onClick={(e) => handleOpenReminderModal(lead, e)}
                                                                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 p-1.5 rounded-lg flex justify-center transition-colors disabled:opacity-50"
                                                                        title="Reminder"
                                                                    >
                                                                        <FaBell size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (lead.isBlocked) {
                                                                                if (window.confirm(`Unblock ${lead.phone}?`)) {
                                                                                    try {
                                                                                        const token = localStorage.getItem('token');
                                                                                        await axios.post('/after-seminar-crm/leads/unblock', { leadId: lead.id, phone: lead.phone }, { headers: { Authorization: `Bearer ${token}` } });
                                                                                        lead.isBlocked = false;
                                                                                        toast.success("Unblocked");
                                                                                        if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', false);
                                                                                    } catch (err) { toast.error("Failed to unblock"); }
                                                                                }
                                                                            } else {
                                                                                const reason = window.prompt(`Block number ${lead.phone}? Enter reason:`, "Spam / Abusive");
                                                                                if (reason !== null) {
                                                                                    try {
                                                                                        const token = localStorage.getItem('token');
                                                                                        await axios.post('/after-seminar-crm/leads/block', { leadId: lead.id, phone: lead.phone, reason }, { headers: { Authorization: `Bearer ${token}` } });
                                                                                        lead.isBlocked = true;
                                                                                        lead.blockedReason = reason;
                                                                                        toast.success("Number blocked");
                                                                                        if (typeof handleUpdateLocalLead === 'function') handleUpdateLocalLead(lead.id, 'isBlocked', true);
                                                                                    } catch (err) { toast.error("Failed to block"); }
                                                                                }
                                                                            }
                                                                        }}
                                                                        className={`flex-1 p-1.5 rounded-lg flex justify-center transition-colors ${lead.isBlocked ? 'bg-red-600 text-white' : 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10'}`}
                                                                        title={lead.isBlocked ? "Unblock" : "Block"}
                                                                    >
                                                                        <FaBan size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-8 bg-white/5 border border-white/10 p-3 rounded-2xl w-max mx-auto shadow-sm backdrop-blur-sm">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all text-xs tracking-widest uppercase"
                                >
                                    Previous
                                </button>
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-bold transition-all text-xs tracking-widest uppercase"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* REMINDER MODAL */}
            {showReminder && reminderLead && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-3">
                            <h3 className="text-white font-bold flex items-center gap-2 text-lg"><FaBell className="text-amber-500"/> {existingReminderId ? 'Update Reminder' : 'Set Reminder'}</h3>
                            <button onClick={() => setShowReminder(false)} className="text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"><FaTimes size={14}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex justify-center items-center font-black text-xs shrink-0"><FaBell size={14}/></div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white tracking-wide truncate">{reminderLead.phone}</p>
                                    <p className="text-[10px] text-amber-400 uppercase tracking-widest truncate">{reminderLead.name || 'Student'}</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
                                    <input type="date" value={remindDate} onChange={e=>setRemindDate(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500 mt-1" min={new Date().toISOString().split('T')[0]}/>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time</label>
                                    <input type="time" value={remindTime} onChange={e=>setRemindTime(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500 mt-1"/>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Note (Optional)</label>
                                <textarea value={remindNote} onChange={e=>setRemindNote(e.target.value)} placeholder="e.g. Call after 5PM, father will answer..." className="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 mt-1 resize-none h-20 custom-scrollbar"></textarea>
                            </div>
                            
                            {existingReminderId ? (
                                <div className="flex gap-2 mt-2">
                                    <button disabled={isSubmittingReminder} onClick={handleSetReminder} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex justify-center items-center gap-2">
                                        {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaSave size={14}/>} Update
                                    </button>
                                    <button disabled={isSubmittingReminder} onClick={handleDeleteReminder} className="px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-lg shadow-rose-500/20 flex justify-center items-center">
                                        {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaTrash size={14}/>}
                                    </button>
                                </div>
                            ) : (
                                <button disabled={isSubmittingReminder} onClick={handleSetReminder} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl mt-2 transition-all flex justify-center items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50">
                                    {isSubmittingReminder ? <Loader2 className="animate-spin" size={16}/> : <FaCheckCircle size={16}/>} Save Reminder
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Student Details Hover Popover */}
            {studentDetailsLead && createPortal(
                <div className="fixed top-24 right-6 z-[99999] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4">
                    <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-sky-500/40 w-[380px] rounded-2xl overflow-hidden flex flex-col transform transition-all shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-slate-800/30">
                            <h2 className="text-slate-200 font-bold flex items-center gap-2">
                                <FaUser className="text-sky-400" /> Student Details
                            </h2>
                            <button onClick={() => setStudentDetailsLead(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-rose-500/20 transition-colors">
                                <FaTimes size={16} />
                            </button>
                        </div>
                        <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {isStudentDetailsLoading ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-3" />
                                    <p className="text-slate-400 text-sm">Fetching records...</p>
                                </div>
                            ) : studentDetailsData?.isEnrolled ? (() => {
                                const currentBatchId = studentDetailsLead?.batchId;
                                const enrollmentsList = studentDetailsData?.uniqueEnrollments || (studentDetailsData?.student?.payments ? Object.values(studentDetailsData.student.payments.reduce((acc, p) => {
                                    const key = `${p.businessId}_${p.batchId}`;
                                    if (!acc[key]) acc[key] = { ...p, businessName: p.business?.name, batchName: p.batch?.name, paymentType: p.payment_type };
                                    return acc;
                                }, {})) : []);

                                const currentBatchEnrollment = enrollmentsList.find(e => e.batchId === currentBatchId && e.status === 1);
                                const currentBatchPending = enrollmentsList.find(e => e.batchId === currentBatchId && (e.status === 0 || e.status === 4));
                                const otherApprovedEnrollments = enrollmentsList.filter(e => e.batchId !== currentBatchId && e.status === 1);

                                return (
                                    <div className="space-y-4">
                                        {currentBatchEnrollment ? (
                                            <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/40 text-xs">
                                                <FaCheckCircle size={14} className="shrink-0"/> APPROVED & ENROLLED (THIS BATCH)
                                            </div>
                                        ) : otherApprovedEnrollments.length > 0 ? (
                                            <div className="flex flex-col gap-1 text-sky-300 font-bold bg-sky-950/60 p-3 rounded-xl border border-sky-500/50 text-xs shadow-inner">
                                                <div className="flex items-center gap-2 text-sky-300">
                                                    <FaCheckCircle size={14} className="text-sky-400 shrink-0"/> ENROLLED IN OTHER BATCH ({otherApprovedEnrollments.map(e => e.batchName || 'Other Batch').join(', ')})
                                                </div>
                                                <span className="text-[10px] text-sky-200/80 font-normal leading-relaxed">
                                                    Active student in another batch. In this batch, this lead is a fresh prospective lead in Round 1.
                                                </span>
                                            </div>
                                        ) : (currentBatchPending || studentDetailsData?.hasPendingPayment) ? (
                                            <div className="flex flex-col gap-1 text-amber-300 font-bold bg-amber-950/60 p-3 rounded-xl border border-amber-500/50 text-xs shadow-inner">
                                                <div className="flex items-center gap-2">
                                                    <FaClock size={14} className="text-amber-400 shrink-0 animate-pulse"/> SLIP PENDING / POST-PAY (NOT APPROVED)
                                                </div>
                                                <span className="text-[10px] text-amber-200/80 font-medium leading-relaxed">
                                                    Payment submitted/post-pay is pending manager approval. Lead moves to Paid section automatically once approved.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sky-400 font-bold bg-sky-900/30 p-3 rounded-xl border border-sky-500/40 text-xs">
                                                <FaUser size={14} className="shrink-0"/> REGISTERED ACCOUNT (NO PAYMENT YET)
                                            </div>
                                        )}
                    
                                        <div className="space-y-3 bg-slate-800/20 p-4 rounded-xl border border-slate-700/50">
                                            <div className="text-sm">
                                                <span className="text-slate-500 block mb-0.5 text-xs font-semibold">Full Name & ID</span>
                                                <span className="text-slate-200 font-bold">{studentDetailsData.student.firstName} {studentDetailsData.student.lastName} (ID: {studentDetailsData.student.id})</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-slate-500 block mb-0.5 text-xs font-semibold"><FaMapMarkerAlt className="inline mr-1 text-slate-400"/> Address</span>
                                                <span className="text-slate-300">{studentDetailsData.student.addressHouseNo}, {studentDetailsData.student.addressStreet}, {studentDetailsData.student.city}</span>
                                            </div>
                                            
                                            {enrollmentsList.length > 0 && (
                                                <div className="space-y-3">
                                                    {enrollmentsList.map((enr, idx) => {
                                                        const isThisBatch = enr.batchId === currentBatchId;
                                                        return (
                                                            <div key={idx} className="text-sm mt-3 pt-3 border-t border-slate-700/50">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-slate-500 text-xs font-semibold flex items-center gap-1">
                                                                        <FaGraduationCap className="text-slate-400"/> Enrollment #{idx + 1}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {enr.classType === 2 ? (
                                                                            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">📝 Paper Class</span>
                                                                        ) : (
                                                                            <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">📘 Theory Class</span>
                                                                        )}
                                                                        {isThisBatch ? (
                                                                            <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">Current Batch</span>
                                                                        ) : (
                                                                            <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full font-bold">Other Batch</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-sky-300 font-black block">{enr.businessName || enr.business?.name}</span>
                                                                <span className="text-slate-300 block text-xs mt-0.5 font-medium">{enr.batchName || enr.batch?.name}</span>

                                                                <div className="text-sm mt-2">
                                                                    <span className="text-slate-500 block mb-1 text-[11px] font-semibold">Enrolled Subjects</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {enr.courses?.map(c => (
                                                                            <span key={c.id} className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] text-slate-200 border border-slate-600 font-medium">{c.name}</span>
                                                                        ))}
                                                                        {(!enr.courses || enr.courses.length === 0) && (
                                                                            <span className="text-slate-500 text-[11px] italic">No specific subjects found.</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="text-xs mt-2 pb-1">
                                                                    <span className="text-slate-500 block mb-0.5 font-semibold"><FaCreditCard className="inline mr-1 text-slate-400"/> Payment Option</span>
                                                                    <span className="text-emerald-400 font-bold">{getPaymentOption(enr)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="text-center py-10 bg-slate-800/20 rounded-xl border border-slate-700/50">
                                    <FaExclamationCircle className="mx-auto text-slate-500 mb-3" size={32} />
                                    <p className="text-slate-400 font-medium">No registered student records found for this number.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Guidance Modal */}
            {isGuidanceModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
                    <div className="bg-[#090E17] border border-indigo-500/30 w-full max-w-5xl rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] relative transform transition-all duration-500 scale-100">

                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                        
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-indigo-900/40 to-transparent">
                            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-wide">
                                <BookOpen className="text-indigo-400" size={28} />
                                Open Seminar Staff Guidance
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="flex bg-black/40 rounded-xl p-1 border border-white/10 shadow-inner">
                                    <button
                                        onClick={() => setGuidanceLang('SI')}
                                        className={`px-6 py-2 rounded-lg text-sm font-black transition-all duration-300 ${guidanceLang === 'SI' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        සිංහල
                                    </button>
                                    <button
                                        onClick={() => setGuidanceLang('EN')}
                                        className={`px-6 py-2 rounded-lg text-sm font-black transition-all duration-300 ${guidanceLang === 'EN' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        English
                                    </button>
                                </div>
                                <button onClick={() => setIsGuidanceModalOpen(false)} className="text-slate-400 hover:text-white p-3 bg-white/5 rounded-xl hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 text-sm text-slate-300 custom-scrollbar">

                            {guidanceLang === 'EN' ? (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                                        <h3 className="text-indigo-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-lg">📌 What is Open Seminar?</h3>
                                        <p className="leading-relaxed text-[15px]">
                                            The Open Seminar campaign tracks students who have inquired specifically about our opening seminars or normal inquiries who haven't enrolled yet. Your primary goal is to guide them, answer their questions, and successfully enroll them into a payment plan.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-[#1e1b4b]/50 border border-emerald-500/20 p-6 rounded-2xl shadow-lg hover:border-emerald-500/40 transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                                            <h3 className="text-emerald-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">🔄 Round 01 & Round 02</h3>
                                            <ul className="space-y-4">
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Round 01:</strong> All fresh leads start here. You must call them and set an outcome.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Round 02:</strong> Leads that were automatically pushed from Round 01. They freeze initially, then become active for follow-up.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Non Enrolled:</strong> Inquiries that have expired or been marked as rejected.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Paid:</strong> Leads that have successfully enrolled.</div></li>
                                            </ul>
                                        </div>


                                    </div>

                                    <div className="bg-[#1e1b4b]/50 border border-amber-500/20 p-6 rounded-2xl shadow-lg hover:border-amber-500/40 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
                                        <h3 className="text-amber-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">⚠️ Delay Tracking & Countdown</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-amber-300 font-bold mb-2 text-[15px]">Round 1 (First 7 Days)</h4>
                                                <ul className="space-y-2 text-[14px]">
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> Round 1 has a strict 7-day limit from the assigned date.</li>
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> If you don't push them to Round 2 within 7 days, they become <strong className="text-rose-400">LATE</strong>.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-amber-300 font-bold mb-2 text-[15px]">Round 2 (Frozen & Active)</h4>
                                                <ul className="space-y-2 text-[14px]">
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> When pushed, they instantly <strong className="text-cyan-400">FREEZE</strong> until 7 days have passed since assignment.</li>
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> After 7 days, they unfreeze and you have another 7 days to call before they expire (14 days total).</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#1e1b4b]/50 border border-rose-500/20 p-6 rounded-2xl shadow-lg hover:border-rose-500/40 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
                                        <h3 className="text-rose-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">✅ How to Process a Lead</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">1</div>
                                                <div className="flex-1 text-[13px] leading-tight">Select <strong>Call Outcome</strong> (e.g. Answered, No Answer).</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">2</div>
                                                <div className="flex-1 text-[13px] leading-tight">Select <strong>Call Method</strong> you used (Direct, WhatsApp).</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">3</div>
                                                <div className="flex-1 text-[13px] leading-tight">Set <strong>Enrollment Status</strong> to update Paid tab.</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">4</div>
                                                <div className="flex-1 text-[13px] leading-tight">Type <strong>Remarks</strong>, then click <strong>SAVE PROGRESS</strong>.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                                        <h3 className="text-indigo-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-lg">📌 Open Seminar කියන්නේ මොකක්ද?</h3>
                                        <p className="leading-relaxed text-[15px]">
                                            Open Seminar Campaign එකෙන් පෙන්නන්නේ අපි කරන Open Seminars වලට සම්බන්ධ වෙන්න අහපු ළමයි සහ තාමත් පන්ති වලට ලියාපදිංචි (Enroll) වුණේ නැති සාමාන්‍ය inquiries. ඔයාගේ ප්‍රධාන අරමුණ මේ ළමයින්ට කතා කරලා, එයාලව Payment Plan එකකට ඇතුළත් කරගන්න එකයි.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-[#1e1b4b]/50 border border-emerald-500/20 p-6 rounded-2xl shadow-lg hover:border-emerald-500/40 transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                                            <h3 className="text-emerald-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">🔄 Round 01 සහ Round 02</h3>
                                            <ul className="space-y-4">
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Round 01:</strong> අලුතින් එන හැම Lead එකක්ම මුලින්ම එන්නේ මෙතැනට. ඔයා මේ අයට කතා කරලා Outcome එකක් දාන්න ඕනෙ.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Round 02:</strong> Round 1 එකෙන් Auto-push වුණු Leads. මේ අය දවස් 7ක් යනකම් Freeze වෙලා ඉඳලා ඊට පස්සේ Active වෙනවා.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Non Enrolled:</strong> කල් ඉකුත් වුණු හෝ Reject කරපු ළමයි.</div></li>
                                                <li className="flex gap-3"><span className="text-emerald-500 mt-1">●</span><div><strong className="text-white text-[15px]">Paid:</strong> සල්ලි ගෙවලා සම්පූර්ණයෙන් Enroll වුණු ළමයි.</div></li>
                                            </ul>
                                        </div>


                                    </div>

                                    <div className="bg-[#1e1b4b]/50 border border-amber-500/20 p-6 rounded-2xl shadow-lg hover:border-amber-500/40 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
                                        <h3 className="text-amber-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">⚠️ Delay Tracking සහ Countdown එක</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-amber-300 font-bold mb-2 text-[15px]">Round 1 (පළමු දින 7)</h4>
                                                <ul className="space-y-2 text-[14px]">
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> Lead එක Assign වූ දවසේ සිට දින 7ක් Round 1 එකට ලැබේ.</li>
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> දින 7 ඇතුළත Round 2 එකට Push නොකළහොත් එය <strong className="text-rose-400">LATE</strong> ලෙස රතු පාටින් පෙන්වයි.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-amber-300 font-bold mb-2 text-[15px]">Round 2 (Frozen & Active)</h4>
                                                <ul className="space-y-2 text-[14px]">
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> Round 2 එකට ගිය විගස, මුල් දින 7 සම්පූර්ණ වන තුරු Lead එක <strong className="text-cyan-400">FREEZE</strong> වේ.</li>
                                                    <li className="flex gap-2 text-amber-100/70"><span className="text-amber-500 mt-0.5">▪</span> ඉන්පසු එය Unfreeze වී නැවත දින 7ක Active කාලයක් ලැබේ (මුළු කාලය දින 14යි). ඉන්පසු ස්වයංක්‍රීයව Non-Enrolled වේ.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#1e1b4b]/50 border border-rose-500/20 p-6 rounded-2xl shadow-lg hover:border-rose-500/40 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
                                        <h3 className="text-rose-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-lg">✅ Lead එකක් Process කරන්නේ කොහොමද?</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">1</div>
                                                <div className="flex-1 text-[13px] leading-tight"><strong>Call Outcome</strong> එක තෝරන්න (Answered, No Answer).</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">2</div>
                                                <div className="flex-1 text-[13px] leading-tight">කතා කරපු <strong>Call Method</strong> එක තෝරන්න.</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">3</div>
                                                <div className="flex-1 text-[13px] leading-tight"><strong>Enrollment Status</strong> එක තෝරන්න.</div>
                                            </div>
                                            <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                                <div className="w-10 h-10 min-w-[40px] rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-black text-lg">4</div>
                                                <div className="flex-1 text-[13px] leading-tight"><strong>Remarks</strong> ලියා <strong>SAVE PROGRESS</strong> ඔබන්න!</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
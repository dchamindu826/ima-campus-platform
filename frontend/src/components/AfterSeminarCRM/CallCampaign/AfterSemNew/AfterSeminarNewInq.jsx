import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../../api/axios';
import * as XLSX from 'xlsx';
import { FaSearch, FaCommentDots, FaArrowRight, FaTimes, FaBell, FaSave, FaTrash, FaCheckCircle, FaUser, FaMapMarkerAlt, FaGraduationCap, FaCreditCard, FaLayerGroup, FaPhoneAlt, FaWhatsapp, FaClock, FaBan, FaFileExcel } from 'react-icons/fa';
import { Target, PhoneCall, Check, Loader, BookOpen, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';


const getShiftData = (dateString) => {
    if (!dateString) return { dateStr: 'Unknown', label: 'Unknown Date', timestamp: 0 };
    const d = new Date(dateString);
    const shiftDate = new Date(d);
    if (d.getHours() < 8) shiftDate.setDate(shiftDate.getDate() - 1);
    shiftDate.setHours(0, 0, 0, 0);
    const now = new Date();
    const todayShift = new Date(now);
    if (now.getHours() < 8) todayShift.setDate(todayShift.getDate() - 1);
    todayShift.setHours(0, 0, 0, 0);
    const yesterdayShift = new Date(todayShift);
    yesterdayShift.setDate(yesterdayShift.getDate() - 1);
    if (shiftDate.getTime() === todayShift.getTime()) return { label: 'Today', timestamp: shiftDate.getTime() };
    else if (shiftDate.getTime() === yesterdayShift.getTime()) return { label: 'Yesterday', timestamp: shiftDate.getTime() };
    else return { label: shiftDate.toLocaleDateString('en-CA'), timestamp: shiftDate.getTime() };
};

export default function AfterSeminarNewInq({ leads, allBatches, filters, drafts, setDrafts, handleUpdateLocalLead, handleSaveCallData, setChatModalLead, isManager, handleTempUnlock, externalSearch }) {

    const [activeRound, setActiveRound] = useState('r1');
    const [activePhase, setActivePhase] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState(externalSearch || '');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, DELAYED
    const [currentPage, setCurrentPage] = useState(1);

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
    const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);
    const [guidanceLang, setGuidanceLang] = useState('SI');

    const [viewMode, setViewMode] = useState('TILE');
    const [draftStatus, setDraftStatus] = useState({});
    const [draftAttempt, setDraftAttempt] = useState({});
    const [draftMethod, setDraftMethod] = useState({});

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

    const [showReminder, setShowReminder] = useState(false);
    const [reminderLead, setReminderLead] = useState(null);
    const [existingReminderId, setExistingReminderId] = useState(null);
    const [remindDate, setRemindDate] = useState('');
    const [remindTime, setRemindTime] = useState('');
    const [remindNote, setRemindNote] = useState('');
    const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);

    const ITEMS_PER_PAGE = 20;

    const openSemLeads = Array.isArray(leads) ? leads.filter(l => l?.inquiryType === 'NEW_INQ') : [];

    const isLeadDelayed = useCallback((l) => {
        if (l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID') return false;
        if (!isLeadPending(l)) return false; 
        
        const startTime = new Date(l.assignedAt || l.createdAt).getTime();
        const now = new Date().getTime();
        
        const diffMs = now - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        const round = l.coordinationRound || 1;
        
        if (round === 1 && diffHours >= 24) return true;
        if (round === 2 && diffDays >= 7) return true;
        
        return false;
    }, []);

    const isLeadPending = (l) => {
        return !l.callStatus || l.callStatus === 'pending' || l.callStatus === '';
    };

    const filteredLeads = useMemo(() => {
        let filtered = openSemLeads;

        if (activeRound === 'enrolled') {
            filtered = filtered.filter(l => l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID');
        } else if (activeRound === 'non_enrolled') {
            filtered = filtered.filter(l => l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID' && l?.coordinationRound === 3);
        } else {
            filtered = filtered.filter(l => l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID' && l?.inquiryType === 'NEW_INQ');
            if (activeRound === 'r1') filtered = filtered.filter(l => (l?.coordinationRound || 1) === 1);
            if (activeRound === 'r2') filtered = filtered.filter(l => l?.coordinationRound === 2);
        }

        if (activePhase !== 'ALL') filtered = filtered.filter(l => l?.phase === activePhase);

        if (statusFilter === 'PENDING') {
            filtered = filtered.filter(isLeadPending);
        } else if (statusFilter === 'DELAYED') {
            filtered = filtered.filter(isLeadDelayed);
        }

        if (searchQuery) {
            const sq = searchQuery.toLowerCase();
            filtered = filtered.filter(l => l?.phone?.includes(sq) || (l?.name && l?.name?.toLowerCase().includes(sq)));
        }

        const checkIsFrozen = (l) => {
            if (!l || !l.assignedAt) return false;
            if (l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID') return false;
            const round = l.coordinationRound || 1;
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

            // 2. Rejected leads go to the very bottom
            const aRejected = a?.callStatus === 'reject';
            const bRejected = b?.callStatus === 'reject';
            if (aRejected && !bRejected) return 1;
            if (!aRejected && bRejected) return -1;

            // 3. If BOTH are frozen: sort by unfreezing SOONEST first (oldest assignedAt first: 1D, 2D... then 5D, 6D)
            if (aFrozen && bFrozen) {
                const aTime = new Date(a?.assignedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.assignedAt || b?.createdAt || 0).getTime();
                return aTime - bTime;
            }

            // 4. For unfrozen leads: newest assigned first
            const aTime = new Date(a?.assignedAt || a?.createdAt || 0).getTime();
            const bTime = new Date(b?.assignedAt || b?.createdAt || 0).getTime();
            return bTime - aTime;
        });

        return filtered;
    }, [openSemLeads, activeRound, activePhase, statusFilter, searchQuery]);

    const stats = useMemo(() => {
        let totalAssigned = 0;
        let currentlyInRound = 0;
        let pending = 0;
        let noAnswer = 0;
        let reject = 0;
        let delayed = 0;
        let movedToR2 = 0;
        let movedToNonEnrolled = 0;
        let movedToPaid = 0;
        let responseRate = 0;
        
        let baseLeads = openSemLeads;
        if (activePhase !== 'ALL') baseLeads = baseLeads.filter(l => l?.phase === activePhase);

        if (activeRound === 'r1') {
            totalAssigned = baseLeads.length;
            
            const r1CurrentLeads = baseLeads.filter(l => (l?.coordinationRound || 1) === 1 && l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID');
            currentlyInRound = r1CurrentLeads.length;
            
            pending = r1CurrentLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            noAnswer = r1CurrentLeads.filter(l => l.callStatus === 'no_answer').length;
            reject = r1CurrentLeads.filter(l => l.callStatus === 'reject').length;
            delayed = r1CurrentLeads.filter(l => isLeadDelayed(l)).length;
            
            movedToR2 = baseLeads.filter(l => (l?.coordinationRound || 1) > 1 && l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID').length;
            
            const enrolledCount = baseLeads.filter(l => l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID').length;
            responseRate = totalAssigned > 0 ? ((enrolledCount / totalAssigned) * 100).toFixed(1) : 0;
            
        } else if (activeRound === 'r2') {
            const r2ArrivedLeads = baseLeads.filter(l => (l?.coordinationRound || 1) >= 2);
            totalAssigned = r2ArrivedLeads.length;
            
            const r2CurrentLeads = r2ArrivedLeads.filter(l => (l?.coordinationRound || 1) === 2 && l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID');
            currentlyInRound = r2CurrentLeads.length;
            
            pending = r2CurrentLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            noAnswer = r2CurrentLeads.filter(l => l.callStatus === 'no_answer').length;
            reject = r2CurrentLeads.filter(l => l.callStatus === 'reject').length;
            delayed = r2CurrentLeads.filter(l => isLeadDelayed(l)).length;
            
            movedToNonEnrolled = r2ArrivedLeads.filter(l => l?.coordinationRound === 3 && l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID').length;
            movedToPaid = r2ArrivedLeads.filter(l => l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID').length;
            
            const r2EnrolledCount = r2ArrivedLeads.filter(l => l?.enrollmentStatus === 'ENROLLED' || l?.enrollmentStatus === 'PAID').length;
            responseRate = totalAssigned > 0 ? ((r2EnrolledCount / totalAssigned) * 100).toFixed(1) : 0;
            
        } else if (activeRound === 'non_enrolled') {
            const nonEnrolledLeads = baseLeads.filter(l => l?.enrollmentStatus !== 'ENROLLED' && l?.enrollmentStatus !== 'PAID' && l?.coordinationRound === 3);
            totalAssigned = nonEnrolledLeads.length;
            currentlyInRound = totalAssigned;
            pending = nonEnrolledLeads.filter(l => l.callStatus === 'pending' || !l.callStatus).length;
            reject = nonEnrolledLeads.filter(l => l.callStatus === 'reject').length;
            delayed = nonEnrolledLeads.filter(l => isLeadDelayed(l)).length;
        } else if (activeRound === 'enrolled') {
            const enrolledLeads = baseLeads.filter(l => l?.enrollmentStatus === 'ENROLLED');
            totalAssigned = enrolledLeads.length;
            currentlyInRound = totalAssigned;
        }

        return { totalAssigned, currentlyInRound, pending, noAnswer, reject, delayed, movedToR2, movedToNonEnrolled, movedToPaid, responseRate };
    }, [openSemLeads, activeRound, activePhase]);

    const groupedLeads = useMemo(() => {
        if (activeRound === 'r2') {
            return [{ label: 'ROUND 2 LEADS', timestamp: 0, leads: filteredLeads, total: filteredLeads.length }];
        }
        
        if (activeRound !== 'r1') {
            return [{ label: activeRound === 'enrolled' ? 'Paid Leads' : activeRound === 'non_enrolled' ? 'Non-Enrolled Leads' : 'Leads', timestamp: 0, leads: filteredLeads }];
        }

        const groups = {};
        filteredLeads.forEach(lead => {
            if (!lead) return;
            let targetDate = lead.assignedAt || lead.newInqTimestamp || lead.createdAt;
            if (lead.phase > 1 || (lead.coordinationRound || 1) > 1 || (lead.callStatus && lead.callStatus !== 'pending')) {
                targetDate = lead.roundProgress?.[0]?.updatedAt || lead.assignedAt || lead.newInqTimestamp || lead.createdAt;
            }
            const shiftInfo = getShiftData(targetDate);
            const label = shiftInfo.label;
            if (!groups[label]) groups[label] = { label: label, timestamp: shiftInfo.timestamp, leads: [] };
            groups[label].leads.push(lead);
        });
        return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
    }, [filteredLeads, activeRound]);

    const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


    const handleRemarkChange = (leadId, value) => {
        setDrafts(prev => ({ ...prev, [leadId]: value }));
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
        
        // If in TABLE mode, draftStatus has the latest state, else lead.callStatus
        const finalStatus = draftStatus[leadId] || lead.callStatus || 'pending';
        const finalMethod = draftMethod[leadId] || lead.callMethod || 'direct';
        const finalAttempt = draftAttempt[leadId] || lead.callAttempt || 1;

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
                status: finalStatus,
                feedback,
                coordinationRound: lead.coordinationRound || 1,
                campaignContext: 'NEW_INQ',
                paymentIntention: lead.paymentIntention || 'NOT_DECIDED',
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED'
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success("Progress saved successfully!", { id: loadToast });

            const newDrafts = { ...drafts };
            delete newDrafts[leadId];
            setDrafts(newDrafts);
            localStorage.removeItem(`draft_remark_as_${leadId}`);
            
            if (draftStatus[leadId]) {
                const newDS = {...draftStatus}; delete newDS[leadId]; setDraftStatus(newDS);
                const newDM = {...draftMethod}; delete newDM[leadId]; setDraftMethod(newDM);
                const newDA = {...draftAttempt}; delete newDA[leadId]; setDraftAttempt(newDA);
            }

            handleUpdateLocalLead(leadId, 'feedback', feedback);
            handleUpdateLocalLead(leadId, 'callStatus', finalStatus);
            handleUpdateLocalLead(leadId, 'callMethod', finalMethod);
            handleUpdateLocalLead(leadId, 'callAttempt', finalAttempt);
            
            // Move to round 2 in real-time if answered in round 1
            if ((lead.coordinationRound || 1) === 1 && finalStatus === 'answered') {
                handleUpdateLocalLead(leadId, 'coordinationRound', 2);
            }
        } catch (error) {
            toast.error("Failed to save progress.", { id: loadToast });
        }
    };

    const handlePushToNextRound = async (leadId, currentRound, callStatus, phase) => {
        if (callStatus === 'pending' || !callStatus) return toast.error("Change Status before pushing!");
        if (callStatus === 'reject') return toast.error("Rejected leads cannot be pushed to the next round.");
        
        if (phase === 1 && callStatus !== 'answered') {
            return toast.error("In Phase 1, only 'Answered' leads can be pushed to the next round.");
        }
        
        if (phase === 2 && !['answered', 'no_answer'].includes(callStatus)) {
            return toast.error("In Phase 2, only 'Answered' or 'No Answer' leads can be pushed to the next round.");
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
        if (!lead || !lead.assignedAt) return null;
        if (lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID') return null;
        const startTime = new Date(lead.assignedAt).getTime();
        const now = new Date().getTime();
        const diffMs = now - startTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        const diffHours = diffMs / (1000 * 60 * 60);

        if ((lead.coordinationRound || 1) === 1) {
            if (diffHours >= 24) return { text: `DELAYED BY ${Math.floor(diffHours - 24)}H`, type: 'delayed' };
            const remaining = 24 - diffHours;
            return { text: `${Math.floor(remaining)}H REMAINING`, type: 'active' };
        } else if ((lead.coordinationRound || 1) === 2) {
            if (diffDays < 6) {
                const remainingDays = 6 - diffDays;
                return { text: `FROZEN: ${Math.ceil(remainingDays)}D LEFT`, type: 'frozen' };
            } else if (diffDays < 7) { 
                const remainingHours = (7 - diffDays) * 24;
                return { text: `${Math.floor(remainingHours)}H REMAINING`, type: 'active' };
            } else {
                return { text: `DELAYED BY ${Math.floor(diffDays - 7)}D`, type: 'delayed' };
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
                || (l.newInqRound === 1 || l.coordinationRound === 1 ? (l.newInqFeedback || l.openSemFeedback || l.feedback) : '')
                || "-";
            const r2Remark = l.roundProgress?.find(r => r.roundNum === 2)?.feedback 
                || (l.newInqRound === 2 || l.coordinationRound === 2 ? (l.newInqFeedback || l.openSemFeedback || l.feedback) : '')
                || "-";
            const nonEnrolledRemark = l.roundProgress?.find(r => r.roundNum === 3)?.feedback 
                || l.coordinationRemark 
                || l.nonEnrolledReason 
                || (l.newInqRound === 3 || l.coordinationRound === 3 ? (l.newInqFeedback || l.openSemFeedback || l.feedback) : '')
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
        XLSX.writeFile(workbook, `New_Inquiries_Non_Enrolled_Leads_${dateStr}.xlsx`);
        toast.success(`Exported ${filteredLeads.length} leads successfully!`);
    };

    return (<>
        <div className="w-full h-full flex flex-col bg-transparent overflow-y-auto custom-scrollbar font-sans text-slate-100">
            <div className="fade-in">

                {/* Header matching CallCenterAgentDashboard detail view */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 flex items-center gap-3">
                        <Target className="text-emerald-400" />
                        NEW INQUIRY CAMPAIGN
                    </h1>
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md shadow-sm">
                        <span className="text-xs font-bold text-slate-400">Campaign:</span>
                        <span className="text-sm font-black text-emerald-400">NEW INQUIRY</span>
                        <div className="w-px h-5 bg-white/10 mx-1"></div>
                        <button
                            onClick={() => setIsGuidanceModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            <BookOpen size={14} /> Read Guidance
                        </button>
                    </div>
                </div>

                {/* Top Round Buttons (Moved Outside) */}
                <div className="flex gap-2 bg-[#0F172A]/80 p-2 rounded-2xl flex-wrap shadow-inner mb-6 w-max border border-white/5">
                    <button
                        onClick={() => { setActiveRound('r1'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-4 py-2.5 rounded-lg flex-1 md:flex-none text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-sm ${activeRound === 'r1' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Round 01
                    </button>
                    <button
                        onClick={() => { setActiveRound('r2'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-4 py-2.5 rounded-lg flex-1 md:flex-none text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-sm ${activeRound === 'r2' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Round 02
                    </button>
                    <button
                        onClick={() => { setActiveRound('non_enrolled'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-sm ${activeRound === 'non_enrolled' ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Non Enrolled
                    </button>
                    <button
                        onClick={() => { setActiveRound('enrolled'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-4 py-2.5 rounded-lg flex-1 md:flex-none text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-sm ${activeRound === 'enrolled' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Paid
                    </button>
                </div>

                {/* Stats & Filters Box */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-6 backdrop-blur-sm shadow-lg">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

                        {/* Stats Section */}
                        <div className="flex gap-4 items-center bg-[#0F172A]/50 p-4 px-6 rounded-3xl border border-white/5 shadow-inner flex-wrap w-full xl:w-auto overflow-x-auto custom-scrollbar">
                            <div className="flex flex-col items-center"><span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1" title="Leads currently sitting in this Round">In Round</span><span className="text-xl font-black text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]">{stats.currentlyInRound}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <div className="flex flex-col items-center"><span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pending</span><span className="text-xl font-black text-amber-400">{stats.pending}</span></div>
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
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Paid</span><span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{stats.movedToPaid}</span></div>
                                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                                    
                                    <div className="flex flex-col items-center"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Non Enrolled</span><span className="text-xl font-black text-slate-400">{stats.movedToNonEnrolled}</span></div>
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
                            <div className="space-y-8 pb-10">
                                {groupedLeads.map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-4">
                                        <div className="sticky top-0 z-10 py-2 backdrop-blur-sm mb-4">
                                            <div className="flex justify-between items-center relative py-2.5">
                                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent border-l-4 border-emerald-500 rounded-r-2xl shadow-sm"></div>
                                                <div className="relative px-5 flex items-center gap-2">
                                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400 drop-shadow-md">
                                                        {group.label}
                                                    </h3>
                                                </div>
                                                <div className="relative px-5">
                                                    <div className="text-xs font-bold text-emerald-200 bg-emerald-500/20 px-4 py-1 rounded-full border border-emerald-500/30 shadow-inner">
                                                        {group.leads.length} Leads
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {group.leads.map((lead, index) => {
                                                const realIndex = index + 1;
                                    const currentRemark = drafts[lead.id] !== undefined ? drafts[lead.id] : (lead.feedback || '');
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

                                    return (
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
                                                            {timerData && (
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm border ${timerData.type === 'delayed' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : timerData.type === 'frozen' ? 'bg-slate-700/60 text-slate-300 border-slate-600/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                                                                    {timerData.text}
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
                                                                        className="text-emerald-400 text-[10px] font-bold uppercase leading-tight w-full break-words hover:underline cursor-pointer" 
                                                                        title="View Details"
                                                                    >
                                                                        WEB: {lead.registeredUser.firstName} {lead.registeredUser.lastName}
                                                                    </p>
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                                        {lead.registeredUser.phone && lead.phone?.split('_')[0].slice(-9) !== lead.registeredUser.phone.slice(-9) && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <p className="text-amber-400 text-xs font-bold uppercase truncate">Web Pri: {lead.registeredUser.phone}</p>
                                                                                <button 
                                                                                    onClick={() => handleCopy(lead.registeredUser.phone, 'Web primary number')}
                                                                                    className="text-amber-400/50 hover:text-amber-300 transition-colors"
                                                                                    title="Copy Web Primary Number"
                                                                                >
                                                                                    <Copy size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {lead.registeredUser.optionalPhone && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <p className="text-amber-400 text-xs font-bold uppercase truncate">Web Sec: {lead.registeredUser.optionalPhone}</p>
                                                                                <button 
                                                                                    onClick={() => handleCopy(lead.registeredUser.optionalPhone, 'Web secondary number')}
                                                                                    className="text-amber-400/50 hover:text-amber-300 transition-colors"
                                                                                    title="Copy Web Secondary Number"
                                                                                >
                                                                                    <Copy size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {(enrollmentValue === 'ENROLLED' || enrollmentValue === 'ENROLLED_INSTALLMENT') && lead.enrolledSubjects && lead.enrolledSubjects.length > 0 && (
                                                                <p className="text-purple-400 text-[10px] font-bold uppercase truncate w-full" title={lead.enrolledSubjects.join(', ')}>SUB: {lead.enrolledSubjects[0]} {lead.enrolledSubjects.length > 1 ? `+${lead.enrolledSubjects.length - 1}` : ''}</p>
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
                                                        className={`w-full bg-[#312e81]/30 border rounded-xl px-2 py-2 text-xs font-bold outline-none appearance-none transition-colors
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
                                                        className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-2 text-xs font-black text-rose-400 outline-none focus:border-rose-500 appearance-none text-center"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n} className="bg-[#0f172a] text-rose-400">{n}</option>)}
                                                    </select>
                                                </div>

                                                <div className="col-span-6">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Method</label>
                                                    <select
                                                        disabled={isDisabled}
                                                        value={draftMethod[lead.id] || lead.callMethod || 'direct'}
                                                        onChange={(e) => setDraftMethod(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                        className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-2 py-2 text-xs font-bold text-indigo-200 outline-none appearance-none"
                                                    >
                                                        <option value="direct" className="bg-[#0f172a]">Direct Call</option>
                                                        <option value="whatsapp" className="bg-[#0f172a]">WhatsApp</option>
                                                        <option value="3cx" className="bg-[#0f172a]">3CX</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-6">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Enrollment</label>
                                                    <select
                                                        value={enrollmentValue}
                                                        disabled={true}
                                                        className={`w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-2 py-2 text-xs font-bold outline-none appearance-none cursor-not-allowed ${lead.enrollmentStatus === 'ENROLLED' ? 'text-emerald-400 border-emerald-500/30' : 'text-indigo-200'}`}
                                                    >
                                                        <option value="NON_ENROLLED" className="bg-[#0f172a]">Non-Enrolled</option>
                                                        <option value="ENROLLED_FULL" className="bg-[#0f172a]">Enrolled - Full</option>
                                                        <option value="ENROLLED_MONTHLY" className="bg-[#0f172a]">Enrolled - Monthly</option>
                                                        <option value="ENROLLED_INSTALLMENT" className="bg-[#0f172a]">Enrolled - Install</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mb-4 relative flex-1 flex flex-col">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Remarks</label>
                                                <textarea
                                                    disabled={isDisabled}
                                                    rows="2"
                                                    value={currentRemark}
                                                    onChange={(e) => handleRemarkChange(lead.id, e.target.value)}
                                                    placeholder="Add your notes..."
                                                    className="w-full flex-1 bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none placeholder-indigo-300/30 transition-colors custom-scrollbar"
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
                                                    className="flex-1 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                                                >
                                                    <Check size={16} strokeWidth={3} /> SAVE
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
                                                    className="bg-indigo-600/50 hover:bg-indigo-500 border border-indigo-500/50 text-white p-2.5 rounded-xl flex items-center justify-center relative transition-all shadow-md transform hover:-translate-y-0.5"
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
                                                    className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 p-2.5 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:-translate-y-0.5 disabled:opacity-50"
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
                                                    className={`p-2.5 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:-translate-y-0.5 ${
                                                        lead.isBlocked 
                                                            ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-500/30' 
                                                            : 'bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10'
                                                    }`}
                                                >
                                                    <FaBan size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                        </div>
                                    </div>
                                ))}
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
                                                                            const currentRemark = drafts[lead.id] !== undefined ? drafts[lead.id] : (lead.feedback || '');
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
                                                                                                className={`w-full bg-[#0F172A] border border-white/10 rounded-xl py-1.5 px-2 text-[10px] font-bold appearance-none outline-none cursor-not-allowed ${lead.enrollmentStatus === 'ENROLLED' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 'text-slate-200'}`}
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
                                                                                                    disabled={isDisabled}
                                                                                                    onClick={(e) => handleOpenReminderModal(lead, e)}
                                                                                                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 p-1.5 rounded-lg flex justify-center transition-colors disabled:opacity-50"
                                                                                                    title="Reminder"
                                                                                                >
                                                                                                    <FaBell size={12} />
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


            {/* Student Details Hover Popover */}
            {studentDetailsLead && createPortal(
                <div className="fixed top-24 right-6 z-[99999] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4">
                    <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-sky-500/40 w-[380px] rounded-2xl overflow-hidden flex flex-col transform transition-all shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-slate-800/30">
                            <h2 className="text-slate-200 font-bold flex items-center gap-2">
                                <FaUser className="text-sky-400" /> Student Details
                            </h2>
                            <button onClick={() => setStudentDetailsLead(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-rose-500/20 transition-colors pointer-events-auto">
                                <FaTimes size={16} />
                            </button>
                        </div>
                        <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar pointer-events-auto">
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

                                const getPaymentOptionStr = (payment) => {
                                    if (!payment) return "N/A";
                                    let typeStr = payment.payment_type === 1 || payment.paymentType === 1 ? "Monthly" : (payment.payment_type === 2 || payment.paymentType === 2) ? "Installment" : "Full Payment";
                                    return `${typeStr} via ${payment.method || 'Slip'}`;
                                };

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
                                                                    <span className="text-emerald-400 font-bold">{getPaymentOptionStr(enr)}</span>
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
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-rose-900/30 flex items-center justify-center mb-3 border border-rose-500/30">
                                        <FaTimes className="text-rose-400 text-xl" />
                                    </div>
                                    <h3 className="text-slate-200 font-bold mb-1">Not Registered</h3>
                                    <p className="text-slate-500 text-xs">This student hasn't registered for any classes yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

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

            {/* Guidance Modal */}
            {isGuidanceModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-indigo-500/30 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-indigo-900/50 to-transparent">
                            <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
                                <BookOpen className="text-indigo-400" />
                                New Inquiries Staff Guidance
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                                    <button
                                        onClick={() => setGuidanceLang('SI')}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${guidanceLang === 'SI' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        සිංහල
                                    </button>
                                    <button
                                        onClick={() => setGuidanceLang('EN')}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${guidanceLang === 'EN' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        English
                                    </button>
                                </div>
                                <button onClick={() => setIsGuidanceModalOpen(false)} className="text-slate-400 hover:text-white p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                    <FaTimes size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 space-y-6 text-sm text-slate-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                            {guidanceLang === 'EN' ? (
                                <>
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl mb-6">
                                        <h3 className="text-emerald-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2">📌 NEW INQUIRIES WORKFLOW</h3>
                                        <ul className="space-y-4">
                                            <li>
                                                <strong className="text-rose-400 block mb-1">▶ ROUND 01 (24 Hours)</strong>
                                                <span className="text-slate-300">All new leads arrive here. You have <strong className="text-white">24 hours</strong> to call, set the outcome, add a remark, and click 'Push' to send them to Round 02.</span>
                                            </li>
                                            <li>
                                                <strong className="text-blue-400 block mb-1">▶ ROUND 02 (7 Days Total)</strong>
                                                <span className="text-slate-300">
                                                    Leads arriving from Round 01 will be <strong className="text-indigo-300">FROZEN for 6 Days</strong> (no actions allowed). 
                                                    On the <strong className="text-white">7th Day</strong>, the lead unfreezes and a <strong className="text-white">24-hour countdown</strong> begins. 
                                                    You must call, update the status, and push the lead before this time expires.
                                                </span>
                                            </li>
                                            <li>
                                                <strong className="text-amber-400 block mb-1">▶ NON-ENROLLED (Round 03)</strong>
                                                <span className="text-slate-300">If a lead is covered in Round 02 and they haven't enrolled yet, pushing them moves them here. They will remain parked in this tab.</span>
                                            </li>
                                            <li>
                                                <strong className="text-emerald-400 block mb-1">▶ PAID (Enrolled)</strong>
                                                <span className="text-slate-300">Kids automatically move to this tab ONLY when they upload their slips via Manage Payments and the admin approves them. Enrollment status is <strong className="text-white">READ-ONLY</strong> for coordinators.</span>
                                            </li>
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl mb-6">
                                        <h3 className="text-emerald-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2">📌 NEW INQUIRIES WORKFLOW</h3>
                                        <ul className="space-y-4">
                                            <li>
                                                <strong className="text-rose-400 block mb-1">▶ ROUND 01 (පැය 24 යි)</strong>
                                                <span className="text-slate-300">අලුතින් එන හැම Lead එකක්ම එන්නේ මෙතනට. ඔයාට <strong className="text-white">පැය 24ක්</strong> තියෙනවා කතා කරලා, Outcome එක දාලා 'Push' කරලා Round 02 එකට යවන්න.</span>
                                            </li>
                                            <li>
                                                <strong className="text-blue-400 block mb-1">▶ ROUND 02 (සම්පූර්ණ දවස් 7 යි)</strong>
                                                <span className="text-slate-300">
                                                    Round 1 එකෙන් එන Leads පළමු <strong className="text-indigo-300">දවස් 6 පුරාවටම FROZEN</strong> (Lock වෙලා) තියෙන්නේ. 
                                                    <strong className="text-white">7 වෙනි දවසේ</strong> ඒක Unfreeze වෙලා <strong className="text-white">පැය 24ක countdown එකක්</strong> පටන් ගන්නවා. ඔයා ඒ කාලය ඇතුළත කතා කරලා Push කරන්න ඕනෙ.
                                                </span>
                                            </li>
                                            <li>
                                                <strong className="text-amber-400 block mb-1">▶ NON-ENROLLED (Round 03)</strong>
                                                <span className="text-slate-300">Round 02 එකේදී කතා කරලා ඉවර වෙද්දිත් ළමයා පන්ති වලට ලියාපදිංචි වෙලා නැත්නම්, Push කරපු ගමන් Lead එක මේ Tab එකට ඇවිත් මෙතනම තියෙනවා.</span>
                                            </li>
                                            <li>
                                                <strong className="text-emerald-400 block mb-1">▶ PAID (Enrolled)</strong>
                                                <span className="text-slate-300">ළමයි මේ Tab එකට එන්නේ එයාලා Manage Payments හරහා slip එක දාලා Payment එක Approve වුණාම විතරයි! Coordinator ට Enrollment Status එක වෙනස් කරන්න බෑ (එය <strong className="text-white">READ-ONLY</strong>).</span>
                                            </li>
                                        </ul>
                                    </div>
                                </>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    </>
    );
}
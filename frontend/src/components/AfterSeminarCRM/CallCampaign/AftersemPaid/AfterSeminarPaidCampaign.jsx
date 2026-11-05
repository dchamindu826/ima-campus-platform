import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../../api/axios';
import { FaSearch, FaCommentDots, FaArrowRight, FaTimes, FaBell, FaSave, FaTrash, FaCheckCircle, FaLayerGroup, FaDownload } from 'react-icons/fa';
import { Target, PhoneCall, Check, Loader, BookOpen, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AfterSeminarPaidCampaign({ filters, setChatModalLead, externalSearch, onLeadsLoaded }) {
    const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;

    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState({});
    const [reasonDrafts, setReasonDrafts] = useState({});
    
    const [activeMainTab, setActiveMainTab] = useState('MONTHLY'); // FULL, MONTHLY, INSTALLMENT, UPGRADE, NON_ENROLLED, DROPPED
    const [activeAttemptFilter, setActiveAttemptFilter] = useState('ALL'); // 'ALL', 1, 2
    const [activePhase, setActivePhase] = useState('ALL'); // 'ALL', 1, 2
    const [searchQuery, setSearchQuery] = useState(externalSearch || '');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING

    const [monthlyGroups, setMonthlyGroups] = useState([]);
    const [coordinationMonths, setCoordinationMonths] = useState([]);
    const [selectedGroupName, setSelectedGroupName] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    
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

    // New state for redesign
    const [draftAttemptsData, setDraftAttemptsData] = useState({});
    const [activeAttemptTab, setActiveAttemptTab] = useState({});

    const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLead, setHistoryLead] = useState(null);

    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        if (filters?.selectedBusiness && filters?.selectedBatch) {
            setSelectedGroupName(null);
            fetchPaidCampaignData();
        } else {
            setLeads([]);
            setMonthlyGroups([]);
            setSelectedGroupName(null);
            if (onLeadsLoaded) onLeadsLoaded(0);
            setLoading(false);
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    const fetchPaidCampaignData = async (targetMonth = null) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/retention/campaign-data', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness, batchId: filters.selectedBatch, targetMonthName: targetMonth || selectedGroupName }
            });
            
            const myLeads = (res.data.leads || []).filter(l => l.assignedTo != null && currentUserId != null && Number(l.assignedTo) === Number(currentUserId));
            setLeads(myLeads);
            if (onLeadsLoaded) onLeadsLoaded(myLeads.length);

            const groups = res.data.monthlyGroups || [];
            const cMonths = res.data.coordinationMonths || [];
            setMonthlyGroups(groups);

            if (groups.length > 0) {
                setSelectedGroupName(prev => {
                    const exists = groups.some(g => g.name === prev);
                    if (exists) return prev;
                    return res.data.defaultActiveGroupName || groups[groups.length - 1].name;
                });
            } else {
                setSelectedGroupName(null);
            }

            const loadedDrafts = {};
            myLeads.forEach(l => {
                const savedDraft = localStorage.getItem(`draft_paid_remark_${l.id}`);
                if (savedDraft) loadedDrafts[l.id] = savedDraft;
            });
            setDrafts(loadedDrafts);
        } catch (error) {
            toast.error("Failed to load campaign data");
        }
        setLoading(false);
    };

const parseAttempts = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return typeof p === 'object' && p !== null ? p : {};
        } catch (e) {
            return {};
        }
    }
    return {};
};

    const handleUpdateLocalLead = (leadId, key, value) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [key]: value } : l));
    };

    const handleAttemptDataChange = (leadId, monthName, attemptNum, field, value) => {
        setDraftAttemptsData(prev => {
            const leadObj = leads.find(l => l.id === leadId);
            const leadAttempts = parseAttempts(leadObj?.attemptsData);
            const prevLeadDrafts = prev[leadId] || {};
            const savedMonthAttempts = leadAttempts[monthName] || 
                leadAttempts[monthName?.trim()] || 
                Object.entries(leadAttempts).find(([k]) => k.trim().toLowerCase() === monthName?.trim().toLowerCase())?.[1] || 
                {};
            const draftMonthAttempts = prevLeadDrafts[monthName] || {};
            const currentAttemptData = draftMonthAttempts[attemptNum] || savedMonthAttempts[attemptNum] || { status: 'pending', method: 'direct', feedback: '' };

            return {
                ...prev,
                [leadId]: {
                    ...prevLeadDrafts,
                    [monthName]: {
                        ...draftMonthAttempts,
                        [attemptNum]: {
                            ...currentAttemptData,
                            [field]: value
                        }
                    }
                }
            };
        });
    };

    const handleDraftRemark = (leadId, val) => {
        setDrafts(prev => ({ ...prev, [leadId]: val }));
        localStorage.setItem(`draft_paid_remark_${leadId}`, val);
    };

    const handleDraftReason = (leadId, val) => {
        setReasonDrafts(prev => ({ ...prev, [leadId]: val }));
    };

    const handleSaveCallData = async (leadId) => {
        const leadObj = leads.find(l => l.id === leadId);
        if (!leadObj) return;

        const currentActiveMonth = (selectedGroupName && selectedGroupName !== 'ALL') ? selectedGroupName : (monthlyGroups[0]?.name || 'UNKNOWN');
        const currentActiveAttempt = activeAttemptTab[leadId] || 1;
        
        // Deep merge existing lead attempts with any draft attempts
        const existingAttempts = parseAttempts(leadObj.attemptsData);
        const draftAttempts = draftAttemptsData[leadId] || {};
        
        const allAttemptsData = { ...existingAttempts };
        for (const mKey in draftAttempts) {
            allAttemptsData[mKey] = { ...(allAttemptsData[mKey] || {}) };
            for (const aKey in draftAttempts[mKey]) {
                allAttemptsData[mKey][aKey] = {
                    ...(allAttemptsData[mKey][aKey] || {}),
                    ...(draftAttempts[mKey][aKey] || {})
                };
            }
        }
        if (!allAttemptsData[currentActiveMonth]) {
            allAttemptsData[currentActiveMonth] = {};
        }

        const monthAttempts = allAttemptsData[currentActiveMonth] || {};
        const activeAttemptData = monthAttempts[currentActiveAttempt] || { status: 'pending', method: 'direct', feedback: '' };

        const finalStatus = activeAttemptData.status || 'pending';
        const finalMethod = activeAttemptData.method || 'direct';
        const finalAttempt = currentActiveAttempt;
        const remarkVal = activeAttemptData.feedback || '';
        
        let reasonVal = reasonDrafts[leadId] !== undefined ? reasonDrafts[leadId] : (leadObj.nonEnrolledReason || '');
        if ((!reasonVal || reasonVal.trim() === '') && remarkVal && remarkVal.trim() !== '') {
            reasonVal = remarkVal.trim();
        }

        const loadToast = toast.loading("Saving progress...");

        try {
            const token = localStorage.getItem('token');
            const payload = {
                leadId: leadId,
                status: finalStatus,
                feedback: remarkVal,
                nonEnrolledReason: reasonVal,
                coordinationRound: leadObj.coordinationRound || 1,
                paymentIntention: leadObj.paymentIntention || 'NOT_DECIDED',
                enrollmentStatus: leadObj.enrollmentStatus || 'NON_ENROLLED',
                callAttempt: finalAttempt,
                method: finalMethod,
                campaignContext: 'PAID',
                isNonEnrolledTab: activeMainTab === 'NON_ENROLLED',
                attemptsData: allAttemptsData
            };

            const response = await axios.post('/after-seminar-crm/leads/update-call', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Progress saved successfully!", { id: loadToast });
            localStorage.removeItem(`draft_paid_remark_${leadId}`);
            
            // Clean up drafts for this lead
            setDrafts(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            setReasonDrafts(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            setDraftAttemptsData(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            setDraftStatus(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            setDraftAttempt(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            setDraftMethod(prev => { const n = { ...prev }; delete n[leadId]; return n; });
            
            const updated = response.data?.lead || {};
            setLeads(prev => prev.map(l => {
                if (l.id === leadId) {
                    return {
                        ...l,
                        ...updated,
                        enrollmentStatus: activeMainTab === 'NON_ENROLLED' ? 'NON_ENROLLED' : (updated.enrollmentStatus || l.enrollmentStatus),
                        effectiveEnrollmentStatus: activeMainTab === 'NON_ENROLLED' ? 'NON_ENROLLED' : (l.effectiveEnrollmentStatus || updated.enrollmentStatus),
                        callStatus: finalStatus,
                        paidCallStatus: finalStatus,
                        callAttempt: finalAttempt,
                        paidCallAttempt: finalAttempt,
                        callMethod: finalMethod,
                        paidCallMethod: finalMethod,
                        feedback: remarkVal,
                        paidFeedback: remarkVal,
                        nonEnrolledReason: reasonVal,
                        attemptsData: allAttemptsData,
                        phase: updated.paidPhase !== undefined ? updated.paidPhase : (l.paidPhase || l.phase || 1),
                        coordinationRound: updated.paidRound !== undefined ? updated.paidRound : (l.paidRound || l.coordinationRound || 1)
                    };
                }
                return l;
            }));
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to save workflow state", { id: loadToast });
        }
    };

    const handlePushToNextRound = async (leadId, currentRound, callStatus, phase) => {
        if (callStatus === 'pending' || !callStatus) return toast.error("Change Status before pushing!");
        if (callStatus === 'reject') return toast.error("Rejected leads cannot be pushed to the next round.");
        if (!window.confirm(`Move this lead to the next round? Remarks will be kept, but status will reset.`)) return;

        const loadToast = toast.loading("Moving lead to next round...");
        try {
            await axios.post('/after-seminar-crm/leads/bulk-action', { action: 'CHANGE_ROUND', leadIds: [leadId], targetRound: currentRound + 1 }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            toast.success("Lead pushed successfully!", { id: loadToast });
            setTimeout(() => window.location.reload(), 800);
        } catch (e) { toast.error("Failed to push lead.", { id: loadToast }); }
    };

    // Reminder Logic
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

    const exportToCSV = () => {
        if (!mappedLeads || mappedLeads.length === 0) return toast.error("No data to export!");

        // Dynamically get all month names from the groups
        const monthCols = monthlyGroups ? monthlyGroups.map(g => g.name) : [];

        const headers = [
            "Student Name", "Phone", "Phase", "Payment Plan", "Tab Status", "Upgraded?", 
            "Call Attempt", "Call Outcome", "Current Remarks", "Past Remarks History", 
            "Non-Enrolled Reason", "Enrolled Subjects", "Unpaid/Non-Enrolled Subjects",
            ...monthCols
        ];

        let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h}"`).join(",") + "\n";

        mappedLeads.forEach(lead => {
            const name = `"${(lead.name || 'Unknown').replace(/"/g, '""')}"`;
            const phone = lead.phone?.split('_')[0] || '';
            const phase = Number(lead.phase) || 1;
            const paymentPlan = lead.paymentIntention || 'NOT_DECIDED';
            const tabStatus = lead.effectiveEnrollmentStatus || 'UNKNOWN';
            const upgraded = lead.isUpgraded ? 'YES' : 'NO';
            const attempt = lead.callAttempt || 1;
            const outcome = lead.effectiveCallStatus || 'pending';
            const remarks = `"${(lead.feedback || '').replace(/"/g, '""')}"`;
            
            const pastRemarks = lead.roundProgress && lead.roundProgress.length > 0 
                ? `"${lead.roundProgress.map(rp => rp.feedback).filter(Boolean).join(' | ').replace(/"/g, '""')}"` 
                : '""';
                
            const nonEnrolledReason = `"${(lead.nonEnrolledReason || '').replace(/"/g, '""')}"`;
            
            const enrolledSubjects = lead.assignedSubjects && lead.assignedSubjects.length > 0 
                ? lead.assignedSubjects.filter(sub => lead.enrolledSubjects && lead.enrolledSubjects.includes(sub))
                : (lead.enrolledSubjects || []);
                
            const unpaidSubjects = lead.assignedSubjects && lead.assignedSubjects.length > 0
                ? lead.assignedSubjects.filter(sub => !(lead.enrolledSubjects && lead.enrolledSubjects.includes(sub)))
                : [];
                
            const enrolledStr = `"${(enrolledSubjects.length > 0 ? enrolledSubjects.join(', ') : (lead.batch?.name || 'General')).replace(/"/g, '""')}"`;
            const unpaidStr = `"${(unpaidSubjects.length > 0 ? unpaidSubjects.join(', ') : 'None').replace(/"/g, '""')}"`;

            let rowData = [name, phone, phase, paymentPlan, tabStatus, upgraded, attempt, outcome, remarks, pastRemarks, nonEnrolledReason, enrolledStr, unpaidStr];

            // Build month columns dynamically from paymentHistory
            monthCols.forEach(month => {
                let monthStatuses = [];
                if (lead.paymentHistory) {
                    Object.keys(lead.paymentHistory).forEach(sub => {
                        const status = lead.paymentHistory[sub][month];
                        if (status) {
                            monthStatuses.push(`${sub}: ${status}`);
                        }
                    });
                }
                const monthStr = monthStatuses.length > 0 ? monthStatuses.join(' / ') : 'NO DATA';
                rowData.push(`"${monthStr}"`);
            });

            csvContent += rowData.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Paid_Campaign_Comprehensive_Report_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Derived Logic
    const isLeadPending = (l) => {
        return !l.effectiveCallStatus || l.effectiveCallStatus === 'pending' || l.effectiveCallStatus === '';
    };

    const mappedLeads = useMemo(() => {
        const uniqueMap = new Map();
        (leads || []).forEach(l => {
            const cleanPhone = (l.phone || '').split('_')[0].replace(/[^0-9]/g, '');
            const key = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : (cleanPhone || l.id);
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, l);
            }
        });
        const dedupedLeads = Array.from(uniqueMap.values());

        const activeMonthName = (selectedGroupName && selectedGroupName !== 'ALL') 
            ? selectedGroupName 
            : (monthlyGroups[0]?.name || null);

        return dedupedLeads.map(l => {
            let effectiveEnrollmentStatus = l.enrollmentStatus;
            let effectivePaymentIntention = l.paymentIntention;
            
            let activeGroupIndex = monthlyGroups.findIndex(g => g.name === activeMonthName);
            let unpaidCount = 0;

            if (activeMonthName && l.paymentIntention !== 'FULL') {
                if (activeGroupIndex >= 0) {
                    for (let i = 0; i <= activeGroupIndex; i++) {
                        const pm = monthlyGroups[i];
                        const hasPaid = l.enrolledGroupIds && pm.ids.some(id => l.enrolledGroupIds.includes(id));
                        if (!hasPaid) unpaidCount++;
                    }
                }
            }

            // Use SAVED attemptsData and paidCallStatus for list filtering & tab grouping
            // (draft status changes inside the card must NOT cause the card to vanish before saving!)
            let effectiveCallStatus = 'pending';
            if (activeMonthName) {
                const leadAttempts = parseAttempts(l.attemptsData);
                const savedMonthAttempts = leadAttempts[activeMonthName] || 
                    leadAttempts[activeMonthName?.trim()] || 
                    Object.entries(leadAttempts).find(([k]) => k.trim().toLowerCase() === activeMonthName?.trim().toLowerCase())?.[1] || 
                    {};
                let highestStatus = 'pending';
                for (let i = 4; i >= 1; i--) {
                    if (savedMonthAttempts[i] && savedMonthAttempts[i].status && savedMonthAttempts[i].status !== 'pending') {
                        highestStatus = savedMonthAttempts[i].status;
                        break;
                    }
                }
                // When an active month is selected, effectiveCallStatus must strictly reflect
                // the status of calls made for this specific month.
                // Do NOT fall back to l.paidCallStatus (which holds older months' results like September),
                // as that falsely marks new month pending leads as answered/no-answer with 0 pending.
                effectiveCallStatus = highestStatus;
            } else {
                effectiveCallStatus = l.paidCallStatus || l.callStatus || 'pending';
            }

            return { ...l, effectiveEnrollmentStatus, effectivePaymentIntention, unpaidCount, effectiveCallStatus };
        });
    }, [leads, selectedGroupName, monthlyGroups]);

    const tabCounts = useMemo(() => {
        let full = 0;
        let monthly = 0;
        let installment = 0;
        let nonEnrolled = 0;
        let dropped = 0;

        mappedLeads.forEach(l => {
            if (l.isDroppedOverall) {
                dropped++;
            }
            if (l.effectiveEnrollmentStatus === 'NON_ENROLLED') {
                nonEnrolled++;
            } else {
                if (l.effectivePaymentIntention === 'FULL' || l.isUpgraded === true) full++;
                else if (l.effectivePaymentIntention === 'INSTALLMENT') installment++;
                else if (l.effectivePaymentIntention === 'MONTHLY') monthly++;
            }
        });

        return { full, monthly, installment, nonEnrolled, dropped };
    }, [mappedLeads]);

    // Apply Filters for the current view
    const visibleLeads = useMemo(() => {
        let filtered = mappedLeads.filter(l => {
            let matchTab = false;
            if (activeMainTab === 'DROPPED') {
                matchTab = l.isDroppedOverall === true;
            } else if (activeMainTab === 'NON_ENROLLED') {
                matchTab = l.effectiveEnrollmentStatus === 'NON_ENROLLED';
            } else {
                if (l.effectiveEnrollmentStatus === 'NON_ENROLLED') {
                    matchTab = false;
                } else if (activeMainTab === 'INSTALLMENT' || activeMainTab === 'INSTALLMENTS') {
                    matchTab = l.effectivePaymentIntention === 'INSTALLMENT';
                } else if (activeMainTab === 'FULL') {
                    matchTab = l.effectivePaymentIntention === 'FULL' || l.isUpgraded === true;
                } else {
                    matchTab = l.effectivePaymentIntention === activeMainTab;
                }
            }

            if (!matchTab) return false;

            const matchSearch = searchQuery ? (l.phone && l.phone.includes(searchQuery)) || (l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())) : true;
            
            return matchSearch;
        });

        if (statusFilter === 'PENDING') {
            filtered = filtered.filter(isLeadPending);
        } else if (statusFilter === 'ANSWERED') {
            filtered = filtered.filter(l => l.effectiveCallStatus === 'answered');
        } else if (statusFilter === 'REJECT') {
            filtered = filtered.filter(l => l.effectiveCallStatus === 'reject');
        } else if (statusFilter === 'NO_ANSWER') {
            filtered = filtered.filter(l => ['no_answer', 'busy', 'switch_off', 'not_connected'].includes(l.effectiveCallStatus));
        } else if (statusFilter === 'DROPPED_2MOS') {
            filtered = filtered.filter(l => l.isDroppedTwoMonthsPlus === true);
        }

        filtered.sort((a, b) => {
            return a.id - b.id;
        });

        return filtered;
    }, [mappedLeads, activeMainTab, searchQuery, statusFilter, monthlyGroups, selectedGroupName]);

    const leadsInActiveTab = useMemo(() => {
        return mappedLeads.filter(l => {
            if (activeMainTab === 'DROPPED') return l.isDroppedOverall === true;
            if (activeMainTab === 'NON_ENROLLED') return l.effectiveEnrollmentStatus === 'NON_ENROLLED';
            if (l.effectiveEnrollmentStatus === 'NON_ENROLLED') return false;
            if (activeMainTab === 'INSTALLMENT' || activeMainTab === 'INSTALLMENTS') return l.effectivePaymentIntention === 'INSTALLMENT';
            if (activeMainTab === 'FULL') return l.effectivePaymentIntention === 'FULL' || l.isUpgraded === true;
            return l.effectivePaymentIntention === activeMainTab;
        });
    }, [mappedLeads, activeMainTab]);

    const stats = useMemo(() => {
        const phaseLeads = leadsInActiveTab;
        let totalAssigned = phaseLeads.length;
        let pending = phaseLeads.filter(isLeadPending).length;
        
        let answered = phaseLeads.filter(l => l.effectiveCallStatus === 'answered').length;
        let rejected = phaseLeads.filter(l => l.effectiveCallStatus === 'reject').length;
        let noAnswer = phaseLeads.filter(l => l.effectiveCallStatus === 'no_answer' || l.effectiveCallStatus === 'busy' || l.effectiveCallStatus === 'switch_off' || l.effectiveCallStatus === 'not_connected').length;
        
        let covered = totalAssigned - pending;
        let responseRate = totalAssigned > 0 ? ((covered / totalAssigned) * 100).toFixed(1) : 0;

        return { totalAssigned, covered, pending, responseRate, answered, rejected, noAnswer };
    }, [leadsInActiveTab, activePhase]);

    const totalPages = Math.ceil(visibleLeads.length / ITEMS_PER_PAGE);
    const paginatedLeads = visibleLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    if (!filters.selectedBatch) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-500 bg-[#111827] rounded-[2rem] border border-slate-800 mt-4">
                <h3 className="text-xl font-bold mb-1 text-slate-400">Select a Batch</h3>
                <p className="text-sm">Please select a batch to load campaign data.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-y-auto custom-scrollbar font-sans text-slate-100">
            <div className="fade-in">

                {/* Header matching Open Seminar detail view */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-4 mt-2">
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 flex items-center gap-3">
                        <Target className="text-emerald-400" />
                        ENROLLED STUDENTS CAMPAIGN
                    </h1>
                    
                    {/* Active Group Period Selector */}
                    {monthlyGroups && monthlyGroups.length > 0 && (
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md shadow-sm w-full md:w-auto">
                            <FaLayerGroup className="text-amber-400" />
                            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Group Period:</span>
                            <select 
                                value={selectedGroupName || monthlyGroups[0]?.name || ''} 
                                onChange={(e) => { setSelectedGroupName(e.target.value); setCurrentPage(1); fetchPaidCampaignData(e.target.value); }}
                                className="bg-transparent border-none text-amber-400 text-sm font-black outline-none cursor-pointer w-full md:w-auto appearance-none pr-4"
                            >
                                {monthlyGroups.map((group, idx) => (
                                    <option key={idx} value={group.name} className="bg-slate-900 text-slate-200">
                                        📅 {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Top Plan Buttons */}
                <div className="flex gap-2 bg-[#0F172A]/80 p-2 rounded-2xl flex-wrap shadow-inner mb-6 w-max border border-white/5">
                    <button
                        onClick={() => { setActiveMainTab('FULL'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-xs md:text-sm flex items-center gap-2 ${activeMainTab === 'FULL' ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>FULL PAYMENT</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeMainTab === 'FULL' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tabCounts.full}</span>
                    </button>
                    <button
                        onClick={() => { setActiveMainTab('MONTHLY'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-xs md:text-sm flex items-center gap-2 ${activeMainTab === 'MONTHLY' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>MONTHLY PLAN</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeMainTab === 'MONTHLY' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tabCounts.monthly}</span>
                    </button>
                    <button
                        onClick={() => { setActiveMainTab('INSTALLMENT'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-xs md:text-sm flex items-center gap-2 ${activeMainTab === 'INSTALLMENT' ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>INSTALLMENTS</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeMainTab === 'INSTALLMENT' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tabCounts.installment}</span>
                    </button>
                    <button
                        onClick={() => { setActiveMainTab('NON_ENROLLED'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-xs md:text-sm flex items-center gap-2 ${activeMainTab === 'NON_ENROLLED' ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>NON ENROLLED</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeMainTab === 'NON_ENROLLED' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tabCounts.nonEnrolled}</span>
                    </button>
                    <button
                        onClick={() => { setActiveMainTab('DROPPED'); setActivePhase('ALL'); setCurrentPage(1); setStatusFilter('ALL'); }}
                        className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider transition-all text-xs md:text-sm flex items-center gap-2 ${activeMainTab === 'DROPPED' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>DROPPED</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeMainTab === 'DROPPED' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>{tabCounts.dropped}</span>
                    </button>
                </div>


                {/* Stats & Filters Box */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-6 backdrop-blur-sm shadow-lg">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

                        {/* Stats Section */}
                        <div className="flex gap-4 items-center bg-[#0F172A]/50 p-4 px-6 rounded-3xl border border-white/5 shadow-inner flex-wrap w-full xl:w-auto overflow-x-auto custom-scrollbar">
                            <div className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mr-2 hidden md:block">Stats</div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Assigned</span><span className="text-xl font-black text-white">{stats.totalAssigned}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-1">Pending</span><span className="text-xl font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">{stats.pending}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Answered</span><span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">{stats.answered}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mb-1">Reject</span><span className="text-xl font-black text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">{stats.rejected}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider mb-1">No Answer</span><span className="text-xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{stats.noAnswer}</span></div>
                            <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
                            <div className="flex flex-col items-center"><span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider mb-1">Covered</span><span className="text-xl font-black text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">{stats.responseRate}%</span></div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-col gap-3 min-w-[300px] w-full xl:w-auto">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Filters & Export:</span>
                                <button
                                    onClick={exportToCSV}
                                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-2"
                                >
                                    <FaDownload size={12} /> EXPORT CSV
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'PENDING' ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-[#0F172A] border border-white/10 text-amber-400 hover:bg-white/5'}`}
                                >
                                    ⏳ PENDING
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'ANSWERED' ? 'ALL' : 'ANSWERED'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'ANSWERED' ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[#0F172A] border border-white/10 text-emerald-400 hover:bg-white/5'}`}
                                >
                                    ✅ ANSWERED
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'REJECT' ? 'ALL' : 'REJECT'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'REJECT' ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-[#0F172A] border border-white/10 text-rose-400 hover:bg-white/5'}`}
                                >
                                    ❌ REJECT
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'NO_ANSWER' ? 'ALL' : 'NO_ANSWER'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'NO_ANSWER' ? 'bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-[#0F172A] border border-white/10 text-orange-400 hover:bg-white/5'}`}
                                >
                                    📵 NO ANSWER
                                </button>
                                <button
                                    onClick={() => { setStatusFilter(statusFilter === 'DROPPED_2MOS' ? 'ALL' : 'DROPPED_2MOS'); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === 'DROPPED_2MOS' ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-[#0F172A] border border-white/10 text-purple-400 hover:bg-white/5'}`}
                                >
                                    ⚠️ DROPPED (2+ MOS)
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

                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-3.5 text-slate-400 text-sm" />
                                <input type="text" placeholder="Search leads by phone or name..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full bg-[#0F172A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500 shadow-inner" />
                            </div>
                        </div>

                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Main Leads Grid */}
                    <div className="flex-1 w-full">
                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader2 className="animate-spin text-indigo-500 w-12 h-12"/>
                            </div>
                        ) : paginatedLeads.length === 0 ? (
                            <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl shadow-lg">
                                <PhoneCall className="text-slate-600 mx-auto mb-4" size={48} />
                                <h3 className="text-xl font-bold text-slate-400">No Leads Found</h3>
                                <p className="text-slate-500 mt-2">There are no leads matching your current filters.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
                                {paginatedLeads.map((lead, index) => {
                                    const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                                    const currentReason = reasonDrafts[lead.id] !== undefined ? reasonDrafts[lead.id] : (lead.nonEnrolledReason || '');
                                    const isReasonDraft = reasonDrafts[lead.id] !== undefined && reasonDrafts[lead.id] !== lead.nonEnrolledReason;

                                    const currentActiveMonth = (selectedGroupName && selectedGroupName !== 'ALL') ? selectedGroupName : (monthlyGroups[0]?.name || 'UNKNOWN');
                                    const currentActiveAttempt = activeAttemptTab[lead.id] || 1;
                                    const leadAttempts = parseAttempts(lead.attemptsData);
                                    const savedMonthAttempts = leadAttempts[currentActiveMonth] || 
                                        leadAttempts[currentActiveMonth?.trim()] || 
                                        Object.entries(leadAttempts).find(([k]) => k.trim().toLowerCase() === currentActiveMonth?.trim().toLowerCase())?.[1] || 
                                        {};
                                    const draftMonthAttempts = draftAttemptsData[lead.id]?.[currentActiveMonth] || {};
                                    const monthAttempts = { ...savedMonthAttempts };
                                    for (const aKey in draftMonthAttempts) {
                                        monthAttempts[aKey] = { ...(savedMonthAttempts[aKey] || {}), ...(draftMonthAttempts[aKey] || {}) };
                                    }
                                    const activeAttemptData = monthAttempts[currentActiveAttempt] || { status: 'pending', method: 'direct', feedback: '' };

                                    const overallCallOutcome = lead.effectiveCallStatus || 'pending';

                                    const mdPositionClass = (index % 2 === 0) ? "md:left-0 md:right-auto md:translate-x-0" : "md:right-0 md:left-auto md:translate-x-0";
                                    const xlPositionClass = (index % 3 === 0) ? "xl:left-0 xl:right-auto xl:translate-x-0" : (index % 3 === 1) ? "xl:left-1/2 xl:right-auto xl:-translate-x-1/2" : "xl:right-0 xl:left-auto xl:translate-x-0";
                                    const tooltipPositionClass = `left-0 ${mdPositionClass} ${xlPositionClass}`;

                                    return (
                                        <div key={lead.id} className="bg-[#1e1b4b]/80 backdrop-blur-md rounded-2xl border border-indigo-500/20 shadow-xl hover:border-indigo-400/50 transition-all group flex flex-col relative overflow-hidden">
                                            {/* Header with Phone and Name */}
                                            <div className="p-4 border-b border-indigo-500/20 flex justify-between items-start">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black shadow-inner shrink-0">
                                                        {realIndex}
                                                    </div>
                                                    <div className="overflow-hidden pt-0.5">
                                                        <h3 className="text-xl font-black text-white leading-none tracking-wide">{lead.phone?.split('_')[0]}</h3>
                                                        <p className="text-slate-400 text-[11px] font-bold uppercase mt-1 truncate max-w-[180px]">{lead.name || 'Unknown'}</p>
                                                        
                                                        {/* Batch & Enrollment Info */}
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                            {lead.batch?.name && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-300 border-indigo-500/20 truncate max-w-[100px]">
                                                                    {lead.batch.name}
                                                                </span>
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${lead.enrollmentStatus === 'ENROLLED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : lead.isProcessing ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                                                                {lead.enrollmentStatus === 'ENROLLED' ? `✅ ${lead.paymentIntention}` : lead.isProcessing ? '⏳ PRO' : '❌ NON ENR'}
                                                            </span>
                                                            {lead.effectiveCallStatus && lead.effectiveCallStatus !== 'pending' && (
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${lead.effectiveCallStatus === 'answered' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : lead.effectiveCallStatus === 'reject' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'}`}>
                                                                    📞 {lead.effectiveCallStatus.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {lead.isDroppedTwoMonthsPlus && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-300 border-purple-500/40" title={lead.droppedSubjectsDetails?.map(d => `${d.subject} (${d.unpaidMonths} mos unpaid)`).join(', ')}>
                                                                    ⚠️ DROPPED (2+ MOS)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Calendar Icon for History */}
                                                <div className="relative group/history">
                                                    <button 
                                                        onClick={() => { setHistoryLead(lead); setShowHistoryModal(true); }}
                                                        className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/5 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-md shrink-0"
                                                    >
                                                        <BookOpen size={18} className={lead.isProcessing ? "text-amber-400" : ""} />
                                                        {lead.isProcessing && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Attempt Data Section */}
                                            <div className="p-4 flex-1 flex flex-col bg-slate-900/30">
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Method</label>
                                                        <select
                                                            value={activeAttemptData.method || 'direct'}
                                                            onChange={(e) => handleAttemptDataChange(lead.id, currentActiveMonth, currentActiveAttempt, 'method', e.target.value)}
                                                            className="w-full bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-2 py-2 text-xs font-bold text-indigo-200 outline-none appearance-none"
                                                        >
                                                            <option value="direct" className="bg-[#0f172a]">Direct Call</option>
                                                            <option value="whatsapp" className="bg-[#0f172a]">WhatsApp</option>
                                                            <option value="3cx" className="bg-[#0f172a]">3CX</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Outcome</label>
                                                        <select
                                                            value={activeAttemptData.status || 'pending'}
                                                            onChange={(e) => handleAttemptDataChange(lead.id, currentActiveMonth, currentActiveAttempt, 'status', e.target.value)}
                                                            className={`w-full bg-[#312e81]/30 border rounded-xl px-2 py-2 text-xs font-bold outline-none appearance-none transition-colors
                                                                ${(activeAttemptData.status || 'pending') === 'pending' ? 'border-amber-500/30 text-amber-400' :
                                                                    (activeAttemptData.status || 'pending') === 'answered' ? 'border-emerald-500/30 text-emerald-400' :
                                                                        (activeAttemptData.status || 'pending') === 'no_answer' ? 'border-blue-500/30 text-blue-400' :
                                                                            'border-rose-500/30 text-rose-400'}`}
                                                        >
                                                            <option value="pending" className="bg-[#0f172a] text-amber-400">⌛ PENDING</option>
                                                            <option value="answered" className="bg-[#0f172a] text-emerald-400">✅ ANSWERED</option>
                                                            <option value="no_answer" className="bg-[#0f172a] text-blue-400">🔇 NO ANSWER</option>
                                                            <option value="reject" className="bg-[#0f172a] text-rose-400">❌ REJECT</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Remark Field */}
                                                <div className="relative flex-1 flex flex-col mb-4">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Remark ({currentActiveMonth === 'UNKNOWN' ? '' : currentActiveMonth.substring(0,10)} - Attempt {currentActiveAttempt})</label>
                                                    <textarea
                                                        rows="2"
                                                        value={activeAttemptData.feedback || ''}
                                                        onChange={(e) => handleAttemptDataChange(lead.id, currentActiveMonth, currentActiveAttempt, 'feedback', e.target.value)}
                                                        placeholder={`Notes for ${currentActiveMonth} Attempt ${currentActiveAttempt}...`}
                                                        className="w-full flex-1 bg-[#312e81]/30 border border-indigo-500/20 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none placeholder-indigo-300/30 transition-colors custom-scrollbar"
                                                    />
                                                </div>
                                                
                                                {(activeMainTab === 'NON_ENROLLED') && (
                                                    <div className="mb-4 relative flex-1 flex flex-col">
                                                        <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 ml-1">Non-Enrolled Reason</label>
                                                        <textarea
                                                            rows="2"
                                                            value={currentReason}
                                                            onChange={(e) => handleDraftReason(lead.id, e.target.value)}
                                                            placeholder="Why are they not enrolled?"
                                                            className="w-full flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-xs text-rose-300 outline-none focus:border-rose-500 resize-none placeholder-rose-300/30 transition-colors custom-scrollbar"
                                                        />
                                                        {isReasonDraft && <span className="absolute -top-2 right-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-400 shadow-sm">DRAFT</span>}
                                                    </div>
                                                )}

                                            </div>

                                            {/* Footer with Attempts & Actions */}
                                            <div className="p-4 border-t border-indigo-500/20 bg-[#16143c]">
                                                {/* Attempts Circles */}
                                                <div className="flex justify-between items-center mb-4 px-2">
                                                    {[1, 2, 3, 4].map(num => {
                                                        const attemptInfo = monthAttempts[num] || {};
                                                        const isCompleted = attemptInfo.status && attemptInfo.status !== 'pending';
                                                        const isActive = currentActiveAttempt === num;
                                                        return (
                                                            <div key={num} className="flex flex-col items-center">
                                                                <button
                                                                    onClick={() => setActiveAttemptTab(prev => ({ ...prev, [lead.id]: num }))}
                                                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all border-2
                                                                        ${isActive ? 'scale-110 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'hover:scale-105 opacity-80'}
                                                                        ${isCompleted 
                                                                            ? isActive ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                                                                            : isActive ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}
                                                                >
                                                                    {num}{['st','nd','rd','th'][num-1]}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleSaveCallData(lead.id)}
                                                        className="flex-1 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] transform hover:-translate-y-0.5"
                                                    >
                                                        <Check size={16} strokeWidth={3} /> SAVE
                                                    </button>

                                                    <button
                                                        onClick={() => setChatModalLead(lead)}
                                                        className="bg-indigo-600/50 hover:bg-indigo-500 border border-indigo-500/50 text-white w-12 rounded-xl flex items-center justify-center relative transition-all shadow-md transform hover:-translate-y-0.5"
                                                        title="Open Chat"
                                                    >
                                                        <FaCommentDots size={16} />
                                                        {(lead.unreadCount || 0) > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>}
                                                        {(lead.unreadCount || 0) > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border border-[#1e1b4b]"></span>}
                                                    </button>

                                                    <button
                                                        onClick={(e) => handleOpenReminderModal(lead, e)}
                                                        title="Set a Reminder"
                                                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 w-12 rounded-xl flex items-center justify-center transition-all shadow-md transform hover:-translate-y-0.5"
                                                    >
                                                        <FaBell size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-2 mb-10 bg-white/5 border border-white/10 p-3 rounded-2xl w-max mx-auto shadow-sm backdrop-blur-sm">
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

            {/* HISTORY WIDGET RIGHT PANEL */}
            {showHistoryModal && historyLead && createPortal(
                <div className="fixed inset-0 z-[99999] flex justify-end pointer-events-none">
                    {/* Backdrop - Transparent so left side is visible */}
                    <div 
                        className="absolute inset-0 bg-transparent pointer-events-none"
                    ></div>
                    
                    {/* Slide-out Panel */}
                    <div className="relative w-full max-w-[500px] bg-[#111827] border-l border-slate-700 shadow-2xl h-full flex flex-col animate-slide-in-right pointer-events-auto">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#0F172A]">
                            <h3 className="text-white font-black flex items-center gap-2 text-lg uppercase tracking-wider">
                                <BookOpen className="text-indigo-400" size={20}/> Enrollment History
                            </h3>
                            <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
                                <FaTimes size={16}/>
                            </button>
                        </div>
                        
                        {/* Student Details */}
                        <div className="p-5 border-b border-white/5 bg-slate-900/50">
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex justify-center items-center font-black shrink-0 shadow-inner">
                                    <FaLayerGroup size={20}/>
                                </div>
                                <div className="overflow-hidden flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-base font-black text-white tracking-wider truncate">{historyLead.phone}</p>
                                        {historyLead.isProcessing && (
                                            <span className="px-2 py-0.5 text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md shadow-sm animate-pulse">
                                                PROCESSING
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest truncate">{historyLead.name || 'Student'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                        {historyLead.batch?.name && (
                                            <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 border border-white/5 rounded-md">
                                                {historyLead.batch.name}
                                            </span>
                                        )}
                                        {historyLead.firstEnrolledMonthName && (
                                            <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md">
                                                Started: {historyLead.firstEnrolledMonthName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calendar Grid Area */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {(!historyLead.paymentHistory || Object.keys(historyLead.paymentHistory).length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-500 space-y-2">
                                    <BookOpen size={32} className="opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No payment history available</p>
                                </div>
                            ) : (
                                (() => {
                                    const subjects = Object.keys(historyLead.paymentHistory);
                                    const allMonthsRaw = subjects.length > 0 ? Object.keys(historyLead.paymentHistory[subjects[0]]) : [];
                                    
                                    return (
                                        <div className="grid grid-cols-3 gap-3">
                                            {allMonthsRaw.map((month, mIdx) => {
                                                const allMonthsList = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
                                                const matchedMonth = allMonthsList.find(m => month.toUpperCase().includes(m)) || month;
                                                const displayMonth = matchedMonth.substring(0, 3).toUpperCase();
                                                const isActive = mIdx === allMonthsRaw.length - 1; // Highlight active month

                                                return (
                                                    <div key={month} className={`bg-[#0F172A] border ${isActive ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'border-white/5 shadow-xl'} rounded-2xl p-2.5 flex flex-col`}>
                                                        <h4 className={`font-black text-xs uppercase tracking-widest mb-3 flex items-center justify-center gap-1 border-b pb-2 rounded-lg py-1 text-center
                                                            ${isActive ? 'text-indigo-300 border-indigo-500/30 bg-indigo-500/20' : 'text-slate-400 border-white/5 bg-slate-900/50'}
                                                        `}>
                                                            {displayMonth}
                                                        </h4>
                                                        
                                                        <div className="space-y-2 flex-1">
                                                            {subjects.map(subject => {
                                                                const status = historyLead.paymentHistory[subject][month];
                                                                const isPaid = status === 'PAID';
                                                                const isProcessing = status === 'PROCESSING';
                                                                const isNotPaid = status === 'NOT PAID';
                                                                
                                                                // Abbreviate subject for small box
                                                                const subAbbr = subject.split(' ').map(w => w[0]).join('').substring(0,3);
                                                                
                                                                return (
                                                                    <div key={subject} className="flex flex-col gap-0.5">
                                                                        <span className="text-[8px] text-slate-500 font-bold uppercase truncate" title={subject}>{subject}</span>
                                                                        <div className={`flex items-center justify-center gap-1.5 p-1 rounded-md border text-[9px] font-black uppercase tracking-widest transition-all
                                                                            ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
                                                                              isProcessing ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 
                                                                              'bg-rose-500/10 border-rose-500/30 text-rose-400'}
                                                                        `}>
                                                                            {isPaid && <Check size={10} strokeWidth={3}/>}
                                                                            {isProcessing && <Loader2 size={10} className="animate-spin" />}
                                                                            {isNotPaid && <FaTimes size={10}/>}
                                                                            {status === 'NOT PAID' ? 'UNPAID' : status}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

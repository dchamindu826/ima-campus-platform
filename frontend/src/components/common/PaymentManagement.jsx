import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X as CloseIcon, Clock, ShieldCheck, Wallet, CalendarDays, AlertCircle, Loader2, User, Tag, Gift, FileImage, MessageSquare, Trash2, ChevronLeft, ChevronRight, CreditCard, FileText, CheckCircle2, Truck, Unlock, Edit3, Search } from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import PaymentFilters from './PaymentFilters';
import StaffPerformanceModal from './StaffPerformanceModal';
import ExportReportModal from './ExportReportModal';
import AISlipVerification from '../admin/AISlipVerification';
export default function PaymentManagement({ loggedInUser }) {
    const isSystemAdmin = loggedInUser?.role?.toUpperCase() === 'SYSTEM_ADMIN' || loggedInUser?.role?.toUpperCase() === 'DIRECTOR' || loggedInUser?.role?.toUpperCase() === 'SUPER';
    const isFinance = String(loggedInUser?.department || '').trim().toUpperCase() === 'FINANCE' || String(loggedInUser?.role || '').trim().toUpperCase() === 'FINANCE';
    const isAdmin = isSystemAdmin || isFinance;
    const isManager = loggedInUser?.role?.toUpperCase() === 'MANAGER' || loggedInUser?.role?.toUpperCase() === 'ASS MANAGER' || loggedInUser?.role?.toUpperCase() === 'ASS_MANAGER';
    const hasFullAccess = isAdmin || isManager;

    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [groups, setGroups] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const [activeTab, setActiveTab] = useState('Pending');
    const [approvedFilter, setApprovedFilter] = useState('All');

    const [filters, setFilters] = useState({
        search: '', businessId: 'All', batchId: 'All', groupId: 'All', classType: 'All', subjectId: [], dateFrom: '', dateTo: '', method: 'All'
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [studentActionModal, setStudentActionModal] = useState(null);
    const [actioningPaymentId, setActioningPaymentId] = useState(null);
    const [installmentModal, setInstallmentModal] = useState(null);
    const [nextDueDate, setNextDueDate] = useState('');
    const [isTestApprove, setIsTestApprove] = useState(false);
    const [advancedActionModal, setAdvancedActionModal] = useState(null);
    const [customPrices, setCustomPrices] = useState({});
    const [actionRemark, setActionRemark] = useState('');
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportClassTypeOverride, setExportClassTypeOverride] = useState(null);

    const handleOpenExport = (overrides = {}) => {
        if (overrides?.classType) {
            setExportClassTypeOverride(overrides.classType);
        } else {
            setExportClassTypeOverride(null);
        }
        setShowExportModal(true);
    };

    const [approveModal, setApproveModal] = useState(null);
    const [actualAmount, setActualAmount] = useState('');
    const [institutePaymentModal, setInstitutePaymentModal] = useState(null);


    // 🔥 NEW STATES: For Editing Payment Subjects & Amount 🔥
    const [allCourses, setAllCourses] = useState([]);
    const [editModal, setEditModal] = useState(null);
    const [editSubjectsList, setEditSubjectsList] = useState([]);
    const [selectedAddSubjectId, setSelectedAddSubjectId] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    
    // 🔥 NEW STATES: For Upgrade & Upcoming Sub-filters 🔥
    const [upgradeFilter, setUpgradeFilter] = useState('Pending');
    const [upcomingFilter, setUpcomingFilter] = useState('Pending');
    
    const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
    const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
    
    // State to track selected payment ID for actioning
    const [selectedPaymentId, setSelectedPaymentId] = useState(null);
    const [historyTab, setHistoryTab] = useState('All');
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);

    const [sendToDeliveryModal, setSendToDeliveryModal] = useState(null);
    const [deliverySelectedSubjects, setDeliverySelectedSubjects] = useState([]);

    // Ghost Login State
    const [ghostIframe, setGhostIframe] = useState(null);
    const [originalAdminSession, setOriginalAdminSession] = useState(null);

    // AI Verification Mode
    const [verificationMode, setVerificationMode] = useState('manual');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [verificationPassword, setVerificationPassword] = useState('');

    const handleGhostLogin = async (student) => {
        if(!window.confirm(`Ghost Login as ${student.studentName}?`)) return;
        try {
            toast.loading("Initiating Ghost Login...", { id: "ghost" });
            const res = await axios.post('/admin/ghost-login', { studentId: student.studentId });
            const currentToken = localStorage.getItem('token');
            const currentUser = localStorage.getItem('user');
            setOriginalAdminSession({ token: currentToken, user: currentUser });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setGhostIframe('/student/dashboard');
            toast.success("Ghost Login Active!", { id: "ghost" });
        } catch (error) { toast.error("Ghost login failed.", { id: "ghost" }); }
    };

    const closeGhostLogin = () => {
        if (originalAdminSession) {
            localStorage.setItem('token', originalAdminSession.token);
            localStorage.setItem('user', originalAdminSession.user);
        }
        setGhostIframe(null);
        toast.success("Restored Admin Session.");
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const payRes = await axios.get('/admin/payments');
            setPayments(payRes.data || []);
            
            if (hasFullAccess) {
                const coursesRes = await axios.get('/admin/payments/courses');
                setAllCourses(coursesRes.data || []);
            }
            if (isAdmin) {
                const bizRes = await axios.get('/admin/businesses');
                setBusinesses(bizRes.data || []);
            }
        } catch (error) {
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [isAdmin, hasFullAccess]);

    useEffect(() => {
        setSelectedPaymentId(null);
        setHistoryTab('All');
        setExpandedHistoryId(null);
    }, [studentActionModal]);

    useEffect(() => {
        if (filters.businessId !== 'All') {
            axios.get(`/admin/batches/${filters.businessId}`).then(res => setBatches(res.data.batches || res.data || []));
        } else {
            const uniqueBatches = Array.from(new Set(payments.map(p => JSON.stringify({ id: p.batchId || p.batch_id, name: p.batch || p.batchName }))))
                .map(str => JSON.parse(str)).filter(b => b.name && b.name !== 'N/A' && b.id);
            setBatches(uniqueBatches);
        }
    }, [filters.businessId, payments]);

    useEffect(() => {
        let extractedGroups = [];
        let extractedSubjects = new Map();

        const selectedBatch = batches.find(b => (b.id?.toString() === filters.batchId || b.batch_id?.toString() === filters.batchId));

        if (selectedBatch && selectedBatch.groups && selectedBatch.groups.length > 0) {
            extractedGroups = selectedBatch.groups;
            selectedBatch.groups.forEach(g => {
                const coursesList = g.courses || g.subjects || [];
                const gType = parseInt(g.classType || 1);
                coursesList.forEach(c => {
                    if (c.id) {
                        const cType = parseInt(c.courseType || gType || 1);
                        const tag = cType === 2 ? '[Paper]' : '[Theory]';
                        const hasTag = (c.name || '').includes('[Paper]') || (c.name || '').includes('[Theory]') || (c.name || '').toLowerCase().includes('paper');
                        const displayName = hasTag ? c.name : `${c.name} ${tag}`;
                        extractedSubjects.set(c.id, { id: c.id, name: displayName, rawName: c.name, code: c.code || '', courseType: cType });
                    }
                });
            });
        } else {
            const validPayments = payments.filter(p =>
                filters.batchId === 'All' ||
                p.batchId?.toString() === filters.batchId ||
                p.batch_id?.toString() === filters.batchId
            );

            const uniqueGroups = Array.from(new Set(validPayments.map(p => {
                const gId = p.groupId || p.group_id;
                const gName = p.groupName || p.group || (gId ? `Group ${gId}` : 'Unknown');
                const gClassType = p.classType || 1;
                return JSON.stringify({ id: gId, name: gName, classType: gClassType });
            }))).map(str => JSON.parse(str)).filter(g => g.id);

            extractedGroups = uniqueGroups;

            validPayments.forEach(p => {
                const subs = p.subjectsList || p.subjects || p.courses || [];
                const pClassType = parseInt(p.classType || p.group?.classType || 1);
                subs.forEach(s => {
                    const sId = s.id || s.course_id || s.subject_id;
                    const sName = s.name || s.courseName || s.subjectName;
                    const sCode = s.code || s.courseCode || s.subjectCode || '';
                    if (sId && !extractedSubjects.has(sId)) {
                        const sType = parseInt(s.courseType || pClassType || 1);
                        const tag = sType === 2 ? '[Paper]' : '[Theory]';
                        const hasTag = (sName || '').includes('[Paper]') || (sName || '').includes('[Theory]') || (sName || '').toLowerCase().includes('paper');
                        const displayName = hasTag ? sName : `${sName} ${tag}`;
                        extractedSubjects.set(sId, { id: sId, name: displayName, rawName: sName, code: sCode, courseType: sType });
                    }
                });
            });
        }

        setGroups(extractedGroups);
        setSubjects(Array.from(extractedSubjects.values()));
    }, [filters.batchId, batches, payments]);

    useEffect(() => {
        setCurrentPage(1);
        setApprovedFilter('All');
        setUpgradeFilter('Pending');
        setUpcomingFilter('Pending');
    }, [activeTab, filters]);

    // Helper to check if a payment matches the selected batch/business/search filters (excluding tab filter itself)
    const matchesFiltersExcludingTab = (p) => {
        const searchVal = filters.search.toLowerCase();
        const matchesSearch =
            p.studentName?.toLowerCase().includes(searchVal) ||
            p.studentNo?.toLowerCase().includes(searchVal) ||
            p.phone?.toLowerCase().includes(searchVal);

        const pBizId = p.businessId || p.business_id;
        const pBatchId = p.batchId || p.batch_id;
        const pGroupId = p.groupId || p.group_id;

        let matchesBiz = isAdmin ? (filters.businessId === 'All' || pBizId?.toString() === filters.businessId) : true;
        const matchesBatch = filters.batchId === 'All' || pBatchId?.toString() === filters.batchId;
        const matchesGroup = filters.groupId === 'All' || pGroupId?.toString() === filters.groupId;
        const matchesClassType = !filters.classType || filters.classType === 'All' || p.classType?.toString() === filters.classType?.toString();
        const matchesMethod = filters.method === 'All' || p.method === filters.method;

        let matchesSubject = true;
        if (filters.subjectId && filters.subjectId !== 'All') {
            if (Array.isArray(filters.subjectId)) {
                if (filters.subjectId.length > 0) {
                    const subs = p.subjectsList || p.subjects || p.courses || [];
                    matchesSubject = subs.some(s => {
                        const sId = s.id || s.course_id || s.subject_id;
                        return filters.subjectId.some(fId => String(fId) === String(sId));
                    });
                }
            } else {
                const subs = p.subjectsList || p.subjects || p.courses || [];
                matchesSubject = subs.some(s => {
                    const sId = s.id || s.course_id || s.subject_id;
                    return String(sId) === String(filters.subjectId);
                });
            }
        }

        let matchesDate = true;
        const isExplicitSearchActive = filters.search && filters.search.trim() !== '';
        if (!isExplicitSearchActive && (filters.dateFrom || filters.dateTo)) {
            const pDate = p.date;
            if (pDate && pDate !== '-') {
                if (filters.dateFrom && pDate < filters.dateFrom) matchesDate = false;
                if (filters.dateTo && pDate > filters.dateTo) matchesDate = false;
            } else {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesBiz && matchesBatch && matchesGroup && matchesClassType && matchesSubject && matchesDate && matchesMethod;
    };

    // Calculate dynamic tab counts based on unique students for current filters
    const tabStudentSets = {
        Pending: new Set(),
        Approved: new Set(),
        'Free Card': new Set(),
        Discount: new Set(),
        Rejected: new Set(),
        Adjusted: new Set(),
        'Post Pay': new Set(),
        'Upgrade Slips': new Set(),
        Upcoming: new Set(),
        Trash: new Set()
    };

    let pendingUpgradeCount = 0;
    let pendingUpcomingCount = 0;

    payments.forEach(p => {
        if (!matchesFiltersExcludingTab(p)) return;
        
        let mappedTab = p.status;
        const isUpgrade = p.isUpgrade || (p.remark && p.remark.includes('[UPGRADE]'));
        const isAdjusted = parseFloat(p.excessAmount || 0) > 0 || parseFloat(p.arrearsAmount || 0) > 0;

        if (p.status === 'Trash') {
            mappedTab = 'Trash';
        } else if (isUpgrade) {
            mappedTab = 'Upgrade Slips';
            if (['Pending', 'Post Pay'].includes(p.status)) pendingUpgradeCount++;
        } else if (p.status === 'Approved') {
            mappedTab = 'Approved';
        } else if (p.type === 'Installment' || p.status === 'Upcoming') {
            mappedTab = 'Upcoming';
            if (['Pending', 'Post Pay'].includes(p.status)) pendingUpcomingCount++;
        } else if (p.status === 'Pending') {
            mappedTab = 'Pending';
        } else if (isAdjusted && p.status !== 'Rejected') {
            mappedTab = 'Adjusted';
        }

        if (tabStudentSets[mappedTab] !== undefined) {
            tabStudentSets[mappedTab].add(p.studentId);
        }
    });

    const tabCounts = Object.keys(tabStudentSets).reduce((acc, tab) => {
        acc[tab] = tabStudentSets[tab].size;
        return acc;
    }, {});

    const isExplicitSearchActive = filters.search && filters.search.trim() !== '';

    const filteredPayments = payments.filter(p => {
        if (!matchesFiltersExcludingTab(p)) return false;

        let mappedTab = p.status;
        const isUpgrade = p.isUpgrade || (p.remark && p.remark.includes('[UPGRADE]'));
        const isAdjusted = parseFloat(p.excessAmount || 0) > 0 || parseFloat(p.arrearsAmount || 0) > 0;

        if (p.status === 'Trash') {
            mappedTab = 'Trash';
        } else if (isUpgrade) {
            mappedTab = 'Upgrade Slips';
        } else if (p.status === 'Approved') {
            mappedTab = 'Approved';
        } else if (p.type === 'Installment' || p.status === 'Upcoming') {
            mappedTab = 'Upcoming';
        } else if (p.status === 'Pending') {
            mappedTab = 'Pending';
        } else if (isAdjusted && p.status !== 'Rejected') {
            mappedTab = 'Adjusted';
        }

        // Bypassing tab filtering if user is explicitly searching by phone/name/ID
        if (!isExplicitSearchActive && activeTab !== mappedTab) return false;

        // Apply sub-filters for Upgrade, Upcoming, and Approved
        if (activeTab === 'Approved') {
            if (approvedFilter === 'Slips' && (p.method === 'PayHere' || p.method === 'Online')) return false;
            if (approvedFilter === 'Online' && (p.method !== 'PayHere' && p.method !== 'Online')) return false;
        }

        if (activeTab === 'Upgrade Slips') {
            if (upgradeFilter === 'Pending' && !['Pending', 'Post Pay'].includes(p.status)) return false;
            if (upgradeFilter === 'Approved' && p.status !== 'Approved') return false;
            if (upgradeFilter === 'Rejected' && p.status !== 'Rejected') return false;
        }

        if (activeTab === 'Upcoming') {
            if (upcomingFilter === 'Upcoming' && p.status !== 'Upcoming') return false;
            if (upcomingFilter === 'Pending' && !['Pending', 'Post Pay'].includes(p.status)) return false;
            if (upcomingFilter === 'Approved' && p.status !== 'Approved') return false;
            if (upcomingFilter === 'Rejected' && p.status !== 'Rejected') return false;
        }

        return true;
    });

    const stats = {
        pending: tabCounts.Pending,
        approved: tabCounts.Approved,
        freeCards: tabCounts['Free Card'],
        discounts: tabCounts.Discount,
        upgrades: tabCounts['Upgrade Slips']
    };

    const groupedAllByStudent = filteredPayments.reduce((acc, pay) => {
        if (!acc[pay.studentId]) {
            acc[pay.studentId] = { studentId: pay.studentId, studentName: pay.studentName, studentNo: pay.studentNo, phone: pay.phone, allPayments: [] };
        }
        acc[pay.studentId].allPayments.push(pay);
        return acc;
    }, {});

    const visibleStudents = Object.values(groupedAllByStudent).sort((a, b) => {
        if (activeTab === 'Post Pay') {
            const aPay = a.allPayments.find(p => p.status === 'Post Pay');
            const bPay = b.allPayments.find(p => p.status === 'Post Pay');
            const aTime = aPay && aPay.validUntil ? new Date(aPay.validUntil).getTime() : 9999999999999;
            const bTime = bPay && bPay.validUntil ? new Date(bPay.validUntil).getTime() : 9999999999999;
            return aTime - bTime;
        }
        return 0;
    });

    const totalPages = Math.ceil(visibleStudents.length / itemsPerPage) || 1;
    const paginatedStudents = visibleStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getDefaultNextDueDate = () => {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth.toISOString().split('T')[0];
    };

    const openApproveModal = (payment, isSelfPicked = false) => {
        if (payment.type === 'Installment' && payment.status !== 'Approved') {
            setInstallmentModal({ payment, isSelfPicked });
            setNextDueDate(getDefaultNextDueDate());
            setActualAmount(payment.amount || '');
            setActionRemark('');
            setIsTestApprove(false);
        } else {
            setApproveModal({ payment, isSelfPicked });
            setActualAmount(payment.amount || '');
            setActionRemark('');
        }
    };

    const submitApprove = async () => {
        const { payment, isSelfPicked } = approveModal;
        try {
            setActioningPaymentId(payment.id);
            await axios.post('/admin/payments/action', {
                paymentId: payment.id,
                action: 'Approve',
                isSelfPicked: isSelfPicked,
                actualAmountPaid: parseFloat(actualAmount || 0),
                remark: actionRemark
            });
            toast.success(`Payment Approved${isSelfPicked ? ' (Self-Picked)' : ''}!`);
            refreshAfterAction(payment.studentId);
        } catch (error) {
            toast.error(`Failed to process payment.`);
        } finally {
            setActioningPaymentId(null);
        }
    };

    const handleQuickApprove = async (payment, isSelfPicked = false) => {
        if (!window.confirm(`Directly approve this payment for exactly LKR ${parseFloat(payment.amount).toLocaleString()}?`)) return;

        try {
            setActioningPaymentId(payment.id);
            if (payment.type === 'Installment') {
                await axios.post('/admin/payments/action/installment', {
                    paymentId: payment.id,
                    nextDueDate: getDefaultNextDueDate(),
                    action: 'Approve',
                    actualAmountPaid: parseFloat(payment.amount),
                    remark: '',
                    isSelfPicked: isSelfPicked
                });
            } else {
                await axios.post('/admin/payments/action', {
                    paymentId: payment.id,
                    action: 'Approve',
                    isSelfPicked: isSelfPicked,
                    actualAmountPaid: parseFloat(payment.amount),
                    remark: ''
                });
            }
            toast.success(`Payment Quick Approved${isSelfPicked ? ' (Self-Picked)' : ''}!`);
            refreshAfterAction(payment.studentId);
        } catch (error) {
            toast.error(`Failed to approve payment.`);
        } finally {
            setActioningPaymentId(null);
        }
    };

    const handleInstituteApprove = async (isSelfPicked) => {
        const payment = institutePaymentModal;
        try {
            setActioningPaymentId(payment.id);
            if (payment.type === 'Installment') {
                await axios.post('/admin/payments/action/installment', {
                    paymentId: payment.id,
                    nextDueDate: getDefaultNextDueDate(),
                    action: 'Approve',
                    actualAmountPaid: parseFloat(payment.amount),
                    remark: '[Institute Payment]',
                    isSelfPicked: isSelfPicked
                });
            } else {
                await axios.post('/admin/payments/action', {
                    paymentId: payment.id,
                    action: 'Approve',
                    isSelfPicked: isSelfPicked,
                    actualAmountPaid: parseFloat(payment.amount),
                    remark: '[Institute Payment]'
                });
            }
            toast.success(`Institute Payment Approved! ${isSelfPicked ? '(No Delivery)' : '(Sent to Delivery)'}`);
            refreshAfterAction(payment.studentId);
        } catch (error) {
            toast.error(`Failed to approve payment.`);
        } finally {
            setActioningPaymentId(null);
        }
    };

    const handleInstallmentApprove = async (e) => {
        e.preventDefault();
        const { payment, isSelfPicked } = installmentModal;
        try {
            const actionType = isTestApprove ? 'Test Approve' : 'Approve';
            await axios.post('/admin/payments/action/installment', {
                paymentId: payment.id,
                nextDueDate: nextDueDate,
                action: actionType,
                actualAmountPaid: parseFloat(actualAmount || 0),
                remark: actionRemark,
                isSelfPicked: isSelfPicked
            });
            toast.success(`Installment ${actionType}d & Next Scheduled!`);
            refreshAfterAction(payment.studentId);
        } catch (error) { toast.error("Failed to process installment."); }
    };

    const handleAction = async (payment, action, isSelfPicked = false) => {
        let confirmMessage = `Are you sure you want to ${action} this payment?`;
        if (isSelfPicked) confirmMessage = `Approve and mark as SELF-PICKED (Tute Delivered)?`;
        if (action === 'SendToDelivery') confirmMessage = `Send this record to Delivery Hub?`;

        if (!window.confirm(confirmMessage)) return;

        try {
            setActioningPaymentId(payment.id);
            await axios.post('/admin/payments/action', {
                paymentId: payment.id,
                action: action,
                isSelfPicked: isSelfPicked
            });
            toast.success(`Action ${action} successful!`);
            refreshAfterAction(payment.studentId);
        } catch (error) {
            toast.error(`Failed to process payment.`);
        } finally {
            setActioningPaymentId(null);
        }
    };

    const submitSendToDelivery = async () => {
        if (!sendToDeliveryModal) return;
        if (deliverySelectedSubjects.length === 0) {
            return toast.error("Please select at least one subject to send to delivery.");
        }

        try {
            setActioningPaymentId(sendToDeliveryModal.id);
            await axios.post('/admin/payments/action', {
                paymentId: sendToDeliveryModal.id,
                action: 'SendToDelivery',
                selectedSubjectIds: deliverySelectedSubjects.map(id => parseInt(id))
            });
            toast.success("Sent to Delivery Hub successfully!");
            setSendToDeliveryModal(null);
            refreshAfterAction(sendToDeliveryModal.studentId);
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to send to Delivery Hub.");
        } finally {
            setActioningPaymentId(null);
        }
    };

    // 👇 MEKEN PALLAHATA THIYENA TIKA THAMAI ALUTHIN DANGATH THE ONA 👇

    const submitAdvancedAction = async () => {
        const { type, payment } = advancedActionModal;

        if (type !== 'PostPay' && actionRemark.trim() === '') {
            return toast.error("A remark is mandatory for Discounts and Free Cards.");
        }

        try {
            setActioningPaymentId(payment.id);

            if (type === 'PostPay') {
                await axios.post('/admin/payments/post-pay', { paymentId: payment.id });
                toast.success(`Post Pay granted for 7 days!`);
            } else {
                let finalAmount = 0; let detailedRemark = actionRemark;

                if (type === 'FreeCard') {
                    detailedRemark = `[Free Card Granted]\nReason: ${actionRemark}`;
                } else if (type === 'Discount') {
                    finalAmount = payment.subjectsList.reduce((sum, sub) => sum + (parseFloat(customPrices[sub.id]) || 0), 0);
                    const breakdownStr = payment.subjectsList.map(sub => `${sub.code}: LKR ${customPrices[sub.id] || 0}`).join(' | ');
                    detailedRemark = `Custom Breakdown: [${breakdownStr}]\nReason: ${actionRemark}`;
                }

                await axios.post('/admin/payments/action', {
                    paymentId: payment.id, action: type === 'FreeCard' ? 'Free Card' : 'Discount',
                    customAmount: finalAmount, remark: detailedRemark
                });
                toast.success(`Payment processed as ${type}!`);
            }

            // Meken thamai PostPay unoth Post Pay tab ekata yanne, nathnam inna tab ekema innawa
            refreshAfterAction(payment.studentId, type === 'PostPay' ? 'Post Pay' : activeTab);
        } catch (error) {
            toast.error("Failed to process action.");
        } finally {
            setActioningPaymentId(null);
        }
    };

    const refreshAfterAction = async (studentId, targetTab = activeTab) => {
        const payRes = await axios.get('/admin/payments');
        setPayments(payRes.data || []);

        setStudentActionModal(null);
        setAdvancedActionModal(null);
        setApproveModal(null);
        setInstitutePaymentModal(null);
        setInstallmentModal(null);
        setSendToDeliveryModal(null);

        setActiveTab(targetTab);
    };

    // 👆 MEKEN UDATA THIYENA TIKA THAMAI ALUTHIN DANGATH THE ONA 👆

    const openAdvancedModal = (type, payment) => {
        setAdvancedActionModal({ type, payment });
        setActionRemark('');
        if (type === 'Discount') {
            const initialPrices = {};
            const subsList = payment.subjectsList || payment.subjects || payment.courses || [];
            subsList.forEach(s => initialPrices[s.id || s.course_id] = s.price || 0);
            setCustomPrices(initialPrices);
        }
    };
    const handleCustomPriceChange = (id, val) => setCustomPrices(prev => ({ ...prev, [id]: val }));

    const handleOpenEditModal = (pay) => {
        setEditModal(pay);
        setEditSubjectsList(pay.subjectsList ? pay.subjectsList.map(s => ({
            id: parseInt(s.id),
            name: s.name,
            code: s.code,
            price: parseFloat(s.price || 0)
        })) : []);
        setEditAmount(pay.amount || 0);
        setSelectedAddSubjectId('');
    };

    const handleSavePaymentDetails = async () => {
        if (!editSubjectsList.length) {
            return toast.error("Please select at least one subject.");
        }
        if (parseFloat(editAmount) < 0 || isNaN(parseFloat(editAmount))) {
            return toast.error("Amount must be a valid non-negative number.");
        }

        setSavingEdit(true);
        const loadToast = toast.loading("Updating payment details...");
        const subjectIds = editSubjectsList.map(s => s.id);
        const customPricesMap = {};
        editSubjectsList.forEach(s => {
            customPricesMap[s.id] = s.price;
        });

        try {
            await axios.post('/admin/payments/update-details', {
                paymentId: editModal.id,
                subjects: subjectIds,
                customPrices: customPricesMap,
                amount: parseFloat(editAmount)
            });
            toast.success("Payment details updated successfully!", { id: loadToast });
            setEditModal(null);
            
            // Refresh payments list
            const payRes = await axios.get('/admin/payments');
            setPayments(payRes.data || []);
        } catch (error) {
            toast.error("Failed to update payment details.", { id: loadToast });
        } finally {
            setSavingEdit(false);
        }
    };

    const openSlipsInNewTab = (slips, studentName, studentNo, studentPhone) => {
        if (!slips || slips.length === 0) return toast.error("No slips to view.");

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const backendBaseUrl = isLocalhost ? 'http://localhost:5000' : 'https://imacampus.online';

        const slipsHtml = slips.map((imgStr, index) => {
            const fileUrl = `${backendBaseUrl}/api/storage/documents/${imgStr}`;
            const isPdf = imgStr.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                return `
                <div class="slip-card">
                    <div class="title">Document ${index + 1} (PDF)</div>
                    <embed src="${fileUrl}" type="application/pdf" width="100%" height="600px" />
                    <a href="${fileUrl}" target="_blank" class="download-btn">Open PDF in New Tab</a>
                </div>`;
            } else {
                return `
                <div class="slip-card">
                    <div class="title">Image ${index + 1}</div>
                    <img src="${fileUrl}" alt="Slip ${index + 1}"/>
                    <a href="${fileUrl}" target="_blank" class="download-btn">View Full Image</a>
                </div>`;
            }
        }).join('');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Attached Slips - ${studentName || 'Student'}</title>
            <style>
                body { background-color: #0f172a; color: white; font-family: system-ui, -apple-system, sans-serif; padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 2rem; margin: 0; }
                .header { text-align: center; margin-bottom: 1rem; }
                .header h2 { color: #10b981; margin: 0; font-size: 2rem; }
                .student-badge { margin-top: 15px; display: inline-block; background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 12px; border: 1px solid #334155; }
                .slip-card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 800px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
                img { max-width: 100%; height: auto; border-radius: 0.5rem; border: 1px solid #334155; }
                embed { border-radius: 0.5rem; border: 1px solid #334155; background-color: white; }
                .title { width: 100%; text-align: left; margin-bottom: 1rem; font-size: 1rem; font-weight: bold; color: #cbd5e1; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
                .download-btn { margin-top: 1rem; padding: 0.5rem 1rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-size: 0.875rem; font-weight: bold; }
                .download-btn:hover { background-color: #2563eb; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Attached Documents & Slips</h2>
                <div class="student-badge">
                    <span style="color: #94a3b8; font-size: 1.1rem;">Name: <strong style="color: white;">${studentName || 'Student'}</strong></span>
                    <span style="color: #334155; margin: 0 15px;">|</span>
                    <span style="color: #94a3b8; font-size: 1.1rem;">ID: <strong style="color: #10b981;">${studentNo || 'N/A'}</strong></span>
                    <span style="color: #334155; margin: 0 15px;">|</span>
                    <span style="color: #94a3b8; font-size: 1.1rem;">Phone: <strong style="color: #3b82f6;">${studentPhone || 'N/A'}</strong></span>
                </div>
            </div>
            ${slipsHtml}
        </body>
        </html>
        `;

        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        } else {
            toast.error("Popup blocked! Please allow popups for this site.");
        }
    };

    // 🔥 MODIFIED: Theme Edition Light/Dark Tab Classes 🔥
    const getTabClass = (tabName) => {
        const base = "px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center gap-2 whitespace-nowrap border shadow-sm outline-none scale-[0.98] hover:scale-100 duration-200";
        if (activeTab !== tabName) return `${base} bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/10 hover:shadow-md`;

        switch (tabName) {
            case 'Pending': return `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]`;
            case 'Approved': return `${base} bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]`;
            case 'Free Card': return `${base} bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]`;
            case 'Discount': return `${base} bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]`;
            case 'Rejected': return `${base} bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]`;
            case 'Upcoming': return `${base} bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]`;
            case 'Adjusted': return `${base} bg-teal-500/10 text-teal-400 border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]`; // 🔥 ALUTH Tiyal eka
            case 'Post Pay': return `${base} bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)]`;
            case 'Upgrade Slips': return `${base} bg-pink-500/10 text-pink-400 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]`;
            case 'Trash': return `${base} bg-white/10 text-slate-200 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]`;
            default: return `${base} bg-white/10 text-white border-white/20`;
        }
    };

    const getCountdown = (expiryDate) => {
        if (!expiryDate) return "ACTIVE";
        const diff = new Date(expiryDate).getTime() - new Date().getTime();
        if (diff <= 0) return "EXPIRED";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        return `${days}d ${hours}h ${minutes}m left`;
    };

    // 🔥 MODIFIED: Theme Edition Light/Dark Card Styles 🔥
    // 🔥 MODIFIED: Fixed Price Box squishing & truncating issues 🔥
    const renderPaymentCard = (pay) => (
        <div key={pay.id} className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder hover:border-gray-300 dark:hover:border-white/20 rounded-[2rem] p-6 relative overflow-hidden mb-5 shadow-sm hover:shadow-lg transition-all duration-300 group">
            <div className={`absolute top-0 left-0 w-2 h-full ${pay.method === 'PayHere' || pay.method === 'Online' ? 'bg-indigo-500 dark:bg-indigo-600' : 'bg-brand-accent dark:bg-blue-600'}`}></div>

            <div className="absolute top-4 right-4 flex gap-2 opacity-100 sm:opacity-80 group-hover:opacity-100 transition-opacity">
                {pay.status === 'Post Pay' && (
                    <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 animate-pulse shadow-sm">
                        <Unlock size={14} /> {getCountdown(pay.validUntil)}
                    </div>
                )}
                {pay.status !== 'Trash' && hasFullAccess && (
                    <>
                        <button onClick={() => handleOpenEditModal(pay)} className="bg-gray-50 dark:bg-black/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-indigo-400 border border-gray-200 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 p-2.5 rounded-xl transition-all shadow-sm outline-none" title="Edit Subjects / Amount">
                            <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleAction(pay, 'Trash')} className="bg-gray-50 dark:bg-black/40 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 border border-gray-200 dark:border-white/5 hover:border-red-200 dark:hover:border-red-500/30 p-2.5 rounded-xl transition-all shadow-sm outline-none" title="Move to Trash">
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            </div>

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 pl-2 pr-12">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">{pay.date}</p>
                        {pay.actionDate && pay.actionDate !== '-' && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                                Action: {pay.actionDate}
                            </p>
                        )}
                    </div>
                    <h5 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight truncate max-w-full flex flex-wrap items-center gap-2">
                        <span className="text-red-500 text-xs font-mono font-semibold bg-red-100 dark:bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                            ID: {pay.id}
                        </span>
                        <span>{pay.business}</span>
                    </h5>
                    <p className="text-base font-bold mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 border-2 border-blue-400 dark:border-blue-500 px-4 py-1.5 rounded-xl animate-pulse font-black shadow-md uppercase tracking-widest">
                            BATCH: {pay.batch}
                        </span>
                        {pay.classType === 2 ? (
                            <span className="text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-4 py-1.5 rounded-xl border-2 border-amber-400 dark:border-amber-500 font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 animate-pulse">
                                📝 PAPER CLASS
                            </span>
                        ) : (
                            <span className="text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/20 px-4 py-1.5 rounded-xl border-2 border-sky-400 dark:border-sky-500 font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 animate-pulse">
                                📘 THEORY CLASS
                            </span>
                        )}
                        {pay.groupName && (
                            <span className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-4 py-1.5 rounded-xl border-2 border-purple-400 dark:border-purple-500 font-black uppercase tracking-widest shadow-md animate-pulse">
                                GROUP: {pay.groupName}
                            </span>
                        )}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className="bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-[10px] px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest border border-gray-200 dark:border-white/10">{pay.type}</span>
                        {pay.type === 'Installment' && (
                            <span className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest border border-purple-200 dark:border-purple-500/20">
                                Phase {pay.installmentNo} of {Math.max(pay.installmentNo, pay.totalPhases || 1)}
                            </span>
                        )}
                        {pay.aiVerified && (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <ShieldCheck size={12} /> AI VERIFIED
                            </span>
                        )}
                    </div>
                </div>
                {/* 🔥 Added shrink-0 and whitespace-nowrap here 🔥 */}
                <div className={`${pay.method === 'PayHere' || pay.method === 'Online' ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' : 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'} p-5 rounded-2xl border min-w-[180px] shrink-0 text-right xl:text-left shadow-sm mt-4 xl:mt-0`}>
                    <p className={`text-[10px] ${pay.method === 'PayHere' || pay.method === 'Online' ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-600 dark:text-blue-400'} font-extrabold uppercase tracking-widest mb-1`}>Via {pay.method}</p>
                    <p className={`text-3xl font-black tracking-tight whitespace-nowrap ${pay.method === 'PayHere' || pay.method === 'Online' ? 'text-indigo-700 dark:text-white' : 'text-blue-700 dark:text-white'}`}><span className={`text-sm font-bold mr-1 ${pay.method === 'PayHere' || pay.method === 'Online' ? 'text-indigo-500 dark:text-slate-400' : 'text-blue-500 dark:text-slate-400'}`}>LKR</span>{parseFloat(pay.amount).toLocaleString()}</p>
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5 p-5 mb-6 ml-2">
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-white/5 pb-3">
                    <h6 className="text-xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-500" /> System Expected Breakdown</h6>
                </div>

                {pay.subjectsList && pay.subjectsList.length > 0 ? (
                    <div className="space-y-3 mb-4">
                        {/* 1. Show Selected Subjects and Prices */}
                        {pay.subjectsList.map((sub, i) => (
                            <div key={i} className="flex justify-between items-center text-sm gap-4">
                                <span className="text-gray-700 dark:text-slate-300 font-bold truncate flex items-center gap-2">
                                    <span>{sub.name} <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">({sub.code})</span></span>
                                    {sub.courseType === 2 || pay.classType === 2 ? (
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                                            Paper
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-md border border-sky-500/30">
                                            Theory
                                        </span>
                                    )}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold whitespace-nowrap">LKR {parseFloat(sub.price).toLocaleString()}</span>
                            </div>
                        ))}
                        
                        <div className="pt-3 border-t border-gray-200 dark:border-white/5 mt-2 space-y-2">
                            {/* 2. Show Base Expected */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">Base Subject Total:</span>
                                <span className="text-gray-700 dark:text-slate-300 font-bold">LKR {parseFloat(pay.baseTotal || 0).toLocaleString()}</span>
                            </div>

                            {/* 3. Show Wallet Adjustment (if any) */}
                            {parseFloat(pay.walletBalance) !== 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Wallet size={14} className={parseFloat(pay.walletBalance) > 0 ? 'text-emerald-500' : 'text-red-500'}/> 
                                        Previous Wallet {parseFloat(pay.walletBalance) > 0 ? 'Excess' : 'Due'}:
                                    </span>
                                    <span className={`font-extrabold ${parseFloat(pay.walletBalance) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {parseFloat(pay.walletBalance) > 0 ? '- LKR' : '+ LKR'} {Math.abs(pay.walletBalance).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 4. Show Final System Expected */}
                        <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-200 dark:border-white/10 mt-2 bg-gray-100/50 dark:bg-white/5 p-3 rounded-xl shadow-inner">
                            <span className="text-gray-800 dark:text-slate-200 font-black uppercase tracking-wider text-[11px] shrink-0">Final System Expected:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl whitespace-nowrap drop-shadow-sm">LKR {parseFloat(pay.systemTotal).toLocaleString()}</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-4 font-bold bg-white dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5">No specific subjects recognized.</p>
                )}

                {pay.type === 'Installment' ? (
                    <div className="p-4 rounded-xl text-xs font-extrabold flex items-center justify-between border bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20 shadow-sm gap-2">
                        <span className="whitespace-nowrap">Slip Amount: LKR {parseFloat(pay.amount).toLocaleString()}</span>
                        <span className="bg-purple-100 dark:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-transparent whitespace-nowrap">Partial Installment</span>
                    </div>
                ) : (
                    <div className={`p-4 rounded-xl text-xs font-extrabold flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border shadow-sm ${parseFloat(pay.systemTotal) === parseFloat(pay.amount) ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20'}`}>
                        <span className="whitespace-nowrap">Slip Amount: LKR {parseFloat(pay.amount).toLocaleString()}</span>
                        {parseFloat(pay.systemTotal) !== parseFloat(pay.amount) ? <span className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-transparent px-3 py-1.5 rounded-lg text-red-700 dark:text-red-200 whitespace-nowrap">Mismatch Detected</span> : <span className="bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-transparent px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-200 whitespace-nowrap">Perfect Match</span>}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6 ml-2">
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileImage size={16} /> Slips & Docs</p>
                        {pay.slips && pay.slips.length > 0 && (
                            <button
                                onClick={() => openSlipsInNewTab(pay.slips, studentActionModal?.studentName || pay.studentName, studentActionModal?.studentNo || pay.studentNo, studentActionModal?.phone || pay.phone)}
                                className="text-[10px] font-extrabold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all border border-blue-200 dark:border-blue-500/30 shadow-sm outline-none whitespace-nowrap"
                            >
                                Open Gallery
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {pay.slips && pay.slips.length > 0 ? pay.slips.map((imgStr, i) => {
                            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                            const backendBaseUrl = isLocalhost ? 'http://localhost:5000' : 'https://imacampus.online';
                            const fileUrl = `${backendBaseUrl}/api/storage/documents/${imgStr}`;
                            const isPdf = imgStr.toLowerCase().endsWith('.pdf');

                            return (
                                <div key={i} onClick={() => openSlipsInNewTab(pay.slips, studentActionModal?.studentName || pay.studentName, studentActionModal?.studentNo || pay.studentNo, studentActionModal?.phone || pay.phone)} className="relative shrink-0 w-28 h-28 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-brand-accent/50 hover:shadow-lg transition-all cursor-pointer bg-gray-50 dark:bg-black/20 flex items-center justify-center group shadow-sm" title="Click to view">
                                    {isPdf ? (
                                        <div className="flex flex-col items-center text-gray-400 dark:text-white/40 text-[10px] font-extrabold uppercase group-hover:text-gray-600 dark:group-hover:text-white/80 transition-colors"><FileText size={32} className="text-red-500/80 mb-2 group-hover:text-red-500 transition-colors" /> PDF</div>
                                    ) : (
                                        <img src={fileUrl} alt="slip" className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500" onError={(e) => { e.target.src = '/logo.png'; }} />
                                    )}
                                </div>
                            )
                        }) : <span className="text-xs text-gray-500 dark:text-slate-500 font-bold bg-gray-50 dark:bg-black/20 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm inline-block w-full text-center">No documents attached</span>}
                    </div>
                </div>
                <div>
                    <p className="text-xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 mt-4 xl:mt-0"><MessageSquare size={16} /> Remarks</p>
                    <div className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-5 text-sm text-gray-700 dark:text-slate-300 min-h-[112px] whitespace-pre-wrap font-medium shadow-inner">
                        {pay.remark ? pay.remark : <span className="italic text-gray-400 dark:text-slate-500">No system remarks available for this transaction.</span>}
                    </div>
                </div>
            </div>

            {/* PROCESS PAYMENT ACTIONS */}
            {['Pending', 'Upcoming', 'Rejected', 'Post Pay', 'Upgrade Slips'].includes(activeTab) && pay.status !== 'Approved' && hasFullAccess && (
                <div className="bg-gray-100 dark:bg-slate-900/60 rounded-[2rem] border border-gray-200 dark:border-white/5 p-6 mt-6 shadow-inner ml-2">
                    <p className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center justify-center gap-2">
                        <ShieldCheck size={16} /> Action Panel
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <button disabled={actioningPaymentId === pay.id} onClick={() => handleQuickApprove(pay, false)} className="bg-emerald-600 hover:bg-emerald-500 text-white py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-lg shadow-emerald-500/20 dark:shadow-none outline-none">
                            {actioningPaymentId === pay.id ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} Quick Approve
                        </button>

                        <button disabled={actioningPaymentId === pay.id} onClick={() => openApproveModal(pay, false)} className="bg-white dark:bg-brand-darkCard hover:bg-blue-50 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white border border-gray-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md outline-none">
                            <Wallet size={20} /> Adjust Amount
                        </button>

                        <button disabled={actioningPaymentId === pay.id} onClick={() => setInstitutePaymentModal(pay)} className="bg-white dark:bg-brand-darkCard hover:bg-indigo-50 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-white border border-gray-200 dark:border-indigo-500/30 hover:border-indigo-300 dark:hover:border-indigo-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md outline-none">
                            {actioningPaymentId === pay.id ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Institute
                        </button>

                        {activeTab !== 'Post Pay' && (
                            <button disabled={actioningPaymentId === pay.id} onClick={() => openAdvancedModal('PostPay', pay)} className="bg-white dark:bg-brand-darkCard hover:bg-orange-50 dark:hover:bg-orange-600 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-white border border-gray-200 dark:border-orange-500/30 hover:border-orange-300 dark:hover:border-orange-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md outline-none">
                                <Unlock size={20} /> Post Pay
                            </button>
                        )}

                        <button disabled={actioningPaymentId === pay.id} onClick={() => openAdvancedModal('FreeCard', pay)} className="bg-white dark:bg-brand-darkCard hover:bg-yellow-50 dark:hover:bg-yellow-600 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-white border border-gray-200 dark:border-yellow-500/30 hover:border-yellow-300 dark:hover:border-yellow-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md outline-none">
                            <Gift size={20} /> Free Card
                        </button>

                        <button disabled={actioningPaymentId === pay.id} onClick={() => openAdvancedModal('Discount', pay)} className="bg-white dark:bg-brand-darkCard hover:bg-cyan-50 dark:hover:bg-cyan-600 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-white border border-gray-200 dark:border-cyan-500/30 hover:border-cyan-300 dark:hover:border-cyan-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md outline-none">
                            <Tag size={20} /> Discount
                        </button>

                        <button disabled={actioningPaymentId === pay.id} onClick={() => handleAction(pay, 'Reject')} className="bg-white dark:bg-brand-darkCard hover:bg-red-50 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-white border border-gray-200 dark:border-red-500/30 hover:border-red-300 dark:hover:border-red-500 py-4 px-3 rounded-2xl transition-all text-xs font-extrabold uppercase tracking-widest flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow-md lg:col-span-1 col-span-2 outline-none">
                            <CloseIcon size={20} /> Reject
                        </button>
                    </div>
                </div>
            )}

            {/* Delivery Hub Button */}
            {['Free Card', 'Discount', 'Approved'].includes(pay.status) && hasFullAccess && (
                <div className="mt-6 ml-2">
                    <button
                        disabled={actioningPaymentId === pay.id || !!pay.hasDelivery}
                        onClick={() => {
                            setSendToDeliveryModal(pay);
                            const subs = pay.subjectsList || pay.subjects || pay.courses || [];
                            setDeliverySelectedSubjects(subs.map(s => String(s.id || s.course_id)));
                        }}
                        className={`w-full py-4 rounded-2xl transition-all text-sm font-extrabold uppercase tracking-widest flex justify-center items-center gap-3 shadow-sm outline-none ${pay.hasDelivery
                            ? 'bg-gray-100 dark:bg-black/30 text-gray-400 dark:text-slate-600 border border-gray-200 dark:border-white/5 cursor-not-allowed shadow-none'
                            : 'bg-purple-50 dark:bg-purple-600/10 hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white dark:hover:text-white border border-purple-200 dark:border-purple-500/30 hover:border-transparent dark:hover:bg-purple-600 shadow-purple-500/20 hover:shadow-lg'
                            }`}
                    >
                        <Truck size={20} /> {pay.hasDelivery ? 'Dispatched to Delivery' : 'Send to Delivery Hub'}
                    </button>
                </div>
            )}
        </div>
    );

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (verificationPassword === 'admin123') {
            setVerificationMode('ai');
            setShowPasswordModal(false);
            setVerificationPassword('');
            toast.success("AI Verification Mode Unlocked");
        } else {
            toast.error("Incorrect Password!");
        }
    };

    return (
        <div className="w-full animate-fade-in text-gray-900 dark:text-slate-200 pb-10 font-sans relative">

            {/* Mode Switcher */}
            <div className="flex justify-center mb-8">
                <div className="bg-white/50 dark:bg-black/30 p-1.5 rounded-2xl backdrop-blur-md border border-gray-200/50 dark:border-white/10 flex shadow-sm inline-flex">
                    <button
                        onClick={() => setVerificationMode('manual')}
                        className={`px-8 py-3 rounded-xl text-sm font-extrabold transition-all outline-none flex items-center gap-2 ${verificationMode === 'manual' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/5' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
                    >
                        <Wallet size={18} /> Manual Verification
                    </button>
                    <button
                        onClick={() => {
                            if (verificationMode !== 'ai') setShowPasswordModal(true);
                        }}
                        className={`px-8 py-3 rounded-xl text-sm font-extrabold transition-all outline-none flex items-center gap-2 ${verificationMode === 'ai' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-400' : 'text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                    >
                        <ShieldCheck size={18} /> AI Verification
                    </button>
                </div>
            </div>

            {verificationMode === 'ai' ? (
                <div className="bg-white/50 dark:bg-brand-darkCard/50 rounded-[2rem] border border-gray-200 dark:border-brand-darkBorder shadow-sm overflow-hidden">
                    <AISlipVerification loggedInUser={loggedInUser} />
                </div>
            ) : (
                <>



            {/* Filters */}
            <PaymentFilters
                isAdmin={isAdmin}
                isSystemAdmin={hasFullAccess}
                isFinance={isFinance}
                filters={filters}
                setFilters={setFilters}
                businesses={businesses}
                batches={batches}
                groups={groups}
                subjects={subjects}
                payments={payments}
                stats={stats}
                onOpenStaffStats={() => setShowStaffModal(true)}
                onOpenExport={handleOpenExport}
            />

            {/* Tabs Row */}
            <div className="flex flex-wrap gap-3 mb-8 pb-3 p-1">
                <button onClick={() => setActiveTab('Pending')} className={getTabClass('Pending')}>
                    <Clock size={16} /> Pending ({tabCounts.Pending})
                    {tabCounts.Pending > 0 && <span className="bg-red-500 text-white rounded-full h-2 w-2 ml-1 animate-pulse"></span>}
                </button>
                <button onClick={() => setActiveTab('Approved')} className={getTabClass('Approved')}><Check size={16} /> Approved ({tabCounts.Approved})</button>
                <button onClick={() => setActiveTab('Free Card')} className={getTabClass('Free Card')}><Gift size={16} /> Free Card ({tabCounts['Free Card']})</button>
                <button onClick={() => setActiveTab('Discount')} className={getTabClass('Discount')}><Tag size={16} /> Discount ({tabCounts.Discount})</button>
                <button onClick={() => setActiveTab('Rejected')} className={getTabClass('Rejected')}><CloseIcon size={16} /> Rejected ({tabCounts.Rejected})</button>
                <button onClick={() => setActiveTab('Adjusted')} className={getTabClass('Adjusted')}><AlertCircle size={16} /> Adjusted ({tabCounts.Adjusted})</button>
                <button onClick={() => setActiveTab('Post Pay')} className={getTabClass('Post Pay')}><Unlock size={16} /> Post Pay ({tabCounts['Post Pay']})</button>
                
                <button onClick={() => setActiveTab('Upgrade Slips')} className={getTabClass('Upgrade Slips')}>
                    <ShieldCheck size={16} /> Upgrade Slips ({tabCounts['Upgrade Slips']})
                    {pendingUpgradeCount > 0 && <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-[10px] ml-1 font-black shadow-sm">{pendingUpgradeCount}</span>}
                </button>
                
                <button onClick={() => setActiveTab('Upcoming')} className={getTabClass('Upcoming')}>
                    <CalendarDays size={16} /> Upcoming Dues ({tabCounts.Upcoming})
                    {pendingUpcomingCount > 0 && <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-[10px] ml-1 font-black shadow-sm">{pendingUpcomingCount}</span>}
                </button>
                
                <button onClick={() => setActiveTab('Trash')} className={getTabClass('Trash')}><Trash2 size={16} /> Trash ({tabCounts.Trash})</button>
            </div>

            {/* UPGRADE SLIPS SUB-TABS */}
            {activeTab === 'Upgrade Slips' && (
                <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-brand-darkCard p-2.5 rounded-2xl w-full md:w-max border border-gray-200 dark:border-brand-darkBorder shadow-sm mb-6 transition-colors">
                    <button onClick={() => setUpgradeFilter('Pending')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upgradeFilter === 'Pending' ? 'bg-pink-50 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-pink-700 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10'}`}>
                        Pending {pendingUpgradeCount > 0 && <span className="bg-red-500 text-white rounded-full h-2 w-2 ml-2 inline-block"></span>}
                    </button>
                    <button onClick={() => setUpgradeFilter('Approved')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upgradeFilter === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>Approved</button>
                    <button onClick={() => setUpgradeFilter('Rejected')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upgradeFilter === 'Rejected' ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'}`}>Rejected</button>
                </div>
            )}

            {/* UPCOMING DUES SUB-TABS */}
            {activeTab === 'Upcoming' && (
                <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-brand-darkCard p-2.5 rounded-2xl w-full md:w-max border border-gray-200 dark:border-brand-darkBorder shadow-sm mb-6 transition-colors">
                    <button onClick={() => setUpcomingFilter('Upcoming')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upcomingFilter === 'Upcoming' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10'}`}>
                        Upcoming Dues
                    </button>
                    <button onClick={() => setUpcomingFilter('Pending')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upcomingFilter === 'Pending' ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10'}`}>
                        Pending Slips {pendingUpcomingCount > 0 && <span className="bg-red-500 text-white rounded-full h-2 w-2 ml-2 inline-block"></span>}
                    </button>
                    <button onClick={() => setUpcomingFilter('Rejected')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${upcomingFilter === 'Rejected' ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'}`}>Rejected</button>
                </div>
            )}

            {/* APPROVED SUB-TABS */}
            {activeTab === 'Approved' && (
                <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-brand-darkCard p-2.5 rounded-2xl w-full md:w-max border border-gray-200 dark:border-brand-darkBorder shadow-sm mb-6 transition-colors">
                    <button onClick={() => setApprovedFilter('All')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${approvedFilter === 'All' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-transparent' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`}>All Approved</button>
                    <button onClick={() => setApprovedFilter('Slips')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${approvedFilter === 'Slips' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>Slip Payments</button>
                    <button onClick={() => setApprovedFilter('Online')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all outline-none ${approvedFilter === 'Online' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`}>Online (PayHere)</button>
                </div>
            )}

            {/* UNIFIED PAYMENT CARDS LIST FOR ALL TABS */}
            <div className="space-y-6">
                {loading ? (
                    <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-lg"><Loader2 className="animate-spin text-rose-500 mx-auto" size={40} /></div>
                ) : paginatedStudents.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-lg"><p className="text-slate-400 font-extrabold text-lg">No records found for the selected filters.</p></div>
                ) : (
                    <>
                        {paginatedStudents.map(student => {
                            const latestPayment = student.allPayments[0];
                            return (
                                <div key={student.studentId} className="bg-white/5 backdrop-blur-md border border-white/10 hover:border-brand-accent/40 p-6 md:p-8 rounded-[2rem] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all duration-300 shadow-lg hover:shadow-brand-accentLight/5 hover:-translate-y-0.5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                                    
                                    <div className="flex items-start gap-5 flex-1 w-full">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 bg-white/5 text-rose-400 shadow-inner group-hover:border-rose-500/20 transition-all duration-300 relative z-10">
                                            <User size={30} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 mt-1 relative z-10">
                                            <h4 className="font-extrabold text-xl text-white flex items-center flex-wrap gap-3">
                                                <span className="text-rose-400 text-xs font-mono font-semibold bg-rose-500/15 border border-rose-500/20 px-3 py-1 rounded-full tracking-wide shadow-[0_0_10px_rgba(244,63,94,0.08)]">
                                                    ID: {student.allPayments.map(p => p.id).join(', ')}
                                                </span>
                                                {student.studentName}
                                                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 tracking-widest uppercase shadow-sm">{student.studentNo}</span>
                                                {student.phone && student.phone !== 'N/A' && <span className="text-[10px] font-black text-sky-400 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/20 tracking-widest uppercase shadow-sm">{student.phone}</span>}
                                            </h4>
                                            {latestPayment && (
                                                <div className="mt-3">
                                                    <p className="text-sm font-bold text-slate-400 flex flex-wrap items-center gap-3">
                                                        <span className="text-emerald-400 font-extrabold bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-sm">{latestPayment.date}</span>
                                                        <span className="truncate max-w-[150px] sm:max-w-[300px] text-slate-300 font-semibold">{latestPayment.business}</span>
                                                        <span className="truncate max-w-[100px] sm:max-w-[200px] text-slate-400 font-medium">({latestPayment.batch})</span>
                                                        {latestPayment.classType === 2 ? (
                                                            <span className="text-amber-400 font-black bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 text-xs tracking-wider shadow-sm flex items-center gap-1">
                                                                📝 Paper Class
                                                            </span>
                                                        ) : (
                                                            <span className="text-sky-400 font-black bg-sky-500/15 px-2.5 py-1 rounded-lg border border-sky-500/30 text-xs tracking-wider shadow-sm flex items-center gap-1">
                                                                📘 Theory Class
                                                            </span>
                                                        )}
                                                        {latestPayment.groupName && (
                                                            <span className="text-purple-400 font-extrabold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 text-xs tracking-wide shadow-sm">
                                                                Group: {latestPayment.groupName}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 mt-3 items-center">
                                                        <span className="text-[10px] font-black bg-blue-500/15 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase tracking-widest shadow-sm flex items-center gap-1.5"><Tag size={12}/> {latestPayment.type}</span>
                                                        <span className="text-[10px] font-black bg-purple-500/15 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-500/20 uppercase tracking-widest shadow-sm flex items-center gap-1.5"><Wallet size={12}/> {latestPayment.method}</span>
                                                        {student.allPayments.length > 1 && <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-widest shadow-sm">+{student.allPayments.length - 1} More</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-between lg:justify-end gap-6 w-full lg:w-auto border-t border-white/5 lg:border-t-0 pt-6 lg:pt-0 shrink-0 relative z-10">
                                        {latestPayment && (
                                            <div className="flex flex-col items-center sm:items-start lg:items-end xl:items-start mr-0 xl:mr-4">
                                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Amount</span>
                                                <span className="text-3xl md:text-4xl text-white font-black tracking-tight drop-shadow-md">
                                                    <span className="text-brand-accent text-xl mr-1">LKR</span>{parseFloat(latestPayment.amount).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                            <button onClick={() => handleGhostLogin(student)} title="Login as Student" className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-3.5 md:py-4 rounded-xl border border-slate-700 transition-all shadow-md group/ghost">
                                                <Unlock size={20} className="group-hover/ghost:scale-110 transition-transform" />
                                            </button>
                                            <button onClick={() => setStudentActionModal({ ...student, allPayments: payments.filter(p => p.studentId === student.studentId) })} className="flex-1 sm:flex-none bg-linear-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-extrabold py-4 px-8 rounded-xl hover:shadow-[0_0_20px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all duration-200 text-xs uppercase tracking-widest whitespace-nowrap outline-none shadow-lg border border-rose-500/30 flex items-center justify-center gap-2">
                                                Review Payments <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-8 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-sm">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white disabled:opacity-30 transition-colors outline-none px-4 py-2"><ChevronLeft size={18} /> Prev</button>
                                <span className="text-sm font-extrabold text-white bg-white/5 px-5 py-2 rounded-xl border border-white/5">Page {currentPage} of {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white disabled:opacity-30 transition-colors outline-none px-4 py-2">Next <ChevronRight size={18} /></button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 🔥 STUDENT ACTION MODAL (REVIEW PAYMENTS) - WIDER MODAL 🔥 */}
            {studentActionModal && createPortal(
                <div className="fixed inset-0 z-[9990] bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-fade-in">
                    {/* 🔥 Changed max-w-7xl to max-w-[98vw] 2xl:max-w-[1800px] 🔥 */}
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2.5rem] w-full max-w-[98vw] xl:max-w-[1600px] 2xl:max-w-[1800px] min-h-[90vh] max-h-[95vh] shadow-2xl relative flex flex-col overflow-hidden transition-colors">

                        <div className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 p-6 md:px-10 rounded-t-[2.5rem] flex justify-between items-center shrink-0 shadow-sm">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex justify-center items-center border border-emerald-200 dark:border-emerald-500/20 shadow-sm"><User size={28} /></div>
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{studentActionModal.studentName}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold tracking-widest uppercase bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 w-max shadow-sm">{studentActionModal.studentNo}</p>
                                        {studentActionModal.phone && studentActionModal.phone !== 'N/A' && <p className="text-[10px] text-blue-700 dark:text-blue-400 font-extrabold tracking-widest uppercase bg-blue-100 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/20 w-max shadow-sm">{studentActionModal.phone}</p>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setStudentActionModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-3.5 rounded-2xl transition-all border border-gray-200 dark:border-transparent outline-none shadow-sm"><CloseIcon size={24} strokeWidth={3} /></button>
                        </div>

                        <div className="p-6 md:p-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                            {/* LEFT SIDE: Active Payment Being Reviewed */}
                            <div className="space-y-6 h-full flex flex-col">
                                <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-widest text-sm flex items-center gap-3 mb-4 border-b border-gray-200 dark:border-white/10 pb-4 shrink-0"><AlertCircle className="text-brand-accent" size={20} /> Payment to Action</h4>

                                {(() => {
                                    const allStudentPays = studentActionModal.allPayments || [];
                                    const actionableStatuses = ['Pending', 'Upcoming', 'Post Pay'];
                                    let leftSidePayments = allStudentPays.filter(p => actionableStatuses.includes(p.status));
                                    
                                    if (selectedPaymentId) {
                                        const selected = leftSidePayments.find(p => p.id === selectedPaymentId);
                                        if (selected) {
                                            leftSidePayments = [selected, ...leftSidePayments.filter(p => p.id !== selectedPaymentId)];
                                        }
                                    }

                                    if (leftSidePayments.length === 0) {
                                        return <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-3xl p-10 text-center text-gray-500 dark:text-slate-400 text-lg font-bold shadow-sm flex-1 flex items-center justify-center">No actionable payments found.</div>;
                                    }

                                    return (
                                        <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-6">
                                            {leftSidePayments.map(p => (
                                                <div key={p.id} className="relative">
                                                    {renderPaymentCard(p)}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* RIGHT SIDE: Other Payments History */}
                            <div className="bg-gray-50 dark:bg-black/30 rounded-[2.5rem] border border-gray-200 dark:border-white/5 p-6 md:p-8 h-full shadow-inner flex flex-col transition-colors">
                                <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-widest text-sm flex items-center gap-3 mb-6 border-b border-gray-200 dark:border-white/10 pb-4 shrink-0"><Clock className="text-blue-500 dark:text-blue-400" size={20} /> Other Payments History</h4>

                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {(() => {
                                        const allStudentPays = studentActionModal.allPayments || [];
                                        const actionableStatuses = ['Pending', 'Upcoming', 'Post Pay'];
                                        
                                        const rightSidePayments = allStudentPays.filter(p => !actionableStatuses.includes(p.status));
                                        const filteredHistory = historyTab === 'All' ? rightSidePayments : rightSidePayments.filter(p => p.status === historyTab);

                                        return (
                                            <div className="flex flex-col h-full overflow-hidden">
                                                {/* Tabs for Categories */}
                                                <div className="flex gap-2 overflow-x-auto pb-4 mb-2 custom-scrollbar shrink-0">
                                                    {['All', 'Approved', 'Rejected', 'Pending', 'Upcoming', 'Free Card', 'Discount', 'Trash'].map(tab => {
                                                        const count = tab === 'All' ? rightSidePayments.length : rightSidePayments.filter(p => p.status === tab).length;
                                                        if (count === 0 && tab !== 'All') return null;
                                                        return (
                                                            <button key={tab} onClick={() => setHistoryTab(tab)} className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all whitespace-nowrap shadow-sm border ${historyTab === tab ? 'bg-blue-500 dark:bg-blue-600 text-white border-blue-600 dark:border-blue-500' : 'bg-white dark:bg-white/5 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                                                                {tab} ({count})
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="space-y-4 overflow-y-auto pr-2 pb-10 custom-scrollbar flex-1">
                                                    {filteredHistory.length === 0 ? (
                                                        <div className="h-full flex items-center justify-center pb-10">
                                                            <p className="text-sm text-gray-500 dark:text-slate-500 font-extrabold bg-white dark:bg-white/5 px-6 py-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center uppercase tracking-widest">No payments found in this category.</p>
                                                        </div>
                                                    ) : filteredHistory.map(hist => {
                                                        const isExpanded = expandedHistoryId === hist.id;
                                                        return (
                                                            <div key={hist.id} className="transition-all duration-300">
                                                                {/* COMPACT VIEW (Header) */}
                                                                <div 
                                                                    onClick={() => setExpandedHistoryId(isExpanded ? null : hist.id)}
                                                                    className={`bg-white dark:bg-white/5 rounded-2xl p-5 border cursor-pointer transition-all shadow-sm hover:shadow-md relative group/hist flex justify-between items-center gap-4 ${isExpanded ? 'border-brand-accent dark:border-blue-500 ring-2 ring-brand-accent/20 dark:ring-blue-500/20' : hist.status === 'Trash' ? 'border-red-200 dark:border-red-500/30 opacity-70' : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'}`}
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${['Approved', 'Free Card', 'Discount'].includes(hist.status) ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : hist.status === 'Trash' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20' : hist.status === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20' : 'bg-gray-100 dark:bg-slate-500/10 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-500/20'}`}>{hist.status}</span>
                                                                            <span className="text-[10px] text-gray-600 dark:text-slate-300 font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-2 py-1 rounded border border-gray-200 dark:border-white/10" title="Payment Date">Paid: {hist.date}</span>
                                                                            {hist.actionDate && hist.actionDate !== '-' && (
                                                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/20" title="Action Date">Action: {hist.actionDate}</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate mb-3">{hist.business}</p>
                                                                        
                                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                            <span className="text-red-500 text-[10px] font-mono font-black bg-red-50 dark:bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">ID: {hist.id}</span>
                                                                            {hist.classType === 2 ? (
                                                                                <span className="text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                                                                    📝 Paper Class
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-500/40 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                                                                    📘 Theory
                                                                                </span>
                                                                            )}
                                                                            <span className="text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                                                {hist.batch}
                                                                            </span>
                                                                            <span className="text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                                                {hist.type} {hist.groupName ? `- ${hist.groupName}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                                        <span className="font-black text-gray-900 dark:text-white text-lg">LKR {parseFloat(hist.amount).toLocaleString()}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            {hist.status !== 'Approved' && hist.status !== 'Trash' && (
                                                                                <button onClick={(e) => { e.stopPropagation(); setSelectedPaymentId(hist.id); }} className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:text-white dark:hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 uppercase tracking-widest cursor-pointer bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors outline-none shadow-sm">
                                                                                    Review
                                                                                </button>
                                                                            )}
                                                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-slate-400 group-hover/hist:bg-gray-200 dark:group-hover/hist:bg-white/10 transition-colors shadow-sm">
                                                                                <ChevronRight size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* EXPANDED VIEW */}
                                                                {isExpanded && (
                                                                    <div className="mt-3 animate-fade-in pl-4 border-l-2 border-brand-accent dark:border-blue-500 ml-4 relative">
                                                                        {/* Embed the full renderPaymentCard component inside */}
                                                                        <div className="scale-[0.98] origin-top-left w-[102%]">
                                                                            {renderPaymentCard(hist)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* 🔥 VERIFY AMOUNT MODAL (OVER/UNDER PAY OPTION) 🔥 */}
            {approveModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3"><CheckCircle2 className="text-emerald-600 dark:text-emerald-500" size={24} /> Verify Payment</h3>
                            <button onClick={() => setApproveModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none"><CloseIcon size={20} /></button>
                        </div>

                        <div className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 text-center shadow-sm">
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold uppercase tracking-widest mb-1.5">Expected Amount</p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">LKR {parseFloat(approveModal.payment.amount || 0).toLocaleString()}</p>
                        </div>

                        {/* 🔥 Actual Amount Paid Field 🔥 */}
                        <div className="mb-6">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block">Actual Amount Paid (LKR)</label>
                            <input
                                type="number"
                                value={actualAmount}
                                onChange={e => setActualAmount(e.target.value)}
                                className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white font-extrabold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-xl text-center shadow-sm transition-colors"
                                placeholder="Enter actual slip amount"
                            />
                            <p className="text-[10px] text-orange-700 dark:text-orange-400/90 mt-3 text-center bg-orange-50 dark:bg-orange-500/10 p-2 rounded-lg border border-orange-200 dark:border-orange-500/20 font-bold leading-relaxed shadow-sm">
                                ⚠️ If you enter a different amount, the system will automatically adjust the student's Wallet (Due/Excess).
                            </p>
                        </div>

                        <div className="mb-8">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block">Admin Remark (Optional)</label>
                            <textarea
                                value={actionRemark}
                                onChange={e => setActionRemark(e.target.value)}
                                placeholder="Any internal notes?" rows="3"
                                className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors resize-none shadow-sm"
                            ></textarea>
                        </div>

                        <button disabled={actioningPaymentId !== null} onClick={submitApprove} className="w-full font-extrabold py-4 rounded-xl transition-transform hover:scale-[1.02] text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30 dark:shadow-none outline-none border border-transparent dark:border-emerald-500/50">
                            {actioningPaymentId !== null ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                            Confirm Approve {approveModal.isSelfPicked && '(Self-Picked)'}
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {advancedActionModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                {advancedActionModal.type === 'Discount' && <><Tag className="text-cyan-600 dark:text-cyan-400" size={24} /> Set Custom Prices</>}
                                {advancedActionModal.type === 'FreeCard' && <><Gift className="text-yellow-500 dark:text-yellow-400" size={24} /> Grant Free Card</>}
                                {advancedActionModal.type === 'PostPay' && <><Unlock className="text-orange-600 dark:text-orange-400" size={24} /> Grant Post Pay</>}
                            </h3>
                            <button onClick={() => setAdvancedActionModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none"><CloseIcon size={20} /></button>
                        </div>

                        {advancedActionModal.type === 'Discount' && (
                            <div className="space-y-4 mb-8">
                                <p className="text-xs text-gray-500 dark:text-slate-400 font-extrabold uppercase tracking-widest bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm inline-block">Subject Breakdown</p>
                                <div className="space-y-3">
                                    {advancedActionModal.payment.subjectsList.map(sub => (
                                        <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-black/20 p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm gap-4">
                                            <div className="flex-1 pr-4 overflow-hidden">
                                                <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate" title={sub.name}>{sub.name}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">System: LKR {parseFloat(sub.price).toLocaleString()}</p>
                                            </div>
                                            <div className="w-full sm:w-1/3 relative shrink-0">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 dark:text-slate-500 font-black">LKR</span>
                                                <input type="number" value={customPrices[sub.id] || ''} onChange={e => handleCustomPriceChange(sub.id, e.target.value)} className="w-full bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl pl-10 pr-3 py-3 text-sm text-gray-900 dark:text-white font-extrabold outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors shadow-sm" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-4 px-2 border-t border-gray-200 dark:border-white/10 mt-6">
                                    <span className="text-gray-600 dark:text-slate-400 text-sm font-extrabold uppercase tracking-widest">Calculated Total:</span>
                                    <span className="text-cyan-600 dark:text-cyan-400 text-2xl font-black tracking-tight">
                                        LKR {Object.values(customPrices).reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {advancedActionModal.type === 'PostPay' && (
                            <div className="mb-8 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-6 rounded-2xl text-center shadow-sm">
                                <AlertCircle size={40} className="text-orange-500 dark:text-orange-400 mx-auto mb-4" />
                                <p className="text-sm text-gray-900 dark:text-white font-extrabold">This will grant the student 7 days of temporary access.</p>
                                <p className="text-xs text-gray-600 dark:text-slate-400 mt-2 font-bold leading-relaxed">After 7 days, if the slip is not approved, access will be automatically revoked.</p>
                            </div>
                        )}

                        {(advancedActionModal.type === 'Discount' || advancedActionModal.type === 'FreeCard') && (
                            <div className="mb-8">
                                <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block flex items-center gap-1">Admin Remark <span className="text-red-500">*</span></label>
                                <textarea value={actionRemark} onChange={e => setActionRemark(e.target.value)} placeholder="Why are you giving this discount/free card?" rows="4" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors resize-none shadow-sm"></textarea>
                            </div>
                        )}

                        <button disabled={actioningPaymentId !== null} onClick={submitAdvancedAction} className={`w-full font-extrabold py-4 rounded-xl transition-transform hover:scale-[1.02] text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg outline-none border border-transparent ${advancedActionModal.type === 'Discount' ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/30 dark:shadow-none dark:border-cyan-500/50' : advancedActionModal.type === 'FreeCard' ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/30 dark:shadow-none dark:border-yellow-500/50' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/30 dark:shadow-none dark:border-orange-500/50'}`}>
                            {actioningPaymentId !== null ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                            Confirm {advancedActionModal.type === 'Discount' ? 'Custom Approval' : advancedActionModal.type === 'FreeCard' ? 'Free Card' : '7 Days Temp Unlock'}
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 INSTITUTE PAYMENT OPTION MODAL 🔥 */}
            {institutePaymentModal && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm p-4 overflow-hidden animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3"><CheckCircle2 className="text-indigo-600 dark:text-indigo-500" size={24} /> Institute Payment</h3>
                            <button onClick={() => setInstitutePaymentModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none"><CloseIcon size={20} /></button>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-slate-300 mb-8 font-bold text-center bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">How should the tutes be handled for this student?</p>

                        <div className="flex flex-col gap-4">
                            <button disabled={actioningPaymentId !== null} onClick={() => handleInstituteApprove(true)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 rounded-xl transition-transform hover:scale-[1.02] text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 dark:shadow-none border border-transparent dark:border-emerald-500/50 flex justify-center items-center gap-3 outline-none">
                                {actioningPaymentId !== null ? <Loader2 className="animate-spin" size={20} /> : <User size={20} />} Self Picked (No Delivery)
                            </button>

                            <button disabled={actioningPaymentId !== null} onClick={() => handleInstituteApprove(false)} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-4 rounded-xl transition-transform hover:scale-[1.02] text-xs uppercase tracking-widest shadow-lg shadow-purple-500/30 dark:shadow-none border border-transparent dark:border-purple-500/50 flex justify-center items-center gap-3 outline-none">
                                {actioningPaymentId !== null ? <Loader2 className="animate-spin" size={20} /> : <Truck size={20} />} Send to Delivery Hub
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 Installment Verify Modal with Actual Amount 🔥 */}
            {installmentModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <form onSubmit={handleInstallmentApprove} className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3"><CheckCircle2 className="text-emerald-600 dark:text-emerald-500" size={24} /> Verify Installment</h3>
                            <button type="button" onClick={() => setInstallmentModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none"><CloseIcon size={20} /></button>
                        </div>

                        <div className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 text-center shadow-sm">
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold uppercase tracking-widest mb-1.5">Expected Installment</p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">LKR {parseFloat(installmentModal.payment.amount || 0).toLocaleString()}</p>
                        </div>

                        <div className="mb-6">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block">Actual Amount Paid (LKR)</label>
                            <input
                                type="number"
                                value={actualAmount}
                                onChange={e => setActualAmount(e.target.value)}
                                className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white font-extrabold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 text-center text-xl shadow-sm transition-colors"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block">Next Phase Due Date</label>
                            <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} required className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white font-bold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 shadow-sm transition-colors cursor-pointer" />
                        </div>

                        <div className="mb-8">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5 block flex items-center gap-1">Admin Remark (Optional)</label>
                            <textarea
                                value={actionRemark}
                                onChange={e => setActionRemark(e.target.value)}
                                placeholder="Any notes?" rows="3"
                                className="w-full bg-white dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors resize-none shadow-sm"
                            ></textarea>
                        </div>

                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-4 text-sm tracking-widest uppercase font-extrabold transition-transform hover:scale-[1.02] shadow-lg shadow-emerald-500/30 dark:shadow-none border border-transparent dark:border-emerald-500/50 flex justify-center items-center gap-3 outline-none">
                            <Check size={20} /> Confirm Installment
                        </button>
                    </form>
                </div>,
                document.body
            )}

            {/* 🔥 MANUAL DISPATCH SUBJECT SELECTION MODAL 🔥 */}
            {sendToDeliveryModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-white/10 pb-4">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3"><Truck className="text-purple-600 dark:text-purple-400" size={24} /> Dispatch to Delivery</h3>
                            <button type="button" onClick={() => setSendToDeliveryModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none"><CloseIcon size={20} /></button>
                        </div>

                        <div className="mb-6 bg-purple-50 dark:bg-purple-600/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl p-4 text-center">
                            <p className="text-[10px] text-purple-700 dark:text-purple-400 font-extrabold uppercase tracking-widest mb-1.5">Student</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                                {sendToDeliveryModal.studentName || 
                                 (sendToDeliveryModal.student?.firstName ? `${sendToDeliveryModal.student.firstName} ${sendToDeliveryModal.student.lastName || ''}` : `STU-${sendToDeliveryModal.studentId}`)}
                            </p>
                            <span className="bg-purple-100 dark:bg-purple-500/25 text-purple-700 dark:text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-md mt-2 inline-block border border-purple-200 dark:border-purple-500/30 uppercase tracking-widest">STU-{sendToDeliveryModal.studentId}</span>
                        </div>

                        <div className="mb-6">
                            <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-3 block">Select Subjects to Dispatch</label>
                            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                {(sendToDeliveryModal.subjectsList || sendToDeliveryModal.subjects || sendToDeliveryModal.courses || []).map((sub) => {
                                    const subIdStr = String(sub.id || sub.course_id);
                                    const isChecked = deliverySelectedSubjects.includes(subIdStr);
                                    return (
                                        <label
                                            key={subIdStr}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                isChecked
                                                    ? 'bg-purple-50/50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/40 text-gray-900 dark:text-white'
                                                    : 'bg-transparent border-gray-200 dark:border-white/5 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/10'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    setDeliverySelectedSubjects(prev =>
                                                        isChecked
                                                            ? prev.filter(id => id !== subIdStr)
                                                            : [...prev, subIdStr]
                                                    );
                                                }}
                                                className="rounded border-gray-300 dark:border-white/10 text-purple-600 focus:ring-purple-500 h-4 w-4 bg-transparent cursor-pointer"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{sub.name}</p>
                                                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{sub.code}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            disabled={actioningPaymentId !== null}
                            onClick={submitSendToDelivery}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-4 text-sm tracking-widest uppercase font-extrabold transition-all shadow-lg shadow-purple-500/30 dark:shadow-none border border-transparent dark:border-purple-500/50 flex justify-center items-center gap-3 outline-none"
                        >
                            {actioningPaymentId !== null ? <Loader2 className="animate-spin" size={20} /> : <Truck size={20} />}
                            Dispatch to Delivery Hub
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 EDIT PAYMENT DETAILS MODAL (PREMIUM LANDSCAPE LAYOUT) 🔥 */}
            {editModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white dark:bg-[#0b1329] border border-gray-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-6xl shadow-2xl transition-all flex flex-col max-h-[92vh] overflow-hidden">
                        
                        {/* Modal Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-200 dark:border-white/10 pb-5 shrink-0">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                    <Edit3 className="text-indigo-500 dark:text-indigo-400 animate-pulse" size={26} /> 
                                    Edit Payment Details
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400">Modify assigned courses, custom pricing, and transaction matching.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-2xl border border-gray-200 dark:border-white/5">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                    <User size={14} className="text-indigo-500" />
                                    <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{editModal.studentName}</span>
                                    <span className="text-[10px] font-black text-indigo-400">({editModal.studentNo})</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Batch</span>
                                    <span className="text-xs font-bold text-gray-700 dark:text-slate-200 max-w-[200px] truncate">{editModal.batch}</span>
                                </div>
                                {editModal && (
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${editModal.classType === 2 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400' : 'bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-wider">Class</span>
                                        <span className="text-xs font-bold">{editModal.classType === 2 ? '📝 Paper Class' : '📘 Theory Class'}</span>
                                    </div>
                                )}
                                {editModal.business && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Business</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{editModal.business}</span>
                                    </div>
                                )}
                                {editModal.groupName && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                        <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">Group</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{editModal.groupName}</span>
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={() => setEditModal(null)} className="text-gray-400 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-white/10 p-2.5 rounded-xl transition-all border border-gray-200 dark:border-transparent outline-none">
                                <CloseIcon size={22} />
                            </button>
                        </div>

                        {/* Modal Content - Landscape Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden min-h-0">
                            
                            {/* Left Panel: Autocomplete Subject Adder & Total Financial Calculations (5/12 cols) */}
                            <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                                
                                {/* Autocomplete Search Dropdown */}
                                <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-3xl border border-gray-200/50 dark:border-white/5 relative">
                                    <label className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3 block">Search & Add Additional Subjects</label>
                                    
                                    <div className="relative">
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={subjectSearchQuery}
                                                onFocus={() => setIsSubjectDropdownOpen(true)}
                                                onChange={e => {
                                                    setSubjectSearchQuery(e.target.value);
                                                    setIsSubjectDropdownOpen(true);
                                                }}
                                                placeholder="Search subject by name or code..."
                                                className="w-full bg-white dark:bg-black/40 border-2 border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-900 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-medium pl-9 shadow-sm transition-all"
                                            />
                                            <Search className="absolute left-3 text-gray-400 dark:text-slate-500" size={15} />
                                            {subjectSearchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSubjectSearchQuery('')}
                                                    className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                                >
                                                    <CloseIcon size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown overlay panel */}
                                        {isSubjectDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[1000]" onClick={() => setIsSubjectDropdownOpen(false)} />
                                                <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/15 rounded-2xl shadow-2xl z-[1001] custom-scrollbar divide-y divide-gray-100 dark:divide-white/5 overflow-hidden animate-slide-down">
                                                    {(() => {
                                                        const payBiz = editModal.business?.toLowerCase().trim() || '';
                                                        const filtered = allCourses.filter(c => {
                                                            const cStream = c.stream?.toLowerCase().trim() || c.streams?.toLowerCase().trim() || '';
                                                            const isBizMatch = !payBiz || !cStream || cStream.includes(payBiz) || payBiz.includes(cStream) || String(c.groupId) === String(editModal.groupId);
                                                            const isNotAdded = !editSubjectsList.some(s => s.id === c.id);
                                                            
                                                            if (!isBizMatch || !isNotAdded) return false;
                                                            
                                                            if (!subjectSearchQuery) return true;
                                                            const query = subjectSearchQuery.toLowerCase();
                                                            return c.name.toLowerCase().includes(query) || (c.code && c.code.toLowerCase().includes(query));
                                                        });

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <div className="p-4 text-xs text-gray-400 dark:text-slate-500 italic text-center">
                                                                    No matching subjects found
                                                                </div>
                                                            );
                                                        }

                                                        return filtered.map(c => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditSubjectsList([...editSubjectsList, {
                                                                        id: c.id,
                                                                        name: c.name,
                                                                        code: c.code || 'N/A',
                                                                        price: parseFloat(c.price || 0)
                                                                    }]);
                                                                    setSubjectSearchQuery('');
                                                                    setIsSubjectDropdownOpen(false);
                                                                    toast.success(`Added ${c.name}`);
                                                                }}
                                                                className="w-full text-left p-3.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between transition-all outline-none"
                                                            >
                                                                <div className="flex flex-col min-w-0 pr-4">
                                                                    <span className="font-extrabold text-gray-800 dark:text-white truncate">{c.name}</span>
                                                                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">Code: {c.code || 'N/A'}</span>
                                                                </div>
                                                                <span className="shrink-0 text-[10px] font-black text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">LKR {parseFloat(c.price || 0).toLocaleString()}</span>
                                                            </button>
                                                        ));
                                                    })()}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Financial Calculations Panel */}
                                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-slate-900/30 dark:to-indigo-950/20 p-5 rounded-3xl border border-indigo-100 dark:border-white/5 shadow-sm">
                                    <h4 className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-4">Financial Math Overview</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white/60 dark:bg-black/30 border border-gray-200/50 dark:border-white/5 rounded-2xl p-3.5 shadow-sm">
                                            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-extrabold uppercase tracking-wide block mb-1">Expected Sum</span>
                                            <span className="text-base font-black text-gray-900 dark:text-white">LKR {editSubjectsList.reduce((sum, s) => sum + parseFloat(s.price || 0), 0).toLocaleString()}</span>
                                        </div>
                                        <div className="bg-white/60 dark:bg-black/30 border border-gray-200/50 dark:border-white/5 rounded-2xl p-3.5 relative overflow-hidden group shadow-sm">
                                            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-extrabold uppercase tracking-wide block mb-1">Paid Amount</span>
                                            <span className="text-base font-black text-gray-900 dark:text-white">LKR {parseFloat(editAmount || 0).toLocaleString()}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const expectedTotal = editSubjectsList.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
                                                    setEditAmount(expectedTotal);
                                                    toast.success("Amount matched to expected sum!");
                                                }}
                                                className="absolute right-2 top-2 p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity border border-indigo-500/20 outline-none"
                                                title="Match Expected Sum"
                                            >
                                                Match
                                            </button>
                                        </div>
                                    </div>

                                    {/* Actual Paid Input Field */}
                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Edit Actual Paid Amount (LKR)</label>
                                        <div className="relative flex items-center bg-white dark:bg-black/50 border-2 border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3.5 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors shadow-sm gap-2">
                                            <span className="text-sm font-black text-slate-400 dark:text-slate-500 select-none">LKR</span>
                                            <input
                                                type="number"
                                                value={editAmount}
                                                onChange={e => setEditAmount(e.target.value)}
                                                className="w-full bg-transparent border-none text-left outline-none text-xl font-black text-gray-900 dark:text-white tracking-tight"
                                                placeholder="0"
                                            />
                                            {/* Quick Math Adjusters */}
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseFloat(editAmount || 0);
                                                        setEditAmount(Math.max(0, cur - 1000));
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-all border border-gray-200 dark:border-white/5 outline-none"
                                                >
                                                    -1k
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseFloat(editAmount || 0);
                                                        setEditAmount(cur + 1000);
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-all border border-gray-200 dark:border-white/5 outline-none"
                                                >
                                                    +1k
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const expectedTotal = editSubjectsList.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
                                                        setEditAmount(expectedTotal);
                                                    }}
                                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all outline-none"
                                                >
                                                    Match
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Wallet calculations */}
                                    {(() => {
                                        const expectedTotal = editSubjectsList.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
                                        const diff = parseFloat(editAmount || 0) - expectedTotal;
                                        if (diff > 0) {
                                            return (
                                                <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-center shadow-inner flex items-center justify-center gap-2">
                                                    <Wallet size={14} className="animate-bounce" />
                                                    <span>Excess: +LKR {diff.toLocaleString()} will credit to wallet.</span>
                                                </div>
                                            );
                                        } else if (diff < 0) {
                                            return (
                                                <div className="text-xs font-extrabold text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20 text-center shadow-inner flex items-center justify-center gap-2">
                                                    <AlertCircle size={14} className="animate-pulse" />
                                                    <span>Arrears: -LKR {Math.abs(diff).toLocaleString()} short will record as arrears.</span>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 text-center shadow-inner flex items-center justify-center gap-2">
                                                    <ShieldCheck size={14} />
                                                    <span>Perfect Match! Paid amount equals Expected Sum.</span>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={handleSavePaymentDetails}
                                    disabled={savingEdit}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-2xl py-4 text-sm tracking-widest uppercase font-extrabold transition-all hover:scale-[1.01] shadow-lg shadow-indigo-600/20 dark:shadow-none flex justify-center items-center gap-3 outline-none shrink-0"
                                >
                                    {savingEdit ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} Save Changes
                                </button>
							</div>

                            {/* Right Panel: Spacious Scrollable Active Subjects List (7/12 cols) */}
                            <div className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden border-l border-gray-100 dark:border-white/5 lg:pl-8">
                                <div className="flex justify-between items-center mb-4 shrink-0">
                                    <div className="flex flex-col gap-0.5">
                                        <h4 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">Active Subjects List</h4>
                                        <p className="text-[10px] text-gray-400">Manage individual pricing or remove subjects from this payment card.</p>
                                    </div>
                                    <span className="bg-slate-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 text-[10px] px-2.5 py-1 rounded-md font-bold shrink-0">{editSubjectsList.length} subjects</span>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-0">
                                    {editSubjectsList.map(course => (
                                        <div
                                            key={course.id}
                                            className="p-4 rounded-2xl border bg-gray-50/50 dark:bg-black/20 border-gray-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-gray-300 dark:hover:border-white/10 transition-all duration-200 group shadow-sm"
                                        >
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-sm font-black text-gray-800 dark:text-white truncate" title={course.name}>{course.name}</span>
                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-extrabold mt-0.5 uppercase tracking-wider">Code: {course.code || 'N/A'}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                                                {/* Price Input Wrapper */}
                                                <div className="flex items-center bg-white dark:bg-[#0f172a] border-2 border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 max-w-[150px] sm:max-w-[160px] w-full shadow-sm focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-2 font-black select-none">LKR</span>
                                                    <input
                                                        type="number"
                                                        value={course.price}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setEditSubjectsList(editSubjectsList.map(s => s.id === course.id ? { ...s, price: val } : s));
                                                        }}
                                                        className="w-full bg-transparent border-none text-right outline-none text-sm font-black text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                
                                                {/* Quick Adjust Buttons */}
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const cur = parseFloat(course.price || 0);
                                                            const newVal = Math.max(0, cur - 500);
                                                            setEditSubjectsList(editSubjectsList.map(s => s.id === course.id ? { ...s, price: newVal } : s));
                                                        }}
                                                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-gray-200 dark:border-white/5 transition-all outline-none"
                                                        title="Decrease by LKR 500"
                                                    >
                                                        -500
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const cur = parseFloat(course.price || 0);
                                                            const newVal = cur + 500;
                                                            setEditSubjectsList(editSubjectsList.map(s => s.id === course.id ? { ...s, price: newVal } : s));
                                                        }}
                                                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-gray-200 dark:border-white/5 transition-all outline-none"
                                                        title="Increase by LKR 500"
                                                    >
                                                        +500
                                                    </button>
                                                </div>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditSubjectsList(editSubjectsList.filter(s => s.id !== course.id));
                                                        toast.success(`Removed ${course.name}`);
                                                    }}
                                                    className="p-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 dark:border-red-500/20 rounded-xl transition-all outline-none sm:ml-1 shrink-0"
                                                    title="Remove Subject"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {editSubjectsList.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl text-slate-400 dark:text-slate-500 italic gap-3 bg-slate-50/20 dark:bg-black/10">
                                            <AlertCircle size={36} className="opacity-30 text-indigo-500" />
                                            <span className="text-sm font-semibold">No subjects assigned to this payment sheet.</span>
                                            <span className="text-xs text-gray-400 not-italic">Search & add courses from the sidebar menu to get started.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showStaffModal && (
                <StaffPerformanceModal
                    onClose={() => setShowStaffModal(false)}
                />
            )}

            {showExportModal && (
                <ExportReportModal 
                    onClose={() => {
                        setShowExportModal(false);
                        setExportClassTypeOverride(null);
                    }}
                    payments={payments}
                    filters={exportClassTypeOverride ? { ...filters, classType: exportClassTypeOverride } : filters}
                    businesses={businesses}
                    batches={batches}
                />
            )}

                </>
            )}

            {/* Ghost Login Iframe Overlay */}
            {ghostIframe && createPortal(
                <div className="fixed inset-0 z-[999999] bg-black">
                    <div className="h-14 bg-slate-900 flex items-center justify-between px-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-white font-bold tracking-widest text-sm uppercase">Ghost Session Active</span>
                        </div>
                        <button onClick={closeGhostLogin} className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                            End Session
                        </button>
                    </div>
                    <div className="h-[calc(100vh-3.5rem)] w-full">
                        <iframe src={ghostIframe} className="w-full h-full border-none" title="Ghost Login View"></iframe>
                    </div>
                </div>,
                document.body
            )}

            {/* Password Modal for AI Verification */}
            {showPasswordModal && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                <ShieldCheck className="text-emerald-500" size={24} /> Security Check
                            </h3>
                            <button onClick={() => { setShowPasswordModal(false); setVerificationPassword(''); }} className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-white/5 p-2 rounded-xl transition-all outline-none"><CloseIcon size={20} /></button>
                        </div>
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="mb-6">
                                <label className="text-xs text-gray-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2 block">Enter Password</label>
                                <input
                                    type="password"
                                    value={verificationPassword}
                                    onChange={e => setVerificationPassword(e.target.value)}
                                    placeholder="Password..."
                                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-300 dark:border-white/10 rounded-xl p-4 text-gray-900 dark:text-white font-extrabold outline-none focus:border-emerald-500 text-center shadow-sm"
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-4 text-sm tracking-widest uppercase font-extrabold transition-transform hover:scale-[1.02] shadow-lg outline-none">
                                Unlock AI Mode
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
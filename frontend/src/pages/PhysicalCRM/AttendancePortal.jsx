import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from '../../api/axios';
import physicalCrmService from '../../api/physicalCrm';
import { 
  User, CheckCircle, XCircle, Search, ToggleLeft, ToggleRight, 
  CalendarDays, BookOpen, Save, ChevronLeft, ChevronRight, ChevronDown,
  History, X, Clock, DollarSign, CreditCard, Check, Printer,
  Calendar as CalendarIcon, AlertCircle, Phone, Shield, Sparkles,
  Trash2, Plus, ArrowRight, CheckCircle2, TrendingUp, Receipt,
  Columns, LayoutGrid, CalendarCheck, UserCheck, Eye, Building2, Zap, Lock, RotateCcw, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import ThermalReceiptModal from '../../components/PhysicalCRM/ThermalReceiptModal';
import StudentDetailModal from '../../components/PhysicalCRM/StudentDetailModal';
import { printThermalReceipt } from '../../utils/thermalReceiptPrinter';



export default function AttendancePortal() {
    const [searchParams] = useSearchParams();
    const [scanInput, setScanInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const [autoMark, setAutoMark] = useState(false);
    const [studentData, setStudentData] = useState(null);
    const [attendances, setAttendances] = useState([]);
    const [feePayments, setFeePayments] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [activeSessionClassId, setActiveSessionClassId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedCardType, setSelectedCardType] = useState('FULL');
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
    const classDropdownRef = useRef(null);
    const [loading, setLoading] = useState(false);

    // View Mode Switcher: 'dual' (Side-by-Side No-Scroll), 'classes', or 'calendar'
    const [activeViewMode, setActiveViewMode] = useState('dual');

    // Active Month Navigation State (Syncs with both Calendar and Class Cards)
    const [viewMonth, setViewMonth] = useState(new Date());
    
    // Overall Attendance History Modal
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Thermal Receipt Modal State
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [currentReceiptData, setCurrentReceiptData] = useState(null);
    const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);

    // Full Student Report Modal State
    const [isStudentReportModalOpen, setIsStudentReportModalOpen] = useState(false);

    // Per-Class Monthly History Modal State
    const [classHistoryModal, setClassHistoryModal] = useState({
        isOpen: false,
        classObj: null,
        year: new Date().getFullYear()
    });

    // Move Accidental Payment Month Modal State
    const [moveMonthModal, setMoveMonthModal] = useState({
        isOpen: false,
        classObj: null,
        currentMonth: '',
        targetMonth: '',
        pRecord: null,
        loading: false
    });

    // Custom / Partial Payment Modal State
    const [customPayModal, setCustomPayModal] = useState({
        isOpen: false,
        classObj: null,
        monthStr: '',
        amount: '',
        isIncremental: false,
        paymentMethod: 'CASH',
        remark: ''
    });

    // Quick Card / RFID Allocation Modal State
    const [cardScanModal, setCardScanModal] = useState({
        isOpen: false,
        inputRfid: '',
        loading: false
    });

    // Multi-Class Batch Payment State
    const [selectedClassIdsForMultiPay, setSelectedClassIdsForMultiPay] = useState([]);
    const [multiPayModal, setMultiPayModal] = useState({
        isOpen: false,
        monthStr: '',
        paymentMethod: 'CASH',
        remark: '',
        items: [],
        loading: false
    });
    const [multiPayLoading, setMultiPayLoading] = useState(false);

    // Helper: Get logged in CRM cashier name
    const getCurrentCashierName = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Cashier / Admin';
        } catch {
            return 'Cashier / Admin';
        }
    };



    // Scanner logic
    const scanBuffer = useRef('');
    const scanTimeout = useRef(null);
    const autoMarkRef = useRef(autoMark);
    const activeSessionClassIdRef = useRef(activeSessionClassId);

    useEffect(() => {
        autoMarkRef.current = autoMark;
    }, [autoMark]);

    useEffect(() => {
        activeSessionClassIdRef.current = activeSessionClassId;
    }, [activeSessionClassId]);

    // Load available physical classes initially on mount
    useEffect(() => {
        const loadInitialClasses = async () => {
            try {
                const cls = await physicalCrmService.getClasses();
                if (cls && Array.isArray(cls)) {
                    setAvailableClasses(cls);
                }
            } catch (err) {
                console.error('Failed to load initial physical classes:', err);
            }
        };
        loadInitialClasses();
    }, []);

    // Close class dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (classDropdownRef.current && !classDropdownRef.current.contains(event.target)) {
                setIsClassDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter available classes by search input
    const filteredAvailableClasses = useMemo(() => {
        if (!classSearchTerm.trim()) return availableClasses;
        const term = classSearchTerm.toLowerCase();
        return availableClasses.filter(c => 
            c.name?.toLowerCase().includes(term) ||
            c.grade?.toLowerCase().includes(term) ||
            c.teachers?.some(t => t.name?.toLowerCase().includes(term)) ||
            String(c.monthlyFee).includes(term)
        );
    }, [availableClasses, classSearchTerm]);

    const currentSelectedClass = availableClasses.find(c => String(c.id) === String(selectedClassId));

    // Check for query parameter on mount/update to auto-load student
    useEffect(() => {
        const studentIdParam = searchParams.get('studentId') || searchParams.get('search');
        if (studentIdParam) {
            handleScan(studentIdParam);
        }
    }, [searchParams]);

    // Live search debouncer for Scanner / Search input
    useEffect(() => {
        if (!scanInput || scanInput.trim().length < 2) {
            setSearchResults([]);
            setShowSuggestions(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await axios.get(`/physical-crm/students-search?query=${encodeURIComponent(scanInput.trim())}`);
                if (res.data && res.data.students) {
                    setSearchResults(res.data.students);
                    setShowSuggestions(true);
                }
            } catch (err) {
                console.error('Error searching students:', err);
            } finally {
                setIsSearching(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [scanInput]);

    // Direct hardware scanner listener when focused outside input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.id !== 'hidden-scanner') return;

            if (e.key === 'Enter') {
                const scannedId = scanBuffer.current.trim();
                if (scannedId) {
                    handleScan(scannedId);
                }
                scanBuffer.current = '';
                return;
            }
            
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                scanBuffer.current += e.key;
                clearTimeout(scanTimeout.current);
                scanTimeout.current = setTimeout(() => {
                    scanBuffer.current = '';
                }, 100);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Sanitize URL/QR/JSON input from hardware scanners
    const sanitizeScanInput = (raw) => {
        if (!raw) return '';
        let str = String(raw).trim();
        if (str.startsWith('http://') || str.startsWith('https://')) {
            try {
                const u = new URL(str);
                const p = u.searchParams.get('studentId') || u.searchParams.get('search') || u.searchParams.get('id') || u.searchParams.get('rfid');
                if (p) return p.trim();
                const parts = u.pathname.split('/').filter(Boolean);
                if (parts.length > 0) return decodeURIComponent(parts[parts.length - 1]).trim();
            } catch {}
        }
        if (str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsed = JSON.parse(str);
                const val = parsed.studentId || parsed.id || parsed.rfid || parsed.card || parsed.code;
                if (val) return String(val).trim();
            } catch {}
        }
        return str;
    };

    const handleScan = async (studentIdentifier) => {
        const cleanId = sanitizeScanInput(studentIdentifier);
        if (!cleanId) return;
        setShowSuggestions(false);
        setLoading(true);
        try {
            const res = await axios.get(`/physical-crm/student-scan/${encodeURIComponent(cleanId)}`);
            const sData = res.data.student;
            const fPayments = res.data.feePayments || res.data.student?.feePayments || [];
            const enrolls = sData?.enrollments || [];

            setStudentData(sData);
            setAttendances(res.data.attendances || []);
            setFeePayments(fPayments);
            setAvailableClasses(res.data.availableClasses || []);

            const sName = sData.studentName || `${sData.firstName || ''} ${sData.lastName || ''}`.trim() || 'Student';

            if (autoMarkRef.current) {
                const targetClassId = activeSessionClassIdRef.current || (enrolls.length === 1 ? enrolls[0].classId : null);
                await markAttendance(sData.id, format(new Date(), 'yyyy-MM-dd'), targetClassId);
            } else {
                toast.success(`Loaded profile for ${sName}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Student not found');
            setStudentData(null);
            setAttendances([]);
            setFeePayments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAllocateCard = async (rfidToBind) => {
        if (!studentData) return;
        const cleanRfid = rfidToBind ? String(rfidToBind).trim() : '';
        try {
            setCardScanModal(prev => ({ ...prev, loading: true }));
            const res = await physicalCrmService.allocateCard(studentData.id, cleanRfid);
            toast.success(res.message || 'Card updated successfully!');
            setStudentData(res.student);
            setCardScanModal({ isOpen: false, inputRfid: '', loading: false });
        } catch (err) {
            console.error('Error allocating card:', err);
            toast.error(err.response?.data?.error || 'Failed to allocate card');
            setCardScanModal(prev => ({ ...prev, loading: false }));
        }
    };

    const markAttendance = async (studentInternalId, dateString = format(new Date(), 'yyyy-MM-dd'), specificClassId = null) => {
        try {
            const classToPass = specificClassId || activeSessionClassId || (studentData?.enrollments?.length === 1 ? studentData.enrollments[0].classId : null);
            const res = await axios.post('/physical-crm/attendance', {
                studentId: studentInternalId,
                date: dateString,
                classId: classToPass
            });

            const clsName = res.data?.className;
            if (clsName && clsName !== 'Class') {
                toast.success(`Attendance marked for ${clsName}! (SMS Alert Triggered)`, { icon: '✅' });
            } else {
                toast.success('Attendance marked successfully! (SMS Alert Triggered)', { icon: '✅' });
            }
            
            setAttendances(prev => {
                const newAtt = res.data.attendance;
                const existing = prev.findIndex(a => 
                    (a.id && a.id === newAtt.id) || 
                    (a.studentId === newAtt.studentId && String(a.classId) === String(newAtt.classId) && isSameDay(new Date(a.date), new Date(newAtt.date)))
                );
                if (existing >= 0) {
                    const copy = [...prev];
                    copy[existing] = newAtt;
                    return copy;
                }
                return [...prev, newAtt];
            });
        } catch (error) {
            toast.error('Failed to mark attendance');
        }
    };

    const unmarkAttendance = async (studentInternalId, dateString, classId = null) => {
        try {
            await axios.post('/physical-crm/attendance/unmark', {
                studentId: studentInternalId,
                date: dateString,
                classId: classId
            });
            toast.success('Attendance unmarked!');
            setAttendances(prev => prev.filter(a => {
                if (a.studentId !== studentInternalId || !isSameDay(new Date(a.date), new Date(dateString))) return true;
                if (classId && a.classId && String(a.classId) !== String(classId)) return true;
                return false;
            }));
        } catch (error) {
            toast.error('Failed to unmark attendance');
        }
    };

    // Quick toggle today's attendance directly from student profile
    const isPresentToday = useMemo(() => {
        if (!studentData) return false;
        if (activeSessionClassId) {
            return attendances.some(a => 
                isToday(new Date(a.date)) && 
                a.status === 'PRESENT' && 
                String(a.classId) === String(activeSessionClassId)
            );
        }
        return attendances.some(a => isToday(new Date(a.date)) && a.status === 'PRESENT');
    }, [studentData, attendances, activeSessionClassId]);

    const handleToggleTodayAttendance = (specificClassId = null) => {
        if (!studentData) return;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const targetClass = specificClassId || activeSessionClassId || (studentEnrolledClasses.length === 1 ? studentEnrolledClasses[0].id : null);
        
        const isClassMarked = targetClass 
            ? attendances.some(a => isToday(new Date(a.date)) && a.status === 'PRESENT' && String(a.classId) === String(targetClass))
            : isPresentToday;

        if (isClassMarked) {
            unmarkAttendance(studentData.id, todayStr, targetClass);
        } else {
            markAttendance(studentData.id, todayStr, targetClass);
        }
    };

    // Update Card Type (Full / Half / Free) for a specific class
    const handleUpdateClassCardType = async (classId, newCardType) => {
        if (!studentData) return;
        try {
            const res = await physicalCrmService.allocateClass(studentData.id, {
                classId,
                cardType: newCardType
            });
            setStudentData(res.student);
            setFeePayments(res.student.feePayments || []);
            toast.success(`Updated class to ${newCardType} Card! Fee recalculated.`);
        } catch (err) {
            toast.error('Failed to update card type: ' + (err.response?.data?.error || err.message));
        }
    };

    // Allocate Class to student
    const allocateClass = async () => {
        if (!selectedClassId || !studentData) return;
        try {
            const res = await physicalCrmService.allocateClass(studentData.id, {
                classId: selectedClassId,
                cardType: selectedCardType
            });
            setStudentData(res.student);
            setFeePayments(res.student.feePayments || []);
            setSelectedClassId('');
            toast.success('Class allocated successfully!');
        } catch (error) {
            toast.error('Failed to allocate class: ' + (error.response?.data?.error || error.message));
        }
    };

    // Unallocate Class from student
    const unallocateClass = async (classId, className) => {
        if (!studentData) return;
        if (!window.confirm(`Are you sure you want to remove "${className}" from this student's allocated classes?`)) {
            return;
        }
        try {
            const res = await physicalCrmService.unallocateClass(studentData.id, classId);
            setStudentData(res.student);
            setFeePayments(res.student.feePayments || []);
            toast.success(`Removed "${className}" from allocated classes`);
        } catch (error) {
            toast.error('Failed to remove class: ' + (error.response?.data?.error || error.message));
        }
    };

    // Reverse Accidental / Future Month Fee Payment & cleanly adjust cashflow
    const handleReverseFeePayment = async (classId, monthStr) => {
        if (!studentData) return;
        const clsObj = studentEnrolledClasses.find(c => c.id === classId) || availableClasses.find(c => c.id === classId) || { name: 'Class' };
        if (!window.confirm(`⚠️ Reverse class fee payment for "${clsObj.name}" (${monthStr})?\n\nThis will revert this month's status to UNPAID and adjust the Cashflow balance.`)) {
            return;
        }
        try {
            const res = await physicalCrmService.reverseFeePayment({
                studentId: studentData.id,
                classId,
                month: monthStr,
                reason: 'Accidental/future month class fee entry reversed by staff'
            });
            toast.success(res.message || `Payment for ${monthStr} reversed successfully! Cashflow adjusted.`, { icon: '🔄' });
            handleScan(studentData.studentId || studentData.id);
        } catch (error) {
            console.error('Error reversing fee payment:', error);
            toast.error('Failed to reverse payment: ' + (error.response?.data?.error || error.message));
        }
    };

    // Move Accidental Fee Payment to another month cleanly
    const handleMoveFeePayment = async (classId, currentMonth, targetMonth) => {
        if (!studentData || !classId || !currentMonth || !targetMonth) return;
        try {
            setMoveMonthModal(prev => ({ ...prev, loading: true }));
            const res = await physicalCrmService.moveFeePaymentMonth({
                studentId: studentData.id,
                classId,
                currentMonth,
                targetMonth,
                reason: 'Accidental payment month moved by staff'
            });
            toast.success(res.message || `Payment moved to ${targetMonth}!`, { icon: '📅' });
            setMoveMonthModal({ isOpen: false, classObj: null, currentMonth: '', targetMonth: '', pRecord: null, loading: false });
            handleScan(studentData.studentId || studentData.id);
        } catch (error) {
            console.error('Error moving fee payment:', error);
            toast.error(error.response?.data?.error || error.message);
            setMoveMonthModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Toggle / Full Mark Class Fee Payment with 80mm Thermal Receipt (Instant Auto-Print)
    const handleClassFeePayment = async (classId, monthStr, currentStatus, optionalAmount = null) => {
        if (!studentData) return;

        const newStatus = (currentStatus === 'PAID' || currentStatus === 'FREE_CARD') ? 'PENDING' : 'PAID';
        try {
            const payload = {
                studentId: studentData.id,
                classId,
                month: monthStr,
                status: newStatus,
                paymentMethod: 'CASH'
            };
            if (optionalAmount !== null) {
                payload.amount = optionalAmount;
            }

            const res = await physicalCrmService.toggleFeePayment(payload);

            if (res.status === 'PENDING') {
                toast.success(`Payment for ${monthStr} reverted to UNPAID!`);
            } else {
                toast.success(`Class Fee updated (${res.status}) & logged in Cash Flow!`);
            }
            
            // If marked as PAID or PARTIAL, trigger 80mm thermal receipt
            if (res.status === 'PAID' || res.status === 'PARTIAL' || res.status === 'HALF_PAYMENT') {
                const targetCls = availableClasses.find(c => c.id === classId) || studentData.enrollments?.find(e => e.classId === classId)?.class || studentData.class;
                const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';
                const enr = studentData.enrollments?.find(e => e.classId === classId);
                const cType = enr?.cardType || studentData.cardType || 'FULL';

                const receiptObj = res.receiptData ? {
                    ...res.receiptData,
                    cashierName: getCurrentCashierName()
                } : {
                    receiptNo: res.transaction ? `REC-${res.transaction.id}` : `CF-${Date.now().toString().slice(-6)}`,
                    studentId: studentData.studentId,
                    studentName: sName,
                    guardianPhone: studentData.guardianPhone || studentData.phone || '',
                    className: targetCls?.name || 'Class Fee',
                    month: monthStr,
                    cardType: cType,
                    amount: res.paidAmount !== undefined ? res.paidAmount : res.payment?.amount || 0,
                    expectedFee: res.expectedFee || (targetCls?.monthlyFee || 0),
                    dueAmount: res.dueAmount || 0,
                    paidDate: new Date(),
                    status: res.status,
                    cashierName: getCurrentCashierName(),
                    items: [
                        {
                            description: targetCls?.name || 'Class',
                            month: monthStr,
                            cardType: cType,
                            amount: res.paidAmount || res.payment?.amount || 0,
                            expectedFee: res.expectedFee || (targetCls?.monthlyFee || 0),
                            dueAmount: res.dueAmount || 0
                        }
                    ],
                    totalAmount: res.paidAmount || res.payment?.amount || 0
                };

                setCurrentReceiptData(receiptObj);
                setReceiptModalOpen(true);

                // Instant Auto-Print to Xprinter XP-80C
                if (autoPrintReceipt) {
                    printThermalReceipt(receiptObj);
                }
            }

            // Reload student data
            handleScan(studentData.studentId || studentData.id);
        } catch (err) {
            toast.error('Failed to record class fee payment');
        }
    };

    // Submit Custom / Partial Payment (Instant Auto-Print)
    const handleCustomPaymentSubmit = async () => {
        if (!studentData || !customPayModal.classObj) return;
        const targetCls = customPayModal.classObj;
        const monthStr = customPayModal.monthStr || format(viewMonth, 'yyyy-MM');
        const payAmount = parseFloat(customPayModal.amount);

        if (isNaN(payAmount) || payAmount <= 0) {
            toast.error('Please enter a valid payment amount greater than 0');
            return;
        }

        try {
            const res = await physicalCrmService.toggleFeePayment({
                studentId: studentData.id,
                classId: targetCls.id,
                month: monthStr,
                status: 'PAID',
                amount: payAmount,
                isIncremental: customPayModal.isIncremental,
                paymentMethod: customPayModal.paymentMethod || 'CASH',
                remark: customPayModal.remark
            });

            toast.success(`Payment of Rs. ${payAmount.toLocaleString()} recorded as ${res.status}!`);
            
            // Close modal
            setCustomPayModal({ isOpen: false, classObj: null, monthStr: '', amount: '', isIncremental: false, paymentMethod: 'CASH', remark: '' });

            // Generate & Instant print receipt
            if (res.receiptData) {
                const receiptPayload = {
                    ...res.receiptData,
                    cashierName: getCurrentCashierName()
                };
                setCurrentReceiptData(receiptPayload);
                setReceiptModalOpen(true);
                if (autoPrintReceipt) {
                    printThermalReceipt(receiptPayload);
                }
            }

            // Reload student
            handleScan(studentData.studentId || studentData.id);
        } catch (err) {
            toast.error('Failed to save payment: ' + (err.response?.data?.error || err.message));
        }
    };

    // Re-print Receipt for any Paid or Partial Class
    const handlePrintClassReceipt = (cls, monthStr, pRecord) => {
        if (!studentData) return;
        const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';
        const enr = studentData.enrollments?.find(e => e.classId === cls.id);
        const cType = enr?.cardType || studentData.cardType || 'FULL';
        const fullFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
        const paidVal = pRecord?.amount !== undefined ? pRecord.amount : fullFee;
        const dueVal = Math.max(0, fullFee - paidVal);

        const receiptObj = {
            receiptNo: pRecord?.id ? `CF-${pRecord.id}` : `REC-${Date.now().toString().slice(-6)}`,
            studentId: studentData.studentId,
            studentName: sName,
            guardianPhone: studentData.guardianPhone || studentData.phone || '',
            className: cls.name,
            month: monthStr,
            cardType: cType,
            amount: paidVal,
            expectedFee: fullFee,
            dueAmount: dueVal,
            paidDate: pRecord?.paidDate ? new Date(pRecord.paidDate) : new Date(),
            status: pRecord?.status || 'PAID',
            cashierName: getCurrentCashierName(),
            items: [
                {
                    description: cls.name,
                    month: monthStr,
                    cardType: cType,
                    amount: paidVal,
                    expectedFee: fullFee,
                    dueAmount: dueVal
                }
            ],
            totalAmount: paidVal
        };

        setCurrentReceiptData(receiptObj);
        setReceiptModalOpen(true);
        if (autoPrintReceipt) {
            printThermalReceipt(receiptObj);
        }
    };

    // 1-Click Pay All Due Classes (Single Combined 80mm Receipt)
    const handlePayAllDueClasses = async () => {
        if (!studentData || !studentEnrolledClasses || studentEnrolledClasses.length === 0) return;

        const dueClasses = [];
        studentEnrolledClasses.forEach(cls => {
            const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
            const joinDate = cls.enrolledAt || studentData?.createdAt;
            const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
            const isBeforeEnrollment = !pRecord && joinMonthStr && activeMonthStr < joinMonthStr;

            if (isBeforeEnrollment) {
                // Not enrolled yet in this past month; ignore
                return;
            }

            const cType = cls.cardType || studentData.cardType || 'FULL';
            const expectedFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
            const isPaidRecord = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT');
            const paidAmount = isPaidRecord 
                ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expectedFee))
                : (pRecord?.status === 'PARTIAL' ? (pRecord.amount || 0) : 0);
            const dueAmount = cType === 'FREE' ? 0 : Math.max(0, expectedFee - paidAmount);

            if (cType !== 'FREE' && dueAmount > 0) {
                dueClasses.push({
                    classId: cls.id,
                    className: cls.name,
                    amount: expectedFee,
                    expectedFee,
                    dueAmount
                });
            }
        });

        if (dueClasses.length === 0) {
            toast.info('All classes are already paid for this month! ✓');
            return;
        }

        setMultiPayLoading(true);
        try {
            const payload = {
                studentId: studentData.id,
                month: activeMonthStr,
                paymentMethod: 'CASH',
                remark: `All ${dueClasses.length} due classes payment`,
                payments: dueClasses.map(d => ({
                    classId: d.classId,
                    amount: d.expectedFee,
                    status: 'PAID'
                }))
            };

            const res = await physicalCrmService.bulkToggleFeePayment(payload);

            toast.success(`Paid ${dueClasses.length} classes (Rs. ${res.paidAmount?.toLocaleString() || ''}) & logged in Cash Flow!`);

            if (res.receiptData) {
                const receiptPayload = {
                    ...res.receiptData,
                    cashierName: getCurrentCashierName()
                };
                setCurrentReceiptData(receiptPayload);
                setReceiptModalOpen(true);

                if (autoPrintReceipt) {
                    printThermalReceipt(receiptPayload);
                }
            }

            setSelectedClassIdsForMultiPay([]);
            handleScan(studentData.studentId || studentData.id);
        } catch (err) {
            console.error('Error in multi-class pay all:', err);
            toast.error('Failed to pay all classes: ' + (err.response?.data?.error || err.message));
        } finally {
            setMultiPayLoading(false);
        }
    };

    // Open Multi-Class Payment Modal
    const openMultiPayModal = (preselectedIds = null) => {
        if (!studentData || !studentEnrolledClasses || studentEnrolledClasses.length === 0) return;

        const items = studentEnrolledClasses.map(cls => {
            const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
            const cType = cls.cardType || studentData.cardType || 'FULL';
            const expected = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
            const isPaidRecord = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT');
            const paidAmount = isPaidRecord 
                ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expected))
                : (pRecord?.status === 'PARTIAL' ? (pRecord.amount || 0) : 0);
            const due = cType === 'FREE' ? 0 : Math.max(0, expected - paidAmount);

            const isSelected = !isPaidRecord && (preselectedIds && preselectedIds.length > 0
                ? preselectedIds.includes(cls.id)
                : (cType !== 'FREE' && due > 0));

            return {
                classId: cls.id,
                className: cls.name,
                grade: cls.grade || 'A/L',
                teacherName: cls.teachers?.map(t => t.name).join(', ') || 'Lecturer',
                cardType: cType,
                expectedFee: expected,
                currentPaid: paidAmount,
                dueAmount: due,
                payAmount: due > 0 ? String(due) : '0',
                isPaidRecord,
                isSelected
            };
        });

        setMultiPayModal({
            isOpen: true,
            monthStr: activeMonthStr,
            paymentMethod: 'CASH',
            remark: '',
            items,
            loading: false
        });
    };

    // Submit Multi-Class Payment Modal
    const handleMultiPayModalSubmit = async () => {
        if (!studentData || !multiPayModal.items || multiPayModal.items.length === 0) return;

        const selectedItems = multiPayModal.items.filter(it => it.isSelected && it.cardType !== 'FREE');
        if (selectedItems.length === 0) {
            toast.error('Please select at least one class to pay.');
            return;
        }

        for (const it of selectedItems) {
            const val = parseFloat(it.payAmount);
            if (isNaN(val) || val <= 0) {
                toast.error(`Please enter a valid payment amount for "${it.className}"`);
                return;
            }
        }

        setMultiPayModal(prev => ({ ...prev, loading: true }));
        try {
            const payments = selectedItems.map(it => ({
                classId: it.classId,
                amount: parseFloat(it.payAmount),
                status: 'PAID'
            }));

            const res = await physicalCrmService.bulkToggleFeePayment({
                studentId: studentData.id,
                month: multiPayModal.monthStr || activeMonthStr,
                paymentMethod: multiPayModal.paymentMethod || 'CASH',
                remark: multiPayModal.remark || '',
                payments
            });

            toast.success(`Payment of Rs. ${res.paidAmount?.toLocaleString()} recorded for ${selectedItems.length} classes!`);

            setMultiPayModal({ isOpen: false, monthStr: '', paymentMethod: 'CASH', remark: '', items: [], loading: false });
            setSelectedClassIdsForMultiPay([]);

            if (res.receiptData) {
                const receiptPayload = {
                    ...res.receiptData,
                    cashierName: getCurrentCashierName()
                };
                setCurrentReceiptData(receiptPayload);
                setReceiptModalOpen(true);

                if (autoPrintReceipt) {
                    printThermalReceipt(receiptPayload);
                }
            }

            handleScan(studentData.studentId || studentData.id);
        } catch (err) {
            console.error('Error submitting multi-class payment:', err);
            toast.error('Failed to process payment: ' + (err.response?.data?.error || err.message));
            setMultiPayModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Print Single Combined Receipt for All Paid Classes in Active Month
    const handlePrintMonthlyCombinedReceipt = () => {
        if (!studentData || !studentEnrolledClasses || studentEnrolledClasses.length === 0) return;

        const paidItems = [];
        let totalPaid = 0;
        let totalExpected = 0;
        let totalDue = 0;

        studentEnrolledClasses.forEach(cls => {
            const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
            const joinDate = cls.enrolledAt || studentData?.createdAt;
            const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
            const isBeforeEnrollment = !pRecord && joinMonthStr && activeMonthStr < joinMonthStr;

            if (isBeforeEnrollment) {
                // Not enrolled yet in this past month; ignore
                return;
            }

            const cType = cls.cardType || studentData.cardType || 'FULL';
            const expected = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
            const isPaid = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'HALF_PAYMENT' || pRecord.status === 'FREE_CARD' || pRecord.status === 'PARTIAL');
            
            if (isPaid || cType === 'FREE') {
                const paidVal = isPaid 
                    ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expected))
                    : 0;
                const dueVal = cType === 'FREE' ? 0 : Math.max(0, expected - paidVal);

                paidItems.push({
                    description: `Class Fee - ${cls.name}`,
                    month: activeMonthStr,
                    cardType: `${cType} CARD`,
                    amount: paidVal,
                    expectedFee: expected,
                    dueAmount: dueVal
                });

                totalPaid += paidVal;
                totalExpected += expected;
                totalDue += dueVal;
            }
        });

        if (paidItems.length === 0) {
            toast.error('No paid classes found for this month to print.');
            return;
        }

        const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';
        const receiptObj = {
            receiptNo: `REC-M${studentData.id}-${activeMonthStr.replace('-', '')}`,
            studentId: studentData.studentId,
            studentName: sName,
            guardianPhone: studentData.guardianPhone || studentData.phone || '',
            className: paidItems.length > 1 ? `Multi-Class Payment (${paidItems.length} Classes)` : paidItems[0]?.description || 'Class Fee',
            month: activeMonthStr,
            cardType: 'MULTIPLE',
            amount: totalPaid,
            totalAmount: totalPaid,
            expectedFee: totalExpected,
            dueAmount: totalDue,
            paymentMethod: 'CASH',
            paidDate: new Date(),
            status: totalDue === 0 ? 'PAID ✓' : 'PARTIAL',
            cashierName: getCurrentCashierName(),
            items: paidItems,
            notes: `Combined Monthly Receipt (${paidItems.length} Classes)`
        };

        setCurrentReceiptData(receiptObj);
        setReceiptModalOpen(true);
        if (autoPrintReceipt) {
            printThermalReceipt(receiptObj);
        }
    };

    // Preview 80mm Thermal Receipt for Selected Classes (or All Due)
    const handlePreviewSelectedReceipt = (selectedIds = null) => {
        if (!studentData || !studentEnrolledClasses || studentEnrolledClasses.length === 0) return;
        const targetIds = selectedIds && selectedIds.length > 0 
            ? selectedIds 
            : (selectedClassIdsForMultiPay.length > 0 ? selectedClassIdsForMultiPay : studentEnrolledClasses.map(c => c.id));
        
        const targetClasses = studentEnrolledClasses.filter(c => targetIds.includes(c.id));
        if (targetClasses.length === 0) {
            toast.error('Please select at least one class to preview.');
            return;
        }

        const items = [];
        let totalAmt = 0;
        let totalExp = 0;
        let totalDueAmt = 0;

        targetClasses.forEach(cls => {
            const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
            const cType = cls.cardType || studentData.cardType || 'FULL';
            const expected = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
            const isPaid = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'HALF_PAYMENT' || pRecord.status === 'FREE_CARD');
            const paidVal = isPaid ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expected)) : (pRecord?.status === 'PARTIAL' ? (pRecord.amount || 0) : 0);
            const dueVal = cType === 'FREE' ? 0 : Math.max(0, expected - paidVal);
            const amountToPay = dueVal > 0 ? dueVal : (paidVal > 0 ? paidVal : expected);

            totalAmt += amountToPay;
            totalExp += expected;
            totalDueAmt += dueVal;

            items.push({
                description: `Class Fee - ${cls.name}`,
                month: activeMonthStr,
                cardType: `${cType} CARD`,
                amount: amountToPay,
                expectedFee: expected,
                dueAmount: dueVal
            });
        });

        const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';
        const receiptPayload = {
            receiptNo: `PREVIEW-${Date.now().toString().slice(-6)}`,
            studentId: studentData.studentId,
            studentName: sName,
            guardianPhone: studentData.guardianPhone || studentData.phone || '',
            className: items.length > 1 ? `Multi-Class Payment (${items.length} Classes)` : items[0]?.description || 'Class Fee',
            month: activeMonthStr,
            cardType: 'MULTIPLE',
            amount: totalAmt,
            totalAmount: totalAmt,
            expectedFee: totalExp,
            dueAmount: totalDueAmt,
            paymentMethod: 'CASH',
            paidDate: new Date(),
            status: 'PREVIEW',
            cashierName: getCurrentCashierName(),
            items,
            notes: `Receipt Preview (${items.length} Classes)`
        };

        setCurrentReceiptData(receiptPayload);
        setReceiptModalOpen(true);
    };

    // Toggle Registration Fee Payment with Instant Auto-Print Receipt
    const handleToggleRegistrationFee = async () => {
        if (!studentData) return;
        const isPaid = studentData.registrationFeeStatus === 'PAID';
        const newStatus = isPaid ? 'PENDING' : 'PAID';
        try {
            const updated = await physicalCrmService.updateStudent(studentData.id, {
                ...studentData,
                registrationFeeStatus: newStatus
            });
            setStudentData(updated);

            if (newStatus === 'PAID') {
                toast.success('Registration Fee marked as PAID & logged in Cash Flow!');
                const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';
                const regFeeVal = Number(studentData.registrationFeeAmount || 1000);
                const receiptObj = {
                    receiptNo: `REG-${Date.now().toString().slice(-6)}`,
                    studentId: studentData.studentId,
                    studentName: sName,
                    guardianPhone: studentData.guardianPhone || studentData.phone || '',
                    className: 'Student Registration Fee',
                    month: format(new Date(), 'yyyy-MM'),
                    cardType: 'STUDENT REGISTRATION',
                    amount: regFeeVal,
                    expectedFee: regFeeVal,
                    dueAmount: 0,
                    paidDate: new Date(),
                    status: 'PAID',
                    cashierName: getCurrentCashierName(),
                    items: [
                        {
                            description: 'New Student Admission & Registration Fee',
                            month: format(new Date(), 'yyyy-MM'),
                            cardType: 'REGISTRATION',
                            amount: regFeeVal,
                            expectedFee: regFeeVal,
                            dueAmount: 0
                        }
                    ],
                    totalAmount: regFeeVal
                };

                setCurrentReceiptData(receiptObj);
                setReceiptModalOpen(true);

                // Instant Auto-Print
                if (autoPrintReceipt) {
                    printThermalReceipt(receiptObj);
                }
            } else {
                toast.info('Registration Fee marked as PENDING');
            }
        } catch (err) {
            toast.error('Failed to update registration fee');
        }
    };

    const handleRegistrationFeePayment = handleToggleRegistrationFee;

    // Extract distinct enrolled classes list for student with full metadata
    const studentEnrolledClasses = useMemo(() => {
        if (!studentData) return [];
        const map = new Map();
        if (studentData.class) {
            map.set(studentData.class.id, {
                ...studentData.class,
                cardType: studentData.cardType || 'FULL',
                enrollmentId: null,
                enrolledAt: studentData.createdAt
            });
        }
        if (studentData.enrollments) {
            studentData.enrollments.forEach(e => {
                if (e.class) {
                    map.set(e.class.id, {
                        ...e.class,
                        cardType: e.cardType || studentData.cardType || 'FULL',
                        enrollmentId: e.id,
                        enrolledAt: e.createdAt || studentData.createdAt
                    });
                }
            });
        }
        return Array.from(map.values());
    }, [studentData]);

    // Extract previously enrolled / de-allocated classes that have preserved fee records
    const studentHistoricalClasses = useMemo(() => {
        if (!studentData || !feePayments || feePayments.length === 0) return [];
        const activeIds = new Set(studentEnrolledClasses.map(c => c.id));
        const histMap = new Map();
        feePayments.forEach(p => {
            if (p.class && !activeIds.has(p.classId)) {
                if (!histMap.has(p.classId)) {
                    histMap.set(p.classId, {
                        ...p.class,
                        isHistorical: true
                    });
                }
            }
        });
        return Array.from(histMap.values());
    }, [studentData, feePayments, studentEnrolledClasses]);

    const todayDayName = useMemo(() => {
        const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return dayMap[new Date().getDay()];
    }, []);

    // Filter which classes the student is scheduled for today
    const todayEnrolledClasses = useMemo(() => {
        if (!studentEnrolledClasses || studentEnrolledClasses.length === 0) return [];
        return studentEnrolledClasses.filter(cls => {
            if (!cls.timetables || cls.timetables.length === 0) return false;
            return cls.timetables.some(t => t.dayOfWeek === todayDayName);
        });
    }, [studentEnrolledClasses, todayDayName]);

    const activeMonthStr = format(viewMonth, 'yyyy-MM');

    // Calculate Active Month Overall Summary for All Enrolled Classes
    const activeMonthSummary = useMemo(() => {
        let totalExpected = 0;
        let totalPaid = 0;
        let totalDue = 0;
        let paidCount = 0;
        let partialCount = 0;
        let pendingCount = 0;

        studentEnrolledClasses.forEach(cls => {
            const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
            const cType = cls.cardType || studentData?.cardType || 'FULL';
            const expected = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));

            const joinDate = cls.enrolledAt || studentData?.createdAt;
            const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
            const isBeforeEnrollment = !pRecord && joinMonthStr && activeMonthStr < joinMonthStr;

            if (isBeforeEnrollment) {
                // Not enrolled yet in this past month; do not count as expected or due
                return;
            }

            totalExpected += expected;

            if (pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT' || pRecord.status === 'PARTIAL')) {
                const paid = pRecord.status === 'FREE_CARD' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expected);
                totalPaid += paid;
                const due = Math.max(0, expected - paid);
                totalDue += due;
                if (due === 0) {
                    paidCount++;
                } else {
                    partialCount++;
                }
            } else {
                totalDue += expected;
                pendingCount++;
            }
        });

        return { totalExpected, totalPaid, totalDue, paidCount, partialCount, pendingCount };
    }, [studentEnrolledClasses, feePayments, activeMonthStr, studentData]);

    // Render Active Month Calendar Widget
    const renderCalendarMonth = (baseDate, compact = false) => {
        const start = startOfMonth(baseDate);
        const end = endOfMonth(baseDate);
        const days = eachDayOfInterval({ start, end });
        const startDay = start.getDay(); 
        const paddingDays = Array(startDay).fill(null);

        return (
            <div className="w-full flex flex-col justify-between flex-1 space-y-3">
                {/* Month Navigator Header */}
                <div className="flex justify-between items-center bg-white/5 p-2 rounded-2xl border border-white/10 shadow-inner">
                    <button
                        onClick={() => setViewMonth(prev => subMonths(prev, 1))}
                        className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all border border-white/10 cursor-pointer active:scale-95 shadow-md flex items-center gap-1.5 text-xs font-black"
                        title="Previous Month"
                    >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">Prev</span>
                    </button>
                    <div className="text-center">
                        <h3 className="font-black text-white text-base sm:text-lg tracking-wide flex items-center justify-center gap-2">
                            <CalendarIcon className="text-emerald-400" size={18} />
                            <span>{format(baseDate, 'MMMM yyyy')}</span>
                        </h3>
                    </div>
                    <button
                        onClick={() => setViewMonth(prev => addMonths(prev, 1))}
                        className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all border border-white/10 cursor-pointer active:scale-95 shadow-md flex items-center gap-1.5 text-xs font-black"
                        title="Next Month"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-white/50 uppercase tracking-wider py-0.5">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-0.5">{d}</div>
                    ))}
                </div>

                {/* Days Grid (Larger, prominent interactive cells) */}
                <div className="grid grid-cols-7 gap-2 sm:gap-2.5 text-center flex-1">
                    {paddingDays.map((_, i) => <div key={`pad-${i}`} className="h-11 sm:h-13 lg:h-14"></div>)}
                    {days.map(day => {
                        const isAttended = attendances.some(a => isSameDay(new Date(a.date), day) && a.status === 'PRESENT');
                        const isCurrentDay = isToday(day);
                        return (
                            <button 
                                key={day.toISOString()} 
                                onClick={() => {
                                    if (studentData && !autoMark) {
                                        if (isAttended) {
                                            unmarkAttendance(studentData.id, format(day, 'yyyy-MM-dd'));
                                        } else {
                                            markAttendance(studentData.id, format(day, 'yyyy-MM-dd'));
                                        }
                                    }
                                }}
                                disabled={!studentData || autoMark}
                                className={`
                                    h-11 sm:h-13 lg:h-14 w-full rounded-2xl text-sm sm:text-base font-black flex flex-col items-center justify-center transition-all relative
                                    ${isAttended ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-black shadow-[0_0_20px_rgba(16,185,129,0.55)] border border-emerald-300 scale-[1.04] z-10' : 
                                      isCurrentDay ? 'bg-blue-600/30 text-blue-200 border border-blue-400 shadow-[0_0_14px_rgba(59,130,246,0.35)]' : 'bg-white/5 text-white/80 hover:bg-white/15 border border-white/10'}
                                    ${(!studentData || autoMark) ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}
                                `}
                            >
                                <span>{format(day, 'd')}</span>
                                {isAttended && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mt-0.5"></span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Calendar Legend */}
                <div className="flex items-center justify-center gap-4 pt-3 border-t border-white/10 text-xs font-bold text-white/60 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                        <span>Attended</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-300"></span>
                        <span>Today</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-white/20 border border-white/10"></span>
                        <span>Absent</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-1 sm:p-2 w-full min-h-full flex flex-col gap-3.5 text-white relative animate-in fade-in duration-300">
            <input 
                id="hidden-scanner"
                type="text" 
                className="opacity-0 absolute -z-10 pointer-events-none" 
                value={scanInput} 
                onChange={(e) => setScanInput(e.target.value)}
            />

            {/* TOP BAR: Search & Scan + Month Navigator + Dual/Tab View Switcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                
                {/* Search / Scan Bar (Spans 7 cols on desktop) */}
                <div className="lg:col-span-7 bg-black/40 backdrop-blur-2xl border border-white/20 p-3.5 sm:p-4 rounded-[1.8rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative z-40">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                                <Search size={16} />
                            </div>
                            <h2 className="text-base font-black text-white">Student Search & Scan</h2>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Active Session Class Selector */}
                            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                <BookOpen size={13} className="text-amber-400 shrink-0" />
                                <select
                                    value={activeSessionClassId}
                                    onChange={(e) => setActiveSessionClassId(e.target.value)}
                                    className="bg-transparent text-[11px] font-bold text-amber-300 focus:outline-none cursor-pointer max-w-[170px] sm:max-w-[210px] truncate"
                                    title="Active Class Session for parent SMS alerts"
                                >
                                    <option value="" className="bg-slate-900 text-white">Auto (Student's Class)</option>
                                    {availableClasses.map(cls => (
                                        <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                                            {cls.name} ({cls.grade})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={() => setAutoMark(!autoMark)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-all text-xs"
                            >
                                {autoMark ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} className="text-white/40" />}
                                <span className={`font-bold text-[11px] ${autoMark ? 'text-emerald-400' : 'text-white/50'}`}>
                                    {autoMark ? 'Auto-Mark' : 'Manual'}
                                </span>
                            </button>

                            <button
                                onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                    autoPrintReceipt 
                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                                        : 'bg-white/5 text-white/50 border-white/10'
                                }`}
                                title="Auto-send to 80mm thermal printer on payment"
                            >
                                <Printer size={12} />
                                <span>{autoPrintReceipt ? 'Auto Slip: ON' : 'Auto Slip: OFF'}</span>
                            </button>


                        </div>
                    </div>

                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search Name, ID (e.g. PHY-STU-5787), Phone or Scan Card..." 
                            className="w-full bg-white/5 border border-white/15 rounded-xl pl-3.5 pr-20 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 text-xs font-medium shadow-inner"
                            value={scanInput}
                            onChange={e => {
                                setScanInput(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && scanInput) {
                                    handleScan(scanInput);
                                    setScanInput('');
                                }
                            }}
                        />
                        <button
                            onClick={() => {
                                if (scanInput) {
                                    handleScan(scanInput);
                                    setScanInput('');
                                }
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] font-black bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-md flex items-center gap-1"
                        >
                            <span>SEARCH</span>
                        </button>

                        {/* Autocomplete Dropdown List */}
                        {showSuggestions && searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/98 border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl divide-y divide-white/10 max-h-64 overflow-y-auto custom-scrollbar">
                                {searchResults.map(s => {
                                    const isCardMatch = s.rfid && (
                                        s.rfid.toLowerCase() === scanInput.trim().toLowerCase() ||
                                        s.rfid.toLowerCase() === ('+' + scanInput.trim()).toLowerCase() ||
                                        s.rfid.replace(/^\+/, '').toLowerCase() === scanInput.trim().replace(/^\+/, '').toLowerCase()
                                    );

                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => {
                                                handleScan(s.rfid || s.studentId || s.phone || s.studentName);
                                                setScanInput('');
                                                setShowSuggestions(false);
                                            }}
                                            className={`p-3 cursor-pointer transition-all flex items-center justify-between gap-3 group ${
                                                isCardMatch 
                                                    ? 'bg-emerald-950/60 border-l-4 border-emerald-400 hover:bg-emerald-900/70' 
                                                    : 'hover:bg-blue-600/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md ${
                                                    isCardMatch 
                                                        ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 ring-2 ring-emerald-300' 
                                                        : 'bg-gradient-to-tr from-blue-500 to-purple-500'
                                                }`}>
                                                    {(s.studentName || s.firstName || 'S')[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-white text-xs group-hover:text-blue-300 truncate">
                                                            {s.studentName || `${s.firstName || ''} ${s.lastName || ''}`}
                                                        </h4>
                                                        {isCardMatch && (
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 animate-pulse">
                                                                🎯 Card Match
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-white/60 flex items-center gap-1.5 mt-0.5 truncate">
                                                        <span className="text-red-400 font-bold">{s.studentId}</span>
                                                        {s.rfid && <span className="text-emerald-300 font-sans font-bold">• 💳 {s.rfid}</span>}
                                                        {s.phone && <span>• 📞 {s.phone}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/10 rounded-md text-white/80 block">
                                                    {s.class?.name || (s.enrollments?.length ? `${s.enrollments.length} Classes` : 'No Class')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* View Switcher & Month Navigation (Spans 5 cols on desktop) */}
                <div className="lg:col-span-5 bg-black/40 backdrop-blur-2xl border border-white/20 p-3.5 sm:p-4 rounded-[1.8rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="text-amber-400" size={16} />
                            <span className="font-black text-sm text-white">{format(viewMonth, 'MMMM yyyy')}</span>
                        </div>

                        {/* View Mode Toggle Pills (Dual View / Classes / Calendar) */}
                        <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                            <button
                                onClick={() => setActiveViewMode('dual')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                    activeViewMode === 'dual' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                                title="Dual Split View (Both Classes and Calendar Side-by-Side without scrolling)"
                            >
                                <Columns size={13} />
                                <span>Dual View</span>
                            </button>
                            <button
                                onClick={() => setActiveViewMode('classes')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                    activeViewMode === 'classes' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                                title="Classes Feed View"
                            >
                                <LayoutGrid size={13} />
                                <span>Classes</span>
                            </button>
                            <button
                                onClick={() => setActiveViewMode('calendar')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                    activeViewMode === 'calendar' 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                                title="Attendance Calendar View"
                            >
                                <CalendarCheck size={13} />
                                <span>Calendar</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                        <button
                            onClick={() => setViewMonth(new Date())}
                            className="text-[11px] font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-md border border-white/10 cursor-pointer"
                        >
                            Jump to Current Month
                        </button>
                        <button
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="text-[11px] font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 cursor-pointer"
                        >
                            <History size={12} />
                            <span>View Full History Log 📅</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                
                {/* LEFT SIDEBAR: Student Profile + Quick Mark Present + Registration Fee (3 cols on wide, 4 cols on lg) */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
                    
                    <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative flex flex-col">
                        {loading && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-30 flex items-center justify-center">
                                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-black text-white flex items-center gap-1.5">
                                <User className="text-purple-400" size={18} /> Student Profile
                            </h2>
                            {studentData && (
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black">
                                        Active
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStudentData(null);
                                            setAttendances([]);
                                            setFeePayments([]);
                                        }}
                                        className="p-1 text-white/40 hover:text-white/90 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                        title="Clear student profile"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {studentData ? (
                            <div className="space-y-3 animate-fade-in">
                                
                                {/* Student Header Card */}
                                <div className="flex items-center gap-3 bg-gradient-to-r from-purple-900/30 via-white/5 to-transparent p-3 rounded-2xl border border-white/10">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-xl font-black shadow-lg border border-white/20 shrink-0">
                                        {(studentData.studentName || studentData.firstName || 'S')[0]}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-black text-white drop-shadow-sm truncate">
                                            {studentData.studentName || `${studentData.firstName} ${studentData.lastName}`}
                                        </h3>
                                        <p className="text-red-400 font-extrabold text-xs mt-0.5">
                                            {studentData.studentId}
                                        </p>
                                    </div>
                                </div>

                                {/* FULL STUDENT REPORT BUTTON (History & Statement) */}
                                <button
                                    type="button"
                                    onClick={() => setIsStudentReportModalOpen(true)}
                                    className="w-full py-2 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95"
                                    title="View complete student history: 🟣 Payments & 🟣 Attendance"
                                >
                                    <FileText size={15} />
                                    <span>📊 Full Student Report (History)</span>
                                </button>

                                {/* QUICK ATTENDANCE TOGGLE BUTTON (Zero Scroll Attendance Marking!) */}
                                <button
                                    type="button"
                                    onClick={handleToggleTodayAttendance}
                                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-95 ${
                                        isPresentToday 
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-600/40 border border-emerald-300' 
                                            : 'bg-white/10 hover:bg-emerald-500/20 text-white/80 hover:text-emerald-300 border border-white/10'
                                    }`}
                                >
                                    <UserCheck size={16} />
                                    <span>{isPresentToday ? 'Present Today (Marked)' : 'Mark Present Today'}</span>
                                </button>

                                {/* ENROLLED CLASSES & DAILY CHECK-IN (Multi-class attendance per student) */}
                                {studentEnrolledClasses.length > 0 && (
                                    <div className="bg-gradient-to-b from-blue-950/50 via-slate-900/80 to-black/60 p-3.5 rounded-2xl border border-blue-500/30 space-y-2.5 shadow-lg">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                                <BookOpen size={13} className="text-blue-400" /> Enrolled Classes Check-In ({studentEnrolledClasses.length})
                                            </span>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                                                {todayDayName}
                                            </span>
                                        </div>

                                        <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-0.5">
                                            {studentEnrolledClasses.map(cls => {
                                                const todaySlot = cls.timetables?.find(t => t.dayOfWeek === todayDayName);
                                                const isAttendedThisClass = attendances.some(a => 
                                                    isToday(new Date(a.date)) && 
                                                    a.status === 'PRESENT' && 
                                                    (String(a.classId) === String(cls.id) || (studentEnrolledClasses.length === 1 && !a.classId))
                                                );
                                                const attRecord = attendances.find(a => 
                                                    isToday(new Date(a.date)) && 
                                                    a.status === 'PRESENT' && 
                                                    (String(a.classId) === String(cls.id) || (studentEnrolledClasses.length === 1 && !a.classId))
                                                );
                                                const attTime = attRecord?.createdAt ? format(new Date(attRecord.createdAt), 'hh:mm a') : null;

                                                const pRecCheck = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
                                                const joinDate = cls.enrolledAt || studentData?.createdAt;
                                                const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
                                                const isBeforeEnrollment = !pRecCheck && joinMonthStr && activeMonthStr < joinMonthStr;

                                                const cTypeCheck = cls.cardType || studentData?.cardType || 'FULL';
                                                const isClassPaid = cTypeCheck === 'FREE' || (pRecCheck && (pRecCheck.status === 'PAID' || pRecCheck.status === 'FREE_CARD' || pRecCheck.status === 'HALF_PAYMENT'));

                                                return (
                                                    <div 
                                                        key={cls.id} 
                                                        className={`p-3 rounded-2xl border transition-all ${
                                                            isClassPaid 
                                                                ? 'bg-emerald-950/20 border-emerald-500/25 hover:border-emerald-500/40' 
                                                                : isBeforeEnrollment
                                                                    ? 'bg-slate-900/40 border-white/5 opacity-75'
                                                                    : 'bg-rose-950/20 border-rose-500/25 hover:border-rose-500/40'
                                                        }`}
                                                    >
                                                        {/* Top Row: Full Class Name & Paid Status Badge */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h5 className="font-extrabold text-white text-xs leading-snug break-words flex-1" title={cls.name}>
                                                                {cls.name}
                                                            </h5>
                                                            {isClassPaid ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 whitespace-nowrap shadow-sm">
                                                                    PAID ✓
                                                                </span>
                                                            ) : isBeforeEnrollment ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0 whitespace-nowrap shadow-sm" title={`Joined in ${joinMonthStr}`}>
                                                                    NOT ENROLLED
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse shrink-0 whitespace-nowrap shadow-sm">
                                                                    NOT PAID ⚠️
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Bottom Row: Metadata & Check-In Action */}
                                                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
                                                            <div className="text-[10px] text-white/60 flex items-center gap-1.5 flex-wrap min-w-0">
                                                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/80 font-semibold">{cls.grade}</span>
                                                                <span>•</span>
                                                                <span className="font-bold text-emerald-400">Rs. {cls.monthlyFee?.toLocaleString()}</span>
                                                                {todaySlot && (
                                                                    <span className="text-blue-300 font-medium">
                                                                        • ⏰ {todaySlot.startTime}
                                                                    </span>
                                                                )}
                                                                {isAttendedThisClass && attTime && (
                                                                    <span className="text-emerald-400 font-bold">
                                                                        • {attTime}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="shrink-0">
                                                                {isAttendedThisClass ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                                                                            <CheckCircle2 size={11} /> Attended
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => unmarkAttendance(studentData.id, format(new Date(), 'yyyy-MM-dd'), cls.id)}
                                                                            className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] cursor-pointer transition-all active:scale-95"
                                                                            title="Unmark attendance for this class"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => markAttendance(studentData.id, format(new Date(), 'yyyy-MM-dd'), cls.id)}
                                                                        className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                                                                    >
                                                                        <UserCheck size={12} />
                                                                        <span>Check In</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Contacts Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-white/50 uppercase font-bold">Student Phone</p>
                                        <p className="font-bold text-white truncate mt-0.5">{studentData.phone || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-white/50 uppercase font-bold">Guardian</p>
                                        <p className="font-bold text-white truncate mt-0.5">{studentData.guardianPhone || 'N/A'}</p>
                                    </div>
                                </div>

                                    {/* Card / RFID Smart Badge & Quick Change */}
                                    <div className="bg-gradient-to-r from-emerald-950/50 via-teal-950/30 to-slate-900/80 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg relative overflow-hidden group">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                                                    <CreditCard size={13} />
                                                </div>
                                                <span className="text-[11px] text-emerald-400 font-extrabold uppercase tracking-wider">
                                                    ID Card / RFID
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-base font-black text-white tracking-wide">
                                                    {studentData.rfid ? studentData.rfid : 'No Card Assigned'}
                                                </span>
                                                {studentData.rfid ? (
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                                        Unlinked
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCardScanModal({ isOpen: true, inputRfid: studentData.rfid || '', loading: false })}
                                            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-black tracking-wide shadow-md shadow-emerald-600/30 transition-all cursor-pointer shrink-0 active:scale-95"
                                        >
                                            {studentData.rfid ? 'Change Card' : '+ Allocate Card'}
                                        </button>
                                    </div>

                                    {/* Registration Fee Box with Instant Auto-Print */}
                                    <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-2 shadow-sm">
                                        <div>
                                            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Registration Fee</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {studentData.registrationFeeStatus === 'PAID' ? (
                                                    <span className="text-emerald-300 font-black bg-emerald-500/20 px-2.5 py-0.5 rounded-lg text-xs border border-emerald-500/30 flex items-center gap-1">
                                                        <Check size={12} /> PAID
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-300 font-black bg-amber-500/20 px-2.5 py-0.5 rounded-lg text-xs border border-amber-500/30">
                                                        PENDING
                                                    </span>
                                                )}
                                                {studentData.registrationFeeAmount > 0 && (
                                                    <span className="text-xs text-white/80 font-extrabold">Rs. {Number(studentData.registrationFeeAmount).toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleToggleRegistrationFee}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-black shadow transition-all cursor-pointer active:scale-95 ${
                                                studentData.registrationFeeStatus === 'PAID'
                                                    ? 'bg-white/10 hover:bg-white/20 text-white/70'
                                                    : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-600/30'
                                            }`}
                                        >
                                            {studentData.registrationFeeStatus === 'PAID' ? 'Revert' : 'Mark Paid'}
                                        </button>
                                    </div>

                                    {/* ALLOCATE ANOTHER CLASS DROPDOWN WITH SEARCH */}
                                    <div className="bg-gradient-to-b from-white/5 to-white/[0.02] p-3.5 rounded-2xl border border-white/10 space-y-2.5 shadow-sm" ref={classDropdownRef}>
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-extrabold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                                                <Plus size={12} /> Allocate Another Class
                                            </label>
                                            <span className="text-[10px] text-white/50 font-bold">
                                                {studentEnrolledClasses.length} Enrolled
                                            </span>
                                        </div>

                                        {/* Class Selector Trigger / Selected Display */}
                                        <button
                                            type="button"
                                            onClick={() => setIsClassDropdownOpen(prev => !prev)}
                                            className={`w-full bg-slate-900/90 border ${isClassDropdownOpen ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-white/20 hover:border-white/40'} rounded-xl p-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer shadow-sm`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <Search size={14} className="text-blue-400 shrink-0" />
                                                {currentSelectedClass ? (
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                                                        <span className="text-white font-bold text-xs">{currentSelectedClass.name}</span>
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-semibold shrink-0">{currentSelectedClass.grade}</span>
                                                        <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">• Rs. {Number(currentSelectedClass.monthlyFee || 0).toLocaleString()}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-white/40">Search & select class to add...</span>
                                                )}
                                            </div>
                                            <ChevronDown size={14} className={`text-white/60 shrink-0 transition-transform duration-200 ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Expandable Search & Class Picker Section */}
                                        {isClassDropdownOpen && (
                                            <div className="bg-slate-950/95 border border-blue-500/30 rounded-2xl p-2.5 space-y-2 animate-in fade-in duration-150 shadow-2xl">
                                                {/* Search Input Bar */}
                                                <div className="relative">
                                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder="Search by class name, grade, teacher..."
                                                        value={classSearchTerm}
                                                        onChange={(e) => setClassSearchTerm(e.target.value)}
                                                        className="w-full bg-white/10 border border-white/20 focus:border-blue-400 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-white outline-none placeholder:text-white/40"
                                                    />
                                                    {classSearchTerm && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setClassSearchTerm('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Filtered Class List */}
                                                <div className="max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                                    {filteredAvailableClasses.length === 0 ? (
                                                        <div className="text-center py-4 text-xs text-white/40 font-medium">
                                                            No classes found matching "{classSearchTerm}"
                                                        </div>
                                                    ) : (
                                                        filteredAvailableClasses.map(c => {
                                                            const isAlready = studentEnrolledClasses.some(sc => sc.id === c.id);
                                                            const isSelected = String(selectedClassId) === String(c.id);
                                                            const teacherNames = c.teachers?.map(t => t.name).join(', ') || '';

                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    disabled={isAlready}
                                                                    onClick={() => {
                                                                        setSelectedClassId(c.id);
                                                                        setIsClassDropdownOpen(false);
                                                                        setClassSearchTerm('');
                                                                    }}
                                                                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1.5 border ${
                                                                        isAlready
                                                                            ? 'opacity-40 cursor-not-allowed bg-white/[0.02] border-white/5'
                                                                            : isSelected
                                                                                ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/20'
                                                                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90 hover:text-white hover:border-white/20 cursor-pointer'
                                                                    }`}
                                                                >
                                                                    {/* Row 1: Class Name & Monthly Fee */}
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <span className="font-bold text-xs text-white leading-snug flex-1">
                                                                            {c.name}
                                                                        </span>
                                                                        <span className="text-xs font-black text-emerald-400 shrink-0 font-mono">
                                                                            Rs. {Number(c.monthlyFee || 0).toLocaleString()}
                                                                        </span>
                                                                    </div>

                                                                    {/* Row 2: Grade, Teacher & Enrolled Status */}
                                                                    <div className="flex items-center justify-between gap-2 text-[10px] text-white/50 pt-0.5">
                                                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                                            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                                                                                {c.grade || 'A/L'}
                                                                            </span>
                                                                            {teacherNames && (
                                                                                <span className="text-white/60 truncate max-w-[200px]" title={teacherNames}>
                                                                                    👨‍🏫 {teacherNames}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {isAlready && (
                                                                            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                                                                                Enrolled
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setIsClassDropdownOpen(false)}
                                                    className="w-full py-1.5 text-center text-[11px] font-bold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer"
                                                >
                                                    Close Selector
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedCardType}
                                                onChange={(e) => setSelectedCardType(e.target.value)}
                                                className="bg-slate-900 border border-white/20 rounded-xl px-2.5 py-2 text-white outline-none text-xs font-bold cursor-pointer shrink-0"
                                            >
                                                <option value="FULL">Full Card (100%)</option>
                                                <option value="HALF">Half Card (50%)</option>
                                                <option value="FREE">Free Card (0%)</option>
                                            </select>

                                            <button 
                                                type="button"
                                                onClick={allocateClass}
                                                disabled={!selectedClassId}
                                                className={`flex-1 py-2 rounded-xl transition-all text-xs font-black flex items-center justify-center gap-1 shadow-md ${
                                                    selectedClassId 
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer active:scale-95 shadow-blue-600/30' 
                                                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                                                }`}
                                            >
                                                <Plus size={14} />
                                                <span>Add Class</span>
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-12">
                                    <User size={36} className="mb-2" />
                                    <p className="text-xs text-white/70">Scan or search student to view profile</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MAIN CONTENT WORKSPACE (Classes Feed & Sticky Calendar in No-Scroll Dual Layout) */}
                    <div className={`lg:col-span-8 xl:col-span-9 flex flex-col gap-3`}>
                        
                        {/* Active Month Fee Summary Banner */}
                        {studentData && studentEnrolledClasses.length > 0 && (
                            <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/35 to-purple-900/40 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-black text-blue-300 uppercase tracking-wider mb-1 flex-wrap">
                                            <TrendingUp size={15} />
                                            <span>Academic Period:</span>
                                            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-lg border border-blue-400/40 shadow-sm font-black text-xs">
                                                {format(viewMonth, 'MMMM yyyy')} ({activeMonthStr})
                                            </span>
                                        </div>
                                        <h3 className="text-base sm:text-lg font-black text-white mt-1">
                                            {studentEnrolledClasses.length} Allocated Classes for {studentData.studentName || studentData.firstName}
                                        </h3>
                                    </div>

                                    {/* BIG PROMINENT MONTHLY STATUS BADGE */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        {activeMonthSummary.totalDue === 0 ? (
                                            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/30 border border-emerald-400 flex items-center gap-2 tracking-wide animate-pulse">
                                                <CheckCircle2 size={18} />
                                                <span>MONTH PAID ✓ ({format(viewMonth, 'MMMM yyyy')})</span>
                                            </div>
                                        ) : (
                                            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-500/30 border border-rose-400 flex items-center gap-2 tracking-wide">
                                                <AlertCircle size={18} />
                                                <span>NOT PAID / DUE: Rs. {activeMonthSummary.totalDue.toLocaleString()} ({format(viewMonth, 'MMMM yyyy')})</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                                            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                                                <p className="text-[9px] text-white/60 uppercase font-bold">Total Fees</p>
                                                <p className="text-xs sm:text-sm font-black text-white">Rs. {activeMonthSummary.totalExpected.toLocaleString()}</p>
                                            </div>
                                            <div className="bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-center">
                                                <p className="text-[9px] text-emerald-300 uppercase font-bold">Total Paid</p>
                                                <p className="text-xs sm:text-sm font-black text-emerald-400">Rs. {activeMonthSummary.totalPaid.toLocaleString()}</p>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-xl border text-center ${
                                                activeMonthSummary.totalDue > 0 
                                                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' 
                                                    : 'bg-white/5 border-white/10 text-white/50'
                                            }`}>
                                                <p className="text-[9px] uppercase font-bold">Total Due</p>
                                                <p className="text-xs sm:text-sm font-black text-rose-400">Rs. {activeMonthSummary.totalDue.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Multi-Class Payment & Single Combined Receipt Action Bar */}
                                <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {activeMonthSummary.totalDue > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={handlePayAllDueClasses}
                                                    disabled={multiPayLoading}
                                                    className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    <span>Pay All Due Classes (Rs. {activeMonthSummary.totalDue.toLocaleString()})</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => openMultiPayModal()}
                                                    disabled={multiPayLoading}
                                                    className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                >
                                                    <Receipt size={14} />
                                                    <span>Multi-Class Pay</span>
                                                </button>
                                            </>
                                        )}

                                        {selectedClassIdsForMultiPay.length > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => openMultiPayModal(selectedClassIdsForMultiPay)}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                >
                                                    <Check size={14} />
                                                    <span>Pay {selectedClassIdsForMultiPay.length} Selected Classes</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handlePreviewSelectedReceipt(selectedClassIdsForMultiPay)}
                                                    className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                    title="Preview 80mm receipt for selected classes"
                                                >
                                                    <Eye size={14} />
                                                    <span>Preview Receipt</span>
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {activeMonthSummary.totalPaid > 0 && (
                                            <button
                                                type="button"
                                                onClick={handlePrintMonthlyCombinedReceipt}
                                                className="bg-white/10 hover:bg-white/20 text-white border border-white/15 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                title="Print 1 single 80mm thermal receipt with all paid classes for this month"
                                            >
                                                <Printer size={14} className="text-blue-400" />
                                                <span>Print Monthly Combined Slip</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DUAL VIEW / TABBED VIEW CONTAINER (NO-SCROLL LAYOUT) */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
                            
                            {/* CLASS CARDS FEED (Takes 6 cols in Dual View, 12 cols in Classes view, Hidden in Calendar view) */}
                            {(activeViewMode === 'dual' || activeViewMode === 'classes') && (
                                <div className={`${activeViewMode === 'dual' ? 'xl:col-span-6' : 'xl:col-span-12'} bg-black/40 backdrop-blur-xl border border-white/20 p-4 rounded-3xl shadow-lg flex flex-col`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                                                <BookOpen size={16} className="text-indigo-400" /> Allocated Classes & Card Types
                                            </h3>
                                            <span className="text-[11px] text-white/60 font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                                                {studentEnrolledClasses.length} Classes
                                            </span>
                                        </div>

                                        {studentEnrolledClasses.length > 1 && (
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const dueIds = studentEnrolledClasses
                                                            .filter(cls => {
                                                                const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
                                                                const joinDate = cls.enrolledAt || studentData?.createdAt;
                                                                const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
                                                                if (!pRecord && joinMonthStr && activeMonthStr < joinMonthStr) return false;

                                                                const cType = cls.cardType || studentData?.cardType || 'FULL';
                                                                const expectedFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
                                                                const isPaid = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT');
                                                                return cType !== 'FREE' && !isPaid;
                                                            })
                                                            .map(c => c.id);
                                                        setSelectedClassIdsForMultiPay(dueIds);
                                                    }}
                                                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white cursor-pointer font-semibold"
                                                >
                                                    Select Due
                                                </button>
                                                {selectedClassIdsForMultiPay.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedClassIdsForMultiPay([])}
                                                        className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-rose-500/20 text-rose-300 cursor-pointer font-semibold"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!studentData ? (
                                        <div className="text-center py-8 text-white/40">
                                            <BookOpen size={30} className="mx-auto mb-1 opacity-30" />
                                            <p className="text-xs">Scan or search student to view allocated class fee cards</p>
                                        </div>
                                    ) : studentEnrolledClasses.length === 0 ? (
                                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-center text-amber-300 text-xs font-bold">
                                            No classes allocated yet. Use "Allocate Class" on the left.
                                        </div>
                                    ) : (
                                        <div className={`space-y-3.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1.5 custom-scrollbar`}>
                                            {studentEnrolledClasses.map(cls => {
                                                const pRecord = feePayments.find(p => p.classId === cls.id && p.month === activeMonthStr);
                                                const joinDate = cls.enrolledAt || studentData?.createdAt;
                                                const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
                                                const isBeforeEnrollment = !pRecord && joinMonthStr && activeMonthStr < joinMonthStr;

                                                const cType = cls.cardType || studentData.cardType || 'FULL';
                                                const expectedFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? (cls.monthlyFee || 0) / 2 : (cls.monthlyFee || 0));
                                                
                                                const isPaidRecord = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT');
                                                const isPartialRecord = pRecord && pRecord.status === 'PARTIAL';
                                                
                                                const paidAmount = isPaidRecord 
                                                    ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : expectedFee))
                                                    : (isPartialRecord ? (pRecord.amount || 0) : 0);
                                                
                                                const dueAmount = (cType === 'FREE' || isBeforeEnrollment) ? 0 : Math.max(0, expectedFee - paidAmount);

                                                const teacherNames = cls.teachers && cls.teachers.length > 0 
                                                    ? cls.teachers.map(t => t.name).join(', ') 
                                                    : 'Lecturer';

                                                const isClassSelected = selectedClassIdsForMultiPay.includes(cls.id);

                                                return (
                                                    <div 
                                                        key={cls.id}
                                                        className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between relative shadow-xl ${
                                                            isClassSelected
                                                                ? 'ring-2 ring-blue-400/80 bg-gradient-to-b from-blue-950/50 via-slate-900/90 to-slate-950 border-blue-500/60'
                                                                : isPaidRecord 
                                                                    ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950 border-emerald-500/40 shadow-emerald-950/20' 
                                                                    : isPartialRecord 
                                                                        ? 'bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950 border-amber-500/40 shadow-amber-950/20' 
                                                                        : isBeforeEnrollment
                                                                            ? 'bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 border-white/5 opacity-80'
                                                                            : 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950 border-white/15'
                                                        }`}
                                                    >
                                                        {/* Top Header */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                                    {cType !== 'FREE' && !isPaidRecord && !isBeforeEnrollment && (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isClassSelected}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedClassIdsForMultiPay(prev => [...prev, cls.id]);
                                                                                } else {
                                                                                    setSelectedClassIdsForMultiPay(prev => prev.filter(id => id !== cls.id));
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 mt-1 rounded text-blue-600 bg-black/40 border-white/20 focus:ring-0 cursor-pointer shrink-0"
                                                                            title="Select for Multi-Class Pay"
                                                                        />
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                                                                                {cls.grade || 'A/L'}
                                                                            </span>
                                                                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                                                                <CalendarIcon size={11} />
                                                                                <span>{format(viewMonth, 'MMMM yyyy')}</span>
                                                                            </span>
                                                                            <span className="text-xs font-bold text-white/70 flex items-center gap-1">
                                                                                <span>👨‍🏫</span> {teacherNames}
                                                                            </span>

                                                                            {/* PROMINENT STATUS BADGE IN CLASS HEADER */}
                                                                            {cType === 'FREE' ? (
                                                                                <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-sm ml-auto">
                                                                                    🎁 FREE CARD
                                                                                </span>
                                                                            ) : isPaidRecord ? (
                                                                                <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white border border-emerald-400 shadow-md shadow-emerald-500/30 flex items-center gap-1 ml-auto">
                                                                                    <CheckCircle2 size={13} /> PAID ✓
                                                                                </span>
                                                                            ) : isPartialRecord ? (
                                                                                <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border border-amber-300 shadow-md shadow-amber-500/30 flex items-center gap-1 ml-auto">
                                                                                    <Clock size={13} /> PARTIAL (Rs. {paidAmount.toLocaleString()})
                                                                                </span>
                                                                            ) : isBeforeEnrollment ? (
                                                                                <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 shadow-sm flex items-center gap-1 ml-auto" title={`Joined in ${joinMonthStr}`}>
                                                                                    <Clock size={13} /> NOT ENROLLED (N/A)
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[11px] font-black px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white border border-rose-400 shadow-md shadow-rose-600/30 flex items-center gap-1 ml-auto animate-pulse">
                                                                                    <AlertCircle size={13} /> NOT PAID ⚠️
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <h4 className="font-extrabold text-white text-base leading-snug tracking-tight">
                                                                            {cls.name}
                                                                        </h4>
                                                                    </div>
                                                                </div>

                                                                {/* Action Icons */}
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setClassHistoryModal({
                                                                            isOpen: true,
                                                                            classObj: cls,
                                                                            year: viewMonth.getFullYear()
                                                                        })}
                                                                        className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/25 transition-all cursor-pointer active:scale-95"
                                                                        title="View 12 Months History"
                                                                    >
                                                                        <CalendarIcon size={14} />
                                                                    </button>

                                                                    {(isPaidRecord || isPartialRecord) && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handlePrintClassReceipt(cls, activeMonthStr, pRecord)}
                                                                                className="p-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/25 transition-all cursor-pointer active:scale-95"
                                                                                title="Print 80mm Receipt"
                                                                            >
                                                                                <Printer size={14} />
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleReverseFeePayment(cls.id, activeMonthStr)}
                                                                                className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/25 transition-all cursor-pointer active:scale-95"
                                                                                title="Reverse Mistaken / Future Month Payment"
                                                                            >
                                                                                <RotateCcw size={14} />
                                                                            </button>
                                                                        </>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => unallocateClass(cls.id, cls.name)}
                                                                        className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-white/10 transition-all cursor-pointer active:scale-95"
                                                                        title="Remove Class"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* INLINE CARD TYPE SELECTOR (Segmented Control Full / Half / Free) */}
                                                            <div className="p-1.5 bg-black/50 rounded-xl border border-white/10 flex items-center justify-between gap-1">
                                                                <span className="text-[10px] text-white/60 uppercase font-extrabold ml-1 tracking-wider">Card Type:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateClassCardType(cls.id, 'FULL')}
                                                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                                            cType === 'FULL' 
                                                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                                                                : 'text-white/50 hover:text-white bg-white/5'
                                                                        }`}
                                                                    >
                                                                        Full Card (100%)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateClassCardType(cls.id, 'HALF')}
                                                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                                            cType === 'HALF' 
                                                                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30' 
                                                                                : 'text-white/50 hover:text-white bg-white/5'
                                                                        }`}
                                                                    >
                                                                        Half (50%)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateClassCardType(cls.id, 'FREE')}
                                                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                                            cType === 'FREE' 
                                                                                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' 
                                                                                : 'text-white/50 hover:text-white bg-white/5'
                                                                        }`}
                                                                    >
                                                                        Free (0%)
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Status & Fee Details Box */}
                                                            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10 space-y-2.5 text-xs shadow-inner">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-white/70 font-bold">Monthly Class Fee:</span>
                                                                    <span className="font-extrabold text-white text-sm">
                                                                        Rs. {expectedFee.toLocaleString()} {cType === 'HALF' ? '(50% Off)' : cType === 'FREE' ? '(Free)' : ''}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center justify-between py-1 border-t border-b border-white/5">
                                                                    <span className="text-white/80 font-extrabold text-xs">Fee Status ({format(viewMonth, 'MMMM yyyy')}):</span>
                                                                    {cType === 'FREE' ? (
                                                                        <span className="text-xs font-black text-purple-300 bg-purple-500/25 px-3 py-1 rounded-xl border border-purple-500/40">
                                                                            🎁 FREE CARD (0% Fee)
                                                                        </span>
                                                                    ) : isPaidRecord ? (
                                                                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/25 px-3 py-1 rounded-xl border border-emerald-400/50 flex items-center gap-1.5 shadow-sm">
                                                                            <CheckCircle2 size={14} /> PAID (Rs. {paidAmount.toLocaleString()})
                                                                        </span>
                                                                    ) : isPartialRecord ? (
                                                                        <span className="text-xs font-black text-amber-300 bg-amber-500/25 px-3 py-1 rounded-xl border border-amber-400/50 flex items-center gap-1.5 shadow-sm">
                                                                            ⚡ PARTIAL (Paid: Rs. {paidAmount.toLocaleString()})
                                                                        </span>
                                                                    ) : isBeforeEnrollment ? (
                                                                        <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm">
                                                                            <Clock size={14} /> NOT ENROLLED YET (Joined {joinMonthStr})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs font-black text-rose-300 bg-rose-500/25 px-3 py-1 rounded-xl border border-rose-400/50 flex items-center gap-1.5 shadow-sm animate-pulse">
                                                                            ⚠️ NOT PAID (DUE: Rs. {dueAmount.toLocaleString()})
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {dueAmount > 0 && cType !== 'FREE' && !isBeforeEnrollment && (
                                                                    <div className="bg-rose-500/20 border border-rose-500/40 px-3.5 py-2 rounded-xl flex items-center justify-between shadow-sm">
                                                                        <span className="text-rose-200 font-black text-xs">Remaining Due for {format(viewMonth, 'MMMM')}:</span>
                                                                        <span className="text-rose-300 font-black text-base">Rs. {dueAmount.toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Payment Action Buttons */}
                                                        <div className="pt-3 border-t border-white/10 flex items-center gap-2 mt-3">
                                                            {cType !== 'FREE' && (
                                                                <>
                                                                    {isPaidRecord ? (
                                                                        <>
                                                                            <div className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5 select-none shadow-sm">
                                                                                <CheckCircle2 size={14} className="text-emerald-400" />
                                                                                <span>PAID ✓</span>
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (window.confirm(`Are you sure you want to cancel payment and mark "${cls.name}" as UNPAID (Non-Paid) for ${format(viewMonth, 'MMMM yyyy')}?`)) {
                                                                                        handleClassFeePayment(cls.id, activeMonthStr, 'PAID');
                                                                                    }
                                                                                }}
                                                                                className="py-2.5 px-3 rounded-xl text-xs font-black bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 shrink-0"
                                                                                title={`Cancel payment and mark as UNPAID for ${format(viewMonth, 'MMMM yyyy')}`}
                                                                            >
                                                                                <RotateCcw size={13} className="text-rose-400" />
                                                                                <span>Mark Unpaid</span>
                                                                            </button>

                                                                            {/* Direct Next Month Navigation Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setViewMonth(prev => addMonths(prev, 1))}
                                                                                className="py-2.5 px-3.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 shadow-md"
                                                                                title={`Go to next month (${format(addMonths(viewMonth, 1), 'MMMM yyyy')}) to pay`}
                                                                            >
                                                                                <span>Next Month</span>
                                                                                <ChevronRight size={14} />
                                                                            </button>
                                                                        </>
                                                                    ) : isPartialRecord ? (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleClassFeePayment(cls.id, activeMonthStr, 'PENDING', dueAmount)}
                                                                                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-98 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black"
                                                                            >
                                                                                <Sparkles size={14} />
                                                                                <span>Pay Balance (Rs. {dueAmount.toLocaleString()})</span>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setCustomPayModal({
                                                                                    isOpen: true,
                                                                                    classObj: cls,
                                                                                    monthStr: activeMonthStr,
                                                                                    amount: String(dueAmount),
                                                                                    isIncremental: true,
                                                                                    paymentMethod: 'CASH',
                                                                                    remark: ''
                                                                                })}
                                                                                className="py-2.5 px-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 hover:border-white/25 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-98"
                                                                            >
                                                                                <DollarSign size={13} />
                                                                                <span>Custom Pay</span>
                                                                            </button>
                                                                        </>
                                                                    ) : isBeforeEnrollment ? (
                                                                        <div className="flex-1 flex items-center justify-between text-xs text-slate-400 bg-white/5 py-2 px-3 rounded-xl border border-white/5">
                                                                            <span className="italic text-slate-400 text-[11px]">No payment due before registration ({joinMonthStr})</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setCustomPayModal({
                                                                                    isOpen: true,
                                                                                    classObj: cls,
                                                                                    monthStr: activeMonthStr,
                                                                                    amount: String(expectedFee),
                                                                                    isIncremental: false,
                                                                                    paymentMethod: 'CASH',
                                                                                    remark: 'Previous month payment'
                                                                                })}
                                                                                className="py-1 px-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                                            >
                                                                                Record Past Fee
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleClassFeePayment(cls.id, activeMonthStr, 'PENDING', expectedFee)}
                                                                                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-98 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/25"
                                                                            >
                                                                                <Check size={14} />
                                                                                <span>✓ 1-Click Full Pay</span>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setCustomPayModal({
                                                                                    isOpen: true,
                                                                                    classObj: cls,
                                                                                    monthStr: activeMonthStr,
                                                                                    amount: String(expectedFee),
                                                                                    isIncremental: false,
                                                                                    paymentMethod: 'CASH',
                                                                                    remark: ''
                                                                                })}
                                                                                className="py-2.5 px-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 hover:border-white/25 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-98"
                                                                            >
                                                                                <DollarSign size={13} />
                                                                                <span>Custom Pay</span>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* PRESERVED HISTORICAL / DE-ALLOCATED CLASSES SECTION */}
                                    {studentHistoricalClasses.length > 0 && (
                                        <div className="mt-4 pt-3.5 border-t border-white/10 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <span>📜</span> Preserved Historical / De-allocated Classes ({studentHistoricalClasses.length})
                                                </span>
                                                <span className="text-[10px] text-white/50">Past Fee Records Intact</span>
                                            </div>
                                            <div className="space-y-2">
                                                {studentHistoricalClasses.map(hCls => (
                                                    <div key={hCls.id} className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/20 via-black/40 to-black/60 border border-amber-500/30 flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-white text-xs truncate">{hCls.name}</h4>
                                                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30 shrink-0">
                                                                    De-allocated
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-white/50 mt-0.5 truncate">{hCls.grade} • Previous Fee Payments Preserved in Database</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setClassHistoryModal({
                                                                    isOpen: true,
                                                                    classObj: hCls,
                                                                    year: viewMonth.getFullYear()
                                                                })}
                                                                className="p-1.5 px-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                                                title="View 12 Months Payment History for this Class"
                                                            >
                                                                <CalendarIcon size={12} /> View History
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        {/* ATTENDANCE CALENDAR WIDGET (Takes 6 cols in Dual View, 12 cols in Calendar View, Hidden in Classes View) */}
                        {(activeViewMode === 'dual' || activeViewMode === 'calendar') && (
                            <div className={`${activeViewMode === 'dual' ? 'xl:col-span-6' : 'xl:col-span-12'} bg-black/40 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-3xl shadow-lg flex flex-col justify-between`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                        <CalendarDays size={18} className="text-emerald-400" /> Attendance Calendar
                                    </h3>
                                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-black">
                                        {attendances.filter(a => format(new Date(a.date), 'yyyy-MM') === activeMonthStr && a.status === 'PRESENT').length} Days Present
                                    </span>
                                </div>

                                {renderCalendarMonth(viewMonth)}
                            </div>
                        )}

                    </div>

                </div>

            </div>

            {/* PER-CLASS 12-MONTH PAYMENT HISTORY MODAL (EXPANDED TILES GRID) */}
            {classHistoryModal.isOpen && classHistoryModal.classObj && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-6 max-w-6xl w-full text-white shadow-2xl relative space-y-4 max-h-[92vh] flex flex-col">
                        
                        <button
                            onClick={() => setClassHistoryModal({ isOpen: false, classObj: null, year: new Date().getFullYear() })}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-500/30 text-purple-400 shadow-md">
                                    <CalendarIcon size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                        {classHistoryModal.classObj.name}
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                            Monthly Fee History
                                        </span>
                                    </h3>
                                    <p className="text-xs text-white/50">
                                        {studentData ? `Payment records for ${studentData.studentName || studentData.firstName} (${studentData.studentId})` : ''}
                                    </p>
                                </div>
                            </div>

                            {/* Current Year Jump Button */}
                            {classHistoryModal.year !== new Date().getFullYear() && (
                                <button
                                    onClick={() => setClassHistoryModal(prev => ({ ...prev, year: new Date().getFullYear() }))}
                                    className="self-start sm:self-center px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Clock size={13} /> Jump to This Year ({new Date().getFullYear()})
                                </button>
                            )}
                        </div>

                        {/* Year Selector & Future Year Warning */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-2xl border border-white/10">
                                <button
                                    onClick={() => setClassHistoryModal(prev => ({ ...prev, year: prev.year - 1 }))}
                                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                    ◀ {classHistoryModal.year - 1}
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-lg text-white tracking-wide">{classHistoryModal.year}</span>
                                    <span className="text-xs uppercase font-bold text-white/50 tracking-wider">Fee Calendar</span>
                                </div>
                                <button
                                    onClick={() => setClassHistoryModal(prev => ({ ...prev, year: prev.year + 1 }))}
                                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                    {classHistoryModal.year + 1} ▶
                                </button>
                            </div>

                            {classHistoryModal.year > new Date().getFullYear() && (
                                <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2">
                                    <AlertCircle size={16} className="text-amber-400 shrink-0" />
                                    <span>
                                        <strong>⚠️ Future Year Alert:</strong> You are viewing future year <strong>{classHistoryModal.year}</strong>. Any fees marked here will be recorded under {classHistoryModal.year}.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 12 Months Tiles Grid (3 rows x 4 cols on desktop) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 flex-1 overflow-y-auto p-1 custom-scrollbar">
                            {Array.from({ length: 12 }, (_, idx) => {
                                const mDate = new Date(classHistoryModal.year, idx, 1);
                                const mStr = format(mDate, 'yyyy-MM');
                                const pRecord = feePayments.find(p => p.classId === classHistoryModal.classObj.id && p.month === mStr);
                                
                                const enr = studentData?.enrollments?.find(e => e.classId === classHistoryModal.classObj.id);
                                const joinDate = enr?.createdAt || studentData?.createdAt;
                                const joinMonthStr = joinDate ? format(new Date(joinDate), 'yyyy-MM') : null;
                                const isBeforeEnrollment = !pRecord && joinMonthStr && mStr < joinMonthStr;

                                const cType = enr?.cardType || studentData?.cardType || 'FULL';
                                const fullFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? (classHistoryModal.classObj.monthlyFee || 0) / 2 : (classHistoryModal.classObj.monthlyFee || 0));

                                const isPaid = pRecord && (pRecord.status === 'PAID' || pRecord.status === 'FREE_CARD' || pRecord.status === 'HALF_PAYMENT');
                                const isPartial = pRecord && pRecord.status === 'PARTIAL';
                                const isFree = cType === 'FREE' || pRecord?.status === 'FREE_CARD';
                                const paidVal = isPaid ? (cType === 'FREE' ? 0 : (pRecord.amount !== undefined ? pRecord.amount : fullFee)) : (isPartial ? (pRecord.amount || 0) : 0);
                                const dueVal = (isBeforeEnrollment || cType === 'FREE') ? 0 : Math.max(0, fullFee - paidVal);

                                return (
                                    <div 
                                        key={mStr}
                                        className={`rounded-2xl p-4 border transition-all flex flex-col justify-between shadow-lg relative ${
                                            isPaid 
                                                ? 'bg-emerald-950/25 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-950/20' 
                                                : isPartial 
                                                    ? 'bg-amber-950/25 border-amber-500/30 hover:border-amber-500/50 shadow-amber-950/20' 
                                                    : isFree
                                                        ? 'bg-purple-950/25 border-purple-500/30 hover:border-purple-500/50 shadow-purple-950/20'
                                                        : isBeforeEnrollment
                                                            ? 'bg-slate-900/40 border-white/5 opacity-70'
                                                            : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        {/* Month Card Header */}
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                                        isPaid ? 'bg-emerald-500/20 text-emerald-300' : isPartial ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/70'
                                                    }`}>
                                                        {String(idx + 1).padStart(2, '0')}
                                                    </span>
                                                    <div>
                                                        <h4 className="font-bold text-sm text-white">{format(mDate, 'MMMM')}</h4>
                                                        <span className="text-[10px] text-white/50">{mStr}</span>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                {isFree ? (
                                                    <span className="text-[10px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                                                        FREE
                                                    </span>
                                                ) : isPaid ? (
                                                    <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                                        <Check size={11} /> PAID
                                                    </span>
                                                ) : isPartial ? (
                                                    <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                                        PARTIAL
                                                    </span>
                                                ) : isBeforeEnrollment ? (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                        NOT ENROLLED
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                                                        UNPAID
                                                    </span>
                                                )}
                                            </div>

                                            {/* Financial Details Box */}
                                            {isBeforeEnrollment ? (
                                                <div className="bg-black/30 rounded-xl p-2.5 space-y-1 mb-3 text-xs">
                                                    <div className="flex justify-between items-center text-white/50">
                                                        <span>Status:</span>
                                                        <span className="italic text-slate-400">Joined in {joinMonthStr}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-white/50">
                                                        <span>Standard Fee:</span>
                                                        <span className="text-white/50">Rs. {fullFee.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-black/30 rounded-xl p-2.5 space-y-1 mb-3 text-xs">
                                                    <div className="flex justify-between items-center text-white/60">
                                                        <span>Standard Fee:</span>
                                                        <span className="font-semibold text-white">Rs. {fullFee.toLocaleString()}</span>
                                                    </div>
                                                    {paidVal > 0 && (
                                                        <div className="flex justify-between items-center text-emerald-400 font-bold">
                                                            <span>Paid:</span>
                                                            <span>Rs. {paidVal.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {dueVal > 0 && (
                                                        <div className="flex justify-between items-center text-rose-400 font-bold">
                                                            <span>Due Balance:</span>
                                                            <span>Rs. {dueVal.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {pRecord?.paidDate && (
                                                        <div className="text-[10px] text-white/40 pt-1 border-t border-white/5 flex items-center justify-between">
                                                            <span>Paid On:</span>
                                                            <span>{new Date(pRecord.paidDate).toISOString().slice(0, 10)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons Footer */}
                                        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 justify-between">
                                            {(isPaid || isPartial) ? (
                                                <>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrintClassReceipt(classHistoryModal.classObj, mStr, pRecord)}
                                                            className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs cursor-pointer"
                                                            title="Print Thermal Receipt"
                                                        >
                                                            <Printer size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setMoveMonthModal({
                                                                isOpen: true,
                                                                classObj: classHistoryModal.classObj,
                                                                currentMonth: mStr,
                                                                targetMonth: '',
                                                                pRecord,
                                                                loading: false
                                                            })}
                                                            className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                                            title="Move payment to another month"
                                                        >
                                                            <CalendarIcon size={12} /> Move
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReverseFeePayment(classHistoryModal.classObj.id, mStr)}
                                                            className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                                            title="Reverse accidental/wrong payment & adjust cashflow"
                                                        >
                                                            <RotateCcw size={12} /> Reverse
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setClassHistoryModal({ isOpen: false, classObj: null, year: new Date().getFullYear() });
                                                                setCustomPayModal({
                                                                    isOpen: true,
                                                                    classObj: classHistoryModal.classObj,
                                                                    monthStr: mStr,
                                                                    amount: dueVal > 0 ? String(dueVal) : String(fullFee),
                                                                    isIncremental: isPartial,
                                                                    paymentMethod: 'CASH',
                                                                    remark: ''
                                                                });
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </>
                                            ) : isBeforeEnrollment ? (
                                                <div className="w-full flex items-center justify-between text-xs text-slate-500 italic py-1">
                                                    <span className="text-[11px]">No fee due before registration</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setClassHistoryModal({ isOpen: false, classObj: null, year: new Date().getFullYear() });
                                                            setCustomPayModal({
                                                                isOpen: true,
                                                                classObj: classHistoryModal.classObj,
                                                                monthStr: mStr,
                                                                amount: String(fullFee),
                                                                isIncremental: false,
                                                                paymentMethod: 'CASH',
                                                                remark: 'Previous month payment'
                                                            });
                                                        }}
                                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-medium transition-all cursor-pointer"
                                                    >
                                                        Record Fee (Optional)
                                                    </button>
                                                </div>
                                            ) : cType !== 'FREE' ? (
                                                <div className="w-full flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (classHistoryModal.year > new Date().getFullYear()) {
                                                                if (!window.confirm(`⚠️ You are marking class fee for FUTURE YEAR ${classHistoryModal.year} (${mStr})!\n\nAre you sure you want to mark this future month as PAID?`)) {
                                                                    return;
                                                                }
                                                            }
                                                            handleClassFeePayment(classHistoryModal.classObj.id, mStr, 'PAID');
                                                        }}
                                                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Check size={13} /> Pay Rs. {fullFee.toLocaleString()}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setClassHistoryModal({ isOpen: false, classObj: null, year: new Date().getFullYear() });
                                                            setCustomPayModal({
                                                                isOpen: true,
                                                                classObj: classHistoryModal.classObj,
                                                                monthStr: mStr,
                                                                amount: String(fullFee),
                                                                isIncremental: false,
                                                                paymentMethod: 'CASH',
                                                                remark: ''
                                                            });
                                                        }}
                                                        className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold transition-all cursor-pointer"
                                                        title="Custom or Partial Amount"
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </div>
            )}

            {/* MOVE ACCIDENTAL FEE PAYMENT TO ANOTHER MONTH MODAL */}
            {moveMonthModal.isOpen && moveMonthModal.classObj && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl relative space-y-4">
                        <button
                            onClick={() => setMoveMonthModal({ isOpen: false, classObj: null, currentMonth: '', targetMonth: '', pRecord: null, loading: false })}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                                <CalendarIcon size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white">Move Payment Month</h3>
                                <p className="text-xs text-white/50">{moveMonthModal.classObj.name}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-white/60">Current Recorded Month:</span>
                                <span className="font-bold text-rose-400">{moveMonthModal.currentMonth}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Paid Amount:</span>
                                <span className="font-bold text-emerald-400">Rs. {Number(moveMonthModal.pRecord?.amount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Paid Date:</span>
                                <span className="font-bold text-white">{moveMonthModal.pRecord?.paidDate ? new Date(moveMonthModal.pRecord.paidDate).toISOString().slice(0, 10) : 'N/A'}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                Select Target Month
                            </label>
                            <input 
                                type="month"
                                value={moveMonthModal.targetMonth}
                                onChange={(e) => setMoveMonthModal(prev => ({ ...prev, targetMonth: e.target.value }))}
                                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                            />
                            <p className="text-[11px] text-slate-400">
                                This will transfer the payment record and update the Cashflow entry to the selected month.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setMoveMonthModal({ isOpen: false, classObj: null, currentMonth: '', targetMonth: '', pRecord: null, loading: false })}
                                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!moveMonthModal.targetMonth || moveMonthModal.loading}
                                onClick={() => handleMoveFeePayment(moveMonthModal.classObj.id, moveMonthModal.currentMonth, moveMonthModal.targetMonth)}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {moveMonthModal.loading ? 'Moving...' : 'Confirm Move'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM / PARTIAL PAYMENT MODAL (Instant Auto-Print) */}
            {customPayModal.isOpen && customPayModal.classObj && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-6 max-w-md w-full text-white shadow-2xl relative space-y-4">
                        
                        <button
                            onClick={() => setCustomPayModal({ isOpen: false, classObj: null, monthStr: '', amount: '', isIncremental: false, paymentMethod: 'CASH', remark: '' })}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
                                <DollarSign size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">Record Custom Fee Payment</h3>
                                <p className="text-xs text-white/50">{customPayModal.classObj.name} ({customPayModal.monthStr})</p>
                            </div>
                        </div>

                        {/* Summary Pill */}
                        <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                            <div className="flex justify-between text-white/70">
                                <span>Student:</span>
                                <span className="font-bold text-white">{studentData?.studentName || studentData?.firstName} ({studentData?.studentId})</span>
                            </div>
                            <div className="flex justify-between text-white/70">
                                <span>Month:</span>
                                <span className="font-bold text-white">{customPayModal.monthStr}</span>
                            </div>
                            <div className="flex justify-between text-white/70">
                                <span>Class Fee:</span>
                                <span className="font-bold text-emerald-400">
                                    Rs. {customPayModal.classObj.cardType === 'HALF' ? (customPayModal.classObj.monthlyFee || 0) / 2 : customPayModal.classObj.monthlyFee}
                                </span>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/70 uppercase tracking-wider block">
                                Payment Amount (Rs.)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold text-sm">Rs.</span>
                                <input 
                                    type="number" 
                                    placeholder="Enter amount (e.g. 2000)" 
                                    value={customPayModal.amount}
                                    onChange={e => setCustomPayModal(prev => ({ ...prev, amount: e.target.value }))}
                                    className="w-full bg-slate-800 border border-white/20 rounded-xl pl-11 pr-4 py-2.5 text-white text-sm font-black focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => setCustomPayModal(prev => ({ ...prev, amount: String((customPayModal.classObj.monthlyFee || 0) / 2) }))}
                                    className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white/80 transition-all cursor-pointer"
                                >
                                    50% (Rs. {(customPayModal.classObj.monthlyFee || 0) / 2})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomPayModal(prev => ({ ...prev, amount: String(customPayModal.classObj.cardType === 'HALF' ? (customPayModal.classObj.monthlyFee || 0) / 2 : customPayModal.classObj.monthlyFee || 0) }))}
                                    className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white/80 transition-all cursor-pointer"
                                >
                                    Full Fee
                                </button>
                            </div>
                        </div>

                        {/* Remark Note */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-white/70 uppercase tracking-wider block">
                                Remarks / Notes (Optional)
                            </label>
                            <input 
                                type="text" 
                                placeholder="e.g. Paid Rs. 2000 today" 
                                value={customPayModal.remark}
                                onChange={e => setCustomPayModal(prev => ({ ...prev, remark: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleCustomPaymentSubmit}
                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <CheckCircle2 size={16} />
                            <span>Confirm & Print Receipt</span>
                        </button>

                    </div>
                </div>
            )}

            {/* FULL ATTENDANCE HISTORY MODAL */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-7 max-w-2xl w-full text-white shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
                        <button
                            onClick={() => setIsHistoryModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-500/20 rounded-xl border border-purple-500/30 text-purple-400">
                                <History size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">Full Attendance History Log 📅</h3>
                                <p className="text-xs text-gray-400">
                                    {studentData ? `Complete attendance records for ${studentData.studentName || studentData.firstName}` : 'Select a student to view complete attendance history'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-xs text-white/50 uppercase font-bold">Total Days Present</p>
                                <p className="text-xl font-black text-emerald-400 mt-0.5">{attendances.filter(a => a.status === 'PRESENT').length} Days</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-white/50 uppercase font-bold">Student ID</p>
                                <p className="text-sm font-bold text-white">{studentData?.studentId || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-2">
                            {attendances.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Clock size={36} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-xs">No attendance records logged yet.</p>
                                </div>
                            ) : (
                                attendances.map(att => (
                                    <div key={att.id} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                                                <CheckCircle size={14} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-xs text-white">{format(new Date(att.date), 'EEEE, MMMM dd, yyyy')}</p>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold uppercase">
                                            PRESENT
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK CARD / RFID SCAN & ALLOCATE MODAL */}
            {cardScanModal.isOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="bg-[#0f111a] border border-white/15 rounded-3xl p-6 sm:p-7 max-w-md w-full text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden font-sans space-y-4">
                        
                        {/* Ambient Background Glow */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 relative z-10">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 flex items-center justify-center text-white shrink-0 border border-white/20">
                                    <CreditCard size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-black text-white tracking-tight">Allocate Physical ID Card</h3>
                                    <p className="text-xs text-white/60 truncate mt-0.5">
                                        Student: <span className="text-blue-300 font-bold">{studentData?.studentName || studentData?.firstName}</span>
                                    </p>
                                    <p className="text-[11px] text-white/40 font-sans font-semibold">{studentData?.studentId}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setCardScanModal({ isOpen: false, inputRfid: '', loading: false })}
                                className="text-white/40 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Card Input Field */}
                        <div className="space-y-2 relative z-10 pt-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                                    Physical ID Card / Barcode
                                </label>
                                {cardScanModal.inputRfid && (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                        Ready to Bind
                                    </span>
                                )}
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Scan barcode (e.g. +1488) or enter code..."
                                    value={cardScanModal.inputRfid}
                                    onChange={(e) => setCardScanModal(prev => ({ ...prev, inputRfid: e.target.value.trim() }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAllocateCard(cardScanModal.inputRfid);
                                        }
                                    }}
                                    className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl px-4 py-3.5 text-white font-sans text-sm font-bold tracking-wide placeholder:text-white/30 outline-none transition-all"
                                />
                            </div>

                            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                                <span className="text-blue-400 text-sm leading-none">⚡</span>
                                <span>
                                    Scan with hardware barcode scanner and press <strong>Enter</strong> to auto-bind, or type code and click <strong>Save & Bind Card</strong>.
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2.5 pt-2 relative z-10">
                            {studentData?.rfid && (
                                <button
                                    type="button"
                                    onClick={() => handleAllocateCard('')}
                                    disabled={cardScanModal.loading}
                                    className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                                >
                                    Unlink Card
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => handleAllocateCard(cardScanModal.inputRfid)}
                                disabled={cardScanModal.loading || !cardScanModal.inputRfid}
                                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <CheckCircle2 size={16} />
                                <span>{cardScanModal.loading ? 'Saving Card...' : 'Save & Bind Card'}</span>
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* MULTI-CLASS BATCH PAYMENT MODAL */}
            {multiPayModal.isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-6 max-w-2xl w-full text-white shadow-2xl relative space-y-4 max-h-[90vh] flex flex-col font-sans">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-white">
                                        Multi-Class Payment & Combined Receipt
                                    </h3>
                                    <p className="text-xs text-white/50">
                                        {studentData?.studentName || studentData?.firstName} ({studentData?.studentId}) • {format(viewMonth, 'MMMM yyyy')}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setMultiPayModal({ isOpen: false, monthStr: '', paymentMethod: 'CASH', remark: '', items: [], loading: false })}
                                className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Quick Toggle All */}
                        <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/10 text-xs">
                            <span className="text-white/70 font-semibold">Select classes to include in single combined receipt:</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMultiPayModal(prev => ({
                                            ...prev,
                                            items: prev.items.map(it => ({ ...it, isSelected: !it.isPaidRecord && it.cardType !== 'FREE' }))
                                        }));
                                    }}
                                    className="text-[11px] font-bold px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-md border border-blue-500/30 cursor-pointer"
                                >
                                    Select Due Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMultiPayModal(prev => ({
                                            ...prev,
                                            items: prev.items.map(it => ({ ...it, isSelected: false }))
                                        }));
                                    }}
                                    className="text-[11px] font-bold px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded-md border border-white/10 cursor-pointer"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Classes List */}
                        <div className="space-y-2.5 overflow-y-auto max-h-[42vh] pr-1.5 custom-scrollbar">
                            {multiPayModal.items.map((it, idx) => {
                                return (
                                    <div
                                        key={it.classId}
                                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                            it.isSelected
                                                ? 'bg-gradient-to-r from-blue-950/50 via-slate-900/90 to-slate-900 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                                                : it.isPaidRecord
                                                    ? 'bg-emerald-950/20 border-emerald-500/25 opacity-80'
                                                    : 'bg-white/[0.02] border-white/10 opacity-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <input
                                                type="checkbox"
                                                disabled={it.isPaidRecord || it.cardType === 'FREE'}
                                                checked={it.isSelected}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setMultiPayModal(prev => ({
                                                        ...prev,
                                                        items: prev.items.map((item, i) => i === idx ? { ...item, isSelected: checked } : item)
                                                    }));
                                                }}
                                                className="w-4 h-4 rounded text-blue-600 bg-black/40 border-white/20 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start gap-2 justify-between flex-wrap">
                                                    <h4 className="font-extrabold text-sm text-white tracking-tight break-words leading-snug flex-1" title={it.className}>{it.className}</h4>
                                                    {it.isPaidRecord ? (
                                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                                            <Lock size={10} /> PAID ✓
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                                                            it.cardType === 'FREE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                            it.cardType === 'HALF' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                                            'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                        }`}>
                                                            {it.cardType}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-white/60 mt-0.5 font-medium">
                                                    Full Fee: <strong className="text-white">Rs. {it.expectedFee.toLocaleString()}</strong> {it.currentPaid > 0 ? `• Paid: Rs. ${it.currentPaid.toLocaleString()}` : ''} {it.dueAmount > 0 ? `• Due: Rs. ${it.dueAmount.toLocaleString()}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pay Amount input */}
                                        <div className="text-right shrink-0">
                                            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-2 rounded-xl border border-white/20 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 shadow-inner transition-all">
                                                <span className="text-xs font-black text-emerald-400 select-none">Rs.</span>
                                                <input
                                                    type="number"
                                                    disabled={!it.isSelected || it.cardType === 'FREE'}
                                                    value={it.cardType === 'FREE' ? '0' : it.payAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMultiPayModal(prev => ({
                                                            ...prev,
                                                            items: prev.items.map((item, i) => i === idx ? { ...item, payAmount: val } : item)
                                                        }));
                                                    }}
                                                    className="w-24 bg-transparent text-right font-sans font-black text-sm text-white outline-none disabled:opacity-30 tracking-tight"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Optional Remark / Note */}
                        <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                            <span className="text-xs text-white/60 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-emerald-400" /> Cash Payment (Counter POS)
                            </span>
                            <input
                                type="text"
                                placeholder="Add optional note/remark (e.g. Paid at desk)..."
                                value={multiPayModal.remark}
                                onChange={(e) => setMultiPayModal(prev => ({ ...prev, remark: e.target.value }))}
                                className="w-full sm:max-w-sm bg-slate-800/80 border border-white/15 focus:border-emerald-400 rounded-xl px-3.5 py-2 text-xs font-medium text-white outline-none placeholder:text-white/30 transition-all"
                            />
                        </div>

                        {/* Grand Total Summary, Preview & Submit */}
                        <div className="bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-900 p-3.5 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider block">
                                    Grand Total To Pay ({multiPayModal.items.filter(it => it.isSelected && it.cardType !== 'FREE').length} Classes):
                                </span>
                                <span className="text-xl font-black text-white tracking-tight">
                                    Rs. {multiPayModal.items
                                        .filter(it => it.isSelected && it.cardType !== 'FREE')
                                        .reduce((sum, it) => sum + (parseFloat(it.payAmount) || 0), 0)
                                        .toLocaleString()}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const selected = multiPayModal.items.filter(it => it.isSelected);
                                        if (selected.length === 0) {
                                            toast.error('Select at least one class to preview.');
                                            return;
                                        }
                                        const items = selected.map(it => ({
                                            description: `Class Fee - ${it.className}`,
                                            month: multiPayModal.monthStr || activeMonthStr,
                                            cardType: `${it.cardType} CARD`,
                                            amount: it.cardType === 'FREE' ? 0 : (parseFloat(it.payAmount) || 0),
                                            expectedFee: it.expectedFee,
                                            dueAmount: it.dueAmount
                                        }));
                                        const total = items.reduce((sum, it) => sum + it.amount, 0);
                                        const totalExp = items.reduce((sum, it) => sum + it.expectedFee, 0);
                                        const sName = studentData.studentName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student';

                                        setCurrentReceiptData({
                                            receiptNo: `PREVIEW-${Date.now().toString().slice(-6)}`,
                                            studentId: studentData.studentId,
                                            studentName: sName,
                                            guardianPhone: studentData.guardianPhone || studentData.phone || '',
                                            className: items.length > 1 ? `Multi-Class Payment (${items.length} Classes)` : items[0]?.description || 'Class Fee',
                                            month: multiPayModal.monthStr || activeMonthStr,
                                            cardType: 'MULTIPLE',
                                            amount: total,
                                            totalAmount: total,
                                            expectedFee: totalExp,
                                            dueAmount: 0,
                                            paymentMethod: 'CASH',
                                            paidDate: new Date(),
                                            status: 'PREVIEW',
                                            cashierName: getCurrentCashierName(),
                                            items,
                                            notes: multiPayModal.remark || `Receipt Preview (${items.length} Classes)`
                                        });
                                        setReceiptModalOpen(true);
                                    }}
                                    className="px-3.5 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                    title="View live 80mm thermal receipt preview"
                                >
                                    <Eye size={14} />
                                    <span>Preview Receipt</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setMultiPayModal({ isOpen: false, monthStr: '', paymentMethod: 'CASH', remark: '', items: [], loading: false })}
                                    className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={handleMultiPayModalSubmit}
                                    disabled={multiPayModal.loading || multiPayModal.items.filter(it => it.isSelected && it.cardType !== 'FREE').length === 0}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Printer size={14} />
                                    <span>{multiPayModal.loading ? 'Processing...' : 'Confirm & Print Receipt'}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Thermal Receipt Preview Modal */}
            <ThermalReceiptModal
                isOpen={receiptModalOpen}
                onClose={() => setReceiptModalOpen(false)}
                receiptData={currentReceiptData}
                autoPrint={false}
            />

            {/* Comprehensive Student History Report Modal (🟣 Payment & Attendance History) */}
            {studentData && (
                <StudentDetailModal
                    studentId={studentData.id}
                    isOpen={isStudentReportModalOpen}
                    onClose={() => setIsStudentReportModalOpen(false)}
                />
            )}
        </div>
    );
}

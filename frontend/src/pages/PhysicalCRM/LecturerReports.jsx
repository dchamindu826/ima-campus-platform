import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { printThermalReceipt } from '../../utils/thermalReceiptPrinter';
import { 
  Users, 
  BookOpen, 
  Search, 
  Calendar, 
  DollarSign, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
  Percent, 
  TrendingUp, 
  Layers, 
  RefreshCw, 
  Sparkles,
  CreditCard,
  Phone,
  PhoneCall,
  MessageSquare,
  Filter,
  Check,
  X,
  ChevronDown,
  GraduationCap,
  Plus,
  Wallet,
  MinusCircle,
  ClipboardCheck,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import physicalCrmService from '../../api/physicalCrm';
import { physicalFinanceService } from '../../api/physicalFinance';
import LecturerInvoiceModal from '../../components/PhysicalCRM/LecturerInvoiceModal';
import LecturerAttendanceSheetModal from '../../components/PhysicalCRM/LecturerAttendanceSheetModal';
import ClassFollowUpReportView from '../../components/PhysicalCRM/ClassFollowUpReportView';
import { toast } from 'react-hot-toast';

// Robust Teacher Image URL Helper matching ClassTeacherManagement.jsx
const getTeacherImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:image') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  let apiBase = '';
  if (import.meta.env.VITE_API_URL) {
    apiBase = import.meta.env.VITE_API_URL;
  } else {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
      apiBase = `http://${hostname}:5000/api`;
    } else if (window.location.protocol === 'https:') {
      apiBase = `https://${hostname}/api`;
    } else {
      apiBase = `http://${hostname}:5000/api`;
    }
  }

  const backendHost = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${backendHost}${cleanPath}`;
};

export default function LecturerReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);

  // Redirect to student attendance portal with student profile loaded
  const handleOpenStudentInPortal = (studentId) => {
    if (!studentId) return;
    navigate(`/physical/dashboard/attendance?studentId=${encodeURIComponent(studentId)}`);
  };
  
  // Selected Teacher for Drilldown
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Date Range Filter State
  const [dateRangeMode, setDateRangeMode] = useState('FULL_MONTH'); // 'FULL_MONTH' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Teacher Report Details State
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Class Fee Matrix State (for full calendar grid view)
  const [feeMatrixData, setFeeMatrixData] = useState(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // View Mode for Details: 'roster' | 'matrix'
  const [viewMode, setViewMode] = useState('roster');

  // Search & Filters
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'PENDING' | 'FREE_CARD'

  // Custom Dropdown Open States
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const classDropdownRef = useRef(null);
  const monthDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  // Invoice & Attendance Sheet Modal State
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isAttendanceSheetOpen, setIsAttendanceSheetOpen] = useState(false);

  // Advance & Transaction Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    flowChoice: 'ADVANCE', // 'ADVANCE' (Cash Flow eken adu wena) or 'INSTITUTE_INCOME' (Teacherslagen deduct wela Institute Income wena)
    category: 'Teacher Advance',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState(null);

  const resetAdvanceForm = () => {
    setAdvanceForm({
      flowChoice: 'ADVANCE',
      category: 'Teacher Advance',
      amount: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
  };

  // Memoized roster student lists
  const allRosterStudents = useMemo(() => {
    if (!reportData?.classes) return [];
    return reportData.classes.flatMap(cls => 
      cls.students.map(st => ({ ...st, classId: cls.classId, className: cls.className, grade: cls.grade }))
    );
  }, [reportData]);

  // ---- Excel export (roster + late fees) ----
  const safeName = (v) => String(v || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const excelFileName = (what) => `${safeName(reportData?.teacher?.name) || 'Lecturer'}_${what}_${selectedMonth}.xlsx`;
  const fmtDate = (d) => { try { return d ? format(new Date(d), 'yyyy-MM-dd') : ''; } catch (e) { return ''; } };
  const lateFeeTotal = (st) => (st.lateFees || []).reduce((sum, lf) => sum + (Number(lf.amount) || 0), 0);

  const lateFeeRows = () => (reportData?.lateFeeCollections || []).map((lf, i) => ({
    '#': i + 1,
    'Date Paid': fmtDate(lf.paidDate),
    'Student Reg ID': lf.studentRegId || '',
    'Student Name': lf.studentName || '',
    'Class': lf.className || '',
    'Past Fee Month': formatMonthYear(lf.feeMonth),
    'Amount Paid (Rs.)': Number(lf.amount) || 0,
    'Payment Method': lf.paymentMethod || '',
  }));

  const exportLateFeesExcel = () => {
    const rows = lateFeeRows();
    if (rows.length === 0) { toast.error('No late fee collections to export'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Late Fees');
    XLSX.writeFile(wb, excelFileName('LateFees'));
  };

  const exportRosterExcel = () => {
    if (filteredRosterStudents.length === 0) { toast.error('No students to export'); return; }
    const rosterRows = filteredRosterStudents.map((st, i) => ({
      '#': i + 1,
      'Student Reg ID': st.studentId || '',
      'Student Name': st.studentName || '',
      'Phone': st.phone || '',
      'Active': st.isActive ? 'Active' : 'Inactive',
      'Class': st.className || '',
      'Grade': st.grade || '',
      [`Class Fee Status (${formatMonthYear(selectedMonth)})`]: st.feeStatus || '',
      'Class Fee Amount (Rs.)': st.feeStatus === 'FREE_CARD' ? 0 : (Number(st.amount) || 0),
      'Paid Date': st.feeStatus === 'PENDING' ? '' : fmtDate(st.paidDate),
      'Payment Method': st.feeStatus === 'PENDING' ? '' : (st.paymentMethod || ''),
      'Late Fees Paid (Rs.)': lateFeeTotal(st),
      'Late Fee Months': (st.lateFees || []).map((lf) => `${formatMonthYear(lf.feeMonth)}: Rs. ${Number(lf.amount) || 0}`).join(', '),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterRows), 'Roster');
    const lf = lateFeeRows();
    if (lf.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lf), 'Late Fees');
    XLSX.writeFile(wb, excelFileName('Roster'));
  };

  const filteredRosterStudents = useMemo(() => {
    return allRosterStudents.filter(st => {
      if (statusFilter === 'ACTIVE') {
        if (!st.isActive) return false;
      } else if (statusFilter === 'INACTIVE') {
        if (st.isActive) return false;
      } else if (statusFilter === 'LATE_FEES') {
        if (!st.lateFees || st.lateFees.length === 0) return false;
      } else if (statusFilter !== 'ALL' && st.feeStatus !== statusFilter) {
        return false;
      }
      if (studentSearch) {
        const q = studentSearch.toLowerCase().trim();
        return (
          st.studentId.toLowerCase().includes(q) ||
          st.studentName.toLowerCase().includes(q) ||
          (st.phone && st.phone.includes(q)) ||
          (st.className && st.className.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allRosterStudents, statusFilter, studentSearch]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target)) {
        setClassDropdownOpen(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target)) {
        setMonthDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [tchRes, clsRes] = await Promise.all([
        physicalCrmService.getTeachers(),
        physicalCrmService.getClasses()
      ]);
      setTeachers(tchRes || []);
      setClasses(clsRes || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lecturers and classes');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Format YYYY-MM to readable month (e.g. 2025-01 -> Jan 2025)
  const formatMonthYear = (mStr) => {
    if (!mStr) return '';
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
      return mStr;
    }
  };

  const getMonthDateBounds = (mStr) => {
    let year, month;
    if (mStr && mStr.includes('-')) {
      const parts = mStr.split('-').map(Number);
      year = parts[0];
      month = parts[1];
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    };
  };

  // Fetch Report for selected Teacher
  const loadTeacherReport = async (
    teacherId,
    month = selectedMonth,
    classId = selectedClassId,
    mode = dateRangeMode,
    sDate = startDate,
    eDate = endDate
  ) => {
    setLoadingReport(true);
    try {
      const params = {
        month: month || undefined,
        classId: classId !== 'ALL' ? classId : undefined
      };

      if (mode === 'CUSTOM' && sDate && eDate) {
        params.startDate = sDate;
        params.endDate = eDate;
      }

      const res = await physicalCrmService.getTeacherReports(teacherId, params);
      setReportData(res);
      if (!selectedMonth && res.selectedMonth) {
        setSelectedMonth(res.selectedMonth);
      }
      if (res.dateRange) {
        if (mode === 'FULL_MONTH') {
          setStartDate(res.dateRange.startDate);
          setEndDate(res.dateRange.endDate);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lecturer report');
    } finally {
      setLoadingReport(false);
    }
  };

  // Fetch Full Fee Matrix for Class Calendar view
  const loadClassMatrix = async (classId) => {
    if (!classId || classId === 'ALL') {
      setFeeMatrixData(null);
      return;
    }
    setLoadingMatrix(true);
    try {
      const res = await physicalCrmService.getClassFeeMatrix(classId);
      setFeeMatrixData(res);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load class fee calendar matrix');
    } finally {
      setLoadingMatrix(false);
    }
  };

  // Select Teacher to Drilldown
  const handleSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setSelectedClassId('ALL');
    setSelectedMonth('');
    setDateRangeMode('FULL_MONTH');
    setStudentSearch('');
    setViewMode('roster');
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const bounds = getMonthDateBounds(curMonth);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
    loadTeacherReport(teacher.id, '', 'ALL', 'FULL_MONTH', bounds.start, bounds.end);
  };

  // Handle Class Dropdown Change
  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setClassDropdownOpen(false);
    if (selectedTeacher) {
      loadTeacherReport(selectedTeacher.id, selectedMonth, classId, dateRangeMode, startDate, endDate);
      if (classId !== 'ALL') {
        loadClassMatrix(classId);
      } else {
        setFeeMatrixData(null);
        setViewMode('roster');
      }
    }
  };

  // Handle Month Change
  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    setMonthDropdownOpen(false);
    const bounds = getMonthDateBounds(month);
    let s = startDate;
    let e = endDate;
    if (dateRangeMode === 'FULL_MONTH') {
      s = bounds.start;
      e = bounds.end;
      setStartDate(s);
      setEndDate(e);
    }
    if (selectedTeacher) {
      loadTeacherReport(selectedTeacher.id, month, selectedClassId, dateRangeMode, s, e);
    }
  };

  // Handle Date Range Mode Toggle
  const handleDateModeToggle = (mode) => {
    setDateRangeMode(mode);
    const bounds = getMonthDateBounds(selectedMonth);
    let s = startDate || bounds.start;
    let e = endDate || bounds.end;
    if (mode === 'FULL_MONTH') {
      s = bounds.start;
      e = bounds.end;
      setStartDate(s);
      setEndDate(e);
    }
    if (selectedTeacher) {
      loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId, mode, s, e);
    }
  };

  // Handle Apply Custom Date Range
  const handleApplyCustomRange = (s, e) => {
    if (!s || !e) {
      toast.error('Please specify both Start Date and End Date');
      return;
    }
    if (new Date(s) > new Date(e)) {
      toast.error('Start Date cannot be after End Date');
      return;
    }
    setDateRangeMode('CUSTOM');
    setStartDate(s);
    setEndDate(e);
    if (selectedTeacher) {
      loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId, 'CUSTOM', s, e);
    }
  };

  // Handle Quick Presets (1st-15th, 16th-End, Full Month)
  const handleQuickPreset = (presetType) => {
    const bounds = getMonthDateBounds(selectedMonth);
    const [year, month] = selectedMonth.split('-').map(Number);
    let s = bounds.start;
    let e = bounds.end;
    if (presetType === 'FIRST_HALF') {
      s = `${year}-${String(month).padStart(2, '0')}-01`;
      e = `${year}-${String(month).padStart(2, '0')}-15`;
    } else if (presetType === 'SECOND_HALF') {
      const lastDay = new Date(year, month, 0).getDate();
      s = `${year}-${String(month).padStart(2, '0')}-16`;
      e = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (presetType === 'FULL_MONTH') {
      s = bounds.start;
      e = bounds.end;
      setDateRangeMode('FULL_MONTH');
      setStartDate(s);
      setEndDate(e);
      if (selectedTeacher) {
        loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId, 'FULL_MONTH', s, e);
      }
      return;
    }
    setDateRangeMode('CUSTOM');
    setStartDate(s);
    setEndDate(e);
    if (selectedTeacher) {
      loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId, 'CUSTOM', s, e);
    }
  };

  // 1-Click Fee Toggle with Thermal Receipt
  const handleToggleFeeStatus = async (studentId, classId, month, currentStatus) => {
    const nextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      const res = await physicalCrmService.toggleFeePayment({
        studentId,
        classId,
        month,
        status: nextStatus
      });
      toast.success(`Fee updated for ${formatMonthYear(month)}: ${nextStatus}`);

      if (nextStatus === 'PAID' && res?.receiptData) {
        printThermalReceipt(res.receiptData);
      }
      
      // Refresh current views
      if (selectedTeacher) {
        loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId);
      }
      if (selectedClassId && selectedClassId !== 'ALL') {
        loadClassMatrix(selectedClassId);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle fee payment status');
    }
  };

  // Record Teacher Advance or Institute Income Entry directly into Cash Flow
  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.flowChoice) {
      toast.error('කරුණාකර Options 2 න් එකක් තෝරන්න (Please tick one of the 2 options)');
      return;
    }
    const numAmt = parseFloat(advanceForm.amount);
    if (!advanceForm.amount || isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSavingAdvance(true);
    try {
      const isAdvance = advanceForm.flowChoice === 'ADVANCE';
      await physicalFinanceService.addTransaction({
        type: isAdvance ? 'EXPENSE' : 'INCOME',
        category: advanceForm.category,
        amount: numAmt,
        description: advanceForm.description || (isAdvance 
          ? `Teacher advance for ${reportData?.teacher?.name || 'Lecturer'} (${selectedMonth})` 
          : `Institute income deducted from ${reportData?.teacher?.name || 'Lecturer'} (${selectedMonth})`),
        teacherId: reportData?.teacher?.id,
        billingMonth: selectedMonth,
        isTeacherAdvance: isAdvance,
        date: advanceForm.date,
        affectsCash: true,
        paymentMethod: 'CASH'
      });
      toast.success(
        isAdvance
          ? `Advance of Rs. ${numAmt.toLocaleString()} deducted from Cash Flow & Teacher Payout!`
          : `Rs. ${numAmt.toLocaleString()} deducted from Teacher Payout and recorded as Institute Income in Cash Flow!`
      );
      setIsAdvanceModalOpen(false);
      resetAdvanceForm();
      loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId);
    } catch (err) {
      toast.error('Failed to save record: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDeleteAdvance = async (txnId) => {
    if (!window.confirm('Are you sure you want to delete this record? This will also remove its impact from Cash Flow.')) return;
    setDeletingAdvanceId(txnId);
    try {
      await physicalFinanceService.deleteTransaction(txnId, 'Deleted from Lecturer Reports', 'Staff');
      toast.success('Record deleted successfully');
      loadTeacherReport(selectedTeacher.id, selectedMonth, selectedClassId);
    } catch (err) {
      toast.error('Failed to delete record: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingAdvanceId(null);
    }
  };

  // Filtered Lecturers List for Directory
  const filteredTeachers = teachers.filter(t => {
    const q = teacherSearch.toLowerCase();
    const lId = (t.lecturerId || `IMA-LEC-${1000 + t.id}`).toLowerCase();
    return t.name.toLowerCase().includes(q) ||
      lId.includes(q) ||
      (t.phone && t.phone.includes(teacherSearch)) ||
      (t.classes && t.classes.some(c => c.name.toLowerCase().includes(q)));
  });

  // Active class name helper
  const getSelectedClassName = () => {
    if (selectedClassId === 'ALL') {
      return `All Assigned Classes (${reportData?.teacher?.classes?.length || 0})`;
    }
    const found = reportData?.teacher?.classes?.find(c => c.id === parseInt(selectedClassId));
    return found ? `${found.name} (${found.grade})` : 'Select Class';
  };

  return (
    <div className="space-y-6 w-full min-h-full pb-16 font-sans text-slate-100">
      
      {/* ========================================================================= */}
      {/* VIEW 1: TOP-LEVEL LECTURER DIRECTORY & CARDS                              */}
      {/* ========================================================================= */}
      {!selectedTeacher && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
                <FileText size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Lecturer Reports & Monthly Invoices
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a lecturer to view student fee collections, institute cut deductions, and generate executive payout invoices.
                </p>
              </div>
            </div>

            {/* High Level Stats in Header */}
            <div className="flex items-center gap-3">
              <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-2 rounded-2xl text-center shadow-inner">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lecturers</span>
                <span className="text-lg font-black text-white">{teachers.length}</span>
              </div>
              <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-2 rounded-2xl text-center shadow-inner">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Classes</span>
                <span className="text-lg font-black text-blue-400">{classes.length}</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search lecturers by name, phone, or class subject..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all shadow-inner"
            />
            {teacherSearch && (
              <button 
                onClick={() => setTeacherSearch('')} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Lecturer Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeachers.map(t => {
              const imgUrl = getTeacherImageUrl(t.image);
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTeacher(t)}
                  className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-5 rounded-3xl shadow-lg hover:shadow-blue-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Photo + Name + Contact */}
                    <div className="flex items-center gap-4 mb-4">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={t.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-700 group-hover:border-blue-400 shadow-md transition-all shrink-0 bg-slate-800"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1e293b&color=38bdf8&bold=true`;
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-black text-blue-400 shadow-md shrink-0">
                          {t.name.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-white group-hover:text-blue-400 transition-colors truncate">
                            {t.name}
                          </h3>
                          <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30">
                            {t.lecturerId || `IMA-LEC-${1000 + t.id}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Phone size={12} className="text-blue-400" /> {t.phone || t.whatsapp || 'No contact set'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                            Inst. Cut: {t.instituteCut || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Classes */}
                    <div className="space-y-1.5 mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Assigned Classes ({t.classes?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                        {t.classes && t.classes.length > 0 ? (
                          t.classes.map(c => (
                            <span key={c.id} className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2.5 py-1 rounded-xl border border-slate-700/70">
                              {c.name} <strong className="text-blue-400 font-semibold">({c.grade})</strong>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No classes assigned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
                    <span>View Breakdown & Invoice</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}

            {filteredTeachers.length === 0 && (
              <div className="col-span-full text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 text-slate-400 italic">
                No lecturers match the search query "{teacherSearch}".
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DETAILED LECTURER BREAKDOWN & INVOICE GENERATOR                   */}
      {/* ========================================================================= */}
      {selectedTeacher && reportData && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Back Button & Top Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedTeacher(null);
                setReportData(null);
                setFeeMatrixData(null);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 shadow-sm"
            >
              <ArrowLeft size={15} /> Back to Lecturer Directory
            </button>

            <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800">
              Lecturer Remittance Portal
            </span>
          </div>

          {/* Lecturer Profile Hero Card */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 md:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Left: Avatar & Info */}
            <div className="flex items-center gap-5">
              {reportData.teacher.image ? (
                <img
                  src={getTeacherImageUrl(reportData.teacher.image)}
                  alt={reportData.teacher.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700 shadow-lg shrink-0 bg-slate-800"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reportData.teacher.name)}&background=1e293b&color=38bdf8&bold=true`;
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl font-black text-blue-400 shadow-lg shrink-0">
                  {reportData.teacher.name.charAt(0)}
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block mb-0.5">
                  Academic Lecturer
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {reportData.teacher.name}
                  </h2>
                  <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/30 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {reportData.teacher.lecturerId || `IMA-LEC-${1000 + reportData.teacher.id}`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                  {reportData.teacher.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-blue-400" /> {reportData.teacher.phone}
                    </span>
                  )}
                  {reportData.teacher.whatsapp && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <MessageSquare size={12} /> {reportData.teacher.whatsapp}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                    Institute Cut: {reportData.teacher.instituteCut}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions (Attendance Sheet + Invoice) */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={() => setIsAttendanceSheetOpen(true)}
                className="w-full sm:w-auto px-5 py-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 border border-emerald-500/30"
                title="Generate monthly student attendance sheet for lecturer signature"
              >
                <ClipboardCheck size={16} className="text-emerald-400" />
                <span>Monthly Attendance Sheet</span>
              </button>

              <button
                onClick={() => setIsInvoiceOpen(true)}
                className="w-full sm:w-auto px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText size={16} />
                <span>Month-End Payout Invoice</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CUSTOM HIGH-CONTRAST FILTER BAR (WITH DEDICATED DATE RANGE PICKERS)      */}
          {/* ========================================================================= */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl space-y-3.5 relative z-20 shadow-xl">
            
            {/* Row 1: Core Scope Controls (Class, Billing Month, Date Range) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
              
              {/* 1. Class Dropdown Menu */}
              <div className="lg:col-span-3 relative" ref={classDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter by Class</label>
                
                <button
                  type="button"
                  onClick={() => setClassDropdownOpen(!classDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-between outline-none focus:border-blue-500 transition-all shadow-sm text-left cursor-pointer"
                >
                  <span className="truncate pr-2">{getSelectedClassName()}</span>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${classDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>

                {classDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    <div
                      onClick={() => handleClassChange('ALL')}
                      className={`px-3.5 py-2.5 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${selectedClassId === 'ALL' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <span>All Assigned Classes ({reportData.teacher.classes?.length || 0})</span>
                      {selectedClassId === 'ALL' && <Check size={14} className="text-blue-400" />}
                    </div>

                    {reportData.teacher.classes && reportData.teacher.classes.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleClassChange(c.id.toString())}
                        className={`px-3.5 py-2.5 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${selectedClassId === c.id.toString() ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`}
                      >
                        <span className="truncate">{c.name} <strong className="text-slate-400 font-normal">({c.grade})</strong></span>
                        {selectedClassId === c.id.toString() && <Check size={14} className="text-blue-400" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Active Billing Month Dropdown */}
              <div className="lg:col-span-3 relative" ref={monthDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billing Month</label>
                
                <button
                  type="button"
                  onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-between outline-none focus:border-blue-500 transition-all shadow-sm text-left cursor-pointer"
                >
                  <span className="truncate pr-2">{formatMonthYear(selectedMonth)} ({selectedMonth})</span>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${monthDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>

                {monthDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    {reportData.availableMonths && reportData.availableMonths.length > 0 ? (
                      reportData.availableMonths.map(m => (
                        <div
                          key={m}
                          onClick={() => handleMonthChange(m)}
                          className={`px-3.5 py-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${selectedMonth === m ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`}
                        >
                          <span>{formatMonthYear(m)} ({m})</span>
                          {selectedMonth === m && <Check size={14} className="text-blue-400" />}
                        </div>
                      ))
                    ) : (
                      <div className="px-3.5 py-2 text-xs text-slate-400 italic">No months available</div>
                    )}

                    {/* Pick any custom month */}
                    <div className="p-2 border-t border-slate-800 bg-slate-950/80">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pick Another Month</label>
                      <input 
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => {
                          if (e.target.value) handleMonthChange(e.target.value);
                        }}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Dedicated Date Range Filter (Full Month vs Custom Range) */}
              <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      Date Range Filter (දිනය අනුව)
                    </span>
                  </div>

                  {/* Toggle Mode: Full Month vs Custom Range */}
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700/80">
                    <button
                      type="button"
                      onClick={() => handleDateModeToggle('FULL_MONTH')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        dateRangeMode === 'FULL_MONTH'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Full Month
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateModeToggle('CUSTOM')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                        dateRangeMode === 'CUSTOM'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>

                {dateRangeMode === 'FULL_MONTH' ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                      <span className="text-[11px] font-medium text-slate-300">
                        Entire Month: <strong className="text-white font-bold">{startDate || `${selectedMonth}-01`}</strong> to <strong className="text-white font-bold">{endDate}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('FIRST_HALF')}
                        className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 hover:text-blue-400 transition-colors cursor-pointer"
                        title="Filter 1st to 15th"
                      >
                        1st - 15th
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPreset('SECOND_HALF')}
                        className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 hover:text-blue-400 transition-colors cursor-pointer"
                        title="Filter 16th to End"
                      >
                        16th - End
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickPreset('FIRST_HALF')}
                          className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
                        >
                          1st - 15th
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickPreset('SECOND_HALF')}
                          className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
                        >
                          16th - End
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickPreset('FULL_MONTH')}
                          className="text-[9px] font-bold px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyCustomRange(startDate, endDate)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer ml-auto"
                      >
                        <Filter size={11} /> Apply Date Range
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Row 2: Secondary Status & Search Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center pt-2.5 border-t border-slate-800/80">
              
              {/* 4. Fee Status Filter */}
              <div className="lg:col-span-4 relative" ref={statusDropdownRef}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className="w-full px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-bold text-white flex items-center justify-between outline-none focus:border-blue-500 transition-all shadow-sm text-left cursor-pointer"
                >
                  <span className="truncate pr-1">
                    {statusFilter === 'ALL' ? 'All Statuses' : (statusFilter === 'ACTIVE' ? 'Active Students (2+ Mos)' : (statusFilter === 'INACTIVE' ? 'Inactive Students' : (statusFilter === 'PAID' ? 'Paid Only' : (statusFilter === 'PENDING' ? 'Pending Only' : (statusFilter === 'LATE_FEES' ? 'Late Fees Only' : 'Free Card')))))}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${statusDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>

                {statusDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 py-1 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    {[
                      { val: 'ALL', label: 'All Statuses' },
                      { val: 'ACTIVE', label: 'Active Students (2+ Months Attended)' },
                      { val: 'INACTIVE', label: 'Inactive Students (< 2 Months Attended)' },
                      { val: 'PAID', label: 'Paid Only' },
                      { val: 'PENDING', label: 'Pending Only' },
                      { val: 'FREE_CARD', label: 'Free Card' },
                      { val: 'LATE_FEES', label: 'Late Fees Only (ප්‍රමාද ගාස්තු)' }
                    ].map(opt => (
                      <div
                        key={opt.val}
                        onClick={() => { setStatusFilter(opt.val); setStatusDropdownOpen(false); }}
                        className={`px-3 py-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${statusFilter === opt.val ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`}
                      >
                        <span>{opt.label}</span>
                        {statusFilter === opt.val && <Check size={14} className="text-blue-400" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Student Search Input */}
              <div className="lg:col-span-8">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search Student</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Student ID, Name, Phone..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Financial Summary Metric Cards (Responsive 6-Card Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            
            {/* 1. Total Enrolled & Active Count */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Enrolled
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>

              {/* Prominently Highlighted Active Student Count */}
              <div className="flex items-baseline gap-1.5 mt-1">
                <h3 className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                  {reportData.summary.totalActiveStudents !== undefined ? reportData.summary.totalActiveStudents : reportData.summary.totalEnrolledStudents}
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  / {reportData.summary.totalEnrolledStudents} Total
                </span>
              </div>

              {/* Active percentage and criteria */}
              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">
                  {reportData.summary.totalEnrolledStudents > 0 
                    ? Math.round(((reportData.summary.totalActiveStudents || 0) / reportData.summary.totalEnrolledStudents) * 100) 
                    : 0}% Active Rate
                </span>
                <span className="text-[9px] text-emerald-400 font-semibold">
                  (2+ Mos Attended)
                </span>
              </div>
            </div>

            {/* 2. Paid Students */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Paid Count
              </span>
              <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 tracking-tight">
                {reportData.summary.totalPaidStudents}
                <span className="text-xs text-slate-400 font-semibold ml-2">
                  ({reportData.summary.totalEnrolledStudents > 0 ? Math.round((reportData.summary.totalPaidStudents / reportData.summary.totalEnrolledStudents) * 100) : 0}%)
                </span>
              </h3>
              <p className="text-[10px] text-amber-400 mt-0.5 font-medium">
                Unpaid: {reportData.summary.totalUnpaidStudents}
              </p>
            </div>

            {/* 3. Gross Revenue */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Gross Collections
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-1 tracking-tight">
                Rs. {reportData.summary.grossRevenue.toLocaleString()}
              </h3>
              {(reportData.summary.lateFeeGrossRevenue || 0) > 0 ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-400">
                    Reg: Rs. {(reportData.summary.regularGrossRevenue || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                    <Clock size={10} /> +Rs. {reportData.summary.lateFeeGrossRevenue.toLocaleString()} Late Fees ({reportData.summary.lateFeePaymentsCount || 0})
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 mt-0.5">{formatMonthYear(selectedMonth)} fee collections</p>
              )}
            </div>

            {/* 4. Institute Cut */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Institute Cut ({reportData.summary.instituteCutPercent}%)
              </span>
              <h3 className="text-2xl font-extrabold text-amber-400 mt-1 tracking-tight">
                - Rs. {reportData.summary.instituteCutAmount.toLocaleString()}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Deducted cut</p>
            </div>

            {/* 5. Teacher Advances & Deductions */}
            <div className="bg-slate-900/80 border border-rose-500/30 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Advances / Deductions
              </span>
              <h3 className="text-2xl font-extrabold text-rose-400 mt-1 tracking-tight">
                - Rs. {(reportData.summary.totalDeductions || 0).toLocaleString()}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {reportData.deductions?.length || 0} Cash Flow advances
              </p>
            </div>

            {/* 6. NET LECTURER PAYOUT */}
            <div className="bg-emerald-950/40 border-2 border-emerald-500/50 p-4 rounded-2xl shadow-md">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider block">
                Net Lecturer Payout
              </span>
              <h3 className="text-2xl font-black text-emerald-300 mt-1 tracking-tight">
                Rs. {reportData.summary.netTeacherPayout.toLocaleString()}
              </h3>
              <p className="text-[10px] text-emerald-400/80 mt-0.5 font-semibold">After cuts & advances</p>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION: CASH FLOW ADVANCES & DEDUCTIONS FOR THIS LECTURER                */}
          {/* ========================================================================= */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet size={18} className="text-rose-400" />
                  Lecturer Advances & Adjustments ({formatMonthYear(selectedMonth)})
                </h3>
                <p className="text-xs text-slate-400">
                  Cash Flow advances, deductions, and income credits linked to this lecturer affecting this month's salary/payout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetAdvanceForm();
                  setIsAdvanceModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-900/30 active:scale-95 cursor-pointer shrink-0"
              >
                <Plus size={15} /> + Record Advance / Entry
              </button>
            </div>

            {reportData.deductions && reportData.deductions.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-700 text-[11px] uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Impact Type</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Cash Flow Impact</th>
                      <th className="p-3">Description / Remarks</th>
                      <th className="p-3 text-right">Teacher Payout Impact</th>
                      <th className="p-3 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {reportData.deductions.map((d, dIdx) => {
                      const isInstituteIncome = d.type === 'INCOME' || d.recordType === 'INSTITUTE_INCOME';
                      return (
                        <tr key={d.id || dIdx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-300 whitespace-nowrap">
                            {d.date ? format(new Date(d.date), 'dd MMM yyyy') : '-'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isInstituteIncome ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold">
                                <ArrowUpRight size={12} /> Institute Income (Deduction)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold">
                                <ArrowDownRight size={12} /> Teacher Advance
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              isInstituteIncome 
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            }`}>
                              {d.category || (isInstituteIncome ? 'Tute Printing Charges' : 'Teacher Advance')}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isInstituteIncome ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                🟢 + Rs. {(d.amount || 0).toLocaleString()} (Institute Inflow)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                🔴 - Rs. {(d.amount || 0).toLocaleString()} (Drawer Outflow)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-300 max-w-xs truncate">
                            {d.description || (isInstituteIncome ? `Deduction for ${reportData?.teacher?.name || 'Lecturer'}` : `Teacher advance for ${reportData?.teacher?.name || 'Lecturer'}`)}
                          </td>
                          <td className="p-3 text-right font-black text-rose-400 text-sm whitespace-nowrap">
                            - Rs. {(d.amount || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteAdvance(d.id)}
                              disabled={deletingAdvanceId === d.id}
                              title="Delete this record"
                              className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/80 font-bold text-slate-300 border-t border-slate-700 text-xs">
                      <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-slate-400">
                        Total Deductions from Teacher for {formatMonthYear(selectedMonth)}:
                      </td>
                      <td className="p-3 text-right font-black text-rose-400 text-sm whitespace-nowrap">
                        - Rs. {(reportData.summary.totalDeductions || 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>No advances or adjustments recorded for this lecturer in {formatMonthYear(selectedMonth)}.</span>
                <span className="text-[11px] text-emerald-400 font-semibold">Full net payout will be remitted without deductions.</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION: LATE CLASS FEES (PAST MONTH ARREARS COLLECTED THIS MONTH)        */}
          {/* ========================================================================= */}
          {reportData.lateFeeCollections && reportData.lateFeeCollections.length > 0 && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 p-6 rounded-3xl shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" />
                    Late Class Fee Collections (ප්‍රමාද පන්ති ගාස්තු) — {formatMonthYear(selectedMonth)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Students who paid fees for past months during {formatMonthYear(selectedMonth)}. These collections are added directly to this active month's lecturer invoice remittance.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={exportLateFeesExcel}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    title="Download late fee collections as Excel"
                  >
                    <FileSpreadsheet size={14} /> Export Excel
                  </button>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 font-bold text-xs border border-amber-500/30">
                    {reportData.lateFeeCollections.length} Late Payments
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                    + Rs. {(reportData.summary.lateFeeGrossRevenue || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/90 text-amber-300 font-bold border-b border-slate-700 text-[11px] uppercase tracking-wider">
                      <th className="p-3">#</th>
                      <th className="p-3">Date Paid</th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Class</th>
                      <th className="p-3 text-center">Past Fee Month</th>
                      <th className="p-3 text-right">Amount Paid</th>
                      <th className="p-3 text-center">Remittance Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {reportData.lateFeeCollections.map((lf, lfIdx) => (
                      <tr key={lf.id || lfIdx} className="hover:bg-amber-500/5 transition-colors">
                        <td className="p-3 text-slate-500 font-medium">{lfIdx + 1}</td>
                        <td className="p-3 font-semibold text-slate-300 whitespace-nowrap">
                          {lf.paidDate ? format(new Date(lf.paidDate), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-white block">{lf.studentName}</span>
                          <span className="font-mono text-[10px] text-sky-400">{lf.studentRegId}</span>
                        </td>
                        <td className="p-3 text-slate-300">{lf.className}</td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                            {formatMonthYear(lf.feeMonth)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-400 text-sm whitespace-nowrap">
                          Rs. {(lf.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Added to {formatMonthYear(selectedMonth)} Invoice
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/80 font-bold text-slate-300 border-t border-slate-700 text-xs">
                      <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-slate-400">
                        Total Late Class Fees Added to {formatMonthYear(selectedMonth)} Remittance:
                      </td>
                      <td className="p-3 text-right font-black text-emerald-400 text-sm whitespace-nowrap">
                        + Rs. {(reportData.summary.lateFeeGrossRevenue || 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* View Mode Switcher (If a specific class is selected, can toggle between Student Roster, Full Calendar Matrix, and Call Sheet) */}
          {selectedClassId !== 'ALL' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800 gap-2">
              <span className="text-xs font-bold text-slate-400 sm:ml-2">Class Display View:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewMode('roster')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'roster' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Student List ({formatMonthYear(selectedMonth)})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'matrix' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Full Calendar Fee Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('call-sheet')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'call-sheet'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-emerald-400 hover:text-white hover:bg-emerald-500/20'
                  }`}
                >
                  <PhoneCall size={13} />
                  <span>Follow-up & Call Sheet</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION: CLASS FOLLOW-UP & CALL SHEET (SHOWN IN CALL-SHEET MODE)          */}
          {/* ========================================================================= */}
          {selectedClassId !== 'ALL' && viewMode === 'call-sheet' && (
            <ClassFollowUpReportView 
              initialClassId={String(selectedClassId)} 
              onBack={() => setViewMode('roster')} 
            />
          )}

          {/* ========================================================================= */}
          {/* SECTION: FULL CALENDAR / MATRIX GRID (SHOWN IN MATRIX MODE)               */}
          {/* ========================================================================= */}
          {selectedClassId !== 'ALL' && feeMatrixData && viewMode === 'matrix' && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar size={18} className="text-blue-400" />
                    Interactive Month-by-Month Fee Calendar Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Click any cell to toggle payment status between PAID and PENDING.
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700 text-[11px]">
                      <th className="p-3 sticky left-0 bg-slate-900 z-10 min-w-[200px]">Student Details</th>
                      <th className="p-3 text-center min-w-[90px]">Reg Fee</th>
                      {feeMatrixData.activeMonths && feeMatrixData.activeMonths.map(m => (
                        <th key={m} className={`p-3 text-center min-w-[110px] ${m === selectedMonth ? 'bg-blue-600/20 text-blue-300 font-black border-x border-blue-500/20' : ''}`}>
                          {formatMonthYear(m)}
                        </th>
                      ))}
                      <th className="p-3 text-center min-w-[90px]">Paid Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {feeMatrixData.students && feeMatrixData.students
                      .filter(st => 
                        st.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        st.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        (st.phone && st.phone.includes(studentSearch))
                      )
                      .map((st, idx) => (
                        <tr key={`matrix_${feeMatrixData.class.id}_${st.id}_${idx}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 sticky left-0 bg-slate-900/95 z-10 border-r border-slate-800">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenStudentInPortal(st.studentId)}
                                className="p-1 rounded-md bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 transition-all cursor-pointer shrink-0"
                                title={`Open ${st.studentName} in Student Attendance Portal`}
                              >
                                <ExternalLink size={12} />
                              </button>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentInPortal(st.studentId)}
                                  className="font-bold text-sky-400 hover:text-sky-300 block tracking-tight text-left text-xs cursor-pointer hover:underline"
                                  title={`Open ${st.studentId} in Student Portal`}
                                >
                                  {st.studentId}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentInPortal(st.studentId)}
                                  className="text-white hover:text-blue-400 font-semibold block text-left truncate text-xs cursor-pointer"
                                  title={`Open ${st.studentName} in Student Portal`}
                                >
                                  {st.studentName}
                                </button>
                                {st.phone && <span className="text-[10px] text-slate-400 block">{st.phone}</span>}
                              </div>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${st.registrationFeeStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {st.registrationFeeStatus}
                            </span>
                          </td>

                          {feeMatrixData.activeMonths && feeMatrixData.activeMonths.map(m => {
                            const mData = st.months?.[m];
                            const isPaid = mData?.status === 'PAID';
                            const isFree = mData?.status === 'FREE_CARD';
                            const isNotEnrolled = mData?.status === 'NOT_ENROLLED' || mData?.isBeforeEnrollment;

                            return (
                              <td key={m} className={`p-2 text-center ${m === selectedMonth ? 'bg-blue-500/5' : ''}`}>
                                {isNotEnrolled ? (
                                  <span 
                                    className="w-full py-1.5 px-2 rounded-xl text-[10px] font-semibold text-slate-500 bg-slate-800/40 border border-slate-700/40 text-center block select-none" 
                                    title={`Student joined after ${m} (No fee due)`}
                                  >
                                    -
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFeeStatus(st.id, feeMatrixData.class.id, m, mData?.status)}
                                    className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                                      isPaid 
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm' 
                                        : (isFree 
                                            ? 'bg-purple-600 text-white' 
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700')
                                    }`}
                                  >
                                    {isPaid ? (
                                      <>
                                        <Check size={11} /> PAID
                                      </>
                                    ) : (
                                      <span>PENDING</span>
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}

                          <td className="p-3 text-center font-bold text-emerald-400">
                            {st.totalPaidMonths} / {st.totalEligibleMonths !== undefined ? st.totalEligibleMonths : (feeMatrixData.activeMonths?.length || 0)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION: ITEMIZED STUDENT ROSTER (DEFAULT / ROSTER MODE)                  */}
          {/* ========================================================================= */}
          {viewMode === 'roster' && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users size={18} className="text-blue-400" />
                    Enrolled Students Roster ({formatMonthYear(selectedMonth)})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Registration fee records & 1-click monthly class fee status updates
                  </p>
                </div>

                {/* Search Bar & Result Counter inside Roster Header */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={exportRosterExcel}
                    className="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    title="Download the students shown below (with current filter/search) as Excel"
                  >
                    <FileSpreadsheet size={14} /> Export Excel
                  </button>
                  <span className="text-[11px] font-semibold text-slate-400 hidden md:inline-block px-2.5 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/80">
                    Showing <strong className="text-white">{filteredRosterStudents.length}</strong> of <strong className="text-slate-300">{allRosterStudents.length}</strong>
                  </span>
                  
                  <div className="relative flex-1 sm:w-80">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student name, ID, phone, class..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                    />
                    {studentSearch && (
                      <button
                        type="button"
                        onClick={() => setStudentSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Student Table (Clean Sans-Serif Typography) */}
              <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-2xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700 text-[11px]">
                      <th className="p-3">#</th>
                      <th className="p-3">Student Reg ID</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Class</th>
                      <th className="p-3 text-center">Class Fee ({formatMonthYear(selectedMonth)})</th>
                      <th className="p-3 text-right">Fee Amount</th>
                      <th className="p-3">Late Fees</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredRosterStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          <Users size={32} className="mx-auto mb-2 opacity-30 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-300">
                            {studentSearch ? `No students found matching "${studentSearch}"` : 'No students found for this filter'}
                          </p>
                          {studentSearch && (
                            <button
                              type="button"
                              onClick={() => setStudentSearch('')}
                              className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <X size={12} /> Clear Search
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredRosterStudents.map((st, idx) => (
                        <tr key={`roster_${st.classId}_${st.id}_${idx}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-slate-500 font-medium">{idx + 1}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleOpenStudentInPortal(st.studentId)}
                              className="font-bold text-sky-400 hover:text-sky-300 tracking-tight hover:underline cursor-pointer inline-flex items-center gap-1 group text-left"
                              title={`Open ${st.studentId} in Student Portal`}
                            >
                              <span>{st.studentId}</span>
                              <ArrowUpRight size={11} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {/* Dedicated Portal Quick-Launch Button in front of student name */}
                              <button
                                type="button"
                                onClick={() => handleOpenStudentInPortal(st.studentId)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 transition-all shadow-xs cursor-pointer shrink-0 group"
                                title={`Open ${st.studentName} in Student Attendance Portal`}
                              >
                                <ExternalLink size={13} className="group-hover:scale-115 transition-transform" />
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStudentInPortal(st.studentId)}
                                    className="text-white hover:text-blue-400 font-semibold block text-left transition-colors cursor-pointer truncate"
                                    title={`Open ${st.studentName} in Student Attendance Portal`}
                                  >
                                    {st.studentName}
                                  </button>
                                  {st.isActive ? (
                                    <span 
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold shrink-0" 
                                      title={`Active Student: Attended classes in ${st.activeMonthsCount || 2} distinct months`}
                                    >
                                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                                      Active
                                    </span>
                                  ) : (
                                    <span 
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 text-[9px] shrink-0" 
                                      title="Inactive: Less than 2 months of physical attendance recorded"
                                    >
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                {st.phone && <span className="text-[10px] text-slate-400 block">{st.phone}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">
                            {st.className} <span className="text-[10px] text-slate-500">({st.grade})</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${st.feeStatus === 'PAID' ? 'bg-emerald-600 text-white' : (st.feeStatus === 'FREE_CARD' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700')}`}>
                              {st.feeStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {st.feeStatus === 'FREE_CARD' ? (
                              <span className="text-[11px] text-purple-300 font-semibold">Free</span>
                            ) : st.feeStatus === 'PENDING' ? (
                              <span className="text-slate-400" title="Monthly class fee (not paid yet)">
                                Rs. {(Number(st.amount) || 0).toLocaleString()} <span className="text-[9px] text-slate-500">due</span>
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-400">Rs. {(Number(st.amount) || 0).toLocaleString()}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {st.lateFees && st.lateFees.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-amber-300 whitespace-nowrap">Rs. {lateFeeTotal(st).toLocaleString()}</span>
                                <div className="flex flex-wrap gap-1">
                                  {st.lateFees.map((lf, lfI) => (
                                    <span key={lfI} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold whitespace-nowrap">
                                      <Clock size={9} /> {formatMonthYear(lf.feeMonth)}: Rs. {(Number(lf.amount) || 0).toLocaleString()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleFeeStatus(st.id, st.classId, selectedMonth, st.feeStatus)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${st.feeStatus === 'PAID' ? 'bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'}`}
                            >
                              {st.feeStatus === 'PAID' ? 'Mark Pending' : 'Mark Paid'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* Month-End Executive Invoice Modal */}
          <LecturerInvoiceModal
            isOpen={isInvoiceOpen}
            onClose={() => setIsInvoiceOpen(false)}
            reportData={reportData}
            selectedMonth={selectedMonth}
            selectedClassId={selectedClassId}
            classesList={classes}
          />

          {/* Monthly Class Attendance Sheet Modal */}
          <LecturerAttendanceSheetModal
            isOpen={isAttendanceSheetOpen}
            onClose={() => setIsAttendanceSheetOpen(false)}
            reportData={reportData}
            selectedMonth={selectedMonth}
            selectedClassId={selectedClassId}
            onMonthChange={(newMonth) => {
              setSelectedMonth(newMonth);
              loadTeacherReport(reportData.teacher.id, newMonth, selectedClassId);
            }}
            onClassChange={(newClassId) => {
              setSelectedClassId(newClassId);
              loadTeacherReport(reportData.teacher.id, selectedMonth, newClassId);
            }}
            classesList={classes}
          />

          {/* Record Teacher Advance / Institute Income Deduction Modal */}
          {isAdvanceModalOpen && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex justify-center items-center p-4 overflow-y-auto">
              <div className="bg-[#151522] border border-slate-700/80 p-6 md:p-8 rounded-3xl w-full max-w-xl shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white my-8">
                <button 
                  onClick={() => setIsAdvanceModalOpen(false)} 
                  className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3.5 mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
                    advanceForm.flowChoice === 'INSTITUTE_INCOME'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Record Lecturer Transaction</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{reportData?.teacher?.name || 'Lecturer'} • {formatMonthYear(selectedMonth)}</p>
                  </div>
                </div>

                <form onSubmit={handleSaveAdvance} className="space-y-4">
                  {/* Target Month */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Target Billing Month (අදාළ මාසය)
                    </label>
                    <input 
                      type="text" 
                      disabled
                      value={`${formatMonthYear(selectedMonth)} (${selectedMonth})`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-300 font-bold text-sm select-none"
                    />
                  </div>

                  {/* THE TWO MANDATORY TICK OPTIONS (ME DEKEN EKAK ANIWARYENMA TICK KARANNA ONA) */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Select Impact Type (මෙම විකල්ප 2 න් එකක් අනිවාර්යයෙන්ම Tick කරන්න) *
                    </label>

                    {/* OPTION 1 TICK CARD */}
                    <div
                      onClick={() => setAdvanceForm({
                        ...advanceForm,
                        flowChoice: 'ADVANCE',
                        category: 'Teacher Advance'
                      })}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        advanceForm.flowChoice === 'ADVANCE'
                          ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30 shadow-lg shadow-rose-950/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                          advanceForm.flowChoice === 'ADVANCE'
                            ? 'bg-rose-600 border-rose-400 text-white shadow-sm'
                            : 'border-white/30 bg-white/5'
                        }`}>
                          {advanceForm.flowChoice === 'ADVANCE' && <Check size={14} className="stroke-[3]" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-white flex items-center gap-1.5">
                              1. Cash Flow එකෙන් අඩු වේ (ගුරු වැටුප් අත්තිකාරම් / Advance)
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Drawer Outflow (-)
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            • <strong>Cash Flow Drawer:</strong> අතැති මුදල් ලාච්චුවෙන් (Cash In Hand) මුදල් අඩු වේ (- Outflow).<br/>
                            • <strong>Teacher Payout:</strong> ගුරුවරයාගේ මාසික වැටුපෙන් අඩු වේ (- Deduct from Payout).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* OPTION 2 TICK CARD */}
                    <div
                      onClick={() => setAdvanceForm({
                        ...advanceForm,
                        flowChoice: 'INSTITUTE_INCOME',
                        category: 'Tute Printing Charges'
                      })}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        advanceForm.flowChoice === 'INSTITUTE_INCOME'
                          ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                          advanceForm.flowChoice === 'INSTITUTE_INCOME'
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                            : 'border-white/30 bg-white/5'
                        }`}>
                          {advanceForm.flowChoice === 'INSTITUTE_INCOME' && <Check size={14} className="stroke-[3]" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-white flex items-center gap-1.5">
                              2. ආයතනයේ ආදායමක් ලෙස එකතු වේ (ගුරු වැටුපෙන් අඩු වී ආයතනයට ලැබීම)
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Institute Income (+)
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            • <strong>Cash Flow:</strong> ආයතනයේ ආදායමක් (Institute Income) ලෙස Cash Flow එකට එකතු වේ (+ Income).<br/>
                            • <strong>Teacher Payout:</strong> ගුරුවරයාගේ වැටුපෙන් (මුද්‍රණ වියදම් / charges) අඩු වේ (- Deduct from Payout).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      {advanceForm.flowChoice === 'INSTITUTE_INCOME' ? 'Income Category (ආදායම් වර්ගය) *' : 'Advance Category (වියදම් වර්ගය) *'}
                    </label>
                    <select
                      value={advanceForm.category}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-rose-400"
                    >
                      {advanceForm.flowChoice === 'INSTITUTE_INCOME' ? (
                        <>
                          <option value="Tute Printing Charges" className="text-black">Tute Printing Charges (ටියුට් මුද්‍රණ වියදම් අයකර ගැනීම)</option>
                          <option value="Hall Charges & Facilities" className="text-black">Hall Charges & Facilities (ශාලා සහ පහසුකම් ගාස්තු)</option>
                          <option value="Class Supplies & Materials" className="text-black">Class Supplies & Materials (ද්‍රව්‍ය හා සැපයුම් ගාස්තු)</option>
                          <option value="Exam & Paper Fees" className="text-black">Exam & Paper Fees (ප්‍රශ්න පත්‍ර මුද්‍රණ ගාස්තු)</option>
                          <option value="Institute Fee Recovery" className="text-black">Institute Fee Recovery (ආයතනික අයකර ගැනීම්)</option>
                          <option value="Other Deductions" className="text-black">Other Deductions (වෙනත් ආයතනික අයකර ගැනීම්)</option>
                        </>
                      ) : (
                        <>
                          <option value="Teacher Advance" className="text-black">Teacher Advance (ගුරු අත්තිකාරම්)</option>
                          <option value="Mid-Month Advance" className="text-black">Mid-Month Advance (අතරමැදි අත්තිකාරම්)</option>
                          <option value="Emergency Advance" className="text-black">Emergency Advance (හදිසි අත්තිකාරම්)</option>
                          <option value="Teacher Payout" className="text-black">Teacher Payout (ගුරු වැටුප් ගෙවීම්)</option>
                          <option value="Other Advance" className="text-black">Other Advance (වෙනත් අත්තිකාරම්)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Amount and Date in Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Amount (රුපියල්) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs.</span>
                        <input 
                          type="number"
                          step="any"
                          required
                          placeholder="0.00"
                          value={advanceForm.amount}
                          onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-lg font-black shadow-inner"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Date of Entry (දිනය) *
                      </label>
                      <input 
                        type="date"
                        required
                        value={advanceForm.date}
                        onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold shadow-inner cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Description / Note */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Description / Note (විස්තරය)
                    </label>
                    <textarea 
                      value={advanceForm.description}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, description: e.target.value })}
                      placeholder={advanceForm.flowChoice === 'INSTITUTE_INCOME' ? 'Reason for deduction (e.g. 500 Tutes printed for Revision class)...' : 'Reason for advance (e.g. Early payment requested by lecturer)...'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-rose-500/40 min-h-[75px] shadow-inner text-sm"
                    />
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={savingAdvance}
                    className={`w-full py-4 text-white rounded-xl font-bold shadow-xl transition-all text-sm tracking-wide mt-2 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${
                      advanceForm.flowChoice === 'INSTITUTE_INCOME'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
                    }`}
                  >
                    {savingAdvance ? (
                      'Processing...'
                    ) : advanceForm.flowChoice === 'INSTITUTE_INCOME' ? (
                      'Record Institute Income & Deduct from Teacher Payout'
                    ) : (
                      'Record Teacher Advance & Deduct from Cash Flow & Payout'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

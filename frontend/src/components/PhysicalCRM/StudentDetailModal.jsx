import React, { useState, useEffect, useMemo } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { 
  X, User, Calendar, CreditCard, MessageSquare, GraduationCap, Phone, 
  MapPin, Building, ShieldCheck, CheckCircle2, Clock, AlertCircle, 
  Loader2, Sparkles, Printer, RotateCcw, Search, Filter, ArrowUpRight,
  FileText, Check, AlertTriangle, ChevronRight, CalendarRange, Layers
} from 'lucide-react';
import { printThermalReceipt } from '../../utils/thermalReceiptPrinter';
import toast from 'react-hot-toast';

export default function StudentDetailModal({ studentId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' | 'attendance' | 'overview' | 'sms'
  
  // Payment Filters
  const [paymentClassFilter, setPaymentClassFilter] = useState('ALL');
  const [paymentSearch, setPaymentSearch] = useState('');
  
  // Attendance Filters (Class-wise & Date Range)
  const [attendanceClassFilter, setAttendanceClassFilter] = useState('ALL');
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceActivePreset, setAttendanceActivePreset] = useState('ALL');
  
  // Reversal confirmation modal state
  const [reversingPayment, setReversingPayment] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Inline Card Edit State
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [cardInput, setCardInput] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentDetails();
      setIsEditingCard(false);
      setCardInput('');
      setReversingPayment(null);
      // Reset filters on open
      setPaymentClassFilter('ALL');
      setPaymentSearch('');
      setAttendanceClassFilter('ALL');
      setAttendanceStartDate('');
      setAttendanceEndDate('');
      setAttendanceSearch('');
      setAttendanceActivePreset('ALL');
    }
  }, [isOpen, studentId]);

  const fetchStudentDetails = async () => {
    setLoading(true);
    try {
      const res = await physicalCrmService.getStudentFullDetails(studentId);
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      toast.error('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCard = async () => {
    if (!studentId) return;
    setSavingCard(true);
    try {
      const res = await physicalCrmService.allocateCard(studentId, cardInput);
      toast.success(res.message || 'Card updated successfully!');
      setIsEditingCard(false);
      fetchStudentDetails();
    } catch (err) {
      console.error('Error allocating card:', err);
      toast.error(err.response?.data?.error || 'Failed to allocate card');
    } finally {
      setSavingCard(false);
    }
  };

  // Reverse Accidental / Future Month Fee Payment
  const handleConfirmReverse = async () => {
    if (!reversingPayment) return;
    setIsReversing(true);
    try {
      const res = await physicalCrmService.reverseFeePayment({
        studentId: student.id,
        classId: reversingPayment.classId,
        month: reversingPayment.month,
        reason: reversalReason || 'Accidental/future month entry reversed by staff'
      });
      toast.success(res.message || 'Payment reversed & cashflow adjusted successfully!', { icon: '🔄' });
      setReversingPayment(null);
      setReversalReason('');
      fetchStudentDetails();
    } catch (err) {
      console.error('Error reversing payment:', err);
      toast.error(err.response?.data?.error || 'Failed to reverse payment');
    } finally {
      setIsReversing(false);
    }
  };

  // Print Thermal Receipt for a past payment
  const handlePrintPastReceipt = (payment) => {
    if (!student || !payment) return;
    const sName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
    const clsName = payment.class?.name || 'Class Fee';
    const amountVal = payment.amount || 0;

    printThermalReceipt({
      receiptNo: `REC-${payment.id || Date.now().toString().slice(-6)}`,
      studentId: student.studentId || '-',
      studentName: sName,
      studentPhone: student.phone || '',
      guardianPhone: student.guardianPhone || '',
      className: clsName,
      month: payment.month || '',
      cardType: payment.status === 'FREE_CARD' ? 'FREE CARD' : (payment.status === 'HALF_PAYMENT' ? 'HALF CARD' : 'FULL CARD'),
      amount: amountVal,
      paymentMethod: payment.paymentMethod || 'CASH',
      paidDate: payment.paidDate || new Date(),
      status: payment.status || 'PAID ✓',
      notes: 'Reprinted receipt from Student History Report.',
      items: [
        {
          classId: payment.classId,
          className: clsName,
          description: `Class Fee - ${clsName}`,
          month: payment.month,
          cardType: payment.status === 'FREE_CARD' ? 'FREE' : 'FULL',
          amount: amountVal
        }
      ]
    });
    toast.success('Sent receipt to 80mm thermal printer!', { icon: '🖨️' });
  };

  // Date Range Quick Preset Helper
  const handleSetDatePreset = (preset) => {
    setAttendanceActivePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setAttendanceStartDate('');
      setAttendanceEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setAttendanceStartDate(`${year}-${month}-01`);
      setAttendanceEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'LAST_MONTH') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, prevDate.getMonth() + 1, 0).getDate();
      setAttendanceStartDate(`${year}-${month}-01`);
      setAttendanceEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'LAST_30_DAYS') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setAttendanceStartDate(past.toISOString().split('T')[0]);
      setAttendanceEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'THIS_YEAR') {
      const year = now.getFullYear();
      setAttendanceStartDate(`${year}-01-01`);
      setAttendanceEndDate(`${year}-12-31`);
    }
  };

  const handlePrintFullReport = () => {
    window.print();
  };

  const student = data?.student;
  const transactions = data?.transactions || [];
  const smsLogs = data?.smsLogs || [];

  const studentDisplayName = student ? (student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student') : '';

  // Extract All Distinct Classes associated with this student (enrolled, historical fees, attendances)
  const studentClasses = useMemo(() => {
    if (!student) return [];
    const map = new Map();
    if (student.class) {
      map.set(student.class.id, student.class);
    }
    if (student.enrollments) {
      student.enrollments.forEach(e => {
        if (e.class) map.set(e.class.id, e.class);
      });
    }
    if (student.feePayments) {
      student.feePayments.forEach(p => {
        if (p.class) map.set(p.class.id, p.class);
      });
    }
    if (student.attendances) {
      student.attendances.forEach(a => {
        if (a.class) map.set(a.class.id, a.class);
      });
    }
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [student]);

  // Fee Payments calculations & filtering
  const feePayments = student?.feePayments || [];
  const totalPaidAmount = feePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidMonthsCount = feePayments.filter(p => p.status === 'PAID' || p.status === 'FREE_CARD' || p.status === 'HALF_PAYMENT').length;

  const filteredPayments = useMemo(() => {
    return feePayments.filter(p => {
      if (paymentClassFilter !== 'ALL') {
        if (String(p.classId) !== String(paymentClassFilter)) return false;
      }
      if (paymentSearch.trim()) {
        const term = paymentSearch.trim().toLowerCase();
        const match =
          (p.month && p.month.toLowerCase().includes(term)) ||
          (p.class?.name && p.class.name.toLowerCase().includes(term)) ||
          (p.status && p.status.toLowerCase().includes(term)) ||
          (p.paymentMethod && p.paymentMethod.toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [feePayments, paymentClassFilter, paymentSearch]);

  const filteredPaymentTotal = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Attendances calculations & filtering
  const attendances = student?.attendances || [];
  const filteredAttendances = useMemo(() => {
    return attendances.filter(att => {
      // 1. Class-wise filter
      if (attendanceClassFilter !== 'ALL') {
        if (attendanceClassFilter === 'GATE') {
          if (att.classId !== null) return false;
        } else {
          if (String(att.classId) !== String(attendanceClassFilter)) return false;
        }
      }

      // 2. Date Range filter
      if (attendanceStartDate || attendanceEndDate) {
        const attDateStr = new Date(att.date).toISOString().split('T')[0];
        if (attendanceStartDate && attDateStr < attendanceStartDate) return false;
        if (attendanceEndDate && attDateStr > attendanceEndDate) return false;
      }

      // 3. Search query
      if (attendanceSearch.trim()) {
        const term = attendanceSearch.trim().toLowerCase();
        const dateStr = new Date(att.date).toLocaleDateString('en-GB');
        const match =
          dateStr.toLowerCase().includes(term) ||
          (att.class?.name && att.class.name.toLowerCase().includes(term)) ||
          (att.status && att.status.toLowerCase().includes(term));
        if (!match) return false;
      }

      return true;
    });
  }, [attendances, attendanceClassFilter, attendanceStartDate, attendanceEndDate, attendanceSearch]);

  const isAttendanceFilterActive = attendanceClassFilter !== 'ALL' || attendanceStartDate !== '' || attendanceEndDate !== '' || attendanceSearch.trim() !== '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* EXPANDED EXTRA WIDE MODAL WINDOW (max-w-[1400px] / 95vw) */}
      <div className="relative w-full max-w-[1400px] xl:w-[95vw] bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b1120] border border-white/15 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/20 shrink-0">
              {studentDisplayName.slice(0, 2).toUpperCase() || 'ST'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">{studentDisplayName}</h2>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-400/30">
                  {student?.studentId}
                </span>
                {student?.cardType && (
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    student.cardType === 'FREE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    student.cardType === 'HALF' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {student.cardType === 'FREE' ? '🟣 Free Card' : student.cardType === 'HALF' ? '🟡 Half Card' : '🔵 Full Card'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2.5">
                <span>School: <strong className="text-slate-200">{student?.school?.name || 'N/A'}</strong></span>
                <span>•</span>
                <span>Phone: <strong className="text-slate-200 font-mono">{student?.phone || 'N/A'}</strong></span>
                <span>•</span>
                <span>RFID: <strong className="text-emerald-400 font-mono">{student?.rfid || 'Unassigned'}</strong></span>
                <span>•</span>
                <span>Total Classes: <strong className="text-indigo-300">{studentClasses.length} Associated</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 shrink-0 ml-auto">
            <button
              onClick={handlePrintFullReport}
              className="p-2.5 px-4 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Print History Report"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-2 border-b border-white/10 bg-black/25 overflow-x-auto custom-scrollbar">
          {[
            { id: 'payments', label: `🟣 Payment History (${feePayments.length})`, icon: CreditCard, color: 'text-purple-400' },
            { id: 'attendance', label: `🟣 Attendance History (${attendances.length})`, icon: Calendar, color: 'text-emerald-400' },
            { id: 'overview', label: `Profile & Classes (${studentClasses.length})`, icon: User, color: 'text-blue-400' },
            { id: 'sms', label: `SMS Logs (${smsLogs.length})`, icon: MessageSquare, color: 'text-amber-400' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-purple-500 text-white bg-purple-500/10 rounded-t-xl shadow-inner'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} className={isActive ? tab.color : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-purple-400" size={32} />
              <span className="text-sm font-bold text-slate-300">Loading Complete Student Report...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: 🟣 PAYMENT HISTORY */}
              {activeTab === 'payments' && (
                <div className="space-y-5">
                  {/* Summary Stat Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-slate-900 border border-purple-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block mb-1">Total Fee Collected</span>
                      <p className="text-2xl font-black text-white font-mono">Rs. {totalPaidAmount.toLocaleString()}</p>
                      {paymentClassFilter !== 'ALL' && (
                        <p className="text-[10px] text-purple-300 mt-1">Filtered: Rs. {filteredPaymentTotal.toLocaleString()}</p>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-950/40 via-indigo-900/20 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">Paid Months</span>
                      <p className="text-2xl font-black text-indigo-200">{paidMonthsCount} Months</p>
                      <p className="text-[10px] text-slate-400 mt-1">Total Records: {feePayments.length}</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">Registration Fee</span>
                      <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border mt-1 ${
                        student?.registrationFeeStatus === 'PAID'
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40'
                          : 'bg-amber-500/25 text-amber-300 border-amber-400/40'
                      }`}>
                        {student?.registrationFeeStatus === 'PAID' ? 'PAID ✓' : 'PENDING ⚠️'}
                      </span>
                    </div>

                    <div className="bg-gradient-to-br from-blue-950/40 via-blue-900/20 to-slate-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block mb-1">Card Allocation</span>
                      <p className="text-sm font-black text-blue-200 mt-1">{student?.cardType || 'FULL'} CARD</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Assigned Rate</p>
                    </div>
                  </div>

                  {/* Payment Filters Bar (Class-wise & Keyword Search) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3.5 rounded-2xl border border-white/10">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                      {/* Class Filter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
                        <Layers size={14} className="text-purple-400 shrink-0" />
                        <select
                          value={paymentClassFilter}
                          onChange={(e) => setPaymentClassFilter(e.target.value)}
                          className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                        >
                          <option value="ALL" className="bg-slate-900 text-white">All Classes ({feePayments.length} records)</option>
                          {studentClasses.map(cls => (
                            <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                              {cls.name} ({cls.grade})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Keyword Search */}
                      <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search month (e.g. 2026-10), class, or method..."
                          value={paymentSearch}
                          onChange={(e) => setPaymentSearch(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold shrink-0">
                      {(paymentClassFilter !== 'ALL' || paymentSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentClassFilter('ALL');
                            setPaymentSearch('');
                          }}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] text-slate-300 cursor-pointer"
                        >
                          Clear Filter
                        </button>
                      )}
                      <span>Showing {filteredPayments.length} of {feePayments.length} records</span>
                    </div>
                  </div>

                  {/* Payment Records Table */}
                  {filteredPayments.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs bg-white/5 rounded-2xl border border-white/5">
                      <CreditCard size={32} className="mx-auto mb-2 opacity-30 text-purple-400" />
                      No fee payment records found matching your filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-extrabold uppercase tracking-wider">
                            <th className="py-3 px-4">Month</th>
                            <th className="py-3 px-4">Class</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Paid Date</th>
                            <th className="py-3 px-4">Method</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200 font-medium">
                          {filteredPayments.map(p => {
                            const isPaid = p.status === 'PAID' || p.status === 'FREE_CARD' || p.status === 'HALF_PAYMENT';
                            return (
                              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3.5 px-4">
                                  <span className="font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
                                    {p.month}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-bold text-indigo-300">
                                  {p.class?.name || `Class #${p.classId}`}
                                  {p.class?.grade && (
                                    <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({p.class.grade})</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-black text-emerald-400 font-mono text-sm">
                                  Rs. {Number(p.amount || 0).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider inline-flex items-center gap-1 ${
                                    p.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' :
                                    p.status === 'FREE_CARD' ? 'bg-purple-500/20 text-purple-300 border-purple-400/30' :
                                    p.status === 'HALF_PAYMENT' ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' :
                                    p.status === 'PARTIAL' ? 'bg-orange-500/20 text-orange-300 border-orange-400/30' :
                                    'bg-slate-500/20 text-slate-300 border-slate-400/30'
                                  }`}>
                                    {isPaid && <Check size={11} />}
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                                  {p.paidDate ? new Date(p.paidDate).toLocaleDateString('en-GB') : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                    {p.paymentMethod || 'CASH'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isPaid && (
                                      <button
                                        type="button"
                                        onClick={() => handlePrintPastReceipt(p)}
                                        className="p-1.5 px-3 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/25 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                                        title="Print 80mm Receipt"
                                      >
                                        <Printer size={13} /> Receipt
                                      </button>
                                    )}

                                    {/* REVERSE PAYMENT OPTION */}
                                    {isPaid && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReversingPayment(p);
                                          setReversalReason('');
                                        }}
                                        className="p-1.5 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/25 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                        title="Reverse Accidental / Future Month Payment"
                                      >
                                        <RotateCcw size={13} /> Reverse
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: 🟣 ATTENDANCE HISTORY (CLASS-WISE & DATE RANGE) */}
              {activeTab === 'attendance' && (
                <div className="space-y-5">
                  {/* Attendance Stats Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                        {isAttendanceFilterActive ? 'Filtered Days Present' : 'Total Days Present'}
                      </span>
                      <p className="text-2xl font-black text-white font-mono">{filteredAttendances.length} Days</p>
                      {isAttendanceFilterActive && (
                        <p className="text-[10px] text-emerald-400 mt-1">Out of {attendances.length} total recorded</p>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-950/40 via-indigo-900/20 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">Selected Class</span>
                      <p className="text-xs font-black text-indigo-200 mt-1 truncate" title={attendanceClassFilter === 'ALL' ? 'All Classes' : studentClasses.find(c => String(c.id) === String(attendanceClassFilter))?.name || 'Class'}>
                        {attendanceClassFilter === 'ALL' ? 'All Classes' : studentClasses.find(c => String(c.id) === String(attendanceClassFilter))?.name || 'Class'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Filter Active</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-slate-900 border border-purple-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block mb-1">Date Range Filter</span>
                      <p className="text-xs font-black text-purple-200 mt-1">
                        {attendanceStartDate || attendanceEndDate ? `${attendanceStartDate || 'Start'} to ${attendanceEndDate || 'End'}` : 'All Recorded Dates'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Preset: {attendanceActivePreset}</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-950/40 via-blue-900/20 to-slate-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg">
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block mb-1">RFID Card Tracking</span>
                      <p className="text-xs font-bold text-blue-200 mt-1">{student?.rfid ? `💳 ${student.rfid}` : 'Manual Scanner'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Gate / Terminal</p>
                    </div>
                  </div>

                  {/* ADVANCED CLASS-WISE & DATE RANGE FILTER CONTROLS */}
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* 1. Class-wise Selector (5 Cols) */}
                      <div className="md:col-span-5">
                        <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                          <Layers size={13} className="text-purple-400" /> Filter by Class:
                        </label>
                        <div className="bg-white/5 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-emerald-500 transition-all">
                          <select
                            value={attendanceClassFilter}
                            onChange={(e) => setAttendanceClassFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer"
                          >
                            <option value="ALL" className="bg-slate-900 text-white">All Classes ({attendances.length} Sessions)</option>
                            {studentClasses.map(cls => {
                              const classCount = attendances.filter(a => a.classId === cls.id).length;
                              return (
                                <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                                  {cls.name} ({cls.grade}) — {classCount} Days Present
                                </option>
                              );
                            })}
                            {attendances.some(a => !a.classId) && (
                              <option value="GATE" className="bg-slate-900 text-white">
                                Physical Gate Entrance (General) — {attendances.filter(a => !a.classId).length} Days
                              </option>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* 2. Date Range Inputs: Start Date & End Date (5 Cols) */}
                      <div className="md:col-span-5">
                        <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                          <CalendarRange size={13} className="text-emerald-400" /> Date Range:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/5 border border-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 focus-within:border-emerald-500">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">From</span>
                            <input
                              type="date"
                              value={attendanceStartDate}
                              onChange={(e) => {
                                setAttendanceStartDate(e.target.value);
                                setAttendanceActivePreset('CUSTOM');
                              }}
                              className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer [color-scheme:dark]"
                            />
                          </div>

                          <div className="bg-white/5 border border-white/15 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 focus-within:border-emerald-500">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">To</span>
                            <input
                              type="date"
                              value={attendanceEndDate}
                              onChange={(e) => {
                                setAttendanceEndDate(e.target.value);
                                setAttendanceActivePreset('CUSTOM');
                              }}
                              className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer [color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Search / Reset (2 Cols) */}
                      <div className="md:col-span-2 flex flex-col justify-end">
                        <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider block mb-1.5">
                          Search Keyword:
                        </label>
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Keyword..."
                            value={attendanceSearch}
                            onChange={(e) => setAttendanceSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/15 rounded-xl pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-medium"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Quick Range Presets & Filter Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
                        {[
                          { id: 'ALL', label: 'All Time' },
                          { id: 'THIS_MONTH', label: 'This Month' },
                          { id: 'LAST_MONTH', label: 'Last Month' },
                          { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
                          { id: 'THIS_YEAR', label: 'This Year' }
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSetDatePreset(p.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              attendanceActivePreset === p.id 
                                ? 'bg-emerald-500 text-slate-950 shadow-md font-black' 
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        {isAttendanceFilterActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setAttendanceClassFilter('ALL');
                              setAttendanceStartDate('');
                              setAttendanceEndDate('');
                              setAttendanceSearch('');
                              setAttendanceActivePreset('ALL');
                            }}
                            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <X size={12} /> Clear Filters
                          </button>
                        )}
                        <span className="text-xs text-slate-400 font-bold">
                          Showing {filteredAttendances.length} of {attendances.length} attendance records
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Records Table */}
                  {filteredAttendances.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs bg-white/5 rounded-2xl border border-white/5">
                      <Calendar size={32} className="mx-auto mb-2 opacity-30 text-emerald-400" />
                      No attendance history records found for the selected class and date range.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-extrabold uppercase tracking-wider">
                            <th className="py-3 px-4">Date & Day</th>
                            <th className="py-3 px-4">Class Attended</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Time Recorded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200 font-medium">
                          {filteredAttendances.map(att => {
                            const dateObj = new Date(att.date);
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            return (
                              <tr key={att.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase font-mono">
                                      {dayName}
                                    </span>
                                    <span className="font-bold text-white font-mono text-sm">{dateFormatted}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-bold text-indigo-300 text-sm">
                                  {att.class?.name || (att.classId ? `Class #${att.classId}` : 'Physical Gate Entrance')}
                                  {att.class?.grade && (
                                    <span className="text-xs text-slate-400 ml-2 font-normal">({att.class.grade})</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                                    <CheckCircle2 size={13} className="text-emerald-400" />
                                    {att.status || 'PRESENT'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                                  {att.createdAt ? new Date(att.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: OVERVIEW & CLASSES */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Bio & Contact Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Student Phone</span>
                      <p className="text-sm font-bold text-white font-mono">{student?.phone || 'No Phone'}</p>
                      {student?.whatsapp && <p className="text-[11px] text-emerald-400 mt-1 font-mono">WA: {student.whatsapp}</p>}
                    </div>

                    <div className="bg-black/30 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Guardian Contact</span>
                      <p className="text-sm font-bold text-white">{student?.guardianName || 'Guardian'}</p>
                      <p className="text-xs text-amber-400 font-mono mt-0.5">{student?.guardianPhone || 'No Guardian Phone'}</p>
                    </div>

                    <div className="bg-black/30 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">School & Location</span>
                      <p className="text-sm font-bold text-white">{student?.school?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{student?.city ? `${student.city}, ` : ''}{student?.district || ''}</p>
                    </div>
                  </div>

                  {/* ID Card / RFID Allocation Box */}
                  <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <CreditCard size={13} /> Physical ID Card / RFID
                      </span>
                      <p className="text-sm font-bold text-white font-mono">
                        {student?.rfid ? `💳 Assigned: ${student.rfid}` : '⚠️ No Card / RFID Allocated'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {isEditingCard ? (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Scan/Type Card Code..."
                            value={cardInput}
                            onChange={(e) => setCardInput(e.target.value.trim())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCard();
                              }
                            }}
                            className="bg-black/70 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs text-emerald-200 font-mono font-bold outline-none flex-1 sm:w-44"
                          />
                          <button
                            type="button"
                            onClick={handleSaveCard}
                            disabled={savingCard}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-all disabled:opacity-50"
                          >
                            {savingCard ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingCard(false)}
                            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 text-xs rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {student?.rfid && (
                            <button
                              type="button"
                              onClick={() => {
                                setCardInput('');
                                handleSaveCard();
                              }}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Unlink
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCardInput(student?.rfid || '');
                              setIsEditingCard(true);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <CreditCard size={13} />
                            <span>{student?.rfid ? 'Change Card' : '+ Allocate Card'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Associated Physical Classes */}
                  <div>
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <GraduationCap size={15} className="text-indigo-400" /> Associated Physical Classes ({studentClasses.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {studentClasses.map(cls => (
                        <div key={cls.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-black text-white">{cls.name}</h4>
                            <p className="text-xs text-slate-400">{cls.grade} • {cls.subject || 'All Subjects'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-400">Rs. {Number(cls.monthlyFee || 0).toLocaleString()}</span>
                            <span className="block text-[10px] text-slate-500">Monthly Fee</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SMS LOGS */}
              {activeTab === 'sms' && (
                <div className="space-y-3">
                  {smsLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs bg-white/5 rounded-2xl border border-white/5">
                      <MessageSquare size={32} className="mx-auto mb-2 opacity-30 text-amber-400" />
                      No SMS notifications logged for this student yet.
                    </div>
                  ) : (
                    smsLogs.map(log => (
                      <div key={log.id} className="p-4 bg-black/30 border border-white/10 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              log.status === 'SENT'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                            }`}>
                              {log.status}
                            </span>
                            <span className="text-xs font-bold text-white font-mono">{log.phone}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/5 font-sans leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Reversal Confirmation Modal */}
        {reversingPayment && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Reverse Fee Payment</h3>
                  <p className="text-xs text-rose-300">Month: {reversingPayment.month} • {reversingPayment.class?.name || 'Class'}</p>
                </div>
              </div>

              <div className="bg-rose-950/30 border border-rose-500/25 p-3.5 rounded-xl text-xs text-rose-200 leading-relaxed space-y-1">
                <p>⚠️ <strong>Cashflow Notice:</strong></p>
                <p>Reversing this payment (Rs. {Number(reversingPayment.amount || 0).toLocaleString()}) will revert the student's status for <strong>{reversingPayment.month}</strong> to <strong>UNPAID</strong>.</p>
                <p>The corresponding entry in the Cash Flow will be automatically reversed to keep daily drawer and accounting balances perfectly matched.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Reason for Reversal (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Accidental click for future month"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReversingPayment(null)}
                  disabled={isReversing}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReverse}
                  disabled={isReversing}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isReversing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  <span>Confirm Reverse</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Student: <strong className="text-white font-mono">{student?.studentId}</strong> • {studentDisplayName}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

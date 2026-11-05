import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Filter, Phone, MessageSquare, ExternalLink, 
  Download, FileSpreadsheet, RefreshCw, Calendar, CheckCircle2, 
  Clock, AlertCircle, ArrowLeft, GraduationCap, MapPin, 
  ShieldCheck, Copy, PhoneCall, ChevronRight, Check, X, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { physicalCrmService } from '../../api/physicalCrm';

export default function ClassFollowUpReportView({ initialClassId = null, onBack = null }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || 'ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('UNPAID'); // 'UNPAID' | 'TARGET_UNPAID' | 'PAID' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchReport();
  }, [selectedClassId, selectedTeacherId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedClassId !== 'ALL') params.classId = selectedClassId;
      if (selectedTeacherId !== 'ALL') params.teacherId = selectedTeacherId;

      const res = await physicalCrmService.getClassFollowUpReport(params);
      if (res && res.success) {
        setReportData(res);
        if (res.class && selectedClassId === 'ALL') {
          setSelectedClassId(String(res.class.id));
        }
      }
    } catch (err) {
      console.error('Failed to load class follow-up report:', err);
      toast.error('Failed to load class follow-up report: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Open student in Attendance & Fee Portal
  const handleOpenStudentInPortal = (studentId) => {
    if (!studentId) return;
    navigate(`/physical/dashboard/attendance?studentId=${encodeURIComponent(studentId)}`);
  };

  // Copy phone number helper
  const handleCopyPhone = (phone, label) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    toast.success(`Copied ${label || 'Phone'}: ${phone}`, { icon: '📋' });
  };

  // Filter students based on UI controls
  const filteredStudents = useMemo(() => {
    if (!reportData || !reportData.students) return [];

    let list = reportData.students;

    // Filter by follow-up status
    if (selectedStatusFilter === 'UNPAID') {
      list = list.filter(s => s.hasUnpaidFees);
    } else if (selectedStatusFilter === 'TARGET_UNPAID') {
      list = list.filter(s => !s.targetMonthPaid);
    } else if (selectedStatusFilter === 'PAID') {
      list = list.filter(s => !s.hasUnpaidFees);
    }

    // Filter by search term
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      list = list.filter(s => 
        s.studentName.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        s.phone.includes(term) ||
        s.guardianPhone.includes(term) ||
        s.guardianName.toLowerCase().includes(term) ||
        s.address.toLowerCase().includes(term) ||
        s.schoolName.toLowerCase().includes(term)
      );
    }

    return list;
  }, [reportData, selectedStatusFilter, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatusFilter, searchQuery, selectedClassId]);

  // Pagination slice
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Classes filtered by selected teacher
  const availableClasses = useMemo(() => {
    if (!reportData || !reportData.allClasses) return [];
    if (selectedTeacherId === 'ALL') return reportData.allClasses;
    const tId = parseInt(selectedTeacherId);
    return reportData.allClasses.filter(c => c.teachers?.some(t => t.id === tId));
  }, [reportData, selectedTeacherId]);

  // Export Follow-up Call Sheet to Excel (.xlsx) exactly matching the Current View
  const handleExportExcel = () => {
    if (!reportData || !reportData.class || filteredStudents.length === 0) {
      return toast.error('No student data to export.');
    }

    setExporting(true);
    try {
      const cls = reportData.class;
      const months = reportData.months || [];
      const lecturers = cls.teachers?.map(t => t.name).join(', ') || 'N/A';

      const filterLabels = {
        'UNPAID': '📞 Need Follow-up / Has Unpaid Fees',
        'TARGET_UNPAID': '⚠️ Unpaid in Active Month',
        'PAID': '✅ Fully Paid',
        'ALL': 'All Registered Students'
      };
      const activeFilterName = filterLabels[selectedStatusFilter] || selectedStatusFilter;

      // Title & Meta Banner matching top KPI cards of current view
      const titleRow = [`CLASS FOLLOW-UP & CALL SHEET - ${cls.name.toUpperCase()}`];
      const metaRow1 = [
        `Lecturer(s): ${lecturers}`,
        '',
        `Active Filter: ${activeFilterName}`,
        '',
        searchQuery ? `Search: "${searchQuery}"` : '',
        '',
        `Exported On: ${new Date().toLocaleString()}`
      ];
      const metaRow2 = [
        `Total Registered: ${summary.totalStudents || 0}`,
        `Current View Students: ${filteredStudents.length}`,
        `Unpaid Follow-ups: ${summary.unpaidFollowUpCount || 0}`,
        `Avg Class Attendance: ${summary.averageAttendanceRate || 0}%`
      ];
      const blankRow = [];

      // Exact Table Headers matching current view table columns (Non-monetary call sheet)
      const headers = [
        '#',
        'Student ID',
        'Student Name',
        'Card Type',
        'Student Phone',
        'Guardian Phone',
        'Guardian Name',
        'Full Address',
        'School',
        ...months.flatMap(m => [
          `${m.label} Fee Status`,
          `${m.label} Attendance`
        ]),
        'Attendance Rate (%)'
      ];

      // Exact Data Rows matching current view table rows
      const rows = filteredStudents.map((st, idx) => {
        const monthColumns = months.flatMap(m => {
          const mData = st.months?.[m.monthKey];
          if (!mData) return ['-', '-'];

          const isNotEnrolled = mData.status === 'NOT_ENROLLED' || mData.isBeforeEnrollment;
          if (isNotEnrolled) {
            return ['-', '-'];
          }

          let feeStatusStr = mData.status || 'UNPAID';
          if (mData.status === 'FREE_CARD') feeStatusStr = 'FREE';
          else if (mData.status === 'PAID') feeStatusStr = 'PAID';
          else if (mData.status === 'PARTIAL') feeStatusStr = 'PARTIAL';
          else if (mData.status === 'UNPAID') feeStatusStr = 'UNPAID';

          const attendanceStr = `${mData.attendedDays || 0}/${mData.scheduledDays || 0} Days`;

          return [feeStatusStr, attendanceStr];
        });

        return [
          idx + 1,
          st.studentId || '',
          st.studentName || '',
          st.cardType || 'FULL',
          st.phone || '',
          st.guardianPhone || '',
          st.guardianName || '',
          st.address || '',
          st.schoolName || '',
          ...monthColumns,
          `${st.attendanceRate || 0}%`
        ];
      });

      // Bottom Total Row
      const totalRow = [
        'TOTAL',
        '',
        `Total Students: ${filteredStudents.length}`,
        '',
        '',
        '',
        '',
        '',
        '',
        ...months.flatMap(() => ['', '']),
        `${summary.averageAttendanceRate || 0}%`
      ];

      // Assemble sheet
      const wsData = [
        titleRow,
        metaRow1,
        metaRow2,
        blankRow,
        headers,
        ...rows,
        totalRow
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths matching the view
      const colWidths = [
        { wch: 6 },   // #
        { wch: 16 },  // Student ID
        { wch: 28 },  // Student Name
        { wch: 12 },  // Card Type
        { wch: 16 },  // Student Phone
        { wch: 16 },  // Guardian Phone
        { wch: 20 },  // Guardian Name
        { wch: 38 },  // Full Address
        { wch: 24 },  // School
        ...months.flatMap(() => [
          { wch: 16 }, // Month Fee Status
          { wch: 16 }  // Month Attendance
        ]),
        { wch: 18 }   // Attendance Rate (%)
      ];
      ws['!cols'] = colWidths;

      // Merges for title row
      const totalColCount = headers.length;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalColCount - 1 } }
      ];

      // Create Workbook
      const wb = XLSX.utils.book_new();
      const safeSheetName = (cls.name || 'Class_Report').replace(/[*?:/[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

      // Download file with active filter in name
      const filterSlug = selectedStatusFilter.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fileName = `${(cls.name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_')}_CurrentView_${filterSlug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exported ${filteredStudents.length} student records from current view!`, { icon: '📊' });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export Excel file: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const currentClass = reportData?.class;
  const months = reportData?.months || [];
  const summary = reportData?.summary || {};

  return (
    <div className="w-full space-y-5 animate-fade-in">
      
      {/* TOP CONTROLS & FILTER BAR */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-4 rounded-3xl shadow-xl space-y-4">
        
        {/* Row 1: Back Button & Class / Teacher Dropdowns */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 flex-wrap">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}

            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <PhoneCall size={20} className="text-emerald-400" />
                <span>Class Follow-up & Payment Call Sheet</span>
              </h2>
              <p className="text-xs text-white/50">
                Monitor student fees, attendance, full addresses & make follow-up calls
              </p>
            </div>
          </div>

          {/* Action Buttons: Export Excel & Refresh */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || loading || filteredStudents.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
              title="Download Excel spreadsheet matching the exact current view table and filters"
            >
              <FileSpreadsheet size={16} />
              <span>{exporting ? 'Generating Excel...' : 'Export Current View (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={fetchReport}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all cursor-pointer"
              title="Refresh Report Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

        </div>

        {/* Row 2: Selectors (Teacher, Class, Search) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-white/10">
          
          {/* Lecturer Selector (3 cols) */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[11px] font-black text-white/60 uppercase tracking-wider block">
              Filter by Lecturer:
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => {
                setSelectedTeacherId(e.target.value);
                setSelectedClassId('ALL');
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Lecturers</option>
              {(reportData?.teachers || []).map(t => (
                <option key={t.id} value={t.id}>
                  👨‍🏫 {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector (5 cols) */}
          <div className="lg:col-span-5 space-y-1">
            <label className="text-[11px] font-black text-white/60 uppercase tracking-wider block">
              Select Class:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Select a Class...</option>
              {availableClasses.map(c => (
                <option key={c.id} value={c.id}>
                  📚 {c.name} ({c.grade || 'A/L'} - Rs. {(c.monthlyFee || 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Search Box (4 cols) */}
          <div className="lg:col-span-4 space-y-1">
            <label className="text-[11px] font-black text-white/60 uppercase tracking-wider block">
              Quick Search Students:
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search name, phone, address, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs text-white placeholder-white/40 outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Row 3: Follow-Up Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10 flex-wrap">
          <span className="text-[11px] font-bold text-white/50 mr-1 flex items-center gap-1">
            <Filter size={13} /> Follow-up Filter:
          </span>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('UNPAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedStatusFilter === 'UNPAID'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 border border-rose-400'
                : 'bg-white/5 hover:bg-white/10 text-rose-300 border border-white/10'
            }`}
          >
            <AlertCircle size={13} />
            <span>📞 Need Follow-up / Has Unpaid ({summary.unpaidFollowUpCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('TARGET_UNPAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedStatusFilter === 'TARGET_UNPAID'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 border border-amber-400'
                : 'bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10'
            }`}
          >
            <Clock size={13} />
            <span>Unpaid in Active Month</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedStatusFilter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400'
                : 'bg-white/5 hover:bg-white/10 text-emerald-300 border border-white/10'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Fully Paid ({summary.fullyPaidCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedStatusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400'
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
            }`}
          >
            <Users size={13} />
            <span>All Registered Students ({summary.totalStudents || 0})</span>
          </button>
        </div>

      </div>

      {/* KPI SUMMARY CARDS */}
      {currentClass && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          
          {/* Card 1: Total Registered */}
          <div className="bg-black/35 backdrop-blur-xl border border-white/15 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-white/60 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Registered</span>
              <Users size={16} className="text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white">{summary.totalStudents || 0}</p>
            <p className="text-[10px] text-white/40 mt-0.5 truncate">{currentClass.name}</p>
          </div>

          {/* Card 2: Needs Follow-up Calls */}
          <div className="bg-gradient-to-br from-rose-950/40 via-black/40 to-black/40 backdrop-blur-xl border border-rose-500/30 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-rose-300 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Follow-up List</span>
              <PhoneCall size={16} className="text-rose-400" />
            </div>
            <p className="text-2xl font-black text-rose-300">{summary.unpaidFollowUpCount || 0}</p>
            <p className="text-[10px] text-rose-400/70 mt-0.5">Students with unpaid fees</p>
          </div>

          {/* Card 3: Total Outstanding Due */}
          <div className="bg-gradient-to-br from-amber-950/40 via-black/40 to-black/40 backdrop-blur-xl border border-amber-500/30 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-amber-300 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Outstanding</span>
              <Clock size={16} className="text-amber-400" />
            </div>
            <p className="text-xl font-black text-amber-300">
              Rs. {(summary.totalClassDueAmount || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">To collect via calls</p>
          </div>

          {/* Card 4: Total Collected */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-black/40 to-black/40 backdrop-blur-xl border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-emerald-300 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Collected</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-xl font-black text-emerald-300">
              Rs. {(summary.totalClassCollectedAmount || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-emerald-400/70 mt-0.5">
              {summary.fullyPaidCount || 0} students fully paid
            </p>
          </div>

          {/* Card 5: Class Attendance */}
          <div className="bg-black/35 backdrop-blur-xl border border-white/15 p-4 rounded-2xl shadow-lg col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-white/60 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Class Attendance</span>
              <Sparkles size={16} className="text-purple-400" />
            </div>
            <p className="text-2xl font-black text-purple-300">{summary.averageAttendanceRate || 0}%</p>
            <p className="text-[10px] text-white/40 mt-0.5">Average attendance rate</p>
          </div>

        </div>
      )}

      {/* MAIN DATA TABLE CONTAINER */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Table Top Bar */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white">
              {currentClass ? currentClass.name : 'Class Student Roster'}
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white/70">
              Showing {filteredStudents.length} of {summary.totalStudents || 0} Students
            </span>
            {currentClass?.teachers && currentClass.teachers.length > 0 && (
              <span className="text-xs text-white/50 hidden md:inline">
                👨‍🏫 Lecturer: {currentClass.teachers.map(t => t.name).join(', ')}
              </span>
            )}
          </div>

          {/* Quick Page Info */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-white font-bold cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-white font-bold cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/70 font-bold border-b border-white/10 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12 sticky left-0 bg-[#0e1320] z-20">#</th>
                <th className="py-3 px-4 min-w-[220px] sticky left-12 bg-[#0e1320] z-20">Student Name & ID</th>
                <th className="py-3 px-4 min-w-[200px]">Phone & Guardian</th>
                <th className="py-3 px-4 min-w-[240px]">Full Address & School</th>
                {months.map(m => (
                  <th key={m.monthKey} className="py-3 px-3 text-center min-w-[140px] border-l border-white/10">
                    <div className="font-extrabold text-white text-xs">{m.label}</div>
                    <div className="text-[10px] text-white/40 lowercase font-normal">Fee & Attendance</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-center min-w-[110px] border-l border-white/10">Due Balance</th>
                <th className="py-3 px-3 text-center min-w-[100px] border-l border-white/10">Attendance</th>
                <th className="py-3 px-3 text-center min-w-[110px] border-l border-white/10 sticky right-0 bg-[#0e1320] z-20">Quick Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {loading ? (
                <tr>
                  <td colSpan={6 + months.length} className="text-center py-16 text-white/50">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-400" />
                    <p className="text-sm font-bold">Loading class follow-up sheet...</p>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6 + months.length} className="text-center py-16 text-white/40">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-bold">No students found matching current filters.</p>
                    <p className="text-xs text-white/30 mt-1">Try changing the follow-up filter or search query above.</p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((st, idx) => {
                  const rowNum = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isUnpaid = st.hasUnpaidFees;

                  return (
                    <tr 
                      key={st.id} 
                      className={`hover:bg-white/[0.04] transition-colors ${
                        isUnpaid ? 'bg-rose-950/[0.08]' : ''
                      }`}
                    >
                      {/* # Number */}
                      <td className="py-3.5 px-3 text-center font-bold text-white/50 sticky left-0 bg-[#0e1320] z-10 border-r border-white/5">
                        {rowNum}
                      </td>

                      {/* Student Details */}
                      <td className="py-3.5 px-4 sticky left-12 bg-[#0e1320] z-10 border-r border-white/10">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentInPortal(st.studentId)}
                            className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/20 transition-all cursor-pointer shrink-0 mt-0.5"
                            title="Open in Attendance Portal"
                          >
                            <ExternalLink size={13} />
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenStudentInPortal(st.studentId)}
                              className="font-extrabold text-white hover:text-blue-300 block text-left text-xs truncate cursor-pointer transition-colors"
                            >
                              {st.studentName}
                            </button>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="font-mono text-[10px] text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                {st.studentId}
                              </span>
                              {st.cardType && st.cardType !== 'FULL' && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  st.cardType === 'FREE' ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {st.cardType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone Numbers & Guardian */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {/* Student Phone */}
                          {st.phone ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${st.phone}`}
                                className="font-bold text-white hover:text-emerald-400 flex items-center gap-1 transition-colors text-xs"
                                title="Click to Call Student"
                              >
                                <Phone size={11} className="text-emerald-400" />
                                <span>{st.phone}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(st.phone, 'Student Phone')}
                                className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                title="Copy Phone Number"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/30 text-[11px]">No student phone</span>
                          )}

                          {/* Guardian Phone */}
                          {st.guardianPhone && (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${st.guardianPhone}`}
                                className="font-semibold text-white/70 hover:text-emerald-300 flex items-center gap-1 transition-colors text-[11px]"
                                title="Click to Call Guardian"
                              >
                                <Phone size={10} className="text-amber-400" />
                                <span>{st.guardianPhone}</span>
                              </a>
                              {st.guardianName && (
                                <span className="text-[10px] text-white/40 truncate max-w-[90px]">
                                  ({st.guardianName})
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(st.guardianPhone, 'Guardian Phone')}
                                className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                title="Copy Guardian Phone"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Address & School */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {st.address ? (
                            <p className="text-white/80 text-xs flex items-start gap-1 leading-snug" title={st.address}>
                              <MapPin size={12} className="text-rose-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{st.address}</span>
                            </p>
                          ) : (
                            <span className="text-white/30 text-[11px] italic">No address provided</span>
                          )}
                          {st.schoolName && (
                            <p className="text-[10px] text-white/50 flex items-center gap-1 truncate">
                              <GraduationCap size={11} className="text-indigo-400 shrink-0" />
                              <span className="truncate">{st.schoolName}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Month-by-Month Fee & Attendance */}
                      {months.map(m => {
                        const mData = st.months?.[m.monthKey];
                        if (!mData) {
                          return (
                            <td key={m.monthKey} className="py-3.5 px-3 text-center border-l border-white/10 text-white/30 text-xs">
                              -
                            </td>
                          );
                        }

                        const isPaid = mData.isPaid;
                        const isNotEnrolled = mData.status === 'NOT_ENROLLED' || mData.isBeforeEnrollment;
                        const isPartial = mData.status === 'PARTIAL';
                        const isFree = mData.status === 'FREE_CARD';

                        return (
                          <td key={m.monthKey} className="py-3 px-2.5 text-center border-l border-white/10 align-middle">
                            <div className="flex flex-col items-center gap-1">
                              {/* Fee Badge */}
                              {isNotEnrolled ? (
                                <span 
                                  className="w-full py-1 px-2 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-800/60 border border-slate-700/50 block text-center" 
                                  title={`Student enrolled after this month`}
                                >
                                  -
                                </span>
                              ) : isFree ? (
                                <span className="w-full py-1 px-2 rounded-lg text-[10px] font-black text-purple-300 bg-purple-500/20 border border-purple-500/30 block text-center">
                                  FREE
                                </span>
                              ) : isPaid ? (
                                <span className="w-full py-1 px-2 rounded-lg text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center gap-1">
                                  <Check size={11} /> PAID
                                </span>
                              ) : isPartial ? (
                                <span className="w-full py-1 px-2 rounded-lg text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-0.5">
                                  <span>PARTIAL</span>
                                </span>
                              ) : (
                                <span className="w-full py-1 px-2 rounded-lg text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/30 flex items-center justify-center gap-1">
                                  <X size={11} /> UNPAID
                                </span>
                              )}

                              {/* Attendance Count */}
                              {!isNotEnrolled && (
                                <span className={`text-[10px] font-semibold ${
                                  mData.attendedDays > 0 ? 'text-white/70' : 'text-rose-400/80 font-bold'
                                }`}>
                                  {mData.attendedDays}/{mData.scheduledDays} Days
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Due Balance */}
                      <td className="py-3.5 px-3 text-center border-l border-white/10 font-black">
                        {st.totalDueAmount > 0 ? (
                          <span className="text-rose-400 font-black text-xs">
                            Rs. {st.totalDueAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold text-xs">
                            Settled ✓
                          </span>
                        )}
                        {st.unpaidMonthsCount > 0 && (
                          <span className="text-[10px] text-white/40 block font-normal">
                            ({st.unpaidMonthsCount} mo due)
                          </span>
                        )}
                      </td>

                      {/* Overall Attendance */}
                      <td className="py-3.5 px-3 text-center border-l border-white/10">
                        <span className={`text-xs font-bold ${
                          st.attendanceRate >= 75 ? 'text-emerald-400' : st.attendanceRate >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {st.attendanceRate}%
                        </span>
                        <span className="text-[10px] text-white/40 block">
                          {st.totalAttendedDays} Days
                        </span>
                      </td>

                      {/* Quick Call Action (Sticky Right) */}
                      <td className="py-3.5 px-3 text-center border-l border-white/10 sticky right-0 bg-[#0e1320] z-10">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Call Student or Guardian */}
                          {(st.phone || st.guardianPhone) ? (
                            <a
                              href={`tel:${st.phone || st.guardianPhone}`}
                              className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                              title={`Direct Dial: ${st.phone || st.guardianPhone}`}
                            >
                              <PhoneCall size={14} />
                            </a>
                          ) : null}

                          {/* WhatsApp Chat */}
                          {(st.whatsapp || st.phone || st.guardianWhatsapp) ? (
                            <a
                              href={`https://wa.me/${(st.whatsapp || st.phone || st.guardianWhatsapp).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-all"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </a>
                          ) : null}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Bar: Pagination */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-white/50">
            Showing {paginatedStudents.length} of {filteredStudents.length} students matching criteria
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
              >
                Previous
              </button>

              <span className="text-xs font-bold text-white px-2">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}


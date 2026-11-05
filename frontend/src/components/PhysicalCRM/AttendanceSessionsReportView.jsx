import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, Search, Download, Users, UserCheck, UserX, 
  Sparkles, BookOpen, Clock, Phone, GraduationCap, 
  ChevronDown, ChevronRight, CheckCircle2, XCircle, ArrowLeft,
  Camera, Filter, RefreshCw, Award, ShieldCheck, Tag, X, Check,
  FileSpreadsheet
} from 'lucide-react';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { physicalCrmService } from '../../api/physicalCrm';

export default function AttendanceSessionsReportView({ onBack }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const [classesList, setClassesList] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT'

  // Expanded session IDs
  const [expandedSessionIds, setExpandedSessionIds] = useState([]);

  // Report Container Ref for html-to-image capture
  const reportCaptureRef = useRef(null);

  // Close class dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus search input when dropdown opens
  useEffect(() => {
    if (isClassDropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isClassDropdownOpen]);

  // Load Classes list
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const cls = await physicalCrmService.getClasses();
        setClassesList(cls || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Filtered classes list based on search query inside dropdown
  const filteredClassesList = useMemo(() => {
    if (!classSearchQuery.trim()) return classesList;
    const term = classSearchQuery.toLowerCase();
    return classesList.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.grade?.toLowerCase().includes(term) ||
      c.stream?.toLowerCase().includes(term) ||
      c.subject?.toLowerCase().includes(term) ||
      c.teachers?.some(t => t.name?.toLowerCase().includes(term))
    );
  }, [classesList, classSearchQuery]);

  const currentSelectedClassObj = useMemo(() => {
    if (selectedClassId === 'ALL') return null;
    return classesList.find(c => String(c.id) === String(selectedClassId));
  }, [classesList, selectedClassId]);

  // Fetch Report on filter change
  useEffect(() => {
    fetchReport();
  }, [selectedDate, selectedClassId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await physicalCrmService.getAttendanceSessionsReport({
        date: selectedDate,
        classId: selectedClassId
      });
      if (res && res.success) {
        setReportData(res);
        if (res.sessions?.length <= 4) {
          setExpandedSessionIds(res.sessions.map(s => s.classId));
        } else if (res.sessions?.length > 0) {
          setExpandedSessionIds([res.sessions[0].classId]);
        }
      }
    } catch (err) {
      toast.error('Failed to load attendance report: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (classId) => {
    setExpandedSessionIds(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const expandAll = () => {
    if (!reportData?.sessions) return;
    setExpandedSessionIds(reportData.sessions.map(s => s.classId));
  };

  const collapseAll = () => {
    setExpandedSessionIds([]);
  };

  // Export Complete Report as Crisp High-Res Image (PNG) using html-to-image (Supports modern CSS & oklab)
  const handleExportAsImage = async () => {
    const targetElement = reportCaptureRef.current;
    if (!targetElement) {
      toast.error('Unable to capture report element');
      return;
    }

    setExporting(true);
    const toastId = toast.loading('Generating high-resolution report image...');

    try {
      // Small pause for state/DOM to be solid
      await new Promise(r => setTimeout(r, 200));

      const dataUrl = await toPng(targetElement, {
        cacheBust: true,
        pixelRatio: 2.2, // Crisp 2.2x scale for clear fonts without blur
        backgroundColor: '#0a0303',
        quality: 1.0
      });

      const link = document.createElement('a');
      const classNamePart = currentSelectedClassObj 
        ? `_${currentSelectedClassObj.name.replace(/[^a-zA-Z0-9]/g, '_')}` 
        : '_All_Classes';
      const filename = `IMA_Attendance_Report${classNamePart}_${selectedDate}.png`;
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Attendance report exported as Image!', { id: toastId });
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('Failed to export image: ' + (err.message || 'Error occurred'), { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // Export Complete Report as Structured Excel (.xlsx) using SheetJS
  const handleExportAsExcel = () => {
    if (!reportData?.sessions?.length) {
      toast.error('No report data to export');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryRows = [
        ['IMA CAMPUS - DAILY CLASS-WISE ATTENDANCE & ENROLLMENT AUDIT REPORT'],
        [`Report Date: ${selectedDate}`],
        [`Generated On: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`],
        [],
        ['OVERALL SUMMARY KPI'],
        ['Metric', 'Value'],
        ['Total Enrolled Students Across Sessions', reportData.summary.totalEnrolledAcrossSessions],
        ['Total Present (Attended)', reportData.summary.totalPresentAcrossSessions],
        ['Total Absent', reportData.summary.totalAbsentAcrossSessions],
        ['Overall Attendance Rate', `${reportData.summary.overallAttendanceRate}%`],
        [],
        ['SESSION BREAKDOWN'],
        ['#', 'Class Name', 'Grade', 'Stream', 'Teacher(s)', 'Monthly Fee (Rs.)', 'Enrolled', 'Present', 'Absent', 'Attendance Rate %']
      ];

      reportData.sessions.forEach((s, idx) => {
        const teacherNames = s.teachers?.map(t => t.name).join(', ') || 'Unassigned';
        summaryRows.push([
          idx + 1,
          s.className,
          s.grade,
          s.stream || 'General',
          teacherNames,
          s.monthlyFee || 0,
          s.enrolledCount,
          s.presentCount,
          s.absentCount,
          `${s.attendanceRate}%`
        ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 6 }, { wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, 
        { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard');

      // 2. Detailed Student Roster Sheet
      const studentRows = [];
      reportData.sessions.forEach((session, sIdx) => {
        const teacherNames = session.teachers?.map(t => t.name).join(', ') || 'Unassigned';

        // Attended students
        session.presentStudents.forEach(stu => {
          studentRows.push({
            'Session #': sIdx + 1,
            'Class Name': session.className,
            'Grade': session.grade,
            'Stream': session.stream || 'General',
            'Teacher(s)': teacherNames,
            'Student ID': stu.studentId,
            'Student Name': stu.studentName,
            'Attendance Status': 'PRESENT',
            'Attendance Time': stu.attendanceTime || 'N/A',
            'Card Type': stu.cardType,
            'Fee Status': stu.feeStatus,
            'Fee Paid (Rs.)': stu.feeAmountPaid || 0,
            'Monthly Fee (Rs.)': session.monthlyFee || 0,
            'Student Phone': stu.phone || '',
            'Guardian Phone': stu.guardianPhone || '',
            'School': stu.schoolName || '-'
          });
        });

        // Absent students
        session.absentStudents.forEach(stu => {
          studentRows.push({
            'Session #': sIdx + 1,
            'Class Name': session.className,
            'Grade': session.grade,
            'Stream': session.stream || 'General',
            'Teacher(s)': teacherNames,
            'Student ID': stu.studentId,
            'Student Name': stu.studentName,
            'Attendance Status': 'ABSENT',
            'Attendance Time': '-',
            'Card Type': stu.cardType,
            'Fee Status': stu.feeStatus,
            'Fee Paid (Rs.)': 0,
            'Monthly Fee (Rs.)': session.monthlyFee || 0,
            'Student Phone': stu.phone || '',
            'Guardian Phone': stu.guardianPhone || '',
            'School': stu.schoolName || '-'
          });
        });
      });

      const wsRoster = XLSX.utils.json_to_sheet(studentRows);
      wsRoster['!cols'] = [
        { wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 15 }, { wch: 24 },
        { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 15 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, wsRoster, 'Student Attendance Roster');

      const classNamePart = currentSelectedClassObj 
        ? `_${currentSelectedClassObj.name.replace(/[^a-zA-Z0-9]/g, '_')}` 
        : '_All_Classes';
      const fileName = `IMA_Attendance_Report${classNamePart}_${selectedDate}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success('Attendance report exported to Excel (.xlsx)!', { icon: '📊' });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      toast.error('Failed to export Excel: ' + err.message);
    }
  };

  // Quick Date Selectors
  const setQuickDate = (daysAgo) => {
    const target = subDays(new Date(), daysAgo);
    setSelectedDate(format(target, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans antialiased">
      
      {/* Top Controls & Navigation Bar */}
      <div className="bg-black/45 backdrop-blur-2xl border border-white/20 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-white transition-all cursor-pointer active:scale-95 shadow-md flex items-center gap-1.5 text-xs font-bold"
              title="Back to Student Reports"
            >
              <ArrowLeft size={16} className="text-red-400" />
              <span>Back</span>
            </button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight font-sans">
              <Calendar className="text-emerald-400" size={24} />
              <span>Attendance Sessions & Daily Reports</span>
            </h2>
            <p className="text-xs text-white/70 mt-0.5 font-medium">
              Class-by-class date breakdown of enrolled students vs attended students with 1-click image and Excel export.
            </p>
          </div>
        </div>

        {/* 1-Click Export Buttons (Image + Excel) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Excel Export Button */}
          <button
            onClick={handleExportAsExcel}
            disabled={loading || !reportData?.sessions?.length}
            className="group px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 hover:from-blue-600 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_8px_20px_rgba(59,130,246,0.35)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-blue-400/50"
            title="Download full report as structured Excel (.xlsx) file"
          >
            <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform text-cyan-300" />
            <span>📊 Export to Excel (.xlsx)</span>
          </button>

          {/* Image Export Button */}
          <button
            onClick={handleExportAsImage}
            disabled={exporting || loading || !reportData?.sessions?.length}
            className="group px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-emerald-400/50"
            title="Download full visual report as high-res PNG image"
          >
            <Camera size={16} className="group-hover:scale-110 transition-transform text-amber-300" />
            <span>{exporting ? 'Generating Image...' : '📸 Export as Image'}</span>
          </button>

          <button
            onClick={fetchReport}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
            title="Refresh Report"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar with SEARCHABLE CLASS COMBOBOX */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-4 sm:p-5 rounded-2xl shadow-lg grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-30">
        
        {/* Date Selector + Quick Pills (5 cols) */}
        <div className="md:col-span-5 space-y-2">
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider">
            Select Attendance Date
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            />
            
            <button
              onClick={() => setQuickDate(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => setQuickDate(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              Yesterday
            </button>

            <button
              onClick={() => setQuickDate(2)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white/70 transition-all cursor-pointer"
            >
              2 Days Ago
            </button>
          </div>
        </div>

        {/* SEARCHABLE CLASS COMBOBOX (5 cols) */}
        <div className="md:col-span-5 space-y-2 relative" ref={classDropdownRef}>
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider flex items-center justify-between">
            <span>Filter Class ({classesList.length} Classes)</span>
            {selectedClassId !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId('ALL');
                  setClassSearchQuery('');
                  setIsClassDropdownOpen(false);
                }}
                className="text-amber-400 hover:text-amber-300 text-[10px] font-bold underline cursor-pointer"
              >
                Reset to All Classes
              </button>
            )}
          </label>

          {/* Trigger Button: Shows Active Class Name */}
          <button
            type="button"
            onClick={() => setIsClassDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-semibold transition-colors text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate pr-2">
              <BookOpen size={15} className="text-emerald-400 shrink-0" />
              <span className="truncate font-bold">
                {currentSelectedClassObj 
                  ? `${currentSelectedClassObj.name} (${currentSelectedClassObj.grade})` 
                  : `🌟 All Physical Classes (${classesList.length})`}
              </span>
            </div>
            <ChevronDown 
              size={16} 
              className={`text-white/60 transition-transform duration-200 shrink-0 ${isClassDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Searchable Dropdown Popup Menu */}
          {isClassDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#120505] border border-white/25 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 p-2 space-y-2 max-h-96 flex flex-col">
              
              {/* Search Bar inside popup */}
              <div className="relative shrink-0">
                <Search size={14} className="absolute left-3 top-2.5 text-white/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  placeholder="Type to search classes (e.g. 2028 BS, Accounting)..."
                  className="w-full pl-9 pr-8 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner placeholder:text-white/40"
                />
                {classSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setClassSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-white/50 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Scrollable list of classes */}
              <div className="overflow-y-auto max-h-64 space-y-1 pr-1 custom-scrollbar">
                {/* Option: All Classes */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassId('ALL');
                    setClassSearchQuery('');
                    setIsClassDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    selectedClassId === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="font-bold">🌟 All Physical Classes ({classesList.length})</span>
                  {selectedClassId === 'ALL' && <Check size={14} className="text-white" />}
                </button>

                <div className="border-t border-white/10 my-1"></div>

                {filteredClassesList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/50 font-medium">
                    No classes match "{classSearchQuery}"
                  </div>
                ) : (
                  filteredClassesList.map(cls => {
                    const isSelected = String(cls.id) === String(selectedClassId);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setIsClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-white/90 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="block truncate font-bold text-white">{cls.name}</span>
                          <span className="text-[11px] font-normal text-white/60 block mt-0.5">
                            {cls.grade} • {cls.stream || 'General'} • Rs. {cls.monthlyFee?.toLocaleString()}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="text-white shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse All Buttons (2 cols) */}
        <div className="md:col-span-2 flex items-end justify-end gap-2 pt-2 md:pt-0">
          <button
            onClick={expandAll}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Collapse All
          </button>
        </div>

      </div>

      {/* Main Report Container (Targeted for HTML-to-Image Capture) */}
      <div 
        ref={reportCaptureRef}
        className="space-y-6 p-5 sm:p-7 bg-[#0a0303] rounded-3xl border border-white/20 shadow-2xl relative font-sans text-white"
        style={{
          background: 'linear-gradient(180deg, #130505 0%, #0d0303 50%, #070202 100%)'
        }}
      >
        
        {/* Report Official Banner Header (Captured in image) */}
        <div className="border-b border-white/15 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-amber-400 p-1 flex items-center justify-center shadow-xl shrink-0">
              <img src="/logo.png" alt="IMA Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide font-sans">IMA CAMPUS</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-red-600/40 text-red-300 border border-red-500/50">
                  Physical Hub
                </span>
              </div>
              <p className="text-sm text-amber-300 font-bold tracking-wide mt-1 font-sans">
                Daily Class-wise Attendance & Enrollment Audit Report
              </p>
            </div>
          </div>

          <div className="text-right sm:text-right bg-black/60 border border-white/15 px-4 py-3 rounded-2xl">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">Report Date</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-sans">
              {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </span>
            <span className="text-xs text-white/60 block mt-0.5 font-sans font-medium">
              Generated: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Global Summary Statistics Grid */}
        {reportData?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Total Enrolled Card */}
            <div className="bg-white/[0.05] border border-white/15 p-5 rounded-2xl shadow-md">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                Total Enrolled In Sessions
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h3 className="text-3xl sm:text-4xl font-black text-white font-sans">
                  {reportData.summary.totalEnrolledAcrossSessions}
                </h3>
                <span className="text-xs sm:text-sm text-white/60 font-bold">Students</span>
              </div>
              <span className="text-xs text-white/50 mt-1 block font-medium">Allocated seats</span>
            </div>

            {/* Total Present Card */}
            <div className="bg-emerald-500/15 border border-emerald-500/40 p-5 rounded-2xl shadow-md">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-400" /> Total Present
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h3 className="text-3xl sm:text-4xl font-black text-emerald-400 font-sans">
                  {reportData.summary.totalPresentAcrossSessions}
                </h3>
                <span className="text-xs sm:text-sm text-emerald-300/80 font-bold">Attended</span>
              </div>
              <span className="text-xs text-emerald-300/70 mt-1 block font-medium">Physically recorded</span>
            </div>

            {/* Total Absent Card */}
            <div className="bg-rose-500/15 border border-rose-500/40 p-5 rounded-2xl shadow-md">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block flex items-center gap-1.5">
                <UserX size={14} className="text-rose-400" /> Total Absent
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h3 className="text-3xl sm:text-4xl font-black text-rose-400 font-sans">
                  {reportData.summary.totalAbsentAcrossSessions}
                </h3>
                <span className="text-xs sm:text-sm text-rose-300/80 font-bold">Absent</span>
              </div>
              <span className="text-xs text-rose-300/70 mt-1 block font-medium">Did not scan / attend</span>
            </div>

            {/* Overall Attendance Rate Card */}
            <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40 p-5 rounded-2xl shadow-md">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Award size={14} /> Attendance Rate
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <h3 className="text-3xl sm:text-4xl font-black text-amber-300 font-sans">
                  {reportData.summary.overallAttendanceRate}%
                </h3>
                <span className="text-xs sm:text-sm text-amber-200/80 font-bold">Average</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2.5">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 rounded-full"
                  style={{ width: `${Math.min(100, reportData.summary.overallAttendanceRate)}%` }}
                ></div>
              </div>
            </div>

          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-white/70">Compiling class attendance sessions...</span>
          </div>
        ) : !reportData?.sessions || reportData.sessions.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-white/20 rounded-2xl">
            <Users size={44} className="text-white/30" />
            <h3 className="text-lg font-bold text-white/80">No Class Attendance Sessions Found</h3>
            <p className="text-sm text-white/50 max-w-md">
              No students were recorded present for classes on {selectedDate}. Try selecting another date or searching for another class.
            </p>
          </div>
        ) : (
          /* Class Sessions List */
          <div className="space-y-5">
            {reportData.sessions.map((session, idx) => {
              const isExpanded = expandedSessionIds.includes(session.classId);
              const teacherNames = session.teachers?.map(t => t.name).join(', ') || 'Teacher Unassigned';

              // Filter students by local search
              const term = studentSearch.trim().toLowerCase();
              const filteredPresent = session.presentStudents.filter(s => 
                !term || 
                s.studentName?.toLowerCase().includes(term) ||
                s.studentId?.toLowerCase().includes(term) ||
                s.phone?.includes(term) ||
                s.guardianPhone?.includes(term)
              );
              const filteredAbsent = session.absentStudents.filter(s => 
                !term || 
                s.studentName?.toLowerCase().includes(term) ||
                s.studentId?.toLowerCase().includes(term) ||
                s.phone?.includes(term) ||
                s.guardianPhone?.includes(term)
              );

              return (
                <div 
                  key={session.classId}
                  className="bg-black/50 border border-white/20 rounded-2xl overflow-hidden shadow-xl transition-all"
                >
                  
                  {/* Session Header Card */}
                  <div 
                    onClick={() => toggleExpand(session.classId)}
                    className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
                  >
                    
                    {/* Left: Class Title, Grade, Teacher */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-[#7d0202] text-white font-black text-base flex items-center justify-center shrink-0 shadow-lg border border-white/20 mt-0.5 font-sans">
                        {idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors tracking-tight font-sans">
                            {session.className}
                          </h3>
                          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-white/10 text-white/90 border border-white/15">
                            {session.grade}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {session.stream}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs sm:text-sm text-white/70 mt-1.5 flex-wrap font-medium">
                          <span>👨‍🏫 {teacherNames}</span>
                          <span>•</span>
                          <span>Monthly Fee: Rs. {session.monthlyFee?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Enrolled, Present, Absent, Rate Badges */}
                    <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
                      
                      <div className="text-center px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 min-w-[70px]">
                        <span className="text-[10px] font-bold text-white/50 uppercase block">Enrolled</span>
                        <span className="text-base sm:text-lg font-black text-white font-sans">{session.enrolledCount}</span>
                      </div>

                      <div className="text-center px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 min-w-[70px]">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase block">Present</span>
                        <span className="text-base sm:text-lg font-black text-emerald-400 font-sans">{session.presentCount}</span>
                      </div>

                      <div className="text-center px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 min-w-[70px]">
                        <span className="text-[10px] font-bold text-rose-300 uppercase block">Absent</span>
                        <span className="text-base sm:text-lg font-black text-rose-400 font-sans">{session.absentCount}</span>
                      </div>

                      <div className={`text-center px-4 py-2 rounded-xl font-black text-xs sm:text-sm border shadow-md font-sans ${
                        session.attendanceRate >= 75 
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                          : session.attendanceRate >= 50 
                          ? 'bg-amber-400 text-slate-950 border-amber-300' 
                          : 'bg-rose-600 text-white border-rose-500'
                      }`}>
                        <span>{session.attendanceRate}% Rate</span>
                      </div>

                      <button
                        type="button"
                        className="p-2 bg-white/5 hover:bg-white/15 rounded-xl text-white transition-all ml-1 cursor-pointer"
                        aria-label="Toggle Details"
                      >
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    </div>

                  </div>

                  {/* Expanded Student Attendance Roster */}
                  {isExpanded && (
                    <div className="border-t border-white/15 p-5 sm:p-6 bg-black/60 space-y-5">
                      
                      {/* Sub-Header Toolbar */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white uppercase tracking-wider font-sans">
                            Student Roster ({session.enrolledCount} Enrolled Students)
                          </span>
                        </div>

                        {/* Search in session */}
                        <div className="relative w-full sm:w-72">
                          <Search size={15} className="absolute left-3.5 top-3 text-white/40" />
                          <input
                            type="text"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            placeholder="Filter by name or ID..."
                            className="w-full pl-10 pr-3.5 py-2 bg-white/5 border border-white/15 rounded-xl text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* PRESENT STUDENTS SECTION */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-400 flex items-center gap-2 font-sans">
                            <CheckCircle2 size={16} /> Attended Students ({filteredPresent.length})
                          </span>
                        </div>

                        {filteredPresent.length === 0 ? (
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs sm:text-sm text-white/50 text-center font-medium">
                            No present students matched the search criteria.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredPresent.map(stu => (
                              <div 
                                key={stu.id}
                                className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 flex items-start justify-between gap-3 shadow-md hover:border-emerald-400 transition-colors"
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                                    <h4 className="text-sm font-bold text-white truncate font-sans">{stu.studentName}</h4>
                                  </div>
                                  <p className="text-xs font-bold text-emerald-300 tracking-wide font-sans">{stu.studentId}</p>
                                  <div className="flex items-center gap-2.5 text-xs text-white/70 flex-wrap font-medium">
                                    {stu.phone && <span>📞 {stu.phone}</span>}
                                    {stu.guardianPhone && <span>👨‍👩‍👦 {stu.guardianPhone}</span>}
                                  </div>
                                </div>

                                <div className="text-right shrink-0 space-y-1.5">
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase block font-sans ${
                                    stu.cardType === 'HALF' ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50' :
                                    stu.cardType === 'FREE' ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50' :
                                    'bg-blue-500/25 text-blue-300 border border-blue-500/50'
                                  }`}>
                                    {stu.cardType} CARD
                                  </span>

                                  {stu.attendanceTime && (
                                    <span className="text-xs text-white/90 font-semibold block font-sans">
                                      ⏰ {stu.attendanceTime}
                                    </span>
                                  )}

                                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold block font-sans ${
                                    stu.feeStatus === 'PAID' || stu.feeStatus === 'FREE_CARD' ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30' :
                                    stu.feeStatus === 'HALF_PAYMENT' ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30' :
                                    'text-rose-300 bg-rose-500/20 border border-rose-500/30'
                                  }`}>
                                    Fee: {stu.feeStatus}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ABSENT STUDENTS SECTION */}
                      {filteredAbsent.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-white/10">
                          <span className="text-sm font-bold text-rose-400 flex items-center gap-2 font-sans">
                            <XCircle size={16} /> Absent Students ({filteredAbsent.length})
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredAbsent.map(stu => (
                              <div 
                                key={stu.id}
                                className="p-3.5 sm:p-4 rounded-2xl bg-rose-950/20 border border-rose-500/25 flex items-start justify-between gap-3 shadow-md opacity-85 hover:opacity-100 transition-opacity"
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                                    <h4 className="text-sm font-bold text-white/95 truncate font-sans">{stu.studentName}</h4>
                                  </div>
                                  <p className="text-xs font-bold text-rose-300 tracking-wide font-sans">{stu.studentId}</p>
                                  <div className="flex items-center gap-2.5 text-xs text-white/60 flex-wrap font-medium">
                                    {stu.phone && <span>📞 {stu.phone}</span>}
                                    {stu.guardianPhone && <span>👨‍👩‍👦 {stu.guardianPhone}</span>}
                                  </div>
                                </div>

                                <div className="text-right shrink-0 space-y-1.5">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-white/70 block font-sans">
                                    {stu.cardType}
                                  </span>
                                  <span className="text-xs text-rose-400 font-bold block font-sans">
                                    ABSENT
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}

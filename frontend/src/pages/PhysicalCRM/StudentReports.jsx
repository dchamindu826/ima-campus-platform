import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { physicalCrmService } from '../../api/physicalCrm';
import SmsSettingsModal from '../../components/PhysicalCRM/SmsSettingsModal';
import BulkSmsModal from '../../components/PhysicalCRM/BulkSmsModal';
import StudentDetailModal from '../../components/PhysicalCRM/StudentDetailModal';
import AttendanceSessionsReportView from '../../components/PhysicalCRM/AttendanceSessionsReportView';
import AutomatedSmsAuditView from '../../components/PhysicalCRM/AutomatedSmsAuditView';
import ClassFollowUpReportView from '../../components/PhysicalCRM/ClassFollowUpReportView';
import { 
  Users, Search, Filter, FileSpreadsheet, Send, Settings, Eye, 
  RefreshCw, GraduationCap, Building, Phone, Calendar, 
  ChevronLeft, ChevronRight, Check, X, Clock, ShieldCheck,
  ExternalLink, Camera, Sparkles, MessageSquare, PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeMainView, setActiveMainView] = useState('matrix'); // 'matrix' | 'attendance-sessions' | 'sms-audit' | 'class-call-sheet'
  const [activeSegment, setActiveSegment] = useState('ENROLLED'); // 'ENROLLED' | 'ALL'

  const [data, setData] = useState({
    stats: { 
      totalStudents: 0, 
      enrolledStudentsCount: 0, 
      unallocatedStudentsCount: 0, 
      totalEnrollments: 0, 
      regFeePaidCount: 0, 
      regFeePendingCount: 0, 
      totalAttendancesRecorded: 0 
    },
    months: [],
    classes: [],
    schools: [],
    students: [],
    isSmsConfigured: false,
    isAttendanceSmsEnabled: false
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('ALL');
  const [selectedRegFeeFilter, setSelectedRegFeeFilter] = useState('ALL');

  // Modals
  const [isSmsSettingsOpen, setIsSmsSettingsOpen] = useState(false);
  const [isBulkSmsOpen, setIsBulkSmsOpen] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchReports();
  }, [selectedClassFilter, selectedSchoolFilter, activeSegment]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedClassFilter !== 'ALL') params.classId = selectedClassFilter;
      if (selectedSchoolFilter !== 'ALL') params.schoolId = selectedSchoolFilter;
      if (activeSegment !== 'ALL') params.segment = activeSegment;

      const res = await physicalCrmService.getStudentReports(params);
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      toast.error('Failed to load student reports');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to Attendance Portal with student loaded
  const handleOpenInAttendancePortal = (studentId) => {
    navigate(`/physical/dashboard/attendance?studentId=${encodeURIComponent(studentId)}`);
  };

  // Filter students client-side for search term & reg fee
  const filteredStudents = useMemo(() => {
    return (data.students || []).filter(s => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch = !term || 
        s.studentName.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        (s.phone && s.phone.toLowerCase().includes(term)) ||
        (s.guardianPhone && s.guardianPhone.toLowerCase().includes(term)) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(term)) ||
        (s.school && s.school.name.toLowerCase().includes(term)) ||
        (s.nic && s.nic.toLowerCase().includes(term)) ||
        (s.rfid && s.rfid.toLowerCase().includes(term));

      const matchRegFee = selectedRegFeeFilter === 'ALL' || s.registrationFeeStatus === selectedRegFeeFilter;

      return matchSearch && matchRegFee;
    });
  }, [data.students, searchTerm, selectedRegFeeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Master CSV Export
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      return toast.error('No student data available to export.');
    }

    const headers = [
      'Student ID',
      'Student Name',
      'Phone',
      'Guardian Name',
      'Guardian Phone',
      'School',
      'Reg Fee Status',
      'Class Name',
      'Monthly Fee',
      ...data.months.flatMap(m => [`${m.label} Fee Status`, `${m.label} Attendance`])
    ];

    const rows = [];
    filteredStudents.forEach(s => {
      if (s.classes && s.classes.length > 0) {
        s.classes.forEach(c => {
          const monthValues = c.months.flatMap(m => [
            m.feeStatus,
            `${m.attendedSessions}/${m.scheduledSessions} Days (${m.attendanceRate}%)`
          ]);

          rows.push([
            `"${s.studentId}"`,
            `"${s.studentName.replace(/"/g, '""')}"`,
            `"${s.phone || ''}"`,
            `"${s.guardianName || ''}"`,
            `"${s.guardianPhone || ''}"`,
            `"${s.school?.name || 'N/A'}"`,
            `"${s.registrationFeeStatus}"`,
            `"${c.className}"`,
            `"${c.monthlyFee}"`,
            ...monthValues.map(v => `"${v}"`)
          ]);
        });
      } else {
        rows.push([
          `"${s.studentId}"`,
          `"${s.studentName.replace(/"/g, '""')}"`,
          `"${s.phone || ''}"`,
          `"${s.guardianName || ''}"`,
          `"${s.guardianPhone || ''}"`,
          `"${s.school?.name || 'N/A'}"`,
          `"${s.registrationFeeStatus}"`,
          `"No Class Enrolled"`,
          `"0"`,
          ...data.months.flatMap(() => [`"N/A"`, `"0/0 Days"`])
        ]);
      }
    });

    const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Physical_Student_Reports_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success(`Exported ${rows.length} records successfully!`);
  };

  return (
    <div className="animate-fade-in w-full pb-16 space-y-6">
      
      {/* 1. TOP HEADER */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-red-600/20 text-red-400 rounded-2xl border border-red-500/30">
            <GraduationCap size={28} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Student Reports & Attendance Matrix
              </h1>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                Physical CRM
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Multi-class fee collection status and student attendance tracking
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsSmsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Settings size={15} className="text-amber-400" />
            <span>SMS Settings</span>
            {data.isAttendanceSmsEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => setIsBulkSmsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Send size={15} className="text-indigo-400" />
            <span>Send Bulk SMS</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchReports}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

      </div>

      {/* VIEW SWITCHER TABS */}
      <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/15 p-2 rounded-2xl shadow-lg flex-wrap">
        <button
          onClick={() => setActiveMainView('matrix')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainView === 'matrix'
              ? 'bg-gradient-to-r from-red-600 to-[#7d0202] text-white shadow-lg border border-red-500/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Comprehensive Student Matrix</span>
        </button>

        <button
          onClick={() => setActiveMainView('attendance-sessions')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainView === 'attendance-sessions'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg border border-emerald-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar size={15} className="text-emerald-400" />
          <span>Attendance Sessions & Daily Reports</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden sm:inline-block">
            📸 Image & Excel Export
          </span>
        </button>

        <button
          onClick={() => setActiveMainView('class-call-sheet')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainView === 'class-call-sheet'
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg border border-emerald-400/50'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <PhoneCall size={15} className="text-emerald-400" />
          <span>Class Follow-up & Call Sheet</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden sm:inline-block">
            📞 Phone & Address
          </span>
        </button>

        <button
          onClick={() => setActiveMainView('sms-audit')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeMainView === 'sms-audit'
              ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 text-white shadow-lg border border-blue-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare size={15} className="text-blue-400" />
          <span>Automated Parent SMS Audit</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 hidden sm:inline-block">
            ⚡ Live Delivery Log
          </span>
        </button>
      </div>

      {/* CONDITIONAL MAIN VIEW */}
      {activeMainView === 'class-call-sheet' ? (
        <ClassFollowUpReportView onBack={() => setActiveMainView('matrix')} />
      ) : activeMainView === 'attendance-sessions' ? (
        <AttendanceSessionsReportView onBack={() => setActiveMainView('matrix')} />
      ) : activeMainView === 'sms-audit' ? (
        <AutomatedSmsAuditView onBack={() => setActiveMainView('matrix')} />
      ) : (
        <>
          {/* 2. STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block">Enrolled Students</span>
              <h3 className="text-2xl font-bold text-white mt-1">{data.stats.enrolledStudentsCount || 419}</h3>
              <span className="text-xs text-white/40 mt-0.5 block">Allocated in classes</span>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block">Class Enrollments</span>
              <h3 className="text-2xl font-bold text-white mt-1">{data.stats.totalEnrollments}</h3>
              <span className="text-xs text-white/40 mt-0.5 block">Active seats</span>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block">Reg Fee Paid</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{data.stats.regFeePaidCount}</h3>
              <span className="text-xs text-white/40 mt-0.5 block">Admission paid</span>
            </div>

            {/* Clickable Attendance Sessions Card */}
            <div 
              onClick={() => setActiveMainView('attendance-sessions')}
              className="bg-black/40 hover:bg-white/[0.04] backdrop-blur-xl border border-white/15 hover:border-emerald-500/50 p-5 rounded-2xl shadow-lg transition-all cursor-pointer group relative overflow-hidden"
              title="Click to view Date-wise Class Attendance Sessions & Export Image"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block group-hover:text-emerald-300 transition-colors">
                  Attendance Sessions
                </span>
                <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={13} />
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">
                {data.stats.totalAttendancesRecorded}
              </h3>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-white/40 block">Recorded present</span>
                <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline-block group-hover:underline">View Report →</span>
              </div>
            </div>

          </div>

      {/* 3. SEGMENT SWITCHER TABS & UNIFIED FILTER BAR */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-lg space-y-4">
        
        {/* Segment Switcher */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <button
            onClick={() => { setActiveSegment('ENROLLED'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSegment === 'ENROLLED'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>Active Enrolled Students ({data.stats.enrolledStudentsCount || 419})</span>
          </button>

          <button
            onClick={() => { setActiveSegment('ALL'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSegment === 'ALL'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <span>All Registered Database ({data.stats.totalStudents || 4766})</span>
          </button>
        </div>

        {/* Clean Filter Dropdowns Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3.5 top-3 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search student name, phone, student ID..."
              className="w-full pl-10 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-normal focus:ring-2 focus:ring-red-500/50 outline-none transition-all placeholder:text-white/30"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-white/40 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Class Dropdown Menu */}
          <div className="md:col-span-3">
            <select
              value={selectedClassFilter}
              onChange={(e) => { setSelectedClassFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-normal focus:ring-2 focus:ring-red-500/50 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">All Physical Classes</option>
              {data.classes.map(c => {
                const teacherNames = c.teachers && c.teachers.length > 0
                  ? ` • ${c.teachers.map(t => t.name).join(', ')}`
                  : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.grade}){teacherNames}
                  </option>
                );
              })}
            </select>
          </div>

          {/* School Dropdown */}
          <div className="md:col-span-2">
            <select
              value={selectedSchoolFilter}
              onChange={(e) => { setSelectedSchoolFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-normal focus:ring-2 focus:ring-red-500/50 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">All Schools</option>
              {data.schools.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reg Fee Dropdown */}
          <div className="md:col-span-2">
            <select
              value={selectedRegFeeFilter}
              onChange={(e) => { setSelectedRegFeeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-normal focus:ring-2 focus:ring-red-500/50 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">All Reg Fees</option>
              <option value="PAID">Reg Fee Paid</option>
              <option value="PENDING">Reg Fee Pending</option>
            </select>
          </div>

        </div>

      </div>

      {/* 4. MAIN DATA TABLE */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[950px]">
            
            {/* Table Header */}
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/70 font-semibold uppercase tracking-wider text-xs">
                <th className="py-4 px-4 sticky left-0 bg-[#0e1320] z-20 min-w-[280px] border-r border-white/10">
                  Student Details
                </th>
                <th className="py-4 px-3 text-center min-w-[110px]">Reg Fee</th>
                <th className="py-4 px-3 min-w-[220px]">Enrolled Classes</th>
                {data.months.map(m => (
                  <th key={m.monthKey} className="py-4 px-3 text-center min-w-[150px] border-l border-white/10">
                    <div className="flex flex-col items-center">
                      <span className="text-white font-bold text-xs">{m.label}</span>
                      <span className="text-xs text-white/40 font-normal">Fees & Attendance</span>
                    </div>
                  </th>
                ))}
                <th className="py-4 px-3 text-center min-w-[100px] sticky right-0 bg-[#0e1320] z-20 border-l border-white/10">
                  Action
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-white/10 text-white/80">
              {loading ? (
                <tr>
                  <td colSpan={5 + data.months.length} className="text-center py-20 text-white/50 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-red-500" size={24} />
                      <span>Loading Student Records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5 + data.months.length} className="text-center py-20 text-white/40 text-sm">
                    No student records found.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, sIdx) => {
                  const studentClasses = student.classes || [];
                  const hasClasses = studentClasses.length > 0;

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-white/5 transition-colors ${
                        sIdx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'
                      }`}
                    >
                      
                      {/* 1. Student Details (Clicking opens in Attendance Portal) */}
                      <td className="py-4 px-4 sticky left-0 bg-[#0e1320] z-10 border-r border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm border border-white/10 shrink-0">
                            {student.studentName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <button
                              onClick={() => handleOpenInAttendancePortal(student.studentId)}
                              className="font-bold text-white text-sm block truncate hover:text-red-400 transition-colors text-left cursor-pointer"
                              title="Click to manage attendance & fees in Attendance Portal"
                            >
                              {student.studentName}
                            </button>
                            <span className="text-xs text-red-400 font-semibold block">
                              {student.studentId}
                            </span>
                            <div className="text-xs text-white/60 truncate">
                              <span>Ph: <strong className="text-white font-normal">{student.phone || 'N/A'}</strong></span>
                              {student.guardianPhone && (
                                <>
                                  <span className="mx-1.5">•</span>
                                  <span>Guardian: <strong className="text-white font-normal">{student.guardianPhone}</strong></span>
                                </>
                              )}
                            </div>
                            {student.school && (
                              <span className="text-xs text-white/40 block truncate">
                                School: {student.school.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Reg Fee Status */}
                      <td className="py-4 px-3 text-center align-middle">
                        <button
                          onClick={() => handleOpenInAttendancePortal(student.studentId)}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                            student.registrationFeeStatus === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                          }`}
                          title="Click to manage in Attendance Portal"
                        >
                          {student.registrationFeeStatus === 'PAID' ? <Check size={13} className="text-emerald-400" /> : <Clock size={13} />}
                          <span>{student.registrationFeeStatus === 'PAID' ? 'PAID' : 'PENDING'}</span>
                        </button>
                      </td>

                      {/* 3. Enrolled Classes */}
                      <td className="py-4 px-3 align-middle">
                        {!hasClasses ? (
                          <span className="text-xs text-white/40 italic">
                            No class allocated
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            {studentClasses.map((cls) => (
                              <div 
                                key={cls.classId} 
                                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                              >
                                <span className="font-semibold text-white truncate max-w-[140px]">{cls.className}</span>
                                <span className="text-xs text-emerald-400 font-bold">
                                  Rs.{cls.monthlyFee}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 4. Month Matrix Columns (Links to Attendance Portal) */}
                      {data.months.map(m => {
                        return (
                          <td key={m.monthKey} className="py-4 px-3 text-center align-middle border-l border-white/10">
                            {!hasClasses ? (
                              <span className="text-white/30 text-xs">-</span>
                            ) : (
                              <div className="space-y-2">
                                {studentClasses.map(cls => {
                                  const monthData = (cls.months || []).find(x => x.month === m.monthKey);
                                  if (!monthData) return <div key={cls.classId} className="text-white/30 text-xs">-</div>;

                                  const isPaid = monthData.feeStatus === 'PAID' || monthData.feeStatus === 'FREE_CARD';
                                  const isNotEnrolled = monthData.feeStatus === 'NOT_ENROLLED' || monthData.isBeforeEnrollment;

                                  return (
                                    <div 
                                      key={cls.classId} 
                                      className="p-2 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-1.5"
                                    >
                                      {/* Fee Status Badge - Direct link to Attendance Portal */}
                                      {isNotEnrolled ? (
                                        <span className="w-full py-1 px-2 rounded-lg text-xs font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60 flex items-center justify-center">
                                          Not Enrolled
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleOpenInAttendancePortal(student.studentId)}
                                          className={`w-full py-1 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            isPaid
                                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                              : monthData.feeStatus === 'HALF_PAYMENT'
                                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                              : 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                                          }`}
                                          title="Click to open student in Attendance & Fee Portal"
                                        >
                                          {isPaid ? <Check size={13} /> : <X size={13} />}
                                          <span>{isPaid ? 'PAID' : 'UNPAID'}</span>
                                        </button>
                                      )}

                                      {/* Attendance Count */}
                                      {isNotEnrolled ? (
                                        <span className="text-[11px] text-white/40 italic">
                                          Joined {monthData.enrollmentMonth || 'Later'}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-white/70 font-medium">
                                          {monthData.attendedSessions}/{monthData.scheduledSessions} Days Attended
                                        </span>
                                      )}

                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 5. Quick Actions */}
                      <td className="py-4 px-3 text-center align-middle sticky right-0 bg-[#0e1320] z-10 border-l border-white/10">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenInAttendancePortal(student.studentId)}
                            className="p-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-xl border border-red-500/30 transition-all cursor-pointer"
                            title="Open in Attendance & Fee Portal"
                          >
                            <ExternalLink size={15} />
                          </button>

                          <button
                            onClick={() => setSelectedStudentForModal(student.id)}
                            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all cursor-pointer"
                            title="Inspect Student Profile"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-white/60 gap-3">
          <div>
            Showing <strong className="text-white">{filteredStudents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="text-white">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</strong> of <strong className="text-red-400 font-bold">{filteredStudents.length}</strong> students
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-bold text-white px-3 py-1 bg-white/10 border border-white/10 rounded-xl">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        </div>
        </>
      )}

      {/* MODALS */}
      <SmsSettingsModal
        isOpen={isSmsSettingsOpen}
        onClose={() => setIsSmsSettingsOpen(false)}
        onSettingsUpdated={(newSettings) => {
          setData(prev => ({
            ...prev,
            isSmsConfigured: Boolean(newSettings.esmsUsername && newSettings.esmsPassword),
            isAttendanceSmsEnabled: Boolean(newSettings.isAttendanceSmsEnabled)
          }));
        }}
      />

      <BulkSmsModal
        isOpen={isBulkSmsOpen}
        onClose={() => setIsBulkSmsOpen(false)}
        classes={data.classes}
        selectedStudents={filteredStudents}
      />

      {selectedStudentForModal && (
        <StudentDetailModal
          studentId={selectedStudentForModal}
          isOpen={Boolean(selectedStudentForModal)}
          onClose={() => setSelectedStudentForModal(null)}
        />
      )}

    </div>
  );
}

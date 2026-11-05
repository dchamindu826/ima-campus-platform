import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  Building2, 
  UserCheck, 
  RotateCcw, 
  PenTool, 
  FileText, 
  Phone, 
  Calendar,
  Users,
  Check,
  ClipboardCheck,
  Loader2,
  TrendingUp,
  Percent,
  Layers,
  Award,
  Clock,
  ChevronDown,
  Filter,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'react-hot-toast';

export default function LecturerAttendanceSheetModal({
  isOpen,
  onClose,
  reportData,
  selectedMonth,
  selectedClassId = 'ALL',
  onMonthChange,
  onClassChange,
  classesList = []
}) {
  if (!isOpen || !reportData) return null;

  const { teacher, classes = [], availableMonths = [] } = reportData;
  const printRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Class filtering state inside the modal: 'ALL' or specific classId
  const [activeClassFilter, setActiveClassFilter] = useState(selectedClassId || 'ALL');

  useEffect(() => {
    setActiveClassFilter(selectedClassId || 'ALL');
  }, [selectedClassId, isOpen]);

  const handleClassFilterChange = (val) => {
    setActiveClassFilter(val);
    if (onClassChange) {
      onClassChange(val);
    }
  };

  const handleMonthFilterChange = (val) => {
    if (onMonthChange && val !== selectedMonth) {
      onMonthChange(val);
    }
  };

  // Active class or all classes
  const activeClass = activeClassFilter && activeClassFilter !== 'ALL'
    ? classes.find(c => c.classId === parseInt(activeClassFilter))
    : null;

  const displayClasses = activeClass ? [activeClass] : classes;

  // Formatting helpers
  const formatMonthYear = (mStr) => {
    if (!mStr) return '';
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) {
      return mStr;
    }
  };

  const formatDateDisplay = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dStr;
    }
  };

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

  const lecturerId = teacher.lecturerId || `IMA-LEC-${1000 + teacher.id}`;
  const statementId = `IMA-ATT-${selectedMonth.replace(/-/g, '')}-${String(teacher.id).padStart(3, '0')}`;
  const todayStr = new Date().toLocaleDateString('en-GB');

  // Signature state
  const [lecName, setLecName] = useState(teacher.name);
  const [coordName, setCoordName] = useState('Academic Coordinator');
  const [lecSigMode, setLecSigMode] = useState('draw'); // 'draw' | 'upload'
  const [lecSigImage, setLecSigImage] = useState(null);
  const [lecSigDataUrl, setLecSigDataUrl] = useState(null);
  const [isLecDrawing, setIsLecDrawing] = useState(false);
  const lecCanvasRef = useRef(null);

  const [coordSigMode, setCoordSigMode] = useState('draw');
  const [coordSigImage, setCoordSigImage] = useState(null);
  const [coordSigDataUrl, setCoordSigDataUrl] = useState(null);
  const [isCoordDrawing, setIsCoordDrawing] = useState(false);
  const coordCanvasRef = useRef(null);

  // Drawing canvas helpers
  const startDrawing = (e, canvasRef, setIsDrawing) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e, canvasRef, isDrawing) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (canvasRef, setIsDrawing, setDataUrl) => {
    setIsDrawing(false);
    if (canvasRef.current) {
      try {
        setDataUrl(canvasRef.current.toDataURL('image/png'));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const clearCanvas = (canvasRef, setDataUrl) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setDataUrl(null);
    }
  };

  const handleImageUpload = (e, setImageState, setDataUrl) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setImageState(uploadEvent.target.result);
        setDataUrl(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Download handler
  const handleDownload = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(printRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `Attendance_Summary_${teacher.name.replace(/\s+/g, '_')}_${selectedMonth}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Attendance report exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export image.');
    } finally {
      setDownloading(false);
    }
  };

  // =========================================================================
  // MONTHLY ATTENDANCE KPI & SUMMARY COMPUTATIONS
  // =========================================================================
  const allStudents = displayClasses.flatMap(cls => 
    (cls.students || []).map(st => ({ 
      ...st, 
      classTitle: `${cls.className} (${cls.grade})`,
      classFee: cls.monthlyFee || 0,
      parentClassId: cls.classId
    }))
  );

  const totalEnrolled = allStudents.length;
  const allDistinctDates = Array.from(
    new Set(displayClasses.flatMap(c => c.conductedSessionDates || []))
  ).sort();

  const totalSessionsCount = allDistinctDates.length;

  // Cumulative attended sessions across all students
  const totalAttendedInstances = allStudents.reduce((sum, st) => {
    return sum + (st.attendance?.attendedSessions || 0);
  }, 0);

  // Maximum possible attendance instances
  const totalPossibleInstances = displayClasses.reduce((sum, cls) => {
    const sessions = (cls.conductedSessionDates || []).length || (totalSessionsCount || 1);
    return sum + (cls.students?.length || 0) * sessions;
  }, 0);

  const overallAttendanceRate = totalPossibleInstances > 0 
    ? Math.round((totalAttendedInstances / totalPossibleInstances) * 100) 
    : (totalEnrolled > 0 && totalAttendedInstances > 0 ? 100 : 0);

  const feePaidCount = allStudents.filter(s => s.feeStatus === 'PAID' || s.feeStatus === 'FREE_CARD').length;
  const feeComplianceRate = totalEnrolled > 0 ? Math.round((feePaidCount / totalEnrolled) * 100) : 0;

  // Attendance Cohorts
  const perfectAttendanceCount = allStudents.filter(s => {
    const att = s.attendance || {};
    return att.totalSessions > 0 && att.attendedSessions === att.totalSessions;
  }).length;

  const goodAttendanceCount = allStudents.filter(s => {
    const att = s.attendance || {};
    const rate = att.totalSessions > 0 ? (att.attendedSessions / att.totalSessions) * 100 : 0;
    return rate >= 75 && rate < 100;
  }).length;

  const lowAttendanceCount = allStudents.filter(s => {
    const att = s.attendance || {};
    const rate = att.totalSessions > 0 ? (att.attendedSessions / att.totalSessions) * 100 : 0;
    return rate < 50;
  }).length;

  // Session-by-Session timeline list
  const sessionTimeline = allDistinctDates.map(dateStr => {
    const classesOnDate = displayClasses.filter(c => (c.conductedSessionDates || []).includes(dateStr));
    const enrolledOnDate = classesOnDate.reduce((sum, c) => sum + (c.students?.length || 0), 0);
    const presentCount = classesOnDate.reduce((sum, c) => {
      return sum + (c.students || []).filter(st => st.attendance?.attendedDates?.includes(dateStr)).length;
    }, 0);
    const rate = enrolledOnDate > 0 ? Math.round((presentCount / enrolledOnDate) * 100) : 0;
    return {
      date: dateStr,
      presentCount,
      absentCount: Math.max(0, enrolledOnDate - presentCount),
      rate
    };
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Print-specific style rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-attendance-statement, #printable-attendance-statement * {
            visibility: visible;
          }
          #printable-attendance-statement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12mm;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Main Modal Wrapper (EXPANDED TO max-w-6xl FOR MAXIMUM LUXURY BREATHING ROOM) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden my-auto print:border-none print:shadow-none print:bg-white print:rounded-none">
        
        {/* TOP BAR / CONTROLS (Hidden on Print) */}
        <div className="no-print p-4 md:px-6 md:py-4 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Monthly Academic Attendance Summary
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {lecturerId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {teacher.name} • Cycle: {formatMonthYear(selectedMonth)} • Official Academic Verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 shadow-sm cursor-pointer"
              title="Print official A4 summary sheet"
            >
              <Printer size={15} /> Print Summary (A4)
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Export Image
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors ml-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CUSTOM FILTER TOOLBAR: CLASS DROPDOWN + MONTH DROPDOWN (Hidden on Print) */}
        <div className="no-print bg-slate-950/80 border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            
            {/* 1. CLASS FILTER DROPDOWN MENU */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Layers size={14} className="text-emerald-400" /> Class:
              </label>
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <select
                  value={activeClassFilter}
                  onChange={(e) => handleClassFilterChange(e.target.value)}
                  className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none cursor-pointer appearance-none pr-8 shadow-inner"
                >
                  <option value="ALL" className="bg-slate-900 text-white font-bold">
                    All Assigned Classes Combined ({classes.length})
                  </option>
                  {classes.map(cls => (
                    <option key={cls.classId} value={String(cls.classId)} className="bg-slate-900 text-white">
                      {cls.className} ({cls.grade}) - {cls.enrolledCount || 0} Students
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 2. MONTH FILTER DROPDOWN MENU */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Calendar size={14} className="text-blue-400" /> Month Cycle:
              </label>
              <div className="relative min-w-[180px] sm:min-w-[200px]">
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthFilterChange(e.target.value)}
                  className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none cursor-pointer appearance-none pr-8 shadow-inner"
                >
                  {availableMonths && availableMonths.length > 0 ? (
                    availableMonths.map(mStr => (
                      <option key={mStr} value={mStr} className="bg-slate-900 text-white">
                        {formatMonthYear(mStr)} ({mStr})
                      </option>
                    ))
                  ) : (
                    <option value={selectedMonth} className="bg-slate-900 text-white">
                      {formatMonthYear(selectedMonth)}
                    </option>
                  )}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Displaying: <strong>{activeClass ? `${activeClass.className}` : `All ${classes.length} Classes`}</strong></span>
          </div>
        </div>

        {/* E-SIGNATURE PANEL (Hidden on Print) */}
        <div className="no-print bg-slate-950/40 border-b border-slate-800 p-4 md:px-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PenTool size={14} className="text-blue-400" />
              Signatures & Official Certification
            </span>
            <span className="text-[11px] text-slate-500">
              Draw electronic signature below or leave blank to sign physically after printing.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Lecturer Signature */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck size={14} className="text-blue-400" /> Lecturer Signature
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setLecSigMode('draw')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${lecSigMode === 'draw' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setLecSigMode('upload')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${lecSigMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Upload
                  </button>
                  {lecSigMode === 'draw' && (
                    <button
                      type="button"
                      onClick={() => clearCanvas(lecCanvasRef, setLecSigDataUrl)}
                      className="px-2 py-0.5 rounded-md font-bold text-slate-400 hover:text-red-400 flex items-center gap-0.5 ml-1"
                    >
                      <RotateCcw size={10} /> Clear
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={lecName}
                onChange={(e) => setLecName(e.target.value)}
                placeholder="Lecturer Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-semibold"
              />

              {lecSigMode === 'draw' ? (
                <div className="border border-slate-700/80 rounded-xl bg-white overflow-hidden shadow-inner h-20">
                  <canvas
                    ref={lecCanvasRef}
                    width={400}
                    height={80}
                    onMouseDown={(e) => startDrawing(e, lecCanvasRef, setIsLecDrawing)}
                    onMouseMove={(e) => draw(e, lecCanvasRef, isLecDrawing)}
                    onMouseUp={() => stopDrawing(lecCanvasRef, setIsLecDrawing, setLecSigDataUrl)}
                    onMouseLeave={() => stopDrawing(lecCanvasRef, setIsLecDrawing, setLecSigDataUrl)}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-950/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setLecSigImage, setLecSigDataUrl)}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-blue-600 file:text-white"
                  />
                </div>
              )}
            </div>

            {/* 2. Coordinator Signature */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Building2 size={14} className="text-emerald-400" /> Academic Coordinator / Stamp
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCoordSigMode('draw')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${coordSigMode === 'draw' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoordSigMode('upload')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${coordSigMode === 'upload' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Upload
                  </button>
                  {coordSigMode === 'draw' && (
                    <button
                      type="button"
                      onClick={() => clearCanvas(coordCanvasRef, setCoordSigDataUrl)}
                      className="px-2 py-0.5 rounded-md font-bold text-slate-400 hover:text-red-400 flex items-center gap-0.5 ml-1"
                    >
                      <RotateCcw size={10} /> Clear
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={coordName}
                onChange={(e) => setCoordName(e.target.value)}
                placeholder="Coordinator Title / Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-semibold"
              />

              {coordSigMode === 'draw' ? (
                <div className="border border-slate-700/80 rounded-xl bg-white overflow-hidden shadow-inner h-20">
                  <canvas
                    ref={coordCanvasRef}
                    width={400}
                    height={80}
                    onMouseDown={(e) => startDrawing(e, coordCanvasRef, setIsCoordDrawing)}
                    onMouseMove={(e) => draw(e, coordCanvasRef, isCoordDrawing)}
                    onMouseUp={() => stopDrawing(coordCanvasRef, setIsCoordDrawing, setCoordSigDataUrl)}
                    onMouseLeave={() => stopDrawing(coordCanvasRef, setIsCoordDrawing, setCoordSigDataUrl)}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-950/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setCoordSigImage, setCoordSigDataUrl)}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-600 file:text-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE EXECUTIVE ATTENDANCE STATEMENT (EXPANDED TO max-w-4xl)          */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 md:p-8 bg-slate-950/50 flex justify-center print:p-0 print:bg-white">
          <div
            id="printable-attendance-statement"
            ref={printRef}
            className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-10 border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-0 space-y-6"
            style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
          >
            
            {/* 1. HEADER: OFFICIAL IMA CAMPUS LOGO & BRANDING */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
              <div className="flex items-center gap-3.5">
                <img 
                  src="/logo.png" 
                  crossOrigin="anonymous"
                  alt="IMA Campus Logo" 
                  className="h-14 w-auto object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">IMA CAMPUS</h1>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Physical Hub Academic Operations</p>
                  <p className="text-[10px] text-slate-400 font-medium">Official Monthly Academic Attendance & Session Verification Report</p>
                </div>
              </div>

              <div className="text-right sm:text-right w-full sm:w-auto">
                <span className="inline-block px-3 py-1 bg-emerald-800 text-white text-[10px] font-black uppercase tracking-wider rounded mb-1">
                  ATTENDANCE STATEMENT
                </span>
                <p className="text-xs font-bold text-slate-800">{statementId}</p>
                <p className="text-xs text-slate-500">Date: <span className="font-semibold text-slate-700">{todayStr}</span></p>
                <p className="text-xs text-slate-500">Cycle: <span className="font-black text-blue-600">{formatMonthYear(selectedMonth)}</span></p>
              </div>
            </div>

            {/* 2. LECTURER SNAPSHOT & SCOPE DETAILS (WITH PHOTO) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              
              {/* Lecturer Info */}
              <div className="flex items-center gap-3.5">
                {teacher.image ? (
                  <img 
                    src={getTeacherImageUrl(teacher.image)} 
                    crossOrigin="anonymous"
                    alt={teacher.name} 
                    className="w-14 h-14 rounded-xl object-cover border border-slate-300 shadow-sm bg-slate-200"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=1e293b&color=38bdf8&bold=true`;
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-lg">
                    {teacher.name.charAt(0)}
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lecturer Details</span>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight flex items-center gap-2">
                    <span>{teacher.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 font-bold">
                      {lecturerId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">{teacher.phone || teacher.whatsapp || 'No contact set'}</p>
                  <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                    Assigned Classes: {classes.length} Academic Batches
                  </p>
                </div>
              </div>

              {/* Scope & Overview */}
              <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Scope of Statement</span>
                <p className="text-sm font-bold text-slate-800">
                  {activeClass ? `${activeClass.className} (${activeClass.grade})` : `All Assigned Classes (${displayClasses.length})`}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 flex-wrap">
                  <span>Enrolled: <strong className="text-slate-900">{totalEnrolled}</strong></span>
                  <span>Sessions: <strong className="text-emerald-700">{totalSessionsCount} Held</strong></span>
                  <span>Fee Paid: <strong className="text-blue-700">{feePaidCount} ({feeComplianceRate}%)</strong></span>
                </div>
              </div>

            </div>

            {/* 3. EXECUTIVE MONTHLY ATTENDANCE KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Enrolled Students</span>
                <strong className="text-2xl font-black text-slate-900">{totalEnrolled}</strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Active Class Register</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Class Sessions</span>
                <strong className="text-2xl font-black text-blue-700">{totalSessionsCount}</strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Conducted in {formatMonthYear(selectedMonth)}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Attendances</span>
                <strong className="text-2xl font-black text-emerald-700">{totalAttendedInstances}</strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Headcount Instances</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Monthly Rate</span>
                <strong className="text-2xl font-black text-purple-700">{overallAttendanceRate}%</strong>
                <span className="text-[9px] text-slate-500 block mt-0.5">Attendance Compliance</span>
              </div>
            </div>

            {/* 4. CLASS-BY-CLASS SUMMARY BREAKDOWN (COMPREHENSIVE TABLE) */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-900" /> Class-by-Class Attendance Summary
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Academic Cycle: {formatMonthYear(selectedMonth)}
                </span>
              </h4>
              <table className="w-full text-xs text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">Class / Batch Name</th>
                    <th className="p-2.5 text-center">Enrolled</th>
                    <th className="p-2.5 text-center">Sessions Held</th>
                    <th className="p-2.5 text-center">Present Headcount</th>
                    <th className="p-2.5 text-center">Avg / Session</th>
                    <th className="p-2.5 text-center">Attendance %</th>
                    <th className="p-2.5 text-right">Fee Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                  {displayClasses.map(cls => {
                    const cStudents = cls.students || [];
                    const cEnrolled = cStudents.length;
                    const cSessions = (cls.conductedSessionDates || []).length || (totalSessionsCount || 1);
                    const cPresent = cStudents.reduce((sum, s) => sum + (s.attendance?.attendedSessions || 0), 0);
                    const avgPerSession = cSessions > 0 ? Math.round(cPresent / cSessions) : 0;
                    const maxPossible = cEnrolled * cSessions;
                    const cRate = maxPossible > 0 ? Math.round((cPresent / maxPossible) * 100) : 0;
                    const cPaid = cStudents.filter(s => s.feeStatus === 'PAID' || s.feeStatus === 'FREE_CARD').length;
                    const cFeeRate = cEnrolled > 0 ? Math.round((cPaid / cEnrolled) * 100) : 0;

                    return (
                      <tr key={cls.classId} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">
                          {cls.className} <span className="text-[10px] text-slate-500 font-normal">({cls.grade})</span>
                        </td>
                        <td className="p-2.5 text-center font-bold">{cEnrolled}</td>
                        <td className="p-2.5 text-center font-bold text-blue-700">{cSessions}</td>
                        <td className="p-2.5 text-center font-bold text-emerald-700">{cPresent}</td>
                        <td className="p-2.5 text-center font-semibold text-slate-700">{avgPerSession}</td>
                        <td className="p-2.5 text-center">
                          <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded font-black text-[11px]">
                            {cRate}%
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-700">
                          {cPaid}/{cEnrolled} ({cFeeRate}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black border-t-2 border-slate-300 text-slate-900">
                    <td className="p-2.5 uppercase text-[10px]">Total / Institute Aggregate</td>
                    <td className="p-2.5 text-center">{totalEnrolled}</td>
                    <td className="p-2.5 text-center text-blue-700">{totalSessionsCount}</td>
                    <td className="p-2.5 text-center text-emerald-700">{totalAttendedInstances}</td>
                    <td className="p-2.5 text-center">{totalSessionsCount > 0 ? Math.round(totalAttendedInstances / totalSessionsCount) : 0}</td>
                    <td className="p-2.5 text-center text-purple-700">{overallAttendanceRate}%</td>
                    <td className="p-2.5 text-right text-slate-900">{feePaidCount}/{totalEnrolled} ({feeComplianceRate}%)</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. CONDUCTED SESSIONS TIMELINE & DAILY HEADCOUNT LOG */}
            {sessionTimeline.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-900" /> Conducted Class Sessions & Attendance Log
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {sessionTimeline.length} Sessions Held
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {sessionTimeline.map((s, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase text-blue-800">Session 0{idx + 1}</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          {s.rate}% Present
                        </span>
                      </div>
                      <strong className="text-xs font-black text-slate-900 block truncate">
                        {formatDateDisplay(s.date)}
                      </strong>
                      <div className="flex justify-between text-[10px] text-slate-600 mt-2 pt-1.5 border-t border-slate-200">
                        <span>Present: <strong className="text-emerald-700 font-bold">{s.presentCount}</strong></span>
                        <span>Absent: <strong className="text-slate-600 font-bold">{s.absentCount}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. ATTENDANCE COHORT & ENGAGEMENT ANALYSIS (ACADEMIC HEALTH) */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2">
                <Award size={14} className="text-slate-900" /> Student Attendance Distribution & Academic Health
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Consistent / Perfect (100%)</span>
                    <strong className="text-xl font-black text-emerald-900">{perfectAttendanceCount} Students</strong>
                    <p className="text-[9px] text-emerald-700">Attended all scheduled classes</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                    100%
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">Regular Attendance (75% - 99%)</span>
                    <strong className="text-xl font-black text-blue-900">{goodAttendanceCount} Students</strong>
                    <p className="text-[9px] text-blue-700">Satisfactory participation rate</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs shrink-0">
                    75%+
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Low / Irregular (&lt; 50%)</span>
                    <strong className="text-xl font-black text-amber-900">{lowAttendanceCount} Students</strong>
                    <p className="text-[9px] text-amber-700">Requires coordinator follow-up</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs shrink-0">
                    &lt;50%
                  </div>
                </div>
              </div>
            </div>

            {/* 7. OFFICIAL DECLARATION & DUAL SIGNATURE BLOCK (MATCHING INVOICE) */}
            <div className="pt-4 border-t-2 border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed mb-6">
                <span className="font-bold text-slate-900">DECLARATION & CERTIFICATION:</span> I hereby verify that all lecture sessions and aggregate attendance records for <strong>{formatMonthYear(selectedMonth)}</strong> stated in this report have been conducted in accordance with IMA International Campus academic regulations.
              </div>

              <div className="grid grid-cols-2 gap-8">
                
                {/* Lecturer Signature Box */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-36">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lecturer Acknowledgment</span>
                    <strong className="text-xs font-extrabold text-slate-900 block">{lecName}</strong>
                    <span className="text-[10px] font-mono text-blue-700 font-bold block">{lecturerId}</span>
                  </div>

                  <div className="h-16 flex items-end justify-center pb-1 border-b-2 border-slate-300 relative">
                    {lecSigDataUrl ? (
                      <img src={lecSigDataUrl} alt="Lecturer Signature" className="max-h-14 object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic mb-1">[Lecturer Sign & Date]</span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 text-center">Signature of Academic Lecturer</p>
                </div>

                {/* Coordinator Signature Box */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between h-36">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Academic Verification & Stamp</span>
                    <strong className="text-xs font-extrabold text-slate-900 block">{coordName}</strong>
                    <span className="text-[10px] text-slate-600 font-medium block">IMA Campus Administration</span>
                  </div>

                  <div className="h-16 flex items-end justify-center pb-1 border-b-2 border-slate-300 relative">
                    {coordSigDataUrl ? (
                      <img src={coordSigDataUrl} alt="Coordinator Signature" className="max-h-14 object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic mb-1">[Campus Coordinator Sign & Official Stamp]</span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 text-center">Campus Stamp & Academic Authority</p>
                </div>

              </div>
            </div>

            {/* Document Footer */}
            <div className="pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400 font-medium flex justify-between items-center">
              <span>IMA International Campus • Official Academic Registry</span>
              <span>Statement: {statementId}</span>
              <span>Page 1 of 1</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

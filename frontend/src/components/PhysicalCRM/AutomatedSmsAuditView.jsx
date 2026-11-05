import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, MessageSquare, CheckCircle2, XCircle, Search, 
  Calendar, RefreshCw, Filter, Camera, FileSpreadsheet, 
  ArrowLeft, Users, Phone, Clock, BookOpen, AlertCircle,
  Copy, Check, ChevronDown, ChevronRight, Sparkles, ShieldCheck
} from 'lucide-react';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { physicalCrmService } from '../../api/physicalCrm';

export default function AutomatedSmsAuditView({ onBack }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'ATTENDANCE' | 'BULK'
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'SENT' | 'FAILED'
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [classesList, setClassesList] = useState([]);
  const [logsData, setLogsData] = useState({
    logs: [],
    total: 0,
    summary: {
      total: 0,
      sentCount: 0,
      failedCount: 0,
      successRate: 100,
      attendanceCount: 0,
      bulkCount: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState(null);

  // Class Combobox state
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearchText, setClassSearchText] = useState('');
  const classDropdownRef = useRef(null);
  const reportCaptureRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch classes
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

  // Fetch SMS Logs on filter change
  useEffect(() => {
    fetchSmsLogs();
  }, [selectedDate, selectedType, selectedStatus, selectedClassId]);

  const fetchSmsLogs = async () => {
    setLoading(true);
    try {
      const params = {
        date: selectedDate,
        type: selectedType,
        status: selectedStatus,
        classId: selectedClassId,
        limit: 500 // Retrieve full audit log for the date
      };

      const res = await physicalCrmService.getSmsLogs(params);
      if (res && res.success) {
        setLogsData({
          logs: res.logs || [],
          total: res.total || 0,
          summary: res.summary || {
            total: res.total || 0,
            sentCount: (res.logs || []).filter(l => l.status === 'SENT').length,
            failedCount: (res.logs || []).filter(l => l.status === 'FAILED').length,
            successRate: res.total > 0 ? Math.round(((res.logs || []).filter(l => l.status === 'SENT').length / res.total) * 100) : 100,
            attendanceCount: (res.logs || []).filter(l => l.type === 'ATTENDANCE').length,
            bulkCount: (res.logs || []).filter(l => l.type === 'BULK').length
          }
        });
      }
    } catch (err) {
      toast.error('Failed to load SMS audit logs: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Filter logs client-side with search bar
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logsData.logs;
    const term = searchQuery.toLowerCase().trim();
    return logsData.logs.filter(l => 
      (l.studentDisplayName && l.studentDisplayName.toLowerCase().includes(term)) ||
      (l.studentCustomId && l.studentCustomId.toLowerCase().includes(term)) ||
      (l.phone && l.phone.includes(term)) ||
      (l.guardianName && l.guardianName.toLowerCase().includes(term)) ||
      (l.className && l.className.toLowerCase().includes(term)) ||
      (l.message && l.message.toLowerCase().includes(term))
    );
  }, [logsData.logs, searchQuery]);

  // Filtered class list for combobox
  const filteredClassesList = useMemo(() => {
    if (!classSearchText.trim()) return classesList;
    const term = classSearchText.toLowerCase();
    return classesList.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.grade?.toLowerCase().includes(term) ||
      c.stream?.toLowerCase().includes(term)
    );
  }, [classesList, classSearchText]);

  const currentSelectedClassObj = useMemo(() => {
    if (selectedClassId === 'ALL') return null;
    return classesList.find(c => String(c.id) === String(selectedClassId));
  }, [classesList, selectedClassId]);

  // Quick Date Selectors
  const setQuickDate = (daysAgo) => {
    const target = subDays(new Date(), daysAgo);
    setSelectedDate(format(target, 'yyyy-MM-dd'));
  };

  // Copy Message to clipboard
  const handleCopyMessage = (logId, msg) => {
    navigator.clipboard.writeText(msg);
    setCopiedLogId(logId);
    toast.success('SMS content copied to clipboard!');
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // 1-Click High-Res PNG Image Export
  const handleExportAsImage = async () => {
    const targetElement = reportCaptureRef.current;
    if (!targetElement) {
      toast.error('Unable to capture report element');
      return;
    }

    setExporting(true);
    const toastId = toast.loading('Generating SMS audit report image...');

    try {
      await new Promise(r => setTimeout(r, 200));

      const dataUrl = await toPng(targetElement, {
        cacheBust: true,
        pixelRatio: 2.2,
        backgroundColor: '#0a0303',
        quality: 1.0
      });

      const link = document.createElement('a');
      const classNamePart = currentSelectedClassObj 
        ? `_${currentSelectedClassObj.name.replace(/[^a-zA-Z0-9]/g, '_')}` 
        : '_All_Classes';
      const filename = `IMA_Parent_SMS_Audit_Report${classNamePart}_${selectedDate}.png`;
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('SMS audit report exported as Image!', { id: toastId });
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('Failed to export image: ' + err.message, { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // 1-Click Excel (.xlsx) Export
  const handleExportAsExcel = () => {
    if (!filteredLogs.length) {
      toast.error('No SMS records to export');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryRows = [
        ['IMA CAMPUS - AUTOMATED PARENT SMS AUDIT & DELIVERY REPORT'],
        [`Audit Date: ${selectedDate}`],
        [`Generated On: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`],
        [],
        ['SMS DELIVERY KPI STATS'],
        ['Metric', 'Value'],
        ['Total SMS Messages Dispatched', logsData.summary.total],
        ['Successfully Delivered (SENT)', logsData.summary.sentCount],
        ['Failed Messages (FAILED)', logsData.summary.failedCount],
        ['Delivery Success Rate', `${logsData.summary.successRate}%`],
        ['Automated Attendance Alerts', logsData.summary.attendanceCount],
        ['Bulk Broadcast Alerts', logsData.summary.bulkCount],
        [],
        ['APPLIED FILTERS'],
        ['Date', selectedDate],
        ['Message Type', selectedType],
        ['Delivery Status', selectedStatus],
        ['Selected Class', currentSelectedClassObj ? currentSelectedClassObj.name : 'All Classes']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard');

      // 2. Detailed SMS Logs Sheet
      const rows = filteredLogs.map((log, idx) => ({
        '#': idx + 1,
        'Timestamp': format(new Date(log.createdAt), 'yyyy-MM-dd hh:mm:ss a'),
        'Delivery Status': log.status,
        'Type': log.type,
        'Student ID': log.studentCustomId || 'N/A',
        'Student Name': log.studentDisplayName || 'N/A',
        'Recipient Mobile': log.phone,
        'Guardian Name': log.guardianName || 'Parent',
        'Class Name': log.className || 'General Class',
        'Personalized Message': log.message,
        'Gateway Response': log.gatewayResponse || 'OK'
      }));

      const wsLogs = XLSX.utils.json_to_sheet(rows);
      wsLogs['!cols'] = [
        { wch: 6 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, 
        { wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 60 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsLogs, 'Dispatched SMS Records');

      const classNamePart = currentSelectedClassObj 
        ? `_${currentSelectedClassObj.name.replace(/[^a-zA-Z0-9]/g, '_')}` 
        : '_All_Classes';
      const fileName = `IMA_Parent_SMS_Audit_Report${classNamePart}_${selectedDate}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success('SMS audit report exported to Excel (.xlsx)!', { icon: '📊' });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      toast.error('Failed to export Excel: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white font-sans antialiased">
      
      {/* Top Navigation & Action Bar */}
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
              <MessageSquare className="text-blue-400" size={24} />
              <span>Automated Parent SMS Audit & Delivery Report</span>
            </h2>
            <p className="text-xs text-white/70 mt-0.5 font-medium">
              Real-time audit log of automated attendance SMS alerts dispatched to parents with Dialog eSMS delivery verification.
            </p>
          </div>
        </div>

        {/* 1-Click Export Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportAsExcel}
            disabled={loading || !filteredLogs.length}
            className="group px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 hover:from-blue-600 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_8px_20px_rgba(59,130,246,0.35)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-blue-400/50"
            title="Export SMS report as Excel spreadsheet"
          >
            <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform text-cyan-300" />
            <span>📊 Export to Excel</span>
          </button>

          <button
            onClick={handleExportAsImage}
            disabled={exporting || loading || !filteredLogs.length}
            className="group px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 border border-emerald-400/50"
            title="Download full report as crisp PNG image"
          >
            <Camera size={16} className="group-hover:scale-110 transition-transform text-amber-300" />
            <span>{exporting ? 'Generating Image...' : '📸 Export as Image'}</span>
          </button>

          <button
            onClick={fetchSmsLogs}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
            title="Refresh SMS Logs"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-4 sm:p-5 rounded-2xl shadow-lg grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-30">
        
        {/* Date Selector + Quick Pills (4 cols) */}
        <div className="md:col-span-4 space-y-2">
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider">
            Select Audit Date
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
            />
            
            <button
              onClick={() => setQuickDate(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => setQuickDate(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              Yesterday
            </button>
          </div>
        </div>

        {/* Message Type Filter (2 cols) */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider">
            SMS Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            <option value="ALL" className="text-black">🌟 All SMS Types</option>
            <option value="ATTENDANCE" className="text-black">⚡ Attendance Alerts</option>
            <option value="BULK" className="text-black">📢 Broadcast Messages</option>
          </select>
        </div>

        {/* Delivery Status Filter (2 cols) */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider">
            Delivery Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-white text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            <option value="ALL" className="text-black">🌟 All Statuses</option>
            <option value="SENT" className="text-black">✅ Sent (Success)</option>
            <option value="FAILED" className="text-black">❌ Failed</option>
          </select>
        </div>

        {/* Class Filter Combobox (4 cols) */}
        <div className="md:col-span-4 space-y-2 relative" ref={classDropdownRef}>
          <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider flex items-center justify-between">
            <span>Filter by Class</span>
            {selectedClassId !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId('ALL');
                  setClassSearchText('');
                  setIsClassDropdownOpen(false);
                }}
                className="text-amber-400 hover:text-amber-300 text-[10px] font-bold underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </label>

          <button
            type="button"
            onClick={() => setIsClassDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl text-white text-xs sm:text-sm font-semibold transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate pr-2">
              <BookOpen size={14} className="text-blue-400 shrink-0" />
              <span className="truncate font-bold">
                {currentSelectedClassObj 
                  ? `${currentSelectedClassObj.name} (${currentSelectedClassObj.grade})` 
                  : `🌟 All Physical Classes (${classesList.length})`}
              </span>
            </div>
            <ChevronDown size={15} className={`text-white/60 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isClassDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#120505] border border-white/25 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 p-2 space-y-2 max-h-80 flex flex-col">
              <input
                type="text"
                value={classSearchText}
                onChange={(e) => setClassSearchText(e.target.value)}
                placeholder="Search class..."
                className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/40"
              />
              <div className="overflow-y-auto max-h-56 space-y-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassId('ALL');
                    setClassSearchText('');
                    setIsClassDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedClassId === 'ALL' ? 'bg-blue-600 text-white' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  🌟 All Physical Classes ({classesList.length})
                </button>
                {filteredClassesList.map(cls => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setIsClassDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      String(cls.id) === String(selectedClassId) ? 'bg-blue-600 text-white' : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    <span className="block truncate">{cls.name}</span>
                    <span className="text-[10px] text-white/50 block font-normal">{cls.grade} • {cls.stream || 'General'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Main Content Area (Captured in Image Export) */}
      <div 
        ref={reportCaptureRef}
        className="space-y-6 p-5 sm:p-7 bg-[#0a0303] rounded-3xl border border-white/20 shadow-2xl relative font-sans text-white"
        style={{
          background: 'linear-gradient(180deg, #130505 0%, #0d0303 50%, #070202 100%)'
        }}
      >
        
        {/* Report Official Banner Header */}
        <div className="border-b border-white/15 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-blue-400 p-1 flex items-center justify-center shadow-xl shrink-0">
              <img src="/logo.png" alt="IMA Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide font-sans">IMA CAMPUS</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-blue-600/40 text-blue-300 border border-blue-500/50">
                  Parent SMS Audit
                </span>
              </div>
              <p className="text-sm text-cyan-300 font-bold tracking-wide mt-1 font-sans">
                Automated Dialog eSMS Attendance Notification Delivery Audit Log
              </p>
            </div>
          </div>

          <div className="text-right sm:text-right bg-black/60 border border-white/15 px-4 py-3 rounded-2xl">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">Audit Date</span>
            <span className="text-base sm:text-lg font-black text-blue-400 font-sans">
              {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </span>
            <span className="text-xs text-white/60 block mt-0.5 font-sans font-medium">
              Generated: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Global KPI Summary Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          {/* Total Dispatched */}
          <div className="bg-white/[0.05] border border-white/15 p-5 rounded-2xl shadow-md">
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
              Total Messages Dispatched
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-3xl sm:text-4xl font-black text-white font-sans">
                {logsData.summary.total}
              </h3>
              <span className="text-xs sm:text-sm text-white/60 font-bold">SMS</span>
            </div>
            <span className="text-xs text-white/50 mt-1 block font-medium">Automated & Broadcast</span>
          </div>

          {/* Delivered Successfully (SENT) */}
          <div className="bg-emerald-500/15 border border-emerald-500/40 p-5 rounded-2xl shadow-md">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" /> Delivered (SENT)
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-3xl sm:text-4xl font-black text-emerald-400 font-sans">
                {logsData.summary.sentCount}
              </h3>
              <span className="text-xs sm:text-sm text-emerald-300/80 font-bold">Success</span>
            </div>
            <span className="text-xs text-emerald-300/70 mt-1 block font-medium">Gateway 200 OK</span>
          </div>

          {/* Failed Messages (FAILED) */}
          <div className="bg-rose-500/15 border border-rose-500/40 p-5 rounded-2xl shadow-md">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block flex items-center gap-1.5">
              <XCircle size={14} className="text-rose-400" /> Delivery Failures
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-3xl sm:text-4xl font-black text-rose-400 font-sans">
                {logsData.summary.failedCount}
              </h3>
              <span className="text-xs sm:text-sm text-rose-300/80 font-bold">Failed</span>
            </div>
            <span className="text-xs text-rose-300/70 mt-1 block font-medium">Invalid No. / Gateway Error</span>
          </div>

          {/* Delivery Rate */}
          <div className="bg-gradient-to-br from-blue-600/20 via-indigo-600/15 to-transparent border border-blue-500/40 p-5 rounded-2xl shadow-md">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider block flex items-center gap-1.5">
              <ShieldCheck size={14} /> Delivery Success Rate
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-3xl sm:text-4xl font-black text-blue-300 font-sans">
                {logsData.summary.successRate}%
              </h3>
              <span className="text-xs sm:text-sm text-blue-200/80 font-bold">Reliability</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                style={{ width: `${Math.min(100, logsData.summary.successRate)}%` }}
              ></div>
            </div>
          </div>

        </div>

        {/* Live Search & Filter Bar within Report */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white uppercase tracking-wider">
              Dispatched Message Logs ({filteredLogs.length} Records)
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-3 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student, ID, phone, message..."
              className="w-full pl-10 pr-3.5 py-2 bg-white/5 border border-white/15 rounded-xl text-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SMS Records Cards List */}
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-white/70">Fetching automated SMS audit records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-white/20 rounded-2xl">
            <MessageSquare size={44} className="text-white/30" />
            <h3 className="text-lg font-bold text-white/80">No SMS Records Found for {selectedDate}</h3>
            <p className="text-sm text-white/50 max-w-md">
              No parent attendance alerts or bulk broadcasts match your current filters for this date.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredLogs.map((log) => {
              const isSuccess = log.status === 'SENT';
              const logTime = format(new Date(log.createdAt), 'hh:mm:ss a');
              const isCopied = copiedLogId === log.id;

              return (
                <div 
                  key={log.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-lg ${
                    isSuccess 
                      ? 'bg-emerald-950/15 border-emerald-500/30 hover:border-emerald-500/50' 
                      : 'bg-rose-950/20 border-rose-500/35 hover:border-rose-500/55'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    
                    {/* Left: Student & Recipient Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSuccess ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                        <h4 className="text-sm sm:text-base font-bold text-white truncate">
                          {log.studentDisplayName || 'Student'}
                        </h4>
                        {log.studentCustomId && (
                          <span className="text-xs font-bold text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                            {log.studentCustomId}
                          </span>
                        )}
                        <span className="text-xs font-bold text-blue-300 px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                          {log.className || 'Class'}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          log.type === 'ATTENDANCE' 
                            ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40' 
                            : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                        }`}>
                          {log.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap font-medium">
                        <span>👨‍👩‍👦 {log.guardianName ? `${log.guardianName} • ` : ''}📞 {log.phone}</span>
                        <span>•</span>
                        <span>⏰ Sent at: {logTime}</span>
                      </div>
                    </div>

                    {/* Right: Delivery Status Badge & Copy Action */}
                    <div className="flex items-center gap-2.5 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(log.id, log.message)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        title="Copy message text"
                      >
                        {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{isCopied ? 'Copied' : 'Copy SMS'}</span>
                      </button>

                      <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border shadow-md ${
                        isSuccess 
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50' 
                          : 'bg-rose-500/25 text-rose-300 border-rose-400/50'
                      }`}>
                        {isSuccess ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-rose-400" />}
                        <span>{isSuccess ? 'DELIVERED (SENT)' : 'FAILED'}</span>
                      </span>
                    </div>

                  </div>

                  {/* Personalized SMS Message Content Box */}
                  <div className="mt-3 p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white/90 font-medium leading-relaxed">
                    <p className="select-text">{log.message}</p>
                    {log.gatewayResponse && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
                        <span>Gateway: Dialog eSMS</span>
                        <span className="truncate font-mono">{log.gatewayResponse}</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}

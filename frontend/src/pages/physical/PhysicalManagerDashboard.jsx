import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Scan } from 'lucide-react';
import toast from 'react-hot-toast';
import OverviewTab from './OverviewTab';
import StudentRegistration from '../PhysicalCRM/StudentRegistration';
import ClassTeacherManagement from '../PhysicalCRM/ClassTeacherManagement';
import AttendancePortal from '../PhysicalCRM/AttendancePortal';
import CashFlowPortal from '../PhysicalCRM/CashFlowPortal';
import PhysicalTimetable from '../PhysicalCRM/PhysicalTimetable';
import FinancialReports from '../PhysicalCRM/FinancialReports';
import LecturerReports from '../PhysicalCRM/LecturerReports';
import StudentReports from '../PhysicalCRM/StudentReports';
import ClassComparisonReport from '../PhysicalCRM/ClassComparisonReport';
import EntranceGateScanner from '../PhysicalCRM/EntranceGateScanner';

export default function PhysicalManagerDashboard() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'overview';

  // Global Hardware Scanner Listener for Physical Hub
  const scanBufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const target = e.target;
      const isFormInput = 
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || 
        target?.isContentEditable || 
        Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], form, [role="dialog"], [role="modal"]'));
      
      // If activeTab is entrance-gate, EntranceGateScanner has its own dedicated handler
      if (activeTab === 'entrance-gate') {
        scanBufferRef.current = '';
        return;
      }

      // If user is currently focused inside any form input/textarea/select/modal or editing forms, do not intercept!
      if (isFormInput) {
        scanBufferRef.current = '';
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key marks end of barcode scan (only when outside form inputs)
      if (e.key === 'Enter') {
        const scannedCode = scanBufferRef.current.trim();
        if (scannedCode.length >= 2) {
          console.log('[Physical Hub Scanner] Auto-scanned Student Card:', scannedCode);
          toast.success(`⚡ Student Card Scanned: ${scannedCode}`, {
            icon: '📇',
            duration: 2500
          });
          scanBufferRef.current = '';
          navigate(`/physical/dashboard/attendance?studentId=${encodeURIComponent(scannedCode)}`);
          return;
        }
        scanBufferRef.current = '';
        return;
      }

      // Buffer normal alphanumeric characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff > 150) {
          scanBufferRef.current = e.key;
        } else {
          scanBufferRef.current += e.key;
        }

        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, 300);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      clearTimeout(scanTimeoutRef.current);
    };
  }, [navigate]);

  const tabTitles = {
    registration: 'Student Registration',
    staff: 'Teachers & Classes',
    attendance: 'Student Attendance Portal',
    'student-reports': 'Student Reports & Attendance Matrix',
    'class-compare': 'Class Comparison & Overlap Reports',
    finance: 'Cash Flow Portal',
    timetable: 'Class Timetable',
    reports: 'Financial Reports & Analytics',
    'lecturer-reports': 'Lecturer Reports & Monthly Invoices',
    'entrance-gate': 'Smart Entrance Gate Scanner'
  };

  return (
    <div className="h-full w-full flex flex-col animate-fade-in relative overflow-hidden">
      {activeTab !== 'overview' && activeTab !== 'entrance-gate' && (
        <div className="px-4 pt-3 md:px-6 flex items-center justify-between z-20 shrink-0 mb-1">
          <button
            onClick={() => navigate('/physical/dashboard/overview')}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg backdrop-blur-md transition-all active:scale-95 group cursor-pointer"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform text-red-400" />
            <span>Back to Physical Overview</span>
          </button>

          <span className="text-xs font-bold text-white/60 bg-white/5 px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
            Physical Hub • {tabTitles[activeTab] || activeTab}
          </span>
        </div>
      )}
      
      {/* Dynamic Content Area */}
      <div className={`flex-1 ${activeTab === 'entrance-gate' ? 'p-0 overflow-hidden m-0' : activeTab === 'attendance' ? 'p-1 md:p-2 m-0 overflow-y-auto' : 'overflow-y-auto p-4 md:p-6 lg:p-8 m-2'} relative no-scrollbar bg-black/5 rounded-3xl shadow-inner`}>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'entrance-gate' && <EntranceGateScanner />}
          {activeTab === 'registration' && <StudentRegistration />}
          {activeTab === 'staff' && <ClassTeacherManagement />}
          {activeTab === 'attendance' && <AttendancePortal />}
          {activeTab === 'student-reports' && <StudentReports />}
          {activeTab === 'class-compare' && <ClassComparisonReport />}
          {activeTab === 'finance' && <CashFlowPortal />}
          {activeTab === 'timetable' && <PhysicalTimetable />}
          {activeTab === 'reports' && <FinancialReports />}
          {activeTab === 'lecturer-reports' && <LecturerReports />}
      </div>
      
    </div>
  );
}



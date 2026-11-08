import React, { useState, useEffect, Suspense } from 'react';
import PageLoader from './components/common/PageLoader';

// Pages load on demand (the old single 7 MB file made every page slow).
// After a new deploy the old page files are gone; if someone with an old tab opens a page,
// reload once to get the new files instead of showing an error.
const lazy = (load) => React.lazy(() => load().catch((err) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem('ima-chunk-reload') || 0); } catch (e) { /* storage blocked */ }
  if (Date.now() - last > 30000) {
    try { sessionStorage.setItem('ima-chunk-reload', String(Date.now())); } catch (e) { /* ignore */ }
    window.location.reload();
    return new Promise(() => {});
  }
  throw err;
}));
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout & Pages
const Home = lazy(() => import('./pages/web/pages/Home'));
const NewCampusLandingPage = lazy(() => import('./pages/web/pages/NewCampusLandingPage'));
const AcademyLandingPage = lazy(() => import('./pages/web/pages/AcademyLandingPage'));
const FastTrackLandingPage = lazy(() => import('./pages/web/pages/FastTrackLandingPage'));
const AboutUs = lazy(() => import('./pages/web/pages/AboutUs'));
const ContactUs = lazy(() => import('./pages/web/pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/web/pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/web/pages/Terms'));
const PusthakalayaPortal = lazy(() => import('./pages/web/pages/PusthakalayaPortal'));
const LibraryManager = lazy(() => import('./pages/admin/LibraryManager'));
import Login from './pages/auth/Login';
const Register = lazy(() => import('./pages/auth/Register'));
import GhostAuth from './pages/auth/GhostAuth';
import MainLayout from "./components/layouts/MainLayout";
const CallCampaignModule = lazy(() => import('./components/CoordinatorCRM/CallCampaignModule'));
import WhatsAppPermissionPopup from './components/common/WhatsAppPermissionPopup';
import { ThemeProvider } from './contexts/ThemeContext';
const MonthlyRoster = lazy(() => import('./pages/class_coordinator/staff/MonthlyRoster'));
const AnnouncementsManager = lazy(() => import('./pages/admin/AnnouncementsManager'));
const SystemTasksAdmin = lazy(() => import('./pages/admin/SystemTasksAdmin'));

// Call Handling Context & UI
import { CallProvider } from './contexts/CallContext';
import WhatsAppCallScreen from './components/common/WhatsAppCallScreen';
const HeadlessIvrBot = lazy(() => import('./components/common/HeadlessIvrBot'));

// Dashboards & Modules
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ExecutiveStatsHub = lazy(() => import('./pages/admin/ExecutiveStatsHub'));
const ContentHub = lazy(() => import('./components/common/contenthub/ContentHub'));
const StaffManagement = lazy(() => import('./components/common/StaffManagement'));
const PaymentManagement = lazy(() => import('./components/common/PaymentManagement'));

const StudentDataCenter = lazy(() => import('./components/common/StudentDataCenter'));
const ClassTimetable = lazy(() => import('./components/common/ClassTimetable'));
const TaskCenter = lazy(() => import('./components/common/TaskCenter'));
const AfterSeminarDashboard = lazy(() => import('./components/AfterSeminarCRM/AfterSeminarDashboard'));

// 🔥 අලුත් Campaign Dashboard Component එක Import කරන තැන 🔥
const CallCampaignDashboard = lazy(() => import('./components/AfterSeminarCRM/CallCampaignDashboard'));
const FinanceMatrix = lazy(() => import('./components/DataExport/FinanceMatrix'));
const PaidCampaignDropMatrix = lazy(() => import('./components/DataExport/PaidCampaignDropMatrix'));
const LeadDataCenter = lazy(() => import('./components/admin/LeadDataCenter'));
const CallCampaignDataCenter = lazy(() => import('./pages/admin/CallCampaignDataCenter'));

const ThemeShowcase = lazy(() => import('./components/ThemeShowcase'));

// System Admin CRM Setup
const CrmManagement = lazy(() => import('./components/admin/CrmManagement'));
const DatabaseManager = lazy(() => import('./components/admin/DatabaseManager'));
const TestInjector = lazy(() => import('./components/admin/TestInjector'));
const DataExportDashboard = lazy(() => import('./components/DataExport/DataExportDashboard'));
const ZoomAccountManager = lazy(() => import('./pages/admin/ZoomAccountManager'));
const WhatsAppCallTest = lazy(() => import('./pages/admin/WhatsAppCallTest'));
const WhatsAppBillingDashboard = lazy(() => import('./pages/admin/WhatsAppBillingDashboard'));
const CallTreeManager = lazy(() => import('./pages/admin/CallTreeManager'));
const PaperMarkerDashboard = lazy(() => import('./components/paperMarker/PaperMarkerDashboard'));
const PaperGuiderHub = lazy(() => import('./pages/admin/PaperGuiderHub'));

// Coordinator CRM Dashboard (For Manager & Staff)
const CoordinatorDashboard = lazy(() => import('./pages/ClassCoordinator/CoordinatorDashboard'));
const WebInquiries = lazy(() => import('./components/CoordinatorCRM/WebInquiries'));
const LumiCallerMain = lazy(() => import('./pages/LumiCaller/LumiCallerMain'));

// Department Dashboards (Mangers & Staff)
const ManagerDashboard = lazy(() => import('./pages/class_coordinator/manager/ManagerDashboard'));
const LecturerTuteStockCalendar = lazy(() => import('./pages/class_coordinator/manager/LecturerTuteStockCalendar'));
const TechnicalDashboard = lazy(() => import('./pages/technical/TechnicalDashboard'));
const DeliveryDashboard = lazy(() => import('./pages/delivery/DeliveryDashboard'));
const CallCenterManagerDashboard = lazy(() => import('./pages/call_center/CallCenterManagerDashboard'));
const CallCenterAgentDashboard = lazy(() => import('./pages/call_center/CallCenterAgentDashboard'));
const PhysicalManagerDashboard = lazy(() => import('./pages/physical/PhysicalManagerDashboard'));
const StudentRegistration = lazy(() => import('./pages/PhysicalCRM/StudentRegistration'));
const ClassTeacherManagement = lazy(() => import('./pages/PhysicalCRM/ClassTeacherManagement'));
const LecturerReports = lazy(() => import('./pages/PhysicalCRM/LecturerReports'));
const EntranceGateScanner = lazy(() => import('./pages/PhysicalCRM/EntranceGateScanner'));

// Finance Dashboard Import
const FinanceOverview = lazy(() => import('./pages/finance/FinanceOverview'));
const TeacherSalaryPortal = lazy(() => import('./pages/finance/TeacherSalaryPortal'));
const TeacherSalaryHistory = lazy(() => import('./pages/finance/TeacherSalaryHistory'));
const PettyCashPortal = lazy(() => import('./pages/finance/PettyCashPortal'));

// Student
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentDashboardV2 = lazy(() => import('./pages/student/StudentDashboardV2'));
const LiveJoin = lazy(() => import('./pages/student/LiveJoin'));
const StudentDeliveryHub = lazy(() => import('./pages/student/components/DeliveryHub'));
const PaycorpReturn = lazy(() => import('./pages/student/components/PaycorpReturn'));

// Test
const SecureYoutubePlayerTest = lazy(() => import('./pages/test/SecureYoutubePlayerTest'));
const VideoTestPage = lazy(() => import('./VideoTestPage'));

// Social Media Department
const SocialMediaManagerDashboard = lazy(() => import('./pages/social_media/SocialMediaManagerDashboard'));
const SocialMediaStaffDashboard = lazy(() => import('./pages/social_media/SocialMediaStaffDashboard'));
const SocialMediaDelegationHub = lazy(() => import('./pages/class_coordinator/SocialMediaDelegationHub'));
const VideoEditor = lazy(() => import('./pages/social_media/components/VideoEditor'));
const AIVideoGenerator = lazy(() => import('./pages/social_media/components/AIVideoGenerator'));
const AIImageGeneratorPage = lazy(() => import('./pages/admin/AIImageGeneratorPage'));
const ClaudeOpusStudio = lazy(() => import('./pages/admin/ClaudeOpusStudio'));
const AITeamHub = lazy(() => import('./pages/admin/AITeamHub'));
const SinhalaVoiceAgentTester = lazy(() => import('./pages/admin/SinhalaVoiceAgentTester'));
const YouTubeTranscriber = lazy(() => import('./pages/admin/YouTubeTranscriber'));

// 🔥 GHOST MODE BANNER COMPONENT 🔥
const GhostModeBanner = () => {
  const isAdminGhosting = localStorage.getItem('admin_token');

  if (!isAdminGhosting) return null;

  const handleExitGhostMode = () => {
    localStorage.setItem('token', localStorage.getItem('admin_token'));
    localStorage.setItem('user', localStorage.getItem('admin_user'));

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');

    window.location.href = '/login';
  };

  return (
    <button
      onClick={handleExitGhostMode}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-red-600/90 backdrop-blur-md border border-red-500 text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-all group"
    >
      <span className="animate-pulse">🔴</span>
      Ghost Mode Active
      <span className="text-red-200 ml-2 group-hover:text-white">| Exit</span>
    </button>
  );
};

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.department === 'Physical' && u.role !== 'Staff') {
          u.role = 'Staff';
          localStorage.setItem('user', JSON.stringify(u));
        }
        setLoggedInUser(u);
      } catch (e) {
        setLoggedInUser(JSON.parse(storedUser));
      }
    }
    setAuthChecked(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setLoggedInUser(null);
    window.location.href = '/login';
  };

  const getDashboardLink = (user) => {
    if (!user) return '/login';

    const role = (user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const dept = user?.department;

    if (role === 'STUDENT' || role === 'USER') return '/student/dashboard';

    if (role === 'PAPER_GUIDER') return '/paper-guider/hub';
    if (role === 'PAPER_MARKER') return '/paper-marker/dashboard';

    if (role === 'LECTURE' || role === 'LECTURER') return '/manager/dashboard';

    if (role === 'CALLER') return '/workspace/crm';
    if (role === 'CALL_CENTER_AGENT' || role === 'CALL CENTER AGENT') return '/call-center/agent/overview';

    if (role === 'COORDINATOR') return '/coordinator/dashboard';

    if (role === 'SOCIAL MEDIA MANAGER' || role === 'SOCIAL_MEDIA_MANAGER' || ((role === 'MANAGER' || role === 'ASS MANAGER') && dept === 'Social Media')) return '/social-media/manager/dashboard';
    if (role === 'SOCIAL MEDIA STAFF' || role === 'SOCIAL_MEDIA_STAFF' || (role === 'STAFF' && dept === 'Social Media')) return '/social-media/staff/dashboard';

    if (dept === 'Call Center') {
      return (role === 'MANAGER' || role === 'ASS MANAGER' || role === 'SUPER') ? '/call-center/dashboard' : '/call-center/agent/overview';
    }

    if (role === 'MANAGER' || role === 'ASS MANAGER' || role === 'STAFF') {
      if (dept === 'Finance') return '/finance/dashboard';
      if (dept === 'Class Coordination') return '/coordinator/dashboard';
      if (dept === 'Technical') return '/technical/dashboard';
      if (dept === 'Delivery') return '/delivery/dashboard';
      if (dept === 'Physical') return '/physical/dashboard/overview';

      return '/manager/dashboard';
    }

    return '/admin/dashboard';
  };

  // Opened a live-class link (/live/<id>) before logging in → go back there after login.
  const afterLoginPath = () => {
    try {
      const p = sessionStorage.getItem('ima-after-login');
      return p && /^\/live\/\d+$/.test(p) ? p : null;
    } catch (e) { return null; }
  };

  if (!authChecked) return <div className="min-h-screen bg-[#0a0f1c]"></div>;

  // Subdomain detection for Meta Business Verification
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isAcademySubdomain = hostname.startsWith('academy.') || hostname.includes('iddamalgoda');
  const isFastTrackSubdomain = hostname.startsWith('fasttrack.') || hostname.startsWith('fast-track.');

  const getPublicRootComponent = () => {
    if (isAcademySubdomain) return <AcademyLandingPage />;
    if (isFastTrackSubdomain) return <FastTrackLandingPage />;
    return <NewCampusLandingPage loggedInUser={loggedInUser} />;
  };

  return (
    <ThemeProvider>
      <CallProvider>
        <BrowserRouter>
          <Toaster position="top-right" />

          <WhatsAppCallScreen />
          <WhatsAppPermissionPopup />

          <GhostModeBanner />

          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={getPublicRootComponent()} />
            <Route path="/academy" element={<AcademyLandingPage />} />
            <Route path="/iddamalgoda-media-academy" element={<AcademyLandingPage />} />
            <Route path="/fasttrack" element={<FastTrackLandingPage />} />
            <Route path="/fast-track" element={<FastTrackLandingPage />} />
            <Route path="/ima-fast-track" element={<FastTrackLandingPage />} />
            <Route path="/old-home" element={<Home loggedInUser={loggedInUser} />} />
            <Route path="/landingpage-new" element={<NewCampusLandingPage loggedInUser={loggedInUser} />} />
            <Route path="/new-landing-page" element={<NewCampusLandingPage loggedInUser={loggedInUser} />} />
            <Route path="/campus" element={<NewCampusLandingPage loggedInUser={loggedInUser} />} />
            <Route path="/landing" element={<NewCampusLandingPage loggedInUser={loggedInUser} />} />
            <Route path="/pusthakalaya" element={<PusthakalayaPortal />} />
            <Route path="/library" element={<PusthakalayaPortal />} />
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/register" element={<Register />} />
            <Route path="/test-youtube-player" element={<VideoTestPage />} />
            <Route path="/test-video" element={<VideoTestPage />} />
            <Route path="/headless-ivr/:callId" element={<HeadlessIvrBot />} />
            <Route path="/physical/entrance-gate" element={<EntranceGateScanner isStandalone={true} />} />

            {/* 🔥 NEW: Ghost Login Route 🔥 */}
            <Route path="/ghost-auth" element={<GhostAuth />} />

            {/* Student link for one live class (login → payment check → Join Now) */}
            <Route path="/live/:id" element={<LiveJoin />} />

            <Route
              path="/login"
              element={loggedInUser ? <Navigate to={afterLoginPath() || getDashboardLink(loggedInUser)} /> : <Login setLoggedInUser={setLoggedInUser} />}
            />

            {/* ✅ ADMIN & STAFF ROUTES ✅ */}
            <Route element={loggedInUser && loggedInUser.role.toUpperCase() !== 'STUDENT' && loggedInUser.role.toUpperCase() !== 'USER' ? <MainLayout loggedInUser={loggedInUser} handleLogout={handleLogout} /> : <Navigate to="/login" />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/pusthakalaya" element={<LibraryManager loggedInUser={loggedInUser} />} />
              <Route path="/admin/library" element={<LibraryManager loggedInUser={loggedInUser} />} />
              <Route path="/manager/pusthakalaya" element={<LibraryManager loggedInUser={loggedInUser} />} />
              <Route path="/coordinator/pusthakalaya" element={<LibraryManager loggedInUser={loggedInUser} />} />
              <Route path="/workspace/pusthakalaya" element={<LibraryManager loggedInUser={loggedInUser} />} />
              <Route path="/admin/stats-hub" element={<ExecutiveStatsHub loggedInUser={loggedInUser} />} />
              <Route path="/admin/claude-opus" element={<ClaudeOpusStudio loggedInUser={loggedInUser} />} />
              <Route path="/admin/sinhala-voice-agent" element={<SinhalaVoiceAgentTester loggedInUser={loggedInUser} />} />
              <Route path="/admin/yt-transcriber" element={<YouTubeTranscriber loggedInUser={loggedInUser} />} />
              <Route path="/admin/ai-team" element={<AITeamHub loggedInUser={loggedInUser} />} />
              <Route path="/workspace/ai-team" element={<AITeamHub loggedInUser={loggedInUser} />} />
              <Route path="/admin/system-tasks" element={<SystemTasksAdmin />} />
              <Route path="/manager/dashboard" element={<ManagerDashboard />} />
              <Route path="/manager/tute-stock" element={<LecturerTuteStockCalendar loggedInUser={loggedInUser} />} />
              <Route path="/coordinator/tute-stock" element={<LecturerTuteStockCalendar loggedInUser={loggedInUser} />} />
              <Route path="/admin/announcements" element={<AnnouncementsManager loggedInUser={loggedInUser} />} />
              <Route path="/coordinator/dashboard" element={<CoordinatorDashboard loggedInUser={loggedInUser} />} />
              <Route path="/finance/dashboard" element={<FinanceOverview />} />
              <Route path="/call-center/dashboard/:tab?" element={<CallCenterManagerDashboard />} />
              <Route path="/call-center/agent/:tab?" element={<CallCenterAgentDashboard />} />
              <Route path="/technical/dashboard" element={<TechnicalDashboard />} />
              <Route path="/workspace/call-campaign" element={<CallCampaignModule loggedInUser={loggedInUser} />} />
              <Route path="/delivery/dashboard" element={<DeliveryDashboard loggedInUser={loggedInUser} />} />

              <Route path="/admin/finance-matrix" element={<FinanceMatrix loggedInUser={loggedInUser} />} />
              <Route path="/admin/teacher-salary" element={<TeacherSalaryPortal loggedInUser={loggedInUser} />} />
              <Route path="/finance/teacher-salary" element={<TeacherSalaryPortal loggedInUser={loggedInUser} />} />
              <Route path="/admin/teacher-salary-history" element={<TeacherSalaryHistory loggedInUser={loggedInUser} />} />
              <Route path="/finance/teacher-salary-history" element={<TeacherSalaryHistory loggedInUser={loggedInUser} />} />
              
              {/* Petty Cash Management System */}
              <Route path="/petty-cash" element={<PettyCashPortal loggedInUser={loggedInUser} />} />
              <Route path="/admin/petty-cash" element={<PettyCashPortal loggedInUser={loggedInUser} />} />
              <Route path="/finance/petty-cash" element={<PettyCashPortal loggedInUser={loggedInUser} />} />
              <Route path="/manager/petty-cash" element={<PettyCashPortal loggedInUser={loggedInUser} />} />

              <Route path="/admin/paid-campaign" element={<PaidCampaignDropMatrix loggedInUser={loggedInUser} />} />
              <Route path="/admin/lead-data-center" element={<LeadDataCenter loggedInUser={loggedInUser} />} />
              <Route path="/admin/call-campaign-data-center" element={<CallCampaignDataCenter />} />

              <Route path="/theme-showcase" element={<ThemeShowcase />} />

              {/* Common Panels */}
              <Route path="/admin/content-hub" element={<ContentHub loggedInUser={loggedInUser} />} />
              <Route path="/admin/staff" element={<StaffManagement loggedInUser={loggedInUser} />} />
              <Route path="/admin/payments" element={<PaymentManagement loggedInUser={loggedInUser} />} />

              <Route path="/admin/student-center" element={<StudentDataCenter loggedInUser={loggedInUser} />} />
              <Route path="/workspace/timetable" element={<ClassTimetable />} />
              <Route path="/workspace/tasks" element={<TaskCenter loggedInUser={loggedInUser} />} />
              <Route path="/workspace/roster" element={<MonthlyRoster loggedInUser={loggedInUser} />} />
              <Route path="/admin/data-export" element={<DataExportDashboard loggedInUser={loggedInUser} />} />

              {/* System Admin CRM Configuration */}
              <Route path="/admin/crm-setup" element={<CrmManagement loggedInUser={loggedInUser} />} />
              <Route path="/admin/database" element={<DatabaseManager />} />
              <Route path="/admin/test-injector" element={<TestInjector />} />
              <Route path="/admin/zoom-accounts" element={<ZoomAccountManager />} />
              <Route path="/admin/whatsapp-call-test" element={<WhatsAppCallTest loggedInUser={loggedInUser} />} />
              <Route path="/admin/whatsapp-billing" element={<WhatsAppBillingDashboard loggedInUser={loggedInUser} />} />
              <Route path="/admin/call-tree" element={<CallTreeManager loggedInUser={loggedInUser} />} />
              {/* Note: theme-showcase route duplicated, removed one instance implicitly */}

              {/* Active CRM Interface for Staff & Managers */}
              <Route path="/workspace/crm" element={<CoordinatorDashboard loggedInUser={loggedInUser} />} />
              <Route path="/workspace/web-inquiries" element={<WebInquiries loggedInUser={loggedInUser} />} />
              <Route path="/workspace/after-seminar-crm" element={<AfterSeminarDashboard loggedInUser={loggedInUser} />} />

              {/* Lumi Caller Hub */}
              <Route path="/lumi-caller/:tab" element={<LumiCallerMain loggedInUser={loggedInUser} />} />

              {/* 🔥 අලුත් CALL CAMPAIGN ROUTES 4 🔥 */}
              <Route path="/workspace/campaign/overview" element={<CallCampaignDashboard campaignType="OVERALL" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/open-seminar" element={<CallCampaignDashboard campaignType="OPEN_SEM" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/new-inquiries" element={<CallCampaignDashboard campaignType="NEW_INQ" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/bridge-transfers" element={<CallCampaignDashboard campaignType="BRIDGE" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/paid-students" element={<CallCampaignDashboard campaignType="PAID" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/coordinator-progress" element={<CallCampaignDashboard campaignType="COORD_PROGRESS" loggedInUser={loggedInUser} />} />
              <Route path="/workspace/campaign/coordinator-tracking" element={<CallCampaignDashboard campaignType="COORD_TRACKING" loggedInUser={loggedInUser} />} />

              {/* Physical CRM Routes */}
              <Route path="/physical/dashboard/:tab?" element={<PhysicalManagerDashboard loggedInUser={loggedInUser} />} />
              <Route path="/physical/student-registration" element={<StudentRegistration />} />
              <Route path="/physical/staff-management" element={<ClassTeacherManagement />} />

              {/* Social Media Task Delegation Hub for Managers */}
              <Route path="/workspace/social-media-delegation" element={<SocialMediaDelegationHub loggedInUser={loggedInUser} />} />

              {/* Social Media Routes */}
              <Route path="/social-media/manager/dashboard" element={<SocialMediaManagerDashboard loggedInUser={loggedInUser} />} />
              <Route path="/social-media/staff/dashboard" element={<SocialMediaStaffDashboard loggedInUser={loggedInUser} />} />
              <Route path="/social-media/ai-video-generator" element={<AIVideoGenerator loggedInUser={loggedInUser} />} />
              <Route path="/social-media/video-editor" element={<VideoEditor />} />

              {/* AI Image Studio / Generator in Development & Admin */}
              <Route path="/admin/ai-image-generator" element={<AIImageGeneratorPage loggedInUser={loggedInUser} />} />
              <Route path="/development/ai-image-generator" element={<AIImageGeneratorPage loggedInUser={loggedInUser} />} />

              {/* Paper Marker Routes */}
              <Route path="/paper-marker/dashboard" element={<PaperMarkerDashboard loggedInUser={loggedInUser} activeTab="overview" />} />
              <Route path="/paper-marker/workplace" element={<PaperMarkerDashboard loggedInUser={loggedInUser} activeTab="workplace" />} />

              {/* Paper Guider & Ranking Hub Routes */}
              <Route path="/paper-guider/hub" element={<PaperGuiderHub loggedInUser={loggedInUser} />} />
              <Route path="/paper-guider/dashboard" element={<PaperGuiderHub loggedInUser={loggedInUser} />} />
              <Route path="/admin/paper-guider-hub" element={<PaperGuiderHub loggedInUser={loggedInUser} />} />
            </Route>

            {/* ✅ STUDENT ROUTES ✅ */}
            <Route
              path="/student/dashboard"
              element={loggedInUser && (loggedInUser.role.toUpperCase() === 'STUDENT' || loggedInUser.role.toUpperCase() === 'USER') ? <StudentDashboardV2 /> : <Navigate to="/login" />}
            />
            {/* New Route for V2 Dashboard Testing */}
            <Route
              path="/student/dashboard-v2"
              element={loggedInUser && (loggedInUser.role.toUpperCase() === 'STUDENT' || loggedInUser.role.toUpperCase() === 'USER') ? <StudentDashboardV2 /> : <Navigate to="/login" />}
            />
            <Route
              path="/student/delivery"
              element={loggedInUser && (loggedInUser.role.toUpperCase() === 'STUDENT' || loggedInUser.role.toUpperCase() === 'USER') ? <StudentDeliveryHub /> : <Navigate to="/login" />}
            />
            <Route path="/student/paycorp-return/:businessId?" element={<PaycorpReturn />} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </CallProvider>
    </ThemeProvider>
  );
}
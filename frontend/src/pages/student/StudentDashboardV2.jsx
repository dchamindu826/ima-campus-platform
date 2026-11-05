import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import axios from '../../api/axios';
import { Menu, LogOut, AlertTriangle, Info, Lock, Bell, Sparkles, Check, Palette } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/avatarUtils';
import SidebarV2 from './components/SidebarV2';
import EnrollmentTab from './components/EnrollmentTab';
import PaymentHistory from './components/PaymentHistory';
import MyClassroom from './components/MyClassroom'; 
import StudentOverview from './components/StudentOverview';
import DeliveryHub from './components/DeliveryHub';
import ProfileSettings from './components/ProfileSettings';
import WebInquiryWidget from './components/WebInquiryWidget';

const urlParams = new URLSearchParams(window.location.search);
const ghostToken = urlParams.get('token');
const isGhostMode = urlParams.get('embedded') === 'true';

if (isGhostMode && ghostToken) {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
        if (key === 'token' || key === 'userToken') return ghostToken;
        return originalGetItem.apply(this, arguments);
    };
    axios.defaults.headers.common['Authorization'] = `Bearer ${ghostToken}`;
}

const getSecureImageUrl = (url) => {
    if (!url) return '';
    return url.replace('http://72.62.249.211:5000', 'https://imacampus.online');
};

const StudentDashboardV2 = () => {

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate(); 

  const urlBusinessId = searchParams.get('businessId');

  useEffect(() => {
    if (!isGhostMode && ghostToken) {
        localStorage.setItem('token', ghostToken);
        localStorage.setItem('userToken', ghostToken); 
    }

    if (urlBusinessId && !isGhostMode) {
        localStorage.setItem('selectedBusiness', urlBusinessId); 
        localStorage.setItem('businessId', urlBusinessId); 
    }

    if (ghostToken || urlBusinessId) {
        const cleanUrl = isGhostMode ? `${location.pathname}?embedded=true` : location.pathname;
        navigate(cleanUrl, { replace: true });
    }
  }, [ghostToken, urlBusinessId, location.pathname, navigate]);
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'home'); 
  
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleUserUpdate = () => {
      try {
        setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}') || {});
      } catch (e) {}
    };
    window.addEventListener('user-updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);
    return () => {
      window.removeEventListener('user-updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, []);

  const backendBaseUrl = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : 'https://imacampus.online';
  const headerProfilePic = resolveAvatarUrl(
      currentUser.image,
      currentUser.phone || currentUser.whatsapp,
      axios.defaults.baseURL
  );

  useEffect(() => {
      if (location.state?.activeTab) {
          setActiveTab(location.state.activeTab);
      }
  }, [location.state?.activeTab]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [businesses, setBusinesses] = useState([]);
  const [alerts, setAlerts] = useState([]); 

  // Wallpaper state with instant loading & accurate natural names
  const wallpapers = [
    { id: 'default', url: '/student-bg.jpg', label: 'Default', desc: 'Signature Purple Aura' },
    { id: 'crimson', url: '/bg2.jpg', label: 'Crimson', desc: 'Deep Velvet Red' },
    { id: 'midnight', url: '/bg3.jpg', label: 'Midnight', desc: 'Dark Cosmic Blue' }
  ];

  const [bgImage, setBgImage] = useState(() => {
    return localStorage.getItem('student_bg') || '/student-bg.jpg';
  });

  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const wallpaperMenuRef = useRef(null);

  const handleBgChange = (newBg) => {
    setBgImage(newBg);
    localStorage.setItem('student_bg', newBg);
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (wallpaperMenuRef.current && !wallpaperMenuRef.current.contains(e.target)) {
        setShowWallpaperMenu(false);
      }
    };
    if (showWallpaperMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showWallpaperMenu]);

  useEffect(() => {
    // Ensure dark mode is active to prevent any flat white washout
    document.documentElement.classList.add('dark');
    delete document.documentElement.dataset.theme;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const enrollRes = await axios.get('/student/available-enrollments');
        setBusinesses(enrollRes.data.businesses || []);
        const dashRes = await axios.get('/student/dashboard');
        setAlerts(dashRes.data?.alerts || []);
      } catch (error) {
        console.error('API Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
  };

  if (loading) return (
      <div className="flex h-[100dvh] items-center justify-center bg-gray-900">
          <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
          </div>
      </div>
  );

  return (
    <div className="min-h-[100dvh] w-full relative overflow-hidden font-sans text-white bg-[#060a14]">
      {/* Dedicated Fixed Hardware-Accelerated Wallpaper Layer (Eliminates jitter/gassi-gassi) */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity duration-300"
        style={{ 
          backgroundImage: `url(${getSecureImageUrl(bgImage)})`,
          transform: 'translate3d(0, 0, 0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
        }}
      />
      {/* Deep elegant dark frosted overlay to soften background noise & eliminate banding lines */}
      <div className="fixed inset-0 z-0 bg-black/50 pointer-events-none" />

      <div className="flex h-[100dvh] w-full relative z-10 overflow-hidden">
          
          <SidebarV2 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            sidebarOpen={sidebarOpen} 
            setSidebarOpen={setSidebarOpen} 
            handleLogout={handleLogout} 
            bgImage={getSecureImageUrl(bgImage)}
            setBgImage={handleBgChange}
          />

          <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 w-full lg:py-[20px] lg:pr-[20px] lg:pl-[20px]">
            
            {/* Top Navigation Bar - Clean Frosted Glass */}
            <header className="bg-black/30 backdrop-blur-2xl border-b lg:border border-white/20 lg:rounded-3xl px-3 sm:px-6 py-2.5 sm:py-4 lg:mb-[20px] flex items-center justify-between sticky top-0 lg:top-auto z-30 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
              <div className="flex items-center gap-3 sm:gap-4">
                  <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="lg:hidden text-white hover:bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 transition-all cursor-pointer"
                    aria-label="Open Navigation Menu"
                  >
                      <Menu size={22} />
                  </button>
                  <div>
                      <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                          Welcome Back
                      </h1>
                      <p className="hidden sm:block text-xs sm:text-sm text-white/80 font-medium">Let's continue your learning journey.</p>
                  </div>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-4">
                  {/* Quick Wallpaper Switcher Popover (Accessible on Mobile & Desktop) */}
                  <div className="relative" ref={wallpaperMenuRef}>
                      <button
                          type="button"
                          onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all duration-200 cursor-pointer text-xs font-bold ${
                              showWallpaperMenu 
                                  ? 'bg-white text-gray-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm'
                          }`}
                          title="Change Atmosphere Wallpaper"
                      >
                          <Sparkles size={14} className={showWallpaperMenu ? 'text-amber-500' : 'text-amber-400 animate-pulse'} />
                          <span className="hidden sm:inline">Wallpaper</span>
                      </button>

                      {showWallpaperMenu && (
                          <div className="absolute right-0 mt-2.5 w-64 bg-[#0a101d]/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-2 py-1.5 mb-1.5 border-b border-white/10 flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                                      <Sparkles size={12} className="text-amber-400" /> Wallpapers
                                  </span>
                                  <span className="text-[10px] text-white/50 font-medium">3 Vibes</span>
                              </div>
                              <div className="space-y-1">
                                  {wallpapers.map((w) => {
                                      const isSelected = bgImage?.includes(w.url) || bgImage === w.url;
                                      return (
                                          <button
                                              key={w.id}
                                              type="button"
                                              onClick={() => {
                                                  handleBgChange(w.url);
                                                  setShowWallpaperMenu(false);
                                              }}
                                              className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                                                  isSelected
                                                      ? 'bg-white/20 border border-white/40 shadow-sm'
                                                      : 'hover:bg-white/10 border border-transparent'
                                              }`}
                                          >
                                              <div 
                                                  className={`w-9 h-9 rounded-xl border-2 bg-cover bg-center shrink-0 shadow-sm ${
                                                      isSelected ? 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'border-white/30'
                                                  }`}
                                                  style={{ backgroundImage: `url(${w.url})` }}
                                              />
                                              <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-bold text-white leading-tight truncate">{w.label}</p>
                                                  <p className="text-[10px] text-white/60 truncate">{w.desc}</p>
                                              </div>
                                              {isSelected && (
                                                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow">
                                                      <Check size={12} strokeWidth={3} />
                                                  </div>
                                              )}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Notifications Bell */}
                  <div className="relative group cursor-pointer">
                      <div className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all shadow-sm">
                          <Bell size={18} className="text-white" />
                      </div>
                      {alerts.length > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-transparent animate-pulse shadow-lg"></div>
                      )}
                  </div>

                  <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

                  {/* Profile Summary */}
                  <div 
                      onClick={() => setActiveTab('profile')}
                      className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer hover:opacity-90 transition-opacity"
                      title="View Profile Settings"
                  >
                      <div className="hidden md:block text-right">
                          <p className="text-sm font-bold text-white drop-shadow-sm leading-tight">{currentUser.fName ? `${currentUser.fName} ${currentUser.lName || ''}`.trim() : 'Student Portal'}</p>
                          <p className="text-[10px] text-white/70 uppercase tracking-[0.15em] font-semibold">IMA Campus</p>
                      </div>
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 p-[2px] shadow-lg shrink-0">
                          <div className="w-full h-full rounded-full bg-[#0a0f1d] flex items-center justify-center overflow-hidden">
                              {headerProfilePic ? (
                                  <img 
                                      src={headerProfilePic} 
                                      alt="Profile" 
                                      className="w-full h-full object-cover" 
                                      onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = resolveAvatarUrl(null, currentUser.phone || currentUser.whatsapp, axios.defaults.baseURL);
                                      }}
                                  />
                              ) : (
                                  <span className="text-white font-black text-xs sm:text-sm">
                                      {currentUser.fName ? currentUser.fName.substring(0, 2).toUpperCase() : 'ST'}
                                  </span>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
            </header>

            {/* Main Content Area - Massive Clean Glass Panel */}
            <div className="flex-1 overflow-y-auto lg:rounded-3xl bg-black/20 backdrop-blur-2xl border-x border-t lg:border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] relative w-full custom-scrollbar">
              <div className="w-full min-h-full p-3 sm:p-6 md:p-8 lg:p-10 mx-auto transition-all duration-500">
                
                {activeTab !== 'home' && alerts.length > 0 && (
                    <div className="mb-10 space-y-4">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className={`p-5 rounded-2xl flex items-start gap-4 backdrop-blur-xl border shadow-lg relative overflow-hidden
                                ${alert.type === 'danger' ? 'bg-red-500/20 border-red-500/30' : alert.type === 'locked' ? 'bg-rose-500/20 border-rose-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                                
                                <div className={`p-3 rounded-xl shrink-0 bg-white/10 shadow-sm ${alert.type === 'danger' ? 'text-red-300' : alert.type === 'locked' ? 'text-rose-300' : 'text-amber-300'}`}>
                                  {alert.type === 'danger' && <AlertTriangle size={24} />}
                                  {alert.type === 'locked' && <Lock size={24} />}
                                  {alert.type === 'warning' && <Info size={24} />}
                                </div>
                                <div className="pt-0.5">
                                    <h4 className={`font-bold uppercase tracking-wider text-sm mb-1 ${alert.type === 'locked' ? 'text-rose-200' : alert.type === 'danger' ? 'text-red-200' : 'text-amber-200'}`}>
                                        {alert.type === 'locked' ? 'Action Required' : 'Notice'}
                                    </h4>
                                    <p className="text-base font-medium text-white/90 leading-relaxed">{alert.msg}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="w-full min-h-full relative">
                    
                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'home' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <StudentOverview setActiveTab={setActiveTab} />
                    </div>

                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'courses' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <EnrollmentTab businesses={businesses} setActiveTab={setActiveTab} />
                    </div>

                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'history' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <PaymentHistory />
                    </div>

                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'mycourses' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <MyClassroom setActiveTab={setActiveTab} />
                    </div>

                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'delivery' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <DeliveryHub />
                    </div>

                    <div className={`transition-all duration-500 ease-in-out ${activeTab === 'profile' ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible h-0 overflow-hidden absolute'}`}>
                        <ProfileSettings />
                    </div>

                </div>
                
              </div>
            </div>
          </main>
      </div>
      <WebInquiryWidget businesses={businesses} setActiveTab={setActiveTab} />
    </div>
  );
};

export default StudentDashboardV2;

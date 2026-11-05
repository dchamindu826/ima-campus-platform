import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalToolsMenu from '../GlobalToolsMenu';
import { useTheme } from '../../contexts/ThemeContext';

export default function MainLayout({ loggedInUser, handleLogout }) {
  const location = useLocation();
  const isSocialMedia = location.pathname.includes('/social-media') || location.pathname.includes('/workspace/social-media-delegation');

  const { appTheme, setAppTheme, isDarkMode, toggleThemeMode, bgImage, setBgImage } = useTheme();

  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  const getZoomLevel = () => {
    if (window.innerWidth <= 1024) return 0.75;
    if (window.innerWidth <= 1280) return 0.85;
    if (window.innerWidth <= 1440) return 0.9;
    return 1;
  };
  const [zoomLevel, setZoomLevel] = useState(getZoomLevel());

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 1024);
      setZoomLevel(getZoomLevel());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getBackgroundStyle = () => {
    let liveSkyStyle = {};
    if (bgImage === 'anim1') {
        if (currentHour >= 6 && currentHour < 8) {
            liveSkyStyle = { background: 'linear-gradient(to bottom, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' };
        } else if (currentHour >= 8 && currentHour < 17) {
            liveSkyStyle = { background: 'linear-gradient(to bottom, #4facfe 0%, #00f2fe 100%)' };
        } else if (currentHour >= 17 && currentHour < 19) {
            liveSkyStyle = { background: 'linear-gradient(to bottom, #fa709a 0%, #fee140 100%)' };
        } else {
            liveSkyStyle = { background: 'linear-gradient(to bottom, #0B101E, #1A1A2E, #16213E)' };
        }
    }

    const themes = {
      color1: { background: '#60A5FA' }, 
      color2: { background: '#A78BFA' }, 
      color3: { background: '#D946EF' }, 
      
      grad1: { background: 'linear-gradient(135deg, #1E40AF 0%, #B91C1C 100%)' }, 
      grad2: { background: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)' }, 
      grad3: { background: 'linear-gradient(135deg, #374151 0%, #EF4444 100%)' }, 
      
      anim1: liveSkyStyle,
      anim2: {}, 
      anim3: { background: '#0F172A' }, 

      wall1: { backgroundImage: "url('/bg1.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' },
      wall2: { backgroundImage: "url('/bg2.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' },
      wall3: { backgroundImage: "url('/bg3.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' },
      wall4: { backgroundImage: "url('/bg4.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' },
      wall5: { backgroundImage: "url('/bg5.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' },
    };
    return themes[bgImage] || themes['wall1'];
  };

  const getBackgroundClass = () => {
    if (bgImage === 'anim2') return 'bg-anim-color-shift'; 
    return '';
  };

  const isModernTheme = appTheme === 'modern';

  return (
    <div 
      className={`font-sans flex items-center justify-center w-full overflow-hidden antialiased transition-colors duration-150 fixed inset-0 m-0 p-0 ${
        isModernTheme 
          ? (isDarkMode ? 'bg-[#090D16] text-slate-100' : 'bg-slate-50 text-slate-900')
          : getBackgroundClass()
      }`} 
      style={{ ...(isModernTheme ? {} : getBackgroundStyle()), zoom: zoomLevel }}
    >
      
      {/* ⛅ LIVE SKY ANIMATION (Classic theme only) */}
      {!isModernTheme && bgImage === 'anim1' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {currentHour >= 6 && currentHour <= 18 ? (
            <div className="absolute rounded-full bg-gradient-to-br from-yellow-100 to-orange-400 w-32 h-32 blur-[2px]"
                 style={{
                   top: `${10 + Math.abs(currentHour - 12) * 6}%`, 
                   left: `${((currentHour - 6) / 12) * 90}%`,
                   boxShadow: '0 0 120px 40px rgba(255, 165, 0, 0.6)',
                   transition: 'all 2s ease-in-out'
                 }}
            />
          ) : (
            <div className="absolute rounded-full bg-white w-24 h-24 blur-[1px] shadow-[0_0_80px_20px_rgba(255,255,255,0.4)] top-[20%] right-[15%] animate-[pulse_4s_ease-in-out_infinite]" />
          )}
        </div>
      )}

      {/* 🎾 FLOATING BALLS ANIMATION (Classic theme only) */}
      {!isModernTheme && bgImage === 'anim3' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-500/20 blur-[80px] animate-float-ball-1"></div>
            <div className="absolute w-[350px] h-[350px] rounded-full bg-purple-500/20 blur-[80px] animate-float-ball-2"></div>
            <div className="absolute w-[450px] h-[450px] rounded-full bg-emerald-500/20 blur-[80px] animate-float-ball-3"></div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className={`overflow-hidden relative z-10 flex ${
        isModernTheme
          ? `w-full h-full ${isDarkMode ? 'bg-[#090D16] text-slate-100' : 'bg-slate-50 text-slate-900'}`
          : 'w-full h-full sm:w-[98%] sm:h-[96vh] bg-[#0B101E]/90 sm:bg-black/40 border border-white/10 text-gray-100 sm:rounded-[20px]'
      }`}>
        <Sidebar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          userRole={loggedInUser?.role} 
          loggedInUser={loggedInUser} 
          handleLogout={handleLogout}
          currentBg={bgImage}
          setBgImage={setBgImage}
          isSocialMedia={isSocialMedia}
          isDarkMode={isDarkMode}
          toggleThemeMode={toggleThemeMode}
          appTheme={appTheme}
          setAppTheme={setAppTheme}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-transparent">
          <div className={`flex-1 overflow-auto p-4 lg:p-6 relative custom-scrollbar ${
            isModernTheme ? (isDarkMode ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]') : ''
          }`} style={{ WebkitOverflowScrolling: 'touch' }}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Tools Menu (Chat & Settings Widgets) */}
      <GlobalToolsMenu loggedInUser={loggedInUser} />
    </div>
  );
}
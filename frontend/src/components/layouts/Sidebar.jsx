import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { physicalCrmService } from '../../api/physicalCrm';
import {
  LayoutDashboard, Users, MonitorPlay, LogOut, HeadphonesIcon,
  Wallet, MessageCircle, Database, Truck, Package, Clock, CheckCircle,
  Archive, HardDrive, CalendarDays, CalendarCheck, CheckSquare, History,
  Music, Palette, ChevronLeft, ChevronRight, Megaphone, X, BarChart, PieChart, Calendar, Menu,
  PhoneCall, UserPlus, Repeat, GraduationCap, TrendingUp, Box, Activity, ShieldCheck, RefreshCw, Layers, Mic, Upload, Video, Sun, Moon, Sparkles, Wand2, Send,
  BrainCircuit, MessageSquareText, BookOpen, Bot, Briefcase, Trophy, CreditCard, Search, Receipt
} from 'lucide-react';

export default function Sidebar({ loggedInUser, handleLogout, isSidebarOpen, setIsSidebarOpen, currentBg, setBgImage, isDarkMode, toggleThemeMode, appTheme = 'classic', setAppTheme }) {
  const location = useLocation();
  const displayName = loggedInUser?.firstName || 'User';
  const rawRole = loggedInUser?.role || 'Staff';
  const roleName = loggedInUser?.department === 'Physical' ? 'Staff' : rawRole;

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [todayClasses, setTodayClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [profilePic, setProfilePic] = useState(null);
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search, Escape to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!isSidebarOpen) {
          setIsSidebarOpen(true);
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, setIsSidebarOpen]);

  const isModern = appTheme === 'modern';

  const handleSyncData = () => {
    setIsSyncing(true);
    window.dispatchEvent(new Event('global-refresh'));
    toast.success('Live database synced!', { position: 'top-right' });
    setTimeout(() => setIsSyncing(false), 900);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Show local preview immediately
      const imageUrl = URL.createObjectURL(file);
      setProfilePic(imageUrl);
      
      // Upload to server
      const formData = new FormData();
      formData.append('image', file);
      
      try {
        setUploadingImage(true);
        const res = await api.post('/admin/staff/profile-picture', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          toast.success("Profile picture updated successfully!");
          // Update the loggedInUser context or local state with actual server URL
          let baseApiUrl = (api.defaults && api.defaults.baseURL) 
              ? api.defaults.baseURL.replace('/api', '') 
              : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
          if (!baseApiUrl || baseApiUrl === '') {
              baseApiUrl = 'http://localhost:5000'; // fallback
          }
          const serverUrl = baseApiUrl + res.data.image;
          setProfilePic(serverUrl);

          // IMPORTANT: Update local storage so the image persists on page refresh
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              parsedUser.image = res.data.image;
              localStorage.setItem('user', JSON.stringify(parsedUser));
            } catch (e) {
              console.error('Error updating user in local storage', e);
            }
          }
        }
      } catch (err) {
        console.error("Profile picture upload failed", err);
        toast.error("Failed to upload profile picture");
      } finally {
        setUploadingImage(false);
      }
    }
  };

  useEffect(() => {
    const fetchTodayClasses = async () => {
      try {
        const [classesRes, teachersRes] = await Promise.all([
          physicalCrmService.getClasses(),
          physicalCrmService.getTeachers()
        ]);
        const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });

        const slots = [];

        // 1. From Classes
        (classesRes || []).forEach(cls => {
          if (cls.timetables) {
            cls.timetables.forEach(slot => {
              if (slot.dayOfWeek === todayStr) {
                const teacherNameStr = cls.teachers && cls.teachers.length > 0
                  ? cls.teachers.map(t => t.name).join(', ')
                  : 'No Teacher Assigned';
                slots.push({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  teacherName: teacherNameStr,
                  className: `${cls.name} (${cls.grade})`,
                });
              }
            });
          }
        });

        // 2. From direct teacher timetables (if any)
        (teachersRes || []).forEach(teacher => {
          if (teacher.timetables) {
            teacher.timetables.forEach(slot => {
              if (slot.dayOfWeek === todayStr && !slot.classId) {
                let classNameStr = 'Unassigned Class';
                if (teacher.classes && teacher.classes.length > 0) {
                  classNameStr = teacher.classes.map(c => c.name).join(', ');
                }
                slots.push({
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  teacherName: teacher.name,
                  className: classNameStr,
                });
              }
            });
          }
        });

        slots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        setTodayClasses(slots);
      } catch (err) {
        console.error('Failed to load classes', err);
      } finally {
        setLoadingClasses(false);
      }
    };
    if (loggedInUser?.department === 'Physical') {
      fetchTodayClasses();
    }
    
    if (loggedInUser?.image) {
        let baseApiUrl = (api.defaults && api.defaults.baseURL) 
            ? api.defaults.baseURL.replace('/api', '') 
            : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
        if (!baseApiUrl || baseApiUrl === '') {
            baseApiUrl = 'http://localhost:5000'; // fallback
        }
        setProfilePic(baseApiUrl + loggedInUser.image);
    }
  }, [loggedInUser]);

  const getNavLinkClass = ({ isActive }) => {
    const layout = isSidebarOpen ? 'space-x-3 px-3' : 'justify-center px-0';
    if (isModern) {
      if (isDarkMode) {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-600/15 border-2 border-blue-500 text-blue-400 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-[#0F172A]/70 hover:bg-[#1E293B] border border-slate-800/90 hover:border-slate-700 text-slate-200 hover:text-white font-semibold shadow-xs transition-colors mb-1.5`;
      } else {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-50 border-2 border-blue-600 text-blue-600 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold shadow-xs transition-colors mb-1.5`;
      }
    }
    return isActive 
      ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/20 border-2 border-white/40 text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)] mb-1.5 transition-colors`
      : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200 font-medium mb-1.5 transition-colors`;
  };

  const getQueryNavLinkClass = (mode) => {
    const isActive = location.pathname === '/coordinator/dashboard' && location.search.includes(`mode=${mode}`);
    const layout = isSidebarOpen ? 'space-x-3 px-3' : 'justify-center px-0';
    if (isModern) {
      if (isDarkMode) {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-600/15 border-2 border-blue-500 text-blue-400 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-[#0F172A]/70 hover:bg-[#1E293B] border border-slate-800/90 hover:border-slate-700 text-slate-200 hover:text-white font-semibold shadow-xs transition-colors mb-1.5`;
      } else {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-50 border-2 border-blue-600 text-blue-600 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold shadow-xs transition-colors mb-1.5`;
      }
    }
    return isActive 
      ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/20 border-2 border-white/40 text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)] mb-1.5 transition-colors`
      : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200 font-medium mb-1.5 transition-colors`;
  };

  const getTabLinkClass = (tabName) => {
    const queryParams = new URLSearchParams(location.search);
    let defaultTab = 'overview';
    if (location.pathname.includes('/social-media/staff')) defaultTab = 'tasks';
    const activeTab = queryParams.get('tab') || defaultTab;
    const isDelivery = location.pathname.includes('/delivery/dashboard');
    const isSocialMedia = location.pathname.includes('/social-media/');
    const isPhysical = location.pathname.includes('/physical/');
    const isActive = activeTab === tabName && (isDelivery || isSocialMedia || isPhysical);
    const layout = isSidebarOpen ? 'space-x-3 px-3' : 'justify-center px-0';

    if (isModern) {
      if (isDarkMode) {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-600/15 border-2 border-blue-500 text-blue-400 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-[#0F172A]/70 hover:bg-[#1E293B] border border-slate-800/90 hover:border-slate-700 text-slate-200 hover:text-white font-semibold shadow-xs transition-colors mb-1.5`;
      } else {
        return isActive 
          ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-blue-50 border-2 border-blue-600 text-blue-600 font-bold shadow-xs transition-colors mb-1.5`
          : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-semibold shadow-xs transition-colors mb-1.5`;
      }
    }
    return isActive 
      ? `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/20 border-2 border-white/40 text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)] mb-1.5 transition-colors`
      : `w-full flex items-center ${layout} py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-200 font-medium mb-1.5 transition-colors`;
  };

  const getIconColorClass = (color) => {
    if (isModern && !isDarkMode) {
      switch (color) {
        case 'blue': return 'text-blue-600';
        case 'cyan': return 'text-cyan-600';
        case 'amber': return 'text-amber-600';
        case 'emerald': return 'text-emerald-600';
        case 'teal': return 'text-teal-600';
        case 'red': return 'text-rose-600';
        case 'purple': return 'text-purple-600';
        case 'rose': return 'text-rose-600';
        case 'orange': return 'text-orange-600';
        case 'yellow': return 'text-amber-600';
        case 'pink': return 'text-pink-600';
        case 'indigo': return 'text-indigo-600';
        case 'fuchsia': return 'text-fuchsia-600';
        default: return 'text-slate-600';
      }
    }
    switch (color) {
      case 'blue': return 'text-blue-400';
      case 'cyan': return 'text-cyan-400';
      case 'amber': return 'text-amber-400';
      case 'emerald': return 'text-emerald-400';
      case 'teal': return 'text-teal-400';
      case 'red': return 'text-red-400';
      case 'purple': return 'text-purple-400';
      case 'rose': return 'text-rose-400';
      case 'orange': return 'text-orange-400';
      case 'yellow': return 'text-yellow-400';
      case 'pink': return 'text-pink-400';
      case 'indigo': return 'text-indigo-400';
      case 'fuchsia': return 'text-fuchsia-400';
      default: return 'text-gray-400';
    }
  };

  const renderSectionHeader = (title, isFirst = false) => {
    if (!title) return null;
    if (!isSidebarOpen) {
      return (
        <div className={`my-2 mx-1 border-t ${
          isModern 
            ? (isDarkMode ? 'border-slate-800' : 'border-slate-200') 
            : 'border-white/10'
        }`} />
      );
    }
    return (
      <div className={`flex items-center gap-2 px-1 ${isFirst ? 'mb-2' : 'pt-3 mb-2'}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isModern 
            ? (isDarkMode ? 'bg-blue-400' : 'bg-blue-600') 
            : 'bg-purple-400'
        }`} />
        <span className={`text-[10.5px] font-black uppercase tracking-wider shrink-0 ${
          isModern 
            ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') 
            : 'text-gray-300'
        }`}>
          {title}
        </span>
        <div className={`flex-1 h-[1px] ${
          isModern 
            ? (isDarkMode ? 'bg-slate-800/80' : 'bg-slate-200/90') 
            : 'bg-white/10'
        }`} />
      </div>
    );
  };

  let totalMatches = 0;

  const flattenChildren = (nodes) => {
    const list = [];
    React.Children.forEach(nodes, (child) => {
      if (!child) return;
      if (child.type === React.Fragment) {
        list.push(...flattenChildren(child.props?.children));
      } else {
        list.push(child);
      }
    });
    return list;
  };

  const getElementText = (node) => {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getElementText).join(' ');
    if (React.isValidElement(node)) {
      let text = '';
      if (node.props?.to) text += ' ' + node.props.to;
      if (node.props?.title) text += ' ' + node.props.title;
      if (typeof node.props?.children === 'function') {
        try {
          text += ' ' + getElementText(node.props.children({ isActive: false }));
        } catch (e) {}
      } else if (node.props?.children) {
        text += ' ' + getElementText(node.props.children);
      }
      return text;
    }
    return '';
  };

  const renderSectionBlock = (title, children, isFirst = false) => {
    const cleanQuery = searchQuery.trim().toLowerCase();
    let itemsToRender = children;

    if (cleanQuery) {
      const flatItems = flattenChildren(children);
      const titleMatches = title && title.toLowerCase().includes(cleanQuery);

      if (titleMatches) {
        itemsToRender = flatItems;
      } else {
        itemsToRender = flatItems.filter((item) => {
          const itemText = getElementText(item).toLowerCase();
          return itemText.includes(cleanQuery);
        });
      }

      if (itemsToRender.length === 0) {
        return null;
      }
    }

    const count = Array.isArray(itemsToRender) 
      ? itemsToRender.length 
      : (itemsToRender ? 1 : 0);
    totalMatches += count;

    return (
      <div className={isFirst ? "mb-1.5" : "mb-1.5"}>
        {renderSectionHeader(title, isFirst)}
        <div className="flex flex-col">
          {itemsToRender}
        </div>
      </div>
    );
  };


  const roleUpper = (roleName || '').toUpperCase().replace(/[\s_-]+/g, '_');
  const isPaperGuider = roleUpper === 'PAPER_GUIDER' || roleName === 'Paper Guider';
  const isLecture = (roleUpper === 'LECTURE' || roleUpper === 'LECTURER' || roleName === 'Lecture') && !isPaperGuider;
  const isLectureOrGuider = isLecture || isPaperGuider;
  const isPaperMarker = roleUpper === 'PAPER_MARKER' || roleName === 'Paper Marker';

  const isSystemAdmin = roleName === 'SYSTEM_ADMIN' || roleName === 'System Admin' || roleName === 'Director' || roleName === 'SUPER' || roleName === 'ADMIN';
  const isDeliveryDept = loggedInUser?.department === 'Delivery';
  const isFinanceDept = String(loggedInUser?.department || '').trim().toUpperCase() === 'FINANCE' || String(loggedInUser?.role || '').trim().toUpperCase() === 'FINANCE' || roleUpper === 'FINANCE';
  const isPhysicalDept = loggedInUser?.department === 'Physical';
  const isManagerRole = roleUpper === 'MANAGER' || roleUpper === 'ASS_MANAGER' || roleUpper === 'ASSISTANT_MANAGER' || roleUpper.includes('MANAGER');
  const isManager = isManagerRole && !isDeliveryDept && !isFinanceDept && !isPhysicalDept && !isLectureOrGuider && !isPaperMarker;
  const isCallCenterDept = loggedInUser?.department === 'Call Center';
  const isCallCenterManager = isManager && isCallCenterDept;

  const isSocialMediaManager = roleName === 'SOCIAL_MEDIA_MANAGER' || roleName === 'SOCIAL MEDIA MANAGER' || roleName === 'Social Media Manager' || (isManager && loggedInUser?.department === 'Social Media');
  const isSocialMediaStaff = roleName === 'SOCIAL_MEDIA_STAFF' || roleName === 'SOCIAL MEDIA STAFF' || roleName === 'Social Media Staff' || (roleName === 'STAFF' && loggedInUser?.department === 'Social Media');

  const isGeneralManager = isManager && !isCallCenterDept && !isSocialMediaManager && !isLectureOrGuider && !isPaperMarker;
  const isClassCoordinatorManager = isManager && loggedInUser?.department === 'Class Coordination';
  const isPhysicalManager = isPhysicalDept;
  const isHeadManager = (roleUpper === 'MANAGER' || roleName === 'Manager') && !isCallCenterManager && !isSocialMediaManager && !isPhysicalManager && !isLectureOrGuider && !isPaperMarker;
  const isCaller = roleName === 'CALLER' || roleName === 'Caller';
  const isCallCenterAgent = roleName === 'CALL_CENTER_AGENT' || roleName === 'Call Center Agent';
  const isStaff = !isSystemAdmin && !isManager && !isPhysicalManager && !isDeliveryDept && !isFinanceDept && !isCaller && !isCallCenterAgent && !isSocialMediaManager && !isSocialMediaStaff && !isLectureOrGuider && !isPaperMarker && roleName !== 'STUDENT' && roleName !== 'user';
  const isStudent = roleName === 'STUDENT' || roleName === 'user';

  return (
    <>
      {/* MOBILE FLOATING MENU BUTTON */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className="lg:hidden fixed top-3 left-3 z-[80] bg-brand-accent/90 hover:bg-brand-accent text-white px-3 py-2 rounded-xl border border-white/20 shadow-xl flex items-center gap-2 transition-all active:scale-95 outline-none backdrop-blur-md"
          title="Open Menu"
        >
          <Menu size={18} />
          <span className="text-xs font-extrabold uppercase tracking-wider">Menu</span>
        </button>
      )}

      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside className={`transition-[width,transform] duration-200 ease-in-out flex flex-col h-full max-h-screen
        fixed inset-y-0 left-0 z-[100] w-64 shadow-2xl lg:shadow-none lg:static lg:z-20
        ${isModern 
          ? (isDarkMode 
              ? 'bg-[#090D16] border-r border-slate-800 text-slate-200' 
              : 'bg-[#F8FAFC] border-r border-slate-200 text-slate-800 shadow-sm'
            )
          : 'bg-black/10 border-r border-white/20 bg-[#090E17]/95 backdrop-blur-2xl lg:backdrop-blur-none lg:bg-black/10 text-gray-100'
        }
        ${isSidebarOpen ? 'translate-x-0 lg:w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
      `}>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute -right-3 top-6 border p-1.5 lg:p-1 rounded-full z-50 transition-colors shadow-lg ${
            isModern 
              ? (isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-md')
              : 'bg-brand-accent/90 lg:bg-white/10 border-white/20 backdrop-blur-md text-white hover:bg-white/20'
          }`}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="h-14 flex items-center px-4 space-x-2 w-full absolute top-0 left-0 z-30">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] shadow-sm cursor-pointer hover:opacity-80"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] shadow-sm cursor-pointer hover:opacity-80"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] shadow-sm cursor-pointer hover:opacity-80"></div>
        </div>

        <div className={`h-20 mt-8 mb-4 flex items-center justify-center w-full relative z-10 transition-all`}>
          {isSidebarOpen ? (
            <img src="/logo.png" alt="Company Logo" className="w-34 h-auto object-contain drop-shadow-lg" />
          ) : (
            <img src="/favicon.svg" alt="Icon" className="w-8 h-8 object-contain drop-shadow-md" />
          )}
        </div>

        {/* TOP OF SIDEBAR: SEARCH BAR */}
        <div className={`px-3 mb-1 shrink-0 transition-all ${isSidebarOpen ? 'w-full' : 'flex justify-center'}`}>
          {isSidebarOpen ? (
            <div className="relative w-full">
              <Search 
                size={14} 
                className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  isModern 
                    ? (isDarkMode ? 'text-slate-400' : 'text-slate-400') 
                    : 'text-white/60'
                }`} 
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu... (Ctrl+K)"
                className={`w-full pl-8.5 pr-8 py-2 text-xs rounded-xl border transition-all outline-none font-medium ${
                  isModern
                    ? (isDarkMode 
                        ? 'bg-[#0F172A]/90 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' 
                        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 shadow-xs')
                    : 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/40 focus:bg-white/15 backdrop-blur-md'
                }`}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                    isModern 
                      ? (isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700') 
                      : 'hover:bg-white/20 text-white/60 hover:text-white'
                  }`}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              ) : (
                <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none ${
                  isModern 
                    ? (isDarkMode ? 'bg-slate-800/80 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200') 
                    : 'bg-white/10 text-white/50 border border-white/10'
                }`}>
                  ⌘K
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 80);
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center outline-none ${
                isModern
                  ? (isDarkMode 
                      ? 'bg-[#0F172A]/70 hover:bg-[#1E293B] border-slate-800 text-slate-400 hover:text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 shadow-xs')
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
              }`}
              title="Search menu (Ctrl+K)"
            >
              <Search size={16} />
            </button>
          )}
        </div>

        <nav onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} className="flex-1 min-h-0 px-3 pt-0.5 pb-2 space-y-1 overflow-y-auto custom-scrollbar">
        {/* PAPER GUIDER PORTAL MENU (Dedicated Paper & Ranking Hub) */}
        {isPaperGuider && (
          renderSectionBlock('Paper Guider Portal', (
            <>
              <NavLink to="/paper-guider/hub" className={getNavLinkClass}><Trophy size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Paper & Ranking Hub</span>}</NavLink>
              <NavLink to="/manager/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Academic Overview</span>}</NavLink>
            </>
          ), true)
        )}

        {/* LECTURE RESTRICTED MENU (Overview & Content Hub only) */}
        {isLecture && (
          renderSectionBlock('Academic Portal', (
            <>
              <NavLink to="/manager/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
              <NavLink to="/admin/content-hub" className={getNavLinkClass}><MonitorPlay size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Content Hub</span>}</NavLink>
            </>
          ), true)
        )}

        {/* PAPER MARKER PORTAL MENU (Overview, Paper Hub & Workplace) */}
        {isPaperMarker && (
          renderSectionBlock('Paper Marker Portal', (
            <>
              <NavLink to="/paper-guider/hub" className={getNavLinkClass}><Trophy size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Paper & Ranking Hub</span>}</NavLink>
              <NavLink to="/paper-marker/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
              <NavLink to="/paper-marker/workplace" className={getNavLinkClass}><Briefcase size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Workplace</span>}</NavLink>
            </>
          ), true)
        )}

        {isSystemAdmin && (
          <>
            {renderSectionBlock(null, (
              <NavLink to="/admin/dashboard" className={getNavLinkClass}>
                <LayoutDashboard size={18} className={getIconColorClass('blue')} /> 
                {isSidebarOpen && <span className="truncate text-sm font-semibold">Overview</span>}
              </NavLink>
            ), true)}

            {renderSectionBlock('AI Intelligence Suite', (
              <>
                <NavLink to="/admin/stats-hub" className={getNavLinkClass}>
                  <BrainCircuit size={18} className={getIconColorClass('cyan')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">LUMI AI Analyser</span>}
                </NavLink>
                <NavLink to="/admin/claude-opus" className={getNavLinkClass}>
                  <Sparkles size={18} className={`${getIconColorClass('amber')} animate-pulse`} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Claude Opus 5 Studio 🔥</span>}
                </NavLink>
                <NavLink to="/admin/sinhala-voice-agent" className={getNavLinkClass}>
                  <Mic size={18} className={`${getIconColorClass('emerald')} animate-pulse`} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Sinhala AI Call Agent 🎙️</span>}
                </NavLink>
                <NavLink to="/admin/yt-transcriber" className={getNavLinkClass}>
                  <Video size={18} className={getIconColorClass('red')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">YouTube Transcriber 🎬</span>}
                </NavLink>
                <NavLink to="/admin/ai-team" className={getNavLinkClass}>
                  <Bot size={18} className={getIconColorClass('purple')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">AI Dev Squad 🤖</span>}
                </NavLink>
                <NavLink to="/admin/ai-image-generator" className={getNavLinkClass}>
                  <Palette size={18} className={getIconColorClass('rose')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">LUMI Image Generator</span>}
                </NavLink>
              </>
            ))}

            {renderSectionBlock('Campus & Academics', (
              <>
                <NavLink to="/admin/staff" className={getNavLinkClass}>
                  <Users size={18} className={getIconColorClass('orange')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Staff Management</span>}
                </NavLink>
                <NavLink to="/admin/announcements" className={getNavLinkClass}>
                  <Megaphone size={18} className={getIconColorClass('yellow')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Announcements & Events</span>}
                </NavLink>
                <NavLink to="/admin/content-hub" className={getNavLinkClass}>
                  <MonitorPlay size={18} className={getIconColorClass('purple')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Content Hub</span>}
                </NavLink>
                <NavLink to="/paper-guider/hub" className={getNavLinkClass}>
                  <Trophy size={18} className={getIconColorClass('amber')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Paper & Ranking Hub</span>}
                </NavLink>
                <NavLink to="/admin/pusthakalaya" className={getNavLinkClass}>
                  <BookOpen size={18} className={getIconColorClass('amber')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">IMA පුස්තකාලය</span>}
                </NavLink>
              </>
            ))}

            {renderSectionBlock('Finance & Operations', (
              <>
                <NavLink to="/admin/payments" className={getNavLinkClass}>
                  <Wallet size={18} className={getIconColorClass('emerald')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Manage Payments</span>}
                </NavLink>
                <NavLink to="/petty-cash" className={getNavLinkClass}>
                  <Receipt size={18} className={getIconColorClass('amber')} /> 
                  {isSidebarOpen && <span className="truncate text-sm font-semibold">Petty Cash 💰</span>}
                </NavLink>
                <NavLink to="/admin/whatsapp-billing" className={getNavLinkClass}>
                  <CreditCard size={18} className={getIconColorClass('emerald')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">WhatsApp Billing 💳</span>}
                </NavLink>
                <NavLink to="/admin/finance-matrix" className={getNavLinkClass}>
                  <TrendingUp size={18} className={getIconColorClass('amber')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Finance Matrix</span>}
                </NavLink>
                <NavLink to="/admin/teacher-salary" className={getNavLinkClass}>
                  <GraduationCap size={18} className={getIconColorClass('purple')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Teachers Salary</span>}
                </NavLink>
                <NavLink to="/admin/teacher-salary-history" className={getNavLinkClass}>
                  <History size={18} className={getIconColorClass('cyan')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Salary Cycle History</span>}
                </NavLink>
                <NavLink to="/admin/data-export" className={getNavLinkClass}>
                  <BarChart size={18} className={getIconColorClass('cyan')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Data Analytics</span>}
                </NavLink>
                <NavLink to="/admin/student-center" className={getNavLinkClass}>
                  <Database size={18} className={getIconColorClass('teal')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Student Data Center</span>}
                </NavLink>
                <NavLink to="/admin/crm-setup" className={getNavLinkClass}>
                  <HeadphonesIcon size={18} className={getIconColorClass('pink')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">CRM Setup</span>}
                </NavLink>
                <NavLink to="/admin/database" className={getNavLinkClass}>
                  <HardDrive size={18} className={getIconColorClass('slate')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Database Manager</span>}
                </NavLink>
                <NavLink to="/admin/system-tasks" className={getNavLinkClass}>
                  <CheckSquare size={18} className={getIconColorClass('red')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">System Tasks & Issues</span>}
                </NavLink>
              </>
            ))}

            {renderSectionBlock('Logistics', (
              <>
                <NavLink to="/manager/tute-stock" className={getNavLinkClass}>
                  <Box size={18} className={getIconColorClass('amber')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Tute Stock & Calendar 📦</span>}
                </NavLink>
                <NavLink to="/delivery/dashboard?tab=overview" className={getNavLinkClass}>
                  <Truck size={18} className={getIconColorClass('blue')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Delivery Hub</span>}
                </NavLink>
                <NavLink to="/delivery/dashboard?tab=reports" className={getNavLinkClass}>
                  <BarChart size={18} className={getIconColorClass('pink')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Stock Reports</span>}
                </NavLink>
              </>
            ))}

            {renderSectionBlock('Development & Marketing', (
              <>
                <NavLink to="/workspace/social-media-delegation" className={getNavLinkClass}>
                  <Send size={18} className={getIconColorClass('indigo')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Social Media Job Cards</span>}
                </NavLink>
                <NavLink to="/admin/paid-campaign" className={getNavLinkClass}>
                  <Layers size={18} className={getIconColorClass('indigo')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Paid Campaign</span>}
                </NavLink>
                <NavLink to="/admin/call-campaign-data-center" className={getNavLinkClass}>
                  <Database size={18} className={getIconColorClass('emerald')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">Call Campaign Data Center</span>}
                </NavLink>
                <NavLink to="/social-media/manager/dashboard?tab=ai_video" className={getNavLinkClass}>
                  <Wand2 size={18} className={`${getIconColorClass('fuchsia')} animate-pulse`} /> 
                  {isSidebarOpen && <span className="truncate text-sm">AI Video Creator 🎬</span>}
                </NavLink>
                <NavLink to="/admin/whatsapp-call-test" className={getNavLinkClass}>
                  <PhoneCall size={18} className={getIconColorClass('emerald')} /> 
                  {isSidebarOpen && <span className="truncate text-sm">WhatsApp Call Test</span>}
                </NavLink>
              </>
            ))}
          </>
        )}

        {(isHeadManager && !isSystemAdmin) && (
          renderSectionBlock('Team Management', (
            <>
              <NavLink to="/admin/staff" className={getNavLinkClass}><Users size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Staff Management</span>}</NavLink>
              {!isDeliveryDept && (
                <>
                  <NavLink to="/workspace/social-media-delegation" className={getNavLinkClass}><Send size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Social Media Job Cards</span>}</NavLink>
                  <NavLink to="/admin/finance-matrix" className={getNavLinkClass}><TrendingUp size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Finance Matrix</span>}</NavLink>
                </>
              )}
            </>
          ))
        )}

        {isFinanceDept && !isSystemAdmin && (
          renderSectionBlock('Finance Department', (
            <>
              <NavLink to="/finance/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Finance Overview</span>}</NavLink>
              <NavLink to="/admin/payments" className={getNavLinkClass}><Wallet size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Manage Payments</span>}</NavLink>
              <NavLink to="/petty-cash" className={getNavLinkClass}><Receipt size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm font-semibold">Petty Cash 💰</span>}</NavLink>
              <NavLink to="/admin/whatsapp-billing" className={getNavLinkClass}><CreditCard size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm font-semibold">WhatsApp Billing 💳</span>}</NavLink>
              <NavLink to="/admin/data-export" className={getNavLinkClass}><BarChart size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">Data Analytics</span>}</NavLink>
              <NavLink to="/admin/teacher-salary" className={getNavLinkClass}><GraduationCap size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Teachers Salary</span>}</NavLink>
              <NavLink to="/finance/teacher-salary-history" className={getNavLinkClass}><History size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">Salary Cycle History</span>}</NavLink>
            </>
          ), true)
        )}

        {isDeliveryDept && !isSystemAdmin && (
          renderSectionBlock('Delivery', (
            <>
              <NavLink to="/delivery/dashboard?tab=overview" className={() => getTabLinkClass('overview')}><Package size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=pending" onClick={() => window.dispatchEvent(new CustomEvent('reset-pending-holds'))} className={() => getTabLinkClass('pending')}><Clock size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Pending & Holds</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=delivered" className={() => getTabLinkClass('delivered')}><CheckCircle size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Delivered</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=history" className={() => getTabLinkClass('history')}><History size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">History</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=payment_details" className={() => getTabLinkClass('payment_details')}><Wallet size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Payment Details</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=stock" className={() => getTabLinkClass('stock')}><Archive size={18} className={getIconColorClass('slate')} /> {isSidebarOpen && <span className="truncate text-sm">Tute Stock</span>}</NavLink>
              <NavLink to="/delivery/dashboard?tab=reports" className={() => getTabLinkClass('reports')}><BarChart size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">Stock Reports</span>}</NavLink>
            </>
          ), true)
        )}

        {isGeneralManager && (
          <>
            {renderSectionBlock('Management', (
              <>
                <NavLink to="/manager/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Branch Overview</span>}</NavLink>
                <NavLink to="/workspace/social-media-delegation" className={getNavLinkClass}><Send size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Social Media Job Cards</span>}</NavLink>
              </>
            ), true)}

            {renderSectionBlock('Academic & AI', (
              <>
                <NavLink to="/admin/stats-hub" className={getNavLinkClass}><Sparkles size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">LUMI AI Analyser</span>}</NavLink>
                <NavLink to="/admin/announcements" className={getNavLinkClass}><Megaphone size={18} className={getIconColorClass('yellow')} /> {isSidebarOpen && <span className="truncate text-sm">Announcements</span>}</NavLink>
                <NavLink to="/admin/content-hub" className={getNavLinkClass}><MonitorPlay size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Content Hub</span>}</NavLink>
                <NavLink to="/paper-guider/hub" className={getNavLinkClass}><Trophy size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Paper & Ranking Hub</span>}</NavLink>
                <NavLink to="/manager/pusthakalaya" className={getNavLinkClass}><BookOpen size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">IMA පුස්තකාලය</span>}</NavLink>
              </>
            ))}

            {renderSectionBlock('Finance & Operations', (
              <>
                {isClassCoordinatorManager && (
                  <NavLink to="/admin/crm-setup" className={getNavLinkClass}><HeadphonesIcon size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">CRM Setup</span>}</NavLink>
                )}
                <NavLink to="/admin/payments" className={getNavLinkClass}><Wallet size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Manage Payments</span>}</NavLink>
              <NavLink to="/petty-cash" className={getNavLinkClass}><Receipt size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm font-semibold">Petty Cash 💰</span>}</NavLink>
                <NavLink to="/admin/whatsapp-billing" className={getNavLinkClass}><CreditCard size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">WhatsApp Billing 💳</span>}</NavLink>
                <NavLink to="/admin/data-export" className={getNavLinkClass}><BarChart size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">Data Analytics</span>}</NavLink>
                <NavLink to="/admin/student-center" className={getNavLinkClass}><Database size={18} className={getIconColorClass('teal')} /> {isSidebarOpen && <span className="truncate text-sm">Student Data Center</span>}</NavLink>
                <NavLink to="/admin/teacher-salary" className={getNavLinkClass}><GraduationCap size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Teachers Salary</span>}</NavLink>
              <NavLink to="/finance/teacher-salary-history" className={getNavLinkClass}><History size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">Salary Cycle History</span>}</NavLink>
              </>
            ))}

            {renderSectionBlock('Logistics & Tutes', (
              <>
                <NavLink to="/manager/tute-stock" className={getNavLinkClass}><Box size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Tute Stock & Calendar 📦</span>}</NavLink>
                <NavLink to="/delivery/dashboard?tab=pending" onClick={() => window.dispatchEvent(new CustomEvent('reset-pending-holds'))} className={() => getTabLinkClass('pending')}><Clock size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Pending & Holds</span>}</NavLink>
                <NavLink to="/delivery/dashboard?tab=delivered" className={() => getTabLinkClass('delivered')}><CheckCircle size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Delivered</span>}</NavLink>
                <NavLink to="/delivery/dashboard?tab=history" className={() => getTabLinkClass('history')}><Activity size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Delivery History</span>}</NavLink>
                <NavLink to="/delivery/dashboard?tab=payment_details" className={() => getTabLinkClass('payment_details')}><Wallet size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Payment Details</span>}</NavLink>
                <NavLink to="/delivery/dashboard?tab=reports" className={getNavLinkClass}><BarChart size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">Stock Reports 📊</span>}</NavLink>
              </>
            ))}
          </>
        )}

        {isCallCenterManager && (
          <>
            {renderSectionBlock('Call Center Hub', (
              <>
                <NavLink to="/call-center/dashboard/overview" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('red')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
                <NavLink to="/call-center/dashboard/free-sem" className={getNavLinkClass}><PhoneCall size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Free Sem Stats</span>}</NavLink>
                <NavLink to="/call-center/dashboard/after-sem" className={getNavLinkClass}><BarChart size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">After Sem Stats</span>}</NavLink>
                <NavLink to="/call-center/dashboard/bridge-handovers" className={getNavLinkClass}><Repeat size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Bridge Hand Overs</span>}</NavLink>
                <NavLink to="/call-center/dashboard/bridge-progress" className={getNavLinkClass}><TrendingUp size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Bridge Call Progress</span>}</NavLink>
              </>
            ), true)}

            {renderSectionBlock('Team & Performance', (
              <>
                <NavLink to="/call-center/dashboard/staff" className={getNavLinkClass}><Users size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Staff Manage</span>}</NavLink>
                <NavLink to="/call-center/dashboard/progress" className={getNavLinkClass}><Activity size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">Callers Progress</span>}</NavLink>
              </>
            ))}
          </>
        )}

        {isPhysicalManager && (
          <>
            {renderSectionBlock('Physical Hub', (
              <NavLink to="/physical/dashboard/overview" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('red')} /> {isSidebarOpen && <span className="truncate text-sm">Physical Dashboard</span>}</NavLink>
            ), true)}

            {renderSectionBlock('Team Management', (
              <>
                <NavLink to="/admin/staff?dept=Physical" className={getNavLinkClass}><Users size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Staff Management</span>}</NavLink>
                <NavLink to="/workspace/social-media-delegation" className={getNavLinkClass}><Send size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Social Media Job Cards</span>}</NavLink>
              </>
            ))}

            {/* Today's Classes Widget */}
            {isSidebarOpen && !searchQuery.trim() && (
              <div className={`mt-3 mb-2 rounded-2xl overflow-hidden flex flex-col max-h-64 shadow-xs border ${
                isModern
                  ? (isDarkMode ? 'bg-[#0F172A]/80 border-slate-800' : 'bg-slate-100/80 border-slate-200')
                  : 'bg-black/20 border-white/10'
              }`}>
                <div className={`p-2.5 border-b flex items-center gap-2 shrink-0 ${
                  isModern
                    ? (isDarkMode ? 'bg-red-500/10 border-slate-800 text-red-400' : 'bg-red-50 border-slate-200 text-red-600')
                    : 'bg-gradient-to-r from-red-500/20 to-transparent border-white/5 text-white'
                }`}>
                  <Calendar size={14} className={isModern && !isDarkMode ? "text-red-600" : "text-red-400"} />
                  <h3 className={`font-black tracking-wider text-[10px] uppercase ${isModern && !isDarkMode ? 'text-slate-800' : 'text-white'}`}>TODAY'S CLASSES</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col gap-1.5">
                  {loadingClasses ? (
                    <div className="flex justify-center p-4">
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : todayClasses.length === 0 ? (
                    <div className="text-center p-4 text-slate-400">
                      <Clock size={16} className="mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">No Classes</span>
                    </div>
                  ) : (
                    todayClasses.map((slot, idx) => (
                      <div key={idx} className={`p-2 rounded-xl border transition-colors ${
                        isModern
                          ? (isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xs')
                          : 'bg-white/5 border-white/5 text-gray-300'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Clock size={10} className="text-red-400" />
                          <span className="text-[10px] font-black">{slot.startTime} - {slot.endTime}</span>
                        </div>
                        <p className="text-[10px] font-bold truncate">{slot.className}</p>
                        <p className="text-[9px] text-slate-500 truncate">{slot.teacherName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {isCallCenterAgent && (
          renderSectionBlock('Workspace', (
            <>
              <NavLink to="/call-center/agent/overview" className={getNavLinkClass}><PieChart size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
              <NavLink to="/call-center/agent/free-sem" className={getNavLinkClass}><Megaphone size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Free Seminar</span>}</NavLink>
              <NavLink to="/call-center/agent/after-sem" className={getNavLinkClass}><Calendar size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">After Seminar</span>}</NavLink>
              <NavLink to="/call-center/agent/bridge" className={getNavLinkClass}><Repeat size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Bridge Campaign</span>}</NavLink>
            </>
          ), true)
        )}

        {(isSystemAdmin || isGeneralManager || isStaff || isCaller) && (
          <>
            {renderSectionBlock('Workspace', (
              <>
                {(!isSystemAdmin && !isManager) && (
                  <NavLink to="/coordinator/dashboard?mode=OVERVIEW" className={() => getQueryNavLinkClass('OVERVIEW')}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
                )}
                <NavLink to="/workspace/timetable" className={getNavLinkClass}><CalendarDays size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Class Timetable</span>}</NavLink>
                <NavLink to="/workspace/tasks" className={getNavLinkClass}><CheckSquare size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Task Center</span>}</NavLink>
                <NavLink to="/workspace/roster" className={getNavLinkClass}><CalendarCheck size={18} className={getIconColorClass('pink')} />{isSidebarOpen && <span className="truncate text-sm">My Roster</span>}</NavLink>
                {(!isSystemAdmin && !isManager) && (
                  <NavLink to="/coordinator/pusthakalaya" className={getNavLinkClass}><BookOpen size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">IMA පුස්තකාලය</span>}</NavLink>
                )}
              </>
            ))}

            {renderSectionBlock('Free Seminar', (
              <>
                <NavLink to="/workspace/crm" className={getNavLinkClass}><MessageCircle size={18} className={getIconColorClass('cyan')} /> {isSidebarOpen && <span className="truncate text-sm">Free Seminar CRM</span>}</NavLink>
                {(!isSystemAdmin && !isManager) && (
                  <NavLink to="/coordinator/dashboard?mode=CALL_CAMPAIGN" className={() => getQueryNavLinkClass('CALL_CAMPAIGN')}><HeadphonesIcon size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Call Campaign</span>}</NavLink>
                )}
                {(isSystemAdmin || isManager) && (
                  <NavLink to="/coordinator/dashboard?mode=STATS" className={() => getQueryNavLinkClass('STATS')}><BarChart size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Free Sem Stats</span>}</NavLink>
                )}
              </>
            ))}

            {renderSectionBlock('Lumi Services', (
              <>
                <NavLink 
                  to="/admin/stats-hub" 
                  className={isModern ? getNavLinkClass : ({ isActive }) => `lumi-nav-item lumi-analyser mb-2 ${isActive ? 'active ring-1 ring-cyan-400/50' : ''}`}
                >
                  <BrainCircuit size={18} className={getIconColorClass('cyan')} />
                  {isSidebarOpen && <span className="truncate text-sm font-semibold">LUMI AI Analyser</span>}
                </NavLink>

                <NavLink 
                  to="/workspace/web-inquiries" 
                  className={isModern ? getNavLinkClass : ({ isActive }) => `lumi-nav-item lumi-chat mb-2 ${isActive ? 'active ring-1 ring-sky-400/50' : ''}`}
                >
                  <MessageSquareText size={18} className={getIconColorClass('cyan')} />
                  {isSidebarOpen && <span className="truncate text-sm font-semibold">LUMI Chat</span>}
                </NavLink>

                <NavLink 
                  to="/lumi-caller/dashboard" 
                  className={isModern ? getNavLinkClass : ({ isActive }) => `lumi-nav-item lumi-caller mb-2 ${isActive ? 'active ring-1 ring-emerald-400/50' : ''}`}
                >
                  <PhoneCall size={18} className={getIconColorClass('emerald')} />
                  {isSidebarOpen && <span className="truncate text-sm font-semibold">LUMI Caller</span>}
                </NavLink>

                {isSystemAdmin && (
                  <NavLink 
                    to="/admin/ai-image-generator" 
                    className={isModern ? getNavLinkClass : ({ isActive }) => `lumi-nav-item lumi-image mb-2 ${isActive ? 'active ring-1 ring-rose-400/50' : ''}`}
                  >
                    <Palette size={18} className={getIconColorClass('rose')} />
                    {isSidebarOpen && <span className="truncate text-sm font-semibold">LUMI Image Generator</span>}
                  </NavLink>
                )}
              </>
            ))}

            {renderSectionBlock('Other Services', (
              <>
                <NavLink to="/workspace/after-seminar-crm" className={getNavLinkClass}><HeadphonesIcon size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">After Seminar CRM</span>}</NavLink>
                <NavLink to="/admin/content-hub" className={getNavLinkClass}><MonitorPlay size={18} className={getIconColorClass('purple')} /> {isSidebarOpen && <span className="truncate text-sm">Content Hub</span>}</NavLink>
                <NavLink to="/admin/payments" className={getNavLinkClass}><Wallet size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Payment Management</span>}</NavLink>
              </>
            ))}

            {renderSectionBlock('Call Campaigns', (
              <>
                {(isSystemAdmin || isManager) && (
                  <NavLink to="/workspace/campaign/overview" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('red')} /> {isSidebarOpen && <span className="truncate text-sm">Campaign Overview</span>}</NavLink>
                )}
                <NavLink to="/workspace/campaign/open-seminar" className={getNavLinkClass}><PhoneCall size={18} className={getIconColorClass('indigo')} /> {isSidebarOpen && <span className="truncate text-sm">Open Seminar Leads</span>}</NavLink>
                <NavLink to="/workspace/campaign/new-inquiries" className={getNavLinkClass}><UserPlus size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">New Inquiries</span>}</NavLink>
                <NavLink to="/workspace/campaign/bridge-transfers" className={getNavLinkClass}><Repeat size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">Bridge Transfers</span>}</NavLink>
                <NavLink to="/workspace/campaign/paid-students" className={getNavLinkClass}><GraduationCap size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Enrolled (Paid)</span>}</NavLink>
                {(isSystemAdmin || isManager) && (
                  <NavLink to="/workspace/campaign/coordinator-progress" className={getNavLinkClass}><Activity size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">Coordinator Progress</span>}</NavLink>
                )}

                {!isSystemAdmin && !isManager && !isCaller && (
                  <NavLink to="/admin/student-center" className={getNavLinkClass}><Database size={18} className={getIconColorClass('teal')} /> {isSidebarOpen && <span className="truncate text-sm">Student Data Center</span>}</NavLink>
                )}
              </>
            ))}
          </>
        )}

        {isSocialMediaManager && (
          <>
            {renderSectionBlock('Social Media Hub', (
              <>
                <NavLink to="/social-media/manager/dashboard?tab=overview" className={() => getTabLinkClass('overview')}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">Overview</span>}</NavLink>
                <NavLink to="/social-media/manager/dashboard?tab=team" className={() => getTabLinkClass('team')}><Users size={18} className={getIconColorClass('orange')} /> {isSidebarOpen && <span className="truncate text-sm">Staff Manager</span>}</NavLink>
                <NavLink to="/social-media/manager/dashboard?tab=calendar" className={() => getTabLinkClass('calendar')}><Calendar size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Content Calendar</span>}</NavLink>
              </>
            ), true)}
            
            {renderSectionBlock('Creative Tools', (
              <>
                <NavLink to="/social-media/manager/dashboard?tab=ai_video" className={() => getTabLinkClass('ai_video')}><Wand2 size={18} className={getIconColorClass('fuchsia')} /> {isSidebarOpen && <span className="truncate text-sm">AI Video Generator 🎬</span>}</NavLink>
                <NavLink to="/social-media/manager/dashboard?tab=ai_music_matcher" className={() => getTabLinkClass('ai_music_matcher')}><Music size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">AI Reel Music Finder 🎵</span>}</NavLink>
                <NavLink to="/social-media/manager/dashboard?tab=video_editor" className={() => getTabLinkClass('video_editor')}><Video size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">AI Subtitle Video Editor</span>}</NavLink>
              </>
            ))}
          </>
        )}

        {isSocialMediaStaff && (
          <>
            {renderSectionBlock('Workspace', (
              <>
                <NavLink to="/social-media/staff/dashboard?tab=tasks" className={() => getTabLinkClass('tasks')}><CheckSquare size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">My Assigned Tasks</span>}</NavLink>
                <NavLink to="/social-media/staff/dashboard?tab=calendar" className={() => getTabLinkClass('calendar')}><Calendar size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">Content Calendar</span>}</NavLink>
              </>
            ), true)}

            {renderSectionBlock('Creative Tools', (
              <>
                <NavLink to="/social-media/staff/dashboard?tab=ai_video" className={() => getTabLinkClass('ai_video')}><Wand2 size={18} className={getIconColorClass('fuchsia')} /> {isSidebarOpen && <span className="truncate text-sm">AI Video Generator 🎬</span>}</NavLink>
                <NavLink to="/social-media/staff/dashboard?tab=ai_music_matcher" className={() => getTabLinkClass('ai_music_matcher')}><Music size={18} className={getIconColorClass('amber')} /> {isSidebarOpen && <span className="truncate text-sm">AI Reel Music Finder 🎵</span>}</NavLink>
                <NavLink to="/social-media/staff/dashboard?tab=video_editor" className={() => getTabLinkClass('video_editor')}><Video size={18} className={getIconColorClass('pink')} /> {isSidebarOpen && <span className="truncate text-sm">AI Subtitle Video Editor</span>}</NavLink>
              </>
            ))}
          </>
        )}

        {isStudent && (
          renderSectionBlock('Student Portal', (
            <>
              <NavLink to="/student/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} className={getIconColorClass('blue')} /> {isSidebarOpen && <span className="truncate text-sm">My Dashboard</span>}</NavLink>
              <NavLink to="/student/delivery" className={getNavLinkClass}><Truck size={18} className={getIconColorClass('emerald')} /> {isSidebarOpen && <span className="truncate text-sm">My Deliveries</span>}</NavLink>
            </>
          ), true)
        )}

        {/* NO RESULTS FALLBACK */}
        {searchQuery.trim() && totalMatches === 0 && (
          <div className="py-10 px-3 text-center flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2.5 border ${
              isModern 
                ? (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500') 
                : 'bg-white/10 border-white/20 text-white/70'
            }`}>
              <Search size={18} />
            </div>
            <p className={`text-xs font-bold ${
              isModern ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : 'text-white'
            }`}>
              No items found
            </p>
            <p className={`text-[11px] mt-0.5 max-w-[170px] truncate ${
              isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-white/60'
            }`}>
              for "{searchQuery}"
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer active:scale-95"
            >
              Clear Search
            </button>
          </div>
        )}
      </nav>

      {/* Theme Popup & Profile Section */}
      <div className={`px-3 py-3 border-t flex ${isSidebarOpen ? 'flex-row items-center justify-between' : 'flex-col items-center'} gap-2 shrink-0 relative ${
        isModern ? (isDarkMode ? 'border-slate-800 bg-[#0B0F19]' : 'border-slate-200 bg-slate-50/50') : 'border-white/20 bg-transparent'
      }`}>
        <div className={`flex ${isSidebarOpen ? 'flex-row' : 'flex-col'} items-center gap-1.5`}>
          {/* Dark / Light Toggle */}
          <button 
            onClick={toggleThemeMode} 
            className={`p-2.5 rounded-full transition-all flex items-center justify-center outline-none border ${
              isModern
                ? (isDarkMode 
                    ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-sm')
                : (isDarkMode 
                    ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' 
                    : 'bg-slate-200 text-slate-900 border-slate-300 hover:bg-slate-300')
            }`} 
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Theme Palette */}
          <button 
            onClick={() => setIsThemeOpen(!isThemeOpen)} 
            className={`p-2.5 rounded-full transition-all flex items-center justify-center outline-none border ${
              isThemeOpen 
                ? (isModern ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-white/20 text-white border-white/30 shadow-[0_4px_15px_rgba(0,0,0,0.2)]') 
                : (isModern 
                    ? (isDarkMode ? 'text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white' : 'text-slate-600 border-slate-200 hover:bg-slate-100')
                    : 'text-gray-300 border-transparent hover:bg-white/10')
            }`} 
            title="Themes & Styles"
          >
            <Palette size={16} className={isThemeOpen ? (isModern ? 'text-white' : 'text-brand-accent') : ''} />
          </button>

          {/* Refresh / Live Sync Icon (Replaces Audio Button) */}
          <button 
            onClick={handleSyncData} 
            disabled={isSyncing}
            className={`p-2.5 rounded-full transition-all flex items-center justify-center outline-none border ${
              isModern 
                ? (isDarkMode 
                    ? 'text-emerald-400 border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-emerald-300' 
                    : 'text-emerald-600 border-slate-200 bg-white hover:bg-slate-100 shadow-sm')
                : 'text-emerald-400 border-transparent hover:bg-white/10'
            }`} 
            title="Sync Data with Database (Live Refresh)"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout} 
          className={`flex items-center justify-center gap-2 rounded-xl transition-colors font-semibold border ${
            isModern
              ? (isDarkMode 
                  ? 'border-red-500/25 bg-red-500/10 text-rose-400 hover:bg-red-500/20 hover:border-red-500/40 shadow-xs' 
                  : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 shadow-xs')
              : 'text-red-400 hover:bg-red-500/10 hover:text-red-300 border-transparent'
          } ${isSidebarOpen ? 'px-3 py-2 flex-1 ml-1' : 'p-2 w-full'}`} 
          title="Logout"
        >
          <LogOut size={16} />
          {isSidebarOpen && <span className="truncate text-sm">Logout</span>}
        </button>

        {/* THEME POPUP MODAL */}
        {isThemeOpen && (
          <div className={`absolute bottom-full left-0 mb-3 p-4 rounded-2xl shadow-2xl z-50 transition-all ${
            isModern
              ? (isDarkMode 
                  ? 'bg-[#0E1526] border border-slate-800 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.5)]' 
                  : 'bg-white border border-slate-200 text-slate-800 shadow-[0_10px_35px_rgba(0,0,0,0.12)]')
              : 'bg-[#0B1120]/95 backdrop-blur-2xl border border-white/10 text-gray-100 shadow-2xl'
          } ${isSidebarOpen ? 'w-[300px]' : 'w-[270px] left-16 mb-0 bottom-12'}`}>
            <div className="flex justify-between items-center mb-3 border-b border-slate-700/40 pb-2">
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Palette size={14} className="text-blue-500" /> UI Theme & Style
              </p>
              <button onClick={() => setIsThemeOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            {/* THEME SELECTOR: Modern Clean vs Classic Glass */}
            <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">Choose Theme Experience</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('appTheme_explicit', 'true');
                  setAppTheme('modern');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  appTheme === 'modern'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-sm ring-1 ring-blue-500/50'
                    : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Modern Clean</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500 text-white font-extrabold">NEW</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">Crisp Light & Dark UI</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('appTheme_explicit', 'true');
                  setAppTheme('classic');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  appTheme === 'classic'
                    ? 'border-purple-500 bg-purple-500/15 text-purple-400 shadow-sm ring-1 ring-purple-500/50'
                    : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Classic Glass</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">CLASSIC</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">Glass & Wallpapers</p>
              </button>
            </div>

            {/* If Modern Clean is selected: show Modern options */}
            {appTheme === 'modern' ? (
              <div className="pt-1">
                <p className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wider">Display Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { if (!isDarkMode) toggleThemeMode(); }}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 border-blue-500 text-blue-400 shadow-sm' 
                        : 'border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Moon size={14} /> Dark Mode
                  </button>
                  <button
                    onClick={() => { if (isDarkMode) toggleThemeMode(); }}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      !isDarkMode 
                        ? 'bg-white border-blue-500 text-blue-600 shadow-sm' 
                        : 'border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Sun size={14} /> Light Mode
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 italic leading-snug">
                  * Clean SaaS interface without glassmorphism. Use the Sun/Moon button on the bottom bar to quickly switch modes anytime.
                </p>
              </div>
            ) : (
              /* If Classic Glass is selected: show Original options */
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">Solid & Gradients</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  <button onClick={() => setBgImage('color1')} title="Light Blue" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'color1' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-[#60A5FA] transition-all`}></button>
                  <button onClick={() => setBgImage('color2')} title="Purple" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'color2' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-[#A78BFA] transition-all`}></button>
                  <button onClick={() => setBgImage('color3')} title="Plum Mix" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'color3' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-[#D946EF] transition-all`}></button>
                  <button onClick={() => setBgImage('grad1')} title="Blue-Red Mix" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'grad1' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-gradient-to-br from-[#1E40AF] to-[#B91C1C] transition-all`}></button>
                  <button onClick={() => setBgImage('grad2')} title="Green Gradient" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'grad2' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-gradient-to-br from-[#065F46] to-[#10B981] transition-all`}></button>
                  <button onClick={() => setBgImage('grad3')} title="Ash-Red Mix" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'grad3' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-gradient-to-br from-[#374151] to-[#EF4444] transition-all`}></button>
                </div>

                <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">Live Animations</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  <button onClick={() => setBgImage('anim1')} title="Live Sky" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'anim1' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-gradient-to-b from-blue-400 to-orange-300 transition-all flex items-center justify-center overflow-hidden`}><span className="text-[10px]">⛅</span></button>
                  <button onClick={() => setBgImage('anim2')} title="Slow Color Shift" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'anim2' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-gradient-to-r from-blue-500 via-red-500 to-yellow-400 transition-all flex items-center justify-center`}><span className="text-[10px]">🌈</span></button>
                  <button onClick={() => setBgImage('anim3')} title="Floating Balls" className={`w-6 h-6 rounded-full border-2 ${currentBg === 'anim3' ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-transparent'} bg-blue-900 transition-all flex items-center justify-center`}><span className="text-[10px]">🎾</span></button>
                </div>

                <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">Wallpapers</p>
                <div className="flex gap-2 flex-wrap">
                  {['wall1', 'wall2', 'wall3', 'wall4', 'wall5'].map((theme, i) => (
                    <button
                      key={i}
                      onClick={() => setBgImage(theme)}
                      className={`w-7 h-7 rounded-full border bg-cover bg-center transition-all flex items-center justify-center outline-none ${currentBg === theme ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-white/20 hover:border-white/50'}`}
                      style={{ backgroundImage: `url('/bg${i + 1}.jpg')` }}
                      title={`Wallpaper ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`p-3 shrink-0 ${
        isModern 
          ? (isDarkMode ? 'border-t border-slate-800 bg-[#0B0F19]' : 'border-t border-slate-200 bg-slate-50/50') 
          : 'border-t border-white/20 bg-transparent'
      }`}>
        <div className={`flex items-center ${isSidebarOpen ? 'space-x-3 p-2' : 'justify-center p-1'} rounded-lg transition-colors cursor-pointer border border-transparent ${
          isModern 
            ? (isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-200/60') 
            : 'hover:bg-white/10'
        }`}>
          <div className="relative group shrink-0" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <div className={`rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-600/80 transition-colors flex items-center justify-center text-white font-bold shadow-sm backdrop-blur-md border-2 border-emerald-400/50 ring-2 ring-emerald-500/30 ring-offset-1 ring-offset-transparent overflow-hidden ${isSidebarOpen ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'}`}>
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full">
              <Upload size={isSidebarOpen ? 16 : 14} className="text-white" />
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange} 
              disabled={uploadingImage}
            />
          </div>
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <p className={`text-sm font-semibold truncate ${
                isModern ? (isDarkMode ? 'text-slate-100' : 'text-slate-800') : 'text-white'
              }`}>{displayName}</p>
              <p className={`text-[10px] uppercase tracking-wide truncate ${
                isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-gray-300'
              }`}>{roleName}</p>
            </div>
          )}
        </div>
      </div>

    </aside>
    </>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import {
  Package, Calendar, Truck, Clock, CheckCircle, AlertTriangle, Search, Filter,
  RefreshCw, BarChart3, Layers, User, Phone, MapPin, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Maximize2, Minimize2,
  X, Sparkles, Box, TrendingUp, ArrowUpRight, Copy, Check, Eye, BookOpen, AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';

// 🖼️ Smart Tute Cover Component with cascading multi-folder fallback
const SmartTuteCover = ({ image, tuteName, className = "w-full h-full object-cover", onImageClick }) => {
  const [stage, setStage] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  const cleanImg = (!image || image === 'null' || image === 'default-tute.png' || image === 'default.png') ? null : image;

  const baseUrl = axios.defaults.baseURL ? axios.defaults.baseURL.replace(/\/api\/?$/, '') : '';
  const candidateUrls = cleanImg ? [
    `${baseUrl}/storage/documents/${cleanImg}`,
    `${baseUrl}/storage/icons/${cleanImg}`,
    `${baseUrl}/storage/images/${cleanImg}`,
    `${baseUrl}/storage/users/${cleanImg}`,
    `${baseUrl}/api/storage/documents/${cleanImg}`,
    `${baseUrl}/api/storage/icons/${cleanImg}`,
    `${baseUrl}/api/storage/images/${cleanImg}`
  ] : [];

  const currentUrl = cleanImg && !hasFailed ? candidateUrls[stage] : null;

  const handleError = () => {
    if (stage < candidateUrls.length - 1) {
      setStage(prev => prev + 1);
    } else {
      setHasFailed(true);
    }
  };

  if (!cleanImg || hasFailed || !currentUrl) {
    return (
      <div 
        onClick={() => onImageClick && onImageClick(null)}
        className="w-full h-full bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-indigo-500/15 flex flex-col items-center justify-center p-1 text-center select-none"
      >
        <BookOpen size={16} className="text-amber-500/70 mb-0.5" />
        <span className="text-[7.5px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-tighter line-clamp-2 leading-tight">
          {tuteName ? tuteName.replace(/\[.*?\]/g, '').trim().slice(0, 14) : 'Tute'}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={currentUrl} 
      onError={handleError} 
      alt="" 
      className={className} 
      onClick={() => onImageClick && onImageClick(currentUrl)}
    />
  );
};

// 👤 Smart Lecturer Avatar Component with multi-folder fallback
const SmartLecturerAvatar = ({ image, name, className = "w-full h-full object-cover rounded-2xl" }) => {
  const [stage, setStage] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  const cleanImg = (!image || image === 'null' || image === 'default.png' || image === 'default-user.png') ? null : image;

  const baseUrl = axios.defaults.baseURL ? axios.defaults.baseURL.replace(/\/api\/?$/, '') : '';
  const candidateUrls = cleanImg ? [
    `${baseUrl}/storage/icons/${cleanImg}`,
    `${baseUrl}/storage/images/${cleanImg}`,
    `${baseUrl}/storage/users/${cleanImg}`,
    `${baseUrl}/storage/documents/${cleanImg}`,
    `${baseUrl}/api/storage/icons/${cleanImg}`,
    `${baseUrl}/api/storage/images/${cleanImg}`
  ] : [];

  const currentUrl = cleanImg && !hasFailed ? candidateUrls[stage] : null;

  const handleError = () => {
    if (stage < candidateUrls.length - 1) {
      setStage(prev => prev + 1);
    } else {
      setHasFailed(true);
    }
  };

  if (!cleanImg || hasFailed || !currentUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white font-black text-lg bg-gradient-to-br from-amber-500 to-indigo-600 rounded-2xl select-none">
        {name ? name.charAt(0).toUpperCase() : 'L'}
      </div>
    );
  }

  return (
    <img 
      src={currentUrl} 
      onError={handleError} 
      alt="" 
      className={className} 
    />
  );
};

export default function LecturerTuteStockCalendar({ loggedInUser }) {
  const [user, setUser] = useState(loggedInUser || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Main View Tab: 'CALENDAR' | 'INVENTORY' | 'ANALYTICS'
  const [activeTab, setActiveTab] = useState('CALENDAR');

  // Business & Lecturer Filters
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('ALL');
  const [selectedLecturer, setSelectedLecturer] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'DEPLETED'

  // Calendar State
  const todayDate = new Date();
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth() + 1); // 1-12

  // API Data
  const [stockData, setStockData] = useState({
    lecturers: [],
    summary: { totalLecturers: 0, totalTuteTypes: 0, totalStockAvailable: 0, totalDelivered: 0, totalLowStock: 0 }
  });

  const [calendarData, setCalendarData] = useState({
    summary: { totalOrdersPacked: 0, totalTutesPacked: 0, activeDaysCount: 0, dailyAverage: 0, peakDay: { date: 'N/A', count: 0 }, todayTutesCount: 0, todayOrdersCount: 0 },
    days: {},
    topLecturers: [],
    topTutes: [],
    businessBreakdown: []
  });

  // Selected Day Details Modal
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetails, setDayDetails] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [daySearchQuery, setDaySearchQuery] = useState('');
  const [copiedTracking, setCopiedTracking] = useState(null);

  // Enlarge Cover Modal
  const [previewImage, setPreviewImage] = useState(null);

  // 📂 Collapsed Lecturer Sections State
  const [collapsedLecturers, setCollapsedLecturers] = useState(new Set());

  const toggleLecturerCollapse = (lecId) => {
    setCollapsedLecturers(prev => {
      const next = new Set(prev);
      if (next.has(lecId)) next.delete(lecId);
      else next.add(lecId);
      return next;
    });
  };

  const collapseAllLecturers = () => {
    const allIds = new Set(filteredLecturers.map(l => l.id));
    setCollapsedLecturers(allIds);
  };

  const expandAllLecturers = () => {
    setCollapsedLecturers(new Set());
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch (e) {}
    }
  }, []);

  const rawRole = user?.role || '';
  const userRole = rawRole.toUpperCase().replace(/ /g, '_');
  const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [selectedBusiness, currentYear, currentMonth]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStockData(), fetchCalendarData()]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStockData(), fetchCalendarData()]);
      toast.success("Live Stock & Calendar Refreshed!", { position: 'top-right' });
    } catch (err) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchStockData = async () => {
    try {
      const res = await axios.get('/admin/delivery/manager/lecturer-stock', {
        params: { businessId: selectedBusiness }
      });
      if (res.data) {
        setStockData(res.data);
        if (res.data.businesses && businesses.length === 0) {
          setBusinesses(res.data.businesses);
        }
      }
    } catch (err) {
      console.error("Error fetching lecturer stock:", err);
    }
  };

  const fetchCalendarData = async () => {
    try {
      const res = await axios.get('/admin/delivery/manager/packing-calendar', {
        params: {
          year: currentYear,
          month: currentMonth,
          businessId: selectedBusiness,
          lecturerName: selectedLecturer !== 'ALL' ? selectedLecturer : undefined
        }
      });
      if (res.data) {
        setCalendarData(res.data);
      }
    } catch (err) {
      console.error("Error fetching calendar data:", err);
    }
  };

  // When lecturer filter changes, refresh calendar
  useEffect(() => {
    if (!loading) {
      fetchCalendarData();
    }
  }, [selectedLecturer]);

  // Handle Day Click
  const handleDayClick = async (dateStr) => {
    setSelectedDay(dateStr);
    setDayLoading(true);
    setDaySearchQuery('');
    try {
      const res = await axios.get('/admin/delivery/manager/packing-day-details', {
        params: {
          date: dateStr,
          businessId: selectedBusiness,
          lecturerName: selectedLecturer !== 'ALL' ? selectedLecturer : undefined
        }
      });
      setDayDetails(res.data);
    } catch (err) {
      console.error("Error loading day details:", err);
      toast.error("Failed to load day packing details");
    } finally {
      setDayLoading(false);
    }
  };

  // Month Navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // Calendar Calculation Helpers
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 1 ? 12 : currentMonth - 1;
      const y = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        data: calendarData.days[dateStr] || null
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayDate.toISOString().split('T')[0],
        data: calendarData.days[dateStr] || null
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 12 ? 1 : currentMonth + 1;
      const y = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        data: calendarData.days[dateStr] || null
      });
    }

    return days;
  }, [currentYear, currentMonth, calendarData.days]);

  // Filtered Stock Lecturers & Tutes
  const filteredLecturers = useMemo(() => {
    let list = stockData.lecturers || [];

    if (selectedLecturer !== 'ALL') {
      list = list.filter(l => l.name === selectedLecturer);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.map(lec => {
        const matchesLec = lec.name.toLowerCase().includes(q);
        const filteredTutes = lec.tutes.filter(t =>
          t.tuteName.toLowerCase().includes(q) ||
          t.courseName.toLowerCase().includes(q) ||
          t.batchName.toLowerCase().includes(q)
        );
        if (matchesLec || filteredTutes.length > 0) {
          return {
            ...lec,
            tutes: matchesLec ? lec.tutes : filteredTutes
          };
        }
        return null;
      }).filter(Boolean);
    }

    if (stockStatusFilter !== 'ALL') {
      list = list.map(lec => {
        const filteredTutes = lec.tutes.filter(t => t.status === stockStatusFilter);
        if (filteredTutes.length > 0) {
          return { ...lec, tutes: filteredTutes };
        }
        return null;
      }).filter(Boolean);
    }

    return list;
  }, [stockData.lecturers, selectedLecturer, searchQuery, stockStatusFilter]);

  // Filtered Orders in Day Drawer
  const filteredDayOrders = useMemo(() => {
    if (!dayDetails || !dayDetails.deliveries) return [];
    if (!daySearchQuery.trim()) return dayDetails.deliveries;
    const q = daySearchQuery.toLowerCase().trim();
    return dayDetails.deliveries.filter(del =>
      del.orderNo.toLowerCase().includes(q) ||
      del.studentName.toLowerCase().includes(q) ||
      del.studentPhone.toLowerCase().includes(q) ||
      (del.trackingNumber && del.trackingNumber.toLowerCase().includes(q)) ||
      del.items.some(i => i.tuteName.toLowerCase().includes(q) || i.lecturerName.toLowerCase().includes(q))
    );
  }, [dayDetails, daySearchQuery]);

  // Image URL Resolver
  const resolveImage = (imgName, type = 'documents') => {
    if (!imgName || imgName === 'null' || imgName === 'default-tute.png' || imgName === 'default.png') return null;
    const baseUrl = axios.defaults.baseURL.replace('/api', '');
    return `${baseUrl}/storage/${type}/${imgName}`;
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(id);
    toast.success("Tracking Number Copied!");
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  // Chart Data for Daily Packing
  const dailyChartData = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = calendarData.days[dateStr];
      result.push({
        day: `${d}`,
        date: dateStr,
        Tutes: dayData ? dayData.tutesCount : 0,
        Orders: dayData ? dayData.ordersCount : 0
      });
    }
    return result;
  }, [currentYear, currentMonth, calendarData.days]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

  return (
    <div className="w-full animate-fade-in text-gray-900 dark:text-gray-100 pb-12 font-sans relative transition-colors duration-500 z-10 max-w-[1700px] mx-auto px-2 sm:px-4">

      {/* 🔹 Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white/80 via-white/60 to-white/40 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-transparent backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-gray-200/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] mb-6 transition-all">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl shadow-lg shadow-amber-500/20 shrink-0">
              <Box size={32} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  Lecturer Tute Stock & Logistics Calendar
                </h1>
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-amber-500/20 shadow-sm flex items-center gap-1">
                  <Sparkles size={12} /> Live Delivery Sync
                </span>
              </div>
              <p className="text-xs md:text-sm font-bold text-gray-500 dark:text-slate-400 mt-1">
                Real-time inventory levels per lecturer & interactive date-wise packing distribution calendar.
              </p>
            </div>
          </div>

          {/* Quick Refresh & Role Badge */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <a
              href="/delivery/dashboard?tab=reports"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-xs font-black text-pink-600 dark:text-pink-400 transition-all shadow-sm active:scale-95"
            >
              <BarChart3 size={14} />
              <span>Stock Reports 📊</span>
            </a>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-xs font-black text-gray-700 dark:text-slate-200 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-amber-500' : 'text-gray-400'} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Live Data'}</span>
            </button>
            <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider">
              {isAdmin ? '👑 Super Admin View' : '👔 Manager View'}
            </div>
          </div>
        </div>

        {/* 🔹 Global Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-200/60 dark:border-white/10">
          
          {/* Business Selector */}
          <div className="flex items-center gap-2 bg-white/90 dark:bg-black/30 px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <Filter size={15} className="text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-0.5">Business</label>
              <select
                value={selectedBusiness}
                onChange={(e) => {
                  setSelectedBusiness(e.target.value);
                  setSelectedLecturer('ALL');
                }}
                className="w-full bg-transparent text-xs font-black text-gray-800 dark:text-slate-100 outline-none cursor-pointer truncate"
              >
                {isAdmin && <option value="ALL" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold">✨ Whole Business (All Combined)</option>}
                {businesses.map(b => (
                  <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lecturer Selector */}
          <div className="flex items-center gap-2 bg-white/90 dark:bg-black/30 px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <User size={15} className="text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-0.5">Lecturer</label>
              <select
                value={selectedLecturer}
                onChange={(e) => setSelectedLecturer(e.target.value)}
                className="w-full bg-transparent text-xs font-black text-gray-800 dark:text-slate-100 outline-none cursor-pointer truncate"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold">All Lecturers</option>
                {stockData.lecturers.map((l, idx) => (
                  <option key={`${l.id || l.name}-${idx}`} value={l.name} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold">
                    {l.name} ({l.tutesCount} tutes)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 bg-white/90 dark:bg-black/30 px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <Search size={15} className="text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-[9px] font-black uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-0.5">Search Material / Lecturer</label>
              <input
                type="text"
                placeholder="Search tute name, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-black text-gray-800 dark:text-slate-100 outline-none placeholder-gray-400"
              />
            </div>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Mode Navigation Tabs */}
          <div className="flex items-center bg-gray-100 dark:bg-black/40 p-1.5 rounded-2xl border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setActiveTab('CALENDAR')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'CALENDAR'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar size={14} />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setActiveTab('INVENTORY')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'INVENTORY'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Package size={14} />
              <span>Stock Grid</span>
            </button>
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'ANALYTICS'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={14} />
              <span>Analytics</span>
            </button>
          </div>

        </div>
      </div>

      {/* 🔹 Top KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        
        {/* Total Available Stock */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Total Stock</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white truncate">
            {stockData.summary.totalStockAvailable.toLocaleString()}
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block">In Dep. Warehouses</span>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Low Stock</span>
            <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 truncate">
            {stockData.summary.totalLowStock}
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block">&le; 20 Units Balance</span>
        </div>

        {/* Month Packed Tutes */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Month Tutes</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <CheckCircle size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 truncate">
            {calendarData.summary.totalTutesPacked.toLocaleString()}
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block">{monthNames[currentMonth - 1]} Total</span>
        </div>

        {/* Month Orders Dispatched */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Month Parcels</span>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
              <Truck size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 truncate">
            {calendarData.summary.totalOrdersPacked.toLocaleString()}
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block">Orders Processed</span>
        </div>

        {/* Daily Packing Average */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Daily Speed</span>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 truncate">
            ~{calendarData.summary.dailyAverage}
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block">Tutes / Active Day</span>
        </div>

        {/* Peak Day of Month */}
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Peak Day</span>
            <div className="p-2 bg-pink-500/10 text-pink-500 rounded-xl">
              <Sparkles size={16} />
            </div>
          </div>
          <p className="text-xl font-black text-pink-600 dark:text-pink-400 truncate">
            {calendarData.summary.peakDay.count} Tutes
          </p>
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-1 block truncate">
            {calendarData.summary.peakDay.date !== 'N/A' ? calendarData.summary.peakDay.date : 'No Data'}
          </span>
        </div>

      </div>

      {/* 🔹 MAIN VIEW CONTENT 🔹 */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-80 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] border border-gray-200 dark:border-white/10">
          <RefreshCw className="animate-spin text-amber-500 mb-3" size={36} />
          <p className="text-sm font-black text-gray-700 dark:text-slate-300">Loading Lecturer Tute Stock & Packing Calendar...</p>
        </div>
      ) : activeTab === 'CALENDAR' ? (

        /* ================= CALENDAR HUB VIEW ================= */
        <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl transition-all">
          
          {/* Calendar Month Header & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-2.5 rounded-2xl bg-white/80 dark:bg-white/5 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 transition-all shadow-sm cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2.5 rounded-2xl bg-white/80 dark:bg-white/5 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 transition-all shadow-sm cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {monthNames[currentMonth - 1]} {currentYear}
              </h2>

              <button
                onClick={handleCurrentMonth}
                className="text-[11px] font-black uppercase px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 transition-all cursor-pointer"
              >
                Today
              </button>
            </div>

            {/* Quick Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/40"></span> Packed (1-50)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-blue-500/20 border border-blue-500/40"></span> Busy (51-150)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-purple-500/30 border border-purple-500/50"></span> Peak (150+)</span>
            </div>
          </div>

          {/* Calendar 7-Day Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {dayNames.map((dName, idx) => (
              <div key={idx} className="text-center py-2 text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">
                {dName}
              </div>
            ))}

            {calendarDays.map((cell, idx) => {
              const count = cell.data?.tutesCount || 0;
              const orders = cell.data?.ordersCount || 0;

              let heatBg = 'bg-white/40 dark:bg-white/[0.02] border-gray-200/60 dark:border-white/5 hover:border-amber-400/40';
              let heatBadge = 'text-gray-400 dark:text-slate-500';

              if (count > 150) {
                heatBg = 'bg-gradient-to-br from-purple-500/15 to-pink-500/10 border-purple-500/30 dark:border-purple-500/30 hover:border-purple-400';
                heatBadge = 'bg-purple-500 text-white shadow-sm shadow-purple-500/30';
              } else if (count > 50) {
                heatBg = 'bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border-blue-500/30 dark:border-blue-500/30 hover:border-blue-400';
                heatBadge = 'bg-blue-500 text-white shadow-sm shadow-blue-500/30';
              } else if (count > 0) {
                heatBg = 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-400';
                heatBadge = 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30';
              }

              return (
                <div
                  key={idx}
                  onClick={() => count > 0 && handleDayClick(cell.dateStr)}
                  className={`min-h-[100px] sm:min-h-[120px] p-2 sm:p-3 rounded-2xl border transition-all flex flex-col justify-between relative group ${heatBg} ${
                    !cell.isCurrentMonth ? 'opacity-30 pointer-events-none' : ''
                  } ${count > 0 ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : 'cursor-default'} ${
                    cell.isToday ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-transparent' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs sm:text-sm font-black ${cell.isToday ? 'text-amber-500' : 'text-gray-700 dark:text-slate-300'}`}>
                      {cell.dayNumber}
                    </span>
                    {count > 0 && (
                      <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md ${heatBadge}`}>
                        {count} tutes
                      </span>
                    )}
                  </div>

                  {count > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-black text-gray-800 dark:text-slate-200 truncate flex items-center gap-1">
                        <Truck size={10} className="text-amber-500 shrink-0" />
                        <span>{orders} Orders</span>
                      </p>

                      {/* Top Lecturer Snapshot */}
                      {cell.data?.sampleItems && cell.data.sampleItems.length > 0 && (
                        <div className="hidden sm:block">
                          <p className="text-[9px] font-bold text-gray-500 dark:text-slate-400 truncate">
                            {cell.data.sampleItems[0].lecturerName}
                          </p>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-end text-[9px] font-black text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                        <span>View &rarr;</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[10px] text-gray-300 dark:text-slate-600 font-bold">-</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      ) : activeTab === 'INVENTORY' ? (

        /* ================= LECTURER TUTE STOCK GRID ================= */
        <div className="space-y-6">

          {/* Sub Filters & Search Bar for Inventory */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl p-4 md:p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-slate-400 mr-1">Stock:</span>
              {['ALL', 'IN_STOCK', 'LOW_STOCK', 'DEPLETED'].map(status => (
                <button
                  key={status}
                  onClick={() => setStockStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    stockStatusFilter === status
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {status === 'ALL' ? 'All Tutes' : status === 'IN_STOCK' ? '🟢 In Stock' : status === 'LOW_STOCK' ? '🟡 Low Stock' : '🔴 Depleted'}
                </button>
              ))}
            </div>

            {/* In-Stock Search Bar */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Search lecturer, tute, subject, batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl pl-10 pr-9 py-2 text-xs font-black text-gray-900 dark:text-white outline-none focus:border-amber-500 placeholder-gray-400 shadow-inner"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Collapse All / Expand All Actions */}
            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={collapseAllLecturers}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-slate-300 text-xs font-black transition-all cursor-pointer border border-gray-200/60 dark:border-white/5"
                title="Minimise / Collapse all lecturer sections"
              >
                <Minimize2 size={13} className="text-amber-500" />
                <span>Collapse All</span>
              </button>
              <button
                onClick={expandAllLecturers}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-slate-300 text-xs font-black transition-all cursor-pointer border border-gray-200/60 dark:border-white/5"
                title="Expand all lecturer sections"
              >
                <Maximize2 size={13} className="text-indigo-500" />
                <span>Expand All</span>
              </button>
            </div>
          </div>

          {/* Lecturer Cards List */}
          {filteredLecturers.length === 0 ? (
            <div className="text-center py-20 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2.5rem] border border-gray-200 dark:border-white/10">
              <Box size={48} className="mx-auto text-gray-400 dark:text-slate-600 mb-3" />
              <h3 className="text-lg font-black text-gray-700 dark:text-slate-300">No Lecturer Tute Stocks Found</h3>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLecturers.map((lec, idx) => {
                const isCollapsed = collapsedLecturers.has(lec.id);

                return (
                  <div
                    key={`${lec.id || lec.name}-${idx}`}
                    className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                  >
                    {/* Lecturer Header (Clickable Accordion Trigger) */}
                    <div
                      onClick={() => toggleLecturerCollapse(lec.id)}
                      className="p-5 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 p-0.5 shadow-md shrink-0 overflow-hidden">
                          <SmartLecturerAvatar image={lec.image} name={lec.name} />
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            {lec.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {lec.businesses.map((b, bIdx) => (
                              <span key={`${b.id}-${bIdx}`} className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {b.name}
                              </span>
                            ))}
                            <span className="text-[10px] font-bold text-gray-400">&bull; {lec.tutes.length} Materials Linked</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Summary Badges & Collapse Indicator */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex items-center gap-2">
                          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                            {lec.totalStock} in Stock
                          </div>
                          <div className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black">
                            {lec.totalDelivered} Delivered
                          </div>
                          {lec.lowStockCount > 0 && (
                            <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-black flex items-center gap-1">
                              <AlertTriangle size={13} /> {lec.lowStockCount} Low
                            </div>
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-slate-400 shrink-0">
                          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Lecturer Tutes Grid (Collapsible) */}
                    {!isCollapsed && (
                      <div className="px-5 pb-6 md:px-7 md:pb-7 pt-2 border-t border-gray-100 dark:border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {lec.tutes.map(tute => {
                            const isDepleted = tute.availableQuantity <= 0;
                            const isLow = tute.availableQuantity > 0 && tute.availableQuantity <= 20;

                            return (
                              <div
                                key={tute.id}
                                className="bg-white/80 dark:bg-black/20 p-4 rounded-2xl border border-gray-200/80 dark:border-white/5 hover:border-amber-400/40 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
                              >
                                <div className="flex gap-3 items-start">
                                  {/* Tute Cover Preview */}
                                  <div
                                    className="w-16 h-20 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 shrink-0 overflow-hidden relative cursor-pointer group-hover:scale-105 transition-transform shadow-inner flex items-center justify-center"
                                  >
                                    <SmartTuteCover 
                                      image={tute.tuteImage} 
                                      tuteName={tute.tuteName} 
                                      onImageClick={(url) => url && setPreviewImage(url)} 
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                      <Eye size={16} />
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mb-1 ${
                                      tute.paymentType === 'Monthly' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20'
                                    }`}>
                                      {tute.paymentType}
                                    </span>
                                    <h4 className="text-xs font-black text-gray-900 dark:text-white line-clamp-2 leading-tight" title={tute.tuteName}>
                                      {tute.tuteName}
                                    </h4>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 truncate mt-1">
                                      {tute.courseName}
                                    </p>
                                    <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 truncate">
                                      {tute.batchName}
                                    </p>
                                  </div>
                                </div>

                                {/* Stock Quantity Ribbon */}
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                                  <div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Available</span>
                                    <span className={`text-base font-black ${
                                      isDepleted ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-500'
                                    }`}>
                                      {tute.availableQuantity} units
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Packed/Sent</span>
                                    <span className="text-xs font-black text-blue-500">
                                      {tute.totalDelivered}
                                    </span>
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

      ) : (

        /* ================= ANALYTICS & TRENDS VIEW ================= */
        <div className="space-y-6">

          {/* Daily Packing Chart */}
          <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} />
              Daily Tute Packing Distribution ({monthNames[currentMonth - 1]} {currentYear})
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tutesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Tutes" name="Tutes Packed" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#tutesGrad)" />
                  <Area type="monotone" dataKey="Orders" name="Orders / Parcels" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#ordersGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Lecturers & Top Tutes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Lecturers Packed */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <User className="text-amber-500" size={20} />
                Top Lecturers by Tutes Packed ({monthNames[currentMonth - 1]})
              </h3>
              <div className="space-y-4">
                {calendarData.topLecturers.length > 0 ? (
                  calendarData.topLecturers.map((lec, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/60 dark:bg-black/20 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-black text-gray-800 dark:text-slate-200">{lec.name}</span>
                      </div>
                      <span className="text-xs font-black px-3 py-1 rounded-xl bg-amber-500 text-white shadow-sm">
                        {lec.count} Tutes
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs font-bold text-gray-400 py-10">No lecturer packing data for this month.</p>
                )}
              </div>
            </div>

            {/* Business Breakdown (If Admin) or Top Tutes */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-xl">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Layers className="text-purple-500" size={20} />
                Business Distribution ({monthNames[currentMonth - 1]})
              </h3>
              <div className="space-y-4">
                {calendarData.businessBreakdown.length > 0 ? (
                  calendarData.businessBreakdown.map((biz, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/60 dark:bg-black/20 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                        <span className="text-sm font-black text-gray-800 dark:text-slate-200">{biz.name}</span>
                      </div>
                      <span className="text-xs font-black px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {biz.count} Tutes
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs font-bold text-gray-400 py-10">No business distribution data.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 🔹 SLIDE-OUT DAY DETAILS DRAWER / MODAL 🔹 */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border-b border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block mb-1">
                  Packing Log Breakdown
                </span>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Calendar className="text-amber-500" size={24} /> {selectedDay}
                </h2>
              </div>

              <button
                onClick={() => setSelectedDay(null)}
                className="p-3 rounded-2xl bg-white/80 dark:bg-white/5 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
              {dayLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <RefreshCw className="animate-spin text-amber-500 mb-3" size={32} />
                  <p className="text-xs font-black text-gray-500 dark:text-slate-400">Loading day packing log...</p>
                </div>
              ) : !dayDetails || dayDetails.deliveries.length === 0 ? (
                <div className="text-center py-20">
                  <Truck size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-black text-gray-700 dark:text-slate-300">No orders packed on {selectedDay}.</p>
                </div>
              ) : (
                <>
                  {/* Day Overview Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">Tutes Packed</span>
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{dayDetails.totalTutes}</span>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block">Orders Packed</span>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{dayDetails.totalOrders}</span>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl col-span-2">
                      <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block">Top Lecturer on Date</span>
                      <span className="text-sm font-black text-purple-600 dark:text-purple-400 truncate block mt-1">
                        {dayDetails.lecturerSummary[0]?.name || 'N/A'} ({dayDetails.lecturerSummary[0]?.count || 0} tutes)
                      </span>
                    </div>
                  </div>

                  {/* Search within Day */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search orders by student name, tracking #, or phone..."
                      value={daySearchQuery}
                      onChange={(e) => setDaySearchQuery(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs font-black text-gray-900 dark:text-white outline-none focus:border-amber-500 shadow-inner"
                    />
                  </div>

                  {/* Day Orders List */}
                  <div className="space-y-4">
                    {filteredDayOrders.map(order => (
                      <div
                        key={order.id}
                        className="bg-white/80 dark:bg-white/[0.02] p-5 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all space-y-4"
                      >
                        {/* Order Top Bar */}
                        <div className="flex flex-wrap justify-between items-start gap-2 pb-3 border-b border-gray-100 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs border border-amber-500/20">
                              {order.orderNo}
                            </span>
                            <span className="text-[11px] font-black text-gray-500 dark:text-slate-400">
                              {order.businessName} &bull; {order.batchName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {order.trackingNumber && order.trackingNumber !== 'N/A' && (
                              <button
                                onClick={() => copyToClipboard(order.trackingNumber, order.id)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-black hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedTracking === order.id ? <Check size={12} /> : <Copy size={12} />}
                                <span>{order.trackingNumber}</span>
                              </button>
                            )}
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Student Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[9px] font-black uppercase text-gray-400 block">Student</span>
                            <span className="font-black text-gray-800 dark:text-slate-200">{order.studentName}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-gray-400 block">Phone</span>
                            <span className="font-bold text-gray-600 dark:text-slate-300">{order.studentPhone}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-gray-400 block">Address</span>
                            <span className="font-bold text-gray-600 dark:text-slate-300 truncate block" title={order.studentAddress}>
                              {order.studentAddress}
                            </span>
                          </div>
                        </div>

                        {/* Packed Tutes In This Parcel */}
                        <div className="bg-gray-50 dark:bg-black/30 p-3.5 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block">
                            Included Tutes ({order.totalTutesCount} Items):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {order.items.map((item, iIdx) => (
                              <div key={iIdx} className="flex items-center gap-2.5 text-xs font-bold text-gray-700 dark:text-slate-300 bg-white/60 dark:bg-white/[0.03] p-2 rounded-xl border border-gray-100 dark:border-white/5">
                                <div className="w-8 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-white/10 shadow-xs">
                                  <SmartTuteCover 
                                    image={item.tuteImage} 
                                    tuteName={item.tuteName}
                                    onImageClick={(url) => url && setPreviewImage(url)} 
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-[9px]">
                                      {item.quantity}x
                                    </span>
                                    <p className="font-black truncate text-gray-900 dark:text-white text-xs">{item.tuteName}</p>
                                  </div>
                                  <p className="text-[9px] text-gray-400 truncate mt-0.5">{item.lecturerName} &bull; {item.courseName}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {order.packRemark && (
                          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10">
                            📝 Note: {order.packRemark}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedDay(null)}
                className="px-6 py-2.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black hover:opacity-90 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🔹 ENLARGE COVER PREVIEW MODAL 🔹 */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <img src={previewImage} alt="Enlarged Cover" className="w-full h-full object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

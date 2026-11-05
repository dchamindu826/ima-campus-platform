import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Database, AlertTriangle, Activity, CheckCircle2, Terminal, HardDrive, Cpu, Server, Shield, MessageCircle, CreditCard, DollarSign, Gauge, ShieldCheck, ShieldAlert, RefreshCw, Layers, ArrowUpRight, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, YAxis } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AdminAuditTrail from './AdminAuditTrail';
import { useTheme } from '../../contexts/ThemeContext';

export default function AdminDashboard() {
  const { appTheme, isDarkMode } = useTheme();
  const isModern = appTheme === 'modern';

  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [activeView, setActiveView] = useState('overview'); // 'overview' | 'audit'
  const terminalContainerRef = useRef(null);
  
  // WhatsApp Monitor State
  const [waAlerts, setWaAlerts] = useState([]);
  const [waStatus, setWaStatus] = useState(null);
  const [waBilling, setWaBilling] = useState(null);
  const [waActiveTab, setWaActiveTab] = useState('numbers'); // 'numbers' | 'billing' | 'alerts'
  const [waRefreshing, setWaRefreshing] = useState(false);
  const socketRef = useRef(null);

  // Mock History Data for Charts since backend doesn't save historical CPU stats yet
  const cpuHistory = [
    { time: '10:00', load: 12 }, { time: '10:05', load: 18 }, { time: '10:10', load: 45 },
    { time: '10:15', load: 30 }, { time: '10:20', load: 25 }, { time: '10:25', load: 60 },
    { time: '10:30', load: 15 }
  ];

  const storageData = [
    { name: 'Database Data', value: 450 },
    { name: 'File Uploads', value: 850 },
    { name: 'Automated Backups', value: 1200 },
    { name: 'Free Space', value: 3500 }
  ];

  const apiTrafficData = [
    { name: 'Students', reqs: 14500 },
    { name: 'CRM (Team)', reqs: 8200 },
    { name: 'Payments', reqs: 3100 },
    { name: 'Webhooks', reqs: 1500 }
  ];

  const STORAGE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#1E293B'];

  // WhatsApp data fetchers at component scope so JSX can access them
  const fetchWaAlerts = async () => {
    try {
      const response = await api.get('/admin/whatsapp-call/alerts');
      if (response.data && response.data.success) {
         setWaAlerts(response.data.alerts || []);
      }
    } catch (err) {
      console.warn("WA Alerts Fetch Error", err);
    }
  };
  
  const fetchWaStatus = async () => {
      try {
          const res = await api.get('/admin/whatsapp-call/status');
          if(res.data && res.data.success) {
              setWaStatus(res.data.data || []);
              if (res.data.billing) {
                  setWaBilling(res.data.billing);
              }
          }
      } catch(err) {
          console.warn("WA Status Fetch Error", err);
      }
  };

  const handleRefreshWa = async () => {
      setWaRefreshing(true);
      try {
          await Promise.all([fetchWaStatus(), fetchWaAlerts()]);
          toast.success("WhatsApp status & billing refreshed!");
      } catch (err) {
          toast.error("Failed to refresh WhatsApp data");
      } finally {
          setWaRefreshing(false);
      }
  };

  // Fetch Stats
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/admin/overview'); 
        setStats(response.data);
      } catch (error) {
        console.warn("API Error", error);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchMaintenanceMode = () => {
        api.get('/admin/settings/maintenance-mode')
           .then(res => setMaintenanceMode(res.data.active))
           .catch(err => console.warn("Failed to fetch maintenance mode", err));
    };

    fetchDashboardData();
    fetchMaintenanceMode();
    fetchWaAlerts();
    fetchWaStatus();
    
    // Live database sync listener without page reload
    const handleGlobalRefresh = () => {
      fetchDashboardData();
      fetchMaintenanceMode();
      fetchWaAlerts();
      fetchWaStatus();
    };
    window.addEventListener('global-refresh', handleGlobalRefresh);

    // Socket Setup
    const token = localStorage.getItem('token');
    const socketUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
    socketRef.current = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    
    socketRef.current.on('whatsapp_alert', (newAlert) => {
        setWaAlerts(prev => [newAlert, ...prev].slice(0, 50));
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 border border-emerald-500 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <MessageCircle className="h-10 w-10 text-emerald-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-white">WhatsApp Alert: {newAlert.alertType}</p>
                  <p className="mt-1 text-sm text-gray-300">{newAlert.message}</p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-700">
              <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-white focus:outline-none">
                Close
              </button>
            </div>
          </div>
        ));
    });

    const interval = setInterval(() => {
        fetchDashboardData();
        fetchMaintenanceMode();
        fetchWaStatus();
    }, 10000);
    
    return () => {
        clearInterval(interval);
        window.removeEventListener('global-refresh', handleGlobalRefresh);
        if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const toggleMaintenanceMode = async (newVal) => {
      setMaintenanceMode(newVal);
      try {
          await api.put('/admin/settings/maintenance-mode', { 
              active: newVal, 
              messageEn: "System is under update. Some features may not work properly. If you face any issues, please mention in the WhatsApp group.",
              messageSi: "පද්ධතිය යාවත්කාලීන වෙමින් පවතී. සමහර පහසුකම් නිසියාකාරව ක්‍රියා නොකිරීමට ඉඩ ඇත. යම් ගැටලුවක් ඇත්නම් කරුණාකර WhatsApp Group එකට දැනුම් දෙන්න." 
          });
          toast.success(`System Maintenance Mode ${newVal ? 'ACTIVATED' : 'DEACTIVATED'}!`);
      } catch (error) {
          toast.error("Failed to update maintenance mode");
          setMaintenanceMode(!newVal);
      }
  };

  // Fetch Live Logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get('/admin/logs');
        setLogs(response.data);
        if (terminalContainerRef.current) {
          terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
        }
      } catch (error) {
        setLogs("Error connecting to server terminal...");
      }
    };
    fetchLogs();
    const logInterval = setInterval(fetchLogs, 3000);
    return () => clearInterval(logInterval);
  }, []);

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    const toastId = toast.loading("Fetching latest Auto Backup...");
    try {
      const response = await api.get('/admin/backup', {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `IMA_Backup_${dateStr}.sql`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Backup Downloaded!", { id: toastId });
    } catch (error) {
      toast.error("No backup found!", { id: toastId });
    } finally {
      setIsBackingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin text-brand-accent" />
      </div>
    );
  }

  if (activeView === 'audit') {
      return (
          <div className={`w-full min-h-screen p-4 md:p-8 rounded-2xl ${
            isModern 
              ? (isDarkMode ? 'bg-[#0B0F19] text-slate-100 border border-slate-800' : 'bg-[#F8FAFC] text-slate-900 border border-slate-200')
              : 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white'
          }`}>
              <button 
                  onClick={() => setActiveView('overview')}
                  className={`mb-4 flex items-center font-bold text-sm transition-colors ${
                    isModern ? (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900') : 'text-gray-400 hover:text-white'
                  }`}
              >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  Back to Dashboard
              </button>
              <AdminAuditTrail />
          </div>
      );
  }

  return (
    <div className={`w-full min-h-screen animate-fade-in pb-10 px-4 md:px-8 pt-6 relative overflow-hidden rounded-2xl transition-colors duration-300 ${
      isModern 
        ? (isDarkMode ? 'bg-[#0B0F19] text-slate-100 border border-slate-800/80 shadow-sm' : 'bg-[#F8FAFC] text-slate-900 border border-slate-200/80 shadow-sm')
        : 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]'
    }`}>
      {/* Decorative background blurs for Classic Glass only */}
      {!isModern && (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        </>
      )}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8 relative z-10">
        <div>
          <h2 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${
            isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white'
          }`}>System Monitor</h2>
          <p className="mt-1.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isModern 
                ? (isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700')
                : 'text-emerald-400'
            }`}>
              <Activity size={14} className="animate-pulse" /> Live Server Synchronization Active
            </span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setActiveView('audit')} 
            className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold transition-all ${
              isModern 
                ? (isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl shadow-sm' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-sm')
                : 'bg-blue-900/40 hover:bg-blue-800 text-blue-300 border border-blue-700/50 rounded-lg shadow-lg'
            }`}
          >
            <Shield size={16} /> 
            Audit Trail
          </button>
          <button 
            onClick={handleDownloadBackup} 
            disabled={isBackingUp}
            className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-sm font-bold shadow-md transition-all ${
              isModern ? 'rounded-xl border border-emerald-500/40' : 'rounded-lg border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            }`}
          >
            {isBackingUp ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />} 
            {isBackingUp ? 'Fetching Backup...' : 'Download Latest DB'}
          </button>
        </div>
      </div>

      {/* SYSTEM MAINTENANCE WIDGET */}
      <div className={`mb-8 p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 ${
        isModern
          ? (maintenanceMode
              ? (isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200')
              : (isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'))
          : (maintenanceMode ? 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10 backdrop-blur-xl')
      }`}>
          <div className="flex items-center gap-5">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${
                maintenanceMode 
                  ? 'bg-amber-500/20 text-amber-500' 
                  : (isModern ? (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500') : 'bg-white/5 text-gray-400')
              }`}>
                  <AlertTriangle size={24} className={maintenanceMode ? 'animate-pulse' : ''}/>
              </div>
              <div>
                  <h3 className={`text-base font-bold tracking-tight ${
                    maintenanceMode 
                      ? 'text-amber-500' 
                      : (isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white')
                  }`}>Global Maintenance Mode</h3>
                  <p className={`text-xs mt-0.5 font-medium ${
                    isModern ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : 'text-gray-400'
                  }`}>Toggle this to show the system update warning banner to all staff.</p>
              </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={(e) => toggleMaintenanceMode(e.target.checked)} />
              <div className="w-14 h-7 bg-slate-700/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 border border-slate-600/40"></div>
              <span className={`ml-3 text-xs font-bold uppercase tracking-wider ${
                maintenanceMode ? 'text-amber-500' : (isModern ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : 'text-gray-500')
              }`}>{maintenanceMode ? 'ACTIVE' : 'OFF'}</span>
          </label>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard 
          title="Total Data Processed" 
          value={stats?.verifiedSales || 0} 
          icon={<CheckCircle2 size={20} className="text-emerald-500" />} 
          trend="Database Records" trendColor="text-emerald-500"
          isModern={isModern}
          isDarkMode={isDarkMode}
        />
        <StatCard 
          title="Current CPU Load" 
          value={`${stats?.serverHealth?.cpuUsage || 0}%`} 
          icon={<Cpu size={20} className="text-blue-500" />} 
          trend="All Node.js Cores" trendColor="text-blue-500"
          isModern={isModern}
          isDarkMode={isDarkMode}
        />
        <StatCard 
          title="Memory (RAM)" 
          value={`${stats?.serverHealth?.ramUsage || 0}%`} 
          icon={<HardDrive size={20} className="text-amber-500" />} 
          trend="Active Heap Usage" trendColor="text-amber-500"
          isModern={isModern}
          isDarkMode={isDarkMode}
        />
        <StatCard 
          title="System Alerts" 
          value={stats?.failed || 0} 
          icon={<AlertTriangle size={20} className="text-rose-500" />} 
          trend="Critical Errors" trendColor={stats?.failed > 0 ? "text-rose-500" : "text-emerald-500"}
          isModern={isModern}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        
        {/* Left Side: Charts */}
        <div className="xl:col-span-2 flex flex-col gap-6 relative z-10">
          
          {/* Server Load Area Chart */}
          <div className={`${
            isModern 
              ? (isDarkMode ? 'bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-sm' : 'bg-white border border-slate-200 p-6 rounded-2xl shadow-sm')
              : 'bg-white/5 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300'
          }`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${
                  isModern ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-gray-300 font-extrabold'
                }`}>
                    <Server size={16} className="text-blue-500" /> CPU Load History (30 Min)
                </h3>
                <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold">LIVE</span>
            </div>
            <div className="w-full relative">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={cpuHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isModern ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : 'rgba(255,255,255,0.05)'} vertical={false} />
                  <XAxis dataKey="time" stroke={isModern ? (isDarkMode ? '#64748B' : '#94A3B8') : '#94A3B8'} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={isModern ? (isDarkMode ? '#64748B' : '#94A3B8') : '#94A3B8'} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isModern ? (isDarkMode ? '#0F172A' : '#FFFFFF') : 'rgba(0,0,0,0.9)', 
                      border: `1px solid ${isModern ? (isDarkMode ? '#334155' : '#E2E8F0') : '#333'}`, 
                      borderRadius: '10px',
                      color: isModern ? (isDarkMode ? '#FFFFFF' : '#0F172A') : '#fff',
                      boxShadow: isModern ? '0 10px 25px rgba(0,0,0,0.1)' : 'none'
                    }} 
                  />
                  <Area type="monotone" dataKey="load" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLoad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Storage Distribution Pie Chart */}
              <div className={`${
                isModern 
                  ? (isDarkMode ? 'bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col items-center' : 'bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col items-center')
                  : 'bg-white/5 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col items-center'
              }`}>
                <h3 className={`text-xs font-bold tracking-wider mb-2 w-full uppercase flex items-center gap-2 ${
                  isModern ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-gray-300 font-extrabold'
                }`}>
                    <HardDrive size={16} className="text-emerald-500" /> Server Storage Dist. (MB)
                </h3>
                <div className="w-full relative mt-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={storageData} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                        {storageData.map((entry, index) => <Cell key={`cell-${index}`} fill={STORAGE_COLORS[index % STORAGE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isModern ? (isDarkMode ? '#0F172A' : '#FFFFFF') : 'rgba(0,0,0,0.9)', 
                          border: `1px solid ${isModern ? (isDarkMode ? '#334155' : '#E2E8F0') : '#333'}`, 
                          borderRadius: '10px', 
                          color: isModern ? (isDarkMode ? '#FFFFFF' : '#0F172A') : '#fff',
                          boxShadow: isModern ? '0 10px 25px rgba(0,0,0,0.1)' : 'none'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* API Traffic Bar Chart */}
              <div className={`${
                isModern 
                  ? (isDarkMode ? 'bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-sm' : 'bg-white border border-slate-200 p-6 rounded-2xl shadow-sm')
                  : 'bg-white/5 border border-white/10 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all duration-300'
              }`}>
                <h3 className={`text-xs font-bold tracking-wider mb-6 uppercase flex items-center gap-2 ${
                  isModern ? (isDarkMode ? 'text-slate-300' : 'text-slate-700') : 'text-gray-300 font-extrabold'
                }`}>
                    <Activity size={16} className="text-purple-500" /> API Traffic by Module
                </h3>
                <div className="w-full relative">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={apiTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke={isModern ? (isDarkMode ? '#64748B' : '#94A3B8') : '#94A3B8'} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: isModern ? (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)') : 'rgba(255, 255, 255, 0.05)' }} 
                        contentStyle={{ 
                          backgroundColor: isModern ? (isDarkMode ? '#0F172A' : '#FFFFFF') : 'rgba(0,0,0,0.9)', 
                          border: `1px solid ${isModern ? (isDarkMode ? '#334155' : '#E2E8F0') : '#333'}`, 
                          borderRadius: '10px', 
                          color: isModern ? (isDarkMode ? '#FFFFFF' : '#0F172A') : '#fff',
                          boxShadow: isModern ? '0 10px 25px rgba(0,0,0,0.1)' : 'none'
                        }} 
                      />
                      <Bar dataKey="reqs" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
          </div>
        </div>

        {/* Right Side: WhatsApp Monitor */}
        <div className={`xl:col-span-1 rounded-2xl flex flex-col overflow-hidden relative z-10 ${
          isModern 
            ? (isDarkMode ? 'bg-[#111827] border border-slate-800 shadow-sm' : 'bg-white border border-slate-200 shadow-sm')
            : 'bg-gradient-to-b from-[#0f172a] to-[#020617] border border-emerald-500/20 rounded-3xl shadow-[0_0_30px_rgba(16,185,129,0.1)] backdrop-blur-xl'
        }`}>
          {/* Header */}
          <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
            isModern 
              ? (isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200')
              : 'bg-[#111]/90 backdrop-blur-md border-emerald-500/20'
          }`}>
            <div className="flex items-center gap-2.5">
              <MessageCircle size={18} className="text-emerald-500" />
              <div>
                <p className={`text-[13px] font-bold tracking-wider ${
                  isModern ? (isDarkMode ? 'text-white' : 'text-slate-800') : 'text-white'
                }`}>
                  WhatsApp & Meta Monitor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefreshWa}
                disabled={waRefreshing}
                title="Refresh WhatsApp Status & Meta Billing"
                className={`p-1.5 rounded-lg border transition-all ${
                  isModern 
                    ? (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900') 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <RefreshCw size={13} className={waRefreshing ? 'animate-spin' : ''} />
              </button>
              <div className="text-[10px] text-emerald-500 font-mono flex items-center gap-1.5 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                <span>LIVE</span>
                {waStatus && waStatus.length > 0 && (
                  <span className="text-emerald-400 font-bold ml-0.5">({waStatus.length})</span>
                )}
              </div>
            </div>
          </div>

          {/* Top Meta Payments Due & Balance Overview Banner */}
          <div className={`p-4 border-b ${
            isModern 
              ? (isDarkMode ? 'bg-gradient-to-r from-emerald-950/20 via-slate-900 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-emerald-50 via-white to-slate-50 border-slate-200')
              : 'bg-gradient-to-r from-emerald-950/40 via-[#0a1120] to-[#020617] border-emerald-500/20'
          }`}>
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase flex items-center gap-1">
                  <CreditCard size={11} className="text-emerald-400" />
                  Meta Due & Spend (ගෙවිය යුතු මුදල)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-xl font-black font-mono tracking-tight ${
                    isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white'
                  }`}>
                    ${waBilling?.totalMonthCostUsd?.toFixed(2) || '0.00'} <span className="text-xs font-bold text-emerald-500">USD</span>
                  </span>
                  <span className="text-[11.5px] font-mono text-gray-400">
                    ≈ Rs. {(waBilling?.totalMonthCostLkr || 0).toLocaleString()} LKR
                  </span>
                </div>
              </div>

              {/* Payment Method Status Pill */}
              <div className="text-right">
                {waBilling?.paymentMethodStatus === 'FAILED' ? (
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-sm">
                    <AlertCircle size={12} className="text-rose-500 animate-pulse" />
                    <span>Card Failed</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span>Card Active</span>
                  </div>
                )}
                <p className="text-[9px] text-gray-500 font-sans mt-1">
                  {waBilling?.totalMessagesThisMonth ? `${waBilling.totalMessagesThisMonth.toLocaleString()} msgs this mo.` : 'Auto-debit ready'}
                </p>
              </div>
            </div>

            {/* Category Spend Pills & Restriction Alerts */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/40">
              {waBilling?.categories?.map((cat, i) => (
                <div key={i} className={`px-2 py-0.5 rounded-md text-[9.5px] font-medium flex items-center gap-1 ${
                  cat.category === 'MARKETING'
                    ? (isDarkMode ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200')
                    : cat.category === 'SERVICE'
                    ? (isDarkMode ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200')
                    : (isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200')
                }`}>
                  <span className="capitalize">{cat.category ? String(cat.category).toLowerCase().replace(/_/g, ' ') : 'Other'}:</span>
                  <span className="font-mono font-bold">${cat.costUsd ?? '0.00'}</span>
                  <span className="text-[8.5px] opacity-75">({(cat.count || 0).toLocaleString()})</span>
                </div>
              ))}

              {waBilling?.restrictedAccounts?.length > 0 && (
                <div className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle size={10} className="text-rose-500" />
                  <span>{waBilling.restrictedAccounts.length} Meta Account Restricted</span>
                </div>
              )}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className={`px-3 py-2 flex items-center gap-1 border-b ${
            isModern 
              ? (isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200') 
              : 'bg-black/30 border-gray-800'
          }`}>
            <button 
              onClick={() => setWaActiveTab('numbers')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                waActiveTab === 'numbers'
                  ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm')
                  : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <MessageCircle size={12} />
              <span>Numbers & Tiers</span>
              {waStatus && <span className="text-[10px] opacity-80">({waStatus.length})</span>}
            </button>

            <button 
              onClick={() => setWaActiveTab('billing')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                waActiveTab === 'billing'
                  ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm')
                  : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <CreditCard size={12} />
              <span>Meta Spend</span>
            </button>

            <button 
              onClick={() => setWaActiveTab('alerts')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                waActiveTab === 'alerts'
                  ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm')
                  : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
              }`}
            >
              <AlertTriangle size={12} />
              <span>Alerts</span>
              {waAlerts.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {waAlerts.length}
                </span>
              )}
            </button>
          </div>
          
          {/* TAB 1: Numbers & Daily Messaging Limit Tiers */}
          {waActiveTab === 'numbers' && (
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto max-h-[520px] scroll-smooth custom-scrollbar">
              {waStatus && waStatus.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {waStatus.map((status, index) => {
                    const isNameDeclined = status.name_status === 'DECLINED';
                    const isRestricted = status.status === 'RESTRICTED' || status.status === 'FLAGGED';
                    return (
                      <div key={status.id || index} className={`p-3 rounded-xl flex flex-col justify-between border transition-all ${
                        isRestricted
                          ? 'bg-rose-500/10 border-rose-500/30 shadow-md'
                          : isModern 
                            ? (isDarkMode ? 'bg-[#0f172a] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300')
                            : 'bg-[#0f172a] border-slate-700/50 shadow-lg hover:border-emerald-500/30'
                      }`}>
                        {/* Name & Name Verification Status */}
                        <div className="mb-2">
                          <div className="flex items-start justify-between gap-1">
                            <p className={`text-[12.5px] font-bold truncate font-sans tracking-wide ${
                              isModern ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-white'
                            }`} title={status.verified_name || 'Business Account'}>
                              {status.verified_name || 'Business Account'}
                            </p>
                            {isNameDeclined ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                                DECLINED
                              </span>
                            ) : status.name_status === 'APPROVED' ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                                APPROVED
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-emerald-400 font-mono mt-0.5 opacity-90 truncate">
                            {status.display_phone_number || status.id}
                          </p>
                        </div>

                        {/* Messaging Limit Tier & Monthly Spend */}
                        <div className="space-y-1.5 my-2 pt-2 border-t border-slate-800/40">
                          {/* Limit Tier */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400 font-medium flex items-center gap-1">
                              <Gauge size={11} className="text-sky-400" />
                              දෛනික සීමාව:
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              {status.tier_limit || '1,000 / Day'}
                            </span>
                          </div>

                          {/* Spend this month */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400 font-medium flex items-center gap-1">
                              <DollarSign size={11} className="text-emerald-400" />
                              මාසයේ වියදම:
                            </span>
                            <span className="font-mono font-bold text-slate-200">
                              ${status.month_spend_usd !== undefined && status.month_spend_usd !== null ? Number(status.month_spend_usd).toFixed(2) : '0.00'} 
                              <span className="text-[8.5px] text-gray-400 font-normal ml-1">
                                ({(status.month_messages || 0).toLocaleString()} msgs)
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Footer: Quality & Connection Status */}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/40">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">QLTY</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              status.quality_rating === 'GREEN' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm' :
                              status.quality_rating === 'YELLOW' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm' :
                              'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm'
                            }`}>
                              {status.quality_rating || 'UNKNOWN'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">STS</span>
                            <span className={`text-[10px] font-bold font-sans ${
                              status.status === 'CONNECTED' ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {status.status || 'OFFLINE'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2">
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                  <p className="text-xs">Loading WhatsApp numbers & limits from Meta...</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Meta Spend, Due & Account Restrictions */}
          {waActiveTab === 'billing' && (
            <div className="flex-1 p-4 overflow-y-auto max-h-[520px] scroll-smooth custom-scrollbar space-y-4">
              {/* Outstanding Due Card */}
              <div className={`p-4 rounded-xl border ${
                isModern 
                  ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')
                  : 'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-500" />
                    <p className={`text-xs font-bold uppercase tracking-wider ${
                      isModern ? (isDarkMode ? 'text-white' : 'text-slate-800') : 'text-white'
                    }`}>
                      Current Outstanding Meta Balance (ගෙවීමට ඇති මුදල)
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Accrued Spend
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className={`p-3 rounded-lg border ${
                    isModern ? (isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200') : 'bg-black/40 border-gray-800'
                  }`}>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Outstanding (USD)</p>
                    <p className="text-lg font-black font-mono text-emerald-400 mt-1">
                      ${waBilling?.outstandingDueUsd?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    isModern ? (isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200') : 'bg-black/40 border-gray-800'
                  }`}>
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Estimated LKR</p>
                    <p className="text-lg font-black font-mono text-slate-200 mt-1">
                      Rs. {(waBilling?.outstandingDueLkr || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  මෙම මුදල WhatsApp සංවාද (Conversations) සඳහා Meta සමාගමට auto-debit වීමට ඇති මුදලයි. Link කර ඇති Card එකෙන් billing cycle එක අවසානයේදී හෝ payment threshold එකේදී auto-charge වේ.
                </p>
              </div>

              {/* Payment Method Status & Card Health */}
              <div className={`p-4 rounded-xl border ${
                waBilling?.paymentMethodStatus === 'FAILED'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : isModern 
                    ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')
                    : 'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold flex items-center gap-2">
                    <ShieldCheck size={16} className={waBilling?.paymentMethodStatus === 'FAILED' ? 'text-rose-500' : 'text-emerald-500'} />
                    <span>Payment Method / Card Status</span>
                  </p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    waBilling?.paymentMethodStatus === 'FAILED' 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {waBilling?.paymentMethodStatus === 'FAILED' ? 'FAILED / ACTION REQUIRED' : 'ACTIVE & HEALTHY'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {waBilling?.paymentMethodStatus === 'FAILED' 
                    ? 'Card එකෙන් මුදල් අයවීම fail වී ඇත හෝ limit එක ඉක්මවා ඇත. වහාම Meta Business Manager හි Billing Settings පරීක්ෂා කරන්න.' 
                    : 'Meta Ad Account / WhatsApp Business Account එකට link කර ඇති Card එක Active තත්ත්වයේ පවතී. ගෙවීම් ගැටලු වාර්තා වී නොමැත.'}
                </p>
              </div>

              {/* Connected WABA Accounts & Account Restrictions */}
              <div className={`p-4 rounded-xl border ${
                isModern ? (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200') : 'bg-black/30 border-gray-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-gray-300">
                    <Layers size={14} className="text-blue-400" />
                    Meta Business Accounts ({waBilling?.wabaAccounts?.length || 0})
                  </p>
                  {waBilling?.restrictedAccounts?.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {waBilling.restrictedAccounts.length} Restricted
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {waBilling?.wabaAccounts?.map((waba, idx) => {
                    const isRejected = waba.account_review_status && waba.account_review_status !== 'APPROVED';
                    return (
                      <div key={waba.id || idx} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        isRejected 
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' 
                          : isModern ? (isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200') : 'bg-black/40 border-gray-800'
                      }`}>
                        <div className="truncate mr-2">
                          <p className="font-bold truncate text-[11.5px]">{waba.name || 'WABA Account'}</p>
                          <p className="text-[10px] text-gray-500 font-mono">ID: {waba.id}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                          isRejected 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {waba.account_review_status || 'APPROVED'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Live Alerts & Security */}
          {waActiveTab === 'alerts' && (
            <div className="flex-1 p-4 overflow-y-auto max-h-[520px] scroll-smooth custom-scrollbar">
              {waAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 py-14">
                  <CheckCircle2 size={40} className="text-emerald-500/30" />
                  <p className="text-sm font-medium">All systems normal. No alerts yet.</p>
                  <p className="text-xs text-gray-600">Meta webhooks, payment alerts & quality updates will appear here in real-time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {waAlerts.map((alert, idx) => {
                    const lowerMsg = (alert?.message || '').toLowerCase();
                    const alertTypeStr = String(alert?.alertType || '');
                    const isPaymentAlert = lowerMsg.includes('payment') || lowerMsg.includes('card') || lowerMsg.includes('limit');
                    const isCritical = isPaymentAlert || alertTypeStr.includes('block') || lowerMsg.includes('reject');
                    return (
                      <div key={alert?.id || idx} className={`p-4 rounded-xl border transition-all ${
                        isPaymentAlert
                          ? 'bg-rose-500/15 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                          : isModern 
                            ? (isCritical 
                                ? 'bg-rose-500/10 border-rose-500/30' 
                                : (isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'))
                            : (isCritical 
                                ? 'bg-rose-500/10 border-rose-500/30 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] backdrop-blur-sm' 
                                : 'bg-emerald-500/5 border-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] backdrop-blur-sm')
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5">
                            {isPaymentAlert && <CreditCard size={12} className="text-rose-400" />}
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {isPaymentAlert ? 'PAYMENT ALERT' : alertTypeStr.replace(/_/g, ' ') || 'SYSTEM ALERT'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {alert?.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <p className={`text-sm font-medium ${
                          isModern ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : 'text-gray-200'
                        }`}>
                          {alert?.message || 'System notification received'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

function StatCard({ title, value, icon, trend, trendColor, isModern, isDarkMode }) {
  if (isModern) {
    if (isDarkMode) {
      return (
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">{title}</p>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 group-hover:scale-105 transition-transform">
              {icon}
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <h4 className="text-3xl font-extrabold text-white tracking-tight">{value}</h4>
            {trend && (
              <span className={`text-xs font-semibold ${trendColor} bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50`}>
                {trend}
              </span>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">{title}</p>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 group-hover:scale-105 transition-transform">
              {icon}
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <h4 className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</h4>
            {trend && (
              <span className={`text-xs font-semibold ${trendColor} bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200`}>
                {trend}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] hover:-translate-y-1 flex flex-col justify-between group relative overflow-hidden z-10">
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-2 relative z-10">
        <p className="text-[11px] font-extrabold text-gray-400 tracking-widest uppercase">{title}</p>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors shadow-inner">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between mt-4 relative z-10">
        <h4 className="text-3xl md:text-4xl font-black text-white truncate tracking-tight drop-shadow-md">{value}</h4>
        {trend && (
          <span className={`text-xs font-bold ${trendColor} mb-1 bg-white/5 px-2.5 py-1 rounded-md backdrop-blur-sm border border-white/5 shadow-sm`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
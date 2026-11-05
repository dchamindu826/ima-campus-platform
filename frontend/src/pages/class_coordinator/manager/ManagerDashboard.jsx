import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../../api/axios';
import { 
  FaUsers, FaBookOpen, FaFilter, FaMoneyBillWave, FaSpinner, FaCircle,
  FaCalendarCheck, FaClock, FaChalkboardTeacher, FaComments, FaCalendarAlt, FaReplyAll, FaChartLine,
  FaTruck, FaExclamationCircle, FaUserClock, FaChartPie, FaCheckCircle, FaInbox, FaBox
} from 'react-icons/fa';
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

import DelegateSocialMediaTaskModal from '../../../components/common/DelegateSocialMediaTaskModal';
import WhatsAppMetaMonitor from '../../../components/WhatsAppMetaMonitor/WhatsAppMetaMonitor';

export default function ManagerDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);

  const [businesses, setBusinesses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('ALL');

  const [stats, setStats] = useState({
    activeStudentsCount: 0,
    totalRevenue: 0,
    activeBatchesCount: 0,
    crmMessages: { received: 0, replied: 0 },
    coordinatorStats: [],
    todayClasses: [],
    leadStats: { total: 0, assigned: 0, unassigned: 0, openSem: 0, newInq: 0, bridge: 0 },
    mixerData: [],
    deliveryStats: { pending: 0, dispatched: 0, delivered: 0, hold: 0 },
    pendingTasks: 0
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    fetchBusinessesAndBatches();
  }, []);

  const fetchBusinessesAndBatches = async () => {
    try {
      const res = await axios.get('/admin/manager/batches-full');
      const allBatches = res.data;
      setBatches(allBatches);

      const uniqueBiz = [];
      const bizMap = new Map();
      allBatches.forEach(b => {
        if (b.business && !bizMap.has(b.business.id)) {
          bizMap.set(b.business.id, b.business);
          uniqueBiz.push(b.business);
        }
      });
      setBusinesses(uniqueBiz);
    } catch (err) {
      console.error("Error loading filters", err);
    }
  };

  const rawRole = user?.role || '';
  const userRole = rawRole.toUpperCase().replace(/ /g, '_');
  const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
  const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);

  const displayBusinesses = useMemo(() => {
    if (isAdmin) return businesses;
    if (isManager) {
      return businesses.filter(biz => {
        const isManagerOf = biz.head_manager_id === user?.id || biz.ass_manager_id === user?.id;
        const matchesBizType = user?.businessType && (
          String(biz.id) === String(user.businessType).trim() ||
          biz.name.toLowerCase().trim() === String(user.businessType).toLowerCase().trim() ||
          biz.name.toLowerCase().includes(String(user.businessType).toLowerCase().trim()) ||
          String(user.businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
        );
        return isManagerOf || matchesBizType;
      });
    }
    return [];
  }, [businesses, isAdmin, isManager, user]);

  useEffect(() => {
    if (displayBusinesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(String(displayBusinesses[0].id));
    }
  }, [displayBusinesses, selectedBusiness]);

  const displayBatches = useMemo(() => {
    if (!selectedBusiness) return [];
    if (selectedBusiness === 'ALL') {
      const allowedBizIds = new Set(displayBusinesses.map(b => b.id));
      return batches.filter(b => allowedBizIds.has(b.businessId));
    }
    return batches.filter(b => b.businessId === parseInt(selectedBusiness));
  }, [batches, selectedBusiness, displayBusinesses]);

  useEffect(() => {
    if (selectedBusiness) fetchManagerStats();
    else setLoading(false);
  }, [selectedBusiness, selectedBatch]);

  const fetchManagerStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get('/admin/manager/dashboard-stats', {
        params: { businessId: selectedBusiness, batchId: selectedBatch || 'ALL' }
      });
      if (res.data) setStats(res.data);
    } catch (error) {
      console.error("Error loading manager stats:", error);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-brand-accent" />
      </div>
    );
  }

  const activeBusinessName = selectedBusiness === 'ALL' 
    ? 'All My Businesses' 
    : (businesses.find(b => String(b.id) === selectedBusiness)?.name || 'My Branch');
  const formatCurrency = (amount) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(amount);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const LEAD_COLORS = ['#ec4899', '#3b82f6', '#f59e0b'];
  const leadTypeData = [
    { name: 'Open Seminar', value: stats.leadStats.openSem },
    { name: 'New Inquiries', value: stats.leadStats.newInq },
    { name: 'Bridge Transfer', value: stats.leadStats.bridge }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in text-left pb-10 max-w-[1600px] mx-auto">
      
      {/* 🔹 Top Banner Greet & Filter (Compact) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/5 backdrop-blur-md p-5 rounded-[2rem] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            System Overview <span className="text-brand-accent">({activeBusinessName})</span>
          </h2>
          <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
            <FaCalendarAlt /> {today}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-[#1a2430]/60 px-4 py-2 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <FaFilter className="text-brand-accent shrink-0 text-sm" />
            {(isAdmin || (isManager && displayBusinesses.length > 1)) && (
              <select
                value={selectedBusiness}
                onChange={(e) => { setSelectedBusiness(e.target.value); setSelectedBatch('ALL'); }}
                className="bg-transparent text-gray-800 dark:text-slate-300 text-xs font-bold rounded-xl px-2 outline-none cursor-pointer"
              >
                {displayBusinesses.length > 1 && (
                  <option value="ALL" className="bg-white dark:bg-[#1a2430]">All My Businesses</option>
                )}
                {displayBusinesses.map(biz => <option key={biz.id} value={biz.id} className="bg-white dark:bg-[#1a2430]">{biz.name}</option>)}
              </select>
            )}
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent text-gray-800 dark:text-slate-300 text-xs font-bold rounded-xl px-2 outline-none cursor-pointer border-l border-gray-300 dark:border-white/10 ml-2 pl-3"
            >
              <option value="ALL" className="bg-white dark:bg-[#1a2430]">All Batches</option>
              {displayBatches.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-[#1a2430]">{b.name}</option>)}
            </select>
          </div>
          <Link
            to="/manager/tute-stock"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl border border-amber-400/30 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <span>📦</span> Tute Stock & Calendar
          </Link>
          <button 
            onClick={() => setIsDelegateModalOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl border border-indigo-400/30 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <span>🚀</span> Delegate Work
          </button>
          <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-black tracking-widest uppercase border border-emerald-200 dark:border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm">
            <FaCircle className="text-[7px] animate-pulse text-emerald-500" /> Live
          </span>
        </div>
      </div>

      <DelegateSocialMediaTaskModal 
        isOpen={isDelegateModalOpen} 
        onClose={() => setIsDelegateModalOpen(false)} 
        loggedInUser={user} 
      />

      {statsLoading ? (
        <div className="flex flex-col justify-center items-center h-[300px] text-brand-accent font-sans font-black gap-4 bg-white/50 dark:bg-white/[0.02] rounded-[2rem] border border-white/5 backdrop-blur-md">
          <FaSpinner className="animate-spin text-4xl" /> Analyzing System Data...
        </div>
      ) : (
        <>
          {/* 🔹 Row 1: Massive KPI Grid (6 Columns on Large Screens) */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* Verified Revenue */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">Revenue</p>
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex justify-center items-center"><FaMoneyBillWave size={14}/></div>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white truncate">{formatCurrency(stats.totalRevenue)}</h2>
            </div>

            {/* Total Leads & Unassigned Alert */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">CRM Leads</p>
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl flex justify-center items-center"><FaUsers size={14}/></div>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                {stats.leadStats.total}
                {stats.leadStats.unassigned > 0 && <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md flex items-center gap-1"><FaExclamationCircle/> {stats.leadStats.unassigned} unassigned</span>}
              </h2>
            </div>

            {/* Active Students */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">Active Students</p>
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl flex justify-center items-center"><FaUserClock size={14}/></div>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{stats.activeStudentsCount}</h2>
            </div>

            {/* Logistics Preview */}
            <Link to="/manager/tute-stock" className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group cursor-pointer block">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">Tutes & Delivery</p>
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex justify-center items-center group-hover:scale-110 transition-transform"><FaTruck size={14}/></div>
              </div>
              <div className="flex gap-2 text-xs font-black">
                <span className="text-gray-700 dark:text-slate-300 flex items-center gap-1"><FaClock className="text-amber-500"/> {stats.deliveryStats.pending}</span>
                <span className="text-gray-700 dark:text-slate-300 flex items-center gap-1"><FaCheckCircle className="text-emerald-500"/> {stats.deliveryStats.delivered}</span>
              </div>
            </Link>

            {/* System Tasks */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">System Tasks</p>
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex justify-center items-center"><FaInbox size={14}/></div>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{stats.pendingTasks} Pending</h2>
            </div>

            {/* WhatsApp CRM Msgs Today */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-gray-200 dark:border-white/10 shadow-lg hover:-translate-y-1 transition-transform group">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[9px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest">Today's CRM Msgs</p>
                <div className="w-8 h-8 bg-brand-accentLight dark:bg-brand-accent/20 text-brand-accent rounded-xl flex justify-center items-center"><FaComments size={14}/></div>
              </div>
              <div className="flex gap-2 text-xs font-black">
                <span className="text-gray-700 dark:text-slate-300">In: {stats.crmMessages.received}</span>
                <span className="text-brand-accent">Out: {stats.crmMessages.replied}</span>
              </div>
            </div>
          </div>

          {/* 🔹 Row 2: Deep Analytics & Academic Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Subject Enrollment Breakdown */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-xl lg:col-span-2 flex flex-col">
              <h3 className="text-xs font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center justify-between border-b border-gray-200 dark:border-white/5 pb-4">
                <span className="flex items-center gap-2"><FaChartLine className="text-brand-accent"/> Course Enrollments (Payment Plans)</span>
              </h3>
              <div className="flex-1 min-h-[260px]">
                {(!stats.mixerData || stats.mixerData.length === 0) ? (
                   <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-500 text-sm font-bold bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-6">
                     No course enrollment data found.
                   </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.mixerData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                      <XAxis dataKey="subject" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} angle={-15} textAnchor="end"/>
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '11px', fontWeight: 'bold' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar dataKey="full" name="Full Payment" fill="#ec4899" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="monthly" name="Monthly" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="installment" name="Installments" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Campaign Source Breakdown Pie */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-xl flex flex-col">
              <h3 className="text-xs font-black text-gray-900 dark:text-white mb-2 uppercase tracking-widest flex items-center justify-between border-b border-gray-200 dark:border-white/5 pb-4">
                <span className="flex items-center gap-2"><FaChartPie className="text-indigo-500"/> Inquiry Sources</span>
              </h3>
              <div className="flex-1 h-[220px] relative mt-2">
                {leadTypeData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-500 text-sm font-bold bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-6">
                    No leads found.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={leadTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                        {leadTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={LEAD_COLORS[index % LEAD_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex justify-around items-center text-[9px] font-black uppercase text-gray-500 dark:text-slate-400 mt-4">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span> Open Sem</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> New Inq</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Bridge</span>
              </div>
            </div>

          </div>

          {/* 🔹 Row 3: Live Operations (Classes & Coordinator Coverage) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Coordinator Daily Performance */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-xl flex flex-col h-[380px]">
              <h3 className="text-xs font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest flex items-center justify-between border-b border-gray-200 dark:border-white/5 pb-4">
                <span className="flex items-center gap-2"><FaUserClock className="text-brand-accent"/> Today's Lead Coverage</span>
                <span className="text-[9px] bg-brand-accentLight dark:bg-brand-accent/20 text-brand-accent px-2 py-1 rounded-md border border-brand-accent/20">Team Activity</span>
              </h3>
              <div className="flex-1">
                {(!stats.coordinatorStats || stats.coordinatorStats.length === 0) ? (
                  <div className="flex flex-col h-full items-center justify-center text-gray-500 dark:text-slate-500 text-sm font-bold gap-3 bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-6">
                    <FaUserClock size={28} className="text-gray-300 dark:text-slate-600"/>
                    No leads actioned by staff today.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.coordinatorStats} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} angle={-15} textAnchor="end"/>
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }} />
                      <Bar dataKey="leadsCovered" name="Leads Covered Today" fill="#FF5F56" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {stats.coordinatorStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#FF5F56' : '#FFBD2E'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Today's Classes */}
            <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-xl flex flex-col h-[380px]">
              <h3 className="text-xs font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest flex items-center justify-between border-b border-gray-200 dark:border-white/5 pb-4">
                <span className="flex items-center gap-2"><FaCalendarCheck className="text-blue-500"/> Scheduled Classes</span>
                <span className="text-[9px] bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-500/30">Today</span>
              </h3>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {(!stats.todayClasses || stats.todayClasses.length === 0) ? (
                  <div className="flex flex-col h-full items-center justify-center text-gray-500 dark:text-slate-500 text-sm font-bold gap-3 bg-gray-50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-6 text-center">
                    <FaChalkboardTeacher size={28} className="text-gray-300 dark:text-slate-600"/>
                    No classes scheduled for today.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.todayClasses.map((cls, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 group-hover:w-2 transition-all"></div>
                        <div className="pl-3">
                          <h4 className="text-gray-900 dark:text-white font-black text-sm flex justify-between items-center">
                            {cls.subjectName || 'Class'}
                            <span className="text-[10px] bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-gray-200 dark:border-white/10 font-bold shadow-sm">
                              {cls.batch?.name || 'All Batches'}
                            </span>
                          </h4>
                          <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-bold text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1 bg-white/50 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-200 dark:border-white/5">
                              <FaClock className="text-brand-accent"/> {cls.startTime} - {cls.endTime}
                            </span>
                            <span className="flex items-center gap-1 bg-white/50 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-200 dark:border-white/5">
                              <FaChalkboardTeacher className="text-emerald-500"/> {cls.lecturerName || 'Lecturer'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* 🔹 Row 4: WhatsApp Status, Limits & Meta Billing for Manager's Business */}
          <div className="w-full pt-2">
            <WhatsAppMetaMonitor 
              businessId={selectedBusiness}
              businessIds={selectedBusiness === 'ALL' ? displayBusinesses.map(b => b.id).join(',') : undefined}
              businessName={selectedBusiness === 'ALL' ? 'All My Businesses' : activeBusinessName}
            />
          </div>
        </>
      )}
    </div>
  );
}
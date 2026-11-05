import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { 
  Building2, ChevronRight, BarChart3, Download, RefreshCw, Users,
  Calendar, Clock, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import CoordinatorStatsBreakdown from './CoordinatorStatsBreakdown';

export default function OverviewTab() {
  const [businesses, setBusinesses] = useState([]);
  const [overviewBiz, setOverviewBiz] = useState(null);
  const [overviewCampaign, setOverviewCampaign] = useState('FREE_SEMINAR');
  const [overviewBatch, setOverviewBatch] = useState('All');
  const [overviewLeads, setOverviewLeads] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Date & Time Range Filter States
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Quick Round Management States
  const [quickCampaign, setQuickCampaign] = useState('FREE_SEMINAR');
  const [quickBiz, setQuickBiz] = useState('');
  const [quickBatch, setQuickBatch] = useState('All');
  const [quickBatches, setQuickBatches] = useState([]);
  const [quickActiveRound, setQuickActiveRound] = useState(1);
  const [quickLoading, setQuickLoading] = useState(false);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    if (preset === 'TODAY') {
      const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T00:00`;
      const endStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const startStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T00:00`;
      const endStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T23:59`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (preset === 'THIS_WEEK') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const startStr = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}T00:00`;
      const endStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (preset === 'THIS_MONTH') {
      const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01T00:00`;
      const endStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/admin/businesses', { headers: { Authorization: `Bearer ${token}` } });
      setBusinesses(response.data || []);
    } catch (error) { console.error("Failed to load businesses", error); }
  };

  const fetchBatches = async (bizId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/admin/batches/${bizId}`, { headers: { Authorization: `Bearer ${token}` } });
      setBatches(Array.isArray(res.data) ? res.data : (res.data?.batches || []));
    } catch (error) { console.error("Failed to fetch batches", error); }
  };

  useEffect(() => {
    if (quickBiz) {
      const fetchQuickBatches = async () => {
         const token = localStorage.getItem('token');
         try {
           const res = await axios.get(`/admin/batches/${quickBiz}`, { headers: { Authorization: `Bearer ${token}` } });
           setQuickBatches(Array.isArray(res.data) ? res.data : (res.data?.batches || []));
         } catch (e) { console.error(e); }
      };
      fetchQuickBatches();
      fetchQuickRound();
    } else {
      setQuickBatches([]);
      setQuickActiveRound(1);
    }
  }, [quickBiz]);

  useEffect(() => {
    if (quickBiz) fetchQuickRound();
  }, [quickCampaign, quickBatch]);

  const fetchQuickRound = async () => {
     setQuickLoading(true);
     try {
       const token = localStorage.getItem('token');
       const res = await axios.get('/call-center/manager/leads', { 
         headers: { Authorization: `Bearer ${token}` }, 
         params: { businessId: quickBiz, campaignType: quickCampaign, assignedStatus: 'all' } 
       });
       const leads = res.data || [];
       const filtered = leads.filter(l => quickBatch === 'All' || l.batchId === parseInt(quickBatch));
       let round = 1;
       if (filtered.length > 0) {
         const rounds = filtered.map(l => l.roundProgress?.[0]?.roundNum || l.coordinationRound || 1);
         round = Math.max(...rounds);
       }
       setQuickActiveRound(round);
     } catch (e) {
       console.error(e);
     } finally {
       setQuickLoading(false);
     }
  };

  const handleQuickStartRound2 = async () => {
    if (!quickBiz) return toast.error("Please select a business first");
    if (!window.confirm(`Are you sure you want to start Round 2 for this batch in ${quickCampaign}?`)) return;
    try {
      const token = localStorage.getItem('token');
      if (quickCampaign === 'BRIDGE') {
        await axios.post('/after-seminar-crm/bridge/call-center/start-round-two', {
          businessId: quickBiz,
          batchId: quickBatch !== 'All' ? parseInt(quickBatch) : undefined
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post('/call-center/manager/start-round', {
          businessId: quickBiz,
          campaignType: quickCampaign,
          batchId: quickBatch
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      toast.success('Round 2 Started successfully!');
      fetchQuickRound();
    } catch (err) {
      toast.error('Failed to start Round 2');
    }
  };

  const fetchLeads = async (bizId, campaignType) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/call-center/manager/leads', { 
        headers: { Authorization: `Bearer ${token}` }, 
        params: { businessId: bizId, campaignType, assignedStatus: 'all' } 
      });
      setOverviewLeads(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imageName) => {
    if (!imageName || imageName === 'default.png' || imageName === 'null') return '/logo.png';
    return `${axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : 'https://imacampus.online'}/storage/icons/${imageName}`;
  };

  const handleExportExcel = () => {
    const filtered = overviewLeads.filter(l => overviewBatch === 'All' || l.batchId === parseInt(overviewBatch));
    const ws = XLSX.utils.json_to_sheet(filtered.map(l => ({
      'Lead ID': l.id,
      'Lead Name': l.name || `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      'Phone': l.phone,
      'Campaign': l.campaignType,
      'Batch': l.batch?.name || 'N/A',
      'Assigned Agent': l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : 'Unassigned',
      'Call Status': l.callCenterStatus || 'PENDING',
      'Attempts': l.callAttempt || 0,
      'Feedback': l.feedback || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads Report");
    XLSX.writeFile(wb, `Report_${overviewBiz.name}_${overviewCampaign}.xlsx`);
  };

  const handleStartRound2 = async () => {
    if (!window.confirm(`Are you sure you want to start Round 2 for this batch in ${overviewCampaign}? This will reset the statuses of leads in this batch to pending for another round of calls.`)) return;
    try {
      const token = localStorage.getItem('token');
      if (overviewCampaign === 'BRIDGE') {
        await axios.post('/after-seminar-crm/bridge/call-center/start-round-two', {
          businessId: overviewBiz.id,
          batchId: overviewBatch !== 'All' ? parseInt(overviewBatch) : undefined
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post('/call-center/manager/start-round', {
          businessId: overviewBiz.id,
          campaignType: overviewCampaign,
          batchId: overviewBatch
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      toast.success('Round 2 Started for Batch!');
      fetchLeads(overviewBiz.id, overviewCampaign);
    } catch (err) {
      toast.error('Failed to start Round 2');
    }
  };

  return (
    <div className="animate-fade-in h-full overflow-y-auto custom-scrollbar pr-2 flex flex-col">
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
        <h2 className="text-xl font-extrabold flex items-center gap-2 text-red-200 uppercase tracking-wider">
          <BarChart3 className="text-red-400" /> Operational Reports
        </h2>
        {overviewBiz && (
           <button 
             onClick={() => { setOverviewBiz(null); setOverviewBatch('All'); setOverviewLeads([]); }}
             className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors text-slate-200 flex items-center gap-2"
           >
             <ChevronRight className="rotate-180" size={16}/> Back to Businesses
           </button>
        )}
      </div>

      {/* Quick Round Management Section */}
      {!overviewBiz && (
        <div className="mb-8 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-[2rem] p-6 shadow-[0_8px_32px_0_rgba(79,70,229,0.15)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 blur-[80px] opacity-20 pointer-events-none rounded-full bg-purple-500"></div>
          
          <div className="flex-1 w-full flex flex-col xl:flex-row gap-4 relative z-10">
            <div className="flex items-center gap-3 w-full xl:w-auto">
               <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-400 shrink-0 border border-indigo-500/30">
                 <RefreshCw size={20} />
               </div>
               <div>
                 <h3 className="text-white font-black text-lg">Quick Round Management</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Round 2 for any campaign</p>
               </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <select 
                value={quickCampaign} 
                onChange={(e) => setQuickCampaign(e.target.value)}
                className="bg-black/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-400 outline-none font-bold shadow-inner"
              >
                <option value="FREE_SEMINAR">Free Sem</option>
                <option value="AFTER_SEMINAR">After Sem</option>
                <option value="BRIDGE">Bridge</option>
              </select>

              <select 
                value={quickBiz} 
                onChange={(e) => { setQuickBiz(e.target.value); setQuickBatch('All'); }}
                className="bg-black/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-400 outline-none font-bold shadow-inner flex-1"
              >
                <option value="">-- Select Business --</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select 
                value={quickBatch} 
                onChange={(e) => setQuickBatch(e.target.value)}
                disabled={!quickBiz}
                className="bg-black/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-400 outline-none font-bold shadow-inner flex-1 disabled:opacity-50"
              >
                <option value="All">All Batches</option>
                {quickBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10 shrink-0 w-full md:w-auto border-t border-white/10 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0 mt-2 md:mt-0">
             <div className="text-center pr-4 border-r border-white/10">
               <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300/80">Active Round</p>
               <div className="flex items-center justify-center gap-2 mt-1">
                 {quickLoading ? <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div> : <span className="text-3xl font-black text-indigo-400">R{quickActiveRound}</span>}
               </div>
             </div>
             
             <button 
               onClick={handleQuickStartRound2}
               disabled={!quickBiz || quickLoading}
               className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50 flex-1 md:flex-none text-center"
             >
               Start Round 2
             </button>
          </div>
        </div>
      )}

      {!overviewBiz ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-8">
          {businesses.map(biz => (
            <div 
              key={biz.id}
              onClick={() => {
                setOverviewBiz(biz);
                fetchBatches(biz.id);
                fetchLeads(biz.id, overviewCampaign);
              }}
              className="group cursor-pointer bg-white/[0.05] backdrop-blur-2xl hover:border-red-500/50 border border-white/10 p-6 md:p-8 rounded-[2rem] flex flex-col gap-6 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 pointer-events-none rounded-full bg-red-500 transition-opacity group-hover:opacity-40"></div>
              <div className="flex-1 w-full bg-black/40 rounded-2xl flex items-center justify-center p-8 relative aspect-video border border-white/5 overflow-hidden">
                {biz.logo ? (
                  <img src={getImageUrl(biz.logo)} alt="logo" className="w-full h-full object-contain relative z-0 group-hover:scale-110 transition-transform duration-700" onError={(e) => e.target.src = '/logo.png'} />
                ) : (
                  <Building2 className="text-red-400/50 w-24 h-24 relative z-0 group-hover:scale-110 transition-transform duration-700" />
                )}
              </div>
              <div className="relative z-20 shrink-0">
                <h3 className="text-xl font-black text-slate-200 group-hover:text-red-300 transition-colors line-clamp-1">{biz.name}</h3>
                <div className="mt-2 flex items-center text-red-400 text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                  View Reports <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-fade-in-up flex-1">
          {/* Top Filters */}
          <div className="flex flex-col gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-slate-700 w-full md:w-auto overflow-x-auto">
                <button 
                  onClick={() => {
                     setOverviewCampaign('FREE_SEMINAR');
                     fetchLeads(overviewBiz.id, 'FREE_SEMINAR');
                  }}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${overviewCampaign === 'FREE_SEMINAR' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >Free Sem</button>
                <button 
                  onClick={() => {
                     setOverviewCampaign('AFTER_SEMINAR');
                     fetchLeads(overviewBiz.id, 'AFTER_SEMINAR');
                  }}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${overviewCampaign === 'AFTER_SEMINAR' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >After Sem</button>
                <button 
                  onClick={() => {
                     setOverviewCampaign('BRIDGE');
                     fetchLeads(overviewBiz.id, 'BRIDGE');
                  }}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${overviewCampaign === 'BRIDGE' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >Bridge</button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <select 
                  value={overviewBatch} 
                  onChange={(e) => setOverviewBatch(e.target.value)}
                  className="bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none font-bold w-full sm:w-auto"
                >
                  <option value="All">All Batches Overview</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                <button onClick={handleExportExcel} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-colors">
                  <Download size={16}/> Export Excel
                </button>

                {overviewBatch !== 'All' && (
                  <button onClick={handleStartRound2} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all">
                    <RefreshCw size={16}/> Start Round 2
                  </button>
                )}
              </div>
            </div>

            {/* Date & Time Range Filter Controls Bar */}
            <div className="pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
                  <Filter size={14} className="text-red-400"/> Date & Time Filter:
                </span>
                {[
                  { id: 'ALL', label: 'All Time' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'YESTERDAY', label: 'Yesterday' },
                  { id: 'THIS_WEEK', label: 'This Week' },
                  { id: 'THIS_MONTH', label: 'This Month' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyDatePreset(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                      datePreset === p.id 
                        ? 'bg-red-600 text-white border-red-500 shadow-md font-black' 
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Datetime Pickers */}
              <div className="flex flex-wrap items-center gap-3 bg-[#0f172a]/80 p-2 px-3 rounded-xl border border-slate-700/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                  <Calendar size={13} className="text-indigo-400" />
                  <span>From:</span>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-red-500 font-medium"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                  <Clock size={13} className="text-orange-400" />
                  <span>To:</span>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-red-500 font-medium"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => applyDatePreset('ALL')}
                    className="text-xs text-red-400 hover:text-red-300 underline font-bold px-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          {(() => {
            if (loading) {
              return <div className="text-center py-10 text-slate-400">Loading data...</div>;
            }

            let filtered = overviewLeads.filter(l => overviewBatch === 'All' || l.batchId === parseInt(overviewBatch));

            if (startDate || endDate) {
              const startTs = startDate ? new Date(startDate).getTime() : 0;
              let endTs = Infinity;
              if (endDate) {
                const endD = new Date(endDate);
                if (endDate.length <= 16) {
                  endD.setSeconds(59, 999);
                }
                endTs = endD.getTime();
              }

              filtered = filtered.filter(l => {
                const timestamps = [
                  l.updatedAt,
                  l.createdAt,
                  l.created_at,
                  l.assignedAt,
                  l.lastAttemptAt,
                  l.lastMessageAt,
                  ...(l.roundProgress || []).map(r => r.updatedAt || r.createdAt)
                ].filter(Boolean);

                return timestamps.some(tsVal => {
                  const ts = new Date(tsVal).getTime();
                  return ts >= startTs && ts <= endTs;
                });
              });
            }

            const approved = filtered.filter(l => l.callCenterRequestStatus === 'APPROVED' || l.isCallCenter).length;
            const assigned = filtered.filter(l => l.assignedTo !== null).length;
            const pending = filtered.filter(l => l.assignedTo !== null && l.callCenterStatus !== 'completed').length;

            let activeRound = 1;
            if (filtered.length > 0) {
              const rounds = filtered.map(l => l.roundProgress?.[0]?.roundNum || l.coordinationRound || 1);
              activeRound = Math.max(...rounds);
            }

            // Compute Agent Breakdown
            const agentsMap = {};
            filtered.filter(l => l.assignedTo !== null && l.assignedUser).forEach(l => {
              const aId = l.assignedUser.id;
              if (!agentsMap[aId]) agentsMap[aId] = { name: `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim(), assigned: 0, r1p: 0, r1c: 0, r2p: 0, r2c: 0 };
              agentsMap[aId].assigned++;
              
              const round = l.roundProgress?.[0]?.roundNum || l.coordinationRound || 1;
              if (round === 1) {
                if (l.callCenterStatus === 'completed') agentsMap[aId].r1c++;
                else agentsMap[aId].r1p++;
              } else {
                if (l.callCenterStatus === 'completed') agentsMap[aId].r2c++;
                else agentsMap[aId].r2p++;
              }
            });

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-[#1e293b]/80 backdrop-blur-md border border-purple-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.1)] text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                    <p className="text-purple-400 font-bold uppercase text-xs tracking-widest mb-2">Current Active Round</p>
                    <h3 className="text-5xl font-black text-purple-300">R{activeRound}</h3>
                  </div>
                  <div className="bg-[#1e293b]/80 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-500"></div>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-2">Total Handed Over</p>
                    <h3 className="text-5xl font-black text-white">{approved}</h3>
                  </div>
                  <div className="bg-[#1e293b]/80 backdrop-blur-md border border-blue-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.1)] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <p className="text-blue-400 font-bold uppercase text-xs tracking-widest mb-2">Currently Assigned</p>
                    <h3 className="text-5xl font-black text-blue-300">{assigned}</h3>
                  </div>
                  <div className="bg-[#1e293b]/80 backdrop-blur-md border border-orange-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.1)] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                    <p className="text-orange-400 font-bold uppercase text-xs tracking-widest mb-2">Pending Action</p>
                    <h3 className="text-5xl font-black text-orange-300">{pending}</h3>
                  </div>
                </div>

                {/* Coordinator Performance Breakdown */}
                <CoordinatorStatsBreakdown 
                  leads={filtered} 
                  title="Coordinator Performance Breakdown" 
                  subtitle={`Staff breakdown for ${overviewBiz?.name || ''} • ${overviewCampaign.replace('_', ' ')} • ${batches.find(b => b.id === parseInt(overviewBatch))?.name || 'All Batches'}`} 
                  campaignLabel={overviewCampaign} 
                />
              </>
            );
          })()}

        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { 
    FaPhone, FaComment, FaCheckCircle, FaUserFriends, 
    FaSyncAlt, FaChartLine, FaPercentage, FaBolt, FaStar
} from 'react-icons/fa';
import { MdOutlineIncompleteCircle, MdDoneAll, MdSave, MdTrendingUp } from 'react-icons/md';
import { BiTask, BiPulse } from 'react-icons/bi';
import { toast } from 'react-hot-toast';
import CoordinatorDailyTodo from './CoordinatorDailyTodo';

const DedicatedCoordinatorOverview = ({ selectedBusiness, selectedBatch }) => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState({ today: { newInqCalls: 0, generalInqCalls: 0 }, monthlyTotal: { newInqCalls: 0, generalInqCalls: 0 } });
    const [loading, setLoading] = useState(true);
    
    const [newInqInput, setNewInqInput] = useState(0);
    const [genInqInput, setGenInqInput] = useState(0);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = {};
            if (selectedBusiness) params.businessId = selectedBusiness;
            if (selectedBatch && selectedBatch !== 'ALL') params.batchId = selectedBatch;

            const [statsRes, logsRes] = await Promise.all([
                axios.get('/coordinator-crm/v2-overview-stats', { headers: { Authorization: `Bearer ${token}` }, params }),
                axios.get('/coordinator-crm/v2-daily-logs', { headers: { Authorization: `Bearer ${token}` }, params })
            ]);

            setStats(statsRes.data);
            setLogs(logsRes.data);
            setNewInqInput(logsRes.data.today?.newInqCalls || 0);
            setGenInqInput(logsRes.data.today?.generalInqCalls || 0);
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
            toast.error("Failed to load dashboard metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [selectedBusiness, selectedBatch]);

    const handleSaveLogs = async () => {
        const toastId = toast.loading("Saving daily logs...");
        try {
            const token = localStorage.getItem('token');
            await axios.post('/coordinator-crm/v2-daily-logs', {
                newInqCalls: newInqInput,
                generalInqCalls: genInqInput
            }, { headers: { Authorization: `Bearer ${token}` }});
            toast.success("Logs saved successfully!", { id: toastId });
            fetchDashboardData(); // refresh monthly totals
        } catch (error) {
            toast.error("Failed to save logs", { id: toastId });
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <div className="relative flex items-center justify-center">
                    <div className="absolute animate-ping w-24 h-24 rounded-full bg-blue-500/20"></div>
                    <div className="relative w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    const StatCard = ({ title, value, icon, colorClass, gradientFrom, gradientTo }) => (
        <div className={`relative overflow-hidden group rounded-3xl border border-slate-700/50 p-6 flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} backdrop-blur-md`}>
            <div className={`absolute -right-8 -top-8 opacity-10 group-hover:scale-125 transition-transform duration-700 text-${colorClass}-500`}>
                {icon}
            </div>
            <div className="relative z-10 flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-${colorClass}-400 shadow-lg`}>
                    {icon}
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-slate-300">
                    {title}
                </span>
            </div>
            <div className="relative z-10">
                <h3 className={`text-5xl font-black tracking-tighter text-white drop-shadow-md`}>
                    {value}
                </h3>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-10 max-h-screen overflow-y-auto custom-scrollbar pb-32 bg-[#020617] min-h-screen">
            
            {/* Stunning Header */}
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700/50 shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <div className="w-full h-full bg-[#0f172a] rounded-[22px] flex items-center justify-center text-blue-400">
                            <BiPulse size={32} className="animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Coordinator Command Center</h1>
                        <p className="text-slate-400 font-medium mt-1 tracking-wide flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live operations and performance tracking
                        </p>
                    </div>
                </div>
                <button 
                    onClick={fetchDashboardData} 
                    className="relative z-10 group flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 hover:text-white transition-all duration-300 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <FaSyncAlt className={loading ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 transition-transform duration-500 text-blue-400'} />
                    <span className="font-bold tracking-wider text-sm uppercase">Sync Data</span>
                </button>
            </div>

            {/* Daily To-Do Checklist (My stunning component) */}
            <div className="relative z-10">
                <CoordinatorDailyTodo selectedBusiness={selectedBusiness} selectedBatch={selectedBatch} />
            </div>

            {/* OVERALL PERFORMANCE - Glassmorphic Grid */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/20 rounded-xl"><FaChartLine className="text-indigo-400 text-xl" /></div>
                    <h2 className="text-2xl font-black text-white tracking-wide">Macro Performance</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Total Assigned" 
                        value={stats?.overall?.assigned || 0} 
                        icon={<FaUserFriends size={48} />} 
                        colorClass="blue"
                        gradientFrom="from-[#1e293b]" gradientTo="to-[#0f172a]"
                    />
                    <StatCard 
                        title="Total Enrolled" 
                        value={stats?.overall?.enrolled || 0} 
                        icon={<FaCheckCircle size={48} />} 
                        colorClass="emerald"
                        gradientFrom="from-[#064e3b]/40" gradientTo="to-[#0f172a]"
                    />
                    <StatCard 
                        title="Total Covered" 
                        value={stats?.overall?.covered || 0} 
                        icon={<MdDoneAll size={48} />} 
                        colorClass="cyan"
                        gradientFrom="from-[#164e63]/40" gradientTo="to-[#0f172a]"
                    />
                    <StatCard 
                        title="Total Pending" 
                        value={stats?.overall?.pending || 0} 
                        icon={<MdOutlineIncompleteCircle size={48} />} 
                        colorClass="orange"
                        gradientFrom="from-[#7c2d12]/40" gradientTo="to-[#0f172a]"
                    />
                </div>

                {/* Rates Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                     <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 flex items-center justify-between group hover:border-emerald-500/30 transition-colors shadow-2xl">
                         <div>
                             <div className="flex items-center gap-2 mb-2">
                                 <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg">Success Metric</span>
                             </div>
                             <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Conversion Rate</p>
                             <div className="flex items-end gap-2 mt-2">
                                <h3 className="text-5xl font-black text-white">{stats?.overall?.conversionRate || 0}<span className="text-3xl text-emerald-500">%</span></h3>
                                <MdTrendingUp className="text-emerald-500 mb-2 text-2xl" />
                             </div>
                         </div>
                         <div className="w-24 h-24 rounded-full border-[6px] border-slate-800 flex items-center justify-center relative">
                             <div className="absolute inset-0 border-[6px] border-emerald-500 rounded-full border-t-transparent -rotate-45 group-hover:rotate-45 transition-transform duration-1000"></div>
                             <FaPercentage size={32} className="text-emerald-500" />
                         </div>
                     </div>
                     <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 flex items-center justify-between group hover:border-blue-500/30 transition-colors shadow-2xl">
                         <div>
                             <div className="flex items-center gap-2 mb-2">
                                 <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg">Engagement Metric</span>
                             </div>
                             <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Response Rate</p>
                             <div className="flex items-end gap-2 mt-2">
                                <h3 className="text-5xl font-black text-white">{stats?.overall?.responseRate || 0}<span className="text-3xl text-blue-500">%</span></h3>
                                <MdTrendingUp className="text-blue-500 mb-2 text-2xl" />
                             </div>
                         </div>
                         <div className="w-24 h-24 rounded-full border-[6px] border-slate-800 flex items-center justify-center relative">
                             <div className="absolute inset-0 border-[6px] border-blue-500 rounded-full border-t-transparent -rotate-45 group-hover:rotate-45 transition-transform duration-1000"></div>
                             <FaPhone size={32} className="text-blue-500" />
                         </div>
                     </div>
                </div>
            </div>

            {/* OPERATIONS SECTION */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                {/* Manual Call Logs */}
                <div className="bg-[#1e293b]/80 backdrop-blur-2xl border border-slate-700/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                    
                    <div>
                        <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                            <div className="p-3 bg-blue-500/20 rounded-2xl"><FaPhone className="text-blue-400" /></div>
                            Direct Inbound Calls
                        </h2>
                        <p className="text-slate-400 text-sm mb-8 font-medium">Log your direct incoming calls manually to keep your daily stats accurate.</p>
                        
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="bg-[#0f172a] rounded-3xl p-5 border border-slate-700/50 shadow-inner">
                                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">New Inq Calls</label>
                                <input 
                                    type="number" 
                                    value={newInqInput} 
                                    onChange={(e) => setNewInqInput(e.target.value)} 
                                    className="w-full bg-transparent text-white text-4xl font-black focus:outline-none placeholder-slate-700"
                                />
                            </div>
                            <div className="bg-[#0f172a] rounded-3xl p-5 border border-slate-700/50 shadow-inner">
                                <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">General Calls</label>
                                <input 
                                    type="number" 
                                    value={genInqInput} 
                                    onChange={(e) => setGenInqInput(e.target.value)} 
                                    className="w-full bg-transparent text-white text-4xl font-black focus:outline-none placeholder-slate-700"
                                />
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleSaveLogs}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                        >
                            <MdSave size={24} /> Sync Logs to Cloud
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-700/50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Monthly Totals</h3>
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <span className="text-xl font-black text-white">{logs?.monthlyTotal?.newInqCalls || 0}</span>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">New Inq</p>
                                </div>
                                <div className="w-px bg-slate-700"></div>
                                <div className="text-left">
                                    <span className="text-xl font-black text-white">{logs?.monthlyTotal?.generalInqCalls || 0}</span>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">General</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today Auto Stats */}
                <div className="space-y-8 flex flex-col justify-between">
                    {/* Auto Messages */}
                    <div className="bg-[#1e293b]/80 backdrop-blur-2xl border border-slate-700/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-xl"><FaComment className="text-emerald-400" /></div>
                            Message Traffic (Today)
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[#0f172a]/50 rounded-2xl p-4 text-center border border-slate-800/50">
                                <h3 className="text-3xl font-black text-emerald-400 mb-1">{stats?.today?.msgsSent || 0}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sent</p>
                            </div>
                            <div className="bg-[#0f172a]/50 rounded-2xl p-4 text-center border border-slate-800/50">
                                <h3 className="text-3xl font-black text-emerald-400 mb-1">{stats?.today?.msgsReceived || 0}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Received</p>
                            </div>
                            <div className="bg-[#0f172a]/50 rounded-2xl p-4 text-center border border-slate-800/50">
                                <h3 className="text-3xl font-black text-blue-400 mb-1">{stats?.today?.uniqueNumbers || 0}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Contacts</p>
                            </div>
                        </div>
                    </div>

                    {/* Today Covers */}
                    <div className="bg-[#1e293b]/80 backdrop-blur-2xl border border-slate-700/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex-1">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/10 rounded-bl-full pointer-events-none"></div>
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-xl"><FaBolt className="text-purple-400" /></div>
                            Leads Covered (Today)
                        </h2>
                        <div className="grid grid-cols-3 gap-4 h-full">
                            <div className="bg-[#0f172a]/50 rounded-2xl p-4 flex flex-col justify-center items-center border border-slate-800/50">
                                <h3 className="text-4xl font-black text-purple-400 mb-2">{stats?.today?.covers?.newInq || 0}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">New Inq<br/>Covered</p>
                            </div>
                            <div className="bg-[#0f172a]/50 rounded-2xl p-4 flex flex-col justify-center items-center border border-slate-800/50">
                                <h3 className="text-4xl font-black text-purple-400 mb-2">{stats?.today?.covers?.openSem || 0}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Open Sem<br/>Covered</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-900/40 to-[#0f172a]/50 rounded-2xl p-4 flex flex-col justify-center items-center border border-emerald-500/30">
                                <h3 className="text-4xl font-black text-emerald-400 mb-2 drop-shadow-md">{stats?.today?.covers?.paid || 0}</h3>
                                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest text-center">Paid<br/>Covered</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TASK CENTER */}
            <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-orange-900/30 rounded-[2.5rem] p-8 shadow-2xl mt-8">
                 <div className="flex items-center gap-4 mb-8">
                     <div className="p-4 bg-orange-500/20 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                         <BiTask className="text-orange-500 text-3xl"/>
                     </div>
                     <div>
                         <h2 className="text-2xl font-black text-white tracking-wide">Assigned Tasks</h2>
                         <p className="text-sm text-slate-400 font-medium">Your personal to-do list from management</p>
                     </div>
                 </div>
                 
                 {stats?.tasks && stats.tasks.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {stats.tasks.map(task => (
                             <div key={task.id} className="bg-[#1e293b]/50 border border-slate-700 hover:border-orange-500/50 p-6 rounded-3xl transition-all duration-300 hover:-translate-y-1 shadow-lg group">
                                 <div className="flex justify-between items-start mb-4">
                                     <h3 className="text-white font-black text-lg group-hover:text-orange-400 transition-colors">{task.title}</h3>
                                     <span className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-[10px] font-black border border-orange-500/20 uppercase tracking-widest">
                                         {task.status || 'PENDING'}
                                     </span>
                                 </div>
                                 <p className="text-sm text-slate-400 leading-relaxed">{task.description}</p>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-16 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
                         <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                             <FaStar className="text-slate-600 text-3xl" />
                         </div>
                         <h3 className="text-xl font-bold text-slate-300 mb-1">Clear Horizon</h3>
                         <p className="text-slate-500 font-medium">No pending administrative tasks for today.</p>
                     </div>
                 )}
            </div>
            
        </div>
    );
};

export default DedicatedCoordinatorOverview;

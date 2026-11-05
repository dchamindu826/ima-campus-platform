import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { 
    Users, Target, Activity, TrendingUp, TrendingDown, DollarSign, BookOpen, Clock, 
    CheckCircle2, ChevronDown, ChevronUp, MessageSquare, Inbox, Send, PhoneCall, 
    Calendar, GraduationCap, BarChart2 
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
    PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line 
} from 'recharts';

const COLORS = {
    openSem: '#f59e0b',
    newInq: '#d946ef',
    monthly: '#22d3ee',
    installment: '#818cf8',
    full: '#c084fc',
    upgraded: '#facc15',
    growth: '#10b981',
    drops: '#f43f5e',
    enrolled: '#3b82f6',
    subject: '#14b8a6'
};

export default function ModuleCoordinatorKPI({ filters }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);

    useEffect(() => {
        const fetchKPIs = async () => {
            if (!filters?.selectedBusiness) return;
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const params = { businessId: filters.selectedBusiness };
                if (filters.selectedBatch) params.batchId = filters.selectedBatch;
                
                const res = await axios.get('/admin/data-export/coordinator-kpi', {
                    headers: { Authorization: `Bearer ${token}` },
                    params
                });
                setData(res.data || []);
            } catch (err) {
                console.error(err);
                setError("Failed to load Coordinator KPIs");
            }
            setLoading(false);
        };
        fetchKPIs();
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
    );
    if (error) return <div className="text-rose-500 text-center p-8 bg-rose-500/10 rounded-2xl">{error}</div>;
    if (data.length === 0) return <div className="text-slate-400 text-center p-8 bg-black/20 rounded-2xl">No coordinator data found.</div>;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50">
                    <p className="font-bold text-white mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color || entry.fill }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
                            {entry.name}: <span className="font-bold">{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in p-2 md:p-4">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase tracking-widest flex items-center gap-3">
                <BarChart2 size={28} className="text-emerald-400" /> Advanced Coordinator Report V3
            </h2>

            <div className="flex flex-col gap-6">
                {data.map((coord) => {
                    const os = coord.calls.openSem;
                    const ni = coord.calls.newInq;
                    const fin = coord.finances;
                    const msg = coord.messages;

                    const totalAssigned = os.assigned + ni.assigned;
                    const totalEnrolled = fin.totalEnrolled;
                    
                    const paymentData = [
                        { name: 'Monthly', value: fin.monthly, color: COLORS.monthly },
                        { name: 'Installment', value: fin.installment, color: COLORS.installment },
                        { name: 'Full Payment', value: fin.full, color: COLORS.full }
                    ];

                    const campaignData = [
                        { name: 'Open Seminar Enrolled', value: os.enrolled, color: COLORS.openSem },
                        { name: 'New Inquiry Enrolled', value: ni.enrolled, color: COLORS.newInq }
                    ];

                    return (
                        <div key={coord.id} className="bg-[#1e293b] rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300">
                            {/* Summary Header (Click to Expand) */}
                            <div 
                                onClick={() => setExpandedRow(expandedRow === coord.id ? null : coord.id)}
                                className="p-5 flex flex-col md:flex-row items-center justify-between cursor-pointer hover:bg-white/5 transition-colors gap-4"
                            >
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-xl shadow-lg border border-emerald-500/30">
                                        {coord.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{coord.name}</h3>
                                        <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">COORDINATOR</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 md:gap-8 w-full md:w-auto">
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Assigned</div>
                                        <div className="text-2xl font-black text-white">{totalAssigned}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Enrolled</div>
                                        <div className="text-2xl font-black text-emerald-400">{totalEnrolled}</div>
                                    </div>
                                    <div className="text-center bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Conversion</div>
                                        <div className="text-2xl font-black text-cyan-400">
                                            {totalAssigned > 0 ? ((totalEnrolled / totalAssigned) * 100).toFixed(1) : 0}%
                                        </div>
                                    </div>
                                    <div className="text-slate-500 hidden md:block">
                                        {expandedRow === coord.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Advanced Dashboard */}
                            {expandedRow === coord.id && (
                                <div className="p-6 bg-[#0f172a] border-t border-slate-700/50 flex flex-col gap-8 animate-slide-down">
                                    
                                    {/* --- SECTION 1: CALL CAMPAIGN DATA --- */}
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <PhoneCall size={18} className="text-amber-400" /> Call Campaign Performance
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Open Seminar Call Stats */}
                                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
                                                <h5 className="text-amber-400 font-bold uppercase text-xs tracking-widest mb-4 border-b border-amber-500/20 pb-2">Open Seminar Leads</h5>
                                                
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                                        <div className="text-[10px] text-slate-400">Assigned</div>
                                                        <div className="text-xl font-black text-white">{os.assigned}</div>
                                                    </div>
                                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                                        <div className="text-[10px] text-slate-400">Covered</div>
                                                        <div className="text-xl font-black text-emerald-400">{os.covered}</div>
                                                    </div>
                                                    <div className="bg-black/20 p-2 rounded-lg text-center border border-rose-500/20">
                                                        <div className="text-[10px] text-rose-400">Delayed (Pending)</div>
                                                        <div className="text-xl font-black text-rose-400">{os.pending}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                                        <div className="text-[10px] text-amber-400 uppercase font-bold mb-1">Round 1</div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Covered:</span><span className="font-bold text-white">{os.r1.covered}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Pending:</span><span className="font-bold text-rose-400">{os.r1.pending}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                                        <div className="text-[10px] text-amber-400 uppercase font-bold mb-1">Round 2</div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Covered:</span><span className="font-bold text-white">{os.r2.covered}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Pending:</span><span className="font-bold text-rose-400">{os.r2.pending}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400">Response Rate</div>
                                                        <div className="text-lg font-black text-cyan-400">{os.responseRate}%</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-emerald-400">Enrolled: {os.enrolled}</div>
                                                        <div className="text-xs text-slate-500">Non-Enrolled: {os.nonEnrolled}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* New Inquiry Call Stats */}
                                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-bl-full pointer-events-none"></div>
                                                <h5 className="text-fuchsia-400 font-bold uppercase text-xs tracking-widest mb-4 border-b border-fuchsia-500/20 pb-2">New Inquiry Leads</h5>
                                                
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                                        <div className="text-[10px] text-slate-400">Assigned</div>
                                                        <div className="text-xl font-black text-white">{ni.assigned}</div>
                                                    </div>
                                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                                        <div className="text-[10px] text-slate-400">Covered</div>
                                                        <div className="text-xl font-black text-emerald-400">{ni.covered}</div>
                                                    </div>
                                                    <div className="bg-black/20 p-2 rounded-lg text-center border border-rose-500/20">
                                                        <div className="text-[10px] text-rose-400">Delayed (Pending)</div>
                                                        <div className="text-xl font-black text-rose-400">{ni.pending}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="bg-fuchsia-500/10 p-3 rounded-xl border border-fuchsia-500/20">
                                                        <div className="text-[10px] text-fuchsia-400 uppercase font-bold mb-1">Round 1</div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Covered:</span><span className="font-bold text-white">{ni.r1.covered}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Pending:</span><span className="font-bold text-rose-400">{ni.r1.pending}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-fuchsia-500/10 p-3 rounded-xl border border-fuchsia-500/20">
                                                        <div className="text-[10px] text-fuchsia-400 uppercase font-bold mb-1">Round 2</div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Covered:</span><span className="font-bold text-white">{ni.r2.covered}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Pending:</span><span className="font-bold text-rose-400">{ni.r2.pending}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400">Response Rate</div>
                                                        <div className="text-lg font-black text-cyan-400">{ni.responseRate}%</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-emerald-400">Enrolled: {ni.enrolled}</div>
                                                        <div className="text-xs text-slate-500">Non-Enrolled: {ni.nonEnrolled}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- SECTION 2: MESSAGING DATA --- */}
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <MessageSquare size={18} className="text-blue-400" /> WhatsApp Messaging Analytics
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex gap-4">
                                                <div className="w-1/3 flex flex-col justify-center items-center bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                                                    <div className="text-xs text-amber-400 font-bold uppercase text-center mb-2">Open Seminar<br/>Messages</div>
                                                    <div className="text-3xl font-black text-white">{msg.openSem.total}</div>
                                                </div>
                                                <div className="w-2/3 flex flex-col justify-between">
                                                    <div className="flex justify-between items-center bg-black/30 p-2 rounded-lg">
                                                        <span className="text-xs text-slate-400"><Send size={12} className="inline mr-1"/>Sent</span>
                                                        <span className="font-bold text-emerald-400">{msg.openSem.sent}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-black/30 p-2 rounded-lg">
                                                        <span className="text-xs text-slate-400"><Inbox size={12} className="inline mr-1"/>Received</span>
                                                        <span className="font-bold text-blue-400">{msg.openSem.received}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                                                        <span className="text-xs text-rose-400 font-bold">Unread</span>
                                                        <span className="font-bold text-rose-400">{msg.openSem.unread}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex gap-4">
                                                <div className="w-1/3 flex flex-col justify-center items-center bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20 p-4">
                                                    <div className="text-xs text-fuchsia-400 font-bold uppercase text-center mb-2">New Inquiry<br/>Messages</div>
                                                    <div className="text-3xl font-black text-white">{msg.newInq.total}</div>
                                                </div>
                                                <div className="w-2/3 flex flex-col justify-between">
                                                    <div className="flex justify-between items-center bg-black/30 p-2 rounded-lg">
                                                        <span className="text-xs text-slate-400"><Send size={12} className="inline mr-1"/>Sent</span>
                                                        <span className="font-bold text-emerald-400">{msg.newInq.sent}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-black/30 p-2 rounded-lg">
                                                        <span className="text-xs text-slate-400"><Inbox size={12} className="inline mr-1"/>Received</span>
                                                        <span className="font-bold text-blue-400">{msg.newInq.received}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                                                        <span className="text-xs text-rose-400 font-bold">Unread</span>
                                                        <span className="font-bold text-rose-400">{msg.newInq.unread}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- SECTION 3: TOTAL ENROLLED DATA & SUBJECTS --- */}
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <DollarSign size={18} className="text-emerald-400" /> Financial & Subject Demographics
                                        </h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Payment Intention Overview */}
                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 lg:col-span-1">
                                                <h5 className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-4 text-center">Payment Plans</h5>
                                                <div className="h-40 w-full mb-4">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={paymentData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                                                                {paymentData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '10px' }}/>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="flex justify-center">
                                                    <div className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-xl text-center">
                                                        <div className="text-[10px] text-yellow-400 font-bold uppercase">Upgrades Detected</div>
                                                        <div className="text-xl font-black text-yellow-400">{fin.upgraded} <span className="text-xs font-normal">({totalEnrolled > 0 ? ((fin.upgraded/totalEnrolled)*100).toFixed(0) : 0}%)</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Subject Breakdown */}
                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 lg:col-span-2">
                                                <h5 className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-4"><GraduationCap size={14} className="inline mr-1" /> Subject Enrollments %</h5>
                                                <div className="h-48 w-full">
                                                    {coord.subjectsArray && coord.subjectsArray.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={coord.subjectsArray} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                                                                <XAxis type="number" hide />
                                                                <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                                <Tooltip cursor={{fill: '#1e293b'}} content={<CustomTooltip />} />
                                                                <Bar dataKey="percent" name="Enrolled %" fill={COLORS.subject} radius={[0, 4, 4, 0]}>
                                                                    {coord.subjectsArray.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={COLORS.subject} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-slate-500">No subject data found from payments.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- SECTION 4: TRUE DROP/GROWTH & MONTHLY FORECAST --- */}
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Calendar size={18} className="text-fuchsia-400" /> Forecast & True Retention Analytics
                                        </h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            
                                            {/* Monthly Payment Upgrades Chart */}
                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                                                <h5 className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-4 text-center">Monthly Plan Distribution & Upgrades</h5>
                                                <div className="h-64 w-full">
                                                    {coord.monthlyTrendsArray && coord.monthlyTrendsArray.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart data={coord.monthlyTrendsArray} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                                <Tooltip content={<CustomTooltip />} />
                                                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }}/>
                                                                <Line type="monotone" dataKey="monthly" name="Monthly" stroke={COLORS.monthly} strokeWidth={2} dot={{ r: 3 }} />
                                                                <Line type="monotone" dataKey="install" name="Installment" stroke={COLORS.installment} strokeWidth={2} dot={{ r: 3 }} />
                                                                <Line type="monotone" dataKey="full" name="Full Payment" stroke={COLORS.full} strokeWidth={2} dot={{ r: 3 }} />
                                                                <Line type="monotone" dataKey="upgraded" name="Upgraded" stroke={COLORS.upgraded} strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: COLORS.upgraded }} />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-slate-500">No monthly trend data</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* True Drop/Growth Chart */}
                                            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                                                <h5 className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-4 text-center flex items-center justify-center gap-2">
                                                    <Activity size={14} className="text-emerald-400"/> True Retention (Drop vs Active)
                                                </h5>
                                                <div className="h-64 w-full">
                                                    {coord.monthlyTrendsArray && coord.monthlyTrendsArray.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={coord.monthlyTrendsArray} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                                <defs>
                                                                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={COLORS.growth} stopOpacity={0.4}/>
                                                                        <stop offset="95%" stopColor={COLORS.growth} stopOpacity={0}/>
                                                                    </linearGradient>
                                                                    <linearGradient id="colorDrop" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={COLORS.drops} stopOpacity={0.4}/>
                                                                        <stop offset="95%" stopColor={COLORS.drops} stopOpacity={0}/>
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                                <Tooltip content={<CustomTooltip />} />
                                                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }}/>
                                                                <Area type="monotone" dataKey="growth" name="Active / Growth" stroke={COLORS.growth} fillOpacity={1} fill="url(#colorGrowth)" />
                                                                <Area type="monotone" dataKey="drops" name="Drops" stroke={COLORS.drops} fillOpacity={1} fill="url(#colorDrop)" />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-slate-500">No retention data available</div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

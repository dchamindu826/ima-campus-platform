import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, Box, Loader2, Truck, RotateCcw, TrendingUp, Activity, BarChart3, Clock } from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function Overview() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        summary: { pending: 0, onHold: 0, dispatched: 0, deliveredToday: 0, lowStock: 0, returned: 0 },
        weeklyTrend: [],
        statusDistribution: [],
        topBusinesses: [],
        recentActivity: []
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/admin/delivery/stats');
                const data = res.data;
                
                setStats({
                    summary: {
                        pending: data.pending || 0,
                        onHold: data.onHold || 0,
                        dispatched: data.dispatched || 0,
                        deliveredToday: data.deliveredToday || 0,
                        lowStock: data.lowStock || 0,
                        returned: data.returned || 0,
                    },
                    weeklyTrend: data.weeklyTrend || [],
                    statusDistribution: data.statusDistribution || [],
                    topBusinesses: data.topBusinesses || [],
                    recentActivity: data.recentActivity || []
                });
            } catch (error) {
                toast.error("Failed to load delivery stats.");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="flex justify-center py-20 relative z-10"><Loader2 className="animate-spin text-brand-accent" size={40}/></div>;

    // 🔥 Glassmorphic Stat Card Component 🔥
    const StatCard = ({ title, value, icon: Icon, colorClass, borderClass, bgClass }) => (
        <div className={`bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group`}>
            <div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest mb-2 transition-colors">{title}</p>
                <p className={`text-4xl font-black ${colorClass} transition-colors drop-shadow-sm`}>{value}</p>
            </div>
            <div className={`w-14 h-14 ${bgClass} ${colorClass} ${borderClass} border rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300 mt-5 backdrop-blur-md`}>
                <Icon size={28} strokeWidth={2.5}/>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in font-sans space-y-6 relative z-10">
            
            {/* Top Row: Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                <StatCard title="To Dispatch" value={stats.summary.pending} icon={Package} colorClass="text-blue-600 dark:text-blue-400" borderClass="border-blue-200 dark:border-blue-500/30" bgClass="bg-blue-50/80 dark:bg-blue-500/10" />
                <StatCard title="Dispatched" value={stats.summary.dispatched} icon={Truck} colorClass="text-purple-600 dark:text-purple-400" borderClass="border-purple-200 dark:border-purple-500/30" bgClass="bg-purple-50/80 dark:bg-purple-500/10" />
                <StatCard title="Delivered Today" value={stats.summary.deliveredToday} icon={CheckCircle} colorClass="text-emerald-600 dark:text-emerald-400" borderClass="border-emerald-200 dark:border-emerald-500/30" bgClass="bg-emerald-50/80 dark:bg-emerald-500/10" />
                <StatCard title="On Hold" value={stats.summary.onHold} icon={AlertTriangle} colorClass="text-orange-600 dark:text-orange-400" borderClass="border-orange-200 dark:border-orange-500/30" bgClass="bg-orange-50/80 dark:bg-orange-500/10" />
                <StatCard title="Low Stock" value={stats.summary.lowStock} icon={Box} colorClass="text-red-600 dark:text-red-400" borderClass="border-red-200 dark:border-red-500/30" bgClass="bg-red-50/80 dark:bg-red-500/10" />
                <StatCard title="Returns" value={stats.summary.returned} icon={RotateCcw} colorClass="text-gray-600 dark:text-slate-300" borderClass="border-gray-200 dark:border-white/10" bgClass="bg-gray-100/80 dark:bg-white/5" />
            </div>

            {/* Middle Row: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Trend Chart */}
                <div className="lg:col-span-2 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg flex flex-col transition-colors">
                    <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-200 dark:border-white/10">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 transition-colors">
                            <TrendingUp className="text-blue-500 dark:text-blue-400" size={24}/> Last 7 Days Trend
                        </h3>
                    </div>
                    <div className="h-[300px] w-full flex-1">
                        {stats.weeklyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPacked" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} fontWeight="bold" />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} fontWeight="bold" />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.15} vertical={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} itemStyle={{ fontWeight: 'black' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold', paddingTop: '20px', color: '#94a3b8' }}/>
                                    <Area type="monotone" dataKey="Packed" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPacked)" />
                                    <Area type="monotone" dataKey="Delivered" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorDelivered)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 dark:text-slate-500 font-bold text-lg">No trend data available</div>
                        )}
                    </div>
                </div>

                {/* Status Distribution Doughnut Chart */}
                <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg flex flex-col transition-colors">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-white/10 transition-colors">
                        <BarChart3 className="text-emerald-500 dark:text-emerald-400" size={24}/> Status Overview
                    </h3>
                    <div className="flex-1 min-h-[200px]">
                        {stats.statusDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.statusDistribution} innerRadius={65} outerRadius={100} paddingAngle={6} dataKey="value" stroke="none">
                                        {stats.statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} itemStyle={{ fontWeight: 'black' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 dark:text-slate-500 font-bold text-lg">No status data</div>
                        )}
                    </div>
                    {/* Custom Legend */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        {stats.statusDistribution.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-gray-200 dark:border-white/5 transition-colors shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3.5 h-3.5 rounded-full shadow-inner" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-xs font-black text-gray-600 dark:text-slate-300 uppercase tracking-widest">{item.name}</span>
                                </div>
                                <span className="text-sm font-black text-gray-900 dark:text-white">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Bottom Row: Top Businesses & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Top Businesses List */}
                <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg transition-colors">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-white/10 transition-colors">
                        <Activity className="text-purple-500 dark:text-purple-400" size={24}/> Top Businesses by Volume
                    </h3>
                    <div className="space-y-6">
                        {stats.topBusinesses.length > 0 ? stats.topBusinesses.map((biz, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between items-end mb-2.5">
                                    <span className="text-sm font-black text-gray-800 dark:text-slate-200 transition-colors">{biz.name}</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-500/20 shadow-sm transition-colors">{biz.orders} Orders</span>
                                </div>
                                <div className="w-full bg-gray-200/80 dark:bg-black/30 rounded-full h-3.5 overflow-hidden transition-colors shadow-inner">
                                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000 relative overflow-hidden" style={{ width: `${biz.progress}%` }}>
                                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-400 dark:text-slate-500 text-sm font-bold text-center py-6 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5">No business data available</p>
                        )}
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-lg transition-colors">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-white/10 transition-colors">
                        <Clock className="text-orange-500 dark:text-orange-400" size={24}/> Recent System Activity
                    </h3>
                    <div className="space-y-4">
                        {stats.recentActivity.length > 0 ? stats.recentActivity.map((activity) => {
                            return (
                                <div key={activity.id} className="flex items-start gap-4 bg-white/80 dark:bg-black/20 p-4 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors shadow-sm hover:shadow-md hover:scale-[1.01]">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 shadow-md ${activity.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/50' : activity.type === 'warning' ? 'bg-orange-500 shadow-orange-500/50' : activity.type === 'error' ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500 shadow-blue-500/50'}`}></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800 dark:text-slate-200 transition-colors leading-relaxed">{activity.text}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-widest font-black mt-1.5 transition-colors">{activity.time}</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-gray-400 dark:text-slate-500 text-sm font-bold text-center py-6 bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5">No recent activity</p>
                        )}
                    </div>
                </div>

            </div>
            
            {/* Custom Tailwind animation for progress bar shimmer */}
            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { 
    CheckCircle, PhoneCall, MessageSquare, AlertCircle, PhoneOff, 
    ChevronRight, Activity, Zap, Star 
} from 'lucide-react';

const CoordinatorDailyTodo = ({ staffId, isManager = false, selectedBusiness, selectedBatch }) => {
    const [todoData, setTodoData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTodoStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('/coordinator-crm/master-todo-stats', {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        businessId: selectedBusiness || 'ALL',
                        batchId: selectedBatch || 'ALL'
                    }
                });
                
                let data = response.data;
                if (staffId && !isManager) {
                    data = data.filter(d => d.id === parseInt(staffId));
                }
                setTodoData(data);
            } catch (err) {
                console.error("Failed to fetch Master Todo Stats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTodoStats();
        const interval = setInterval(fetchTodoStats, 30000);
        return () => clearInterval(interval);
    }, [staffId, isManager, selectedBusiness, selectedBatch]);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="relative flex items-center justify-center">
                    <div className="absolute animate-ping w-16 h-16 rounded-full bg-emerald-500/20"></div>
                    <div className="relative w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    if (todoData.length === 0) {
        return (
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center border border-slate-700/50 shadow-2xl">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                        <CheckCircle size={48} className="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                    </div>
                    <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-3 tracking-tight">You're All Caught Up!</h3>
                    <p className="text-slate-400 text-lg">No pending calls or unread chats right now. Take a break! 🚀</p>
                </div>
            </div>
        );
    }

    const GlassCard = ({ title, value, icon, colorClass, highlight = false, isAlert = false }) => {
        const colors = {
            amber: 'from-amber-500/20 to-orange-500/5 border-amber-500/30 text-amber-400 shadow-amber-500/10',
            cyan: 'from-cyan-500/20 to-blue-500/5 border-cyan-500/30 text-cyan-400 shadow-cyan-500/10',
            emerald: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10',
            fuchsia: 'from-fuchsia-500/20 to-pink-500/5 border-fuchsia-500/30 text-fuchsia-400 shadow-fuchsia-500/10',
            purple: 'from-purple-500/20 to-indigo-500/5 border-purple-500/30 text-purple-400 shadow-purple-500/10',
            rose: 'from-rose-500/20 to-red-500/5 border-rose-500/30 text-rose-400 shadow-rose-500/10',
            slate: 'from-slate-800/50 to-slate-900/50 border-slate-700 text-slate-400 shadow-none'
        };

        const activeColor = value > 0 ? colors[colorClass] : colors.slate;
        
        return (
            <div className={`relative overflow-hidden group rounded-2xl border p-5 flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${activeColor} bg-gradient-to-br backdrop-blur-md`}>
                {/* Glow effect */}
                {value > 0 && highlight && (
                    <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-r ${colorClass === 'emerald' ? 'from-emerald-400 to-teal-400' : 'from-current to-transparent'}`}></div>
                )}
                
                <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl backdrop-blur-md border ${value > 0 ? `border-${colorClass}-500/30 bg-${colorClass}-500/10` : 'border-slate-700 bg-slate-800/50'}`}>
                            {icon}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest ${value > 0 ? 'text-white' : 'text-slate-500'}`}>
                            {title}
                        </span>
                    </div>
                    {isAlert && value > 0 && (
                        <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-${colorClass}-400`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 bg-${colorClass}-500`}></span>
                        </span>
                    )}
                </div>
                
                <div className="relative z-10 flex items-end justify-between">
                    <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-black tracking-tighter ${value > 0 ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
                            {value}
                        </span>
                        {value > 0 && <span className="text-xs font-semibold opacity-70 ml-1">PENDING</span>}
                    </div>
                    
                    {value > 0 && (
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 transition-opacity group-hover:translate-x-1 duration-300" />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-8 w-full animate-fade-in mb-10">
            {isManager && (
                <div className="flex items-center gap-4 bg-gradient-to-r from-fuchsia-600/20 to-purple-600/5 p-4 rounded-2xl border border-fuchsia-500/20">
                    <div className="bg-fuchsia-500 p-2 rounded-lg shadow-[0_0_20px_rgba(217,70,239,0.4)]">
                        <Activity className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-widest uppercase">Master Action Dashboard</h2>
                        <p className="text-fuchsia-300/70 text-xs font-semibold tracking-wide">Live tracking of all coordinator pending tasks</p>
                    </div>
                </div>
            )}
            
            <div className={`grid gap-8 ${isManager ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                {todoData.map(coord => {
                    const totalPending = coord.freeSemPending + coord.openSemPending + coord.newInqR1Pending + coord.newInqR2Pending + coord.newInqR1NoAnswer + coord.newInqR2NoAnswer + coord.unreadChats;
                    
                    return (
                        <div key={coord.id} className="relative bg-[#0f172a]/80 backdrop-blur-2xl rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl transition-all duration-500 hover:border-slate-600/80">
                            
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none"></div>

                            {/* Header */}
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-600 p-[2px] shadow-lg shadow-emerald-500/20">
                                            <div className="w-full h-full bg-[#0f172a] rounded-[14px] flex items-center justify-center text-white font-black text-2xl">
                                                {coord.name.charAt(0)}
                                            </div>
                                        </div>
                                        {totalPending > 0 && (
                                            <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-lg border border-rose-400 shadow-md">
                                                ACTION
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-wide">{coord.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Live Status</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-slate-900/80 border border-slate-700 px-5 py-3 rounded-2xl flex flex-col items-center min-w-[120px] shadow-inner">
                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                                        <Zap size={10} className="text-amber-400" /> Total Pending
                                    </span>
                                    <span className={`text-3xl font-black ${totalPending > 0 ? 'text-white' : 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}>
                                        {totalPending}
                                    </span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10 bg-slate-900/20">
                                
                                <GlassCard 
                                    title="Open Seminar" 
                                    value={coord.openSemPending} 
                                    icon={<PhoneCall size={18} />} 
                                    colorClass="amber" 
                                    highlight={true}
                                />
                                
                                <GlassCard 
                                    title="Free Seminar" 
                                    value={coord.freeSemPending} 
                                    icon={<PhoneCall size={18} />} 
                                    colorClass="cyan" 
                                    highlight={true}
                                />

                                <GlassCard 
                                    title="Unread Chats" 
                                    value={coord.unreadChats} 
                                    icon={<MessageSquare size={18} />} 
                                    colorClass="emerald" 
                                    highlight={true}
                                    isAlert={true}
                                />

                                <GlassCard 
                                    title="New Inq (R1)" 
                                    value={coord.newInqR1Pending} 
                                    icon={<PhoneCall size={18} />} 
                                    colorClass="fuchsia" 
                                    highlight={true}
                                />
                                
                                <GlassCard 
                                    title="New Inq (R2)" 
                                    value={coord.newInqR2Pending} 
                                    icon={<PhoneCall size={18} />} 
                                    colorClass="purple" 
                                    highlight={true}
                                />
                                
                                <GlassCard 
                                    title="R1 Unanswered" 
                                    value={coord.newInqR1NoAnswer} 
                                    icon={<PhoneOff size={18} />} 
                                    colorClass="rose" 
                                />
                                
                                <GlassCard 
                                    title="R2 Unanswered" 
                                    value={coord.newInqR2NoAnswer} 
                                    icon={<PhoneOff size={18} />} 
                                    colorClass="rose" 
                                />

                                {/* Empty placeholder for visual balance if needed, or an extra metric */}
                                <div className="hidden lg:flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-800/50 bg-slate-900/30 text-slate-600 border-dashed">
                                    <Star size={24} className="mb-2 opacity-30" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-center">Clear tasks to<br/>earn stars</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CoordinatorDailyTodo;

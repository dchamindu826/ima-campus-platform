import React from 'react';
import { BarChart3, Users, CheckCircle, Clock } from 'lucide-react';

export default function StaffProgress({ staffList, leads }) {
    // සරලව ගණනය කිරීම් (Real-time DB එකෙන් එන data එක්ක මැච් වෙන්න ඕනේ)
    const getStaffStats = (staffId) => {
        const staffLeads = leads.filter(l => l.assignedTo === staffId);
        const total = staffLeads.length;
        const closed = staffLeads.filter(l => l.status === 'CLOSED').length;
        const pending = total - closed;
        const performance = total === 0 ? 0 : Math.round((closed / total) * 100);

        return { total, closed, pending, performance };
    };

    return (
        <div className="w-80 bg-slate-900/80 border-l border-white/10 backdrop-blur-xl p-5 flex flex-col h-full overflow-y-auto custom-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <BarChart3 size={20}/>
                </div>
                <div>
                    <h2 className="text-lg font-black text-white tracking-wide">Staff Progress</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time Metrics</p>
                </div>
            </div>

            <div className="space-y-4">
                {staffList.map(staff => {
                    const stats = getStaffStats(staff.id);
                    return (
                        <div key={staff.id} className="bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2"><Users size={14} className="text-slate-400"/> {staff.name}</h4>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${stats.performance >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                    {stats.performance}% Win Rate
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-800/50 p-2 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total</p>
                                    <p className="text-lg font-black text-white">{stats.total}</p>
                                </div>
                                <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
                                    <p className="text-[10px] text-orange-400 font-bold uppercase mb-1">Pending</p>
                                    <p className="text-lg font-black text-orange-400">{stats.pending}</p>
                                </div>
                                <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Closed</p>
                                    <p className="text-lg font-black text-emerald-400">{stats.closed}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
        </div>
    );
}
import React from 'react';
import { Wallet, TrendingUp, DollarSign } from 'lucide-react';

export default function FinanceOverview() {
    return (
        <div className="w-full animate-fade-in text-slate-200 pb-10 font-sans relative">
            <div className="flex items-center gap-4 mb-8 bg-[#1e2336]/60 p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-xl">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 shrink-0">
                    <Wallet size={28}/>
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide">Finance Overview</h2>
                    <p className="text-slate-400 font-medium text-sm mt-1">Financial analytics, reports, and revenue summaries.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#1e2336]/80 border border-white/5 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="text-emerald-400" size={20} />
                        <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Total Revenue</h3>
                    </div>
                    <p className="text-3xl font-black text-white">LKR 0.00</p>
                </div>
                <div className="bg-[#1e2336]/80 border border-white/5 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-blue-400" size={20} />
                        <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Pending Dues</h3>
                    </div>
                    <p className="text-3xl font-black text-white">LKR 0.00</p>
                </div>
                <div className="bg-[#1e2336]/80 border border-white/5 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <Wallet className="text-purple-400" size={20} />
                        <h3 className="text-slate-400 font-bold text-sm uppercase tracking-widest">Approved Payments</h3>
                    </div>
                    <p className="text-3xl font-black text-white">0</p>
                </div>
            </div>

            <div className="text-center py-20 bg-[#1e2336]/40 rounded-[2rem] border border-white/5">
                <p className="text-slate-500 font-bold text-lg">Detailed Finance Analytics Will Go Here.</p>
            </div>
        </div>
    );
}
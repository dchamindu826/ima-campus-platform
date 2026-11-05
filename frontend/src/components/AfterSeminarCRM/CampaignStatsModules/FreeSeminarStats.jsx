import React from 'react';
import { FaUsers, FaGlobe } from 'react-icons/fa';

export default function FreeSeminarStats({ data }) {
    if (!data) return null;

    return (
        <div className="bg-[#1a2430] p-6 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden">
            <h2 className="text-slate-100 font-bold text-lg mb-5 flex items-center gap-3 relative z-10">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FaUsers className="text-blue-400" size={18}/>
                </div>
                Free Seminar Lead Conversion
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="bg-[#0f172a] p-5 rounded-xl border border-slate-700/50 text-center shadow-sm">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Total Leads</p>
                    <h3 className="text-3xl font-bold text-white">{data.total || 0}</h3>
                </div>
                
                <div className="bg-emerald-900/10 p-5 rounded-xl border border-emerald-500/20 text-center shadow-sm">
                    <p className="text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Enrolled</p>
                    <h3 className="text-3xl font-bold text-emerald-400 mb-3">{data.enrolled || 0}</h3>
                    <div className="flex justify-center gap-2 text-xs font-medium">
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">F: {data.full || 0}</span>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">M: {data.monthly || 0}</span>
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">I: {data.installment || 0}</span>
                    </div>
                </div>
                
                <div className="bg-rose-900/10 p-5 rounded-xl border border-rose-500/20 text-center shadow-sm">
                    <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2">Non-Enrolled</p>
                    <h3 className="text-3xl font-bold text-rose-400">{data.nonEnrolled || 0}</h3>
                </div>
                
                <div className="bg-indigo-900/10 p-5 rounded-xl border border-indigo-500/20 flex flex-col justify-center shadow-sm">
                    <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4 text-center flex items-center justify-center gap-1.5">
                        <FaGlobe size={14}/> Web Registration
                    </p>
                    <div className="flex justify-between px-4">
                        <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wide">Registered</span>
                            <span className="text-xl font-bold text-emerald-400">{data.webReg || 0}</span>
                        </div>
                        <div className="w-px bg-indigo-500/20 mx-2"></div>
                        <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wide">Not Reg</span>
                            <span className="text-xl font-bold text-rose-400">{data.nonWebReg || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
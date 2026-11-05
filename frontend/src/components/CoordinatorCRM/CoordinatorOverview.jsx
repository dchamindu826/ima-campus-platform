import React, { useState, useEffect } from 'react';
import { FaWhatsapp, FaHeadset, FaChartBar, FaEnvelopeOpen, FaPhoneAlt, FaFolderOpen, FaExchangeAlt, FaGraduationCap, FaCircle, FaSpinner, FaCheckCircle } from 'react-icons/fa';
import axios from '../../api/axios';
import CoordinatorDailyTodo from './CoordinatorDailyTodo';

export default function CoordinatorOverview({ loggedInUser, setActiveMode, selectedBusiness, selectedBatch }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverviewStats();
    }, [selectedBusiness, selectedBatch]);

    const fetchOverviewStats = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/coordinator-crm/overview-stats', {
                params: {
                    businessId: selectedBusiness,
                    batchId: selectedBatch
                }
            });
            setStats(res.data);
        } catch (error) {
            console.error("Failed to fetch coordinator overview stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-[60vh] flex items-center justify-center">
                <FaSpinner className="animate-spin text-4xl text-rose-500" />
            </div>
        );
    }

    const { unreads = { freeSeminar: 0, afterSeminar: 0, total: 0 }, campaigns = {} } = stats || {};

    const handleRedirectCampaign = (path) => {
        window.location.href = path;
    };

    return (
        <div className="space-y-8 animate-fade-in text-left pb-10">
            {/* Header greeting */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-lg">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        Welcome Back, {loggedInUser?.firstName || 'Coordinator'}! 👋
                    </h2>
                    <p className="text-sm font-medium text-slate-400 mt-1">
                        Here's your personal operational stats and follow-up campaign checklist for today.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-widest uppercase border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <FaCircle className="text-[7px] animate-pulse" /> Active Session
                    </span>
                    <span className="bg-white/10 text-gray-300 text-[10px] font-black tracking-widest uppercase border border-white/10 px-3 py-1.5 rounded-xl">
                        {loggedInUser?.department || 'Coordination'}
                    </span>
                </div>
            </div>

            {/* Daily To-Do Checklist */}
            <div className="mb-8">
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FaCheckCircle className="text-emerald-400" /> My Daily To-Do
                </h3>
                <CoordinatorDailyTodo staffId={loggedInUser?.id} />
            </div>

            {/* 🔥 Row 1: Unread WhatsApp Notifications 🔥 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free Seminar Unreads Card */}
                <div 
                    onClick={() => setActiveMode('CRM')}
                    className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/5 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-lg hover:shadow-emerald-500/20 hover:border-emerald-500/40 transition-all hover:-translate-y-1 group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Free Seminar Unreads</p>
                            <h3 className="text-4xl font-black text-white mt-3 flex items-baseline gap-2">
                                {unreads.freeSeminar}
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-normal">Messages</span>
                            </h3>
                        </div>
                        <div className={`p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition-transform ${unreads.freeSeminar > 0 ? 'animate-pulse' : ''}`}>
                            <FaWhatsapp size={26} />
                        </div>
                    </div>
                    {unreads.freeSeminar > 0 ? (
                        <p className="text-xs font-bold text-emerald-400 mt-5 flex items-center gap-1.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            Attention: Reply pending chats in Free Seminar workspace.
                        </p>
                    ) : (
                        <p className="text-xs font-medium text-slate-500 mt-5">All chat messages caught up. Excellent!</p>
                    )}
                </div>

                {/* After Seminar Unreads Card */}
                <div 
                    onClick={() => handleRedirectCampaign('/workspace/campaign/overview')}
                    className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-xl p-6 rounded-3xl border border-indigo-500/20 shadow-lg hover:shadow-indigo-500/20 hover:border-indigo-500/40 transition-all hover:-translate-y-1 group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">After Seminar Unreads</p>
                            <h3 className="text-4xl font-black text-white mt-3 flex items-baseline gap-2">
                                {unreads.afterSeminar}
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-normal">Messages</span>
                            </h3>
                        </div>
                        <div className={`p-4 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform ${unreads.afterSeminar > 0 ? 'animate-pulse' : ''}`}>
                            <FaEnvelopeOpen size={26} />
                        </div>
                    </div>
                    {unreads.afterSeminar > 0 ? (
                        <p className="text-xs font-bold text-indigo-400 mt-5 flex items-center gap-1.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                            </span>
                            Attention: Unread messages awaiting response in Call campaigns.
                        </p>
                    ) : (
                        <p className="text-xs font-medium text-slate-500 mt-5">No unread campaign inquiries. All caught up!</p>
                    )}
                </div>
            </div>

            {/* 🔥 Open Seminar Call Campaign Details 🔥 */}
            <div className="mt-8">
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                    <FaPhoneAlt className="text-indigo-400" /> Open Seminar Call Campaign
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Round 1 Stats */}
                    <div 
                        onClick={() => handleRedirectCampaign('/workspace/campaign/open-seminar')}
                        className="cursor-pointer relative bg-[#0f172a]/80 border border-indigo-500/30 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl hover:bg-[#1e1b4b]/80 hover:border-indigo-400 hover:-translate-y-2 transition-all group overflow-hidden"
                    >
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-500"></div>
                        
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div>
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/30 shadow-sm">Round 1</span>
                                <h4 className="text-3xl font-black text-white mt-4">Initial Follow-up</h4>
                                <p className="text-slate-400 text-sm font-medium mt-1">Within first 7 days</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <FaPhoneAlt size={28} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 relative z-10">
                            <div className="bg-black/40 border border-indigo-500/20 p-6 rounded-3xl flex flex-col items-center justify-center relative shadow-inner">
                                {stats?.openSeminarDetails?.r1Pending > 0 && <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]"></span>}
                                <span className="text-5xl font-black text-amber-400 drop-shadow-md">{stats?.openSeminarDetails?.r1Pending || 0}</span>
                                <span className="text-[10px] font-bold text-indigo-200/70 uppercase tracking-widest mt-2">Pending Calls</span>
                            </div>
                            <div className="bg-black/40 border border-indigo-500/20 p-6 rounded-3xl flex flex-col items-center justify-center relative shadow-inner">
                                {stats?.openSeminarDetails?.r1Delayed > 0 && <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span>}
                                <span className="text-5xl font-black text-rose-500 drop-shadow-md">{stats?.openSeminarDetails?.r1Delayed || 0}</span>
                                <span className="text-[10px] font-bold text-indigo-200/70 uppercase tracking-widest mt-2">Delayed Calls</span>
                            </div>
                        </div>
                    </div>

                    {/* Round 2 Stats */}
                    <div 
                        onClick={() => handleRedirectCampaign('/workspace/campaign/open-seminar')}
                        className="cursor-pointer relative bg-[#0f172a]/80 border border-purple-500/30 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl hover:bg-[#2e1065]/80 hover:border-purple-400 hover:-translate-y-2 transition-all group overflow-hidden"
                    >
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-500"></div>
                        
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div>
                                <span className="text-xs font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-4 py-1.5 rounded-full border border-purple-500/30 shadow-sm">Round 2</span>
                                <h4 className="text-3xl font-black text-white mt-4">Secondary Follow-up</h4>
                                <p className="text-slate-400 text-sm font-medium mt-1">Within second 7 days</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                                <FaPhoneAlt size={28} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 relative z-10">
                            <div className="bg-black/40 border border-purple-500/20 p-6 rounded-3xl flex flex-col items-center justify-center relative shadow-inner">
                                {stats?.openSeminarDetails?.r2Pending > 0 && <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]"></span>}
                                <span className="text-5xl font-black text-amber-400 drop-shadow-md">{stats?.openSeminarDetails?.r2Pending || 0}</span>
                                <span className="text-[10px] font-bold text-purple-200/70 uppercase tracking-widest mt-2">Pending Calls</span>
                            </div>
                            <div className="bg-black/40 border border-purple-500/20 p-6 rounded-3xl flex flex-col items-center justify-center relative shadow-inner">
                                {stats?.openSeminarDetails?.r2Delayed > 0 && <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span>}
                                <span className="text-5xl font-black text-rose-500 drop-shadow-md">{stats?.openSeminarDetails?.r2Delayed || 0}</span>
                                <span className="text-[10px] font-bold text-purple-200/70 uppercase tracking-widest mt-2">Delayed Calls</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

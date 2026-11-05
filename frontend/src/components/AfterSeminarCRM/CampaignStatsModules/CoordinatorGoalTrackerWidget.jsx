import React, { useState } from 'react';
import { FaBullseye, FaUsers, FaTrophy, FaFire, FaCrown, FaRocket, FaCheckCircle, FaBolt, FaAward, FaMedal } from 'react-icons/fa';

export default function CoordinatorGoalTrackerWidget({ 
    myAssigned = 0, 
    myEnrolled = 0, 
    totalGroupAssigned = 0, 
    totalGroupEnrolled = 0, 
    targetIndividualGoal = 40, 
    targetGroupGoal = 50,
    staffBreakdown = []
}) {
    // Single Goal Calculations
    const requiredSingleCount = Math.floor((targetIndividualGoal / 100) * myAssigned);
    const neededSingle = Math.max(0, requiredSingleCount - myEnrolled);
    const singleProgress = neededSingle === 0 ? 100 : Math.min(100, Math.round((myEnrolled / (requiredSingleCount || 1)) * 100));
    let myRate = myAssigned > 0 ? Math.round((myEnrolled / myAssigned) * 100) : 0;
    if (neededSingle === 0 && myEnrolled > 0 && targetIndividualGoal > myRate) {
        myRate = targetIndividualGoal;
    }

    // Group Goal Calculations
    const requiredGroupCount = Math.floor((targetGroupGoal / 100) * totalGroupAssigned);
    const neededGroup = Math.max(0, requiredGroupCount - totalGroupEnrolled);
    const groupProgress = neededGroup === 0 ? 100 : Math.min(100, Math.round((totalGroupEnrolled / (requiredGroupCount || 1)) * 100));
    let groupRate = totalGroupAssigned > 0 ? Math.round((totalGroupEnrolled / totalGroupAssigned) * 100) : 0;
    if (neededGroup === 0 && totalGroupEnrolled > 0 && targetGroupGoal > groupRate) {
        groupRate = targetGroupGoal;
    }

    // Sort coordinators by enrolled count for top team drivers
    const topTeamDrivers = [...staffBreakdown].sort((a, b) => {
        const enrolledA = a.overall?.enrolled || 0;
        const enrolledB = b.overall?.enrolled || 0;
        return enrolledB - enrolledA;
    }).slice(0, 3);

    // Level badge styling
    let levelBadge = { label: "Level 1 • Starter", color: "from-slate-700 to-slate-800 text-slate-300 border-slate-600" };
    if (singleProgress >= 100) {
        levelBadge = { label: "Level 4 • Champion 👑", color: "from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]" };
    } else if (singleProgress >= 75) {
        levelBadge = { label: "Level 3 • Performer 🌟", color: "from-cyan-500 to-blue-600 text-white font-bold border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]" };
    } else if (singleProgress >= 40) {
        levelBadge = { label: "Level 2 • On Track ⚡", color: "from-indigo-500 to-purple-600 text-white font-bold border-indigo-400/50" };
    }

    // Helper to get backend base URL for images
    const getBackendBase = () => {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        if (protocol === 'https:') return `https://${host}`;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
        return `http://${host}:5000`;
    };

    // Helper to get full avatar image URL
    const getAvatarSrc = (driver) => {
        const img = driver.image || driver.appChatDp;
        if (!img) return null;
        if (img.startsWith('http') || img.startsWith('data:')) return img;
        const clean = img.replace(/^\/?(storage\/users\/)?/, '');
        return `${getBackendBase()}/storage/users/${clean}`;
    };

    // Clean name from "undefined"
    const getCleanName = (name) => {
        if (!name) return 'Coordinator';
        return name.replace(/\bundefined\b/gi, '').trim() || 'Coordinator';
    };

    const getInitials = (name) => {
        const cleaned = getCleanName(name);
        const parts = cleaned.split(' ').filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return cleaned.substring(0, 2).toUpperCase();
    };

    return (
        <div className="w-full mb-7 font-sans">
            {/* Main Outer Container: Glassmorphic Banner */}
            <div className="bg-gradient-to-r from-[#0D1527] via-[#111A33] to-[#0D1527] border border-slate-700/50 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
                
                {/* Background ambient light */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10 items-stretch">
                    
                    {/* ========================================================= */}
                    {/* LEFT PANEL: SINGLE & GROUP GOAL METRICS (8 cols) */}
                    {/* ========================================================= */}
                    <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* --- MODULE 1: INDIVIDUAL GOAL --- */}
                        <div className="bg-slate-900/70 border border-indigo-500/25 rounded-2xl p-4 backdrop-blur-md shadow-lg flex flex-col justify-between hover:border-indigo-400/40 transition-all group">
                            <div>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-cyan-300 shadow-inner group-hover:scale-105 transition-transform">
                                            <FaBullseye size={18} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">Personal Target</span>
                                            <h4 className="text-sm font-black text-white tracking-wide">Single Conversion Goal</h4>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 text-[10px] uppercase font-black rounded-xl border bg-gradient-to-r ${levelBadge.color}`}>
                                        {levelBadge.label}
                                    </span>
                                </div>

                                {/* Score & Target Line */}
                                <div className="flex items-end justify-between my-2.5 bg-slate-950/70 p-3 rounded-xl border border-white/5">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">My Conversion</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-white tracking-tight">{myRate}%</span>
                                            <span className="text-xs font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/30">
                                                {myEnrolled} / {myAssigned} Enrolled
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Goal Line</span>
                                        <span className="text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1 rounded-xl border border-indigo-400/40 shadow-md inline-block">
                                            {targetIndividualGoal}%
                                        </span>
                                    </div>
                                </div>

                                {/* Animated Progress Bar */}
                                <div className="space-y-1 my-2">
                                    <div className="flex justify-between items-center text-[11px] font-bold">
                                        <span className="text-slate-300 flex items-center gap-1.5"><FaBolt className="text-cyan-400" size={12} /> Progress</span>
                                        <span className="text-cyan-300 font-black">{singleProgress}% <span className="text-slate-400 text-[10px] font-normal">of goal</span></span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-950 rounded-full p-0.5 border border-white/10 overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                                            style={{ width: `${Math.max(4, Math.min(100, singleProgress))}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Status Callout Banner */}
                            <div className="mt-2 pt-2 border-t border-white/5">
                                {neededSingle > 0 ? (
                                    <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2 text-xs text-amber-200">
                                        <FaFire className="text-amber-400 shrink-0" size={13} />
                                        <span>Need <strong className="text-white font-black text-xs bg-amber-500/30 px-1.5 py-0.5 rounded border border-amber-400/40">{neededSingle}</strong> more enrollments for goal ({targetIndividualGoal}%) 🎯</span>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
                                        <FaCheckCircle className="text-emerald-400 shrink-0" size={13} />
                                        <span className="font-bold">Individual Goal Achieved! ({myRate}%) 🎯</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- MODULE 2: GROUP INTAKE GOAL --- */}
                        <div className="bg-slate-900/70 border border-emerald-500/25 rounded-2xl p-4 backdrop-blur-md shadow-lg flex flex-col justify-between hover:border-emerald-400/40 transition-all group">
                            <div>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner group-hover:scale-105 transition-transform">
                                            <FaUsers size={18} className="drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Batch Target</span>
                                            <h4 className="text-sm font-black text-white tracking-wide">Group Intake Goal</h4>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-0.5 text-[10px] uppercase font-black rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                                        Team Challenge 🚀
                                    </span>
                                </div>

                                {/* Score & Target Line */}
                                <div className="flex items-end justify-between my-2.5 bg-slate-950/70 p-3 rounded-xl border border-white/5">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Team Conversion</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-white tracking-tight">{groupRate}%</span>
                                            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                                {totalGroupEnrolled} / {totalGroupAssigned} Total
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Batch Goal</span>
                                        <span className="text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1 rounded-xl border border-emerald-400/40 shadow-md inline-block">
                                            {targetGroupGoal}%
                                        </span>
                                    </div>
                                </div>

                                {/* Animated Progress Bar */}
                                <div className="space-y-1 my-2">
                                    <div className="flex justify-between items-center text-[11px] font-bold">
                                        <span className="text-slate-300 flex items-center gap-1.5"><FaRocket className="text-emerald-400" size={12} /> Intake Progress</span>
                                        <span className="text-emerald-300 font-black">{groupProgress}% <span className="text-slate-400 text-[10px] font-normal">of goal</span></span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-950 rounded-full p-0.5 border border-white/10 overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                                            style={{ width: `${Math.max(4, Math.min(100, groupProgress))}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Status Callout Banner */}
                            <div className="mt-2 pt-2 border-t border-white/5">
                                {neededGroup > 0 ? (
                                    <div className="bg-purple-500/10 border border-purple-500/30 p-2 rounded-xl flex items-center gap-2 text-xs text-purple-200">
                                        <FaRocket className="text-purple-400 shrink-0" size={13} />
                                        <span>Team needs <strong className="text-white font-black text-xs bg-purple-500/30 px-1.5 py-0.5 rounded border border-purple-400/40">{neededGroup}</strong> more intake enrollments ({targetGroupGoal}%) 🚀</span>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
                                        <FaTrophy className="text-amber-400 shrink-0" size={13} />
                                        <span className="font-bold">Group Goal Achieved! ({groupRate}%) 🏆</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* RIGHT PANEL: TOP GOAL DRIVERS OLYMPIAN PODIUM (4 cols) */}
                    {/* ========================================================= */}
                    <div className="lg:col-span-4 bg-gradient-to-b from-[#0f172a]/95 via-[#131b34]/95 to-[#0b0f1d]/95 border border-amber-500/30 rounded-2xl p-4 backdrop-blur-xl shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                        
                        {/* Ambient top light glow */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

                        <div className="relative z-10">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3.5 border-b border-amber-500/20 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                        <FaTrophy size={13} className="text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                                        Top Goal Drivers
                                    </h4>
                                </div>
                                <span className="text-[9px] font-black text-amber-300/80 uppercase tracking-widest bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    Podium
                                </span>
                            </div>

                            {/* 3D Olympian Podium Stand */}
                            {topTeamDrivers.length > 0 ? (() => {
                                const leader = topTeamDrivers[0];
                                const driver2 = topTeamDrivers[1];
                                const driver3 = topTeamDrivers[2];

                                const renderPodiumPillar = (driver, rank) => {
                                    if (!driver) {
                                        return (
                                            <div key={rank} className="flex-1 flex flex-col items-center justify-end opacity-40">
                                                <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 bg-slate-800/40 flex items-center justify-center text-[10px] text-slate-500 font-bold mb-2">
                                                    #{rank}
                                                </div>
                                                <span className="text-[9px] text-slate-500 font-medium">Open Slot</span>
                                                <div className="w-full h-14 bg-slate-900/40 rounded-t-xl border-t border-slate-800 mt-2"></div>
                                            </div>
                                        );
                                    }

                                    const enrolled = driver.overall?.enrolled || 0;
                                    const sharePct = totalGroupEnrolled > 0 ? Math.round((enrolled / totalGroupEnrolled) * 100) : 0;
                                    const avatarUrl = getAvatarSrc(driver);
                                    const cleanName = getCleanName(driver.name);
                                    const initials = getInitials(driver.name);

                                    // Rank specifics
                                    const isFirst = rank === 1;
                                    const isSecond = rank === 2;
                                    const isThird = rank === 3;

                                    const rankTitle = isFirst ? "LEADER" : isSecond ? "DRIVER" : "ANCHOR";
                                    const rankBadgeColor = isFirst 
                                        ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border-amber-400/50" 
                                        : isSecond 
                                        ? "bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-cyan-300 border-cyan-400/50" 
                                        : "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 border-purple-400/50";

                                    const ringStyle = isFirst
                                        ? "border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.6)] ring-2 ring-amber-300/40"
                                        : isSecond
                                        ? "border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.45)] ring-1 ring-cyan-300/30"
                                        : "border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.45)] ring-1 ring-purple-300/30";

                                    const avatarSize = isFirst ? "lg" : "md";
                                    const podiumHeight = isFirst ? "h-20" : isSecond ? "h-16" : "h-14";
                                    const podiumBg = isFirst 
                                        ? "bg-gradient-to-t from-amber-950/80 via-amber-900/40 to-amber-500/20 border-t-2 border-amber-400/60 shadow-[0_-5px_15px_rgba(251,191,36,0.15)]"
                                        : isSecond
                                        ? "bg-gradient-to-t from-slate-950 via-cyan-950/40 to-cyan-500/20 border-t-2 border-cyan-400/50 shadow-[0_-4px_12px_rgba(34,211,238,0.1)]"
                                        : "bg-gradient-to-t from-slate-950 via-purple-950/40 to-purple-500/20 border-t-2 border-purple-400/50 shadow-[0_-4px_12px_rgba(168,85,247,0.1)]";

                                    const rankNumberBadge = isFirst
                                        ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                                        : isSecond
                                        ? "bg-gradient-to-r from-cyan-400 to-blue-400 text-slate-950 font-black shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                                        : "bg-gradient-to-r from-purple-400 to-pink-400 text-slate-950 font-black shadow-[0_0_6px_rgba(168,85,247,0.6)]";

                                    return (
                                        <div key={rank} className={`flex-1 flex flex-col items-center justify-end ${isFirst ? 'z-20 -mx-1' : 'z-10'}`}>
                                            {/* Crown / Rank Icon perched on top */}
                                            <div className="mb-1">
                                                {isFirst ? (
                                                    <FaCrown size={16} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce" />
                                                ) : isSecond ? (
                                                    <FaMedal size={14} className="text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]" />
                                                ) : (
                                                    <FaAward size={14} className="text-purple-300 drop-shadow-[0_0_5px_rgba(168,85,247,0.6)]" />
                                                )}
                                            </div>

                                            {/* Large Crisp Avatar Container with Floating Rank Number */}
                                            <div className="relative mb-2 group/avatar">
                                                <CrispStaffAvatar 
                                                    src={avatarUrl} 
                                                    initials={initials} 
                                                    ringStyle={ringStyle}
                                                    size={avatarSize}
                                                    rank={rank}
                                                />
                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-slate-900 ${rankNumberBadge}`}>
                                                    {rank}
                                                </div>
                                            </div>

                                            {/* Coordinator Name & Title */}
                                            <div className="text-center w-full px-1 mb-1.5 min-h-[38px] flex flex-col justify-start items-center">
                                                <span className={`font-black leading-tight text-white block truncate w-full ${isFirst ? 'text-[11px]' : 'text-[10px]'}`} title={cleanName}>
                                                    {cleanName}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full border mt-0.5 inline-block ${rankBadgeColor}`}>
                                                    {rankTitle}
                                                </span>
                                            </div>

                                            {/* Enrolled Metric Pill */}
                                            <div className="mb-1.5">
                                                <span className="bg-emerald-950/80 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-500/40 shadow-sm flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                    {enrolled} Enrolled
                                                </span>
                                            </div>

                                            {/* Podium Pillar Pedestal */}
                                            <div className={`w-full ${podiumHeight} ${podiumBg} rounded-t-xl flex flex-col items-center justify-center p-1.5 transition-all group-hover:brightness-110`}>
                                                <span className={`font-black tracking-tight ${isFirst ? 'text-lg text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-sm text-white'}`}>
                                                    {sharePct}%
                                                </span>
                                                <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
                                                    Share
                                                </span>
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div className="flex items-end justify-center gap-2 pt-2 pb-1 min-h-[220px]">
                                        {/* Podium Order: 2nd Place (Left), 1st Place (Center - Elevated), 3rd Place (Right) */}
                                        {renderPodiumPillar(driver2, 2)}
                                        {renderPodiumPillar(leader, 1)}
                                        {renderPodiumPillar(driver3, 3)}
                                    </div>
                                );
                            })() : (
                                <div className="text-center py-10 text-xs text-slate-500 font-medium">
                                    <FaTrophy className="mx-auto text-slate-600 mb-2" size={24} />
                                    No driver data available yet
                                </div>
                            )}
                        </div>

                        {/* Footer Total Enrolled Pill */}
                        <div className="mt-3 pt-2.5 border-t border-amber-500/20 text-[10px] font-bold text-slate-400 flex items-center justify-between bg-slate-950/40 p-2 rounded-xl border border-white/5">
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <FaRocket className="text-amber-400" size={11} /> Team Goal Velocity
                            </span>
                            <span className="text-emerald-400 font-black bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                {totalGroupEnrolled} Total Enrolled
                            </span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Subcomponent to render CRISP staff avatar with responsive sizes & rank gradients
function CrispStaffAvatar({ src, initials, ringStyle, size = "md", rank = 1 }) {
    const [failed, setFailed] = useState(false);

    const sizeClass = size === "lg" ? "w-16 h-16" : "w-13 h-13";
    const initialTextSize = size === "lg" ? "text-base font-black" : "text-xs font-black";

    const rankInitialBg = rank === 1
        ? "bg-gradient-to-br from-amber-400 via-amber-600 to-yellow-700 text-slate-950 font-black"
        : rank === 2
        ? "bg-gradient-to-br from-cyan-400 via-teal-600 to-blue-700 text-white font-black"
        : "bg-gradient-to-br from-purple-400 via-indigo-600 to-pink-700 text-white font-black";

    if (src && !failed) {
        return (
            <div className={`${sizeClass} rounded-full border-2 ${ringStyle} overflow-hidden shrink-0 aspect-square bg-slate-900 flex items-center justify-center transform transition-transform group-hover/avatar:scale-105 shadow-xl`}>
                <img 
                    src={src} 
                    alt="Coordinator Profile" 
                    className="w-full h-full object-cover object-top aspect-square"
                    onError={() => setFailed(true)}
                />
            </div>
        );
    }

    return (
        <div className={`${sizeClass} rounded-full ${rankInitialBg} border-2 ${ringStyle} flex items-center justify-center ${initialTextSize} shrink-0 aspect-square shadow-xl transform transition-transform group-hover/avatar:scale-105`}>
            {initials}
        </div>
    );
}

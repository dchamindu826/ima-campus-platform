import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from "../../../api/axios";
import {
    Loader2, Bell, AlertTriangle, CheckCircle, Calendar, Clock,
    User, X, Smartphone, Download, AlertCircle, Apple,
    Video, Play, Radio, CalendarDays, Lock, BookOpen,
    Camera, Sparkles, Plus, Check, Trophy, Award, TrendingUp,
    BarChart3, ChevronRight, MessageSquare, CheckCircle2, FileText,
    ArrowRight, Layers, Eye, RefreshCw, GraduationCap, Target, HelpCircle,
    ChevronDown, ChevronUp, Copy, ExternalLink
} from 'lucide-react';
import UpgradeOfferWidget from './UpgradeOfferWidget';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { resolveAvatarUrl } from '../../../utils/avatarUtils';

export default function StudentOverview({ setActiveTab }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedImage, setSelectedImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Academic Progress, Leaderboard & Paper History States
    const [paperData, setPaperData] = useState(null);
    const [paperLoading, setPaperLoading] = useState(true);
    const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
    const [selectedTestForBreakdown, setSelectedTestForBreakdown] = useState(null);
    const [activeLeaderboardPaperId, setActiveLeaderboardPaperId] = useState(null);
    const [customLeaderboardData, setCustomLeaderboardData] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [showAllRankings, setShowAllRankings] = useState(false);

    // App Banner State (Dismissible)
    const [showAppBanner, setShowAppBanner] = useState(() => {
        return localStorage.getItem('hide_student_app_banner') !== 'true';
    });

    const handleDismissAppBanner = () => {
        setShowAppBanner(false);
        localStorage.setItem('hide_student_app_banner', 'true');
    };

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}') || {};
        } catch {
            return {};
        }
    });

    const user = currentUser;
    const backendBaseUrl = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : 'https://imacampus.online';

    const avatarUrl = resolveAvatarUrl(
        currentUser.image,
        currentUser.phone || currentUser.whatsapp,
        axios.defaults.baseURL
    );
    const hasCustomPhoto = currentUser.image && 
                           currentUser.image !== 'default.png' && 
                           currentUser.image !== 'null' && 
                           !String(currentUser.image).startsWith('chat_dps/');
    const profilePic = avatarUrl;

    useEffect(() => {
        const handleUserUpdate = () => {
            try {
                setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}') || {});
            } catch (e) {}
        };
        window.addEventListener('storage', handleUserUpdate);
        window.addEventListener('user-updated', handleUserUpdate);
        return () => {
            window.removeEventListener('storage', handleUserUpdate);
            window.removeEventListener('user-updated', handleUserUpdate);
        };
    }, []);

    const handleDirectImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select a valid image file (PNG, JPG, WebP)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        setIsUploading(true);
        const toastId = toast.loading('Uploading profile picture...');
        try {
            const formData = new FormData();
            formData.append('image', file);
            if (currentUser.addressHouseNo) formData.append('addressHouseNo', currentUser.addressHouseNo);
            if (currentUser.addressStreet) formData.append('addressStreet', currentUser.addressStreet);
            if (currentUser.city) formData.append('city', currentUser.city);
            if (currentUser.district) formData.append('district', currentUser.district);

            const res = await axios.post('/student/profile/update', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newImage = res.data?.image || file.name;
            const updatedUser = { ...currentUser, image: newImage };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setCurrentUser(updatedUser);
            window.dispatchEvent(new Event('user-updated'));

            toast.success('Awesome! Profile picture updated! 🎉 Looking sharp!', { id: toastId, icon: '📸' });
        } catch (err) {
            console.error('Failed to upload profile picture:', err);
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to upload profile picture', { id: toastId });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        // 1. Fetch Student Dashboard
        axios.get('/student/dashboard')
            .then(res => {
                setData(res.data);
                if (res.data?.alerts) {
                    res.data.alerts.forEach(alert => {
                        if (alert.type === 'locked') toast.error(alert.msg, { duration: 8000 });
                        else toast(alert.msg, { icon: '⚠️', duration: 5000 });
                    });
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

        // 2. Fetch Paper Progress & Exams
        axios.get('/papers/student/progress')
            .then(res => {
                setPaperData(res.data);
                if (res.data?.latestLeaderboard?.paperId) {
                    setActiveLeaderboardPaperId(res.data.latestLeaderboard.paperId);
                }
            })
            .catch(err => console.error("Paper progress error:", err))
            .finally(() => setPaperLoading(false));

        return () => clearInterval(timer);
    }, []);

    // Load paper leaderboard for a specific test
    const loadPaperLeaderboard = async (paperId) => {
        if (!paperId) return;
        setActiveLeaderboardPaperId(paperId);
        setLoadingLeaderboard(true);
        try {
            const res = await axios.get(`/papers/${paperId}/leaderboard`);
            setCustomLeaderboardData(res.data);
        } catch (err) {
            console.error("Leaderboard error:", err);
            toast.error("Failed to load paper leaderboard");
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    // Chat with Paper Guider Trigger
    const handleChatWithGuider = (test) => {
        setSelectedTestForBreakdown(null);
        window.dispatchEvent(new CustomEvent('open-paper-guider-chat', {
            detail: {
                paperId: test?.paperId,
                testTitle: test?.testTitle,
                courseId: test?.courseId,
                batchId: test?.batchId,
                className: test?.courseName || test?.batchName || test?.classLabel
            }
        }));
        toast.success("Opening LUMI Chat with Paper Guider...", { icon: '🎓' });
    };

    // Filter tests by selected class
    const filteredTests = useMemo(() => {
        const list = paperData?.recentTests || [];
        if (selectedClassFilter === 'ALL') return list;
        return list.filter(t => 
            String(t.courseId) === String(selectedClassFilter) || 
            String(t.batchId) === String(selectedClassFilter) ||
            `batch_${t.batchId}` === String(selectedClassFilter) ||
            t.className === selectedClassFilter ||
            t.classLabel === selectedClassFilter
        );
    }, [paperData, selectedClassFilter]);

    // Calculate class-specific metrics & academic level
    const classMetrics = useMemo(() => {
        const list = filteredTests;
        const total = list.length;
        if (total === 0) {
            return {
                totalTaken: 0,
                averageScore: 0,
                averagePercentage: 0,
                highestScore: 0,
                passRate: 0,
                level: 1,
                levelTitle: 'Rising Aspirant (Beginner Level)',
                levelBadge: 'Level 1'
            };
        }
        const totalScore = list.reduce((sum, item) => sum + (item.score || 0), 0);
        const totalPerc = list.reduce((sum, item) => sum + (item.percentage || 0), 0);
        const highestScore = Math.max(...list.map(i => i.score || 0));
        const passCount = list.filter(i => i.isPassed).length;
        const avgPerc = parseFloat((totalPerc / total).toFixed(1));

        let level = 1;
        let levelTitle = 'Rising Aspirant (Beginner Level)';
        let levelBadge = 'Level 1';

        if (avgPerc >= 85 && total >= 2) {
            level = 5;
            levelTitle = 'Master Scholar (Distinction Level)';
            levelBadge = 'Level 5';
        } else if (avgPerc >= 75) {
            level = 4;
            levelTitle = 'Elite Performer (High Merit)';
            levelBadge = 'Level 4';
        } else if (avgPerc >= 65) {
            level = 3;
            levelTitle = 'High Achiever (Good Progress)';
            levelBadge = 'Level 3';
        } else if (avgPerc >= 50) {
            level = 2;
            levelTitle = 'Steady Climber (Average Level)';
            levelBadge = 'Level 2';
        }

        return {
            totalTaken: total,
            averageScore: parseFloat((totalScore / total).toFixed(1)),
            averagePercentage: avgPerc,
            highestScore,
            passRate: Math.round((passCount / total) * 100),
            level,
            levelTitle,
            levelBadge
        };
    }, [filteredTests]);

    // Active Leaderboard Data
    const activeLeaderboard = useMemo(() => {
        if (customLeaderboardData) {
            return {
                title: customLeaderboardData.paper?.title || 'Class Leaderboard',
                totalMarks: customLeaderboardData.paper?.totalMarks || 100,
                ranks: (customLeaderboardData.leaderboard || []).map(r => ({
                    rank: r.rank,
                    studentId: r.student?.id,
                    name: r.student?.name || 'Student',
                    firstName: r.student?.firstName,
                    image: r.student?.image,
                    city: r.student?.city || 'IMA Campus',
                    score: r.score,
                    grade: r.grade
                })),
                myStanding: customLeaderboardData.myStanding,
                podium: customLeaderboardData.podium
            };
        }
        if (paperData?.latestLeaderboard) {
            const ranks = paperData.latestLeaderboard.ranks || [];
            const callingId = currentUser?.id || currentUser?.userId;
            return {
                title: paperData.latestLeaderboard.testTitle || 'Latest Paper Leaderboard',
                totalMarks: paperData.latestLeaderboard.totalMarks || 100,
                ranks,
                podium: {
                    first: ranks[0] || null,
                    second: ranks[1] || null,
                    third: ranks[2] || null
                },
                myStanding: ranks.find(r => String(r.studentId) === String(callingId))
            };
        }
        return null;
    }, [customLeaderboardData, paperData, currentUser]);

    const getGradeBadgeStyle = (grade) => {
        switch((grade || '').toUpperCase()) {
            case 'A': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
            case 'B': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
            case 'C': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
            case 'S': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            default: return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };


    // 🔥 Robust Time Parser for SL Tuition Schedules 🔥
    const parseTimeComponents = (timeStr) => {
        if (!timeStr) return { h: 0, m: 0 };
        const str = String(timeStr).trim();
        const isPM = /pm/i.test(str);
        const isAM = /am/i.test(str);
        const clean = str.replace(/[^\d:]/g, '');
        const parts = clean.split(':').map(Number);
        let h = parts[0] || 0;
        const m = parts[1] || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        // In SL tuition LMS, classes entered as 01:00 - 06:00 without explicit AM are almost universally 1 PM - 6 PM
        if (!isAM && !isPM && h >= 1 && h <= 6) {
            h += 12;
        }
        return { h, m };
    };

    // 🔥 Live Class Logic (Timezone-Aware for Sri Lanka Asia/Colombo) 🔥
    const getLiveClassInfo = (c) => {
        if (!c || !c.date) return null;

        // Parse calendar day with consideration for Sri Lankan time (Asia/Colombo)
        let y, mo, d;
        try {
            const dObj = new Date(c.date);
            if (!isNaN(dObj.getTime())) {
                const slFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Colombo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                const parts = slFormatter.format(dObj).split('-').map(Number);
                y = parts[0];
                mo = parts[1];
                d = parts[2];
            }
        } catch (e) {
            console.error("Date format error:", e);
        }

        if (!y || !mo || !d) {
            const datePart = String(c.date).split('T')[0];
            const parts = datePart.split('-').map(Number);
            y = parts[0];
            mo = parts[1];
            d = parts[2];
        }
        if (!y || !mo || !d) return null;

        const { h: startH, m: startM } = parseTimeComponents(c.startTime);
        const sDate = new Date(y, mo - 1, d, startH, startM, 0, 0);

        let eDate;
        if (c.endTime) {
            const { h: endH, m: endM } = parseTimeComponents(c.endTime);
            eDate = new Date(y, mo - 1, d, endH, endM, 0, 0);
            // If endTime <= startTime (e.g. crossing midnight like 22:00 to 01:00), add 1 day
            if (eDate <= sDate) {
                eDate.setDate(eDate.getDate() + 1);
            }
        } else {
            eDate = new Date(sDate.getTime() + 2 * 60 * 60 * 1000); // Default to 2 hours if no end time
        }

        // Safe absolute link
        let joinUrl = c.link ? String(c.link).trim() : '';
        if (joinUrl && !joinUrl.startsWith('http://') && !joinUrl.startsWith('https://')) {
            joinUrl = `https://${joinUrl}`;
        }

        return { ...c, startObj: sDate, endObj: eDate, safeLink: joinUrl };
    };

    const renderLiveBanner = (c) => {
        const liveClass = getLiveClassInfo(c);
        if (!liveClass) return null;

        // Allow class banner to remain visible during class AND for up to 6 hours after scheduled end time
        const expiryTime = liveClass.endObj.getTime() + (6 * 60 * 60 * 1000);
        if (expiryTime <= currentTime.getTime()) return null; // Hide only if expired more than 6 hours ago

        const diff = liveClass.startObj - currentTime;
        const isLiveNow = diff <= 0 && currentTime <= liveClass.endObj;
        const isOvertime = diff <= 0 && currentTime > liveClass.endObj && currentTime.getTime() <= expiryTime;
        const isJoinable = true;
        const isUrgent = diff > 0 && diff < 15 * 60 * 1000; // Pulse animation 15 mins before
        const hasLink = Boolean(liveClass.safeLink || liveClass.link);

        let timeUI = null;
        if (isLiveNow) {
            timeUI = (
                <div className="flex items-center justify-center gap-2 md:gap-3 text-red-500 font-black animate-pulse px-4 py-2.5 bg-red-500/10 rounded-xl border border-red-500/30 w-full text-xs md:text-sm">
                    <Radio className="animate-ping shrink-0" size={18} />
                    CLASS IS LIVE NOW
                </div>
            );
        } else if (isOvertime) {
            timeUI = (
                <div className="flex items-center justify-center gap-2 md:gap-3 text-amber-400 font-black px-4 py-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 w-full text-xs md:text-sm">
                    <Radio className="shrink-0" size={18} />
                    CLASS IN PROGRESS
                </div>
            );
        } else {
            const absDiff = Math.max(0, diff);
            const h = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((absDiff / 1000 / 60) % 60);
            const s = Math.floor((absDiff / 1000) % 60);
            const d = Math.floor(absDiff / (1000 * 60 * 60 * 24));

            timeUI = (
                <div className={`flex justify-center items-center gap-1 sm:gap-2 ${isUrgent ? 'text-red-400' : 'text-white'} transition-colors duration-500`}>
                    {d > 0 && <div className="flex flex-col items-center bg-black/20 backdrop-blur-xl border border-white/20 rounded-lg p-2 w-12 sm:w-14"><span className="text-lg sm:text-2xl font-black">{d}</span><span className="text-[9px] uppercase font-bold text-white/80 font-medium">Days</span></div>}
                    {d > 0 && <span className="text-base sm:text-xl font-bold opacity-30">:</span>}
                    <div className="flex flex-col items-center bg-black/20 backdrop-blur-xl border border-white/20 rounded-lg p-2 w-12 sm:w-14"><span className="text-lg sm:text-2xl font-black">{h.toString().padStart(2, '0')}</span><span className="text-[9px] uppercase font-bold text-white/80 font-medium">Hrs</span></div>
                    <span className="text-base sm:text-xl font-bold opacity-30">:</span>
                    <div className="flex flex-col items-center bg-black/20 backdrop-blur-xl border border-white/20 rounded-lg p-2 w-12 sm:w-14"><span className="text-lg sm:text-2xl font-black">{m.toString().padStart(2, '0')}</span><span className="text-[9px] uppercase font-bold text-white/80 font-medium">Min</span></div>
                    <span className={`text-base sm:text-xl font-bold opacity-30 ${isUrgent ? 'animate-pulse text-red-500' : ''}`}>:</span>
                    <div className={`flex flex-col items-center bg-black/20 backdrop-blur-xl border border-white/20 rounded-lg p-2 w-12 sm:w-14 ${isUrgent ? 'bg-red-500/10 border-red-500/30' : ''}`}>
                        <span className={`text-lg sm:text-2xl font-black ${isUrgent ? 'animate-bounce text-red-400' : ''}`}>{s.toString().padStart(2, '0')}</span>
                        <span className="text-[9px] uppercase font-bold text-white/80 font-medium">Sec</span>
                    </div>
                </div>
            );
        }

        return (
            <div className={`rounded-2xl md:rounded-[1.5rem] p-4 md:p-6 relative overflow-hidden flex flex-col lg:flex-row items-center lg:items-center justify-between gap-5 transition-all duration-700 w-full ${isJoinable ? 'bg-gradient-to-br from-red-600/20 via-[#0a0f1c] to-red-900/20 border border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.15)]' : 'glass-card border-white/20'}`}>

                {/* Decorative Elements */}
                {isJoinable && <div className="absolute top-0 left-0 w-1.5 bg-red-500 h-full shadow-[0_0_20px_red]"></div>}
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

                {/* Left side details */}
                <div className="flex-1 text-left z-10 w-full min-w-0">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 border w-max ${isLiveNow ? 'bg-red-500/20 border-red-500/30' : 'bg-black/20 backdrop-blur-xl border-white/20'}`}>
                        <Video size={12} className={isLiveNow ? "text-red-400 animate-pulse" : "text-white/90 font-bold"} />
                        <span className={`font-bold uppercase tracking-widest text-[9px] ${isLiveNow ? "text-red-400" : "text-white/90 font-bold"}`}>
                            {isLiveNow ? "Active Live Class" : isOvertime ? "Class In Progress" : "Upcoming Live Class"}
                        </span>
                    </div>

                    <h2
                        className="text-lg md:text-xl font-black text-white mb-1.5 leading-snug break-words whitespace-normal"
                        title={liveClass.title}
                    >
                        {liveClass.title}
                    </h2>

                    <p className="text-white/70 font-medium text-xs md:text-sm font-medium mb-4 truncate">{liveClass.courseName || "Subject Name"}</p>

                    {liveClass.startTime && (
                        <div className="flex flex-row flex-wrap items-center gap-2.5">
                            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-xl px-3 py-1.5 md:px-3 md:py-2 rounded-lg border border-white/20 w-max">
                                <CalendarDays size={12} className="text-blue-400 shrink-0" />
                                <span className="text-white/80 font-medium text-[10px] md:text-xs font-bold uppercase tracking-wider">{liveClass.startObj.toDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-xl px-3 py-1.5 md:px-3 md:py-2 rounded-lg border border-white/20 w-max">
                                <Clock size={12} className="text-yellow-400 shrink-0" />
                                <span className="text-white/80 font-medium text-[10px] md:text-xs font-bold uppercase tracking-wider">{liveClass.startTime} {liveClass.endTime ? `- ${liveClass.endTime}` : ''}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Countdown Timer & Button (Grouped Together) */}
                <div className="z-10 flex flex-col items-center gap-3 shrink-0 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="bg-black/20 backdrop-blur-xl p-3 md:p-4 rounded-2xl border border-white/20 backdrop-blur-sm shadow-inner w-full flex justify-center">
                        {timeUI}
                    </div>

                    <div className="w-full flex flex-col items-center gap-1.5">
                        <a
                            href={liveClass.safeLink || liveClass.link || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`w-full h-12 md:h-14 rounded-xl font-black flex items-center justify-center gap-2 uppercase tracking-widest transition-all duration-300 text-xs md:text-sm ${hasLink ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse hover:animate-none hover:scale-105 border border-red-400 cursor-pointer' : 'bg-black/20 backdrop-blur-xl text-white/70 font-medium cursor-not-allowed border border-white/20'} `}
                            onClick={(e) => {
                                if (!hasLink) {
                                    e.preventDefault();
                                    toast.error("Live link will be available soon!");
                                }
                            }}
                        >
                            {hasLink ? <><Play size={16} className="fill-white" /> Join Now</> : <><Lock size={14} /> Link Pending</>}
                        </a>

                        {hasLink && (
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(liveClass.safeLink || liveClass.link);
                                    toast.success("Zoom live link copied to clipboard! 📋");
                                }}
                                className="text-[11px] text-white/60 hover:text-white flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                title="Copy Zoom Link"
                            >
                                <Copy size={12} />
                                <span>Copy Link</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-red-500" size={40} /></div>;

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 relative px-3 sm:px-0 custom-scrollbar">

            {/* 🔥 NEW APP DOWNLOAD BANNER (IN-PAGE & DISMISSIBLE) 🔥 */}
            {showAppBanner && (
                <div className="bg-gradient-to-r from-[#0b1329] via-[#0f1d3d] to-[#12234e] border border-blue-500/30 rounded-2xl md:rounded-[1.5rem] p-4 sm:p-5 mb-5 sm:mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-5 shadow-[0_8px_30px_rgba(59,130,246,0.15)] relative overflow-hidden animate-in fade-in duration-300">
                    {/* Decorative background element */}
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                    {/* Dismiss Button */}
                    <button
                        type="button"
                        onClick={handleDismissAppBanner}
                        className="absolute top-3 right-3 text-white/50 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors z-20 cursor-pointer"
                        title="Dismiss banner"
                        aria-label="Dismiss banner"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex items-center gap-3.5 sm:gap-4 w-full lg:w-auto text-left z-10 pr-8 lg:pr-0">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-2.5 sm:p-3.5 rounded-xl md:rounded-2xl text-white shadow-lg shadow-blue-500/30 shrink-0">
                            <Smartphone size={24} className="sm:w-7 sm:h-7" />
                        </div>
                        <div>
                            <h4 className="text-white font-black text-sm sm:text-lg md:text-xl tracking-wide leading-tight mb-0.5">
                                Download the Official IMA Campus App
                            </h4>
                            <p className="text-blue-200/70 text-[11px] sm:text-xs md:text-sm font-medium">
                                Experience seamless learning directly from your mobile device.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto z-10">
                        {/* Android / Play Store Button */}
                        <a
                            href="https://play.google.com/store/apps/details?id=com.imaacademyapp&pcampaignid=web_share"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 sm:gap-3 bg-black/30 hover:bg-black/60 border border-white/20 hover:border-blue-500/50 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all duration-300 group shadow-inner"
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg" alt="Play Store" className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform shrink-0" />
                            <div className="text-left flex flex-col justify-center">
                                <span className="text-[8px] sm:text-[9px] text-white/70 font-bold uppercase tracking-wider leading-none mb-0.5">Get it on</span>
                                <span className="text-xs sm:text-sm md:text-base font-black text-white leading-none">Play Store</span>
                            </div>
                        </a>

                        {/* iOS / App Store Button */}
                        <a
                            href="https://apps.apple.com/lk/app/ima-campus/id6759137655"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 sm:gap-3 bg-black/30 hover:bg-black/60 border border-white/20 hover:border-white/40 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all duration-300 group shadow-inner"
                        >
                            <Apple size={20} className="sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform shrink-0" />
                            <div className="text-left flex flex-col justify-center">
                                <span className="text-[8px] sm:text-[9px] text-white/70 font-bold uppercase tracking-wider leading-none mb-0.5">Download on</span>
                                <span className="text-xs sm:text-sm md:text-base font-black text-white leading-none">App Store</span>
                            </div>
                        </a>
                    </div>
                </div>
            )}

            {/* Hidden Native File Input for Instant 1-Click Upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleDirectImageUpload}
            />

            {/* 🔥 COMPACT GREETING CARD WITH SOCIAL MEDIA STORY RING & PROFILE CTA 🔥 */}
            <div className="glass-card flex flex-col sm:flex-row justify-between items-center mb-5 sm:mb-6 gap-4 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-white/15 bg-slate-950/45 backdrop-blur-2xl shadow-xl relative overflow-hidden">
                {/* Subtle colorful ambient glow behind avatar */}
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-gradient-to-br from-rose-500/15 via-purple-500/10 to-amber-500/5 blur-3xl rounded-full pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-6 w-full sm:w-auto text-center sm:text-left z-10">
                    
                    {/* 🌟 SOCIAL MEDIA AVATAR & PROMPT CONTAINER (ENLARGED) 🌟 */}
                    <div className="flex flex-col items-center shrink-0">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group cursor-pointer"
                            role="button"
                            tabIndex={0}
                            title={profilePic ? "Click to change your profile picture" : "Click to add your profile picture"}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                        >
                            {/* Animated Blinking & Radar Waves when no custom profile picture */}
                            {!hasCustomPhoto && (
                                <>
                                    <span className="absolute -inset-3 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 opacity-70 blur-md animate-ping pointer-events-none"></span>
                                    <span className="absolute -inset-2 rounded-full bg-gradient-to-tr from-rose-500 via-purple-600 to-amber-400 opacity-90 blur-sm animate-pulse pointer-events-none"></span>
                                </>
                            )}

                            {/* Social Media Story Gradient Ring */}
                            <div className={`relative w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full p-[3px] transition-all duration-300 ${
                                profilePic
                                    ? 'bg-gradient-to-tr from-emerald-400 via-cyan-500 to-blue-500 group-hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.45)]'
                                    : 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 story-glow-active group-hover:scale-110'
                            }`}>
                                {/* Inner circle housing photo or placeholder */}
                                <div className="w-full h-full rounded-full bg-[#0a0f1d] p-0.5 flex items-center justify-center overflow-hidden relative">
                                    {isUploading ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
                                            <Loader2 className="animate-spin text-rose-400" size={30} />
                                        </div>
                                    ) : profilePic ? (
                                        <>
                                            <img
                                                src={profilePic}
                                                alt="Profile"
                                                className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = resolveAvatarUrl(null, currentUser.phone || currentUser.whatsapp, axios.defaults.baseURL);
                                                }}
                                            />
                                            {/* Hover Camera Overlay */}
                                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition-opacity duration-200">
                                                <Camera size={24} className="text-white drop-shadow" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-rose-500/30 via-purple-500/20 to-amber-500/30 flex items-center justify-center group-hover:bg-rose-500/40 transition-colors">
                                            <User size={38} className="text-white group-hover:scale-110 transition-transform" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Social Media Corner Badge */}
                            {isUploading ? null : !hasCustomPhoto ? (
                                <div className="absolute -bottom-1 -right-1 w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center border-2 border-[#0a0f1d] shadow-lg shadow-rose-500/50 animate-bounce group-hover:scale-125 transition-transform">
                                    <Plus size={16} className="stroke-[3]" />
                                </div>
                            ) : (
                                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center border-2 border-[#0a0f1d] shadow-md group-hover:scale-110 transition-transform">
                                    <Camera size={13} className="stroke-[2.5]" />
                                </div>
                            )}
                        </div>

                        {/* Button directly under Avatar */}
                        {!hasCustomPhoto ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2.5 relative inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] md:text-xs font-black text-white bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 shadow-[0_0_20px_rgba(244,63,94,0.45)] hover:shadow-[0_0_28px_rgba(244,63,94,0.75)] hover:scale-105 active:scale-95 transition-all duration-300 border border-white/25 group cursor-pointer whitespace-nowrap"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <Camera size={13} className="group-hover:rotate-12 transition-transform shrink-0" />
                                <span>Add Your Profile Picture</span>
                                <Sparkles size={12} className="text-yellow-300 animate-pulse shrink-0" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                            >
                                <Camera size={12} />
                                <span>Change Photo</span>
                            </button>
                        )}
                    </div>

                    {/* Greeting & Details */}
                    <div className="flex-1 text-center sm:text-left">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-1.5 border border-white/10 shadow-sm">
                            <Sparkles size={11} className="text-amber-400" /> Keep striving for distinction
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight break-words">
                            {getGreeting()}{user.fName ? <>, <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-300">{user.fName}</span></> : null} 👋
                        </h1>
                        <p className="text-white/80 font-medium text-xs sm:text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Calendar size={13} className="text-sky-400" /> {currentTime.toLocaleDateString()}</span>
                            <span className="opacity-40">•</span>
                            <span className="inline-flex items-center gap-1"><Clock size={13} className="text-amber-400" /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto z-10">
                    <div className="bg-black/30 backdrop-blur-xl border border-white/20 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl flex items-center justify-center gap-3 w-full sm:w-auto min-w-max shadow-sm">
                        <div className="bg-red-500/20 p-2 rounded-lg text-red-400 shrink-0">
                            <BookOpen size={18} />
                        </div>
                        <div className="text-left">
                            <p className="text-[9px] md:text-[10px] text-white/70 font-bold uppercase tracking-widest">Enrolled</p>
                            <p className="text-sm md:text-lg font-black text-white leading-none">{data?.enrolledCount || 0} <span className="text-[10px] md:text-xs font-bold text-white/90">Subjects</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🔥 UPCOMING & ACTIVE LIVE CLASSES BANNER (PROMINENT AT TOP) 🔥 */}
            {data?.upcomingLives && data.upcomingLives.length > 0 && (
                <div className="flex flex-col gap-4 mb-6 animate-in fade-in slide-in-from-top-3 duration-500">
                    {data.upcomingLives.map((c, index) => (
                        <React.Fragment key={index}>
                            {renderLiveBanner(c)}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════════ */}
            {/* 🏆 ACADEMIC EXCELLENCE, MULTI-CLASS LEADERBOARD & PAPER HISTORY HUB 🏆 */}
            {/* ═══════════════════════════════════════════════════════════════════════════════ */}
            <div className="glass-card rounded-[1.5rem] md:rounded-[2rem] p-4 sm:p-6 md:p-8 bg-gradient-to-br from-[#0c1322]/95 via-[#0e172a]/95 to-[#151f38]/95 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.35)] mb-6 space-y-6">
                
                {/* 1. SECTION HEADER & MULTI-CLASS FILTER CONTROL */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-2 shadow-sm">
                            <Trophy size={14} className="text-amber-400" /> Academic Performance & Leaderboard
                        </div>
                        <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-wide flex items-center gap-2">
                            <span>My Academic Progress & Paper History</span>
                            <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                        </h2>
                        <p className="text-white/70 text-xs sm:text-sm font-medium mt-0.5">
                            Track test scores, compare class rankings, and consult your paper guiders in real-time.
                        </p>
                    </div>

                    {/* Multi-Class Filter Pills - Smooth Horizontal Scroll on Mobile */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full lg:w-auto flex-nowrap sm:flex-wrap -mx-1 px-1">
                        <span className="text-white/60 text-xs font-bold uppercase tracking-wider hidden sm:inline mr-1 shrink-0">
                            Class:
                        </span>

                        {/* All Classes Pill */}
                        <button
                            type="button"
                            onClick={() => setSelectedClassFilter('ALL')}
                            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                selectedClassFilter === 'ALL'
                                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-600/30 ring-1 ring-white/30 scale-105'
                                    : 'bg-black/30 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                            }`}
                        >
                            <span>✨ All Classes</span>
                            <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">
                                {paperData?.recentTests?.length || 0}
                            </span>
                        </button>

                        {/* Class-Specific Pills */}
                        {paperData?.classes?.map((cls) => {
                            const classTestsCount = (paperData?.recentTests || []).filter(t => 
                                String(t.courseId) === String(cls.id) || 
                                String(t.batchId) === String(cls.batchId || cls.id) ||
                                t.className === cls.name ||
                                t.classLabel === cls.name
                            ).length;
                            const isSelected = String(selectedClassFilter) === String(cls.id) || String(selectedClassFilter) === String(cls.batchId);

                            return (
                                <button
                                    key={cls.id}
                                    type="button"
                                    onClick={() => setSelectedClassFilter(cls.id)}
                                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-600/30 ring-1 ring-white/30 scale-105'
                                            : 'bg-black/30 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                                    }`}
                                >
                                    <span>{cls.name}</span>
                                    <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">
                                        {classTestsCount}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. PROGRESS BAR & ACADEMIC LEVEL DISPLAY */}
                <div className="bg-gradient-to-r from-black/40 to-black/20 rounded-2xl p-4 md:p-6 border border-white/10 space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
                                <Award size={26} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider">
                                        {classMetrics.levelBadge}
                                    </span>
                                    <span className="text-white font-extrabold text-sm md:text-base">
                                        {classMetrics.levelTitle}
                                    </span>
                                </div>
                                <p className="text-white/60 text-xs mt-0.5">
                                    {selectedClassFilter === 'ALL' ? 'Overall performance across all classes' : `Academic standing in ${paperData?.classes?.find(c => String(c.id) === String(selectedClassFilter))?.name || 'Selected Class'}`}
                                </p>
                            </div>
                        </div>

                        {/* 4 Stat Badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto">
                            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 text-center min-w-[90px]">
                                <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider block">Completed</span>
                                <span className="text-white font-black text-base md:text-lg">{classMetrics.totalTaken} Tests</span>
                            </div>
                            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 text-center min-w-[90px]">
                                <span className="text-sky-300/80 text-[11px] font-bold uppercase tracking-wider block">Average</span>
                                <span className="text-sky-400 font-black text-base md:text-lg">{classMetrics.averagePercentage}%</span>
                            </div>
                            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 text-center min-w-[90px]">
                                <span className="text-amber-300/80 text-[11px] font-bold uppercase tracking-wider block">Best Mark</span>
                                <span className="text-amber-400 font-black text-base md:text-lg">{classMetrics.highestScore}</span>
                            </div>
                            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 text-center min-w-[90px]">
                                <span className="text-emerald-300/80 text-[11px] font-bold uppercase tracking-wider block">Pass Rate</span>
                                <span className="text-emerald-400 font-black text-base md:text-lg">{classMetrics.passRate}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Glowing Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-white/80 flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-emerald-400" />
                                <span>Cumulative Performance Index</span>
                            </span>
                            <span className="text-emerald-400 font-extrabold text-sm">{classMetrics.averagePercentage}%</span>
                        </div>
                        <div className="w-full h-3.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/15 relative">
                            <div 
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-1000 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                                style={{ width: `${Math.min(100, Math.max(5, classMetrics.averagePercentage))}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-white/50 font-semibold px-1">
                            <span>Pass (40%)</span>
                            <span>Credit (65%)</span>
                            <span>Distinction (75%)</span>
                            <span>Master (85%+)</span>
                        </div>
                    </div>
                </div>

                {/* 3. DUAL PANEL: LEADERBOARD + EXAM HISTORY */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ════ LEFT COLUMN: CLASS LEADERBOARD (5 cols) ════ */}
                    <div className="lg:col-span-5 flex flex-col gap-4 bg-black/25 rounded-2xl p-4 md:p-5 border border-white/10">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <Trophy size={18} className="text-amber-400" />
                                    <span>Class Leaderboard</span>
                                </h3>
                                <p className="text-white/60 text-xs">
                                    {activeLeaderboard?.title || 'Ranking Standings'}
                                </p>
                            </div>
                            {loadingLeaderboard && (
                                <Loader2 size={16} className="text-amber-400 animate-spin" />
                            )}
                        </div>

                        {/* Top 3 Podium Showcase */}
                        {activeLeaderboard?.podium && (
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-2 items-end">
                                {/* 2nd Place */}
                                <div className="flex flex-col items-center bg-gradient-to-t from-slate-900/90 to-slate-800/60 rounded-xl p-2 sm:p-2.5 border border-slate-400/30 text-center relative shadow-md">
                                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-300 text-slate-900 font-black text-[10px] sm:text-xs flex items-center justify-center mb-1 shadow">2</span>
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 border-2 border-slate-300 overflow-hidden mb-1 flex items-center justify-center text-white text-xs font-bold">
                                        {activeLeaderboard.podium.second?.image ? (
                                            <img src={`${backendBaseUrl}/storage/images/${activeLeaderboard.podium.second.image}`} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (activeLeaderboard.podium.second?.name || '2nd').charAt(0)
                                        )}
                                    </div>
                                    <p className="text-white font-bold text-[11px] sm:text-xs truncate w-full">{activeLeaderboard.podium.second?.name || 'Contender'}</p>
                                    <span className="text-slate-300 font-black text-[11px] sm:text-xs">{activeLeaderboard.podium.second?.score || 0} pts</span>
                                </div>

                                {/* 1st Place (Elevated) */}
                                <div className="flex flex-col items-center bg-gradient-to-t from-amber-950/90 via-amber-900/50 to-amber-800/40 rounded-xl p-2.5 sm:p-3 border border-amber-400/60 text-center relative shadow-lg -translate-y-2">
                                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-amber-950 font-black text-[11px] sm:text-xs flex items-center justify-center mb-1 shadow-md shadow-amber-500/50">👑 1</span>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-700 border-2 border-amber-400 overflow-hidden mb-1 flex items-center justify-center text-white text-xs sm:text-sm font-black shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                                        {activeLeaderboard.podium.first?.image ? (
                                            <img src={`${backendBaseUrl}/storage/images/${activeLeaderboard.podium.first.image}`} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (activeLeaderboard.podium.first?.name || '1st').charAt(0)
                                        )}
                                    </div>
                                    <p className="text-white font-black text-[11px] sm:text-xs truncate w-full">{activeLeaderboard.podium.first?.name || 'Champion'}</p>
                                    <span className="text-amber-300 font-black text-xs sm:text-sm">{activeLeaderboard.podium.first?.score || 0} pts</span>
                                </div>

                                {/* 3rd Place */}
                                <div className="flex flex-col items-center bg-gradient-to-t from-amber-950/60 to-orange-950/40 rounded-xl p-2 sm:p-2.5 border border-amber-600/30 text-center relative shadow-md">
                                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center mb-1 shadow">3</span>
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-800 border-2 border-amber-600 overflow-hidden mb-1 flex items-center justify-center text-white text-xs font-bold">
                                        {activeLeaderboard.podium.third?.image ? (
                                            <img src={`${backendBaseUrl}/storage/images/${activeLeaderboard.podium.third.image}`} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (activeLeaderboard.podium.third?.name || '3rd').charAt(0)
                                        )}
                                    </div>
                                    <p className="text-white font-bold text-[11px] sm:text-xs truncate w-full">{activeLeaderboard.podium.third?.name || 'Contender'}</p>
                                    <span className="text-amber-400 font-black text-[11px] sm:text-xs">{activeLeaderboard.podium.third?.score || 0} pts</span>
                                </div>
                            </div>
                        )}

                        {/* My Standing Banner */}
                        {activeLeaderboard?.myStanding ? (
                            <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-400/40 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-400 text-amber-950 font-black text-sm flex items-center justify-center shadow">
                                        #{activeLeaderboard.myStanding.rank}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-xs leading-tight">Your Current Rank</p>
                                        <p className="text-amber-300 text-[11px] font-medium">
                                            Score: {activeLeaderboard.myStanding.score} / {activeLeaderboard.totalMarks} ({activeLeaderboard.myStanding.grade || 'A'})
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-white/90 bg-white/10 px-2.5 py-1 rounded-lg">
                                    Standing
                                </span>
                            </div>
                        ) : null}

                        {/* Full Rankings List */}
                        <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                            {(showAllRankings ? activeLeaderboard?.ranks : activeLeaderboard?.ranks?.slice(0, 5))?.map((r, idx) => (
                                <div 
                                    key={idx}
                                    className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                                        String(r.studentId) === String(currentUser?.id || currentUser?.userId)
                                            ? 'bg-amber-500/20 border-amber-400/50 shadow-sm'
                                            : 'bg-black/30 border-white/5 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                            r.rank === 1 ? 'bg-amber-400 text-amber-950' :
                                            r.rank === 2 ? 'bg-slate-300 text-slate-900' :
                                            r.rank === 3 ? 'bg-amber-600 text-white' :
                                            'bg-white/10 text-white/80'
                                        }`}>
                                            {r.rank}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-white font-bold text-xs truncate">{r.name}</p>
                                            <p className="text-white/50 text-[10px] truncate">{r.city || 'IMA Campus'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-white font-black text-xs block">{r.score} pts</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getGradeBadgeStyle(r.grade)}`}>
                                            {r.grade || 'Pass'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Toggle Show All */}
                        {(activeLeaderboard?.ranks?.length || 0) > 5 && (
                            <button
                                type="button"
                                onClick={() => setShowAllRankings(!showAllRankings)}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                                <span>{showAllRankings ? 'Show Top 5 Only' : `View All Rankings (${activeLeaderboard?.ranks?.length})`}</span>
                                {showAllRankings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                    </div>

                    {/* ════ RIGHT COLUMN: PAPER TEST HISTORY TABLE (7 cols) ════ */}
                    <div className="lg:col-span-7 flex flex-col gap-4 bg-black/25 rounded-2xl p-4 md:p-5 border border-white/10">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <FileText size={18} className="text-sky-400" />
                                    <span>Paper Examination History ({filteredTests.length})</span>
                                </h3>
                                <p className="text-white/60 text-xs">
                                    Review submitted papers, question-by-question marks & teacher remarks
                                </p>
                            </div>
                        </div>

                        {/* History Table / Cards */}
                        <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredTests.length === 0 ? (
                                <div className="text-center py-12 px-4 bg-black/20 rounded-2xl border border-white/10">
                                    <GraduationCap size={36} className="mx-auto text-white/30 mb-2" />
                                    <p className="text-white/80 font-bold text-sm">No exam papers recorded yet</p>
                                    <p className="text-white/50 text-xs mt-1 max-w-sm mx-auto">
                                        Once you submit your weekly or monthly exam papers, your complete marks breakdown and rank will appear right here.
                                    </p>
                                </div>
                            ) : (
                                filteredTests.map((t) => (
                                    <div 
                                        key={t.id}
                                        className="bg-black/35 hover:bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 space-y-3"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                        t.category === 'MONTHLY' 
                                                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                                                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                                    }`}>
                                                        {t.category || 'WEEKLY'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold">
                                                        {t.paperType || 'MCQ'}
                                                    </span>
                                                    <span className="text-white/50 text-[11px]">
                                                        {t.submittedAt ? new Date(t.submittedAt).toLocaleDateString() : 'Recent'}
                                                    </span>
                                                </div>
                                                <h4 className="text-white font-extrabold text-sm md:text-base leading-snug break-words">
                                                    {t.testTitle}
                                                </h4>
                                                <p className="text-white/60 text-xs mt-0.5 font-medium">
                                                    {t.classLabel || t.courseName || t.batchName || 'General Paper Class'}
                                                </p>
                                            </div>

                                            {/* Score & Grade Display */}
                                            <div className="flex items-center gap-3 shrink-0">
                                                {t.status === 'PENDING_EVALUATION' ? (
                                                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                        ⏳ Evaluation Pending
                                                    </span>
                                                ) : (
                                                    <>
                                                        <div className="text-right">
                                                            <div className="text-white font-black text-base md:text-lg">
                                                                {t.score} <span className="text-white/50 text-xs font-normal">/ {t.totalMarks}</span>
                                                            </div>
                                                            <div className="text-white/60 text-[11px] font-semibold">
                                                                {t.percentage}%
                                                            </div>
                                                        </div>
                                                        <span className={`px-3 py-1 rounded-xl text-sm font-black border ${getGradeBadgeStyle(t.grade)} shadow-sm`}>
                                                            {t.grade || 'Pass'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons for this paper */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {t.rank && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-amber-500/20">
                                                        <Trophy size={11} /> Rank #{t.rank} / {t.totalParticipants || '—'}
                                                    </span>
                                                )}
                                                {t.teacherFeedback && (
                                                    <span className="text-[10px] sm:text-[11px] text-emerald-300/90 font-medium italic truncate max-w-[140px] sm:max-w-[200px]" title={t.teacherFeedback}>
                                                        Feedback: "{t.teacherFeedback}"
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                                                {/* Leaderboard Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => loadPaperLeaderboard(t.paperId)}
                                                    className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-black/40 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="View this paper's leaderboard"
                                                >
                                                    <Trophy size={12} className="text-amber-400" />
                                                    <span className="hidden sm:inline">Leaderboard</span>
                                                </button>

                                                {/* Marks Breakdown Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTestForBreakdown(t)}
                                                    className="px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Eye size={12} />
                                                    <span>Breakdown</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════════════ */}
            {/* 🔍 QUESTION-BY-QUESTION MARKS BREAKDOWN & GUIDER CHAT MODAL 🔍 */}
            {/* ═══════════════════════════════════════════════════════════════════════════════ */}
            {selectedTestForBreakdown && (
                <div 
                    className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setSelectedTestForBreakdown(null)}
                >
                    <div 
                        className="bg-[#0b1322] border border-white/20 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 to-[#0e172a] border-b border-white/10 flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black uppercase">
                                        {selectedTestForBreakdown.category || 'WEEKLY'} TEST
                                    </span>
                                    <span className="text-white/60 text-xs">
                                        {selectedTestForBreakdown.submittedAt ? new Date(selectedTestForBreakdown.submittedAt).toLocaleDateString() : ''}
                                    </span>
                                </div>
                                <h3 className="text-lg md:text-xl font-black text-white leading-snug">
                                    {selectedTestForBreakdown.testTitle}
                                </h3>
                                <p className="text-white/60 text-xs mt-0.5">
                                    {selectedTestForBreakdown.classLabel || selectedTestForBreakdown.courseName || 'General Paper Class'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedTestForBreakdown(null)}
                                className="text-white/60 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors shrink-0"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-3 gap-3 bg-black/30 p-4 rounded-2xl border border-white/10 text-center">
                                <div>
                                    <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider block">Total Score</span>
                                    <span className="text-white font-black text-lg md:text-xl">{selectedTestForBreakdown.score} / {selectedTestForBreakdown.totalMarks}</span>
                                </div>
                                <div>
                                    <span className="text-sky-400 text-[11px] font-bold uppercase tracking-wider block">Percentage</span>
                                    <span className="text-sky-300 font-black text-lg md:text-xl">{selectedTestForBreakdown.percentage}%</span>
                                </div>
                                <div>
                                    <span className="text-amber-400 text-[11px] font-bold uppercase tracking-wider block">Grade & Rank</span>
                                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${getGradeBadgeStyle(selectedTestForBreakdown.grade)}`}>
                                            {selectedTestForBreakdown.grade}
                                        </span>
                                        <span className="text-white/80 font-bold text-xs">#{selectedTestForBreakdown.rank}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Question-by-Question Marks Breakdown */}
                            <div>
                                <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                    <FileText size={16} className="text-sky-400" />
                                    <span>Question-by-Question Marks Breakdown</span>
                                </h4>

                                {Array.isArray(selectedTestForBreakdown.questionMarks) && selectedTestForBreakdown.questionMarks.length > 0 ? (
                                    <div className="space-y-2.5">
                                        {selectedTestForBreakdown.questionMarks.map((qm, qIdx) => {
                                            const earned = parseFloat(qm.marks || 0);
                                            const max = parseFloat(qm.maxMarks || 25);
                                            const perc = max > 0 ? Math.round((earned / max) * 100) : 0;

                                            return (
                                                <div 
                                                    key={qIdx}
                                                    className="bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-extrabold text-xs">
                                                                Question {qm.questionNo || qIdx + 1}
                                                            </span>
                                                            {perc >= 75 ? (
                                                                <span className="text-emerald-400 text-[11px] font-bold">Excellent</span>
                                                            ) : perc >= 50 ? (
                                                                <span className="text-sky-400 text-[11px] font-bold">Satisfactory</span>
                                                            ) : (
                                                                <span className="text-amber-400 text-[11px] font-bold">Needs Attention</span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-white font-black text-sm">{earned}</span>
                                                            <span className="text-white/50 text-xs"> / {max} ({perc}%)</span>
                                                        </div>
                                                    </div>

                                                    {/* Mini progress bar */}
                                                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                perc >= 75 ? 'bg-emerald-400' : perc >= 50 ? 'bg-sky-400' : 'bg-amber-400'
                                                            }`}
                                                            style={{ width: `${Math.min(100, Math.max(3, perc))}%` }}
                                                        ></div>
                                                    </div>

                                                    {/* Specific Question Comment */}
                                                    {qm.comment && (
                                                        <p className="text-white/80 text-xs bg-white/5 p-2 rounded-xl italic">
                                                            💬 Remark: {qm.comment}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/10 text-center">
                                        <p className="text-white/70 text-xs">
                                            {selectedTestForBreakdown.paperType === 'MCQ'
                                                ? 'MCQ Section evaluated automatically. Total Earned Marks: ' + selectedTestForBreakdown.score
                                                : 'Cumulative score recorded: ' + selectedTestForBreakdown.score + ' marks.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Overall Teacher's Feedback */}
                            {selectedTestForBreakdown.teacherFeedback && (
                                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
                                    <h5 className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare size={14} /> Teacher's Comprehensive Feedback
                                    </h5>
                                    <p className="text-white/90 text-sm leading-relaxed">
                                        "{selectedTestForBreakdown.teacherFeedback}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Action Footer */}
                        <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 to-[#0e172a] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => loadPaperLeaderboard(selectedTestForBreakdown.paperId)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Trophy size={14} className="text-amber-400" />
                                <span>View Test Leaderboard</span>
                            </button>

                            {/* DIRECT CHAT WITH PAPER GUIDER BUTTON */}
                            <button
                                type="button"
                                onClick={() => handleChatWithGuider(selectedTestForBreakdown)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 hover:from-sky-500 hover:to-indigo-600 text-white text-xs font-black shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <MessageSquare size={15} />
                                <span>Chat with Paper Guider About This Paper</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


                {/* LEFT COLUMN: Updates + Live Classes */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                    {/* 🔥 LATEST UPDATES (MOVED TO TOP) 🔥 */}
                    <div className="glass-card rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 bg-gradient-to-br from-[#0f172a]/90 to-[#1e293b]/90 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                        <h3 className="text-lg md:text-xl font-black text-white mb-6 flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                                <Bell className="w-5 h-5" />
                            </div> 
                            Latest Announcements
                        </h3>
                        <div className="space-y-4 md:space-y-5">
                            {data?.posts?.length === 0 ? (
                                <div className="text-center text-white/70 font-medium py-8 text-xs md:text-sm font-medium bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20">No updates yet.</div>
                            ) : data?.posts?.map((post) => {
                                const postImage = post.image && post.image !== 'default.png' && post.image !== 'null' ? `${backendBaseUrl}/storage/posts/${post.image}` : null;
                                return (
                                    <div key={post.id} className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 hover:bg-white/10 hover:border-white/30 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-300 flex flex-col sm:flex-row gap-5">
                                        {postImage && (
                                            <img src={postImage} onClick={() => setSelectedImage(postImage)} alt="" className="w-full sm:w-48 md:w-56 h-48 sm:h-36 md:h-40 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity shrink-0 shadow-lg border border-white/10" />
                                        )}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h4 className="text-white font-bold text-base md:text-lg mb-2 break-words">{post.title}</h4>
                                            <p className="text-white/80 font-medium text-xs md:text-sm leading-relaxed mb-4 break-words">{post.caption || post.description}</p>
                                            <div className="flex items-center gap-3 text-[9px] md:text-[10px] text-white/70 font-medium font-bold uppercase tracking-widest mt-auto">
                                                <span className="flex items-center gap-1"><Calendar size={10} md:size={12} /> {new Date(post.created_at).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1"><Clock size={10} md:size={12} /> {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Due Payments */}
                <div className="flex flex-col gap-6">
                    <div className="glass-card rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-5 flex items-center gap-2.5">
                            <AlertTriangle className="text-red-500 w-5 h-5" /> Due Payments
                        </h3>
                        <div className="space-y-3">
                            {data?.duePayments?.length === 0 ? (
                                <div className="text-center py-8 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20">
                                    <CheckCircle className="text-green-500 mx-auto mb-2" size={28} />
                                    <p className="text-white/90 font-bold text-xs font-medium">All clear!</p>
                                </div>
                            ) : data?.duePayments?.map((p, idx) => (
                                <div key={idx} 
                                     onClick={() => {
                                         navigate('/student/dashboard-v2', { 
                                             state: { 
                                                 activeTab: 'courses', 
                                                 autoSelect: {
                                                     businessId: p.businessId,
                                                     batchId: p.batchId,
                                                     groupId: p.groupId
                                                 }
                                             } 
                                         });
                                     }}
                                     className={`p-4 rounded-xl bg-black/20 backdrop-blur-xl border cursor-pointer hover:bg-black/30 transition-all ${p.diffDays < 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/20 hover:border-white/40'}`}
                                >
                                    <h4 className="text-white font-bold text-xs md:text-sm mb-2 break-words line-clamp-2">{p.courseName}</h4>
                                    <div className="flex justify-between items-end mt-2">
                                        <div>
                                            <p className="text-[9px] text-white/70 font-medium uppercase font-bold tracking-widest mb-0.5">Amount</p>
                                            <p className="text-sm md:text-base font-black text-white">LKR {parseFloat(p.amount).toFixed(2)}</p>
                                        </div>
                                        <p className={`text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${p.diffDays < 0 ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20'}`}>
                                            {p.diffDays < 0 ? 'Overdue' : 'Upcoming'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <UpgradeOfferWidget compactMode={true} hideFloatingWidget={true} />
                </div>
            </div>

            {/* FULL SCREEN IMAGE VIEWER */}
            {selectedImage && (
                <div className="fixed inset-0 z-[400] bg-black/20 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                    <button className="absolute top-4 right-4 md:top-6 md:right-6 text-white/80 font-medium hover:text-white bg-black/20 backdrop-blur-xl hover:bg-black/20 backdrop-blur-xl rounded-full p-2 transition-all"><X size={24} /></button>
                    <img src={selectedImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300" />
                </div>
            )}
        </div>
    );
}
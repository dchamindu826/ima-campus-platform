import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    FileText, 
    Search, 
    User, 
    RotateCcw,
    Layers,
    Paperclip,
    ChevronRight,
    Send,
    RefreshCw,
    Video,
    Image as ImageIcon,
    Sparkles,
    Filter,
    X
} from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

import SocialMediaTaskTimelineModal from '../social_media/components/SocialMediaTaskTimelineModal';
import DelegateSocialMediaTaskModal from '../../components/common/DelegateSocialMediaTaskModal';

export default function SocialMediaDelegationHub({ loggedInUser }) {
    const [tasks, setTasks] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters & Tabs
    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'PENDING', 'ONGOING', 'COMPLETED', 'CANCELLED'
    const [selectedBusinessId, setSelectedBusinessId] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [taskTypeFilter, setTaskTypeFilter] = useState('ALL'); // 'ALL', 'POST', 'VIDEO'

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState(null);

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/businesses');
            const list = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);
            setBusinesses(list);
        } catch (err) {
            console.error("Error fetching businesses", err);
        }
    };

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.get('/social-media/tasks', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTasks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching delegated social media tasks", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBusinesses();
        fetchTasks();
    }, []);

    // Filter Tasks
    const filteredTasks = tasks.filter(task => {
        if (selectedBusinessId !== 'ALL' && task.businessId !== parseInt(selectedBusinessId)) {
            return false;
        }

        if (taskTypeFilter !== 'ALL' && task.taskType !== taskTypeFilter) {
            return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = task.title?.toLowerCase().includes(q);
            const matchDesc = task.description?.toLowerCase().includes(q);
            const matchBiz = task.businessName?.toLowerCase().includes(q);
            const matchReq = task.requestedByName?.toLowerCase().includes(q);
            const matchAssignee = task.assignedToName?.toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchBiz && !matchReq && !matchAssignee) return false;
        }

        if (activeTab === 'PENDING') {
            return task.status === 'PENDING_APPROVAL';
        } else if (activeTab === 'ONGOING') {
            return ['ASSIGNED', 'IN_PROGRESS', 'FINISHED_REVIEW', 'CORRECTION_REQUESTED'].includes(task.status);
        } else if (activeTab === 'COMPLETED') {
            return task.status === 'COMPLETED';
        } else if (activeTab === 'CANCELLED') {
            return ['REJECTED', 'CANCELLED'].includes(task.status);
        }

        return true;
    });

    const pendingCount = tasks.filter(t => t.status === 'PENDING_APPROVAL').length;
    const ongoingCount = tasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'FINISHED_REVIEW', 'CORRECTION_REQUESTED'].includes(t.status)).length;
    const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
    const cancelledCount = tasks.filter(t => ['REJECTED', 'CANCELLED'].includes(t.status)).length;
    const allCount = tasks.length;

    const getAttachmentsCount = (task) => {
        if (!task.attachmentUrl) return 0;
        try {
            if (task.attachmentUrl.startsWith('[')) {
                return JSON.parse(task.attachmentUrl).length;
            }
            return 1;
        } catch (e) {
            return 1;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <CheckCircle2 size={11} className="text-emerald-400" /> Completed
                    </span>
                );
            case 'CORRECTION_REQUESTED':
                return (
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <RotateCcw size={11} className="text-amber-400" /> Correction Needed
                    </span>
                );
            case 'FINISHED_REVIEW':
                return (
                    <span className="text-[11px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <Sparkles size={11} className="text-purple-400" /> Under Review
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="text-[11px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <Clock size={11} className="text-sky-400 animate-spin" /> In Progress
                    </span>
                );
            case 'ASSIGNED':
                return (
                    <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <User size={11} className="text-indigo-400" /> Assigned
                    </span>
                );
            case 'PENDING_APPROVAL':
                return (
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <AlertCircle size={11} className="text-amber-400" /> Pending Approval
                    </span>
                );
            case 'REJECTED':
            case 'CANCELLED':
                return (
                    <span className="text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                        Cancelled
                    </span>
                );
            default:
                return (
                    <span className="text-[11px] font-bold text-slate-300 bg-slate-800/80 border border-white/10 px-2.5 py-0.5 rounded-lg shadow-sm">
                        {status}
                    </span>
                );
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1700px] mx-auto space-y-6 text-left animate-fade-in">
            
            {/* Header with Signature Glassmorphism */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/30 text-indigo-400 shadow-inner">
                        <Send size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            Social Media Task Delegation
                        </h1>
                        <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                            Submit and track promotional flyers, video reels, and artwork assigned to the Social Media team.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end relative z-10">
                    <button 
                        onClick={fetchTasks}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 hover:border-white/20 text-slate-300 hover:text-white cursor-pointer"
                        title="Refresh Tasks"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin text-indigo-400" : ""} />
                    </button>

                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-5 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus size={18} /> New Delegation Task
                    </button>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                <div 
                    onClick={() => setActiveTab('ALL')}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                        activeTab === 'ALL'
                            ? 'bg-indigo-500/15 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                            : 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-white/20'
                    }`}
                >
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Tasks</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-white">{allCount}</span>
                        <span className="text-xs text-indigo-400 font-semibold">All</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveTab('PENDING')}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                        activeTab === 'PENDING'
                            ? 'bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10'
                            : 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-amber-500/20'
                    }`}
                >
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Pending Approval</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-amber-300">{pendingCount}</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                </div>

                <div 
                    onClick={() => setActiveTab('ONGOING')}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                        activeTab === 'ONGOING'
                            ? 'bg-sky-500/15 border-sky-500/40 shadow-lg shadow-sky-500/10'
                            : 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-sky-500/20'
                    }`}
                >
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block mb-1">In Progress</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-sky-300">{ongoingCount}</span>
                        <span className="text-xs text-sky-400 font-semibold">Active</span>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveTab('COMPLETED')}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                        activeTab === 'COMPLETED'
                            ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-emerald-500/20'
                    }`}
                >
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Completed</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-emerald-300">{completedCount}</span>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                </div>

                <div 
                    onClick={() => setActiveTab('CANCELLED')}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer ${
                        activeTab === 'CANCELLED'
                            ? 'bg-rose-500/15 border-rose-500/40 shadow-lg shadow-rose-500/10'
                            : 'bg-slate-900/40 border-white/10 hover:bg-slate-900/60 hover:border-rose-500/20'
                    }`}
                >
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">Cancelled</span>
                    <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-rose-300">{cancelledCount}</span>
                        <span className="text-xs text-rose-400 font-semibold">Closed</span>
                    </div>
                </div>
            </div>

            {/* Filter & Navigation Bar */}
            <div className="bg-slate-900/50 p-4 md:p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl space-y-4">
                
                {/* Segmented Status Tabs */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setActiveTab('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'ALL' 
                                ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-white border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        All Tasks <span className="bg-white/10 text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">{allCount}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('PENDING')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'PENDING' 
                                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                                : 'text-slate-400 hover:text-amber-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        Pending Approval <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">{pendingCount}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('ONGOING')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'ONGOING' 
                                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40 shadow-[0_0_15px_rgba(14,165,233,0.25)]' 
                                : 'text-slate-400 hover:text-sky-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        Ongoing <span className="bg-sky-500/20 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-500/30">{ongoingCount}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('COMPLETED')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'COMPLETED' 
                                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]' 
                                : 'text-slate-400 hover:text-emerald-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        Completed <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">{completedCount}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('CANCELLED')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'CANCELLED' 
                                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)]' 
                                : 'text-slate-400 hover:text-rose-300 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        Cancelled <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500/30">{cancelledCount}</span>
                    </button>
                </div>

                {/* Search & Select Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[260px] max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search tasks, descriptions, brand, staff..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-md transition-all"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Task Type Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-950/60 border border-white/10 rounded-2xl px-3 py-1.5">
                            <Filter size={13} className="text-slate-400" />
                            <select 
                                value={taskTypeFilter}
                                onChange={(e) => setTaskTypeFilter(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-2"
                            >
                                <option value="ALL" className="bg-slate-900 text-white">All Deliverables</option>
                                <option value="POST" className="bg-slate-900 text-white">Post / Flyer</option>
                                <option value="VIDEO" className="bg-slate-900 text-white">Video / Reel</option>
                            </select>
                        </div>

                        {/* Business Brand Filter */}
                        <div className="flex items-center gap-1.5 bg-slate-950/60 border border-white/10 rounded-2xl px-3 py-1.5">
                            <Layers size={13} className="text-slate-400" />
                            <select 
                                value={selectedBusinessId}
                                onChange={(e) => setSelectedBusinessId(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-2"
                            >
                                <option value="ALL" className="bg-slate-900 text-white">All Businesses</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                </div>

            </div>

            {/* Task Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-56 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-xl"></div>
                    ))}
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="bg-slate-900/50 rounded-3xl border border-white/10 p-12 text-center flex flex-col items-center justify-center min-h-[340px] backdrop-blur-xl shadow-xl">
                    <div className="p-4 bg-white/5 rounded-full border border-white/10 mb-4">
                        <CheckCircle2 size={36} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">No Delegation Tasks Found</h3>
                    <p className="text-slate-400 text-xs max-w-md mb-5 leading-relaxed">
                        No tasks found matching your filter criteria. You can create a new delegation task anytime.
                    </p>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                        <Plus size={16} /> Create Task
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredTasks.map(task => {
                        const attachmentsCount = getAttachmentsCount(task);
                        return (
                            <div 
                                key={task.id}
                                onClick={() => setSelectedTaskForTimeline(task)}
                                className="bg-slate-900/60 hover:bg-slate-800/80 p-5 md:p-6 rounded-3xl border border-white/10 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between group shadow-xl hover:shadow-[0_12px_32px_rgba(99,102,241,0.2)] hover:-translate-y-1 backdrop-blur-xl relative overflow-hidden"
                            >
                                {/* Top Glow Accent */}
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                <div>
                                    {/* Top Row: Type, Brand, ID */}
                                    <div className="flex items-center justify-between gap-2 mb-3.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {task.taskType === 'VIDEO' ? (
                                                <span className="text-[11px] font-bold text-pink-300 bg-pink-500/15 px-2.5 py-1 rounded-xl border border-pink-500/30 flex items-center gap-1.5 shadow-sm">
                                                    <Video size={12} /> Video Reel
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-xl border border-indigo-500/30 flex items-center gap-1.5 shadow-sm">
                                                    <ImageIcon size={12} /> Flyer / Post
                                                </span>
                                            )}

                                            <span className="text-[11px] font-semibold text-slate-300 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 truncate max-w-[140px]">
                                                {task.businessName || 'General'}
                                            </span>

                                            {attachmentsCount > 0 && (
                                                <span className="text-[11px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-xl flex items-center gap-1">
                                                    <Paperclip size={11} /> {attachmentsCount}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">#{task.id}</span>
                                    </div>

                                    {/* Task Title */}
                                    <h3 className="text-base font-bold text-white mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors leading-snug">
                                        {task.title}
                                    </h3>

                                    {/* Description Preview */}
                                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                                        {task.description || 'No specific description provided.'}
                                    </p>
                                </div>

                                {/* Bottom Metadata & Status */}
                                <div className="pt-4 border-t border-white/10 space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-300">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                                                {(task.assignedToName || 'U')[0].toUpperCase()}
                                            </div>
                                            <span className="truncate max-w-[130px] font-medium text-slate-300">
                                                {task.assignedToName || 'Unassigned'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                                            <Calendar size={13} className="text-slate-400" />
                                            <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Due'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        {getStatusBadge(task.status)}
                                        <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 transition-all group-hover:translate-x-0.5">
                                            Activity <ChevronRight size={14} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CREATE TASK MODAL */}
            {isCreateModalOpen && (
                <DelegateSocialMediaTaskModal 
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    loggedInUser={loggedInUser}
                    onSuccess={() => fetchTasks()}
                />
            )}

            {/* TIMELINE MODAL */}
            {selectedTaskForTimeline && (
                <SocialMediaTaskTimelineModal 
                    task={selectedTaskForTimeline}
                    isOpen={!!selectedTaskForTimeline}
                    onClose={() => setSelectedTaskForTimeline(null)}
                    loggedInUser={loggedInUser}
                    onTaskUpdated={() => fetchTasks()}
                />
            )}

        </div>
    );
}

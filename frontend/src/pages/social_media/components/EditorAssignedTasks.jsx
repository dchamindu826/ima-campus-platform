import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    ChevronRight, 
    Play, 
    Send, 
    RotateCcw, 
    FileText, 
    Paperclip, 
    ExternalLink, 
    Sparkles, 
    Video, 
    Image as ImageIcon,
    RefreshCw,
    Timer
} from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import SocialMediaTaskTimelineModal from './SocialMediaTaskTimelineModal';

export default function EditorAssignedTasks({ loggedInUser }) {
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState(null);

    const fetchMyTasks = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.get('/social-media/tasks', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allTasks = Array.isArray(res.data) ? res.data : [];
            // Filter tasks assigned to this editor, or all ongoing if admin/manager
            const myTasks = allTasks.filter(t => 
                t.assignedToId === loggedInUser?.id || 
                loggedInUser?.role?.includes('ADMIN') || 
                loggedInUser?.role?.includes('MANAGER')
            );
            setTasks(myTasks);
        } catch (err) {
            console.error("Error fetching editor tasks", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMyTasks();
    }, []);

    const assignedList = tasks.filter(t => t.status === 'ASSIGNED');
    const inProgressList = tasks.filter(t => t.status === 'IN_PROGRESS');
    const correctionList = tasks.filter(t => t.status === 'CORRECTION_REQUESTED');
    const submittedList = tasks.filter(t => t.status === 'FINISHED_REVIEW');
    const completedList = tasks.filter(t => t.status === 'COMPLETED');

    return (
        <div className="space-y-6 text-left animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-indigo-400" size={20} /> My Assigned Job Cards
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Tasks allocated to you by the Social Media Manager. Work on designs and submit drafts for Business approval.
                    </p>
                </div>
                <button 
                    onClick={fetchMyTasks}
                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-300 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-400" : ""} />
                </button>
            </div>

            {/* Quick Status KPI Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-blue-500/20 backdrop-blur-xl">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">New Assigned</span>
                    <span className="text-2xl font-black text-blue-300">{assignedList.length}</span>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-sky-500/20 backdrop-blur-xl">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">In Production</span>
                    <span className="text-2xl font-black text-sky-300">{inProgressList.length}</span>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-orange-500/20 backdrop-blur-xl">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-1">Revisions Needed</span>
                    <span className="text-2xl font-black text-orange-300">{correctionList.length}</span>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-emerald-500/20 backdrop-blur-xl">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Delivered & Approved</span>
                    <span className="text-2xl font-black text-emerald-300">{completedList.length}</span>
                </div>
            </div>

            {/* Task Cards Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-xl"></div>
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-slate-900/40 rounded-3xl border border-white/10 p-12 text-center flex flex-col items-center justify-center min-h-[300px] backdrop-blur-xl">
                    <CheckCircle2 size={36} className="text-slate-500 mb-3" />
                    <h3 className="text-base font-bold text-white mb-1">No Active Job Cards Assigned</h3>
                    <p className="text-slate-400 text-xs max-w-sm">
                        You currently have no promotional tasks assigned by your manager. New delegations will appear here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map(task => (
                        <div 
                            key={task.id}
                            onClick={() => setSelectedTaskForTimeline(task)}
                            className="bg-slate-900/60 hover:bg-slate-850 p-5 rounded-3xl border border-white/10 hover:border-indigo-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-xl hover:-translate-y-1"
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-lg border border-indigo-500/30 flex items-center gap-1">
                                        {task.taskType === 'VIDEO' ? <Video size={11} /> : <ImageIcon size={11} />}
                                        {task.taskType === 'VIDEO' ? 'Video Reel' : 'Flyer / Post'}
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">#{task.id}</span>
                                </div>

                                <h3 className="text-sm font-bold text-white mb-1.5 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                                    {task.title}
                                </h3>

                                <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                                    {task.description || 'No detailed instructions.'}
                                </p>
                            </div>

                            <div className="pt-3 border-t border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span>From: <strong className="text-slate-300">{task.requestedByName}</strong></span>
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <Calendar size={12} />
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Due'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-white/5 border-white/10 text-slate-300">
                                        {task.status?.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                                        Open Workbench <ChevronRight size={14} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedTaskForTimeline && (
                <SocialMediaTaskTimelineModal 
                    task={selectedTaskForTimeline}
                    isOpen={!!selectedTaskForTimeline}
                    onClose={() => setSelectedTaskForTimeline(null)}
                    loggedInUser={loggedInUser}
                    onTaskUpdated={() => fetchMyTasks()}
                />
            )}
        </div>
    );
}

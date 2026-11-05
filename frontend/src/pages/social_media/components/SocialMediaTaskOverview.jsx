import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    ChevronRight, 
    UserCircle, 
    LayoutList, 
    Send, 
    Tag, 
    X, 
    Activity, 
    RotateCcw, 
    UserCheck, 
    Loader2,
    Video,
    Image as ImageIcon
} from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import SocialMediaTaskTimelineModal from './SocialMediaTaskTimelineModal';

export default function SocialMediaTaskOverview({ loggedInUser }) {
    const [tasks, setTasks] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [selectedTaskForTimeline, setSelectedTaskForTimeline] = useState(null);
    const [assigneeId, setAssigneeId] = useState('');
    const [deadline, setDeadline] = useState('');
    const [assignNote, setAssignNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.get('/social-media/tasks', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTasks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching social media tasks", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.get('/social-media/staff', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const list = Array.isArray(res.data) ? res.data : [];
            setStaffList(list);
            if (list.length > 0 && !assigneeId) {
                setAssigneeId(list[0].id);
            }
        } catch (err) {
            console.error("Error fetching social media staff", err);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchStaff();
    }, []);

    const inboxTasks = tasks.filter(t => t.status === 'PENDING_APPROVAL');
    const assignedTasks = tasks.filter(t => t.status === 'ASSIGNED');
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
    const reviewTasks = tasks.filter(t => t.status === 'FINISHED_REVIEW' || t.status === 'CORRECTION_REQUESTED');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

    const handleApprove = async () => {
        if (!selectedTask || !assigneeId) {
            toast.error('Please select an editor');
            return;
        }

        setIsSubmitting(true);
        const loadToast = toast.loading('Allocating task...');

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            await axios.put('/social-media/tasks/assign', {
                taskId: selectedTask.id,
                assignedToId: parseInt(assigneeId),
                dueDate: deadline || selectedTask.dueDate,
                note: assignNote
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Task allocated successfully.', { id: loadToast });
            setSelectedTask(null);
            setAssignNote('');
            fetchTasks();
        } catch (error) {
            console.error('Error assigning task:', error);
            toast.error(error.response?.data?.error || 'Failed to allocate task', { id: loadToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderKanbanColumn = (title, taskList, icon, badgeColor) => {
        return (
            <div className="bg-slate-900/50 rounded-3xl p-4 border border-white/10 flex flex-col gap-3 min-h-[460px] backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider mb-1 px-1 text-slate-300">
                    <div className="flex items-center gap-2">
                        {icon} {title}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeColor}`}>
                        {taskList.length}
                    </span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {taskList.map(task => (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTaskForTimeline(task)}
                            className="bg-slate-950/60 hover:bg-slate-850 p-4 rounded-2xl border border-white/10 hover:border-indigo-500/40 transition-all duration-200 cursor-pointer group shadow-md hover:-translate-y-0.5"
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-lg border border-indigo-500/30 flex items-center gap-1">
                                    {task.taskType === 'VIDEO' ? <Video size={10} /> : <ImageIcon size={10} />}
                                    {task.taskType === 'VIDEO' ? 'Video Reel' : 'Flyer'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">#{task.id}</span>
                            </div>

                            <h4 className="text-white font-bold text-xs mb-1 line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                                {task.title}
                            </h4>

                            <div className="text-[11px] text-slate-400 mb-3 line-clamp-1">
                                {task.businessName || 'All Brands'}
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-white/10 text-[11px] text-slate-400">
                                <div className="flex items-center gap-1.5 truncate">
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black text-[8px] flex items-center justify-center shrink-0">
                                        {(task.assignedToName || 'U')[0].toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[100px] text-slate-300">{task.assignedToName || 'Unassigned'}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-400 font-medium">
                                    <Calendar size={11} />
                                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No Due'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {taskList.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-semibold border border-dashed border-white/10 rounded-2xl bg-black/20">
                        No Tasks in Stage
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in h-full text-left">
            
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Incoming Requests</span>
                        <p className="text-3xl font-black text-white tracking-tight">{inboxTasks.length}</p>
                    </div>
                    <div className="bg-amber-500/15 text-amber-400 p-3 rounded-2xl border border-amber-500/30">
                        <Send size={18} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">In Production</span>
                        <p className="text-3xl font-black text-sky-300 tracking-tight">{assignedTasks.length + inProgressTasks.length}</p>
                    </div>
                    <div className="bg-sky-500/15 text-sky-400 p-3 rounded-2xl border border-sky-500/30">
                        <Activity size={18} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">In Review</span>
                        <p className="text-3xl font-black text-purple-300 tracking-tight">{reviewTasks.length}</p>
                    </div>
                    <div className="bg-purple-500/15 text-purple-400 p-3 rounded-2xl border border-purple-500/30">
                        <RotateCcw size={18} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Completed</span>
                        <p className="text-3xl font-black text-emerald-300 tracking-tight">{completedTasks.length}</p>
                    </div>
                    <div className="bg-emerald-500/15 text-emerald-400 p-3 rounded-2xl border border-emerald-500/30">
                        <CheckCircle2 size={18} />
                    </div>
                </div>
            </div>

            {/* Content View Split */}
            <div className="flex flex-col lg:flex-row gap-5 h-full min-h-0 pb-4">
                
                {/* Inbox Column */}
                <div className="lg:w-1/3 flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <LayoutList className="text-amber-400" size={16}/> Incoming Requests
                        </h2>
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            {inboxTasks.length} New
                        </span>
                    </div>

                    <div className="flex-1 bg-slate-900/50 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl overflow-y-auto custom-scrollbar p-3.5 space-y-3 min-h-[460px]">
                        {inboxTasks.map(task => (
                            <div 
                                key={task.id} 
                                className="bg-slate-950/70 hover:bg-slate-850 p-4 rounded-2xl border border-white/10 hover:border-amber-500/40 transition-all duration-200 cursor-pointer group shadow-md"
                                onClick={() => setSelectedTask(task)}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <h4 className="text-white font-bold text-xs group-hover:text-amber-300 transition-colors leading-snug">{task.title}</h4>
                                    <span className="text-[10px] font-mono text-slate-400">#{task.id}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                                    <div className="flex items-center gap-1"><UserCircle size={13}/> {task.requestedByName}</div>
                                    <div className="truncate text-[11px] text-slate-300 bg-white/5 px-2 py-0.5 rounded">{task.businessName || 'General'}</div>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
                                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                                        {task.taskType === 'VIDEO' ? 'Video Reel' : 'Flyer / Post'}
                                    </span>
                                    <button className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                                        Allocate <ChevronRight size={14}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {inboxTasks.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 bg-black/20 border border-dashed border-white/10 rounded-2xl min-h-[200px]">
                                <CheckCircle2 size={32} className="mb-2 opacity-40 text-emerald-400"/>
                                <p className="text-xs font-bold text-slate-300">No Pending Delegations</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Kanban Stages */}
                <div className="lg:w-2/3 flex flex-col gap-3">
                     <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                            <Activity className="text-indigo-400" size={16}/> Production Stages
                        </h2>
                    </div>

                    <div className="flex-1 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl overflow-x-auto custom-scrollbar p-3.5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-[650px]">
                            {renderKanbanColumn('Assigned', assignedTasks, <Clock size={14} className="text-blue-400"/>, 'bg-blue-500/20 text-blue-300 border-blue-500/30')}
                            {renderKanbanColumn('In Progress', inProgressTasks, <Activity size={14} className="text-sky-400"/>, 'bg-sky-500/20 text-sky-300 border-sky-500/30')}
                            {renderKanbanColumn('Review & Changes', reviewTasks, <RotateCcw size={14} className="text-purple-400"/>, 'bg-purple-500/20 text-purple-300 border-purple-500/30')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Allocate Modal */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 text-left animate-fade-in">
                    <div className="bg-slate-900/95 border border-white/15 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative backdrop-blur-2xl">
                        
                        <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Tag className="text-indigo-400" size={16}/> Allocate Task to Editor
                            </h3>
                            <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-slate-950/80 rounded-2xl border border-white/10">
                                <h4 className="text-white font-bold text-sm mb-1">{selectedTask.title}</h4>
                                <p className="text-xs text-slate-400 mb-2">Requested by {selectedTask.requestedByName} for {selectedTask.businessName || 'Business'}</p>
                                <span className="inline-block text-[10px] font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                                    {selectedTask.taskType === 'VIDEO' ? 'Video Reel' : 'Flyer / Post'}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Assign Editor *</label>
                                    <select 
                                        value={assigneeId}
                                        onChange={(e) => setAssigneeId(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Select Editor --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Target Deadline</label>
                                    <input 
                                        type="date" 
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Instructions for Editor</label>
                                    <input 
                                        type="text" 
                                        placeholder="Priority notes or instructions..."
                                        value={assignNote}
                                        onChange={(e) => setAssignNote(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedTask(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Confirm Allocation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Modal */}
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

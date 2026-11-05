import React, { useState, useEffect } from 'react';
import { 
    CheckSquare, Clock, Play, Lock, CheckCircle2, 
    FileText, Video, X, BookOpen, AlertTriangle, Plus, Check,Building2, ChevronRight, MonitorPlay,
    RefreshCcw, Settings, Users, Filter, LayoutDashboard, 
    Globe, ExternalLink, Eye, Trash2, Calendar, Edit 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

export default function ManagerTaskCenter({ loggedInUser }) {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [tasks, setTasks] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState('');
    const [dateFilter, setDateFilter] = useState('all'); 
    const [customDate, setCustomDate] = useState(''); 

    const [selectedTaskIds, setSelectedTaskIds] = useState([]); 

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [showOverviewModal, setShowOverviewModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    const getBaseUrl = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            let url = api.defaults.baseURL || 'http://localhost:5000/api';
            return url.replace('/api', '');
        }
        return 'https://imacampus.online';
    };

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { 
        if (selectedBiz) fetchTasks(); 
        setSelectedTaskIds([]); 
    }, [selectedBiz, activeTab, dateFilter, customDate]);

    const fetchInitialData = async () => {
        try {
            const bizRes = await api.get('/admin/businesses');
            const fetchedBiz = bizRes.data?.businesses || bizRes.data || [];
            setBusinesses(fetchedBiz);
            if (fetchedBiz.length === 1) {
                setSelectedBiz(fetchedBiz[0].id.toString());
            }
            const staffRes = await api.get('/admin/staff');
            setStaffList((staffRes.data || []).filter(s => s.role.toUpperCase() === 'STAFF' || s.role.toUpperCase() === 'COORDINATOR'));
        } catch (e) { toast.error("Failed to load initial data"); } finally { setLoading(false); }
    };

    const fetchTasks = async () => {
        if (!selectedBiz) return;
        setLoading(true);
        try {
            let url = `/admin/tasks?businessId=${selectedBiz}&`;
            if (activeTab === 'pending') url += `status=PENDING&`;
            else if (activeTab === 'in_progress') url += `status=IN_PROGRESS&`;
            else if (activeTab === 'requests') url += `status=REQ_UNLOCK&`;
            else if (activeTab === 'completed') url += `status=COMPLETED&`;
            
            if (activeTab !== 'settings') {
                const res = await api.get(url);
                setTasks(res.data || []);
            }
        } catch (e) { toast.error("Failed to load tasks"); } finally { setLoading(false); }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        const staffId = new FormData(e.target).get('staffId');
        try {
            if (selectedTaskIds.length > 0) {
                await Promise.all(selectedTaskIds.map(taskId => api.post('/admin/tasks/assign', { taskId, assignedTo: staffId })));
                toast.success(`${selectedTaskIds.length} Tasks assigned successfully!`);
            } else {
                await api.post('/admin/tasks/assign', { taskId: selectedTask.id, assignedTo: staffId });
                toast.success("Task assigned successfully!");
            }
            setShowAssignModal(false); 
            setSelectedTaskIds([]); 
            fetchTasks();
        } catch (e) { toast.error("Failed to assign task(s)"); }
    };

    const handleApproveUnlock = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target);
            const hours = formData.get('hours') || 12;
            await api.post('/admin/tasks/approve-unlock', { taskId: selectedTask.id, additionalHours: hours, managerId: loggedInUser.id });
            toast.success("Task unlocked!");
            setShowUnlockModal(false); fetchTasks();
        } catch (e) { toast.error("Failed to approve unlock"); }
    };

    const handleRejectTask = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/tasks/reject', { taskId: selectedTask.id, reason: new FormData(e.target).get('reason') });
            toast.success("Task Rejected & Negative KPI logged.");
            setShowOverviewModal(false); fetchTasks();
        } catch (e) { toast.error("Failed to reject task"); }
    };

    const toggleTaskSelection = (id) => {
        setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const filteredTasks = tasks.filter(task => {
        if (dateFilter === 'custom' && customDate) {
            const rawDate = task.timetable?.date || task.updatedAt || task.createdAt;
            if (!rawDate) return false;
            const taskDateStr = new Date(rawDate).toISOString().split('T')[0];
            return taskDateStr === customDate;
        }
        if (dateFilter === 'all' || task.taskType === 'CUSTOM' || !task.timetable?.date) return true;
        
        const taskDate = new Date(task.timetable.date).setHours(0,0,0,0);
        const today = new Date().setHours(0,0,0,0);
        const tomorrow = today + 86400000;
        const next2Days = today + (86400000 * 2);

        if (dateFilter === 'today') return taskDate === today;
        if (dateFilter === 'tomorrow') return taskDate === tomorrow;
        if (dateFilter === 'next2days') return taskDate === tomorrow || taskDate === next2Days;
        return true;
    });

    const selectAllTasks = () => {
        if (selectedTaskIds.length === filteredTasks.length) setSelectedTaskIds([]);
        else setSelectedTaskIds(filteredTasks.map(t => t.id));
    };

    const getTaskDetails = (task) => {
        if (task.taskType === 'CUSTOM') return { icon: CheckSquare, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200 dark:border-pink-500/20', label: task.customTitle || 'Custom Task' };
        switch(task.taskType) {
            case 'LIVE_LINK': return { icon: Play, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', label: 'Upload Live Link' };
            case 'TECH_DELIVERABLES': return { icon: MonitorPlay, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', label: 'Technical Deliverables' };
            case 'RECORDING': return { icon: Video, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20', label: 'Upload Recording' };
            case 'NOTES': return { icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'Upload PDF Notes' };
            case 'MCQ': return { icon: FileText, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', label: 'Upload MCQ Paper' };
            case 'STRUCTURED_PAPER': return { icon: FileText, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/20', label: 'Upload Structured Paper' };
            default: return { icon: CheckSquare, color: 'text-gray-600 dark:text-slate-400', bg: 'bg-gray-100 dark:bg-slate-800/50', border: 'border-gray-200 dark:border-slate-700/30', label: task.taskType.replace('_', ' ') };
        }
    };

    const formatDeadline = (dateString) => {
        if (!dateString) return 'No Deadline';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const navTabs = [
        { id: 'pending', label: 'Unassigned', icon: Clock, count: activeTab === 'pending' ? tasks.length : null },
        { id: 'in_progress', label: 'In Progress', icon: RefreshCcw },
        { id: 'requests', label: 'Unlock Requests', icon: AlertTriangle },
        { id: 'completed', label: 'Completed', icon: CheckCircle2 },
        { id: 'settings', label: 'Automation', icon: Settings, isRight: true }
    ];

    return (
        <div className="w-full min-h-screen text-gray-900 dark:text-slate-300 font-sans pb-24 bg-gray-50 dark:bg-transparent transition-colors">
            
            {/* FLOATING BULK ACTION BAR */}
            {selectedTaskIds.length > 0 && activeTab === 'pending' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-10 transition-colors">
                    <span className="text-gray-900 dark:text-white font-semibold text-sm">{selectedTaskIds.length} Tasks Selected</span>
                    <div className="w-px h-5 bg-gray-200 dark:bg-brand-darkBorder"></div>
                    <button onClick={() => { setSelectedTask(null); setShowAssignModal(true); }} className="bg-brand-accent hover:bg-brand-accentHover text-white px-5 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-2 shadow-[0_4px_15px_rgba(225,29,72,0.3)]">
                        <Users size={16}/> Bulk Assign
                    </button>
                    <button onClick={() => setSelectedTaskIds([])} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-brand-darkHover transition-colors"><X size={16}/></button>
                </div>
            )}

            {/* Header & Tabs */}
            <div className="mb-6 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 p-5 rounded-3xl shadow-sm transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                    {businesses.length > 1 && (
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-transparent px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700/30 w-full md:w-1/3 focus-within:border-brand-accent dark:focus-within:border-brand-accent transition-colors">
                            <Filter size={16} className="text-gray-400 dark:text-slate-400 shrink-0" />
                            <select value={selectedBiz} onChange={(e) => setSelectedBiz(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-200 font-medium outline-none text-sm cursor-pointer transition-colors">
                                <option value="" className="bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-200">-- Select Business --</option>
                                {businesses.map(b => <option key={b.id} value={b.id} className="bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-200">{b.name}</option>)}
                            </select>
                        </div>
                    )}

                    {activeTab !== 'settings' && selectedBiz && (
                        <div className="flex flex-wrap items-center bg-gray-50 dark:bg-transparent p-1 rounded-xl border border-gray-200 dark:border-slate-700/30 overflow-x-auto gap-1 transition-colors">
                            {['all', 'today', 'tomorrow', 'next2days'].map(filter => (
                                <button key={filter} onClick={() => { setDateFilter(filter); setCustomDate(''); }} 
                                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${dateFilter === filter ? 'bg-brand-accent text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-brand-darkHover'}`}>
                                    {filter === 'all' ? 'All Days' : filter === 'today' ? 'Today' : filter === 'tomorrow' ? 'Tomorrow' : 'Next 2 Days'}
                                </button>
                            ))}
                            
                            {/* Calendar Picker for Past History Dates */}
                            <div className="flex items-center gap-1.5 ml-1 border-l border-gray-200 dark:border-slate-700/40 pl-2">
                                <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 whitespace-nowrap">Filter Date:</span>
                                <input 
                                    type="date" 
                                    value={customDate} 
                                    onChange={(e) => {
                                        setCustomDate(e.target.value);
                                        if (e.target.value) setDateFilter('custom');
                                        else setDateFilter('all');
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white px-2.5 py-1 rounded-lg outline-none cursor-pointer focus:border-brand-accent transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto custom-scrollbar pt-1 border-t border-gray-100 dark:border-slate-700/30 transition-colors">
                    {navTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id)} 
                                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap outline-none ${tab.isRight ? 'ml-auto' : ''} ${isActive ? 'bg-brand-accent text-white shadow-[0_4px_15px_rgba(225,29,72,0.3)]' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-brand-darkHover hover:text-gray-900 dark:hover:text-slate-200'}`}
                            >
                                <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500'}/> 
                                {tab.label} 
                                {tab.count > 0 && <span className={`${isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-brand-darkBorder'} px-2 py-0.5 rounded-md text-[10px] font-bold ml-1 transition-colors`}>{tab.count}</span>}
                            </button>
                        )
                    })}
                </div>
            </div>

            {activeTab === 'settings' ? <ManagerTaskSettings businesses={businesses} staffList={staffList} /> : 
                selectedBiz && (
                    <div className="space-y-4">
                        {activeTab === 'pending' && filteredTasks.length > 0 && (
                            <div className="flex justify-end mb-4 px-2">
                                <label className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-brand-darkHover px-3 py-1.5 rounded-lg transition-colors">
                                    <input type="checkbox" checked={selectedTaskIds.length === filteredTasks.length} onChange={selectAllTasks} className="w-4 h-4 accent-brand-accent rounded cursor-pointer border-gray-300 dark:border-slate-600"/>
                                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors">Select All Tasks</span>
                                </label>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-400 transition-colors">
                                <RefreshCcw size={24} className="animate-spin mb-3 text-brand-accent"/>
                                <span className="font-medium text-sm">Fetching Tasks...</span>
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 py-20 px-6 rounded-3xl text-center flex flex-col items-center justify-center mt-4 shadow-sm transition-colors">
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-full mb-4 text-emerald-500 border border-emerald-100 dark:border-emerald-500/20 transition-colors"><CheckCircle2 size={40} /></div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 transition-colors">No tasks found</h3>
                                <p className="text-gray-500 dark:text-slate-400 text-sm transition-colors">You're all caught up for this view.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {filteredTasks.map(task => {
                                    const details = getTaskDetails(task);
                                    const TaskIcon = details.icon;
                                    const isMainTaskWithSubs = task.subTasks && task.subTasks.length > 0;
                                    const isSelected = selectedTaskIds.includes(task.id);

                                    return (
                                        <div key={task.id} onClick={() => { if(activeTab === 'pending') toggleTaskSelection(task.id) }} className={`relative bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border p-5 rounded-3xl flex flex-col transition-all shadow-sm ${isSelected ? 'border-brand-accent bg-brand-accentLight/50 dark:bg-brand-accent/10' : task.isOverdue && task.status !== 'COMPLETED' ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-slate-700/30 hover:border-gray-300 dark:hover:border-slate-700'} ${activeTab === 'pending' ? 'cursor-pointer hover:shadow-md' : ''}`}>
                                            
                                            {activeTab === 'pending' && (
                                                <div className="absolute top-5 right-5 z-10">
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleTaskSelection(task.id)} onClick={e=>e.stopPropagation()} className="w-5 h-5 accent-brand-accent rounded cursor-pointer border-gray-300 dark:border-slate-600"/>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 mb-4 pr-8">
                                                <div className={`p-2.5 rounded-xl ${details.bg} border ${details.border} flex items-center justify-center shrink-0 transition-colors`}>
                                                    <TaskIcon className={details.color} size={20} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate transition-colors">{details.label}</h4>
                                                    {task.isOverdue && task.status !== 'COMPLETED' && <span className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded font-bold mt-1 inline-block border border-red-200 dark:border-red-500/20 transition-colors">Overdue</span>}
                                                </div>
                                            </div>
                                            
                                            {task.taskType !== 'CUSTOM' ? (
                                                <p className="text-sm text-gray-700 dark:text-slate-300 mb-4 font-medium truncate transition-colors">{task.timetable?.subjectName} - {task.timetable?.title}</p>
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 line-clamp-2 transition-colors">{task.customDesc}</p>
                                            )}
                                            
                                            <div className="bg-gray-50 dark:bg-transparent p-3.5 rounded-xl border border-gray-200 dark:border-slate-700/30 text-xs text-gray-600 dark:text-slate-400 space-y-2 mb-5 flex-1 transition-colors">
                                                {task.taskType !== 'CUSTOM' && task.timetable ? (
                                                    <>
                                                        <div className="flex justify-between items-center"><span>Class Date</span> <span className="font-bold text-gray-800 dark:text-slate-300 transition-colors">{new Date(task.timetable.date).toLocaleDateString('en-CA')}</span></div>
                                                        <div className="flex justify-between items-center"><span>Time</span> <span className="font-bold text-gray-800 dark:text-slate-300 transition-colors">{task.timetable.startTime} - {task.timetable.endTime}</span></div>
                                                    </>
                                                ) : null}
                                                <div className="flex justify-between items-center"><span>Batch</span> <span className="truncate max-w-[140px] font-bold text-gray-800 dark:text-slate-300 transition-colors">{task.batch?.name || 'N/A'}</span></div>
                                                
                                                {task.assignedUser && (
                                                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700/30 mt-2 flex justify-between items-center transition-colors">
                                                        <span>Assigned To</span> 
                                                        <span className="text-gray-800 dark:text-slate-300 font-bold flex items-center gap-1.5 transition-colors">
                                                            <div className="w-5 h-5 rounded-full bg-brand-accentLight/50 dark:bg-brand-accent/20 border border-brand-accent/20 text-brand-accent flex items-center justify-center text-[10px] transition-colors">{task.assignedUser.firstName.charAt(0)}</div>
                                                            {task.assignedUser.firstName}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {isMainTaskWithSubs && (
                                                <div className="mb-5 border border-gray-200 dark:border-slate-700/30 rounded-xl p-3 bg-gray-50 dark:bg-transparent transition-colors">
                                                    <p className="text-[10px] text-gray-500 dark:text-slate-500 uppercase font-bold mb-2 transition-colors">Checklist Items</p>
                                                    <div className="space-y-1.5">
                                                        {task.subTasks.map(sub => (
                                                            <div key={sub.id} className="flex justify-between items-center p-2 rounded-lg text-xs bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 shadow-sm transition-colors">
                                                                <span className={sub.status === 'COMPLETED' ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-300 font-medium'}>{sub.customTitle}</span>
                                                                {sub.status === 'COMPLETED' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-slate-600"></div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="mt-auto flex items-center gap-3">
                                                {!isMainTaskWithSubs && task.deadline && (
                                                    <div className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${task.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : task.isOverdue ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' : 'bg-gray-100 dark:bg-slate-800/50 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700/30'}`}>
                                                        <Clock size={14}/>
                                                        {task.status === 'COMPLETED' ? 'Completed' : formatDeadline(task.deadline)}
                                                    </div>
                                                )}

                                                {(activeTab === 'pending' || activeTab === 'in_progress') && selectedTaskIds.length === 0 && (
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setShowAssignModal(true); }} className="flex-1 bg-brand-accent hover:bg-brand-accentHover text-white py-2 font-medium rounded-xl transition-colors text-sm shadow-[0_4px_15px_rgba(225,29,72,0.3)] outline-none">
                                                        {task.assignedUser ? 'Re-assign Staff' : 'Assign Staff'}
                                                    </button>
                                                )}

                                                {activeTab === 'requests' && <button onClick={() => { setSelectedTask(task); setShowUnlockModal(true); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 font-medium text-sm rounded-xl transition-colors shadow-[0_4px_15px_rgba(249,115,22,0.3)] outline-none">Review Request</button>}
                                                
                                                {activeTab === 'completed' && (
                                                    <button onClick={() => { setSelectedTask(task); setShowOverviewModal(true); }} className="flex-1 bg-gray-800 dark:bg-slate-700 hover:bg-gray-900 dark:hover:bg-slate-600 text-white py-2 font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm outline-none"><Eye size={16} /> Overview</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            }

            {/* ASSIGN MODAL */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 transition-colors">
                    <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-colors"><Users className="text-brand-accent" size={20}/> Assign Task</h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent p-2.5 rounded-xl border border-gray-200 dark:border-slate-700/30 transition-colors outline-none"><X size={18}/></button>
                        </div>
                        
                        {selectedTaskIds.length > 0 ? (
                            <p className="text-sm text-brand-accent bg-brand-accentLight/50 dark:bg-brand-accent/10 p-3 rounded-xl border border-brand-accent/20 text-center mb-6 font-bold transition-colors">Assigning {selectedTaskIds.length} tasks in bulk.</p>
                        ) : (
                            <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-transparent p-3 rounded-xl border border-gray-200 dark:border-slate-700/30 text-center mb-6 truncate font-medium transition-colors">{selectedTask?.timetable?.subjectName || selectedTask?.customTitle}</p>
                        )}

                        <form onSubmit={handleAssign}>
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 block transition-colors tracking-widest uppercase">Select Coordinator/Staff</label>
                            <select name="staffId" required className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-white text-sm font-medium outline-none focus:border-brand-accent dark:focus:border-brand-accent mb-6 cursor-pointer transition-colors shadow-sm appearance-none">
                                <option value="" className="bg-gray-100 dark:bg-slate-900 text-gray-400 dark:text-slate-500">Select a person...</option>
                                {staffList
                                    .filter(s => {
                                        if (!selectedBiz) return true;
                                        if (!s.businessType) return false;
                                        const selectedBizObj = businesses.find(b => b.id.toString() === selectedBiz.toString());
                                        const selectedBizName = selectedBizObj ? selectedBizObj.name : '';
                                        const bizArray = String(s.businessType).split(',').map(str => str.trim());
                                        return bizArray.includes(String(selectedBizName).trim());
                                    })
                                    .map(s => <option key={s.id} value={s.id} className="bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-200">{s.firstName} {s.lastName}</option>)}
                            </select>
                            <button type="submit" className="w-full bg-brand-accent hover:bg-brand-accentHover text-white font-black py-4 rounded-xl transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(225,29,72,0.3)] uppercase tracking-wide outline-none border border-transparent">
                                <Check size={18}/> Confirm Assignment
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* OVERVIEW MODAL */}
            {showOverviewModal && selectedTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 transition-colors">
                    <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-slate-700/30 pb-4 shrink-0 transition-colors">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 transition-colors"><LayoutDashboard className="text-brand-accent" size={20}/> Task Overview</h3>
                            <button onClick={() => setShowOverviewModal(false)} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent p-2.5 rounded-xl border border-gray-200 dark:border-slate-700/30 transition-colors outline-none"><X size={18}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 mb-6 pr-2">
                            <div className="bg-gray-50 dark:bg-transparent p-5 rounded-2xl border border-gray-200 dark:border-slate-700/30 text-sm text-gray-700 dark:text-slate-300 flex flex-col sm:flex-row justify-between gap-4 transition-colors shadow-sm">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">Executed By</p>
                                    <p className="font-bold text-gray-900 dark:text-white transition-colors">{selectedTask.assignedUser?.firstName} {selectedTask.assignedUser?.lastName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">Completed On</p>
                                    <p className="text-emerald-600 dark:text-emerald-400 font-bold transition-colors">{new Date(selectedTask.completedAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedTask.taskType !== 'CUSTOM' && selectedTask.content && (
                                <div className="bg-blue-50 dark:bg-blue-500/5 p-6 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4 text-sm transition-colors shadow-sm">
                                    <h4 className="text-blue-600 dark:text-blue-400 font-bold mb-2 flex items-center gap-2 transition-colors"><Globe size={16}/> Content Details</h4>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">Title</p>
                                        <p className="font-bold text-gray-900 dark:text-slate-200 transition-colors">{selectedTask.content.title}</p>
                                    </div>
                                    {selectedTask.content.link && (
                                        <div className="pt-2">
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">URL Link</p>
                                            <a href={selectedTask.content.link} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1.5 w-max font-medium transition-colors">
                                                {selectedTask.content.link} <ExternalLink size={14}/>
                                            </a>
                                        </div>
                                    )}
                                    {selectedTask.content.youtubeLink && (
                                        <div className="pt-2">
                                            <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-widest mb-1 transition-colors">YouTube Link</p>
                                            <a href={selectedTask.content.youtubeLink} target="_blank" rel="noreferrer" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline flex items-center gap-1.5 w-max font-medium transition-colors">
                                                {selectedTask.content.youtubeLink} <ExternalLink size={14}/>
                                            </a>
                                        </div>
                                    )}
                                    {selectedTask.content.fileName && (
                                        <div className="pt-2">
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1 transition-colors">Attached File</p>
                                            <a href={`${getBaseUrl()}/storage/documents/${selectedTask.content.fileName}`} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1.5 w-max font-medium transition-colors">
                                                View Document <ExternalLink size={14}/>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedTask.taskType === 'CUSTOM' && selectedTask.proofUrl && (
                                <div className="bg-gray-50 dark:bg-transparent rounded-2xl p-4 border border-gray-200 dark:border-slate-700/30 h-64 flex items-center justify-center transition-colors shadow-sm">
                                    {selectedTask.proofType === 'pdf' ? (
                                        <a href={`${getBaseUrl()}/storage/documents/${selectedTask.proofUrl}`} target="_blank" rel="noreferrer" className="bg-gray-800 dark:bg-slate-700 hover:bg-gray-900 dark:hover:bg-slate-600 text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center gap-2 shadow-md outline-none"><FileText size={18}/> Open PDF Proof</a>
                                    ) : (
                                        <img src={`${getBaseUrl()}/storage/documents/${selectedTask.proofUrl}`} alt="Proof" className="max-h-full max-w-full object-contain rounded-xl border border-gray-200 dark:border-slate-700/30 transition-colors shadow-sm" />
                                    )}
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleRejectTask} className="border-t border-gray-200 dark:border-slate-700/30 pt-5 shrink-0 transition-colors">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2 block flex items-center gap-1.5 transition-colors uppercase tracking-widest"><AlertTriangle size={14} className="text-red-500 dark:text-red-400"/> Reject & Re-assign</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input type="text" name="reason" required placeholder="Reason for rejection (Logs negative KPI)..." className="flex-1 bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 dark:focus:border-red-500 transition-colors shadow-sm placeholder-gray-400 dark:placeholder-slate-500" />
                                <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(220,38,38,0.3)] uppercase tracking-wide outline-none border border-transparent"><RefreshCcw size={16}/> Reject Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* UNLOCK MODAL */}
            {showUnlockModal && selectedTask && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 transition-colors">
                    <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-slate-700/30 pb-4 transition-colors">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 transition-colors"><AlertTriangle className="text-orange-500 dark:text-orange-400" size={20}/> Unlock Request</h3>
                            <button onClick={() => setShowUnlockModal(false)} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-slate-700/30 p-2.5 rounded-xl transition-colors outline-none"><X size={18}/></button>
                        </div>
                        
                        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-5 rounded-2xl mb-6 transition-colors shadow-sm">
                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400/70 uppercase tracking-widest mb-2 transition-colors">Staff Reason</p>
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 transition-colors leading-relaxed">{selectedTask.unlockReason}</p>
                        </div>

                        <form onSubmit={handleApproveUnlock}>
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">Grant Extra Hours</label>
                            <input type="number" name="hours" min="1" max="72" required defaultValue="12" className="w-full bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-white text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 mb-6 transition-colors shadow-sm" />
                            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-xl transition-transform hover:scale-[1.02] text-sm flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(249,115,22,0.3)] uppercase tracking-wide outline-none border border-transparent">
                                <Check size={18}/> Approve Unlock
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ------------------------------------------------------------------------------------
// MANAGER SETTINGS TAB (Automation Timers & Custom Tasks)
// ------------------------------------------------------------------------------------
const ManagerTaskSettings = ({ businesses, staffList }) => {
    const [biz, setBiz] = useState('');
    const [templates, setTemplates] = useState([
        { taskType: 'LIVE_LINK', isRequired: true, deadlineHours: 1 },
        { taskType: 'TECH_DELIVERABLES', isRequired: true, deadlineHours: 2 },
        { taskType: 'RECORDING', isRequired: true, deadlineHours: 24 },
        { taskType: 'NOTES', isRequired: true, deadlineHours: 24 },
        { taskType: 'MCQ', isRequired: true, deadlineHours: 48 },
        { taskType: 'STRUCTURED_PAPER', isRequired: true, deadlineHours: 48 }
    ]);
    const [customTemplates, setCustomTemplates] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [ctForm, setCtForm] = useState({
        title: '', description: '', dayOfMonth: '', allocationType: 'MANUAL', autoAssignTo: ''
    });
    const [hasSubTasks, setHasSubTasks] = useState(false);
    const [subTasks, setSubTasks] = useState([]);

    useEffect(() => {
        if(biz) {
            api.get(`/admin/tasks/templates/${biz}`).then(res => {
                if(res.data && res.data.length > 0) {
                    const merged = templates.map(t => res.data.find(dbT => dbT.taskType === t.taskType) || t);
                    setTemplates(merged);
                }
            });
            fetchCustomTemplates();
        }
    }, [biz]);

    const fetchCustomTemplates = () => {
        api.get(`/admin/tasks/custom-templates/${biz}`).then(res => {
            setCustomTemplates(res.data || []);
        }).catch(e => console.log("Failed to load templates"));
    };

    const saveSystemTimers = async () => {
        if(!biz) return toast.error("Select a business first");
        try {
            await api.post('/admin/tasks/templates', { businessId: biz, templates });
            toast.success("Timers Saved!");
        } catch(e) { toast.error("Failed to save"); }
    };

    const handleCtFormChange = (e) => setCtForm({ ...ctForm, [e.target.name]: e.target.value });

    const saveCustomTaskTemplate = async (e) => {
        e.preventDefault();
        if(!biz) return toast.error("Select a business first");

        if (hasSubTasks && subTasks.some(st => !st.startTime || !st.endTime)) {
            return toast.error("Please add Start & End time for all checklist items!");
        }

        try {
            const payload = { ...ctForm, businessId: biz, subTasks: hasSubTasks ? subTasks : [] };
            if (editingId) payload.id = editingId;
            await api.post('/admin/tasks/custom-templates', payload);
            toast.success(editingId ? "Template Updated!" : "Template Created!");
            fetchCustomTemplates();
            resetCustomForm();
        } catch(e) { toast.error("Failed to save custom template"); }
    };

    const editTemplate = (t) => {
        setEditingId(t.id);
        setCtForm({
            title: t.title, description: t.description || '',
            dayOfMonth: t.dayOfMonth || '', allocationType: t.allocationType || 'MANUAL', autoAssignTo: t.autoAssignTo || ''
        });
        const st = typeof t.subTasks === 'string' ? JSON.parse(t.subTasks) : (t.subTasks || []);
        if (st && st.length > 0) { setHasSubTasks(true); setSubTasks(st); } 
        else { setHasSubTasks(false); setSubTasks([]); }
    };

    const deleteTemplate = async (id) => {
        if(!window.confirm("Are you sure you want to delete this template?")) return;
        try {
            await api.delete(`/admin/tasks/custom-templates/${id}`);
            setCustomTemplates(customTemplates.filter(t => t.id !== id));
            toast.success("Template Deleted");
        } catch(e) { toast.error("Failed to delete template"); }
    };

    const resetCustomForm = () => {
        setEditingId(null);
        setCtForm({ title: '', description: '', dayOfMonth: '', allocationType: 'MANUAL', autoAssignTo: '' });
        setHasSubTasks(false); setSubTasks([]);
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in duration-300 transition-colors">
            {/* Left Col: Automation Timers */}
            <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-slate-700/30 shadow-sm h-fit transition-colors">
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2 transition-colors"><Clock className="text-brand-accent" size={20}/> System Automation Timers</h3>
                {businesses.length > 1 && (
                    <div className="w-full bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-slate-700/30 rounded-xl p-3 mb-6 focus-within:border-brand-accent dark:focus-within:border-brand-accent transition-colors shadow-sm">
                        <select value={selectedBizForSettings} onChange={(e) => { setSelectedBizForSettings(e.target.value); setBiz(e.target.value); }} className="w-full bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-200 font-medium outline-none text-sm cursor-pointer transition-colors appearance-none">
                            <option value="" className="bg-gray-100 dark:bg-slate-900 text-gray-400 dark:text-slate-500">Select Business to Configure...</option>
                            {businesses.map(b => <option key={b.id} value={b.id} className="bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-200">{b.name}</option>)}
                        </select>
                    </div>
                )}

                <div className="space-y-3">
                    {templates.map((t, idx) => (
                        <div key={t.taskType} className="flex items-center justify-between bg-gray-50 dark:bg-transparent p-4 rounded-xl border border-gray-200 dark:border-slate-700/30 transition-colors shadow-sm">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-slate-200 text-sm transition-colors">{t.taskType === 'NOTES' ? 'DOCUMENT' : t.taskType.replace('_', ' ')}</p>
                                <p className={`text-[10px] font-bold uppercase mt-1 transition-colors tracking-widest ${t.taskType === 'RECORDING' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-slate-400'}`}>
                                    {t.taskType === 'RECORDING' ? 'Hours AFTER class' : 'Hours BEFORE class'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 p-1.5 rounded-lg focus-within:border-brand-accent dark:focus-within:border-brand-accent transition-colors shadow-sm">
                                <input type="number" value={t.deadlineHours} onChange={e => {const newT = [...templates]; newT[idx].deadlineHours = e.target.value; setTemplates(newT);}} className="w-12 bg-transparent font-black text-gray-900 dark:text-white text-center text-sm outline-none transition-colors" />
                                <span className="text-xs font-bold text-gray-400 dark:text-slate-500 pr-2 transition-colors">Hrs</span>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={saveSystemTimers} className="w-full bg-brand-accent hover:bg-brand-accentHover text-white font-black py-4 rounded-xl mt-6 transition-transform hover:scale-[1.02] text-sm uppercase tracking-widest shadow-[0_4px_15px_rgba(225,29,72,0.3)] outline-none border border-transparent">Save Automation Timers</button>
            </div>

            {/* Right Col: Custom Tasks */}
            <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-slate-700/30 shadow-sm transition-colors">
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2 transition-colors"><Calendar className="text-emerald-500 dark:text-emerald-400" size={20}/> Custom Tasks Manager</h3>
                
                <form onSubmit={saveCustomTaskTemplate} className="space-y-4 bg-gray-50 dark:bg-transparent p-6 rounded-[2rem] border border-gray-200 dark:border-slate-700/30 mb-8 transition-colors shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-slate-700/30 pb-2 transition-colors">{editingId ? 'Edit Template' : 'Create New Template'}</h4>
                    
                    <input type="text" name="title" value={ctForm.title} onChange={handleCtFormChange} required placeholder="Task Title (e.g. Monthly Report)" className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-white font-medium text-sm outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm placeholder-gray-400 dark:placeholder-slate-500" />
                    <textarea name="description" value={ctForm.description} onChange={handleCtFormChange} rows="2" placeholder="Task Description & Guidelines..." className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-white font-medium text-sm outline-none focus:border-brand-accent dark:focus:border-brand-accent resize-none transition-colors shadow-sm placeholder-gray-400 dark:placeholder-slate-500"></textarea>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-slate-500 ml-1 mb-1.5 block transition-colors">Day of Month</label>
                            <input type="number" name="dayOfMonth" min="1" max="31" value={ctForm.dayOfMonth} onChange={handleCtFormChange} placeholder="e.g. 5" className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-slate-200 text-sm font-medium outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm placeholder-gray-400 dark:placeholder-slate-500" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-slate-500 ml-1 mb-1.5 block transition-colors">Auto Assign To</label>
                            <div className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 focus-within:border-brand-accent dark:focus-within:border-brand-accent transition-colors shadow-sm">
                                <select value={editConfig.defaultAssignee} onChange={(e) => { setEditConfig({...editConfig, defaultAssignee: e.target.value}); setCtForm({...ctForm, autoAssignTo: e.target.value}); }} className="w-full bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-200 font-medium outline-none text-sm cursor-pointer transition-colors appearance-none">
                                    <option value="" className="bg-gray-100 dark:bg-slate-900 text-gray-400 dark:text-slate-500">No Default Assignee</option>
                                    {staffList
                                        .filter(s => {
                                            if (!selectedBizForSettings) return true;
                                            if (!s.businessType) return false;
                                            const selectedBizObj = businesses.find(b => b.id.toString() === selectedBizForSettings.toString());
                                            const selectedBizName = selectedBizObj ? selectedBizObj.name : '';
                                            const bizArray = String(s.businessType).split(',').map(str => str.trim());
                                            return bizArray.includes(String(selectedBizName).trim());
                                        })
                                        .map(s => <option key={s.id} value={s.id} className="bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-slate-200">{s.firstName} {s.lastName}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-slate-500 ml-1 mb-1.5 block transition-colors">Allocation Rule</label>
                        <select name="allocationType" value={ctForm.allocationType} onChange={handleCtFormChange} className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-xl p-4 text-gray-900 dark:text-slate-200 text-sm font-medium outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm cursor-pointer appearance-none">
                            <option value="MANUAL">Manual / Specific Day Only</option>
                            <option value="DAILY">Daily (Everyday Auto-Allocate)</option>
                            <option value="CLASS_LINKED">Linked to Timetable Classes</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer pt-2 group">
                        <input type="checkbox" checked={hasSubTasks} onChange={e=>setHasSubTasks(e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border-gray-300 dark:border-slate-700" />
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Contains multiple Checklist Items?</span>
                    </label>

                    {hasSubTasks && (
                        <div className="bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl p-5 rounded-2xl border border-gray-200 dark:border-slate-700/30 space-y-3 mt-2 transition-colors shadow-sm">
                            {subTasks.map((st, i) => (
                                <div key={i} className="flex flex-col gap-2 bg-gray-50 dark:bg-transparent p-4 rounded-xl border border-gray-200 dark:border-slate-700/30 transition-colors shadow-sm">
                                    <input type="text" value={st.title} required onChange={e=>{const ns=[...subTasks]; ns[i].title=e.target.value; setSubTasks(ns)}} className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-lg p-3 text-xs text-gray-900 dark:text-white font-medium outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors placeholder-gray-400 dark:placeholder-slate-500 shadow-inner" placeholder="Sub-task title..."/>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <span className="text-[9px] text-gray-500 dark:text-slate-500 uppercase tracking-widest font-bold mb-1 block transition-colors">Start Time</span>
                                            <input type="time" required value={st.startTime || ''} onChange={e=>{const ns=[...subTasks]; ns[i].startTime=e.target.value; setSubTasks(ns)}} className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white font-bold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-inner" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] text-gray-500 dark:text-slate-500 uppercase tracking-widest font-bold mb-1 block transition-colors">End Time</span>
                                            <input type="time" required value={st.endTime || ''} onChange={e=>{const ns=[...subTasks]; ns[i].endTime=e.target.value; setSubTasks(ns)}} className="w-full bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-200 dark:border-slate-700/30 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white font-bold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-inner" />
                                        </div>
                                        <button type="button" onClick={() => setSubTasks(subTasks.filter((_,idx)=>idx!==i))} className="p-2 mt-4 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 bg-gray-100 dark:bg-slate-800/50 rounded-lg transition-colors border border-gray-200 dark:border-transparent outline-none"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={()=>setSubTasks([...subTasks, {title:'', startTime:'', endTime:''}])} className="text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300 mt-4 px-2 transition-colors outline-none"><Plus size={16}/> Add Task Item</button>
                        </div>
                    )}
                    
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700/30 mt-4">
                        {editingId && <button type="button" onClick={resetCustomForm} className="flex-1 bg-gray-100 dark:bg-slate-800/50 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-white font-bold py-4 rounded-xl transition-colors text-sm border border-gray-200 dark:border-transparent shadow-sm outline-none tracking-widest uppercase">Cancel</button>}
                        <button type="submit" className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-transform hover:scale-[1.02] text-sm uppercase tracking-widest shadow-[0_4px_15px_rgba(5,150,105,0.3)] outline-none border border-transparent">{editingId ? 'Update Template' : 'Create Template'}</button>
                    </div>
                </form>

                {/* Templates List */}
                {customTemplates.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest pl-1 mb-4 transition-colors">Saved Custom Templates</h4>
                        {customTemplates.map(t => {
                            const subs = t.subTasks ? (typeof t.subTasks === 'string' ? JSON.parse(t.subTasks) : t.subTasks) : [];
                            return (
                                <div key={t.id} className="bg-gray-50 dark:bg-transparent p-6 border border-gray-200 dark:border-slate-700/30 rounded-2xl flex flex-col hover:border-brand-accent/50 dark:hover:border-brand-accent/50 transition-colors group shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h5 className="font-bold text-gray-900 dark:text-slate-100 text-base mb-1.5 transition-colors">{t.title}</h5>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 dark:text-slate-400 text-[10px] px-2.5 py-1 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-md border border-gray-200 dark:border-slate-700/30 font-black tracking-widest uppercase transition-colors">{t.allocationType.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => editTemplate(t)} className="p-2.5 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-xl text-brand-accent hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent transition-colors border border-gray-200 dark:border-slate-700/30 shadow-sm outline-none"><Edit size={16}/></button>
                                            <button onClick={() => deleteTemplate(t.id)} className="p-2.5 bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl rounded-xl text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-colors border border-gray-200 dark:border-slate-700/30 shadow-sm outline-none"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    {subs.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700/30 space-y-2 transition-colors">
                                            {subs.map((s, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-600 dark:text-slate-400 font-bold transition-colors">{s.title}</span>
                                                    <span className="text-gray-500 dark:text-slate-500 font-mono font-bold bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-gray-100 dark:border-transparent px-2 py-1 rounded-md transition-colors shadow-sm dark:shadow-none">{s.startTime} - {s.endTime}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
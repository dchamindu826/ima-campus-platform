import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
    Calendar, MapPin, CheckCircle, Clock, Video, Plus, Trash2, LayoutDashboard, Edit2, X, FileText 
} from 'lucide-react';

const TechnicalDashboard = () => {
    const [schedule, setSchedule] = useState([]);
    const [halls, setHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Hall Management State
    const [newHallName, setNewHallName] = useState('');
    const [showHallManager, setShowHallManager] = useState(false);
    const [editingHallId, setEditingHallId] = useState(null);
    const [editHallName, setEditHallName] = useState('');

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [timetableRes, hallsRes] = await Promise.all([
                api.get(`/technical/timetable?date=${selectedDate}`),
                api.get(`/technical/halls`)
            ]);

            setSchedule(timetableRes.data);
            setHalls(hallsRes.data);
        } catch (error) {
            console.error("Error fetching technical data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddHall = async (e) => {
        e.preventDefault();
        if (!newHallName.trim()) return;
        try {
            await api.post(`/technical/halls`, { name: newHallName });
            setNewHallName('');
            fetchData();
        } catch (error) {
            console.error("Error adding hall:", error);
            alert("Failed to add hall");
        }
    };

    const handleUpdateHall = async (id) => {
        if (!editHallName.trim()) return;
        try {
            await api.put(`/technical/halls/${id}`, { name: editHallName, isAvailable: true });
            setEditingHallId(null);
            fetchData();
        } catch (error) {
            console.error("Error updating hall:", error);
            alert("Failed to update hall");
        }
    };

    const handleDeleteHall = async (id) => {
        if (!window.confirm("Are you sure you want to delete this hall?")) return;
        try {
            await api.delete(`/technical/halls/${id}`);
            fetchData();
        } catch (error) {
            console.error("Error deleting hall:", error);
            alert("Failed to delete hall");
        }
    };

    const handleAllocateHall = async (timetableId, hallId) => {
        try {
            await api.put(`/technical/timetable/${timetableId}/allocate-hall`, { hallId });
            fetchData(); // Refresh to show new assignment
        } catch (error) {
            console.error("Error allocating hall:", error);
            alert(error.response?.data?.error || "Failed to allocate hall");
            fetchData(); // Reset the select dropdown if it failed
        }
    };

    return (
        <div className="w-full min-h-screen text-slate-200 font-sans p-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                        <LayoutDashboard className="text-blue-400" />
                        Technical Operations
                    </h1>
                    <p className="text-slate-400 mt-1">Manage global timetables, halls, and class deliverables</p>
                </div>

                <div className="flex gap-4 items-center">
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <button 
                        onClick={() => setShowHallManager(!showHallManager)}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2.5 rounded-xl font-medium transition-all text-sm flex items-center gap-2"
                    >
                        <MapPin size={16} />
                        {showHallManager ? 'Hide Halls' : 'Manage Halls'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Main Timetable Area */}
                <div className={`transition-all duration-300 ${showHallManager ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
                    <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-6 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Calendar className="text-blue-400" size={20} />
                            Global Master Schedule
                        </h2>

                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-24 bg-slate-700/20 rounded-xl"></div>
                                ))}
                            </div>
                        ) : schedule.length === 0 ? (
                            <div className="text-center py-12 bg-slate-800/10 rounded-xl border border-slate-700/30 border-dashed">
                                <Calendar size={48} className="mx-auto text-slate-500 mb-3 opacity-50" />
                                <p className="text-slate-400">No classes scheduled for this date.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {schedule.map((cls) => (
                                    <div key={cls.id} className="group bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 transition-all relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500"></div>
                                        
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            
                                            {/* Class Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                                                        {cls.batch?.business?.name || 'Business'}
                                                    </span>
                                                    <span className="text-slate-400 text-sm flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {cls.startTime} - {cls.endTime}
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-white mb-1">{cls.title || cls.subjectName}</h3>
                                                <p className="text-sm text-slate-400">{cls.batch?.name} • {cls.lecturerName}</p>
                                            </div>

                                            {/* Deliverables Status */}
                                            <div className="flex-1 flex flex-col justify-center">
                                                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                                                    <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Class Deliverables</div>
                                                    {cls.deliveryStatus === 'DELIVERED' ? (
                                                        <div className="flex flex-col gap-2">
                                                            <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                                                <CheckCircle size={16} />
                                                                Materials Received
                                                            </span>
                                                            {cls.liveLink && (
                                                                <a href={cls.liveLink.startsWith('http') ? cls.liveLink : `https://${cls.liveLink}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-1 rounded w-max">
                                                                    <Video size={12} />
                                                                    View Live Link
                                                                </a>
                                                            )}
                                                            {cls.tasks?.[0]?.proofUrl && (
                                                                <a href={`/storage/documents/${cls.tasks[0].proofUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-1 rounded w-max">
                                                                    <FileText size={12} />
                                                                    View Attachment
                                                                </a>
                                                            )}
                                                            {cls.tasks?.[0]?.customDesc && (
                                                                <div className="text-xs text-slate-400 mt-1 bg-slate-800/50 p-2 rounded max-h-20 overflow-y-auto">
                                                                    <span className="block font-medium text-slate-300 mb-1">Notes:</span>
                                                                    {(() => {
                                                                        try {
                                                                            return JSON.parse(cls.tasks[0].customDesc).notes || 'No additional notes.';
                                                                        } catch (e) { return cls.tasks[0].customDesc; }
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-amber-400 text-sm font-medium bg-amber-500/10 px-2 py-1 rounded-md">
                                                            <Clock size={14} />
                                                            Pending Delivery from Business
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hall Allocation */}
                                            <div className="w-full md:w-64">
                                                <label className="block text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                                                    Hall Allocation
                                                </label>
                                                <select 
                                                    value={cls.hallId || ""}
                                                    onChange={(e) => handleAllocateHall(cls.id, e.target.value)}
                                                    className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors appearance-none cursor-pointer
                                                        ${cls.hallId ? 'border-indigo-500/50 text-indigo-300 font-medium' : 'border-slate-700/50 text-slate-400 hover:border-slate-600'}`}
                                                >
                                                    <option value="">Unassigned (Select Hall)</option>
                                                    {halls.map(hall => (
                                                        <option key={hall.id} value={hall.id}>{hall.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Hall Manager Panel */}
                {showHallManager && (
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-6 backdrop-blur-sm sticky top-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <MapPin className="text-indigo-400" size={18} />
                                Hall Management
                            </h2>

                            <form onSubmit={handleAddHall} className="flex gap-2 mb-6">
                                <input 
                                    type="text" 
                                    placeholder="e.g. Studio 01"
                                    value={newHallName}
                                    onChange={(e) => setNewHallName(e.target.value)}
                                    className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                                />
                                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors">
                                    <Plus size={18} />
                                </button>
                            </form>

                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                {halls.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">No halls configured</p>
                                ) : (
                                    halls.map(hall => (
                                        <div key={hall.id} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded-lg p-3 group min-h-[44px]">
                                            {editingHallId === hall.id ? (
                                                <form onSubmit={(e) => { e.preventDefault(); handleUpdateHall(hall.id); }} className="flex-1 flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={editHallName}
                                                        onChange={(e) => setEditHallName(e.target.value)}
                                                        className="flex-1 bg-slate-900/80 border border-indigo-500/50 rounded px-2 py-1 text-sm focus:outline-none text-slate-200"
                                                        autoFocus
                                                    />
                                                    <button type="submit" className="text-emerald-400 hover:text-emerald-300"><CheckCircle size={16} /></button>
                                                    <button type="button" onClick={() => setEditingHallId(null)} className="text-slate-400 hover:text-slate-300"><X size={16} /></button>
                                                </form>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-medium text-slate-300">{hall.name}</span>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button 
                                                            onClick={() => { setEditingHallId(hall.id); setEditHallName(hall.name); }}
                                                            className="text-slate-500 hover:text-blue-400 transition-colors"
                                                            title="Edit Hall"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteHall(hall.id)}
                                                            className="text-slate-500 hover:text-red-400 transition-colors"
                                                            title="Delete Hall"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechnicalDashboard;

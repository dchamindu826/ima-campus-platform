import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Calendar, Phone, Play, Square, Building2, User, Clock, AlertCircle, ChevronDown, ChevronUp, Search, BrainCircuit, MessageSquare, StickyNote, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const InboundCallLogs = ({ businesses, direction = 'INBOUND', subType }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [filters, setFilters] = useState({
        search: '',
        startDate: '',
        endDate: '',
        date: '',
        businessId: '',
        agentId: ''
    });

    const [playing, setPlaying] = useState(null);
    const audioRef = React.useRef(new Audio());

    const [expandedRows, setExpandedRows] = useState({});
    
    // Pagination
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(40);

    useEffect(() => {
        fetchLogs();
        return () => {
            audioRef.current.pause();
        };
    }, [filters.startDate, filters.endDate, filters.date, filters.businessId, filters.agentId, direction, subType]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (!filters.startDate && !filters.endDate && filters.date) params.append('date', filters.date);
            if (filters.businessId) params.append('businessId', filters.businessId);
            if (filters.agentId) params.append('agentId', filters.agentId);
            if (direction) params.append('direction', direction);
            
            const res = await api.get(`/admin/whatsapp-call/logs?${params.toString()}`);
            const data = res.data;
            setLogs(Array.isArray(data) ? data : (data?.logs || []));
        } catch (error) {
            toast.error("Failed to load call logs");
            setLogs([]);
        }
        setLoading(false);
    };

    const handlePlay = (id, url) => {
        if (!url || url === 'null' || url === 'undefined') return toast.error("Recording file not available for this call");
        
        if (playing === id) {
            audioRef.current.pause();
            setPlaying(null);
        } else {
            audioRef.current.src = api.defaults.baseURL.replace('/api', '') + '/storage/recordings/' + url;
            audioRef.current.play().catch(e => toast.error("Could not play recording"));
            setPlaying(id);
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getStaffForFilter = () => {
        if (filters.businessId) {
            const biz = businesses.find(b => b.id.toString() === filters.businessId.toString());
            return biz ? biz.staff || [] : [];
        }
        const allStaff = businesses.flatMap(b => b.staff || []);
        return Array.from(new Set(allStaff.map(s => s.id)))
            .map(id => allStaff.find(s => s.id === id));
    };
    const uniqueStaff = getStaffForFilter();

    const filteredLogs = logs.filter(log => {
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            return (
                log.leadPhone.toLowerCase().includes(searchLower) ||
                (log.agent?.firstName && log.agent.firstName.toLowerCase().includes(searchLower)) ||
                (log.agent?.lastName && log.agent.lastName.toLowerCase().includes(searchLower))
            );
        }
        return true;
    });

    const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    // Calculate Average Duration
    const totalSeconds = filteredLogs.reduce((acc, log) => acc + (log.duration || 0), 0);
    const avgSeconds = filteredLogs.length > 0 ? Math.floor(totalSeconds / filteredLogs.length) : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Phone className="text-emerald-400" size={20} /> {direction === 'OUTBOUND' ? (subType === 'CAMPAIGN' ? 'Call Campaign Outbound Logs' : 'Direct Inquiry Outbound Logs') : 'Inbound Call History'}
                </h2>
                
                <div className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-3">
                    <Clock size={16} className="text-emerald-400" />
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Avg. Call Duration</p>
                        <p className="text-sm text-white font-bold">{formatDuration(avgSeconds)}</p>
                    </div>
                </div>
            </div>
            
            {/* Filters & Search */}
            <div className="bg-black/20 border border-white/10 p-4 rounded-xl flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Search</label>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Search by Phone or Agent..."
                            value={filters.search}
                            onChange={(e) => {
                                setFilters(p => ({ ...p, search: e.target.value }));
                                setPage(1);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start Date</label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="date"
                            value={filters.startDate || filters.date}
                            onChange={(e) => {
                                setFilters(p => ({ ...p, startDate: e.target.value, date: '' }));
                                setPage(1);
                            }}
                            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none w-36 cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End Date</label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => {
                                setFilters(p => ({ ...p, endDate: e.target.value, date: '' }));
                                setPage(1);
                            }}
                            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none w-36 cursor-pointer"
                        />
                    </div>
                </div>

                {(filters.startDate || filters.endDate || filters.date) && (
                    <button
                        onClick={() => {
                            setFilters(p => ({ ...p, startDate: '', endDate: '', date: '' }));
                            setPage(1);
                        }}
                        className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                    >
                        Show All History
                    </button>
                )}

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Business</label>
                    <select 
                        value={filters.businessId}
                        onChange={(e) => setFilters(p => ({ ...p, businessId: e.target.value, agentId: '' }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none min-w-[180px] cursor-pointer"
                    >
                        <option value="" className="bg-[#1a2332]">All Businesses</option>
                        {businesses.map(b => (
                            <option key={b.id} value={b.id} className="bg-[#1a2332]">{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Staff</label>
                    <select 
                        value={filters.agentId}
                        onChange={(e) => setFilters(p => ({ ...p, agentId: e.target.value }))}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none min-w-[180px] cursor-pointer"
                    >
                        <option value="" className="bg-[#1a2332]">All Staff</option>
                        {uniqueStaff.map(s => (
                            <option key={s.id} value={s.id} className="bg-[#1a2332]">{s.firstName} {s.lastName}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : paginatedLogs.length === 0 ? (
                <div className="text-center p-12 text-gray-500">No call logs found.</div>
            ) : (
                <div className="space-y-4">
                    {paginatedLogs.map((log) => {
                        const isExpanded = expandedRows[log.id];
                        return (
                            <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-colors">
                                {/* Card Header (Always Visible) */}
                                <div className="p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between relative">
                                    <div className="grid grid-cols-2 lg:grid-cols-[180px_220px_220px_120px_100px] xl:grid-cols-[200px_250px_250px_120px_100px] gap-2 lg:gap-4 items-center flex-1 cursor-pointer" onClick={() => toggleRow(log.id)}>
                                        {/* Lead Info */}
                                        <div className="flex flex-col justify-center">
                                            <p className="text-sm font-bold text-white mb-1">{log.leadPhone}</p>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded uppercase tracking-wider">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                                                    log.direction === 'INBOUND' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 
                                                    'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                                }`}>
                                                    {log.direction || 'UNKNOWN'}
                                                </span>
                                                {log.isNewInquiry && (
                                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">NEW INQ</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Business */}
                                        <div className="flex items-center gap-2">
                                            {log.business?.logo ? (
                                                <img src={api.defaults.baseURL.replace('/api', '') + `/storage/icons/${log.business.logo}`} alt="" className="w-6 h-6 rounded-full object-cover border border-white/20" />
                                            ) : (
                                                <Building2 size={16} className="text-gray-400" />
                                            )}
                                            <span className="text-sm text-gray-300 font-medium">{log.business?.name || 'Unknown'}</span>
                                        </div>

                                        {/* Agent */}
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-emerald-400" />
                                            <div className="flex flex-col">
                                                <span className="text-sm text-white font-medium">
                                                    {log.agent?.firstName ? `${log.agent.firstName} ${log.agent.lastName || ''}` : <span className="text-gray-500 italic">Unassigned</span>}
                                                </span>
                                                {log.passedByUser && (
                                                    <span className="text-[10px] text-orange-400 flex items-center gap-1">
                                                        Passed by: {log.passedByUser.firstName}
                                                        <AlertCircle size={10} title={log.passReason || 'No reason'} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="flex justify-start">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${
                                                log.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                log.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                        
                                        {/* Duration */}
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <Clock size={14} />
                                            <span className="text-sm font-medium">{formatDuration(log.duration)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-4 shrink-0 ml-auto lg:ml-0">
                                        {log.recordingUrl && (
                                            <audio 
                                                controls 
                                                controlsList="nodownload"
                                                className="h-8 w-56 outline-none rounded-full" 
                                                src={`${api.defaults.baseURL.replace('/api', '')}/storage/recordings/${log.recordingUrl}#t=0.001`}
                                            />
                                        )}
                                        <button 
                                            onClick={() => toggleRow(log.id)}
                                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                        >
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </button>
                                    </div>
                                </div>

                            {/* Collapsible Expanded Details */}
                                {isExpanded && (
                                    <div className="p-4 border-t border-white/5 bg-black/20 text-sm">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* AI Analysis Left */}
                                            <div className="space-y-4">
                                                <h4 className="text-emerald-400 font-bold flex items-center gap-2 mb-2"><BrainCircuit size={16} /> AI Call Analysis</h4>
                                                
                                                <div className="flex flex-wrap gap-4">
                                                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex-1 min-w-[120px]">
                                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tone</p>
                                                        <p className="font-bold text-gray-100 text-sm">{log.aiTone || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex-1 min-w-[120px]">
                                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Mood</p>
                                                        <p className="font-bold text-gray-100 text-sm">{log.aiMood || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex-1 min-w-[120px]">
                                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Overall Vibe</p>
                                                        <p className="font-bold text-gray-100 text-sm">{log.aiVibe || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2"><Activity size={14} /> AI Summary</p>
                                                        <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedRows(prev => ({ ...prev, [`lang_${log.id}`]: 'en' }));
                                                                }}
                                                                className={`px-3 py-1.5 rounded text-sm font-bold transition-all ${expandedRows[`lang_${log.id}`] !== 'si' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white'}`}
                                                            >
                                                                EN
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedRows(prev => ({ ...prev, [`lang_${log.id}`]: 'si' }));
                                                                }}
                                                                className={`px-3 py-1.5 rounded text-sm font-bold transition-all ${expandedRows[`lang_${log.id}`] === 'si' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-white'}`}
                                                            >
                                                                සිංහල
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-gray-200 leading-relaxed text-sm">
                                                        {expandedRows[`lang_${log.id}`] === 'si' 
                                                            ? (log.aiSummarySinhala || 'සිංහල සාරාංශය ලබා ගත නොහැක.')
                                                            : (log.aiSummary || 'AI Summary not generated for this call.')}
                                                    </p>
                                                    
                                                    {log.aiFullAnalysis && log.aiFullAnalysis !== "No analysis available" && (
                                                        <div className="mt-4 pt-4 border-t border-white/10">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedRows(prev => ({ ...prev, [`analysis_${log.id}`]: !prev[`analysis_${log.id}`] }));
                                                                }}
                                                                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                                                            >
                                                                <BrainCircuit size={16} /> 
                                                                {expandedRows[`analysis_${log.id}`] ? 'Hide Full Analysis' : 'Read Full Analysis'}
                                                            </button>
                                                            
                                                            {expandedRows[`analysis_${log.id}`] && (
                                                                <div className="mt-3 p-4 bg-black/40 rounded border border-blue-500/20">
                                                                    <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">
                                                                        {log.aiFullAnalysis}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Extra Details Right */}
                                            <div className="space-y-4">
                                                {log.passReason && (
                                                    <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/20">
                                                        <p className="text-[10px] text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2 font-bold"><AlertCircle size={12} /> Call Passed Reason</p>
                                                        <p className="text-gray-300 leading-relaxed text-xs">
                                                            {log.passReason}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 font-bold"><StickyNote size={14} /> AI Notes</p>
                                                    <p className="text-gray-100 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                                                        {log.aiNotes || 'No specific notes recorded by AI.'}
                                                    </p>
                                                </div>

                                                {/* Routing History */}
                                                {log.poolSnapshot && (
                                                    <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 font-bold">
                                                            <Activity size={12} /> Pool Status at Call Time
                                                        </p>
                                                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                                            {Array.isArray(log.poolSnapshot) ? log.poolSnapshot.map(agent => (
                                                                <div key={agent.id} className="flex items-center justify-between text-xs bg-white/5 px-3 py-1.5 rounded border border-white/5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-gray-200 font-medium">{agent.name}</span>
                                                                        <span className="text-[10px] text-gray-500">Channel {agent.channel}</span>
                                                                    </div>
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                        agent.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        agent.status === 'ON_CALL' ? 'bg-blue-500/20 text-blue-400' :
                                                                        'bg-gray-500/20 text-gray-400'
                                                                    }`}>
                                                                        {agent.status}
                                                                    </span>
                                                                </div>
                                                            )) : <p className="text-xs text-gray-500">Snapshot data unavailable</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-4">
                    <p className="text-sm text-gray-400">
                        Showing <span className="font-bold text-white">{(page - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-white">{Math.min(page * itemsPerPage, filteredLogs.length)}</span> of <span className="font-bold text-white">{filteredLogs.length}</span> calls
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InboundCallLogs;

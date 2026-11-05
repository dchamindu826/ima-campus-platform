import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, Activity, Coffee, UserX, PhoneOff, Users, BarChart, ChevronDown, ChevronUp, CheckCircle, Clock, Upload, X, Edit2, Database, PhoneIncoming, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import RingtoneSelector from './RingtoneSelector';
import InboundCallLogs from './InboundCallLogs';
import LumiInvoiceGenerator from './LumiInvoiceGenerator';
import CallPermissionsWidget from '../../components/common/CallPermissionsWidget';
import InboundMissedCallsReportModal from '../../components/common/InboundMissedCallsReportModal';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import api from '../../api/axios';

export default function LumiCallerMain({ loggedInUser }) {
    const [businesses, setBusinesses] = useState([]);
    const [expandedBusinesses, setExpandedBusinesses] = useState({});
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [missedCallsLog, setMissedCallsLog] = useState([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    // Tab states
    const [activeMainTab, setActiveMainTab] = useState('ACTIVE_CHANNELS');
    const [activeWaTab, setActiveWaTab] = useState('OUTGOING');
    const [activeWaOutTab, setActiveWaOutTab] = useState('CAMPAIGN');
    const [activeReportTab, setActiveReportTab] = useState('WHATSAPP');
    
    // Date filter states
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [channelToCreate, setChannelToCreate] = useState(null);
    const [newExtension, setNewExtension] = useState('');
    const [globalStats, setGlobalStats] = useState({ totalCalls: 0, activeAgents: 0 });
    const fileInputRefs = useRef({});

    const role = (loggedInUser?.role || 'STUDENT').toUpperCase();
    const isSuperAdmin = role === 'SUPER ADMIN' || role === 'ADMIN' || role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
    const isManager = role === 'MANAGER' || role === 'ASS MANAGER' || role === 'ASS_MANAGER';
    const isCoordinator = role === 'COORDINATOR' || role === 'CALLER' || role === 'CALL_CENTER_AGENT' || (!isSuperAdmin && !isManager);

    useEffect(() => {
        fetchChannels();

        const token = localStorage.getItem('token');
        const baseApiUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const defaultSocketUrl = baseApiUrl.replace('/api', '');

        const newSocket = io(defaultSocketUrl, {
            auth: { token },
            transports: ['websocket']
        });

        newSocket.on('agent_status_changed', (data) => {
            setChannels(prev => prev.map(c =>
                c.id === data.userId ? { ...c, agentStatus: data.status } : c
            ));
        });

        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, []);

    useEffect(() => {
        fetchChannels();
    }, [startDate, endDate]);

    const fetchChannels = async () => {
        setLoading(true);
        try {
            const bizRes = await api.get(`/admin/staff/businesses?t=${new Date().getTime()}`);
            const staffRes = await api.get(`/admin/staff?startDate=${startDate}&endDate=${endDate}&t=${new Date().getTime()}`);
            const statsRes = await api.get('/admin/staff/lumi-stats').catch(() => ({ data: { totalCalls: 0, activeAgents: 0 } }));
            const missedRes = await api.get(`/admin/staff/lumi-missed-calls?startDate=${startDate}&endDate=${endDate}&t=${new Date().getTime()}`).catch(() => ({ data: [] }));
            
            if (missedRes.data) {
                setMissedCallsLog(missedRes.data);
            }

            if (bizRes.data && staffRes.data) {
                setGlobalStats(statsRes.data);
                let realBusinesses = bizRes.data.map(b => {
                    const staffInBiz = staffRes.data.filter(s => {
                        if (!s.businessType) return false;
                        const sBiz = String(s.businessType).toLowerCase().trim();
                        const bName = String(b.name).toLowerCase().trim();
                        return String(s.businessType) === String(b.id) || bName.includes(sBiz) || sBiz.includes(bName);
                    });

                    const apiUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    const baseUrl = apiUrl.replace('/api', '');

                    const getImageUrl = (imageName, isBusiness) => {
                        if (!imageName || imageName === 'default.png' || imageName === 'null') {
                            return isBusiness ? `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}&background=0D8ABC&color=fff` : '';
                        }
                        if (imageName.startsWith('http')) return imageName;
                        
                        const imagePath = isBusiness ? `/storage/icons/${imageName}` : `/storage/icons/${imageName}`;
                        return `${baseUrl}${imagePath}`;
                    };

                    return {
                        id: b.id,
                        name: b.name,
                        type: b.name,
                        logo: getImageUrl(b.logo, true),
                        ringtone: b.ringtone, // <-- Fixed: add ringtone to state
                        staff: staffInBiz.map(s => ({
                            id: s.id,
                            firstName: s.firstName,
                            lastName: s.lastName,
                            role: s.role,
                            agentStatus: s.agentStatus || 'OFFLINE',
                            profilePic: s.image ? (s.image.startsWith('http') ? s.image : `${baseUrl}/storage/users/${s.image}`) : '',
                            hasChannel: s.hasCallChannel || false,
                            extension: s.extension || 'N/A',
                            callStats: s.callStats || { totalCalls: 0, avgDuration: 0 },
                            inboundStats: s.inboundStats || { totalCalls: 0, avgDuration: 0 },
                            outboundStats: s.outboundStats || { totalCalls: 0, avgDuration: 0 },
                            missedCalls: s.missedCalls || 0
                        }))
                    };
                });

                realBusinesses = realBusinesses.filter(b => b.staff.length > 0);

                if (!isSuperAdmin) {
                    if (isManager && loggedInUser?.businessType) {
                        realBusinesses = realBusinesses.filter(b => b.type === loggedInUser.businessType || String(b.id) === String(loggedInUser.businessType));
                    } else {
                        realBusinesses = realBusinesses.map(b => ({
                            ...b,
                            staff: b.staff.filter(s => String(s.id) === String(loggedInUser.id))
                        })).filter(b => b.staff.length > 0);
                    }
                }
                
                const initialExpanded = {};
                realBusinesses.forEach(b => initialExpanded[b.id] = true);
                setExpandedBusinesses(initialExpanded);

                setBusinesses(realBusinesses);
            }
        } catch (error) {
            console.error("Failed to fetch businesses or staff", error);
            toast.error("Failed to load real data.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusIndicator = (status) => {
        switch (status?.toUpperCase()) {
            case 'IN_CALL':
            case 'IN A CALL':
                return (
                    <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20 font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-blue-500/20 transition-colors">
                        <PhoneCall size={12} /> STATUS: IN A CALL
                    </div>
                );
            case 'ACTIVE': 
                return (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20 font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-emerald-500/20 transition-colors">
                        <CheckCircle size={12} /> STATUS: ACTIVE
                    </div>
                );
            case 'LUNCH': 
                return (
                    <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-md border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-amber-500/20 transition-colors">
                        <Coffee size={12} /> STATUS: LUNCH
                    </div>
                );
            case 'AWAY': 
                return (
                    <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-md border border-orange-500/20 font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-orange-500/20 transition-colors">
                        <Clock size={12} /> STATUS: AWAY
                    </div>
                );
            default: 
                return (
                    <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-md border border-red-500/20 font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-red-500/20 transition-colors">
                        <PhoneOff size={12} /> STATUS: OFFLINE
                    </div>
                );
        }
    };

    const handleCreateChannel = async () => {
        if (!newExtension) return toast.error("Please enter an extension number");
        
        try {
            await api.put(`/admin/staff/${channelToCreate.id}/channel`, { extension: newExtension });
            toast.success(`Channel EXT-${newExtension} created for ${channelToCreate.firstName}!`);
            
            fetchChannels();
            
            setIsCreateModalOpen(false);
            setNewExtension('');
            setChannelToCreate(null);
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to create channel");
        }
    };

    const handleProfilePicChange = (e, memberId) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setBusinesses(prev => prev.map(b => ({
                ...b,
                staff: b.staff.map(s => s.id === memberId ? { ...s, profilePic: url } : s)
            })));
            toast.success("Profile picture updated (Local Preview)");
        }
    };

    return (
        <div className="min-h-screen text-white p-4 md:p-8 pt-24 font-sans relative">
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3 tracking-wide">
                        <PhoneCall size={32} className="text-emerald-400" />
                        LUMI CALLER DASHBOARD
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium">
                        {isSuperAdmin ? "Global Operations View: All Businesses & Channels" :
                            isManager ? `Manager View: ${loggedInUser?.businessType || 'Assigned'} Business Channels` :
                                "My Call Progress"}
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center min-w-[120px]">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Calls</span>
                        <span className="text-2xl font-black text-white mt-1">{globalStats.totalCalls.toLocaleString()}</span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center min-w-[120px]">
                        <span className="text-xs text-emerald-500/70 font-bold uppercase tracking-wider">Active Agents</span>
                        <span className="text-2xl font-black text-emerald-400 mt-1">
                            {businesses.reduce((acc, b) => acc + b.staff.filter(s => s.agentStatus === 'ACTIVE' && s.hasChannel).length, 0)}
                        </span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <>
                    <div className="flex border-b border-gray-700/50 mb-6 space-x-8 overflow-x-auto no-scrollbar">
                        {['ACTIVE_CHANNELS', 'WHATSAPP_CALL', 'CALL_TREE', 'REPORTS'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveMainTab(tab)}
                                className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeMainTab === tab ? 'text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                {tab.replace('_', ' ')}
                                {activeMainTab === tab && (
                                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                                )}
                            </button>
                        ))}
                    </div>

                    {activeMainTab === 'ACTIVE_CHANNELS' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="text-blue-400" size={20} /> Active Channels</h2>
                                </div>

                                <div className="space-y-6">
                            {businesses.map((business) => (
                                <div key={business.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300">
                                    <div 
                                        className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                                        onClick={() => setExpandedBusinesses(prev => ({ ...prev, [business.id]: !prev[business.id] }))}
                                    >
                                        <div className="flex items-center gap-4">
                                            <img src={business.logo} alt={business.name} className="w-10 h-10 rounded-lg shadow-md border border-white/20 object-cover" />
                                            <div>
                                                <h3 className="font-bold text-lg text-white">{business.name}</h3>
                                                <p className="text-[11px] text-gray-400 font-bold tracking-wider">{business.staff.length} Allocated Staff</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <RingtoneSelector 
                                                businessId={business.id} 
                                                currentRingtone={business.ringtone}
                                                onRingtoneAssigned={(ringtone) => {
                                                    setBusinesses(prev => prev.map(b => b.id === business.id ? { ...b, ringtone } : b));
                                                }}
                                            />
                                            <button className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                                                {expandedBusinesses[business.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {expandedBusinesses[business.id] && (
                                        <div className="p-4 border-t border-white/10 bg-black/20">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {business.staff.map(member => (
                                                <div 
                                                    key={member.id} 
                                                    onClick={() => member.hasChannel && setSelectedChannel(member)}
                                                    className={`bg-white/5 border rounded-xl p-3 flex flex-col justify-between aspect-square transition-all duration-300 ${
                                                        selectedChannel?.id === member.id 
                                                            ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-white/10 scale-[1.02]' 
                                                            : member.hasChannel ? 'border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer' : 'border-dashed border-white/10 opacity-70 cursor-default'
                                                    }`}
                                                >
                                                    <div className="flex flex-col items-center text-center gap-2 mb-2">
                                                        <div className="relative group cursor-pointer shrink-0" onClick={(e) => { e.stopPropagation(); if(fileInputRefs.current[member.id]) fileInputRefs.current[member.id].click(); }}>
                                                            <img 
                                                                src={member.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.firstName + ' ' + member.lastName)}&background=random`} 
                                                                alt={member.firstName} 
                                                                className={`w-14 h-14 rounded-full border shadow-sm p-[2px] object-cover transition-all ${member.hasChannel ? 'border-white/20 ring-2 ring-emerald-500/30 group-hover:brightness-50' : 'border-white/10 grayscale'}`}
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Upload size={16} className="text-white" />
                                                            </div>
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                className="hidden" 
                                                                ref={el => fileInputRefs.current[member.id] = el}
                                                                onChange={(e) => handleProfilePicChange(e, member.id)} 
                                                            />
                                                        </div>
                                                        <div className="min-w-0 w-full">
                                                            <h3 className="font-bold text-sm text-white truncate w-full">{member.firstName}</h3>
                                                            {member.hasChannel ? (
                                                                <div className="mt-1 flex flex-col items-center gap-1">
                                                                    <div className="flex items-center gap-1 group/ext cursor-pointer" onClick={(e) => { e.stopPropagation(); setChannelToCreate(member); setNewExtension(member.extension); setIsCreateModalOpen(true); }}>
                                                                        <span className="text-[9px] font-black text-emerald-400 tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-emerald-500/20 transition-colors">
                                                                            EXT-{member.extension}
                                                                            <Edit2 size={10} className="opacity-50 group-hover/ext:opacity-100" />
                                                                        </span>
                                                                    </div>
                                                                    {getStatusIndicator(member.agentStatus)}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center w-full mt-1 gap-1">
                                                                    <p className="text-[10px] text-gray-400 truncate w-full">{member.role}</p>
                                                                    <div className="flex items-center gap-1.5 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-500/20">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${member.agentStatus?.toUpperCase() === 'ACTIVE' ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]' : member.agentStatus?.toUpperCase() === 'LUNCH' ? 'bg-amber-400' : member.agentStatus?.toUpperCase() === 'AWAY' ? 'bg-orange-400' : member.agentStatus?.toUpperCase() === 'IN_CALL' || member.agentStatus?.toUpperCase() === 'IN A CALL' ? 'bg-blue-400' : 'bg-red-400'}`}></div>
                                                                        <span className="text-[8px] font-bold text-gray-300 uppercase tracking-wider">{member.agentStatus || 'OFFLINE'}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {member.hasChannel ? (
                                                        <div className="flex justify-between items-center bg-black/30 p-2 rounded border border-white/5 mt-auto">
                                                            <div className="flex flex-col items-center w-1/2 border-r border-white/10">
                                                                <span className="text-[8px] text-gray-500 uppercase font-bold">Calls</span>
                                                                <span className="text-xs font-bold text-white">{member.callStats?.totalCalls || 0}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center w-1/2">
                                                                <span className="text-[8px] text-gray-500 uppercase font-bold">Avg</span>
                                                                <span className="text-xs font-bold text-white">{member.callStats?.avgDuration || 0}m</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-auto">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setChannelToCreate(member); setIsCreateModalOpen(true); }}
                                                                className="flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-2 rounded-lg border border-blue-500/20 font-bold text-[10px] uppercase tracking-wider hover:bg-blue-500/20 transition-colors w-full"
                                                            >
                                                                <PhoneCall size={12} /> Create
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {businesses.length === 0 && (
                                <div className="p-8 text-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                                    No active businesses or channels found for your view.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Stats */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <BarChart className="text-purple-400" size={20} /> 
                            {selectedChannel ? `${selectedChannel.firstName}'s Progress` : 'Daily Progress'}
                        </h2>
                        
                        {!selectedChannel ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                                <Users className="text-gray-500 mb-4 opacity-50" size={48} />
                                <p className="text-gray-400 text-sm">Select a channel from the list to view detailed performance metrics.</p>
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                
                                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                                        {selectedChannel.firstName.charAt(0)}{selectedChannel.lastName ? selectedChannel.lastName.charAt(0) : ''}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{selectedChannel.firstName} {selectedChannel.lastName}</h3>
                                        <p className="text-xs text-emerald-400 font-medium">CH-{selectedChannel.id.toString().padStart(3, '0')} • {selectedChannel.role}</p>
                                    </div>
                                </div>

                                <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Performance Metrics</h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between text-sm font-bold mb-1">
                                            <span className="text-white">Answer Rate</span>
                                            <span className="text-emerald-400">
                                                {80 + (selectedChannel.id % 15)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-black/50 rounded-full h-2">
                                            <div className="bg-emerald-400 h-2 rounded-full transition-all duration-1000" style={{ width: `${80 + (selectedChannel.id % 15)}%` }}></div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between text-sm font-bold mb-1">
                                            <span className="text-white">Conversion Rate</span>
                                            <span className="text-blue-400">
                                                {25 + (selectedChannel.id % 20)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-black/50 rounded-full h-2">
                                            <div className="bg-blue-400 h-2 rounded-full transition-all duration-1000" style={{ width: `${25 + (selectedChannel.id % 20)}%` }}></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm font-bold mb-1">
                                            <span className="text-white">Call Quality (AI Score)</span>
                                            <span className="text-amber-400">
                                                {8 + (selectedChannel.id % 2)}.{selectedChannel.id % 10}/10
                                            </span>
                                        </div>
                                        <div className="w-full bg-black/50 rounded-full h-2">
                                            <div className="bg-amber-400 h-2 rounded-full transition-all duration-1000" style={{ width: `${(8 + (selectedChannel.id % 2)) * 10 + (selectedChannel.id % 10)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* WHATSAPP CALL TAB */}
            {activeMainTab === 'WHATSAPP_CALL' && (
                <div className="space-y-6">
                    {/* Secondary Navigation */}
                    <div className="flex flex-wrap bg-black/40 p-2 rounded-xl border border-gray-700/50 w-max gap-1">
                        {[
                            { id: 'OVERVIEW', label: 'Overview' },
                            { id: 'INBOUND', label: 'Inbound Logs' },
                            { id: 'OUTGOING', label: 'Outgoing Logs' },
                            { id: 'PERMISSIONS_HISTORY', label: 'Call Requests History' }
                        ].map(subTab => (
                            <button
                                key={subTab.id}
                                onClick={() => setActiveWaTab(subTab.id)}
                                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeWaTab === subTab.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {subTab.label}
                            </button>
                        ))}
                    </div>

                    {/* WhatsApp Sub Tab Content */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[400px]">
                        {activeWaTab === 'OVERVIEW' && (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                                <Activity size={48} className="text-gray-500 mb-4" />
                                <h3 className="text-lg font-bold text-gray-300">WhatsApp Calling Overview</h3>
                                <p className="text-sm text-gray-500">Real-time statistics and heatmaps coming soon.</p>
                            </div>
                        )}
                        {activeWaTab === 'INBOUND' && (
                            <InboundCallLogs businesses={businesses} />
                        )}
                        {activeWaTab === 'OUTGOING' && (
                            <div className="space-y-6">
                                {/* Tertiary Navigation */}
                                <div className="flex gap-4 border-b border-gray-800 pb-4">
                                    {['CAMPAIGN', 'INQUIRIES'].map(terTab => (
                                        <button
                                            key={terTab}
                                            onClick={() => setActiveWaOutTab(terTab)}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider transition-all border ${activeWaOutTab === terTab ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
                                        >
                                            {terTab === 'CAMPAIGN' ? 'Call Campaign Logs' : 'Direct Inquiries'}
                                        </button>
                                    ))}
                                </div>
                                <InboundCallLogs businesses={businesses} direction="OUTBOUND" subType={activeWaOutTab} />
                            </div>
                        )}
                        {activeWaTab === 'PERMISSIONS_HISTORY' && (
                            <div className="max-w-4xl mx-auto">
                                <CallPermissionsWidget />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CALL TREE TAB */}
            {activeMainTab === 'CALL_TREE' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[400px] flex flex-col items-center justify-center opacity-50">
                    <Users size={48} className="text-gray-500 mb-4" />
                    <h3 className="text-lg font-bold text-gray-300">Call Tree & Routing</h3>
                    <p className="text-sm text-gray-500">Advanced routing rules and IVR coming soon.</p>
                </div>
            )}
            
            {activeMainTab === 'REPORTS' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap bg-black/40 p-2 rounded-xl border border-gray-700/50 w-max gap-1">
                            {[
                                { id: 'WHATSAPP', label: 'Outbound Reports' },
                                { id: 'INVOICE_GENERATOR', label: '🧾 Lumi Invoice Generator' },
                                { id: 'INBOUND_MISSED', label: 'Incoming & Missed Calls Detailed' },
                                { id: 'CALL_REQUESTS', label: 'Call Requests History' },
                                { id: 'CALL_TREE', label: 'Call Tree' }
                            ].map(subTab => (
                                <button
                                    key={subTab.id}
                                    onClick={() => setActiveReportTab(subTab.id)}
                                    className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeReportTab === subTab.id ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    {subTab.label}
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all hover:scale-105"
                        >
                            <PhoneIncoming size={15} /> Open Full Analytics Window
                        </button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[400px]">
                        {activeReportTab === 'WHATSAPP' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Activity className="text-emerald-400" size={24} /> 
                                        Business Wise Outbound Call Reports
                                    </h3>
                                    <div className="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-white/10">
                                        <input 
                                            type="date" 
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                        />
                                        <span className="text-gray-500 text-sm">to</span>
                                        <input 
                                            type="date" 
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-6">
                                    {businesses.map(business => {
                                        const coordinators = business.staff.filter(s => 
                                            s.role?.toUpperCase().includes('COORDINATOR') || 
                                            s.role?.toUpperCase().includes('CALLER') || 
                                            s.role?.toUpperCase().includes('AGENT') ||
                                            s.hasChannel
                                        );
                                        
                                        if (coordinators.length === 0) return null;
                                        
                                        let totalFreeSemIn = 0; let totalFreeSemInMins = 0;
                                        let totalFreeSemOut = 0; let totalFreeSemOutMins = 0;
                                        
                                        let totalAfterSemIn = 0; let totalAfterSemInMins = 0;
                                        let totalAfterSemOut = 0; let totalAfterSemOutMins = 0;
                                        
                                        let totalGeneralIn = 0; let totalGeneralInMins = 0;
                                        let totalGeneralOut = 0; let totalGeneralOutMins = 0;
                                        
                                        let grandTotalMins = 0;
                                        
                                        return (
                                            <div key={business.id} className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                                                <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center gap-4">
                                                    <img src={business.logo} alt={business.name} className="w-8 h-8 rounded-lg object-cover" />
                                                    <h4 className="text-lg font-bold text-white">{business.name}</h4>
                                                </div>
                                                <div className="p-0 overflow-x-auto">
                                                    <table className="w-full text-left border-collapse min-w-[1000px]">
                                                        <thead>
                                                            <tr className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider">
                                                                <th className="px-6 py-3 border-b border-white/10 font-medium align-bottom" rowSpan={2}>Coordinator</th>
                                                                <th className="px-4 py-2 border-b border-white/10 font-medium text-center text-emerald-400 border-r border-white/5 border-l border-white/5" colSpan={4}>Free Seminar</th>
                                                                <th className="px-4 py-2 border-b border-white/10 font-medium text-center text-teal-400 border-r border-white/5" colSpan={4}>After Seminar</th>
                                                                <th className="px-4 py-2 border-b border-white/10 font-medium text-center text-blue-400 border-r border-white/5" colSpan={4}>Other / General</th>
                                                                <th className="px-6 py-3 border-b border-white/10 font-medium text-right align-bottom" rowSpan={2}>Total Mins</th>
                                                            </tr>
                                                            <tr className="bg-white/5 text-[10px] text-gray-500 uppercase tracking-wider">
                                                                {/* Free Sem */}
                                                                <th className="px-2 py-2 border-b border-l border-white/5 font-medium text-center">In (C)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">In (M)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">Out (C)</th>
                                                                <th className="px-2 py-2 border-b border-r border-white/5 font-medium text-center">Out (M)</th>
                                                                
                                                                {/* After Sem */}
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">In (C)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">In (M)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">Out (C)</th>
                                                                <th className="px-2 py-2 border-b border-r border-white/5 font-medium text-center">Out (M)</th>
                                                                
                                                                {/* Other */}
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">In (C)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">In (M)</th>
                                                                <th className="px-2 py-2 border-b border-white/5 font-medium text-center">Out (C)</th>
                                                                <th className="px-2 py-2 border-b border-r border-white/5 font-medium text-center">Out (M)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {coordinators.map(coord => {
                                                                const inStats = coord.inboundStats || {};
                                                                const outStats = coord.outboundStats || {};
                                                                
                                                                const freeSemIn = inStats.freeSemCalls || 0;
                                                                const freeSemInMins = inStats.freeSemMins || 0;
                                                                const freeSemOut = outStats.freeSemCalls || 0;
                                                                const freeSemOutMins = outStats.freeSemMins || 0;
                                                                
                                                                const afterSemIn = inStats.afterSemCalls || 0;
                                                                const afterSemInMins = inStats.afterSemMins || 0;
                                                                const afterSemOut = outStats.afterSemCalls || 0;
                                                                const afterSemOutMins = outStats.afterSemMins || 0;
                                                                
                                                                const generalIn = inStats.generalCalls || 0;
                                                                const generalInMins = inStats.generalMins || 0;
                                                                const generalOut = outStats.generalCalls || 0;
                                                                const generalOutMins = outStats.generalMins || 0;
                                                                
                                                                const totalCoordMinutes = freeSemInMins + freeSemOutMins + afterSemInMins + afterSemOutMins + generalInMins + generalOutMins;
                                                                
                                                                totalFreeSemIn += freeSemIn; totalFreeSemInMins += freeSemInMins;
                                                                totalFreeSemOut += freeSemOut; totalFreeSemOutMins += freeSemOutMins;
                                                                totalAfterSemIn += afterSemIn; totalAfterSemInMins += afterSemInMins;
                                                                totalAfterSemOut += afterSemOut; totalAfterSemOutMins += afterSemOutMins;
                                                                totalGeneralIn += generalIn; totalGeneralInMins += generalInMins;
                                                                totalGeneralOut += generalOut; totalGeneralOutMins += generalOutMins;
                                                                grandTotalMins += totalCoordMinutes;
                                                                
                                                                return (
                                                                    <tr key={coord.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                        <td className="px-6 py-3 align-middle">
                                                                            <div className="flex items-center gap-3">
                                                                                <img src={coord.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(coord.firstName + ' ' + coord.lastName)}&background=random`} className="w-8 h-8 rounded-full" alt="" />
                                                                                <div>
                                                                                    <div className="text-sm font-bold text-white">{coord.firstName} {coord.lastName}</div>
                                                                                    <div className="text-[10px] text-gray-500">{coord.role}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        
                                                                        {/* Free Sem */}
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-emerald-300/80 border-l border-white/5">{freeSemIn}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-emerald-400 font-medium">{freeSemInMins}m</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-emerald-300/80">{freeSemOut}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-emerald-400 font-medium border-r border-white/5">{freeSemOutMins}m</td>
                                                                        
                                                                        {/* After Sem */}
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-teal-300/80">{afterSemIn}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-teal-400 font-medium">{afterSemInMins}m</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-teal-300/80">{afterSemOut}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-teal-400 font-medium border-r border-white/5">{afterSemOutMins}m</td>
                                                                        
                                                                        {/* Other */}
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-blue-300/80">{generalIn}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-blue-400 font-medium">{generalInMins}m</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-blue-300/80">{generalOut}</td>
                                                                        <td className="px-2 py-3 text-center align-middle text-sm text-blue-400 font-medium border-r border-white/5">{generalOutMins}m</td>
                                                                        
                                                                        <td className="px-6 py-3 text-right align-middle text-sm font-bold text-white">{totalCoordMinutes}m</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-white/5 border-t border-white/10">
                                                                <td className="px-6 py-4 text-sm font-black text-white text-right">TOTAL</td>
                                                                
                                                                {/* Free Sem */}
                                                                <td className="px-2 py-4 text-center text-md font-black text-emerald-300 border-l border-white/5">{totalFreeSemIn}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-emerald-400">{totalFreeSemInMins}m</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-emerald-300">{totalFreeSemOut}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-emerald-400 border-r border-white/5">{totalFreeSemOutMins}m</td>
                                                                
                                                                {/* After Sem */}
                                                                <td className="px-2 py-4 text-center text-md font-black text-teal-300">{totalAfterSemIn}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-teal-400">{totalAfterSemInMins}m</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-teal-300">{totalAfterSemOut}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-teal-400 border-r border-white/5">{totalAfterSemOutMins}m</td>
                                                                
                                                                {/* Other */}
                                                                <td className="px-2 py-4 text-center text-md font-black text-blue-300">{totalGeneralIn}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-blue-400">{totalGeneralInMins}m</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-blue-300">{totalGeneralOut}</td>
                                                                <td className="px-2 py-4 text-center text-md font-black text-blue-400 border-r border-white/5">{totalGeneralOutMins}m</td>
                                                                
                                                                <td className="px-6 py-4 text-right text-lg font-black text-white">{grandTotalMins}m</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-8 bg-black/30 border border-red-500/20 rounded-xl overflow-hidden">
                                    <div className="bg-red-500/10 px-6 py-4 border-b border-red-500/20 flex items-center justify-between">
                                        <h4 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                            <PhoneOff size={20} />
                                            Missed Calls Log
                                        </h4>
                                        <span className="text-xs font-bold bg-red-500/20 text-red-300 px-3 py-1 rounded-lg">
                                            {missedCallsLog.length} Total Missed Calls
                                        </span>
                                    </div>
                                    <div className="p-0 overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider">
                                                    <th className="px-6 py-3 border-b border-white/10 font-medium">Time & Date</th>
                                                    <th className="px-6 py-3 border-b border-white/10 font-medium">Phone Number</th>
                                                    <th className="px-6 py-3 border-b border-white/10 font-medium">Campaign</th>
                                                    <th className="px-6 py-3 border-b border-white/10 font-medium">Active Agents at the time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {missedCallsLog.length > 0 ? missedCallsLog.map((call) => {
                                                    const activeAgents = call.poolSnapshot && Array.isArray(call.poolSnapshot) 
                                                        ? call.poolSnapshot.filter(a => a.status === 'ACTIVE') 
                                                        : [];
                                                        
                                                    return (
                                                        <tr key={call.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                                                                {new Date(call.createdAt).toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-bold text-white whitespace-nowrap">
                                                                {call.leadPhone || 'Unknown'}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {call.campaignType ? (
                                                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                                                        call.campaignType === 'FREE_SEMINAR' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        call.campaignType === 'AFTER_SEMINAR' ? 'bg-teal-500/20 text-teal-400' :
                                                                        'bg-blue-500/20 text-blue-400'
                                                                    }`}>
                                                                        {call.campaignType.replace('_', ' ')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-500 italic">Unknown</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {activeAgents.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {activeAgents.map(a => (
                                                                            <span key={a.id} className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded border border-white/5">
                                                                                {a.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-red-400/80 italic">No active agents in pool</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-500">
                                                            No missed calls found in this date range. Great job!
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeReportTab === 'INVOICE_GENERATOR' && (
                            <LumiInvoiceGenerator />
                        )}
                        {activeReportTab === 'INBOUND_MISSED' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <PhoneIncoming className="text-emerald-400" size={20} />
                                            Incoming & Missed Calls Date-Time Analytics
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Open interactive analytics view to filter incoming calls by date & time range, inspect hourly missed rates, and download Excel reports.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setIsReportModalOpen(true)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-emerald-900/50 flex items-center gap-2 transition-all hover:scale-105"
                                    >
                                        <BarChart size={16} /> Open Full Analytics Window
                                    </button>
                                </div>
                                <InboundCallLogs businesses={businesses} direction="INBOUND" />
                            </div>
                        )}
                        {activeReportTab === 'CALL_REQUESTS' && (
                            <div className="max-w-4xl mx-auto py-4">
                                <CallPermissionsWidget />
                            </div>
                        )}
                        {activeReportTab === 'CALL_TREE' && (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                                <Users size={48} className="text-gray-500 mb-4" />
                                <h3 className="text-lg font-bold text-gray-300">Call Tree Reports</h3>
                                <p className="text-sm text-gray-500">Call tree analytics coming soon.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            </>
            )}

            {/* Inbound & Missed Calls Full Report Modal */}
            {isReportModalOpen && (
                <InboundMissedCallsReportModal 
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                />
            )}

            {/* Create Channel Modal */}
            {isCreateModalOpen && channelToCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                        <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <PhoneCall className="text-blue-400" size={24} />
                                {channelToCreate.hasChannel ? 'Edit Call Channel' : 'Create Call Channel'}
                            </h2>
                            <p className="text-sm text-gray-400 mt-2">
                                Allocating channel for {channelToCreate.firstName} {channelToCreate.lastName}
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Extension Number</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">EXT-</span>
                                    <input 
                                        type="number" 
                                        value={newExtension}
                                        onChange={(e) => setNewExtension(e.target.value)}
                                        className="w-full bg-black/30 border border-white/20 rounded-lg py-3 pl-14 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold"
                                        placeholder="e.g. 101"
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-4">
                                <h4 className="text-sm font-bold text-blue-400 mb-1 flex items-center gap-2">
                                    <Activity size={16} /> WhatsApp Call Setup
                                </h4>
                                <p className="text-xs text-blue-300/80 leading-relaxed">
                                    Once created, this channel will be actively listening for incoming WhatsApp Web API calls mapped to this extension. The backend WebRTC bridge handles the connection automatically.
                                </p>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-300 hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateChannel}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all"
                            >
                                {channelToCreate.hasChannel ? 'Update' : 'Allocate Channel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

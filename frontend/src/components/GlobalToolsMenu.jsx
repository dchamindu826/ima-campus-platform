import React, { useState, useEffect } from 'react';
import { Settings, Bell, Wrench, Bot, FileText, X, MessageCircle, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { io } from 'socket.io-client';
import GlobalReminderWidget from './GlobalReminderWidget';
import GlobalSystemTaskWidget from './GlobalSystemTaskWidget';
import GlobalAiAgentWidget from './admin/GlobalAiAgentWidget';
import CallPermissionsWidget from './common/CallPermissionsWidget';
import NotesWidget from './NotesWidget';
import toast from 'react-hot-toast';

export default function GlobalToolsMenu({ loggedInUser }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeWidget, setActiveWidget] = useState(null);
    const [unreadWebInq, setUnreadWebInq] = useState(0);
    const [activeCallPerms, setActiveCallPerms] = useState(0);
    const [dueRemindersCount, setDueRemindersCount] = useState(0);
    const [isLumiAiActive, setIsLumiAiActive] = useState(false);
    const navigate = useNavigate();
    const audioRef = React.useRef(null);
    const notifiedReminderIds = React.useRef(new Set());

    useEffect(() => {
        const handleLumiAiState = (e) => {
            setIsLumiAiActive(!!e.detail?.isOpen);
        };
        window.addEventListener('lumi-ai-state-change', handleLumiAiState);
        return () => window.removeEventListener('lumi-ai-state-change', handleLumiAiState);
    }, []);

    const roleUpper = (loggedInUser?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const deptUpper = (loggedInUser?.department || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const isStudent = roleUpper === 'STUDENT' || roleUpper === 'USER';

    const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(roleUpper);
    
    const isExcludedDept = ['DELIVERY', 'FINANCE', 'SOCIAL_MEDIA', 'PHYSICAL', 'TECHNICAL'].includes(deptUpper);

    const isManagerRole = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(roleUpper);
    const isManager = isManagerRole && !isExcludedDept;

    const isCoordinator = ['COORDINATOR', 'CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(roleUpper) || ['CLASS_COORDINATION', 'CALL_CENTER'].includes(deptUpper);
    const isCrmEligible = (isSystemAdmin || isCoordinator || isManager) && !isExcludedDept && !isStudent;

    // 🔥 Global Background Reminder Check & Auto Pop-up 🔥
    const checkDueRemindersGlobally = async () => {
        try {
            const agentId = loggedInUser?.id || loggedInUser?.userId;
            if (!agentId || !isCrmEligible) return;

            const res = await axios.get(`/reminders/my-reminders?agentId=${agentId}&status=active`);
            if (Array.isArray(res.data)) {
                const now = Date.now();
                const due = res.data.filter(r => new Date(r.remindAt).getTime() <= now && !r.isCompleted);
                setDueRemindersCount(due.length);

                const newDue = due.filter(r => !notifiedReminderIds.current.has(r.id));
                if (newDue.length > 0) {
                    newDue.forEach(r => notifiedReminderIds.current.add(r.id));

                    // 1. Auto POP UP the Reminders Widget on user screen
                    setActiveWidget('reminders');

                    // 2. Play Alarm Sound
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.log("Audio play error", e));
                    }

                    // 3. Prominent Toast
                    toast(`⏰ Call Reminder Due (${newDue.length})!\n${newDue[0].phone || newDue[0].name || ''}: ${newDue[0].note || ''}`, {
                        id: 'global_reminder_due_toast_' + Date.now(),
                        duration: 7000,
                        icon: '🔔',
                        style: {
                            borderRadius: '12px',
                            background: '#1e1b4b',
                            color: '#fbbf24',
                            border: '1px solid #f59e0b',
                            fontWeight: 'bold'
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Global reminder fetch error", err);
        }
    };

    useEffect(() => {
        if (!loggedInUser || !isCrmEligible) return;
        checkDueRemindersGlobally();
        const remInterval = setInterval(() => {
            checkDueRemindersGlobally();
        }, 30000); // Check every 30 seconds

        return () => clearInterval(remInterval);
    }, [loggedInUser, isCrmEligible]);

    // 🔥 Hide floating Web Inquiries unread bubble for System Admin, keep for business managers & coordinators 🔥
    const showWebInqWidget = !isSystemAdmin && (isManager || isCoordinator);

    // Fetch active call permissions count
    const fetchCallPermsCount = async () => {
        try {
            const res = await axios.get('/after-seminar-crm/leads/call-permissions?status=ACTIVE');
            if (res.data?.counts?.active !== undefined) {
                setActiveCallPerms(res.data.counts.active);
            }
        } catch (err) {}
    };

    useEffect(() => {
        if (!loggedInUser || !isCrmEligible) return;
        fetchCallPermsCount();

        const token = localStorage.getItem('token');
        const socket = io(axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : '', { auth: { token } });
        
        socket.on('wa_call_permission_granted', () => fetchCallPermsCount());
        socket.on('wa_call_permission_updated', () => fetchCallPermsCount());

        return () => socket.disconnect();
    }, [loggedInUser, isCrmEligible]);

    useEffect(() => {
        if (!loggedInUser || isStudent || !showWebInqWidget) return;
        
        const fetchUnread = async () => {
            try {
                const bizRes = await axios.get('/business/my-businesses');
                const myBizIds = bizRes.data.map(b => b.id);
                
                const res = await axios.get('/web-inquiry');
                const total = res.data.inquiries.reduce((acc, inq) => {
                    if (myBizIds.includes(inq.businessId)) {
                        return acc + (inq.unreadCount || 0);
                    }
                    return acc;
                }, 0);
                setUnreadWebInq(total);
            } catch (err) {}
        };
        fetchUnread();

        const token = localStorage.getItem('token');
        const socket = io(axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : '', { auth: { token } });
        
        socket.on('connect', () => {
            axios.get('/business/my-businesses').then(bizRes => {
                bizRes.data.forEach(b => {
                    socket.emit("join_web_inquiry_staff", { businessId: b.id });
                });
            }).catch(err => console.error(err));
        });

        socket.on('new_web_inquiry_message', () => fetchUnread());
        
        socket.on('web_inquiry_notification', (data) => {
            fetchUnread();
            if (data?.message?.id) {
                toast.success("New Web Inquiry Message Received!", { 
                    id: 'web_inq_global_toast', 
                    duration: 4000, 
                    position: 'top-right',
                    style: { background: '#2563eb', color: '#fff' },
                    iconTheme: { primary: '#fff', secondary: '#2563eb' }
                });
            }
        });

        return () => socket.disconnect();
    }, [loggedInUser, isStudent, showWebInqWidget]);

    if (!loggedInUser) return null;
    if (isStudent) return null;
    if (isLumiAiActive) return null;

    const tools = [
        { id: 'call_permissions', icon: <PhoneCall size={20} />, label: 'Call Allowed Leads', color: 'bg-emerald-600', badge: activeCallPerms, visible: isCrmEligible },
        { id: 'notes', icon: <FileText size={20} />, label: 'My Notes', color: 'bg-blue-500', visible: true },
        { id: 'reminders', icon: <Bell size={20} />, label: 'Reminders', color: 'bg-amber-500', badge: dueRemindersCount, visible: isCrmEligible },
        { id: 'system_tasks', icon: <Wrench size={20} />, label: 'System Tasks', color: 'bg-brand-accent', visible: !isStudent },
        { id: 'ai_agent', icon: <Bot size={20} />, label: 'AI Agent', color: 'bg-purple-500', visible: !isStudent },
    ].filter(tool => tool.visible);

    return (
        <>
            {/* Global Background Audio Player for Reminders */}
            <audio ref={audioRef} src="/reminder_ringtone.mp3" preload="auto" />

            {/* Active Widget Overlay */}
            {activeWidget === 'call_permissions' && (
                <CallPermissionsWidget asModal={true} onClose={() => setActiveWidget(null)} />
            )}
            {activeWidget === 'notes' && (
                <div className="fixed bottom-24 right-6 w-96 max-h-[600px] h-[500px] z-[9999] bg-[#0B1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                    <div className="absolute top-4 right-4 z-50">
                        <button onClick={() => setActiveWidget(null)} className="text-gray-400 hover:text-white bg-black/50 p-1 rounded-full"><X size={16}/></button>
                    </div>
                    <NotesWidget loggedInUser={loggedInUser} />
                </div>
            )}
            
            {activeWidget === 'reminders' && (
                <GlobalReminderWidget asModal={true} onClose={() => setActiveWidget(null)} />
            )}
            {activeWidget === 'system_tasks' && (
                <GlobalSystemTaskWidget loggedInUser={loggedInUser} asModal={true} onClose={() => setActiveWidget(null)} />
            )}
            {activeWidget === 'ai_agent' && (
                <GlobalAiAgentWidget loggedInUser={loggedInUser} asModal={true} onClose={() => setActiveWidget(null)} />
            )}

            {/* Floating Menu Button & Items */}
            <div className="fixed bottom-6 right-6 z-[9998] flex flex-col items-end gap-3">
                
                {/* Menu Items */}
                {isMenuOpen && (
                    <div className="flex flex-col gap-3 items-end mb-2 animate-fade-in-up">
                        {tools.map(tool => (
                            <div key={tool.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => { setActiveWidget(activeWidget === tool.id ? null : tool.id); setIsMenuOpen(false); }}>
                                <span className="bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 shadow-lg">
                                    {tool.label}
                                </span>
                                <div className="relative">
                                    <button className={`${tool.color} text-white w-12 h-12 rounded-full flex justify-center items-center shadow-lg transition-transform hover:scale-110 border border-white/20`}>
                                        {tool.icon}
                                    </button>
                                    {tool.badge > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0B1120] shadow-md animate-pulse">
                                            {tool.badge > 99 ? '99+' : tool.badge}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Toggle Button & Notification */}
                <div className="flex gap-3 items-center">
                    {!isSystemAdmin && unreadWebInq > 0 && (
                        <button 
                            onClick={() => navigate('/workspace/web-inquiries')}
                            className="bg-blue-600 hover:bg-blue-500 text-white w-14 h-14 rounded-full flex justify-center items-center shadow-lg shadow-blue-500/30 transition-transform hover:scale-110 relative border-2 border-white/20 animate-pulse z-[9999]"
                            title="Web Inquiries"
                        >
                            <MessageCircle size={24} />
                            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center animate-bounce shadow-md">
                                {unreadWebInq}
                            </span>
                        </button>
                    )}
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white w-14 h-14 rounded-full flex justify-center items-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110 relative border-2 border-white/20 z-[9999]"
                        title="Tools"
                    >
                        <Settings size={24} className={isMenuOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                    </button>
                </div>
            </div>
        </>
    );
}

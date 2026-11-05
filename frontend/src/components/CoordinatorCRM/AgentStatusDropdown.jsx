import React, { useState, useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import toast from 'react-hot-toast';
import { Activity, Coffee, UserX, PhoneOff, ChevronDown } from 'lucide-react';

export default function AgentStatusDropdown() {
    const getInitialStatus = () => {
        const saved = localStorage.getItem('agentStatus');
        if (saved) return saved;
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user?.agentStatus) {
                localStorage.setItem('agentStatus', user.agentStatus);
                return user.agentStatus;
            }
        } catch(e) {}
        return 'ACTIVE';
    };
    const [status, setStatus] = useState(getInitialStatus);
    const statusRef = useRef(getInitialStatus());
    const { socket, stopRinging } = useCall?.() || {};
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            console.log('Agent Status Socket Connected with status:', statusRef.current);
            socket.emit('join_wa_agent_pool', { status: statusRef.current });
        };

        socket.on('connect', handleConnect);
        
        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off('connect', handleConnect);
        };
    }, [socket]);

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
        statusRef.current = newStatus;
        localStorage.setItem('agentStatus', newStatus);

        // Also update stored user profile in localStorage
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.agentStatus = newStatus;
            localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {}

        // If switching to AWAY, LUNCH or OFFLINE, immediately stop any currently ringing call
        if (newStatus !== 'ACTIVE' && stopRinging) {
            stopRinging();
        }

        setIsOpen(false);
        if (socket) {
            if (newStatus === 'OFFLINE') {
                socket.emit('leave_wa_agent_pool');
            } else {
                socket.emit('join_wa_agent_pool', { status: newStatus });
            }
            toast.success(`Status updated to ${newStatus}`);
        }
    };

    const getStatusConfig = (currentStatus) => {
        switch (currentStatus) {
            case 'ACTIVE':
                return {
                    color: 'text-emerald-300',
                    bg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
                    border: 'border-emerald-500/40 hover:border-emerald-400',
                    dotColor: 'bg-emerald-400',
                    icon: <Activity size={13} className="text-emerald-400" />,
                    label: 'ACTIVE'
                };
            case 'LUNCH':
                return {
                    color: 'text-amber-300',
                    bg: 'bg-amber-500/15 hover:bg-amber-500/25',
                    border: 'border-amber-500/40 hover:border-amber-400',
                    dotColor: 'bg-amber-400',
                    icon: <Coffee size={13} className="text-amber-400" />,
                    label: 'LUNCH'
                };
            case 'AWAY':
                return {
                    color: 'text-orange-300',
                    bg: 'bg-orange-500/15 hover:bg-orange-500/25',
                    border: 'border-orange-500/40 hover:border-orange-400',
                    dotColor: 'bg-orange-400',
                    icon: <UserX size={13} className="text-orange-400" />,
                    label: 'AWAY'
                };
            default:
                return {
                    color: 'text-rose-300',
                    bg: 'bg-rose-500/15 hover:bg-rose-500/25',
                    border: 'border-rose-500/40 hover:border-rose-400',
                    dotColor: 'bg-rose-400',
                    icon: <PhoneOff size={13} className="text-rose-400" />,
                    label: 'OFFLINE'
                };
        }
    };

    const currentConfig = getStatusConfig(status);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`h-9 inline-flex items-center gap-1.5 px-2.5 rounded-xl font-bold text-xs transition-all border whitespace-nowrap shadow-sm select-none ${currentConfig.bg} ${currentConfig.color} ${currentConfig.border}`}
                title={`Agent Availability Status: ${currentConfig.label}`}
            >
                <div className="relative flex items-center justify-center">
                    {currentConfig.icon}
                    {status === 'ACTIVE' && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-80" />
                    )}
                </div>
                <span>{currentConfig.label}</span>
                <ChevronDown size={11} className={`opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-1.5 right-0 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 w-36 flex flex-col p-1 gap-0.5 animate-fade-in-up">
                    <button
                        onClick={() => handleStatusChange('ACTIVE')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'text-emerald-400/90 hover:bg-white/5'}`}
                    >
                        <Activity size={13} /> ACTIVE
                    </button>
                    <button
                        onClick={() => handleStatusChange('LUNCH')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${status === 'LUNCH' ? 'bg-amber-500/20 text-amber-300' : 'text-amber-400/90 hover:bg-white/5'}`}
                    >
                        <Coffee size={13} /> LUNCH
                    </button>
                    <button
                        onClick={() => handleStatusChange('AWAY')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${status === 'AWAY' ? 'bg-orange-500/20 text-orange-300' : 'text-orange-400/90 hover:bg-white/5'}`}
                    >
                        <UserX size={13} /> AWAY
                    </button>
                    <div className="my-0.5 border-t border-white/5" />
                    <button
                        onClick={() => handleStatusChange('OFFLINE')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all text-left ${status === 'OFFLINE' ? 'bg-rose-500/20 text-rose-300' : 'text-rose-400/90 hover:bg-white/5'}`}
                    >
                        <PhoneOff size={13} /> OFFLINE
                    </button>
                </div>
            )}
        </div>
    );
}

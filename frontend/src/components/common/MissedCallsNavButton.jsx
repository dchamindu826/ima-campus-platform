import React, { useState, useEffect, useCallback } from 'react';
import axios from '../../api/axios';
import { FaPhoneSlash, FaTasks } from 'react-icons/fa';
import MissedCallsManagerModal from './MissedCallsManagerModal';
import StaffMissedCallTasksDrawer from './StaffMissedCallTasksDrawer';
import { useCall } from '../../contexts/CallContext';

export default function MissedCallsNavButton() {
    const { socket } = useCall?.() || {};
    const [userRole, setUserRole] = useState('');
    const [isManager, setIsManager] = useState(false);
    const [showManagerModal, setShowManagerModal] = useState(false);
    const [showStaffDrawer, setShowStaffDrawer] = useState(false);

    const [staffPendingCount, setStaffPendingCount] = useState(0);
    const [dailyMissedCount, setDailyMissedCount] = useState(0);

    useEffect(() => {
        try {
            const rawUser = JSON.parse(localStorage.getItem('user') || '{}');
            const role = (rawUser.role || '').toUpperCase().replace(/ /g, '_');
            setUserRole(role);
            setIsManager(['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN'].includes(role));
        } catch (e) {}
    }, []);

    const fetchCounts = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await axios.get('/missed-call-tasks/nav-counts', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                setStaffPendingCount(res.data.staffPending || 0);
                setDailyMissedCount(res.data.dailyMissed || 0);
            }
        } catch (e) {
            // silent fail
        }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000); // 30s polling
        return () => clearInterval(interval);
    }, [fetchCounts]);

    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => fetchCounts();
        socket.on('missed_call_task_assigned', handleUpdate);
        socket.on('call_history_updated', handleUpdate);
        return () => {
            socket.off('missed_call_task_assigned', handleUpdate);
            socket.off('call_history_updated', handleUpdate);
        };
    }, [socket, fetchCounts]);

    return (
        <div className="flex items-center gap-1.5">
            {/* Manager Daily Missed Calls Distribution Button */}
            {isManager && (
                <button
                    type="button"
                    onClick={() => setShowManagerModal(true)}
                    className="h-9 relative px-2.5 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-rose-600/15 hover:from-amber-500/25 hover:via-rose-500/25 hover:to-rose-600/25 text-amber-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-500/30 hover:border-amber-500/50 flex items-center gap-1.5 shadow-sm select-none"
                    title="Open Daily Missed Calls Management & Distribution"
                >
                    <FaPhoneSlash className="text-amber-400 shrink-0" size={12} />
                    <span>Missed</span>

                    {dailyMissedCount > 0 && (
                        <span className="px-1.5 py-0.5 min-w-[18px] text-[10px] font-black bg-rose-500 text-white rounded-full leading-none flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                            {dailyMissedCount}
                        </span>
                    )}
                </button>
            )}

            {/* Staff Assigned Tasks Button */}
            <button
                type="button"
                onClick={() => setShowStaffDrawer(true)}
                className={`h-9 relative px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm select-none ${
                    staffPendingCount > 0
                        ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 text-white border-rose-500/40 hover:border-rose-400'
                        : 'bg-slate-800/60 hover:bg-slate-800/90 text-slate-300 hover:text-white border-white/10 hover:border-white/20'
                }`}
                title="View your assigned missed call tasks"
            >
                <FaTasks className={staffPendingCount > 0 ? 'text-rose-400' : 'text-slate-400'} size={12} />
                <span>My Tasks</span>

                {staffPendingCount > 0 && (
                    <span className="px-1.5 py-0.5 min-w-[18px] text-[10px] font-black bg-rose-500 text-white rounded-full leading-none flex items-center justify-center shadow-sm shadow-rose-500/50">
                        {staffPendingCount}
                    </span>
                )}
            </button>

            {/* Modals / Drawers */}
            {showManagerModal && (
                <MissedCallsManagerModal
                    isOpen={showManagerModal}
                    onClose={() => {
                        setShowManagerModal(false);
                        fetchCounts();
                    }}
                />
            )}

            {showStaffDrawer && (
                <StaffMissedCallTasksDrawer
                    isOpen={showStaffDrawer}
                    onClose={() => {
                        setShowStaffDrawer(false);
                        fetchCounts();
                    }}
                    onTaskCompleted={fetchCounts}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaUserPlus, FaUserCircle } from 'react-icons/fa';

const ActiveCallSidebar = () => {
    const { activeCall, endCall, transferCall } = useCall();
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        let interval;
        if (activeCall) {
            interval = setInterval(() => {
                setDuration(Math.floor((new Date() - activeCall.startTime) / 1000));
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [activeCall]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const toggleMute = () => {
        if (activeCall && activeCall.localStream) {
            activeCall.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!activeCall.localStream.getAudioTracks()[0].enabled);
        }
    };

    const handleTransfer = () => {
        // In a real scenario, this would open a modal to select an active agent.
        // For PoC, we will prompt for an agent ID or simulate it.
        const targetId = prompt("Enter Agent ID to transfer/ping:");
        if (targetId) {
            transferCall(parseInt(targetId));
        }
    };

    if (!activeCall) return null;

    return (
        <div className="fixed top-20 right-6 w-80 bg-[#161f2c] border border-slate-700/50 rounded-2xl shadow-2xl z-[9000] overflow-hidden flex flex-col animate-fade-in-right">
            {/* Header */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-emerald-400 font-semibold text-sm">Active Call</span>
                </div>
                <span className="text-slate-300 font-mono text-sm font-medium bg-slate-800/50 px-2 py-1 rounded-md">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Caller Info */}
            <div className="p-6 flex flex-col items-center border-b border-slate-700/50">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-3xl text-slate-400 mb-3 shadow-inner">
                    <FaUserCircle />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{activeCall.leadName}</h3>
                <p className="text-slate-400 text-sm">{activeCall.from}</p>
            </div>

            {/* Controls */}
            <div className="p-6 bg-slate-800/20 flex items-center justify-center gap-6">
                <button 
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                        isMuted 
                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>

                <button 
                    onClick={endCall}
                    className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-2xl transition-all shadow-lg hover:shadow-red-500/20"
                    title="End Call"
                >
                    <FaPhoneSlash />
                </button>

                <button 
                    onClick={handleTransfer}
                    className="w-12 h-12 rounded-full bg-slate-700 text-slate-300 hover:bg-blue-500 hover:text-white flex items-center justify-center text-lg transition-all"
                    title="Transfer / Add to Call"
                >
                    <FaUserPlus />
                </button>
            </div>
            
            {/* Hidden audio element for remote stream */}
            <audio id="remote-audio" autoPlay className="hidden"></audio>
        </div>
    );
};

export default ActiveCallSidebar;

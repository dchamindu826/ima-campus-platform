import React, { useState, useRef, useEffect } from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaSpinner } from 'react-icons/fa';

export default function GlobalOutboundCallWidget() {
  const { outboundCall, endOutboundCall, toggleOutboundMute } = useCall();
  const [position, setPosition] = useState({ x: 0, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Center on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth / 2 - 160, y: 40 });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    // Only drag if left click
    if (e.button !== 0) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  if (!outboundCall) return null;

  const { lead, status, duration, isMuted, isSaving } = outboundCall;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusColor = () => {
    if (status === 'CONNECTED') return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
    if (status === 'DIALING' || status === 'RINGING') return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
    return 'bg-slate-500';
  };

  return (
    <div 
      className="fixed z-[100000] pointer-events-auto select-none"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
      }}
    >
      <div 
        className={`w-[340px] rounded-3xl overflow-hidden backdrop-blur-2xl border transition-all duration-300 ${
          isDragging 
            ? 'scale-[1.03] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7),0_0_40px_rgba(59,130,246,0.3)] border-blue-500/50 bg-[#0a0f1c]/90' 
            : 'shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),0_0_20px_rgba(0,0,0,0.2)] border-white/10 bg-[#0a0f1c]/80 hover:border-white/20 hover:bg-[#0a0f1c]/90'
        }`}
      >
        
        {/* Dynamic Header / Drag Handle */}
        <div 
          className="h-12 w-full flex items-center justify-between px-5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-white/[0.03] to-transparent border-b border-white/5"
          onMouseDown={handleMouseDown}
        >
          <div className="flex flex-col gap-1 w-full items-center justify-center pt-2 pb-1 relative">
             <div className="w-12 h-1.5 bg-white/20 rounded-full mb-1 group-hover:bg-white/40 transition-colors"></div>
             {/* Glowing indicator */}
             <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  {(status === 'DIALING' || status === 'RINGING' || status === 'CONNECTED') && (
                     <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'CONNECTED' ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getStatusColor()}`}></span>
                </div>
                <span className={`text-[10px] font-black tracking-widest uppercase ${status === 'CONNECTED' ? 'text-emerald-400' : 'text-blue-400 animate-pulse'}`}>
                  {isSaving ? 'Saving...' : status}
                </span>
             </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col items-center gap-4 relative overflow-hidden">
            {/* Background glow based on status */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-700 ${status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>

            {/* Avatar Profile */}
            <div className="relative mt-2">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1A233A] to-[#0a0f1c] border border-white/10 flex items-center justify-center shadow-inner relative z-10 overflow-hidden">
                    {/* Animated gradient border effect inside */}
                    <div className={`absolute inset-0 opacity-20 ${status === 'CONNECTED' ? 'bg-gradient-to-tr from-emerald-500 to-transparent' : 'bg-gradient-to-tr from-blue-500 to-transparent'}`}></div>
                    
                    <span className="text-3xl font-black text-white relative z-20">
                        {lead?.name?.charAt(0)?.toUpperCase() || '#'}
                    </span>
                </div>
                {status === 'CONNECTED' && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-lg backdrop-blur-md shadow-sm z-20">
                        {formatTime(duration)}
                    </div>
                )}
            </div>

            {/* Caller Details */}
            <div className="flex flex-col items-center text-center w-full z-10">
                <h4 className="text-white font-black text-lg tracking-wide truncate w-full px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {lead?.name || 'Customer'}
                </h4>
                <p className="text-slate-400 font-medium text-xs tracking-wider mt-1 font-mono">
                    {lead?.phone ? lead.phone.split('_')[0] : 'Unknown Number'}
                </p>
            </div>

            {/* Controls */}
            {!isSaving && (
                <div className="flex items-center justify-center gap-3 w-full mt-2 z-10">
                    {status === 'CONNECTED' && (
                        <button 
                            onClick={toggleOutboundMute} 
                            className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all border ${
                                isMuted 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50' 
                                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                            {isMuted ? <FaMicrophoneSlash size={16} /> : <FaMicrophone size={16} />}
                            {isMuted ? 'Muted' : 'Mute'}
                        </button>
                    )}
                    
                    <button 
                        onClick={endOutboundCall} 
                        className={`h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-95 border border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] ${
                            status === 'CONNECTED' ? 'flex-1 bg-gradient-to-b from-red-500 to-red-600' : 'w-full bg-gradient-to-b from-red-500 to-red-600'
                        }`}
                    >
                        <FaPhoneSlash size={16} className="mb-0.5" /> 
                        End Call
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}

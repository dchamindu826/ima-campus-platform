import React from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhoneAlt, FaPhoneSlash } from 'react-icons/fa';

const GlobalCallPopup = () => {
    const { isRinging, incomingCall, answerCall, rejectCall } = useCall();

    if (!isRinging || !incomingCall) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center flex flex-col items-center">
                
                {/* Ringing Animation */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-emerald-500 text-white w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg">
                        <FaPhoneAlt className="animate-pulse" />
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-1">Incoming Call</h3>
                <p className="text-emerald-400 font-semibold text-lg mb-1">{incomingCall.leadName}</p>
                <p className="text-slate-400 text-sm mb-6 font-mono">{incomingCall.from}</p>

                <div className="flex items-center gap-6 w-full justify-center">
                    <button 
                        onClick={() => rejectCall(incomingCall.callId)}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="bg-red-500/20 text-red-500 group-hover:bg-red-500 group-hover:text-white w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-300">
                            <FaPhoneSlash />
                        </div>
                        <span className="text-slate-400 text-xs font-medium">Reject</span>
                    </button>

                    <button 
                        onClick={() => answerCall(incomingCall.callId, incomingCall.sdp, incomingCall)}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-300">
                            <FaPhoneAlt />
                        </div>
                        <span className="text-slate-400 text-xs font-medium">Answer</span>
                    </button>
                </div>
                
            </div>
        </div>
    );
};

export default GlobalCallPopup;

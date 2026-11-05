import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function GhostAuth() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const userEncoded = params.get('user'); 
        
        if (token && userEncoded) {
            try {
                // Token එක save කරනවා
                localStorage.setItem('token', token);
                
                // User data decode කරලා save කරනවා
                const userDecoded = decodeURIComponent(userEncoded);
                localStorage.setItem('user', userDecoded);
                
                // 🔥 පට්ටම වැදගත් කෑල්ල:
                // / වලට යවනවා වෙනුවට /login එකට යවන්න.
                // App.jsx එකේ logic එක නිසා එතනින් ඔයාව කෙලින්ම අදාල dashboard එකටම අරන් යනවා.
                setTimeout(() => {
                    window.location.href = '/login'; 
                }, 500);
                
            } catch (err) {
                console.error("Ghost Auth Error:", err);
                navigate('/login');
            }
        } else {
            navigate('/login');
        }
    }, [navigate, location]);

    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#0a0f1c]">
            <div className="relative flex justify-center items-center">
                <div className="absolute animate-ping w-20 h-20 bg-emerald-500 rounded-full opacity-20"></div>
                <div className="relative z-10 w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            </div>
            <h2 className="mt-6 text-xl font-bold text-emerald-400 animate-pulse">
                Accessing Dashboard...
            </h2>
        </div>
    );
}
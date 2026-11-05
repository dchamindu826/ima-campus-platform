import React, { useState } from 'react';
import { Bot, MessageSquare, X, Sparkles } from 'lucide-react';

export default function AIChatWidget() {
    const [isChatOpen, setIsChatOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {isChatOpen && (
                /* 🔥 Coming Soon Popup Card 🔥 */
                <div className="mb-4 w-[calc(100vw-3rem)] sm:w-[320px] bg-[#0a0f1c] rounded-[2rem] flex flex-col overflow-hidden animate-fade-in shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/20 p-6 md:p-8 text-center relative">
                    
                    <button onClick={() => setIsChatOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-800 hover:text-red-400 p-2 rounded-xl transition-colors">
                        <X size={18} strokeWidth={2.5}/>
                    </button>

                    <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-red-600/10 to-orange-500/20 rounded-[1.5rem] flex items-center justify-center border border-orange-500/20 mb-5 mt-2 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                        <Bot size={40} className="text-orange-400 drop-shadow-lg" />
                    </div>

                    <h3 className="text-xl font-black text-white mb-2 flex items-center justify-center gap-2">
                        <Sparkles size={20} className="text-yellow-400"/> Coming Soon
                    </h3>
                    
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                        Your intelligent AI Campus Assistant is currently in training. Get ready for a smarter way to learn!
                    </p>

                    <div className="bg-slate-800/50 border border-white/20 rounded-xl p-3 text-[11px] font-bold text-orange-400 uppercase tracking-widest shadow-inner">
                        Stay Tuned
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button 
                onClick={() => setIsChatOpen(!isChatOpen)} 
                className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center text-white hover:-translate-y-1 transition-all z-50"
            >
                {isChatOpen ? <X size={26} strokeWidth={2.5}/> : <MessageSquare size={26} strokeWidth={2.5}/>}
            </button>
        </div>
    );
}
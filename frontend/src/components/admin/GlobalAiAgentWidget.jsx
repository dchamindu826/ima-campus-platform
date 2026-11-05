import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/axios';
import { FaRobot, FaTimes, FaPaperPlane, FaSpinner, FaDatabase } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function GlobalAiAgentWidget({ loggedInUser, asModal, onClose }) {
    if (!loggedInUser || loggedInUser.role !== 'SYSTEM_ADMIN') return null;

    const [isOpen, setIsOpen] = useState(asModal ? true : false);
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([
        { role: 'model', text: 'Hello Admin! I am connected directly to your MySQL Database. Ask me anything about the system data!' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [history, isOpen, isLoading]);

    const handleClose = () => {
        if (asModal && onClose) onClose();
        else setIsOpen(false);
    };

    const handleSend = async () => {
        if (!message.trim() || isLoading) return;

        const userMsg = message.trim();
        setMessage('');
        const newHistory = [...history, { role: 'user', text: userMsg }];
        setHistory(newHistory);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await api.post('/admin/ai-agent/chat', 
                { message: userMsg, history: history.filter(h => h.role !== 'system') }
            );

            setHistory([...newHistory, { role: 'model', text: res.data.response }]);
        } catch (error) {
            console.error('AI Error:', error);
            setHistory([...newHistory, { role: 'model', text: '❌ Error: ' + (error.response?.data?.error || 'Failed to connect to AI Agent.') }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={asModal ? "" : "z-[9999]"}>
            {/* Floating Button */}
            {!asModal && !isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center animate-bounce"
                >
                    <FaRobot className="text-2xl" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                </button>
            )}

            {/* Chat Interface */}
            {isOpen && (
                <div className={asModal ? "fixed bottom-24 right-6 z-[9999] w-[450px] h-[40rem] max-h-[600px] bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up" : "fixed bottom-6 right-6 z-[9999] w-[450px] h-[40rem] max-h-[600px] bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up"}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <FaDatabase className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">System Admin AI</h3>
                                <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 
                                    Connected to Database
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                            <FaTimes className="text-xl" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {history.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                                    msg.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                                        : 'bg-[#1e293b] text-slate-200 rounded-bl-none shadow-md border border-white/5'
                                }`}>
                                <div className="prose prose-invert max-w-none prose-p:my-1 prose-pre:bg-black/50 prose-pre:my-1 prose-pre:border prose-pre:border-white/10 prose-strong:text-white">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[#1e293b] text-slate-200 rounded-2xl rounded-bl-none px-5 py-4 shadow-md border border-white/5 flex flex-col gap-3 min-w-[200px]">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                        <span className="text-xs font-semibold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                                            AI is thinking...
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <FaDatabase className="animate-pulse text-indigo-500/50" />
                                        <span className="animate-pulse">Querying system database</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-[#1e293b] border-t border-white/5">
                        <div className="relative flex items-center">
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about system data..."
                                className="w-full bg-[#0f172a] text-sm text-slate-200 placeholder-slate-500 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-white/5 resize-none h-[48px] custom-scrollbar"
                                rows="1"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!message.trim() || isLoading}
                                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <FaPaperPlane />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-[9px] text-slate-500 font-medium">✨ Powered by Gemini 3.5 Flash</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

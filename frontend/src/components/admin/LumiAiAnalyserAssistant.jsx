import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Bot, Send, X, Copy, Check, TrendingUp, RefreshCw, Brain, Building2, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

export default function LumiAiAnalyserAssistant({ isOpen, onClose, currentContext, businesses = [] }) {
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'forecast'
    const [selectedBizId, setSelectedBizId] = useState(currentContext.selectedBusiness?.id || 'ALL');
    const [selectedBatchId, setSelectedBatchId] = useState(currentContext.selectedBatch?.id || 'ALL');

    const [messages, setMessages] = useState([
        {
            role: 'model',
            text: `👋 **Hello! I am LUMI AI Executive Analyser.**\n\nI have loaded live operational intelligence for **${currentContext.selectedBusiness?.name || 'All Businesses'}** (${currentContext.selectedBatch?.name || 'All Batches'}).\n\n**Ask me anything regarding:**\n- 🎯 **Conversion Rates & Funnel Dropoff Diagnostics**\n- 👥 **Coordinator SLAs, Answer Rates & WhatsApp Outreach Compliance**\n- 🔮 **Predictive Forecasting for Upcoming Batches**\n- ⚠️ **Non-Enrolled Student Recovery & Retention Strategy**\n\nHow can I assist your executive strategy today?`
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loadingChat, setLoadingChat] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);

    // Forecasting Tab State
    const [forecastTargetBatch, setForecastTargetBatch] = useState('2027 SEPTEMBER Intake');
    const [forecastReport, setForecastReport] = useState('');
    const [loadingForecast, setLoadingForecast] = useState(false);

    const chatEndRef = useRef(null);

    // Broadcast state change to hide Global Tools Menu settings gear when open
    useEffect(() => {
        if (isOpen) {
            window.dispatchEvent(new CustomEvent('lumi-ai-state-change', { detail: { isOpen: true } }));
            document.body.classList.add('lumi-ai-open');
        } else {
            window.dispatchEvent(new CustomEvent('lumi-ai-state-change', { detail: { isOpen: false } }));
            document.body.classList.remove('lumi-ai-open');
        }

        return () => {
            window.dispatchEvent(new CustomEvent('lumi-ai-state-change', { detail: { isOpen: false } }));
            document.body.classList.remove('lumi-ai-open');
        };
    }, [isOpen]);

    useEffect(() => {
        if (currentContext.selectedBusiness?.id) {
            setSelectedBizId(currentContext.selectedBusiness.id);
        }
        if (currentContext.selectedBatch?.id) {
            setSelectedBatchId(currentContext.selectedBatch.id);
        }
    }, [currentContext]);

    useEffect(() => {
        if (isOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, activeTab]);

    if (!isOpen) return null;

    const handleSendMessage = async (textToSend = inputValue) => {
        const text = textToSend.trim();
        if (!text || loadingChat) return;

        const newMessages = [...messages, { role: 'user', text }];
        setMessages(newMessages);
        setInputValue('');
        setLoadingChat(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/lumi-ai-analyser/chat', {
                message: text,
                conversationHistory: messages.map(m => ({ role: m.role, text: m.text })),
                currentContext: {
                    ...currentContext,
                    selectedBusinessId: selectedBizId,
                    selectedBatchId: selectedBatchId
                }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.reply) {
                setMessages([...newMessages, { role: 'model', text: res.data.reply }]);
            } else {
                toast.error("No response received from LUMI AI");
            }
        } catch (error) {
            console.error("LUMI Chat Error:", error);
            setMessages([...newMessages, { role: 'model', text: "⚠️ **Error:** Unable to process analysis request. Please try again." }]);
        } finally {
            setLoadingChat(false);
        }
    };

    const handleGenerateForecast = async () => {
        if (loadingForecast) return;
        setLoadingForecast(true);
        setForecastReport('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/admin/lumi-ai-analyser/forecast', {
                businessId: selectedBizId !== 'ALL' ? selectedBizId : (currentContext.selectedBusiness?.id || 1),
                targetBatchName: forecastTargetBatch
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.report) {
                setForecastReport(res.data.report);
                toast.success("Predictive Forecast Report Generated!");
            }
        } catch (error) {
            console.error("Forecast Error:", error);
            toast.error("Failed to generate predictive forecast");
        } finally {
            setLoadingForecast(false);
        }
    };

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    // Clean English Prompt Chips
    const englishChips = [
        { label: "🔮 Future Batch Forecast", query: "Based on historical conversion and dropoff trends, provide a predictive forecast for our upcoming batch." },
        { label: "👥 Coordinator SLA Audit", query: "Audit all coordinators in this business: analyze answer rates, SLA response delays, and call volume distribution." },
        { label: "💬 WhatsApp Match Rate", query: "Analyze WhatsApp outreach: are coordinators messaging their assigned leads accurately, and what is the inbound response rate?" },
        { label: "⚠️ Non-Enrolled Recovery", query: "What is the non-enrolled dropout percentage and what exact step-by-step recovery plan should we execute?" },
        { label: "📊 Executive SWOT Summary", query: "Provide a comprehensive executive SWOT analysis of our current seminar, retention, and conversion metrics." }
    ];

    const currentBizObj = businesses.find(b => String(b.id) === String(selectedBizId)) || currentContext.selectedBusiness;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-3xl h-full bg-[#0B1120] border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden">
                
                {/* CLEAN EXECUTIVE TOP HEADER */}
                <div className="p-5 border-b border-slate-800 bg-[#0F172A] flex flex-col gap-3 shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                <Brain size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white tracking-tight">
                                    LUMI AI Analyser
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    Executive Intelligence & Predictive Strategy Engine
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Tab Switcher */}
                            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activeTab === 'chat' ? 'bg-blue-600 text-white font-black' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    💬 Strategy Chat
                                </button>
                                <button
                                    onClick={() => setActiveTab('forecast')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activeTab === 'forecast' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🔮 Batch Forecast
                                </button>
                            </div>

                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Business & Batch Selector Bar */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 flex-1 min-w-[200px]">
                            <Building2 size={15} className="text-slate-400 shrink-0" />
                            <select
                                value={selectedBizId}
                                onChange={(e) => {
                                    setSelectedBizId(e.target.value);
                                    setSelectedBatchId('ALL');
                                }}
                                className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer w-full"
                            >
                                <option value="ALL" className="bg-slate-900 text-white">🏢 All Business Units (Enterprise Overview)</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {currentBizObj && currentBizObj.batches?.length > 0 && (
                            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5">
                                <Layers size={15} className="text-blue-400 shrink-0" />
                                <select
                                    value={selectedBatchId}
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-blue-300 outline-none cursor-pointer max-w-[170px] truncate"
                                >
                                    <option value="ALL" className="bg-slate-900 text-white">All Active Batches</option>
                                    {currentBizObj.batches.map(b => (
                                        <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* TAB 1: CONVERSATIONAL CHAT */}
                {activeTab === 'chat' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        
                        {/* Quick Prompts Bar */}
                        <div className="p-3 bg-[#0D1527] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
                            <span className="text-[11px] font-black uppercase text-slate-400 shrink-0 flex items-center gap-1">
                                <Sparkles size={13} className="text-blue-400" /> Prompts:
                            </span>
                            {englishChips.map((chip, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSendMessage(chip.query)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-blue-500/50 transition-all shrink-0 cursor-pointer"
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        {/* Messages Stream */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            {messages.map((m, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {m.role === 'model' && (
                                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                                            <Bot size={16} />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                                            m.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                                                : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none prose prose-invert max-w-none'
                                        }`}
                                    >
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {m.text}
                                        </ReactMarkdown>

                                        {m.role === 'model' && (
                                            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-end">
                                                <button
                                                    onClick={() => copyToClipboard(m.text, idx)}
                                                    className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    {copiedIndex === idx ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                    {copiedIndex === idx ? 'Copied' : 'Copy'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loadingChat && (
                                <div className="flex items-center gap-3.5">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 animate-spin">
                                        <RefreshCw size={16} />
                                    </div>
                                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                        <span className="text-xs font-bold text-slate-300">LUMI is compiling comprehensive data intelligence...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* CHAT INPUT FORM */}
                        <div className="p-4 bg-[#0F172A] border-t border-slate-800 shrink-0">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendMessage();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ask LUMI anything in English (e.g. What is our conversion rate and dropout recovery plan?)..."
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || loadingChat}
                                    className="px-5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
                                >
                                    <Send size={16} />
                                    <span className="hidden sm:inline">Ask AI</span>
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* TAB 2: FUTURE BATCH PREDICTIVE FORECAST GENERATOR */}
                {activeTab === 'forecast' && (
                    <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
                        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Automated Batch Predictive Forecast Engine</h4>
                                    <p className="text-xs text-slate-400">Generates probabilistic forecasts and capacity modeling based on historical conversion curves.</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                <div className="flex-1">
                                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">Target Upcoming Intake</label>
                                    <input
                                        type="text"
                                        value={forecastTargetBatch}
                                        onChange={(e) => setForecastTargetBatch(e.target.value)}
                                        placeholder="e.g. 2027 SEPTEMBER Intake - Art Stream"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-medium text-white outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <button
                                    onClick={handleGenerateForecast}
                                    disabled={loadingForecast}
                                    className="sm:mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 transition-all"
                                >
                                    {loadingForecast ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                    <span>{loadingForecast ? 'Computing Forecast...' : 'Generate AI Forecast'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Forecast Report Viewer */}
                        <div className="flex-1 overflow-y-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-6 custom-scrollbar">
                            {loadingForecast ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                                    <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-xs font-bold text-slate-300">LUMI is simulating conversion probabilities and retention curves...</p>
                                </div>
                            ) : forecastReport ? (
                                <div className="prose prose-invert max-w-none text-sm space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                        <span className="text-xs font-bold text-indigo-400">✨ Predictive Strategy Report Ready</span>
                                        <button
                                            onClick={() => copyToClipboard(forecastReport, 999)}
                                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            {copiedIndex === 999 ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                            <span>{copiedIndex === 999 ? 'Copied' : 'Copy Report'}</span>
                                        </button>
                                    </div>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {forecastReport}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-slate-400 space-y-2">
                                    <Brain size={40} className="mx-auto text-slate-600 mb-2" />
                                    <h5 className="font-bold text-slate-300 text-sm">No Forecast Generated Yet</h5>
                                    <p className="text-xs max-w-md mx-auto text-slate-500">Enter your target intake and click "Generate AI Forecast" to receive actionable conversion and capacity intelligence.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

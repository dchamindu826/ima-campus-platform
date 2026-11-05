import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { MessageSquare, Bot, Key, UploadCloud, Trash2, Edit2, PlusCircle, Server, Save, FileText, Archive, Users, Power, Loader2, Globe, ShieldCheck, Copy, RefreshCw, ClipboardCheck, XCircle } from 'lucide-react';

export default function CrmManagement() {
    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState('');
    const [activeTab, setActiveTab] = useState('FREE_SEMINAR'); // FREE_SEMINAR or AFTER_SEMINAR
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Meta OTP Verification State
    const [metaOtps, setMetaOtps] = useState([]);
    const [refreshingOtps, setRefreshingOtps] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    // API Setup & Bot State
    const [metaKey, setMetaKey] = useState('');
    const [waId, setWaId] = useState('');
    const [waNumId, setWaNumId] = useState('');
    const [geminiKeys, setGeminiKeys] = useState(['', '', '', '', '']);
    const [botMode, setBotMode] = useState('OFF'); // OFF, AI_ONLY, AUTO_REPLY_ONLY, BOTH
    const [openSemActive, setOpenSemActive] = useState(false);
    const [allocatedBatch, setAllocatedBatch] = useState('');
    const [welcomeMessageText, setWelcomeMessageText] = useState('');
    const [btnAllowText, setBtnAllowText] = useState('');
    const [btnStopText, setBtnStopText] = useState('');

    // Auto Reply State
    const [replies, setReplies] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [stepOrder, setStepOrder] = useState(1);
    const [attachment, setAttachment] = useState(null);
    const [editingReplyId, setEditingReplyId] = useState(null);

    // Knowledge Base State
    const [pdfFile, setPdfFile] = useState(null);

    useEffect(() => {
        fetchBusinesses();
    }, []);

    useEffect(() => {
        if (selectedBusiness) {
            if (activeTab === 'META_OTP') {
                fetchMetaOtps();
            } else {
                fetchBatches();
                fetchSettings();
                fetchReplies();
            }
        }
    }, [selectedBusiness, activeTab]);

    const fetchMetaOtps = async () => {
        setRefreshingOtps(true);
        try {
            const res = await axios.get('/admin/crm/meta-otps');
            setMetaOtps(res.data || []);
        } catch (error) {
            console.error("Failed to load Meta OTPs", error);
            toast.error("Failed to load verification codes");
        } finally {
            setRefreshingOtps(false);
        }
    };

    const copyToClipboard = (text, id) => {
        // Extract exact digits if the body contains a confirmation code
        let otpCode = text;
        const match = text.match(/\b\d{5,6}\b/);
        if (match) otpCode = match[0];
        
        navigator.clipboard.writeText(otpCode);
        setCopiedId(id);
        toast.success(`Copied: ${otpCode}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/admin/businesses');
            setBusinesses(res.data);
            if(res.data.length > 0) setSelectedBusiness(res.data[0].id.toString());
        } catch (error) { toast.error("Failed to load businesses"); }
    };

    const fetchBatches = async () => {
        try {
            const res = await axios.get(`/admin/batches/${selectedBusiness}`);
            setBatches(res.data.batches || res.data || []);
        } catch (error) { console.error("Batches load error"); }
    };

    const fetchSettings = async () => {
        setLoading(true);
        try {
            // 🔥 UPDATE: අගට ?t=${new Date().getTime()} එකතු කරලා තියෙනවා පරණ ඩේටා cache වෙන එක නවත්තන්න.
            const res = await axios.get(`/admin/crm/settings/${selectedBusiness}/${activeTab}?t=${new Date().getTime()}`);
            
            if (res.data && res.data.id) {
                setMetaKey(res.data.metaApiKey || '');
                setWaId(res.data.waId || '');
                setWaNumId(res.data.waNumId || '');
                setGeminiKeys(res.data.geminiKeys || ['', '', '', '', '']);
                setBotMode(res.data.botMode || 'OFF');
                setOpenSemActive(res.data.openSemActive || false);
                setAllocatedBatch(res.data.batchId || '');
                setWelcomeMessageText(res.data.welcomeMessageText || '');
                setBtnAllowText(res.data.btnAllowText || '');
                setBtnStopText(res.data.btnStopText || '');
            } else {
                resetSettingsState();
            }
        } catch (error) { 
            console.error("Settings load error", error); 
            resetSettingsState();
        } finally {
            setLoading(false);
        }
    };

    const resetSettingsState = () => {
        setMetaKey(''); setWaId(''); setWaNumId(''); 
        setGeminiKeys(['', '', '', '', '']); setBotMode('OFF'); setOpenSemActive(false); setAllocatedBatch('');
        setWelcomeMessageText(''); setBtnAllowText(''); setBtnStopText('');
    };

    const saveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.post('/admin/crm/settings', {
                businessId: selectedBusiness,
                campaignType: activeTab,
                metaApiKey: metaKey, 
                waId, 
                waNumId, 
                geminiKeys, 
                botMode, 
                openSemActive,
                welcomeMessageText,
                btnAllowText,
                btnStopText,
                batchId: activeTab === 'FREE_SEMINAR' ? allocatedBatch : null // After Seminar එකේදි Batch එක Null කරනවා
            });
            toast.success(`${activeTab.replace('_', ' ')} Settings Saved Successfully!`);
            fetchSettings(); // Refresh to confirm save
        } catch (error) { 
            toast.error("Failed to save. Did you push Prisma DB?"); 
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const fetchReplies = async () => {
        try {
            const res = await axios.get(`/admin/crm/auto-reply?businessId=${selectedBusiness}&campaignType=${activeTab}`);
            setReplies(res.data);
            setStepOrder(res.data.length + 1); 
        } catch (error) { console.error("Failed to load replies"); }
    };

    const handleAddReply = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        // 🔥 FIX: Ensure businessId is correctly passed
        formData.append('businessId', selectedBusiness);
        formData.append('campaignType', activeTab);
        formData.append('stepOrder', stepOrder);
        formData.append('message', newMessage);
        if (attachment) formData.append('attachment', attachment);

        try {
            if (editingReplyId) {
                await axios.put(`/admin/crm/auto-reply/${editingReplyId}`, formData);
                toast.success("Auto Reply Step Updated!");
            } else {
                await axios.post('/admin/crm/auto-reply', formData);
                toast.success("Auto Reply Step Added!");
            }
            setNewMessage(''); setAttachment(null); setEditingReplyId(null);
            fetchReplies();
        } catch (error) { toast.error(editingReplyId ? "Failed to update reply" : "Failed to add reply"); }
    };

    const handleEditReply = (reply) => {
        setEditingReplyId(reply.id);
        setStepOrder(reply.stepOrder);
        setNewMessage(reply.message);
        setAttachment(null);
        // Scroll to the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingReplyId(null);
        setNewMessage('');
        setAttachment(null);
        setStepOrder(replies.length + 1);
    };

    const deleteReply = async (id) => {
        if(!window.confirm("Delete this auto reply?")) return;
        try {
            await axios.delete(`/admin/crm/auto-reply/${id}`);
            toast.success("Deleted!");
            fetchReplies();
        } catch (error) { toast.error("Failed to delete"); }
    };

    const handleUploadPDF = async (e) => {
        e.preventDefault();
        if(!pdfFile) return toast.error("Select a PDF file");
        const fd = new FormData();
        fd.append('businessId', selectedBusiness);
        fd.append('pdfFile', pdfFile);
        try {
            await axios.post('/admin/crm/knowledge-base', fd);
            toast.success("Knowledge Base Updated! AI is trained.");
            setPdfFile(null);
        } catch (error) { toast.error("Failed to upload PDF"); }
    };

    const handleArchive = async () => {
        if(!window.confirm(`Are you sure you want to ARCHIVE the ${activeTab.replace('_', ' ')} campaign for the current batch?`)) return;
        try {
            await axios.post('/admin/crm/archive', { businessId: selectedBusiness, campaignType: activeTab, batchId: allocatedBatch });
            toast.success("Campaign Archived Successfully!");
            fetchSettings();
        } catch (error) { toast.error("Archive Failed"); }
    };


    return (
        <div className="w-full animate-fade-in text-slate-200 pb-10">
            <div className="flex items-center gap-4 mb-8 bg-slate-800/40 p-6 rounded-3xl border border-white/10 shadow-lg backdrop-blur-xl">
                <Server className="text-emerald-500" size={32}/>
                <div>
                    <h2 className="text-3xl font-bold text-white">CRM & AI Campaigns</h2>
                    <p className="text-slate-400 text-sm">Manage WhatsApp APIs, Auto Replies, and AI Knowledge Base per campaign.</p>
                </div>
            </div>

            {/* Business Selector */}
            <div className="mb-6 bg-black/20 p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest shrink-0">Select Business:</label>
                <select value={selectedBusiness} onChange={e => setSelectedBusiness(e.target.value)} className="flex-1 max-w-sm bg-slate-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 font-bold">
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* Campaign Tabs */}
            <div className="flex gap-3 mb-6 border-b border-white/10 pb-4">
                <button onClick={() => setActiveTab('FREE_SEMINAR')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'FREE_SEMINAR' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                    <MessageSquare size={18}/> Free Seminar Setup
                </button>
                <button onClick={() => setActiveTab('AFTER_SEMINAR')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'AFTER_SEMINAR' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                    <Globe size={18}/> After Seminar (Global Help)
                </button>
                <button onClick={() => setActiveTab('META_OTP')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'META_OTP' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                    <ShieldCheck size={18}/> Meta Verification Codes (OTP)
                </button>
            </div>

            {activeTab === 'META_OTP' ? (
                <div className="bg-slate-800/40 p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-lg backdrop-blur-xl space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-6">
                        <div>
                            <h3 className="text-xl font-extrabold text-white flex items-center gap-3"><ShieldCheck className="text-purple-400" size={24}/> Recent Meta OTP Logs</h3>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Verification codes received from Facebook/Meta on your active CRM WhatsApp numbers.</p>
                        </div>
                        <button onClick={fetchMetaOtps} disabled={refreshingOtps} className="bg-purple-600/90 hover:bg-purple-600 text-white font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 outline-none border border-transparent shadow-[0_4px_15px_rgba(147,51,234,0.4)] self-start transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <RefreshCw size={14} className={refreshingOtps ? "animate-spin" : ""}/>
                            {refreshingOtps ? "Refreshing..." : "Refresh Codes"}
                        </button>
                    </div>

                    {refreshingOtps && metaOtps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-purple-500" size={44}/>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Fetching latest OTPs...</span>
                        </div>
                    ) : metaOtps.length === 0 ? (
                        <div className="text-center py-20 bg-black/20 rounded-2xl border border-white/5 shadow-inner">
                            <ShieldCheck className="text-slate-600 mx-auto mb-4" size={48}/>
                            <p className="text-slate-400 font-extrabold text-lg">No verification codes intercepted yet.</p>
                            <p className="text-xs text-slate-500 mt-2">When Meta sends an OTP to your CRM numbers, it will instantly show up here.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {metaOtps.map((otp) => {
                                let codeVal = "OTP";
                                const codeMatch = (otp.message || '').match(/\b\d{5,6}\b/);
                                if (codeMatch) codeVal = codeMatch[0];
                                
                                return (
                                    <div key={otp.id} className="group bg-black/40 hover:bg-[#0c0f1e]/80 border border-white/5 hover:border-purple-500/30 p-6 rounded-2xl flex flex-col justify-between gap-5 transition-all shadow-inner hover:shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 pointer-events-none rounded-full bg-purple-500 transition-all group-hover:opacity-20"></div>
                                        
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md mb-2.5 inline-block">Sender: Meta</span>
                                                <h4 className="text-[13px] font-bold text-slate-200 line-clamp-2 leading-relaxed" title={otp.message}>{otp.message}</h4>
                                            </div>
                                            
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className="text-[11px] font-black text-purple-400 uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span> OTP
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">{new Date(otp.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Target CRM Num</span>
                                                <span className="text-xs font-black text-slate-300 tracking-wider">
                                                    {otp.errorMsg ? `+${otp.errorMsg}` : "Global Setup"}
                                                </span>
                                            </div>

                                            <button onClick={() => copyToClipboard(otp.message, otp.id)} className="bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white px-4 py-2.5 rounded-xl border border-purple-500/20 hover:border-purple-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm shrink-0 outline-none">
                                                {copiedId === otp.id ? (
                                                    <>
                                                        <ClipboardCheck size={14} className="text-emerald-400"/>
                                                        <span className="text-emerald-400">Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={14}/>
                                                        <span>Copy: <span className="text-white ml-0.5 tracking-wider font-extrabold">{codeVal}</span></span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    {/* LEFT COLUMN: Settings & AI Config */}
                    <div className="space-y-6">
                        
                        {/* 🔥 Conditional Batch Allocation 🔥 */}
                        {activeTab === 'FREE_SEMINAR' ? (
                            <div className="bg-slate-800/40 p-6 rounded-3xl border border-emerald-500/20">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="text-emerald-400"/> Allocate Batch</h3>
                                    <div className="flex items-center gap-2">

                                        {allocatedBatch && (
                                            <button onClick={handleArchive} className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border border-red-500/30">
                                                <Archive size={14}/> Archive Campaign
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <select value={allocatedBatch} onChange={e => setAllocatedBatch(e.target.value)} className="w-full bg-black/30 border border-emerald-500/30 rounded-xl p-3 text-white outline-none focus:border-emerald-500">
                                    <option value="">-- Unassigned (Select a Batch) --</option>
                                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <p className="text-xs text-slate-500 mt-2">Select which specific batch this Free Seminar is targeted at.</p>
                            </div>
                        ) : (
                            <div className="bg-blue-900/10 p-6 rounded-3xl border border-blue-500/20">
                                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2"><Globe size={20}/> Global Help Center</h3>
                                <p className="text-sm text-blue-300/80 mt-2">This channel handles general inquiries for the entire business. No specific batch allocation is required.</p>
                            </div>
                        )}

                        {/* API Keys */}
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Key className="text-emerald-400"/> WhatsApp API Config</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">Meta API Key</label>
                                    <input type="text" value={metaKey} onChange={e=>setMetaKey(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">WhatsApp ID</label>
                                        <input type="text" value={waId} onChange={e=>setWaId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">Phone Num ID</label>
                                        <input type="text" value={waNumId} onChange={e=>setWaNumId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Welcome Message & Interactive Buttons */}
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><MessageSquare className="text-emerald-400"/> Welcome Message & Anti-Ban Buttons</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">Initial Welcome Message (With Buttons)</label>
                                    <textarea value={welcomeMessageText} onChange={e=>setWelcomeMessageText(e.target.value)} rows="3" placeholder="Welcome! Do you want details?" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">Allow Button Text (Max 20)</label>
                                        <input type="text" value={btnAllowText} onChange={e=>setBtnAllowText(e.target.value)} placeholder="Yes, send details" maxLength={20} className="w-full bg-black/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 font-bold text-sm outline-none focus:border-emerald-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-widest">Stop Button Text (Max 20)</label>
                                        <input type="text" value={btnStopText} onChange={e=>setBtnStopText(e.target.value)} placeholder="No, stop" maxLength={20} className="w-full bg-black/30 border border-red-500/30 rounded-xl p-3 text-red-300 font-bold text-sm outline-none focus:border-red-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed mt-2">
                                    * When a student messages via FB Boost, this message is sent first. If they click Allow, the sequence continues. If they click Stop, they are unsubscribed and no further messages are sent.
                                </p>
                            </div>
                        </div>

                        {/* Bot Mode & AI Keys */}
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bot className="text-purple-400"/> AI & Bot Mode</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {['OFF', 'AI_ONLY', 'AUTO_REPLY_ONLY', 'BOTH'].map(mode => (
                                    <button key={mode} onClick={(e) => { e.preventDefault(); setBotMode(mode); }} className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-2 transition-all ${botMode === mode ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/30'}`}>
                                        <Power size={18} className={botMode === mode ? 'text-purple-400' : 'text-slate-500'}/>
                                        {mode.replace('_ONLY', '').replace('_', ' ')}
                                    </button>
                                ))}
                            </div>

                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Gemini API Keys (Load Balancer)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                {geminiKeys.map((key, idx) => (
                                    <input key={idx} type="text" value={key} onChange={e => {
                                        const newKeys = [...geminiKeys]; newKeys[idx] = e.target.value; setGeminiKeys(newKeys);
                                    }} className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white text-sm" placeholder={`Key ${idx + 1}`} />
                                ))}
                            </div>

                            <button onClick={saveSettings} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-70">
                                {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                                Save {activeTab.replace('_', ' ')} Configs
                            </button>
                        </div>

                        {/* AI PDF Upload */}
                        <div className="bg-purple-900/10 border border-purple-500/20 p-6 rounded-3xl">
                            <h3 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-2"><FileText size={20}/> Train AI Agent (PDF)</h3>
                            <p className="text-xs text-purple-300/60 mb-4">Upload Course outlines, time tables, or FAQs to make the AI smarter.</p>
                            <form onSubmit={handleUploadPDF} className="flex gap-3">
                                <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} required className="flex-1 bg-black/40 border border-purple-500/30 rounded-xl p-2 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-300" />
                                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg"><UploadCloud size={18}/></button>
                            </form>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Auto Reply Flow */}
                    <div className="space-y-6">
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><PlusCircle className="text-emerald-400"/> Build Auto-Reply Sequence</h3>
                            <form onSubmit={handleAddReply} className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="w-24 shrink-0">
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Step #</label>
                                        <input type="number" min="1" value={stepOrder} onChange={e=>setStepOrder(e.target.value)} required className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-center font-bold" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Attachment</label>
                                        <input type="file" onChange={e => setAttachment(e.target.files[0])} className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-white text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:text-emerald-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Message Text</label>
                                    <textarea rows="4" value={newMessage} onChange={e=>setNewMessage(e.target.value)} required={!attachment} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 custom-scrollbar" placeholder="Type message..."></textarea>
                                </div>
                                <div className="flex gap-3">
                                    <button type="submit" className={`flex-1 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 ${editingReplyId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                        {editingReplyId ? <Edit2 size={18}/> : <PlusCircle size={18}/>} 
                                        {editingReplyId ? "Update Step" : "Add Step"}
                                    </button>
                                    {editingReplyId && (
                                        <button type="button" onClick={cancelEdit} className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                            <XCircle size={18}/> Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Sequence Preview */}
                        <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Active Sequence</h3>
                            <div className="space-y-4 relative">
                                {replies.length === 0 ? (
                                    <p className="text-slate-500 text-sm italic text-center py-10">No replies configured.</p>
                                ) : replies.map((reply, idx) => (
                                    <div key={reply.id} className="relative bg-white/5 border border-white/10 p-5 rounded-2xl flex items-start gap-4 group hover:border-white/20 transition-all z-10">
                                        <div className="w-10 h-10 shrink-0 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-xl font-black text-lg border border-emerald-500/20">
                                            {reply.stepOrder}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-200 whitespace-pre-wrap text-sm mb-2">{reply.message}</p>
                                            {reply.attachment && (
                                                <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg border border-blue-500/20 inline-flex items-center gap-1.5">
                                                    <FileText size={12}/> {reply.attachmentType} Attached
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handleEditReply(reply)} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white p-2.5 rounded-xl transition-colors" title="Edit Step">
                                                <Edit2 size={18}/>
                                            </button>
                                            <button onClick={() => deleteReply(reply.id)} className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors" title="Delete Step">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                        
                                        {/* Connector Line */}
                                        {idx !== replies.length - 1 && (
                                            <div className="absolute left-[39px] top-14 bottom-[-20px] w-0.5 bg-white/10 -z-10"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from '../../../api/axios';
import { 
    MessageCircle, X, Send, Paperclip, CheckCircle, ShieldAlert, Reply, 
    Mic, StopCircle, Music, Image as ImageIcon, FileText,
    GraduationCap, Lock, Sparkles, HelpCircle, BookOpen, ChevronRight, CheckCircle2
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const WebInquiryWidget = ({ businesses, setActiveTab }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [inquiry, setInquiry] = useState(null); 
    const [messages, setMessages] = useState([]);
    
    // Pre-chat form states
    const [preChatTab, setPreChatTab] = useState('paper_guiders'); // 'paper_guiders' | 'support'
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [unreadBusinesses, setUnreadBusinesses] = useState({}); 

    // Paper Guider states
    const [isEnrolledInPaperClass, setIsEnrolledInPaperClass] = useState(false);
    const [paperClasses, setPaperClasses] = useState([]);
    const [selectedPaperClassId, setSelectedPaperClassId] = useState('');
    const [guiderInquiryType, setGuiderInquiryType] = useState('QUESTION_DOUBT');
    const [guiderInitialNote, setGuiderInitialNote] = useState('');
    const [guiderSessionMeta, setGuiderSessionMeta] = useState(null);
    const [isCheckingEnrollment, setIsCheckingEnrollment] = useState(true);
    
    // Chat states
    const [inputMsg, setInputMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Voice Recording
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const timerRef = useRef(null);
    const audioChunks = useRef([]);
    
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    
    // Refs for socket closures
    const isOpenRef = useRef(isOpen);
    const inquiryRef = useRef(inquiry);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        inquiryRef.current = inquiry;
    }, [inquiry]);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    // Check student paper class eligibility
    useEffect(() => {
        setIsCheckingEnrollment(true);
        axios.get('/papers/student/paper-classes')
            .then(res => {
                if (res.data?.success) {
                    const enrolled = !!res.data.isEnrolledInPaperClass;
                    setIsEnrolledInPaperClass(enrolled);
                    setPaperClasses(res.data.paperClasses || []);
                    if (res.data.paperClasses?.length > 0) {
                        setSelectedPaperClassId(String(res.data.paperClasses[0].id));
                    }
                    if (!enrolled) {
                        setPreChatTab('support');
                    }
                }
            })
            .catch(err => {
                console.error("Paper classes access check error:", err);
            })
            .finally(() => {
                setIsCheckingEnrollment(false);
            });
    }, []);

    // Listen for custom trigger from StudentOverview or other tabs
    useEffect(() => {
        const handleOpenGuiderEvent = (e) => {
            const { paperId, testTitle, courseId, batchId, className } = e.detail || {};
            setIsOpen(true);
            setPreChatTab('paper_guiders');
            if (courseId || testTitle) {
                const selectedClass = paperClasses.find(c => String(c.id) === String(courseId)) || paperClasses[0];
                const bizId = selectedClass?.businessId || (businesses && businesses[0]?.id) || 1;
                const cId = courseId || (selectedClass?.id !== 0 ? selectedClass?.id : null);
                const titleStr = testTitle ? `Regarding "${testTitle}"` : (className ? `Class: ${className}` : 'Paper Consultation');
                startInquiry(bizId, cId, `[📝 Paper Guider Desk] ${titleStr}`, true);
            }
        };
        window.addEventListener('open-paper-guider-chat', handleOpenGuiderEvent);
        return () => window.removeEventListener('open-paper-guider-chat', handleOpenGuiderEvent);
    }, [paperClasses, businesses]);

    useEffect(() => {
        axios.get('/web-inquiry/my-inquiries')
            .then(res => {
                if (res.data.success && res.data.inquiries) {
                    let total = 0;
                    const businessCounts = {};
                    res.data.inquiries.forEach(inq => {
                        if (inq.studentUnreadCount > 0) {
                            total += inq.studentUnreadCount;
                            businessCounts[inq.businessId] = (businessCounts[inq.businessId] || 0) + inq.studentUnreadCount;
                        }
                    });
                    setUnreadTotal(total);
                    setUnreadBusinesses(businessCounts);
                    
                    if (total > 0) {
                        toast((t) => (
                            <div className="flex flex-col gap-1 cursor-pointer" onClick={() => { setIsOpen(true); toast.dismiss(t.id); }}>
                                <span className="font-bold text-[#00a884] flex items-center gap-2"><MessageCircle size={16}/> You have {total} unread support message{total > 1 ? 's' : ''}!</span>
                                <span className="text-xs text-gray-600">Click here or the support button to view.</span>
                            </div>
                        ), { duration: 6000, position: 'top-right', id: 'unread-toast' });
                    }
                }
            }).catch(e => {});
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token') || localStorage.getItem('userToken');
        if (!token) return;

        socketRef.current = io(axios.defaults.baseURL.replace('/api', ''), {
            auth: { token }
        });

        socketRef.current.on('new_web_inquiry_message', (msg) => {
            const currentInquiry = inquiryRef.current;
            const currentIsOpen = isOpenRef.current;

            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                if (currentInquiry && currentInquiry.id === msg.inquiryId && currentIsOpen) {
                    if (msg.direction === 'outbound') {
                        axios.post('/web-inquiry/student-mark-read', { inquiryId: currentInquiry.id }).catch(e => {});
                    }
                    return [...prev, msg];
                }
                return prev; 
            });
        });

        socketRef.current.on('web_inquiry_student_notification', (data) => {
            const currentInquiry = inquiryRef.current;
            const currentIsOpen = isOpenRef.current;
            
            if (!currentIsOpen || !currentInquiry || currentInquiry.id !== data.inquiryId) {
                setUnreadTotal(prev => prev + 1);
                setUnreadBusinesses(prev => ({
                    ...prev,
                    [data.businessId]: (prev[data.businessId] || 0) + 1
                }));
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (inquiry && socketRef.current) {
            socketRef.current.emit('join_web_inquiry_room', { inquiryId: inquiry.id });
            setUnreadTotal(prev => Math.max(0, prev - (unreadBusinesses[inquiry.businessId] || 0)));
            setUnreadBusinesses(prev => ({ ...prev, [inquiry.businessId]: 0 }));
            axios.post('/web-inquiry/student-mark-read', { inquiryId: inquiry.id }).catch(e => {});
        }
    }, [inquiry]);

    useEffect(() => {
        const chatB = searchParams.get('chat_b');
        if (chatB && businesses && businesses.length > 0) {
            setIsOpen(true);
            setTimeout(() => {
                startInquiry(chatB, null);
                searchParams.delete('chat_b');
                setSearchParams(searchParams, { replace: true });
            }, 500);
        }
    }, [businesses]);

    const startInquiry = async (directBizId = null, directCourseId = null, initialNoteText = null, isGuider = false) => {
        const bId = directBizId || (businesses && businesses[0]?.id) || 1;
        const cId = directCourseId || selectedCourseId;
        if (!bId) {
            toast.error("Please select an institution / business");
            return;
        }

        try {
            const res = await axios.post('/web-inquiry/start', { businessId: bId, courseId: cId });
            if (res.data.success) {
                setInquiry(res.data.inquiry);
                setMessages(res.data.inquiry?.messages || res.data.messages || []);
                if (isGuider) {
                    setGuiderSessionMeta({
                        courseId: cId,
                        isPaperGuider: true
                    });
                } else {
                    setGuiderSessionMeta(null);
                }

                // If an initial intro message was provided, auto-send it
                if (initialNoteText && socketRef.current) {
                    socketRef.current.emit('send_web_inquiry_message', {
                        inquiryId: res.data.inquiry.id,
                        businessId: bId,
                        message: initialNoteText,
                        mediaUrl: null,
                        mediaType: null,
                        replyToId: null
                    });
                }
            }
        } catch (error) {
            console.error("Failed to start chat:", error);
            toast.error("Failed to start chat session");
        }
    };

    const handleStartPaperGuiderChat = async (classObj = null) => {
        if (!isEnrolledInPaperClass) {
            toast.error("Paper Guider Chat is exclusive to Paper Class students.");
            return;
        }

        const selectedClass = classObj || paperClasses.find(c => String(c.id) === String(selectedPaperClassId)) || paperClasses[0];
        const bizId = selectedClass?.businessId || (businesses && businesses[0]?.id) || 1;
        const courseId = selectedClass?.id !== 0 ? selectedClass?.id : null;
        const classNameStr = selectedClass?.name || 'Paper Class';

        await startInquiry(bizId, courseId, `[📝 Paper Guider Desk] Class: ${classNameStr}`, true);
        toast.success(`Connected to Paper Guider Desk for ${classNameStr}!`, { icon: '🎓' });
    };


    // --- Voice Recording ---
    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast.error("Microphone is blocked or unsupported in this browser.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
            else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' }; 
            
            const recorder = new MediaRecorder(stream, options);
            audioChunks.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            recorder.onstop = () => {
                const currentMimeType = recorder.mimeType || 'audio/webm';
                const ext = currentMimeType.includes('mp4') ? 'mp4' : 'webm';
                const audioBlob = new Blob(audioChunks.current, { type: currentMimeType });
                const audioFile = new File([audioBlob], `Voice_Note_${Date.now()}.${ext}`, { type: currentMimeType });
                setSelectedFile(audioFile); 
            };

            recorder.start(1000);
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        } catch (err) {
            toast.error("Microphone access denied!");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(timerRef.current);
        setIsRecording(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if ((!inputMsg.trim() && !selectedFile) || !inquiry || !socketRef.current) return;
        
        setIsUploading(true);
        let mediaUrl = null;
        let mediaType = null;

        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const toastId = toast.loading('Sending...');
            try {
                const res = await axios.post('/web-inquiry/upload', formData);
                mediaUrl = res.data.fileUrl;
                if (selectedFile.type.startsWith('image/')) mediaType = 'image';
                else if (selectedFile.type.startsWith('audio/')) mediaType = 'audio';
                else if (selectedFile.type.startsWith('video/')) mediaType = 'video';
                else mediaType = 'document';
                toast.success('Sent', { id: toastId });
            } catch (err) {
                toast.error('Upload failed', { id: toastId });
                setIsUploading(false);
                return;
            }
        }

        socketRef.current.emit('send_web_inquiry_message', {
            inquiryId: inquiry.id,
            businessId: inquiry.businessId,
            message: inputMsg.trim(),
            mediaUrl,
            mediaType,
            replyToId: replyToMessage?.id || null
        });
        
        setInputMsg('');
        setReplyToMessage(null);
        setSelectedFile(null);
        setIsUploading(false);
    };

    const backendBaseUrl = axios.defaults.baseURL.replace('/api', '');

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 md:bottom-24 z-50 text-white rounded-full p-3.5 sm:px-4 sm:py-3.5 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2.5 ${
                    unreadTotal > 0 
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 animate-pulse ring-4 ring-red-400/30' 
                        : 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:shadow-[0_0_25px_rgba(14,165,233,0.6)] ring-2 ring-sky-300/40'
                }`}
                title="LUMI Chat & Paper Guider Desk"
            >
                <div className="relative flex items-center justify-center">
                    <MessageCircle size={24} className="text-white drop-shadow" />
                    <Sparkles size={12} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
                    {unreadTotal > 0 && (
                        <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce border-2 border-white shadow-md">
                            {unreadTotal}
                        </span>
                    )}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-tight">
                    <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1 text-white">
                        LUMI Chat
                    </span>
                    <span className="text-[10px] text-sky-100 font-medium opacity-90">
                        {isEnrolledInPaperClass ? 'Paper Guiders & Help' : 'Campus Support'}
                    </span>
                </div>
            </button>
        );
    }

    // Find current business info for Header
    const currentBiz = inquiry ? businesses.find(b => b.id === inquiry.businessId) : null;
    const isGuiderChatMode = !!guiderSessionMeta;

    return (
        <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 md:bottom-24 z-50 w-[calc(100vw-24px)] max-w-[400px] h-[580px] max-h-[88vh] flex flex-col bg-[#efeae2] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-white/20">
            {/* Header */}
            <div className={`px-4 py-3.5 text-white flex items-center justify-between shrink-0 z-10 shadow-md relative transition-all ${
                isGuiderChatMode
                    ? 'bg-gradient-to-r from-sky-700 via-blue-800 to-indigo-900 border-b border-sky-400/30'
                    : 'bg-[#008069]'
            }`}>
                <div className="flex items-center gap-3">
                    {inquiry && (
                        <button onClick={() => { setInquiry(null); setReplyToMessage(null); setGuiderSessionMeta(null); }} className="p-1 hover:bg-black/10 rounded-full transition-colors mr-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                    )}
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-white/20">
                        {isGuiderChatMode ? (
                            <GraduationCap size={22} className="text-sky-300" />
                        ) : currentBiz && currentBiz.logo && currentBiz.logo !== 'default.png' && currentBiz.logo !== 'null' ? (
                            <img src={`${axios.defaults.baseURL.replace('/api', '')}/storage/icons/${currentBiz.logo}`} className="w-full h-full object-cover" alt="Logo" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                        ) : (
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-[15px] leading-tight">
                                {isGuiderChatMode 
                                    ? 'LUMI • Paper Guider Desk' 
                                    : currentBiz ? `${currentBiz.name} Support` : 'LUMI Campus Support'}
                            </h3>
                            {isGuiderChatMode && (
                                <span className="bg-sky-400/30 text-sky-200 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider border border-sky-400/40">Guider</span>
                            )}
                        </div>
                        <p className="text-[11px] text-white/90 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                            {isGuiderChatMode ? 'Dedicated Paper Marking Support' : 'We usually reply in a few minutes'}
                        </p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors shrink-0">
                    <X size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden" style={{ backgroundImage: 'url("/chat-bg.png")', backgroundSize: 'contain', backgroundBlendMode: 'overlay', backgroundColor: 'rgba(239, 234, 226, 0.95)' }}>
                {!inquiry ? (
                    // PRE-CHAT FORM WITH LUMI TABS
                    <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                        
                        {/* Dual Tabs: Paper Guiders vs General Support */}
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/10 backdrop-blur-md rounded-2xl mb-4 border border-black/5">
                            <button
                                onClick={() => setPreChatTab('paper_guiders')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                    preChatTab === 'paper_guiders'
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-600/30'
                                        : 'text-gray-700 hover:text-black hover:bg-black/5'
                                }`}
                            >
                                <GraduationCap size={16} />
                                <span>Paper Guider</span>
                                {isEnrolledInPaperClass && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                )}
                            </button>
                            <button
                                onClick={() => setPreChatTab('support')}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                    preChatTab === 'support'
                                        ? 'bg-gradient-to-r from-[#008069] to-emerald-700 text-white shadow-md shadow-emerald-700/30'
                                        : 'text-gray-700 hover:text-black hover:bg-black/5'
                                }`}
                            >
                                <MessageCircle size={16} />
                                <span>General Support</span>
                            </button>
                        </div>

                        {/* TAB 1: PAPER GUIDER DESK */}
                        {preChatTab === 'paper_guiders' && (
                            <div className="flex-1 flex flex-col space-y-3">
                                {!isEnrolledInPaperClass ? (
                                    /* 🔒 LOCKED CARD: ONLY FOR ENROLLED STUDENTS */
                                    <div className="bg-white rounded-2xl p-5 border border-red-200 shadow-sm text-center flex flex-col items-center justify-center my-auto">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-red-300 flex items-center justify-center text-red-600 mb-3 shadow-inner">
                                            <Lock size={30} strokeWidth={2.5} />
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider mb-2">
                                            Paper Class Exclusive
                                        </div>
                                        <h4 className="text-base font-bold text-gray-900 mb-1.5">
                                            Paper Guider Support Unavailable
                                        </h4>
                                        <p className="text-xs text-gray-600 leading-relaxed mb-4">
                                            This feature is exclusively available to students enrolled in a Paper Class. Please enroll in a Paper Class to consult directly with examiners and paper guiders.
                                        </p>
                                        <button
                                            onClick={() => {
                                                setIsOpen(false);
                                                if (setActiveTab) setActiveTab('courses');
                                                window.dispatchEvent(new CustomEvent('switch-student-tab', { detail: { tab: 'courses' } }));
                                            }}
                                            className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <BookOpen size={16} />
                                            <span>Explore Paper Classes & Enroll</span>
                                        </button>
                                    </div>
                                ) : (
                                    /* 🟢 UNLOCKED: ENROLLED PAPER CLASS STUDENTS - CLEAN & LIKE GENERAL SUPPORT */
                                    <>
                                        <div className="bg-white p-3.5 rounded-xl shadow-sm text-center">
                                            <h4 className="text-sm font-bold text-[#111b21] mb-1 flex items-center justify-center gap-1.5">
                                                Paper Guider Consultation Desk 👋
                                            </h4>
                                            <p className="text-xs text-[#54656f] leading-relaxed">
                                                Select your paper class to chat directly with dedicated paper guiders and examiners.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider ml-1">
                                                Enrolled Paper Classes & Guiders
                                            </label>

                                            <div className="flex flex-col gap-2">
                                                {paperClasses && paperClasses.length > 0 ? (
                                                    paperClasses.map((pc) => {
                                                        const bId = pc.businessId || (businesses && businesses[0]?.id) || 1;
                                                        const cId = pc.id !== 0 ? pc.id : null;
                                                        const biz = businesses?.find(b => b.id === bId);
                                                        const hasLogo = biz?.logo && biz?.logo !== 'default.png' && biz?.logo !== 'null';

                                                        return (
                                                            <div 
                                                                key={pc.id}
                                                                onClick={() => {
                                                                    startInquiry(bId, cId, `[📝 Paper Guider Desk] Class: ${pc.name}`, true);
                                                                    toast.success(`Connected to Paper Guider Desk for ${pc.name}!`, { icon: '🎓' });
                                                                }}
                                                                className="bg-white hover:bg-[#f0f9ff] border border-transparent hover:border-sky-300 cursor-pointer transition-all rounded-xl p-3 flex items-center gap-3 relative shadow-sm hover:shadow-md group"
                                                            >
                                                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shrink-0 text-white shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                                                                    {hasLogo ? (
                                                                        <img 
                                                                            src={`${axios.defaults.baseURL.replace('/api', '')}/storage/icons/${biz.logo}`} 
                                                                            className="w-full h-full object-cover" 
                                                                            alt="" 
                                                                            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} 
                                                                        />
                                                                    ) : (
                                                                        <GraduationCap size={22} className="text-white" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 overflow-hidden">
                                                                    <h5 className="font-bold text-sm text-[#111b21] truncate">{pc.name}</h5>
                                                                    <p className="text-[11px] text-sky-700 font-medium">Click to Chat with Paper Guider</p>
                                                                </div>
                                                                <ChevronRight size={16} className="text-gray-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div 
                                                        onClick={() => {
                                                            const bId = (businesses && businesses[0]?.id) || 1;
                                                            startInquiry(bId, null, `[📝 Paper Guider Desk] General Paper Consultation`, true);
                                                            toast.success("Connected to Paper Guider Desk!", { icon: '🎓' });
                                                        }}
                                                        className="bg-white hover:bg-[#f0f9ff] border border-transparent hover:border-sky-300 cursor-pointer transition-all rounded-xl p-3 flex items-center gap-3 relative shadow-sm group"
                                                    >
                                                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center shrink-0 text-white shadow-sm">
                                                            <GraduationCap size={22} />
                                                        </div>
                                                        <div className="flex-1 overflow-hidden">
                                                            <h5 className="font-bold text-sm text-[#111b21]">General Paper Guider Desk</h5>
                                                            <p className="text-[11px] text-sky-700 font-medium">Click to Chat with Paper Guider</p>
                                                        </div>
                                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* TAB 2: GENERAL SUPPORT */}
                        {preChatTab === 'support' && (
                            <div className="flex-1 flex flex-col space-y-3">
                                <div className="bg-white p-3.5 rounded-xl shadow-sm text-center">
                                    <h4 className="text-sm font-bold text-[#111b21] mb-1">Campus Support Center 👋</h4>
                                    <p className="text-xs text-[#54656f] leading-relaxed">
                                        Select your institution or support desk below to start chatting with staff.
                                    </p>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-[#54656f] uppercase tracking-wider ml-1">Institutions & Support Desks</label>
                                    
                                    <div className="flex flex-col gap-2">
                                        {businesses?.map(b => (
                                            <div 
                                                key={b.id} 
                                                onClick={() => startInquiry(b.id, null)}
                                                className="bg-white hover:bg-[#f5f6f6] border border-transparent hover:border-[#d1d7db] cursor-pointer transition-colors rounded-xl p-3 flex items-center gap-3 relative shadow-sm"
                                            >
                                                <div className="w-11 h-11 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 overflow-hidden">
                                                    {b.logo && b.logo !== 'default.png' && b.logo !== 'null' ? (
                                                        <img src={`${axios.defaults.baseURL.replace('/api', '')}/storage/icons/${b.logo}`} className="w-full h-full object-cover" alt="" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                                                    ) : (
                                                        <span className="font-bold text-base text-[#54656f]">{b.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <h5 className="font-bold text-sm text-[#111b21] truncate">{b.name}</h5>
                                                    <p className="text-[11px] text-[#54656f]">Click to Chat with Staff</p>
                                                </div>
                                                {unreadBusinesses[b.id] > 0 && (
                                                    <div className="w-5 h-5 bg-red-600 animate-bounce text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                                                        {unreadBusinesses[b.id]}
                                                    </div>
                                                )}
                                                <ChevronRight size={16} className="text-gray-400" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // CHAT INTERFACE

                    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                        {/* Status banner */}
                        {inquiry.status === 'RESOLVED' && (
                            <div className="bg-[#ffd279] text-[#54656f] text-[11px] font-semibold p-1.5 text-center shadow-sm z-10 flex justify-center items-center gap-1">
                                <ShieldAlert size={12}/> This inquiry has been marked as resolved.
                            </div>
                        )}
                        
                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const isMe = msg.direction === 'inbound';
                                
                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                        <div className={`max-w-[80%] relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            
                                            {/* Action Buttons */}
                                            <div className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/80 backdrop-blur shadow-sm rounded-full px-1 py-1 z-10 ${isMe ? 'right-full mr-1' : 'left-full ml-1'}`}>
                                                <button onClick={() => setReplyToMessage(msg)} className="p-1 text-[#54656f] hover:text-[#00a884] rounded-full" title="Reply">
                                                    <Reply size={14} />
                                                </button>
                                            </div>

                                            <div className={`px-2.5 py-1.5 shadow-sm relative ${
                                                isMe ? 'bg-[#d9fdd3] text-[#111b21] rounded-xl rounded-tr-none' : 'bg-white text-[#111b21] border border-gray-100 rounded-xl rounded-tl-none'
                                            }`}>
                                                
                                                {/* Reply Preview */}
                                                {msg.replyTo && (
                                                    <div className={`mb-1 p-1.5 rounded-lg text-[12px] bg-black/5 border-l-4 ${isMe ? 'border-[#00a884]' : 'border-[#53bdeb]'}`}>
                                                        <span className={`font-bold block ${isMe ? 'text-[#00a884]' : 'text-[#53bdeb]'}`}>{msg.replyTo.senderName || 'Staff'}</span>
                                                        <span className="text-[#54656f] truncate block">{msg.replyTo.message || '[Attachment]'}</span>
                                                    </div>
                                                )}

                                                {!isMe && msg.senderName && (
                                                    <p className="text-[11px] font-bold text-[#53bdeb] mb-0.5">{msg.senderName}</p>
                                                )}

                                                {/* Media Rendering */}
                                                {msg.mediaUrl && (
                                                    <div className="mb-1 mt-1">
                                                        {msg.mediaType?.includes('image') ? (
                                                            <img src={`${backendBaseUrl}/storage/images/chat_uploads/${msg.mediaUrl}`} alt="attachment" className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90" onClick={()=>window.open(`${backendBaseUrl}/storage/images/chat_uploads/${msg.mediaUrl}`, '_blank')}/>
                                                        ) : (msg.mediaType?.includes('audio') || msg.mediaUrl.endsWith('.mp3') || msg.mediaUrl.endsWith('.ogg') || msg.mediaUrl.endsWith('.webm') || msg.mediaUrl.endsWith('.mp4')) ? (
                                                            <div className="bg-black/10 p-2 rounded-xl mb-1 flex items-center shadow-inner min-w-[200px]">
                                                                <audio src={`${backendBaseUrl}/storage/images/chat_uploads/${msg.mediaUrl}`} controls className="w-full h-10 custom-audio-player outline-none" />
                                                            </div>
                                                        ) : msg.mediaType === 'video' ? (
                                                            <video src={`${backendBaseUrl}/storage/images/chat_uploads/${msg.mediaUrl}`} controls className="max-w-[220px] w-full rounded-lg mb-2" />
                                                        ) : (
                                                            <a href={`${backendBaseUrl}/storage/images/chat_uploads/${msg.mediaUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-black/5 text-xs font-bold underline">
                                                                <FileText size={14} /> Download File
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Text Message */}
                                                {msg.message && (
                                                    <span className="text-[14px] leading-snug whitespace-pre-wrap">{msg.message}</span>
                                                )}
                                                
                                                <div className="inline-flex items-center justify-end gap-1 ml-3 mt-1 align-bottom float-right">
                                                    <span className="text-[10px] text-[#8696a0] font-medium">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {isMe && <CheckCircle size={12} className={msg.isRead ? 'text-[#53bdeb]' : 'text-[#8696a0]'} />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {/* Input Area */}
                        {inquiry.status === 'OPEN' && (
                            <div className="bg-[#f0f2f5] flex flex-col shrink-0 px-2 py-2 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
                                
                                {/* Reply Preview Box */}
                                {replyToMessage && (
                                    <div className="flex items-center justify-between bg-[#e9edef] border-l-4 border-[#00a884] p-2 rounded mb-2 shadow-sm mx-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-[#00a884]">Replying to {replyToMessage.senderName || (replyToMessage.direction === 'inbound' ? 'You' : 'Staff')}</p>
                                            <p className="text-[12px] text-[#54656f] truncate">{replyToMessage.message || '[Attachment]'}</p>
                                        </div>
                                        <button onClick={() => setReplyToMessage(null)} className="text-[#54656f] hover:text-[#111b21] p-1"><X size={16} /></button>
                                    </div>
                                )}

                                {/* Selected File Preview */}
                                {selectedFile && (
                                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg shadow-sm mb-2 mx-2">
                                        <div className="w-8 h-8 bg-[#e9edef] rounded flex items-center justify-center text-[#54656f]">
                                            {selectedFile.type.includes('audio') ? <Music size={16}/> : <ImageIcon size={16}/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-[#111b21] truncate">{selectedFile.name}</p>
                                        </div>
                                        <button onClick={() => setSelectedFile(null)} className="text-[#54656f] hover:text-red-500 p-1"><X size={16} /></button>
                                    </div>
                                )}

                                <form onSubmit={sendMessage} className="flex items-end gap-1.5 relative">
                                    <label className="cursor-pointer p-2.5 text-[#54656f] hover:text-[#111b21] rounded-full transition-colors flex-shrink-0">
                                        <Paperclip size={22}/>
                                        <input type="file" className="hidden" onChange={(e)=>setSelectedFile(e.target.files[0])}/>
                                    </label>
                                    
                                    {isRecording ? (
                                        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-white rounded-xl shadow-sm border border-transparent mx-1 mb-1 relative overflow-hidden">
                                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0"></div>
                                            <span className="text-[#111b21] font-medium text-sm flex-1">{formatTime(recordingDuration)}</span>
                                            <button type="button" onClick={stopRecording} className="text-red-500 hover:text-red-600 p-1 shrink-0"><StopCircle size={22}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 bg-white rounded-xl mx-1 mb-1 flex items-end shadow-sm border border-transparent overflow-hidden relative">
                                            <textarea
                                                value={inputMsg}
                                                onChange={e => setInputMsg(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                                                placeholder="Type a message"
                                                rows={1}
                                                className="w-full bg-transparent text-[#111b21] placeholder-[#54656f] px-4 py-2.5 resize-none focus:outline-none text-[15px]"
                                            />
                                        </div>
                                    )}

                                    {!inputMsg.trim() && !selectedFile ? (
                                        <button type="button" onClick={startRecording} className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm flex-shrink-0 mb-1"><Mic size={20}/></button>
                                    ) : (
                                        <button type="submit" disabled={isUploading} className="p-3 bg-[#00a884] disabled:bg-[#8696a0] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-sm flex-shrink-0 mb-1"><Send size={20} className={isUploading ? 'animate-pulse' : ''}/></button>
                                    )}
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebInquiryWidget;

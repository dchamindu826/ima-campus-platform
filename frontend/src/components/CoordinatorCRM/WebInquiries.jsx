import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { ReactTransliterate } from 'react-transliterate';
import 'react-transliterate/dist/index.css';
import { createPortal } from 'react-dom';
import axios from '../../api/axios';
import { 
    Search, CheckCircle, MessageCircle, Send, Paperclip, Phone, ShieldAlert, FileText, Reply, X, 
    Image as ImageIcon, File, Video, Music, Smile, Mic, StopCircle
} from 'lucide-react';
import { 
    FaSearch, FaUserCircle, FaCheckSquare, FaEnvelopeOpenText, FaEnvelope, 
    FaUserMinus, FaClock, FaPaperPlane, FaPaperclip, FaSun, FaMoon, FaMicrophone, 
    FaReply, FaTimes, FaImage, FaFilePdf, FaBolt, FaMagic, FaVideo, FaMusic, 
    FaSmile, FaStop, FaPhoneAlt, FaChevronDown, FaCheckCircle, FaTimesCircle, 
    FaUserSecret, FaKey, FaMapMarkerAlt, FaGraduationCap, FaCreditCard, 
    FaArrowsAlt, FaChevronRight, FaChevronLeft, FaGoogle
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { convertSinglishToSinhala } from '../../utils/singlishConverter';
import { io } from 'socket.io-client';
import englishWords from '../../utils/englishWords.json';

const englishDictionary = new Set(englishWords.map(w => w.toLowerCase()));
const singlishOverlap = new Set(['mm', 'wen', 'una', 'an', 'man', 'api', 'ai', 'paw', 'me', 'do', 'to', 'is', 'was', 'are', 'am', 'a', 'i', 'he', 'she', 'it', 'we', 'they', 'you']);

const BACKEND_URL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : '';

const formatDateLabel = (dateString) => {
    const msgDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return msgDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
};

export default function WebInquiries() {
    const [inquiries, setInquiries] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [selectedBusiness, setSelectedBusiness] = useState('ALL');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [messages, setMessages] = useState([]);
    
    // Chat states
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [enableSinhala, setEnableSinhala] = useState(false);
  const [enableGoogleSinhala, setEnableGoogleSinhala] = useState(false);
    const [chatTheme, setChatTheme] = useState('dark');
    
    // Quick Replies
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [suggestedQRs, setSuggestedQRs] = useState([]);
    const [quickReplies, setQuickReplies] = useState([]);
    const [newQRName, setNewQRName] = useState('');
    const [newQRMsg, setNewQRMsg] = useState('');
    const [qrAttachmentBase64, setQrAttachmentBase64] = useState(null);

    // Voice Recording
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const timerRef = useRef(null);
    const audioChunks = useRef([]);

    // Reactions
    const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
    const [localReactions, setLocalReactions] = useState({});

    // Sidebar & Layout
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [studentInfo, setStudentInfo] = useState(null);

    // Right Panel Options (Ghost Login & Password Reset)
    const [ghostIframe, setGhostIframe] = useState(null);
    const [iframePos, setIframePos] = useState({ x: 50, y: 50 });
    const [originalAdminSession, setOriginalAdminSession] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [lastResetPassword, setLastResetPassword] = useState(null);

    const messagesEndRef = useRef(null);
    const scrollRef = useRef(null);
    const isUserScrolledUp = useRef(false);
    const socketRef = useRef(null);
    const user = JSON.parse(localStorage.getItem('user')) || {};
    
    const isDark = chatTheme === 'dark';
    const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    useEffect(() => {
        fetchInquiries();
        fetchQuickReplies();
        
        axios.get('/business/my-businesses')
            .then(res => {
                setBusinesses(res.data);
                if (res.data.length > 0) {
                    setSelectedBusiness(res.data[0].id.toString());
                }
            })
            .catch(err => console.error("Error fetching businesses", err));

        const token = localStorage.getItem('token');
        let timeoutId;

        // Delay socket creation to prevent Strict Mode double-connect errors
        timeoutId = setTimeout(() => {
            socketRef.current = io(BACKEND_URL, { auth: { token }, transports: ['websocket', 'polling'] });

            socketRef.current.on('new_web_inquiry_message', (msg) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                fetchInquiries(false); 
            });

            socketRef.current.on('web_inquiry_message_updated', (data) => {
                setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
            });

            socketRef.current.on('web_inquiry_notification', (data) => {
                fetchInquiries(false);
            });
        }, 300);

        return () => {
            clearTimeout(timeoutId);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (selectedInquiry && selectedBusiness !== 'ALL') {
            if (selectedInquiry.businessId.toString() !== selectedBusiness) {
                setSelectedInquiry(null);
            }
        }
    }, [selectedBusiness]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length >= 3) {
                setIsSearchingGlobal(true);
                axios.get(`/web-inquiry/search-students?query=${searchQuery}`)
                    .then(res => {
                        setGlobalSearchResults(res.data.students || []);
                        setIsSearchingGlobal(false);
                    })
                    .catch(err => {
                        console.error("Global search error:", err);
                        setIsSearchingGlobal(false);
                    });
            } else {
                setGlobalSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    useEffect(() => { 
        if (scrollRef.current && !isUserScrolledUp.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
        }
    }, [messages, localReactions]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        isUserScrolledUp.current = scrollHeight - (scrollTop + clientHeight) > 100;
    };

    const fetchInquiries = async (showLoading = true) => {
        try {
            const res = await axios.get('/web-inquiry');
            setInquiries(res.data.inquiries);
        } catch (error) {
            if (showLoading) toast.error("Failed to load inquiries");
        }
    };

    const fetchQuickReplies = async () => {
        try {
            const res = await axios.get('/coordinator-crm/quick-replies');
            setQuickReplies(res.data || []);
        } catch(e) {}
    };

    const loadInquiryMessages = async (inqId) => {
        try {
            const res = await axios.get(`/web-inquiry/${inqId}/messages`);
            setMessages(res.data.messages);
            await axios.post('/web-inquiry/mark-read', { inquiryId: inqId });
            setInquiries(prev => prev.map(i => i.id === inqId ? { ...i, unreadCount: 0 } : i));
        } catch (error) {
            toast.error("Failed to load messages");
        }
    };

    const loadStudentInfo = async (inqId) => {
        try {
            const res = await axios.get(`/web-inquiry/${inqId}/student-info`);
            setStudentInfo(res.data.student);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSelectInquiry = (inq) => {
        setSelectedInquiry(inq);
        setStudentInfo(null);
        setReplyingTo(null);
        setSelectedFile(null);
        setSuggestedQRs([]);
        setNewMessage('');
        
        loadInquiryMessages(inq.id);
        loadStudentInfo(inq.id);
        
        if (socketRef.current) {
            socketRef.current.emit('join_web_inquiry_room', { inquiryId: inq.id });
        }
    };

    const handleStartGlobalChat = async (student) => {
        try {
            toast.loading("Starting chat...");
            const res = await axios.post('/web-inquiry/create-or-get', {
                studentId: student.id,
                businessId: selectedBusiness === 'ALL' ? (businesses[0]?.id || 1) : selectedBusiness
            });
            toast.dismiss();
            
            // Check if inquiry already exists in our local state
            const existing = inquiries.find(i => i.id === res.data.inquiry.id);
            if (!existing) {
                setInquiries(prev => [res.data.inquiry, ...prev]);
            }
            
            handleSelectInquiry(res.data.inquiry);
            setSearchQuery(''); // Clear search to show normal list
        } catch (error) {
            toast.dismiss();
            toast.error("Failed to start chat with student");
        }
    };

    const handleResolve = async () => {
        if (!selectedInquiry) return;
        try {
            await axios.post('/web-inquiry/resolve', { inquiryId: selectedInquiry.id });
            toast.success("Inquiry resolved");
            setSelectedInquiry(prev => ({ ...prev, status: 'RESOLVED' }));
            fetchInquiries(false);
        } catch (error) {
            toast.error("Failed to resolve inquiry");
        }
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

    // --- Sending Messages ---
    const handleInputChange = (e) => {
        let val = e.target.value;
        const isAddingSpace = val.endsWith(' ') && val.length > newMessage.length;
        
        setNewMessage(val);

        if (val.includes('/')) {
            const searchPart = val.substring(val.lastIndexOf('/') + 1).toLowerCase();
            const matches = quickReplies.filter(qr => qr.name.toLowerCase().includes(searchPart));
            setSuggestedQRs(matches);
        } else {
            setSuggestedQRs([]);
        }

        if (enableSinhala && isAddingSpace && val.trim().length > 0) {
            const words = val.split(' ');
            if (words.length >= 2) {
                const lastWord = words[words.length - 2];
                if (lastWord && /^[a-zA-Z]+$/.test(lastWord)) {
                    if (lastWord === lastWord.toUpperCase()) return;
                    if (englishDictionary.has(lastWord.toLowerCase()) && !singlishOverlap.has(lastWord.toLowerCase())) return;

                    const targetIndex = val.lastIndexOf(lastWord + ' ');
                    if (targetIndex !== -1) {
                        fetch(`https://inputtools.google.com/request?text=${lastWord}&itc=si-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`)
                            .then(res => res.json())
                            .then(data => {
                                if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
                                    const translatedWord = data[1][0][1][0];
                                    setNewMessage(prev => {
                                        if (prev.substring(targetIndex, targetIndex + lastWord.length + 1) === lastWord + ' ') {
                                            return prev.substring(0, targetIndex) + translatedWord + ' ' + prev.substring(targetIndex + lastWord.length + 1);
                                        }
                                        return prev;
                                    });
                                }
                            })
                            .catch(err => console.error("Transliteration error:", err));
                    }
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
    };

    const applyQuickReply = (qr) => {
        const lastSlash = newMessage.lastIndexOf('/');
        const beforeSlash = newMessage.substring(0, lastSlash);
        setNewMessage(beforeSlash + qr.message + ' ');
        setSuggestedQRs([]);
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !selectedInquiry) return;

        setIsSending(true);
        let mediaUrl = null;
        let mediaType = null;

        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            try {
                const res = await axios.post('/web-inquiry/upload', formData);
                mediaUrl = res.data.fileUrl;
                if (selectedFile.type.startsWith('image/')) mediaType = 'image';
                else if (selectedFile.type.startsWith('audio/')) mediaType = 'audio';
                else if (selectedFile.type.startsWith('video/')) mediaType = 'video';
                else mediaType = 'document';
            } catch (err) {
                toast.error("Upload failed");
                setIsSending(false);
                return;
            }
        }

        if (socketRef.current) {
            socketRef.current.emit('send_web_inquiry_message', {
                inquiryId: selectedInquiry.id,
                businessId: selectedInquiry.businessId,
                message: newMessage.trim(),
                mediaUrl,
                mediaType,
                replyToId: replyingTo?.id || null
            });
        }

        setNewMessage('');
        setSelectedFile(null);
        setReplyingTo(null);
        setIsSending(false);
        isUserScrolledUp.current = false;
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
    };

    const handleReaction = async (msg, emoji) => {
        if(socketRef.current) socketRef.current.emit('react_web_inquiry_message', { messageId: msg.id, inquiryId: selectedInquiry.id, emoji });
    };

    // Right Panel Options
    const handleGhostLogin = async () => {
        if(!studentInfo) return;
        if(!window.confirm(`Are you sure you want to log in as ${studentInfo.firstName}?`)) return;
        try {
            toast.loading("Initiating Ghost Login...", { id: "ghost" });
            const res = await axios.post('/admin/ghost-login', { studentId: studentInfo.id });
            if (res.data.token) {
                const currentToken = localStorage.getItem('token');
                const currentUser = localStorage.getItem('user');
                setOriginalAdminSession({ token: currentToken, user: currentUser });

                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                
                setIframePos({ x: window.innerWidth / 2 - 450, y: window.innerHeight / 2 - 300 });
                setGhostIframe('/student/dashboard');
                toast.success("Ghost Login Active!", { id: "ghost" });
            }
        } catch (error) {
            toast.error("Ghost login failed.", { id: "ghost" });
        }
    };

    const closeGhostLogin = () => {
        if (originalAdminSession) {
            localStorage.setItem('token', originalAdminSession.token);
            localStorage.setItem('user', originalAdminSession.user);
        }
        setGhostIframe(null);
        toast.success("Restored Admin Session.");
    };

    const handleDragStart = (e) => {
        const startX = e.clientX;
        const startY = e.clientY;
        const startPosX = iframePos.x;
        const startPosY = iframePos.y;

        const onMouseMove = (moveEvent) => {
            setIframePos({
                x: startPosX + (moveEvent.clientX - startX),
                y: startPosY + (moveEvent.clientY - startY),
            });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/coordinator-crm/reset-password', { studentId: studentInfo.id, newPassword });
            toast.success("Password successfully reset!");
            setLastResetPassword(newPassword);
        } catch (error) {
            toast.error("Password reset failed.");
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(lastResetPassword);
        toast.success("Password Copied!");
        setTimeout(() => { setShowResetModal(false); setLastResetPassword(null); setNewPassword(''); }, 1000); 
    };

    const getPaymentOption = (payment) => {
        if (!payment) return "N/A";
        let typeStr = payment.payment_type === 1 ? "Monthly" : payment.payment_type === 2 ? "Installment" : "Full Payment";
        return `${typeStr} via ${payment.method || 'Slip'}`;
    };

    const renderMedia = (msg) => {
        if (!msg.mediaUrl) return null;
        const url = msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${BACKEND_URL}/storage/images/chat_uploads/${msg.mediaUrl}`; 
        
        if (msg.mediaType?.includes('webp') || msg.mediaUrl.endsWith('.webp')) {
            return <img src={url} alt="sticker" className="max-w-[130px] w-full bg-transparent drop-shadow-md mb-1" />;
        }
        if (msg.mediaType?.includes('image')) return <img src={url} alt="img" className="max-w-[300px] w-full rounded-lg mb-2 object-cover border border-black/10" />;
        if (msg.mediaType?.includes('video')) return <video src={url} controls className="max-w-[300px] w-full rounded-lg mb-2" />;
        
        if (msg.mediaType?.includes('audio') || msg.mediaUrl.endsWith('.mp3') || msg.mediaUrl.endsWith('.ogg')) {
            return (
               <div className="bg-black/20 p-2 rounded-xl mb-2 flex items-center shadow-inner min-w-[250px]">
                   <audio src={url} controls className="w-full h-10 custom-audio-player outline-none" />
               </div>
            );
        }
        
        if (msg.mediaType?.includes('pdf') || msg.mediaUrl.endsWith('.pdf')) 
            return <iframe src={url} className="w-[300px] h-[350px] rounded-lg mb-2 bg-white shadow-inner" title="PDF"></iframe>;
        
        return <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-black/10 rounded-lg mb-2 text-xs font-bold hover:underline"><FaFilePdf className="text-red-500 text-lg"/> View Document</a>;
    };

    const renderMessageText = (msg) => {
        const text = msg.message;
        if (!text) return null;

        if (msg.mediaUrl && ["IMAGE Message", "AUDIO Message", "VIDEO Message", "DOCUMENT Message"].includes(text)) {
            return null; 
        }

        return <span className="whitespace-pre-wrap">{text}</span>;
    };

    const filteredInquiries = useMemo(() => {
        let currentInquiries = inquiries.filter(inq => 
            selectedBusiness === 'ALL' || inq.businessId.toString() === selectedBusiness
        );
        if (searchQuery) {
            const q = String(searchQuery).toLowerCase().trim();
            currentInquiries = currentInquiries.filter(inq => {
                const phoneMatch = inq.phone ? String(inq.phone).toLowerCase().includes(q) : false;
                const nameMatch = inq.name ? String(inq.name).toLowerCase().includes(q) : false;
                const studentNameMatch = inq.student?.firstName ? String(inq.student.firstName).toLowerCase().includes(q) : false;
                return phoneMatch || nameMatch || studentNameMatch;
            });
        }
        return currentInquiries.sort((a, b) => {
            const dateA = new Date(a.lastMessageAt || a.createdAt);
            const dateB = new Date(b.lastMessageAt || b.createdAt);
            return dateB - dateA;
        });
    }, [inquiries, searchQuery, selectedBusiness, selectedInquiry]);

    const groupedMessages = messages.reduce((acc, msg) => {
        const dateLabel = formatDateLabel(msg.createdAt);
        if (!acc[dateLabel]) acc[dateLabel] = [];
        acc[dateLabel].push(msg);
        return acc;
    }, {});

    return (
        <div className="h-full flex flex-col gap-4 animate-fade-in-up text-slate-300">
            {/* Top bar */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-[#23303f] p-4 rounded-2xl shadow-lg border border-white/5">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-white/5">
                        <MessageCircle className="text-2xl" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-wide">LUMI Chat</h1>
                        <p className="text-xs text-slate-400">Manage and follow up with system inquiries</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto justify-end">
                    <select 
                        value={selectedBusiness}
                        onChange={(e) => setSelectedBusiness(e.target.value)}
                        className="bg-[#1a2430] border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-600"
                    >
                        <option value="ALL">All Businesses</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Main CRM Workspace */}
            <div className="flex-1 flex gap-4 h-[calc(100%-6rem)] overflow-hidden">
                
                {/* 1. Sidebar */}
                <div className="w-[380px] xl:w-[440px] bg-[#1a2430] rounded-2xl flex flex-col overflow-hidden shrink-0 border border-white/10 shadow-xl relative">
                    <div className="p-5 bg-[#121a24] border-b border-white/5">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-black text-slate-200 tracking-wider uppercase flex items-center gap-2">Inquiries</h3>
                        </div>
                        <div className="relative">
                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by number or name..." 
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-base text-slate-200 focus:outline-none focus:border-emerald-600 placeholder-slate-600 shadow-inner" 
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-[#1a2430]">
                        {filteredInquiries.length === 0 ? ( <div className="text-center text-slate-600 text-sm mt-10 font-medium">No inquiries found.</div> ) : (
                            filteredInquiries.map(inq => {
                                let overlayClass = 'bg-[#121a24] border-transparent hover:border-white/10';
                                if (selectedInquiry?.id === inq.id) {
                                    overlayClass = 'bg-[#0f172a] border-blue-500 shadow-md shadow-blue-500/20';
                                }
                                return (
                                    <div key={inq.id} className={`p-3 rounded-2xl mb-2 transition-all flex gap-3 items-center border ${overlayClass}`}>
                                        <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => handleSelectInquiry(inq)}>
                                            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm relative">
                                                {inq.student?.firstName ? inq.student.firstName.charAt(0).toUpperCase() : 'S'}
                                                {inq.unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black h-4 min-w-[16px] flex items-center justify-center rounded-full shadow-md">{inq.unreadCount}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex flex-col gap-0.5">
                                                        <h4 className="font-bold text-[15px] text-slate-200 leading-none">{inq.student?.firstName || inq.student?.name || inq.name || 'Student'} {inq.student?.lastName || ''}</h4>
                                                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{inq.student?.phone || inq.phone || 'No phone'}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0 ml-2 gap-1.5">
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-emerald-500 font-bold block mb-0.5">{new Date(inq.lastMessageAt || inq.createdAt).toLocaleDateString('en-GB')}</span>
                                                            <span className="text-[9px] text-slate-500 block">{new Date(inq.lastMessageAt || inq.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end mt-1">
                                                    <p className="text-[11px] font-medium text-slate-500 truncate w-[80%]">{inq.lastMessage || 'No messages'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        
                        {/* Global Search Results Section */}
                        {searchQuery.trim().length >= 3 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-2">Global Search (All Students)</h4>
                                {isSearchingGlobal ? (
                                    <div className="text-center text-slate-500 text-xs py-4 flex items-center justify-center gap-2">
                                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div> Searching...
                                    </div>
                                ) : globalSearchResults.length === 0 ? (
                                    <div className="text-center text-slate-600 text-xs py-4">No other students found</div>
                                ) : (
                                    globalSearchResults.map(student => (
                                        <div key={student.id} className="p-3 rounded-2xl mb-2 transition-all flex gap-3 items-center border bg-[#121a24] border-transparent hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer" onClick={() => handleStartGlobalChat(student)}>
                                            <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xl shrink-0 border border-blue-500/20">
                                                {student.firstName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-[15px] text-slate-200 leading-none">{student.firstName} {student.lastName}</h4>
                                                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">{student.phone}</span>
                                            </div>
                                            <button className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors">Chat</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Chat Area */}
                {selectedInquiry ? (
                    <div className={`flex-1 flex flex-col rounded-2xl overflow-hidden shrink-0 border border-white/5 shadow-lg ${isDark ? 'bg-[#0f172a]' : 'bg-[#e5ddd5]'}`}>
                        <div className={`p-4 flex justify-between items-center border-b z-20 ${isDark ? 'bg-[#1e293b] border-slate-700' : 'bg-[#f0f2f5] border-slate-300'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-sm">
                                    {(selectedInquiry.student?.firstName || selectedInquiry.student?.name || selectedInquiry.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{selectedInquiry.student?.firstName || selectedInquiry.student?.name || selectedInquiry.name || 'Student'} {selectedInquiry.student?.lastName || ''}</h3>
                                    <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedInquiry.student?.phone || selectedInquiry.phone || 'No phone'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedInquiry.status !== 'RESOLVED' && (
                                    <button onClick={handleResolve} className={`text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                                        <FaCheckCircle/> Resolve
                                    </button>
                                )}
                                <button onClick={() => setChatTheme(isDark ? 'light' : 'dark')} className={`p-2.5 rounded-full transition-colors shadow-inner ${isDark ? 'bg-[#0f172a] text-yellow-500' : 'bg-white text-slate-600'}`}>
                                    {isDark ? <FaSun size={14}/> : <FaMoon size={14}/>}
                                </button>
                            </div>
                        </div>

                        <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar relative ${isDark ? "bg-[#0b141a]" : "bg-[#efeae2]"}`} ref={scrollRef} onScroll={handleScroll}>
                            <div className="relative z-10 flex flex-col">
                                {Object.keys(groupedMessages).map(dateLabel => (
                                    <React.Fragment key={dateLabel}>
                                        <div className="flex justify-center my-6">
                                            <span className={`text-[10px] font-bold px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-sm ${isDark ? 'bg-[#1e293b] text-slate-400 border border-slate-700' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                                {dateLabel}
                                            </span>
                                        </div>
                                        {groupedMessages[dateLabel].map((msg, idx) => {
                                            const isOutbound = msg.direction === 'outbound';
                                            const isSticker = (msg.mediaUrl && msg.mediaUrl.endsWith('.webp')) || msg.mediaType?.includes('webp');

                                            return (
                                                <div key={idx} className={`flex flex-col mb-4 group w-full`}>
                                                    <div className={`flex items-center gap-2 ${isOutbound ? 'ml-auto justify-end' : 'mr-auto justify-start'} max-w-[95%]`}>
                                                        {!isOutbound && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all items-center relative">
                                                                <button onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} className="p-1.5 text-slate-400 hover:text-yellow-500 bg-white/10 rounded-full transition-colors">
                                                                    <FaSmile size={12}/>
                                                                </button>
                                                                {activeReactionMsgId === msg.id && (
                                                                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-[#1e293b] px-3 py-2 rounded-full shadow-2xl flex gap-2 border border-slate-600 animate-fade-in">
                                                                        {reactionEmojis.map(e => (
                                                                            <button key={e} onClick={() => { handleReaction(msg, e); setActiveReactionMsgId(null); }} className="hover:scale-125 transition-transform text-base">{e}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <button onClick={()=>setReplyingTo(msg)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-white/10 rounded-full"><FaReply size={12}/></button>
                                                            </div>
                                                        )}
                                                        <div className="relative">
                                                            <div onDoubleClick={() => setReplyingTo(msg)} className={`px-4 py-3 text-[15px] cursor-pointer ${
                                                                isSticker ? 'bg-transparent shadow-none p-0' : 
                                                                isOutbound 
                                                                    ? (isDark ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none shadow-md' : 'bg-[#d9fdd3] text-slate-800 rounded-2xl rounded-tr-none shadow-md border border-[#d9fdd3]')
                                                                    : (isDark ? 'bg-[#1e293b] text-slate-200 rounded-2xl rounded-tl-none shadow-md border border-slate-700' : 'bg-white text-slate-800 rounded-2xl rounded-tl-none shadow-md border border-slate-200')
                                                            }`}>
                                                                {msg.replyTo && (
                                                                    <div className="bg-black/10 dark:bg-black/30 border-l-4 border-emerald-500 rounded p-2.5 mb-1.5 shadow-sm w-full relative overflow-hidden">
                                                                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block mb-0.5">{msg.replyTo.senderName || 'Student'}</span>
                                                                        <span className="text-[13px] text-slate-700 dark:text-slate-300 line-clamp-2 italic">{msg.replyTo.message || '[Attachment]'}</span>
                                                                    </div>
                                                                )}
                                                                {msg.senderName && (
                                                                    <div className={`text-[10px] font-black mb-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{msg.senderName}</div>
                                                                )}
                                                                {renderMedia(msg)}
                                                                {!isSticker && renderMessageText(msg)}

                                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                                    <div className="flex gap-1 mt-1 bg-black/20 px-2 py-0.5 rounded-full w-fit border border-white/5">
                                                                        {Object.values(msg.reactions).map((emoji, i) => (
                                                                            <span key={i} className="text-[11px]">{emoji}</span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {!isSticker && (
                                                                    <span className={`text-[10px] float-right mt-2 ml-6 font-medium flex items-center gap-1 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                                                                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                        {isOutbound && <FaCheckCircle size={10} className={msg.isRead ? 'text-[#53bdeb]' : 'text-current'} />}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isOutbound && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all items-center">
                                                                <button onClick={()=>setReplyingTo(msg)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-white/10 rounded-full"><FaReply size={12}/></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        <div className={`flex flex-col border-t z-20 ${isDark ? 'bg-[#1e293b] border-slate-700' : 'bg-[#f0f2f5] border-slate-300'}`}>
                            {suggestedQRs.length > 0 && (
                                <div className="bg-[#0f172a] border-t border-slate-700 p-3 flex gap-2 overflow-x-auto custom-scrollbar shadow-lg">
                                    {suggestedQRs.map((qr, i) => (
                                        <button key={i} onClick={() => applyQuickReply(qr)} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                                            /{qr.name} {qr.attachment && <FaPaperclip className="inline ml-1"/>}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {replyingTo && (
                                <div className={`px-5 py-3 border-l-4 border-blue-500 flex justify-between items-center shadow-inner ${isDark ? 'bg-[#0f172a]' : 'bg-slate-200'}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Replying to {replyingTo.direction === 'outbound' ? 'Yourself' : selectedInquiry.student?.firstName}</p>
                                        <p className={`text-[13px] truncate mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{replyingTo.message || 'Media Attachment'}</p>
                                    </div>
                                    <button onClick={()=>setReplyingTo(null)} className="text-slate-400 hover:text-red-500 p-2 bg-black/10 rounded-lg"><FaTimes size={14}/></button>
                                </div>
                            )}

                            {selectedFile && (
                                <div className={`px-5 py-4 flex items-center gap-4 border-b ${isDark ? 'bg-[#0f172a] border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 shadow-md">
                                        {selectedFile.type.includes('image') ? <FaImage size={24}/> : selectedFile.type.includes('video') ? <FaVideo size={24}/> : selectedFile.type.includes('audio') ? <FaMusic size={24}/> : <FaFilePdf size={24}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-emerald-500 truncate">{selectedFile.name}</p>
                                    </div>
                                    <button onClick={()=>setSelectedFile(null)} className="text-slate-400 hover:text-red-500 p-2.5 bg-red-500/10 rounded-xl transition-colors"><FaTimes size={16}/></button>
                                </div>
                            )}

                            <div className="p-3.5 flex items-end gap-3">
                                <button type="button" onClick={() => { setEnableSinhala(!enableSinhala); setEnableGoogleSinhala(false); }} title="Toggle Offline Sinhala" className={`p-3.5 rounded-xl transition-colors font-black text-sm ${enableSinhala ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600') : (isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200')}`}>අ</button>
                <button type="button" onClick={() => { setEnableGoogleSinhala(!enableGoogleSinhala); setEnableSinhala(false); }} title="Toggle Google Sinhala" className={`p-3.5 rounded-xl transition-colors text-sm ${enableGoogleSinhala ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200')}`}><FaGoogle size={14}/></button>
                                <label className={`cursor-pointer p-3.5 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200'}`}>
                                    <FaPaperclip size={18}/>
                                    <input type="file" className="hidden" onChange={(e)=>setSelectedFile(e.target.files[0])}/>
                                </label>
                                
                                {isRecording ? (
                    <div className={`flex-1 flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-red-500/50 bg-red-500/10`}>
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-400 font-bold text-sm flex-1">{formatTime(recordingDuration)}</span>
                        <button onClick={stopRecording} className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-full transition-colors"><FaStop/></button>
                    </div>
                ) : enableGoogleSinhala ? (
                    <div className="flex-1 flex relative">
                        <style>{`
                            .google-sinhala-container > ul {
                                background-color: ${isDark ? '#1e293b' : '#ffffff'} !important;
                                border: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
                                border-radius: 0.75rem !important;
                                overflow: hidden !important;
                                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2) !important;
                                bottom: 100% !important;
                                top: auto !important;
                                margin-bottom: 8px !important;
                                padding: 0 !important;
                            }
                            .google-sinhala-container > ul > li {
                                padding: 10px 16px !important;
                                color: ${isDark ? '#f8fafc' : '#0f172a'} !important;
                                font-family: 'Inter', sans-serif !important;
                                border-bottom: 1px solid ${isDark ? '#334155' : '#f1f5f9'} !important;
                            }
                            .google-sinhala-container > ul > li:last-child {
                                border-bottom: none !important;
                            }
                            .google-sinhala-container > ul > li[style*="background-color"],
                            .google-sinhala-container > ul > li:hover {
                                background-color: ${isDark ? '#3b82f6' : '#eff6ff'} !important;
                                color: ${isDark ? '#ffffff' : '#1d4ed8'} !important;
                            }
                        `}</style>
                        <ReactTransliterate
                            value={newMessage}
                            onChangeText={(text) => {
                                const fakeEvent = { target: { value: text } };
                                handleInputChange(fakeEvent);
                            }}
                            lang="si"
                            maxOptions={5}
                            containerClassName="google-sinhala-container flex-1 flex w-full relative"
                            activeItemStyles={{}}
                            containerStyles={{}}
                            renderComponent={(props) => (
                                <textarea 
                                    {...props} 
                                    rows={Math.min(4, newMessage.split('\n').length)} 
                                    className={`flex-1 w-full px-5 py-3.5 rounded-2xl border focus:outline-none resize-none overflow-y-auto custom-scrollbar text-[15px] shadow-inner ${isDark ? 'bg-[#0f172a] text-white border-slate-700 focus:border-emerald-600 placeholder-slate-500' : 'bg-white text-slate-800 border-slate-300 focus:border-emerald-500 placeholder-slate-400'}`} 
                                />
                            )}
                            onKeyDown={handleKeyDown}
                            placeholder="Type with Google Sinhala..."
                        />
                    </div>
                ) : (
                    <textarea value={newMessage} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Type a message or / for quick replies..." rows={Math.min(4, newMessage.split('\n').length)} className={`flex-1 px-5 py-3.5 rounded-2xl border focus:outline-none resize-none overflow-y-auto custom-scrollbar text-[15px] shadow-inner ${isDark ? 'bg-[#0f172a] text-white border-slate-700 focus:border-emerald-600 placeholder-slate-500' : 'bg-white text-slate-800 border-slate-300 focus:border-emerald-500 placeholder-slate-400'}`} />
                )}

                                {!newMessage.trim() && !selectedFile ? (
                                    <button type="button" onClick={startRecording} className="p-4 bg-emerald-600/20 text-emerald-500 rounded-full hover:bg-emerald-600 hover:text-white transition-colors shadow-md"><FaMicrophone size={18}/></button>
                                ) : (
                                    <button onClick={(e) => handleSend(e)} disabled={isSending} className="p-4 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-colors shadow-xl disabled:opacity-50"><FaPaperPlane size={18} className={isSending ? 'animate-pulse' : ''}/></button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 bg-[#23303f] rounded-2xl flex flex-col items-center justify-center text-slate-500 shadow-xl border border-white/5 relative overflow-hidden group">
                        {/* Adding a dynamic background effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-75"></div>
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <MessageCircle className="text-6xl text-slate-600 mb-6 opacity-50 group-hover:scale-110 group-hover:text-blue-400 transition-all duration-500" />
                            <h2 className="text-xl font-semibold text-slate-300 tracking-wide">Select an inquiry to start</h2>
                            <p className="text-sm mt-2 text-slate-500 group-hover:text-slate-400 transition-colors">Choose a contact from the left panel</p>
                        </div>

                        {/* Powered By Section */}
                        <div className="absolute bottom-8 flex flex-col items-center animate-fade-in-up">
                            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase mb-2">Chat System By</span>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
                                    <FaBolt className="text-white text-[10px]" />
                                </div>
                                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-lg tracking-wider">
                                    LUMI AUTOMATIONS
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Right Side Panel */}
                {selectedInquiry && (
                    <div className={`${isMinimized ? 'w-[70px]' : 'w-[300px] xl:w-[320px]'} transition-all duration-300 ease-in-out bg-[#23303f] rounded-2xl flex flex-col shrink-0 overflow-hidden text-slate-400 border border-white/5 shadow-lg relative`}>
                        {isMinimized ? (
                            <div className="h-full w-full flex flex-col items-center py-6 cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => setIsMinimized(false)}>
                                <button className="p-2 bg-black/20 group-hover:bg-blue-600/20 rounded-full hover:text-white mb-6 text-slate-500 group-hover:text-blue-400 transition-colors">
                                    <FaChevronLeft size={16} />
                                </button>
                                <div className="w-12 h-12 bg-[#2a3942] rounded-full border border-slate-600 flex items-center justify-center text-xl font-bold shadow-md text-slate-300">
                                    {(selectedInquiry.student?.firstName || selectedInquiry.student?.name || selectedInquiry.name || 'S').charAt(0).toUpperCase()}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-[#1a2430] p-6 flex flex-col items-center justify-center border-b border-white/5 relative">
                                    <button onClick={() => setIsMinimized(true)} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full hover:bg-black/40 hover:text-white transition-colors text-slate-400">
                                        <FaChevronRight size={14}/>
                                    </button>
                                    <div className="w-20 h-20 bg-[#2a3942] rounded-full border border-slate-600 flex items-center justify-center text-3xl font-bold mb-3 shadow-md text-slate-300">
                                        {(selectedInquiry.student?.firstName || selectedInquiry.student?.name || selectedInquiry.name || 'S').charAt(0).toUpperCase()}
                                    </div>
                                    <h2 className="text-lg font-bold text-center text-slate-200">{selectedInquiry.student?.firstName || selectedInquiry.student?.name || selectedInquiry.name || 'Student'} {selectedInquiry.student?.lastName || ''}</h2>
                                    <div className="flex flex-col items-center gap-1 mt-2 text-xs bg-[#0b141a] px-4 py-2 rounded-xl border border-slate-700 text-emerald-400">
                                        <span className="flex items-center gap-1"><FaPhoneAlt size={10} /> {selectedInquiry.student?.phone || selectedInquiry.phone || 'No phone'}</span>
                                        {selectedInquiry.student?.optionalPhone && selectedInquiry.student.optionalPhone !== selectedInquiry.student.phone && (
                                            <span className="flex items-center gap-1"><FaPhoneAlt size={10} /> {selectedInquiry.student.optionalPhone} (WA)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#23303f]">
                                    <div className="bg-[#1a2430] p-4 rounded-xl border border-white/5 shadow-sm">
                                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">System Records</h3>
                                        
                                        {!studentInfo ? (
                                            <div className="animate-pulse flex flex-col gap-2">
                                                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                                                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-emerald-500 font-bold bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-900/50 text-xs">
                                                    <FaCheckCircle size={14}/> Registered Student
                                                </div>

                                                <div className="space-y-2.5">
                                                    <div className="text-xs">
                                                        <span className="text-slate-500 block mb-0.5">Full Name & ID</span>
                                                        <span className="text-slate-200 font-semibold">{studentInfo.firstName || studentInfo.name || selectedInquiry.name || 'Student'} {studentInfo.lastName || ''} (ID: {studentInfo.id})</span>
                                                    </div>
                                                    
                                                    {studentInfo.payments && studentInfo.payments.length > 0 ? (
                                                        studentInfo.payments.map((p, i) => (
                                                            <div key={i} className="mt-4">
                                                                <div className="text-xs mt-3 pt-3 border-t border-slate-700">
                                                                    <span className="text-slate-500 block mb-0.5"><FaGraduationCap className="inline mr-1"/> Enrollment</span>
                                                                    <span className="text-blue-300 font-bold block">{p.business?.name}</span>
                                                                    <span className="text-slate-400 block">{p.batch?.name}</span>
                                                                </div>
                                                                <div className="text-xs mt-3">
                                                                    <span className="text-slate-500 block mb-0.5"><FaCreditCard className="inline mr-1"/> Payment Option</span>
                                                                    <span className="text-emerald-400 font-semibold">{getPaymentOption(p)}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-xs text-slate-500 mt-2">No active enrollments</div>
                                                    )}
                                                </div>

                                                <div className="pt-4 mt-2 border-t border-slate-700 space-y-2">
                                                    <button onClick={handleGhostLogin} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                                                        <FaUserSecret size={14}/> Ghost Login
                                                    </button>
                                                    <button onClick={() => setShowResetModal(true)} className="w-full bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/30 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                                                        <FaKey size={12}/> Reset Password
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showResetModal && (
                <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2"><FaKey/> Reset Password</h3>
                            <button onClick={()=>{setShowResetModal(false); setLastResetPassword(null); setNewPassword('');}} className="text-slate-500 hover:text-white"><FaTimes/></button>
                        </div>
                        {lastResetPassword ? (
                            <div className="animate-in zoom-in duration-300">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center mb-4 shadow-inner">
                                    <FaCheckCircle className="text-emerald-400 mx-auto mb-2" size={28} />
                                    <p className="text-emerald-400 font-bold text-[10px] uppercase mb-1">Password Changed!</p>
                                    <p className="text-white text-lg font-mono tracking-widest bg-black/40 py-2 rounded-lg border border-white/5 mt-2 shadow-inner select-all">{lastResetPassword}</p>
                                </div>
                                <button onClick={copyToClipboard} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-lg uppercase">
                                    Copy Password & Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword}>
                                <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter new password" required className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg p-3 mb-4 text-sm outline-none focus:border-amber-500" />
                                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm shadow-lg">Confirm Reset</button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {ghostIframe && createPortal(
                <div className="fixed inset-0 z-[99999] pointer-events-none">
                    <div 
                        className="absolute pointer-events-auto bg-white flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.5)] border border-slate-600 rounded-2xl overflow-hidden"
                        style={{
                            left: `${iframePos.x}px`,
                            top: `${iframePos.y}px`,
                            width: '900px',
                            height: '600px',
                            resize: 'both',
                            minWidth: '400px',
                            minHeight: '300px'
                        }}
                    >
                        <div 
                            onMouseDown={handleDragStart}
                            className="w-full bg-[#1e293b] border-b border-slate-700 px-4 py-3 flex justify-between items-center z-10 shrink-0 cursor-move"
                        >
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                                    <FaArrowsAlt size={16} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Ghost Login Active</h3>
                                    <p className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest">Student View</p>
                                </div>
                            </div>
                            <button 
                                onMouseDown={(e) => e.stopPropagation()} 
                                onClick={closeGhostLogin} 
                                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all text-xs uppercase tracking-widest"
                            >
                                <FaTimes size={12} /> Close
                            </button>
                        </div>
                        <div className="flex-1 w-full bg-[#f8fafc]">
                            <iframe src={ghostIframe} className="w-full h-full border-none" title="Ghost Login View"></iframe>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

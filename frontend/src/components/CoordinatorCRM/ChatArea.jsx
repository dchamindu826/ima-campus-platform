import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { ReactTransliterate } from 'react-transliterate';
import 'react-transliterate/dist/index.css';
import axios from '../../api/axios';
import { resolveAvatarUrl } from '../../utils/avatarUtils';
import { FaPaperPlane, FaPaperclip, FaSun, FaMoon, FaMicrophone, FaReply, FaTimes, FaImage, FaFilePdf, FaBolt, FaMagic, FaVideo, FaMusic, FaSmile, FaStop, FaPhoneAlt, FaChevronDown, FaGoogle, FaBan, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';
import englishWords from '../../utils/englishWords.json';
import OutboundDialerModal from '../AfterSeminarCRM/CRM/OutboundDialerModal';
import { useCall } from '../../contexts/CallContext';

const englishDictionary = new Set(englishWords.map(w => w.toLowerCase()));
// Words that are technically English but used heavily in Singlish, so they SHOULD translate to Sinhala
const singlishOverlap = new Set(['mm', 'wen', 'una', 'an', 'man', 'api', 'ai', 'paw', 'me', 'do', 'to', 'is', 'was', 'are', 'am', 'a', 'i', 'he', 'she', 'it', 'we', 'they', 'you']);

// Overrides for common Singlish words that Google Input Tools struggles with (especially with Aelapilla words)
const singlishOverrides = {
    'naa': 'නෑ', 'nae': 'නෑ', 'naae': 'නෑ',
    'baa': 'බෑ', 'bae': 'බෑ', 'baae': 'බෑ',
    'kaa': 'කෑ', 'kae': 'කෑ', 'kaae': 'කෑ',
    'gaa': 'ගෑ', 'gae': 'ගෑ', 'gaae': 'ගෑ',
    'maa': 'මෑ', 'mae': 'මෑ', 'maae': 'මෑ',
    'paa': 'පෑ', 'pae': 'පෑ', 'paae': 'පෑ',
    'raa': 'රෑ', 'rae': 'රෑ', 'raae': 'රෑ',
    'daa': 'දෑ', 'dae': 'දෑ', 'daae': 'දෑ',
    'taa': 'ටෑ', 'tae': 'ටෑ', 'taae': 'ටෑ',
    'saa': 'සෑ', 'sae': 'සෑ', 'saae': 'සෑ',
    'haa': 'හෑ', 'hae': 'හෑ', 'haae': 'හෑ',
    'waa': 'වෑ', 'wae': 'වෑ', 'waae': 'වෑ',
    'yaa': 'යෑ', 'yae': 'යෑ', 'yaae': 'යෑ',
    'nahe': 'නැහැ', 'naha': 'නැහැ', 'naehe': 'නැහැ',
    'bahe': 'බැහැ', 'baha': 'බැහැ', 'baehe': 'බැහැ',
    'ne': 'නේ', 'neda': 'නේද', 'nedha': 'නේද',
    'nadda': 'නැද්ද', 'nedda': 'නැද්ද', 'naedda': 'නැද්ද',
    'dakkda': 'දැක්කද', 'dakkada': 'දැක්කද', 'daekkada': 'දැක්කද', 'dekkada': 'දැක්කද',
    'kariya': 'කැරියා', 'kariyaa': 'කැරියා', 'kaeriya': 'කැරියා', 'kaeriyaa': 'කැරියා',
    'eka': 'එක', 'ekak': 'එකක්', 'eke': 'එකේ', 'ekanm': 'එකනම්',
    'nam': 'නම්', 'kyla': 'කියලා', 'kiyala': 'කියලා'
};

const BACKEND_URL = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : 'https://imacampus.online'; 

const formatDateLabel = (dateString) => {
    const msgDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return msgDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
};

const getCountdownText = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    const diff = expiry - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d left`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h left`;
};

// WhatsApp UI Elements
const WhatsAppDoubleCheck = ({ className = "text-[#53bdeb]" }) => (
    <svg viewBox="0 0 16 11" width="16" height="11" fill="none" className={className}>
        <path d="M11.07 0.93a.75.75 0 0 0-1.06 0L5.3 5.64 3.73 4.07a.75.75 0 0 0-1.06 1.06l2.1 2.1a.75.75 0 0 0 1.06 0l5.24-5.24a.75.75 0 0 0 0-1.06z" fill="currentColor"/>
        <path d="M14.57 0.93a.75.75 0 0 0-1.06 0L8.8 5.64l.53.53a.75.75 0 0 0 1.06 0l4.18-4.18a.75.75 0 0 0 0-1.06z" fill="currentColor"/>
    </svg>
);

const WhatsAppTailIn = ({ isDark }) => (
    <svg viewBox="0 0 8 13" height="13" width="8" className={`absolute -top-[1px] -left-2 z-10 ${isDark ? 'text-[#202c33]' : 'text-white'}`}>
        <path fill="currentColor" d="M1.533 2.568 8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z"/>
    </svg>
);

const WhatsAppTailOut = ({ isDark }) => (
    <svg viewBox="0 0 8 13" height="13" width="8" className={`absolute -top-[1px] -right-2 z-10 ${isDark ? 'text-[#005c4b]' : 'text-[#d9fdd3]'}`}>
        <path fill="currentColor" d="M6.467 2.568 0 11.193V0h5.188c1.77 0 2.338 1.156 1.279 2.568z"/>
    </svg>
);

const WhatsAppDoodlePattern = ({ isDark }) => (
    <div 
        className="absolute inset-0 pointer-events-none z-0 overflow-hidden" 
        style={{
            backgroundColor: isDark ? '#0b141a' : '#efeae2',
            backgroundImage: `url(${isDark ? '/whatsapp-bg-dark.png' : '/whatsapp-bg-light.png'})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '380px 698px'
        }}
    />
);

export default function ChatArea({ selectedLead, businessId }) {
  const { socket } = useCall();
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatTheme, setChatTheme] = useState(() => localStorage.getItem('free_seminar_chat_theme') || 'dark'); 

  const toggleTheme = () => {
    setChatTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('free_seminar_chat_theme', next);
      return next;
    });
  };

  const [showCallMenu, setShowCallMenu] = useState(false);
  const [showDialerModal, setShowDialerModal] = useState(false);
  const scrollRef = useRef(null);
  
  // 🔥 අලුතින් දාපු Ref එක (User උඩට Scroll කරලාද ඉන්නේ කියලා බලන්න)
  const isUserScrolledUp = useRef(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [isSendingCallReq, setIsSendingCallReq] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  
  const [localReactions, setLocalReactions] = useState({});
  const [enableSinhala, setEnableSinhala] = useState(false);
  const [enableGoogleSinhala, setEnableGoogleSinhala] = useState(false);

  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [suggestedQRs, setSuggestedQRs] = useState([]);
  const [newQRName, setNewQRName] = useState('');
  const [newQRMsg, setNewQRMsg] = useState('');
  const [qrAttachmentBase64, setQrAttachmentBase64] = useState(null); 

  const [showMetaTemplates, setShowMetaTemplates] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState([]);

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef(null);
  const audioChunks = useRef([]);

  // 🛑 BLOCK CONTACT STATE
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedBlockReason, setSelectedBlockReason] = useState('Spam / Marketing');
  const [customBlockReason, setCustomBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // 👤 Contact DP / Profile Picture State
  const [contactAvatarUrl, setContactAvatarUrl] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!selectedLead?.phone) {
      setContactAvatarUrl(null);
      return;
    }

    // 1. Immediately set the auto-allocated avatar or existing lead avatar
    const initialAvatar = resolveAvatarUrl(
      selectedLead.avatar || selectedLead.image || selectedLead.profilePic,
      selectedLead.phone,
      axios.defaults.baseURL
    );
    setContactAvatarUrl(initialAvatar);

    // 2. Fetch student details to check if the student has uploaded their own custom photo
    const token = localStorage.getItem('token');
    const cleanPhone = String(selectedLead.phone).split('_')[0].trim();
    axios.get(`/coordinator-crm/lead-details/${cleanPhone}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!isMounted) return;
        const student = res.data?.student;
        const img = student?.image;
        if (img && img !== 'default.png' && img !== 'null') {
          setContactAvatarUrl(resolveAvatarUrl(img, cleanPhone, axios.defaults.baseURL));
          window.dispatchEvent(new CustomEvent('lead-avatar-updated', {
            detail: { phone: cleanPhone, rawPhone: selectedLead?.rawPhone || selectedLead?.phone, avatar: img }
          }));
        } else if (student?.appChatDp) {
          setContactAvatarUrl(resolveAvatarUrl(`chat_dps/${student.appChatDp}`, cleanPhone, axios.defaults.baseURL));
          window.dispatchEvent(new CustomEvent('lead-avatar-updated', {
            detail: { phone: cleanPhone, rawPhone: selectedLead?.rawPhone || selectedLead?.phone, avatar: `chat_dps/${student.appChatDp}` }
          }));
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [selectedLead?.id, selectedLead?.phone]);

  useEffect(() => {
      const fetchQuickReplies = async () => {
          try {
              const token = localStorage.getItem('token');
              
              // --- MIGRATION LOGIC ---
              const localKey = `qr_${user.id}`;
              const localQRs = localStorage.getItem(localKey);
              if (localQRs) {
                  try {
                      const parsedQRs = JSON.parse(localQRs);
                      if (Array.isArray(parsedQRs) && parsedQRs.length > 0) {
                          for (const qr of parsedQRs) {
                              try {
                                  await axios.post('/coordinator-crm/quick-replies', {
                                      name: qr.name,
                                      message: qr.message,
                                      attachment: qr.attachment || null
                                  }, { headers: { Authorization: `Bearer ${token}` } });
                              } catch (e) { console.error("Migrate QR error", e); }
                          }
                      }
                  } catch (e) { console.error(e); }
                  localStorage.removeItem(localKey);
              }
              // -----------------------

              const response = await axios.get('/coordinator-crm/quick-replies', {
                  headers: { Authorization: `Bearer ${token}` }
              });
              setQuickReplies(response.data);
          } catch (error) { console.error("Error fetching QR:", error); }
      };
      fetchQuickReplies();
  }, []);

  useEffect(() => {
    if (!selectedLead) return;
    setIsBlocked(!!selectedLead.isBlocked);
    setBlockedReason(selectedLead.blockedReason || '');

    if (!socket) return;

    const handlePermissionUpdate = (data) => {
      if (data && (data.leadId === selectedLead.id || data.phone === selectedLead.phone)) {
        if (data.status) selectedLead.waCallPermissionStatus = data.status;
        else selectedLead.waCallPermissionStatus = 'ALLOWED';
        selectedLead.waCallPermissionExpiry = data.expiry || null;
        setMessages(prev => [...prev]);
      }
    };

    const handleLeadBlocked = (data) => {
      if (data && (data.leadId === selectedLead.id || data.phone === selectedLead.phone?.split('_')[0])) {
        setIsBlocked(true);
        setBlockedReason(data.reason || 'Blocked');
        selectedLead.isBlocked = true;
        selectedLead.blockedReason = data.reason || 'Blocked';
      }
    };

    const handleLeadUnblocked = (data) => {
      if (data && (data.leadId === selectedLead.id || data.phone === selectedLead.phone?.split('_')[0])) {
        setIsBlocked(false);
        setBlockedReason('');
        selectedLead.isBlocked = false;
        selectedLead.blockedReason = '';
      }
    };

    socket.on('wa_call_permission_granted', handlePermissionUpdate);
    socket.on('wa_call_permission_updated', handlePermissionUpdate);
    socket.on('lead_blocked', handleLeadBlocked);
    socket.on('lead_unblocked', handleLeadUnblocked);

    return () => {
      socket.off('wa_call_permission_granted', handlePermissionUpdate);
      socket.off('wa_call_permission_updated', handlePermissionUpdate);
      socket.off('lead_blocked', handleLeadBlocked);
      socket.off('lead_unblocked', handleLeadUnblocked);
    };
  }, [socket, selectedLead]);

  const handleBlockConfirm = async () => {
      const reasonToSave = selectedBlockReason === 'Other' ? (customBlockReason.trim() || 'Other reason') : selectedBlockReason;
      setIsBlocking(true);
      try {
          const token = localStorage.getItem('token');
          await axios.post('/coordinator-crm/leads/block', {
              leadId: selectedLead.id,
              phone: selectedLead.phone,
              reason: reasonToSave
          }, { headers: { Authorization: `Bearer ${token}` } });

          setIsBlocked(true);
          setBlockedReason(reasonToSave);
          if (selectedLead) {
              selectedLead.isBlocked = true;
              selectedLead.blockedReason = reasonToSave;
          }
          setShowBlockModal(false);
          setCustomBlockReason('');
          toast.success(`Number ${selectedLead.phone} has been blocked.`);
      } catch (err) {
          toast.error(err.response?.data?.error || "Failed to block number.");
      } finally {
          setIsBlocking(false);
      }
  };

  const handleUnblockConfirm = async () => {
      if (!window.confirm(`Are you sure you want to unblock ${selectedLead.phone}?`)) return;
      setIsBlocking(true);
      try {
          const token = localStorage.getItem('token');
          await axios.post('/coordinator-crm/leads/unblock', {
              leadId: selectedLead.id,
              phone: selectedLead.phone
          }, { headers: { Authorization: `Bearer ${token}` } });

          setIsBlocked(false);
          setBlockedReason('');
          if (selectedLead) {
              selectedLead.isBlocked = false;
              selectedLead.blockedReason = '';
          }
          toast.success(`Number ${selectedLead.phone} has been unblocked.`);
      } catch (err) {
          toast.error(err.response?.data?.error || "Failed to unblock number.");
      } finally {
          setIsBlocking(false);
      }
  };

  useEffect(() => { 
      if (selectedLead) {
          fetchMessages(); 
          fetchMetaTemplates();
          const interval = setInterval(() => { fetchMessages(false); }, 10000);
          return () => clearInterval(interval);
      }
  }, [selectedLead]);

  // 🔥 FIX: User උඩට Scroll කරලා නැත්නම් විතරක් පල්ලෙහාට Scroll වෙන්න හදලා තියෙන්නේ
  useEffect(() => { 
      if (scrollRef.current && !isUserScrolledUp.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
      }
  }, [messages, localReactions]);

  // 🔥 FIX: Scroll කරනකොට අල්ලගන්න Function එක
  const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      isUserScrolledUp.current = scrollHeight - (scrollTop + clientHeight) > 100;
  };

  const fetchMessages = async (showLoading = true) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/coordinator-crm/messages/${selectedLead.id}`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchMetaTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const bizId = businessId || selectedLead?.batch?.businessId || selectedLead?.businessId;

      const res = await axios.get('/coordinator-crm/meta-templates', {
          headers: { Authorization: `Bearer ${token}` },
          params: bizId ? { businessId: bizId } : {}
      });
      setMetaTemplates(res.data || []);
    } catch(e) {}
  };

  const handleQRFile = (e) => {
      const file = e.target.files[0];
      if(!file) return;
      if(file.size > 2 * 1024 * 1024) return toast.error("File too large for Quick Reply (Max 2MB)"); 
      const reader = new FileReader();
      reader.onloadend = () => { setQrAttachmentBase64(reader.result); };
      reader.readAsDataURL(file);
  };

  const handleReaction = async (msg, emoji) => {
      if (!msg.metaMessageId) return toast.error("Cannot react: This is an older message.");
      try {
          const token = localStorage.getItem('token');
          setLocalReactions(prev => ({ ...prev, [msg.id]: emoji }));
          await axios.post('/coordinator-crm/messages/react', {
              leadId: selectedLead.id,
              metaMessageId: msg.metaMessageId,
              emoji: emoji
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });
      } catch (error) {
          toast.error("Reaction failed!");
      }
  };

  // 🔥 FIX: හරියටම වැඩ කරන Dynamic Audio Recording Logic එක 
  const startRecording = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error("MediaDevices API is completely blocked by the browser.");
          toast.error("Microphone is blocked! Please check browser permissions.", { duration: 4000 });
          return;
      }

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Browser එක Support කරන හොදම Format එක තෝරගන්නවා
          let options = {};
          if (MediaRecorder.isTypeSupported('audio/webm')) {
              options = { mimeType: 'audio/webm' };
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: 'audio/mp4' }; 
          }

          const recorder = new MediaRecorder(stream, options);
          audioChunks.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunks.current.push(e.data);
          };

          recorder.onstop = () => {
            const currentMimeType = recorder.mimeType || 'audio/mp4';
            const ext = currentMimeType.includes('mp4') ? 'mp4' : 'webm';
            const audioBlob = new Blob(audioChunks.current, { type: currentMimeType });
            
            const audioFile = new File([audioBlob], `Voice_Note_${Date.now()}.${ext}`, { 
                type: currentMimeType,
                lastModified: Date.now()
            });
            
            setSelectedFile(audioFile); 
          };

          recorder.start();
          setMediaRecorder(recorder);
          setIsRecording(true);
          setRecordingDuration(0);

          timerRef.current = setInterval(() => {
              setRecordingDuration(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Mic error:", err);
          toast.error("Microphone access denied! Please allow mic permissions in your browser.");
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

  const handleSendTemplate = async (tpl) => {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      setIsSending(true);
      try {
          const formData = new FormData();
          formData.append('leadId', selectedLead.id);
          formData.append('senderName', user.firstName || 'Staff');
          formData.append('message', `[Template Output] ${tpl.name}`); 
          formData.append('localUIMessage', `[Template Output] ${tpl.name}`);
          
          formData.append('isTemplate', 'true');
          formData.append('templateName', tpl.name);
          formData.append('templateLanguage', tpl.language || 'en');

          const token = localStorage.getItem('token');
          const res = await axios.post('/coordinator-crm/messages', formData, { 
              headers: { 
                  'Content-Type': 'multipart/form-data',
                  'Authorization': `Bearer ${token}` 
              } 
          });
          
          setMessages(prev => [...prev, res.data]);
          setShowMetaTemplates(false);
          toast.success("Meta Template Sent!");

          isUserScrolledUp.current = false;
          setTimeout(() => {
             if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 100);
      } catch (error) {
          console.error(error);
          toast.error(error.response?.data?.error || "Failed to send template.");
      } finally {
          isSendingRef.current = false;
          setIsSending(false);
      }
  };

  const handleSendCallPermissionRequest = async () => {
      if (isSendingCallReq) return;
      setIsSendingCallReq(true);
      try {
          const token = localStorage.getItem('token');
          await axios.post('/coordinator-crm/leads/send-call-request', 
              { leadId: selectedLead.id },
              { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success("Call Permission Request (with buttons) sent to WhatsApp!");
      } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.error || "Failed to send call permission request.");
      } finally {
          setIsSendingCallReq(false);
      }
  };

  const handleManualGrantPermission = async (allowType = 'ALWAYS') => {
      try {
          const token = localStorage.getItem('token');
          const res = await axios.post('/admin/whatsapp-call/manual-grant-permission', {
              leadId: selectedLead?.id,
              phone: selectedLead?.phone,
              allowType: allowType
          }, { headers: { Authorization: `Bearer ${token}` } });
          
          toast.success(allowType === 'TEMP' ? "Temp Allow (7 Days Countdown) granted!" : "Always Allow granted!");
          if (selectedLead && res.data.lead) {
              selectedLead.waCallPermissionStatus = 'ALLOWED';
              selectedLead.waCallPermissionExpiry = res.data.lead.waCallPermissionExpiry;
          }
      } catch (err) {
          toast.error("Failed to grant permission manually");
      }
  };

  const handleSend = async (e, forcedText = null, forcedFileBase64 = null) => {
    if (e) e.preventDefault();
    if (isSendingRef.current) return; // Prevent multiple clicks/enters synchronously
    
    const textToSend = forcedText || newMessage;
    if (!textToSend.trim() && !selectedFile && !forcedFileBase64) return;

    isSendingRef.current = true;
    setIsSending(true);
    const targetLeadId = selectedLead.id; 

    try {
      const formData = new FormData();
      formData.append('leadId', targetLeadId);
      const isCallCenterAgent = user?.role?.toUpperCase().replace(/ /g, '_') === 'CALL_CENTER_AGENT';
      formData.append('senderName', isCallCenterAgent ? 'Caller' : (user.firstName || 'Staff'));
      
      const cleanMessage = textToSend.replace(/^\[Replying to: ".*?"\]\n\n/, '');
      formData.append('message', cleanMessage); 
      
      if (replyingTo) {
          if (replyingTo.metaMessageId) {
              formData.append('replyToMetaId', replyingTo.metaMessageId);
          }
          const quotedText = replyingTo.message ? replyingTo.message.replace(/\n/g, ' ').substring(0, 30) : 'Media Message';
          const uiMessage = `[Replying to: "${quotedText}..."]\n\n${cleanMessage}`;
          formData.append('localUIMessage', uiMessage); 
      } else {
          formData.append('localUIMessage', cleanMessage); 
      }

      if (selectedFile) {
          formData.append('media', selectedFile);
      } else if (forcedFileBase64) {
          const res = await fetch(forcedFileBase64);
          const blob = await res.blob();
          
          let mimeType = "image/jpeg";
          let ext = "jpeg";
          if (forcedFileBase64.startsWith("data:")) {
              mimeType = forcedFileBase64.split(";")[0].split(":")[1];
              ext = mimeType.split("/")[1] || "jpeg";
              if(ext === 'mpeg') ext = 'mp3';
              if(ext.includes('ogg')) ext = 'ogg';
          }
          
          const file = new File([blob], `qr_attach.${ext}`, { type: mimeType });
          formData.append('media', file);
      }

      const token = localStorage.getItem('token');
      const res = await axios.post('/coordinator-crm/messages', formData, { 
          headers: { 
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}` 
          } 
      });
      
      if (selectedLead.id === targetLeadId) {
          setMessages([...messages, res.data]);
      }
      
      
      setNewMessage(''); setReplyingTo(null); setSelectedFile(null); setSuggestedQRs([]); setRecordingDuration(0);
      isSendingRef.current = false;
      
      // අලුත් මැසේජ් එකක් යැව්වම අනිවාර්යෙන් පල්ලෙහාට යන්න ඕනේ
      isUserScrolledUp.current = false;
      setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);

    } catch (error) { toast.error("Failed to send message."); isSendingRef.current = false; }
    setIsSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    let val = e.target.value;
    const isAddingSpace = val.endsWith(' ') && val.length > newMessage.length;
    
    setNewMessage(val);

    if (val.startsWith('/')) {
        const keyword = val.substring(1).toLowerCase();
        setSuggestedQRs(quickReplies.filter(qr => qr.name.toLowerCase().includes(keyword)));
    } else {
        setSuggestedQRs([]);
    }

    // Auto convert Singlish to Sinhala using Google API when user types a space
    if (enableSinhala && isAddingSpace && val.trim().length > 0) {
        const words = val.split(' ');
        if (words.length >= 2) {
            const lastWord = words[words.length - 2];
            
            // Check if it's a word with alphabetic characters
            if (lastWord && /^[a-zA-Z]+$/.test(lastWord)) {
                // Rule 1: Skip if ALL CAPS
                if (lastWord === lastWord.toUpperCase()) {
                    return;
                }
                
                // Rule 2: Skip if it's an English word (class, coordination, etc)
                // EXCEPT if it's a common Singlish word (like 'una', 'wen', 'man')
                if (englishDictionary.has(lastWord.toLowerCase()) && !singlishOverlap.has(lastWord.toLowerCase())) {
                    return;
                }

                // If not English and not caps, translate!
                const targetIndex = val.lastIndexOf(lastWord + ' ');
                if (targetIndex !== -1) {
                    const lWordLower = lastWord.toLowerCase();
                    
                    // Check if we have a direct override for this word to fix Google API's shortcomings
                    if (singlishOverrides[lWordLower]) {
                        const translatedWord = singlishOverrides[lWordLower];
                        setNewMessage(prev => {
                            if (prev.substring(targetIndex, targetIndex + lastWord.length + 1) === lastWord + ' ') {
                                return prev.substring(0, targetIndex) + translatedWord + ' ' + prev.substring(targetIndex + lastWord.length + 1);
                            }
                            return prev;
                        });
                        return; // Skip Google API
                    }

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

  const applyQuickReply = (qr) => {
    if (qr.attachment) handleSend(null, qr.message, qr.attachment);
    else setNewMessage(qr.message);
    setSuggestedQRs([]);
  };

  const saveQuickReply = async (e) => {
      e.preventDefault();
      if(!newQRName || (!newQRMsg && !qrAttachmentBase64)) return;
      
      try {
          const token = localStorage.getItem('token');
          const response = await axios.post('/coordinator-crm/quick-replies', {
              name: newQRName,
              message: newQRMsg,
              attachment: qrAttachmentBase64
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });
          
          setQuickReplies(prev => [response.data, ...prev]); 
          setNewQRName(''); setNewQRMsg(''); setQrAttachmentBase64(null); 
          toast.success("Quick Reply Saved!");
      } catch (err) {
          toast.error("Failed to save. Try a smaller audio/image file.");
      }
  };

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
  };

  const renderMedia = (msg) => {
      if (!msg.mediaUrl) return null;
      const url = msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${BACKEND_URL}${msg.mediaUrl}`; 
      
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
  
  // 🔥 FIX: Hide "IMAGE Message" placeholders if media exists
  const renderMessageText = (msg) => {
      const text = msg.message;
      if (!text) return null;

      // Hide auto-generated media labels
      if (msg.mediaUrl && ["IMAGE Message", "AUDIO Message", "VIDEO Message", "DOCUMENT Message"].includes(text)) {
          return null; 
      }

      let quotedText = null;
      let actualMessage = text;

      if (text.startsWith('[Replying to: "')) {
          const closingQuoteIdx = text.indexOf('"]\n\n');
          if (closingQuoteIdx !== -1) {
              quotedText = text.substring(15, closingQuoteIdx);
              actualMessage = text.substring(closingQuoteIdx + 4).trim();
          }
      }

      if (quotedText) {
          return (
              <div className="flex flex-col w-full min-w-[200px]">
                  <div className="bg-black/10 dark:bg-black/30 border-l-4 border-emerald-500 rounded p-2.5 mb-1.5 shadow-sm w-full relative overflow-hidden">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block mb-0.5">Replying to</span>
                      <span className="text-[13px] text-slate-700 dark:text-slate-300 line-clamp-2 italic">{quotedText}</span>
                  </div>
                  <span className="whitespace-pre-wrap">{actualMessage}</span>
              </div>
          );
      }

      return <span className="whitespace-pre-wrap">{text}</span>;
  };

  const groupedMessages = messages.reduce((acc, msg) => {
      const dateLabel = formatDateLabel(msg.createdAt);
      if (!acc[dateLabel]) acc[dateLabel] = [];
      acc[dateLabel].push(msg);
      return acc;
  }, {});

  const { startOutboundCall } = useCall();

  const isDark = chatTheme === 'dark';
  const isCallAllowed = selectedLead?.waCallPermissionStatus === 'ALLOWED';
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  return (
    <div className={`flex-1 flex flex-col rounded-2xl overflow-hidden shrink-0 shadow-xl border relative font-sans select-text ${
      isDark ? 'bg-[#0b141a] border-[#222d34] text-[#e9edef]' : 'bg-[#efeae2] border-[#d1d7db] text-[#111b21]'
    }`}>
      {/* 🌟 Fixed WhatsApp Doodle Wallpaper (Never scrolls with messages) 🌟 */}
      <WhatsAppDoodlePattern isDark={isDark} />
      
      {/* WhatsApp Header */}
      <div className={`px-4 py-2.5 flex justify-between items-center border-b z-20 transition-colors ${
        isDark ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#e9edef]'
      }`}>
        {/* Left Side: Avatar & Contact Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {contactAvatarUrl ? (
              <img 
                src={contactAvatarUrl} 
                alt={selectedLead.name || 'Contact'} 
                className="w-10 h-10 rounded-full object-cover shadow-sm border border-emerald-500/30"
                onError={() => {
                  setContactAvatarUrl(resolveAvatarUrl(null, selectedLead.phone, axios.defaults.baseURL));
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm bg-[#00a884]">
                {selectedLead.name ? selectedLead.name.charAt(0).toUpperCase() : '#'}
              </div>
            )}
            <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#202c33] absolute bottom-0 right-0"></span>
          </div>

          <div className="min-w-0">
            <h3 className={`font-bold text-sm sm:text-base leading-tight truncate ${isDark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
              {selectedLead.name || selectedLead.phone}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-normal truncate ${isDark ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                {selectedLead.phone}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#00a884]/15 text-[#00a884]">
                Live Gateway
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Actions (Call, Templates, Block, Theme Toggle) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* WhatsApp Call Button */}
          <button 
            type="button"
            onClick={() => {
              if (!isCallAllowed) {
                toast.error("WhatsApp call permission is not approved by this customer yet. Send a Call Request template first.", { id: 'wa-call-perm' });
                return;
              }
              if (startOutboundCall) {
                startOutboundCall({ 
                  lead: selectedLead, 
                  businessId: selectedLead?.batch?.businessId || businessId, 
                  campaignType: selectedLead?.campaignType || 'FREE_SEMINAR' 
                });
              } else {
                setShowDialerModal(true);
              }
            }} 
            className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
              isCallAllowed 
                ? 'bg-[#00a884] hover:bg-[#02906f] text-white shadow-sm cursor-pointer active:scale-95' 
                : isDark 
                  ? 'bg-[#00a884]/20 text-white/40 opacity-40 cursor-not-allowed border border-white/5' 
                  : 'bg-[#00a884]/15 text-[#00a884]/50 opacity-45 cursor-not-allowed border border-[#00a884]/20'
            }`}
            title={isCallAllowed ? "Make WhatsApp Call" : "WhatsApp Call permission not approved yet"}
          >
            <FaPhoneAlt size={12}/> WhatsApp Call
            {selectedLead?.waCallPermissionExpiry ? (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                {getCountdownText(selectedLead.waCallPermissionExpiry)}
              </span>
            ) : isCallAllowed ? (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                Always Allowed
              </span>
            ) : null}
          </button>

          <button 
            onClick={() => setShowMetaTemplates(true)} 
            className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
              isDark 
                ? 'bg-[#111b21] hover:bg-[#2a3942] text-emerald-400 border border-white/10' 
                : 'bg-white hover:bg-slate-100 text-emerald-700 border border-slate-300'
            }`}
          >
            <FaBolt size={12}/> Approved Templates
          </button>
          
          {/* 🛑 BLOCK / UNBLOCK BUTTON */}
          {isBlocked ? (
            <button 
              onClick={handleUnblockConfirm} 
              disabled={isBlocking}
              className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm bg-red-600 hover:bg-red-500 text-white"
              title="Click to unblock this number"
            >
              <FaBan size={12}/> Blocked (Unblock)
            </button>
          ) : (
            <button 
              onClick={() => setShowBlockModal(true)} 
              className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                isDark 
                  ? 'bg-[#111b21] hover:bg-red-600/30 text-slate-300 hover:text-red-400 border border-white/10' 
                  : 'bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-300'
              }`}
              title="Block this number"
            >
              <FaBan size={12} className="text-red-500"/> Block
            </button>
          )}

          {/* 🌓 CHAT AREA ONLY DARK / LIGHT TOGGLE BUTTON */}
          <button 
            type="button"
            onClick={toggleTheme} 
            title={isDark ? "Switch Chat to WhatsApp Light Mode" : "Switch Chat to WhatsApp Dark Mode"}
            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm ${
              isDark 
                ? 'bg-[#111b21] hover:bg-[#2a3942] text-amber-400 border border-white/10' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            {isDark ? <FaSun size={14} className="text-amber-400" /> : <FaMoon size={14} className="text-slate-600" />}
            <span className="hidden sm:inline font-semibold">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      {/* 🛑 BLOCKED CONTACT SPLASH OR ACTIVE CHAT 🛑 */}
      {isBlocked ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none relative z-10 bg-transparent">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-5 shadow-2xl animate-pulse">
              <FaBan size={36} />
            </div>
            <h3 className={`text-2xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>This Contact is Blocked</h3>
            <p className="text-sm text-slate-400 max-w-md mb-3 font-medium">
              Incoming and outgoing WhatsApp messages, calls, and automations are rejected for this number.
            </p>
            {blockedReason && (
              <div className="mb-6 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold max-w-md shadow-sm">
                Reason: <span className="font-bold text-white">{blockedReason}</span>
              </div>
            )}
            <button 
              onClick={handleUnblockConfirm} 
              disabled={isBlocking}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black rounded-2xl transition-all shadow-xl shadow-rose-600/30 flex items-center gap-2 uppercase tracking-wider"
            >
              <FaBan size={14} /> Unblock Contact to Enable Chat
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Area (Wallpaper stays fixed behind transparent scrolling messages) */}
          <div 
            className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar relative z-10 flex flex-col bg-transparent" 
            ref={scrollRef} 
            onScroll={handleScroll}
          >
            <div className="relative z-10 flex flex-col w-full">
              {/* WhatsApp Encrypted Security Banner */}
              <div className={`px-4 py-1.5 rounded-lg text-xs font-medium max-w-xl mx-auto flex items-center justify-center gap-2 shadow-xs text-center my-2 select-none border ${
                isDark ? 'bg-[#182229] border-[#222d34] text-[#ffd279]' : 'bg-[#ffeecd] border-[#ffecb3] text-[#54656f]'
              }`}>
                <FaLock size={11} className="text-amber-500 shrink-0"/>
                <span>Messages are end-to-end encrypted. Reply window: {selectedLead?.isOptedOut ? 'Closed (meta templates)' : 'Open (WhatsApp)'}</span>
              </div>

              {Object.keys(groupedMessages).map(dateLabel => (
                <React.Fragment key={dateLabel}>
                  {/* Date Pill */}
                  <div className="flex justify-center my-3 select-none">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm border ${
                      isDark ? 'bg-[#182229] text-[#8696a0] border-[#222d34]' : 'bg-white text-[#54656f] border-slate-200'
                    }`}>
                      {dateLabel}
                    </span>
                  </div>

                  {groupedMessages[dateLabel].map((msg, idx) => {
                    const isOutbound = msg.direction === 'outbound';
                    const isSticker = (msg.mediaUrl && msg.mediaUrl.endsWith('.webp')) || msg.mediaType?.includes('webp');
                    const currentReaction = localReactions[msg.id]; 

                    if (msg.message && msg.message.startsWith('[Reaction:') && msg.message.endsWith(']')) return null;

                    return (
                      <div key={idx} className="flex flex-col mb-2 group w-full">
                        {isOutbound ? (
                          /* OUTGOING (STAFF / AI / SYSTEM) MESSAGE */
                          <div className="flex items-start gap-1.5 ml-auto justify-end max-w-[88%] sm:max-w-[70%]">
                            {/* Hover Actions for Outbound */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center pt-1">
                              <button 
                                type="button" 
                                onClick={() => setReplyingTo(msg)} 
                                className={`p-1.5 rounded-full transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-white/10' : 'text-slate-500 hover:text-blue-600 hover:bg-black/5'
                                }`}
                                title="Reply"
                              >
                                <FaReply size={13}/>
                              </button>
                            </div>

                            <div className="relative group/bubble">
                              {!isSticker && <WhatsAppTailOut isDark={isDark} />}
                              <div
                                onDoubleClick={() => setReplyingTo(msg)}
                                className={`px-3.5 py-2 text-[14.5px] cursor-pointer select-text relative leading-relaxed ${
                                  isSticker 
                                    ? 'bg-transparent shadow-none p-0' 
                                    : isDark 
                                      ? 'bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-none shadow-[0_1px_0.5px_rgba(0,0,0,0.3)] border border-[#005c4b]' 
                                      : 'bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-none shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-[#c7f0bf]'
                                }`}
                              >
                                {!isSticker && (
                                  <div className={`text-[11px] font-bold mb-1 flex items-center justify-end gap-1 ${
                                    isDark ? 'text-[#25d366]' : 'text-[#008069]'
                                  }`}>
                                    {msg.senderType === 'AI_BOT' ? '🤖 AI Bot' : msg.senderType === 'SYSTEM' ? '⚙️ Auto-Reply' : `👤 ${msg.senderName}`}
                                  </div>
                                )}

                                {renderMedia(msg)}
                                {!isSticker && renderMessageText(msg)}

                                {!isSticker && (
                                  <span className={`text-[11px] float-right mt-1.5 ml-3 font-normal select-none flex items-center gap-1 ${
                                    isDark ? 'text-[#8696a0]' : 'text-[#667781]'
                                  }`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <WhatsAppDoubleCheck className="text-[#53bdeb] shrink-0" />
                                  </span>
                                )}
                              </div>

                              {currentReaction && (
                                <div className={`absolute -bottom-2.5 left-2 rounded-full px-1.5 py-0.5 shadow-md text-xs z-20 border select-none ${
                                  isDark ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-slate-200 text-slate-800'
                                }`}>
                                  {currentReaction}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* INCOMING (CUSTOMER) MESSAGE */
                          <div className="flex items-start gap-1.5 mr-auto justify-start max-w-[88%] sm:max-w-[70%]">
                            <div className="relative group/bubble">
                              {!isSticker && <WhatsAppTailIn isDark={isDark} />}
                              <div
                                onDoubleClick={() => setReplyingTo(msg)}
                                className={`px-3.5 py-2 text-[14.5px] cursor-pointer select-text relative leading-relaxed ${
                                  isSticker 
                                    ? 'bg-transparent shadow-none p-0' 
                                    : isDark 
                                      ? 'bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none shadow-[0_1px_0.5px_rgba(0,0,0,0.3)] border border-white/5' 
                                      : 'bg-white text-[#111b21] rounded-2xl rounded-tl-none shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-black/5'
                                }`}
                              >
                                {renderMedia(msg)}
                                {!isSticker && renderMessageText(msg)}

                                {!isSticker && (
                                  <span className={`text-[11px] float-right mt-1.5 ml-3 font-normal select-none ${
                                    isDark ? 'text-[#8696a0]' : 'text-[#667781]'
                                  }`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              {currentReaction && (
                                <div className={`absolute -bottom-2.5 right-2 rounded-full px-1.5 py-0.5 shadow-md text-xs z-20 border select-none ${
                                  isDark ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-white border-slate-200 text-slate-800'
                                }`}>
                                  {currentReaction}
                                </div>
                              )}
                            </div>

                            {/* Hover Actions for Inbound */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center pt-1 relative">
                              <button 
                                type="button"
                                onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} 
                                className={`p-1.5 rounded-full transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-yellow-400 hover:bg-white/10' : 'text-slate-500 hover:text-yellow-600 hover:bg-black/5'
                                }`}
                                title="React"
                              >
                                <FaSmile size={13}/>
                              </button>
                              
                              {activeReactionMsgId === msg.id && (
                                <div className={`absolute bottom-full left-0 mb-2 z-50 px-3 py-1.5 rounded-full shadow-2xl flex gap-2 border animate-fade-in ${
                                  isDark ? 'bg-[#202c33] border-[#2a3942]' : 'bg-white border-slate-200 shadow-xl'
                                }`}>
                                  {reactionEmojis.map(e => (
                                    <button 
                                      key={e} 
                                      type="button"
                                      onClick={() => { handleReaction(msg, e); setActiveReactionMsgId(null); }} 
                                      className="hover:scale-125 transition-transform text-base"
                                    >
                                      {e}
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              <button 
                                type="button"
                                onClick={() => setReplyingTo(msg)} 
                                className={`p-1.5 rounded-full transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-white/10' : 'text-slate-500 hover:text-blue-600 hover:bg-black/5'
                                }`}
                                title="Reply"
                              >
                                <FaReply size={13}/>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>



          {/* Input Section */}
          <div className={`flex flex-col border-t z-20 transition-colors ${
            isDark ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#e9edef]'
          }`}>
            
            {/* Suggested QRs on typing / */}
            {!isBlocked && suggestedQRs.length > 0 && (
              <div className={`p-2.5 flex gap-2 overflow-x-auto custom-scrollbar border-b ${
                isDark ? 'bg-[#111b21] border-[#222d34]' : 'bg-[#e9edef] border-[#d1d7db]'
              }`}>
                {suggestedQRs.map((qr, i) => (
                  <button 
                    key={i} 
                    type="button"
                    onClick={() => applyQuickReply(qr)} 
                    className="shrink-0 bg-[#00a884] hover:bg-[#02906f] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    /{qr.name} {qr.attachment && <FaPaperclip size={10}/>}
                  </button>
                ))}
              </div>
            )}

            {/* Replying Preview Bar */}
            {replyingTo && (
              <div className={`px-4 py-2 border-l-4 border-[#00a884] flex justify-between items-center ${
                isDark ? 'bg-[#111b21]' : 'bg-[#e9edef]'
              }`}>
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`text-xs font-bold ${isDark ? 'text-[#25d366]' : 'text-[#008069]'}`}>
                    Replying to {replyingTo.direction === 'outbound' ? 'Yourself' : selectedLead.name}
                  </p>
                  <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                    {replyingTo.message || 'Media Attachment'}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setReplyingTo(null)} 
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-black hover:bg-black/5'
                  }`}
                >
                  <FaTimes size={13}/>
                </button>
              </div>
            )}

            {/* Selected File Attachment Bar */}
            {selectedFile && (
              <div className={`px-4 py-2.5 flex items-center gap-3 border-b ${
                isDark ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#e9edef]'
              }`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-[#00a884] shadow-sm shrink-0">
                  {selectedFile.type.includes('image') ? <FaImage size={18}/> : selectedFile.type.includes('video') ? <FaVideo size={18}/> : selectedFile.type.includes('audio') ? <FaMusic size={18}/> : <FaFilePdf size={18}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#00a884] truncate">{selectedFile.name}</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ready to send with message</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedFile(null)} 
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <FaTimes size={15}/>
                </button>
              </div>
            )}

            {/* Opted-Out Customer Notice */}
            {selectedLead?.isOptedOut && (
              <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-between gap-2">
                <span>⚠️ Customer previously opted-out. Staff messaging is enabled.</span>
                <button 
                  type="button"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      await axios.post('/coordinator-crm/messages/send-opt-in', 
                        { leadId: selectedLead.id },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      toast.success('Opt-in request sent successfully!');
                    } catch (error) {
                      toast.error('Failed to send opt-in request.');
                    }
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                  Send YES/NO Opt-In
                </button>
              </div>
            )}

            {/* Bottom Toolbar & Text Input Bar */}
            <div className="p-2 sm:p-2.5 flex items-end gap-1.5 sm:gap-2">
              <button 
                type="button" 
                onClick={() => { setEnableSinhala(!enableSinhala); setEnableGoogleSinhala(false); }} 
                title="Toggle Offline Sinhala" 
                className={`p-2.5 rounded-xl transition-all font-bold text-sm ${
                  enableSinhala 
                    ? 'bg-[#00a884] text-white shadow-sm' 
                    : isDark ? 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5' : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                }`}
              >
                අ
              </button>

              <button 
                type="button" 
                onClick={() => { setEnableGoogleSinhala(!enableGoogleSinhala); setEnableSinhala(false); }} 
                title="Toggle Google Sinhala" 
                className={`p-2.5 rounded-xl transition-all text-sm ${
                  enableGoogleSinhala 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : isDark ? 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5' : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                }`}
              >
                <FaGoogle size={14}/>
              </button>

              <button 
                type="button"
                onClick={() => setShowQuickReplies(true)} 
                title="Quick Replies Manager" 
                className={`p-2.5 rounded-xl transition-all ${
                  isDark ? 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5' : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                }`}
              >
                <FaMagic size={16}/>
              </button>

              <label 
                title="Attach Document/Media"
                className={`cursor-pointer p-2.5 rounded-xl transition-all ${
                  isDark ? 'text-[#8696a0] hover:text-[#d1d7db] hover:bg-white/5' : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                }`}
              >
                <FaPaperclip size={16}/>
                <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files[0])}/>
              </label>
              
              {/* Voice Recording Active View */}
              {isRecording ? (
                <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-red-500/40 ${
                  isDark ? 'bg-red-500/10' : 'bg-red-50'
                }`}>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-500 font-bold text-sm flex-1">{formatTime(recordingDuration)}</span>
                  <button 
                    type="button"
                    onClick={stopRecording} 
                    className="p-1.5 text-red-500 hover:text-white hover:bg-red-500 rounded-full transition-colors"
                  >
                    <FaStop size={14}/>
                  </button>
                </div>
              ) : enableGoogleSinhala ? (
                <div className="flex-1 flex relative">
                  <style>{`
                    .google-sinhala-container > ul {
                      background-color: ${isDark ? '#202c33' : '#ffffff'} !important;
                      border: 1px solid ${isDark ? '#2a3942' : '#e2e8f0'} !important;
                      border-radius: 0.75rem !important;
                      overflow: hidden !important;
                      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3) !important;
                      bottom: 100% !important;
                      top: auto !important;
                      margin-bottom: 8px !important;
                      padding: 0 !important;
                    }
                    .google-sinhala-container > ul > li {
                      padding: 8px 14px !important;
                      color: ${isDark ? '#e9edef' : '#111b21'} !important;
                      font-family: inherit !important;
                      border-bottom: 1px solid ${isDark ? '#2a3942' : '#f1f5f9'} !important;
                    }
                    .google-sinhala-container > ul > li:last-child {
                      border-bottom: none !important;
                    }
                    .google-sinhala-container > ul > li[style*="background-color"],
                    .google-sinhala-container > ul > li:hover {
                      background-color: ${isDark ? '#005c4b' : '#d9fdd3'} !important;
                      color: ${isDark ? '#ffffff' : '#111b21'} !important;
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
                        rows={Math.min(4, Math.max(1, newMessage.split('\n').length))} 
                        className={`flex-1 w-full px-4 py-2 rounded-xl border focus:outline-none resize-none overflow-y-auto custom-scrollbar text-[14.5px] transition-colors ${
                          isDark 
                            ? 'bg-[#2a3942] text-[#d1d7db] border-transparent focus:border-[#00a884] placeholder-[#8696a0]' 
                            : 'bg-white text-[#111b21] border-slate-200 focus:border-[#00a884] placeholder-[#8696a0] shadow-xs'
                        }`} 
                      />
                    )}
                    onKeyDown={handleKeyDown}
                    placeholder="Type with Google Sinhala..."
                  />
                </div>
              ) : (
                <textarea 
                  value={newMessage} 
                  onChange={handleInputChange} 
                  onKeyDown={handleKeyDown} 
                  placeholder="Type a message or / for quick replies..." 
                  rows={Math.min(4, Math.max(1, newMessage.split('\n').length))} 
                  className={`flex-1 px-4 py-2 rounded-xl border focus:outline-none resize-none overflow-y-auto custom-scrollbar text-[14.5px] transition-colors ${
                    isDark 
                      ? 'bg-[#2a3942] text-[#d1d7db] border-transparent focus:border-[#00a884] placeholder-[#8696a0]' 
                      : 'bg-white text-[#111b21] border-slate-200 focus:border-[#00a884] placeholder-[#8696a0] shadow-xs'
                  }`} 
                />
              )}

              {/* Mic / Send Button */}
              {!newMessage.trim() && !selectedFile ? (
                <button 
                  type="button" 
                  onClick={startRecording} 
                  className="w-10 h-10 rounded-full bg-[#00a884]/15 hover:bg-[#00a884] text-[#00a884] hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title="Record Voice Note"
                >
                  <FaMicrophone size={16}/>
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={(e) => handleSend(e)} 
                  disabled={isSending} 
                  className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
                  title="Send Message"
                >
                  <FaPaperPlane size={15} className={isSending ? 'animate-pulse' : ''}/>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* QUICK REPLIES MODAL */}
      {showQuickReplies && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl p-6 w-full max-w-lg shadow-2xl transition-colors ${
            isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[#00a884]">
                <FaMagic/> Manage Quick Replies
              </h3>
              <button 
                onClick={() => setShowQuickReplies(false)} 
                className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-500 hover:text-black bg-slate-100'}`}
              >
                <FaTimes/>
              </button>
            </div>
            
            <form onSubmit={saveQuickReply} className={`p-4 rounded-2xl border mb-5 ${isDark ? 'bg-[#0f172a] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <input 
                type="text" 
                value={newQRName} 
                onChange={e => setNewQRName(e.target.value)} 
                placeholder="Shortcut Title (e.g. hello)" 
                required 
                className={`w-full rounded-xl p-3 mb-3 text-sm outline-none border transition-colors ${
                  isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-[#00a884]' : 'bg-white border-slate-300 text-slate-800 focus:border-[#00a884]'
                }`} 
              />
              <textarea 
                value={newQRMsg} 
                onChange={e => setNewQRMsg(e.target.value)} 
                placeholder="Message Content / Caption..." 
                rows="2" 
                className={`w-full rounded-xl p-3 mb-3 text-sm outline-none border custom-scrollbar transition-colors ${
                  isDark ? 'bg-[#1e293b] border-slate-700 text-white focus:border-[#00a884]' : 'bg-white border-slate-300 text-slate-800 focus:border-[#00a884]'
                }`}
              />
              
              <div className="mb-4">
                <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Attachment (Image/Audio/Doc - Max 2MB)
                </label>
                <input 
                  type="file" 
                  accept="image/*,audio/*,video/*,application/pdf" 
                  onChange={handleQRFile} 
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00a884] file:text-white cursor-pointer" 
                />
                {qrAttachmentBase64 && (
                  <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1 font-bold">
                    <FaPaperclip/> File Attached
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#00a884] hover:bg-[#02906f] text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors"
              >
                Save Quick Reply
              </button>
            </form>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {quickReplies.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">No quick replies created yet.</p>
              ) : (
                quickReplies.map((qr, i) => (
                  <div key={qr.id || i} className={`p-3 rounded-xl border flex justify-between items-start gap-3 ${
                    isDark ? 'bg-[#0f172a] border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block bg-[#00a884]/15 text-[#00a884] font-bold text-[11px] px-2 py-0.5 rounded-md mb-1">
                        /{qr.name}
                      </span>
                      {qr.attachment && (
                        <div className="text-emerald-500 text-[10px] font-bold mb-1 flex items-center gap-1">
                          <FaPaperclip size={10}/> Has Attachment
                        </div>
                      )}
                      <p className={`text-xs whitespace-pre-wrap truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {qr.message}
                      </p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          await axios.delete(`/coordinator-crm/quick-replies/${qr.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          setQuickReplies(prev => prev.filter(q => q.id !== qr.id));
                        } catch (error) {
                          toast.error("Failed to delete quick reply");
                        }
                      }} 
                      className="text-red-400 hover:text-red-500 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* META TEMPLATES MODAL */}
      {showMetaTemplates && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl p-6 w-full max-w-lg shadow-2xl transition-colors ${
            isDark ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2 text-amber-500">
                <FaBolt/> Meta Approved Templates
              </h3>
              <button 
                onClick={() => setShowMetaTemplates(false)} 
                className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-500 hover:text-black bg-slate-100'}`}
              >
                <FaTimes/>
              </button>
            </div>
            
            <div className="space-y-5 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
              {metaTemplates.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No templates configured in Meta API yet.</div>
              ) : (
                <>
                  {metaTemplates.filter(t => t.name.toLowerCase().includes('call_request')).length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 border-b border-slate-700 pb-1.5">
                        Call Request Templates
                      </h4>
                      <div className="space-y-3">
                        {metaTemplates.filter(t => t.name.toLowerCase().includes('call_request')).map((tpl, i) => (
                          <div key={`call-${i}`} className={`p-4 rounded-2xl border relative overflow-hidden ${
                            isDark ? 'bg-[#0f172a] border-blue-500/30' : 'bg-blue-50/50 border-blue-200'
                          }`}>
                            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                              CALL PERMISSION
                            </div>
                            <h4 className="text-blue-500 font-bold text-sm mb-1.5">{tpl.name}</h4>
                            <p className={`text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tpl.text}</p>
                            <button 
                              onClick={() => handleSendTemplate(tpl)} 
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                            >
                              <FaPaperPlane size={11}/> Send Call Request
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 border-b border-slate-700 pb-1.5">
                      Message Templates
                    </h4>
                    <div className="space-y-3">
                      {metaTemplates.filter(t => !t.name.toLowerCase().includes('call_request')).map((tpl, i) => (
                        <div key={`msg-${i}`} className={`p-4 rounded-2xl border ${
                          isDark ? 'bg-[#0f172a] border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <h4 className="text-[#00a884] font-bold text-sm mb-1.5">{tpl.name}</h4>
                          <p className={`text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tpl.text}</p>
                          <button 
                            onClick={() => handleSendTemplate(tpl)} 
                            className="w-full bg-[#00a884] hover:bg-[#02906f] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                          >
                            <FaPaperPlane size={11}/> Send Template
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Outbound Dialer Modal */}
      <OutboundDialerModal 
        isOpen={showDialerModal} 
        onClose={() => setShowDialerModal(false)} 
        selectedLead={selectedLead}
        businessId={selectedLead?.batch?.businessId}
        campaignType="FREE_SEMINAR" 
      />

      {/* 🛑 Block Contact Confirmation Modal 🛑 */}
      {showBlockModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`border rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 ${
            isDark ? 'bg-[#1e293b] border-red-500/30 text-white' : 'bg-white border-red-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
              <h3 className="text-base font-black text-red-500 flex items-center gap-2">
                <FaBan size={16}/> Block Phone Number
              </h3>
              <button 
                onClick={() => setShowBlockModal(false)} 
                className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-500 hover:text-black bg-slate-100'}`}
              >
                <FaTimes size={15}/>
              </button>
            </div>

            <p className={`text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Are you sure you want to block <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedLead?.phone}</span>?
            </p>
            <p className={`text-xs mb-4 p-3 rounded-xl border ${
              isDark ? 'bg-slate-900/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              💡 Once blocked, any incoming WhatsApp messages from this number will be discarded immediately.
            </p>

            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Block Reason</label>
            <select 
              value={selectedBlockReason} 
              onChange={(e) => setSelectedBlockReason(e.target.value)}
              className={`w-full border rounded-xl p-3 text-sm font-semibold mb-3 outline-none focus:border-red-500 ${
                isDark ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <option value="Spam / Marketing">Spam / Marketing</option>
              <option value="Abusive / Inappropriate Language">Abusive / Inappropriate Language</option>
              <option value="Customer Requested Stop">Customer Requested Stop</option>
              <option value="Wrong Number / Invalid Contact">Wrong Number / Invalid Contact</option>
              <option value="Other">Other Reason</option>
            </select>

            {selectedBlockReason === 'Other' && (
              <textarea
                value={customBlockReason}
                onChange={(e) => setCustomBlockReason(e.target.value)}
                placeholder="Type specific reason..."
                rows="2"
                className={`w-full border rounded-xl p-3 text-sm mb-4 outline-none focus:border-red-500 resize-none ${
                  isDark ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            )}

            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowBlockModal(false)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button 
                onClick={handleBlockConfirm}
                disabled={isBlocking}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
              >
                {isBlocking ? "Blocking..." : "Confirm Block"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, PhoneCall, PhoneOff, Volume2, VolumeX, Send, RefreshCw,
  Sparkles, CheckCircle2, AlertCircle, Bot, User, Trash2, Calendar,
  BookOpen, Clock, ShieldCheck, Zap, MessageSquare, Play, HelpCircle
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function SinhalaVoiceAgentTester({ loggedInUser }) {
  // Call States: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'LISTENING' | 'SPEAKING' | 'ENDED'
  const [callState, setCallState] = useState('IDLE');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState('si-LK'); // 'si-LK' or 'en-US'
  const [selectedVoice, setSelectedVoice] = useState('Kore'); // 100% Locked to Kore (Studio Female Neural Voice)

  // Transcripts & Conversation
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // CRM Data
  const [demoSlots, setDemoSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Audio & Speech Recognition Refs
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const audioPlayerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const isCallActiveRef = useRef(false);

  // Initialize Speech Recognition & Fetch Initial Data
  useEffect(() => {
    isCallActiveRef.current = callState === 'CONNECTED' || callState === 'LISTENING' || callState === 'SPEAKING';
  }, [callState]);

  useEffect(() => {
    fetchCrmData();
    fetchRecentBookings();

    // Check for browser Web Speech Recognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = speechLanguage;

      recognizer.onstart = () => {
        setIsMicActive(true);
        if (callState === 'CONNECTED' || callState === 'SPEAKING') {
          setCallState('LISTENING');
        }
      };

      recognizer.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentInput(transcript);

        // If speech recognition is finalized
        if (event.results[event.results.length - 1].isFinal && transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      };

      recognizer.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsMicActive(false);
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied in browser.');
        }
      };

      recognizer.onend = () => {
        setIsMicActive(false);
        if (isCallActiveRef.current && callState === 'LISTENING') {
          setCallState('CONNECTED');
        }
      };

      recognitionRef.current = recognizer;
    } else {
      console.warn('Web Speech Recognition is not supported on this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (e) {}
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Update speech recognition language when changed
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechLanguage;
    }
  }, [speechLanguage]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isAiProcessing]);

  // Fetch CRM demo slots and active courses
  const fetchCrmData = async () => {
    try {
      const [slotsRes, coursesRes] = await Promise.all([
        api.get('/public/voice-agent/demo-slots'),
        api.get('/public/voice-agent/courses')
      ]);
      if (slotsRes.data?.success) setDemoSlots(slotsRes.data.slots || []);
      if (coursesRes.data?.success) setCourses(coursesRes.data.courses || []);
    } catch (err) {
      console.error('Error fetching CRM data:', err);
    }
  };

  // Fetch recent test bookings from DB
  const fetchRecentBookings = async () => {
    setIsLoadingBookings(true);
    try {
      const res = await api.get('/public/voice-agent/recent-bookings');
      if (res.data?.success) {
        setRecentBookings(res.data.leads || []);
      }
    } catch (err) {
      console.error('Error loading recent bookings:', err);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Play streaming audio directly with instant chunk decoding
  const playStreamAudio = (streamUrl) => {
    if (isVoiceMuted || !streamUrl) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }

      const audio = new Audio(streamUrl);
      audioPlayerRef.current = audio;

      audio.onplay = () => {
        if (isCallActiveRef.current) setCallState('SPEAKING');
      };
      audio.onended = () => {
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };
      audio.onerror = (e) => {
        console.warn('Stream audio playback error:', e);
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };

      audio.play().catch(err => {
        console.warn('Audio play interrupted or blocked:', err);
      });
    } catch (e) {
      console.warn('Playback error:', e);
    }
  };

  // Play base64 audio directly (zero additional round-trip latency)
  const playBase64Audio = (base64Data, mimeType = 'audio/wav') => {
    if (isVoiceMuted || !base64Data) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }

      const audioUrl = `data:${mimeType};base64,${base64Data}`;
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onplay = () => {
        if (isCallActiveRef.current) setCallState('SPEAKING');
      };
      audio.onended = () => {
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };
      audio.onerror = (e) => {
        console.warn('Audio playback error, falling back to stream:', e);
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };

      audio.play().catch(err => {
        console.warn('Audio play interrupted or blocked:', err);
      });
    } catch (e) {
      console.warn('Playback error:', e);
    }
  };

  // Speak AI reply aloud via native Sinhala audio streaming (fallback)
  const speakText = (text) => {
    if (isVoiceMuted) return;
    try {
      // 1. Cancel previous audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }

      const cleanText = text.replace(/[*#_~`]/g, '').trim();
      if (!cleanText) return;

      // 2. Play high-quality native Kore Studio Neural Voice from backend
      const baseURL = api.defaults.baseURL || 'http://localhost:5000/api';
      const ttsUrl = `${baseURL}/public/voice-agent/tts?text=${encodeURIComponent(cleanText)}`;

      const audio = new Audio(ttsUrl);
      audioPlayerRef.current = audio;

      audio.onplay = () => {
        if (isCallActiveRef.current) setCallState('SPEAKING');
      };
      audio.onended = () => {
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };
      audio.onerror = (e) => {
        console.warn('Sinhala TTS stream error:', e);
        if (isCallActiveRef.current) setCallState('CONNECTED');
      };

      audio.play().catch(err => {
        console.warn('Audio play request interrupted or blocked:', err);
      });
    } catch (e) {
      console.warn('Speech playback error:', e);
    }
  };

  // Start Call (Simulates Receptionist pickup)
  const handleStartCall = async () => {
    setCallState('CONNECTING');
    setIsAiProcessing(true);
    setMessages([]);
    setConversationHistory([]);

    try {
      const greetingPrompt = "ඇමතුම සම්බන්ධ විය. IMA Campus හි පිළිගැනීමේ නිලධාරිනී නෙත්මි ලෙස පැහැදිලි සිංහලෙන් ආයුබෝවන් කියා පිළිගෙන උදව් කරන්නේ කෙසේදැයි අසන්න.";
      const res = await api.post('/public/voice-agent/chat', {
        message: greetingPrompt,
        history: [],
        voice: selectedVoice,
        isGreeting: true
      });

      if (res.data?.success) {
        const reply = res.data.reply || "ආයුබෝවන්! IMA Campus එකෙන් නෙත්මි කතා කරන්නේ. මම ඔයාට කොහොමද උදව් කරන්න පුළුවන්?";
        setCallState('CONNECTED');
        setMessages([
          { sender: 'ai', text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        setConversationHistory(res.data.updatedHistory || []);
        
        if (res.data.audioBase64) {
          playBase64Audio(res.data.audioBase64, res.data.mimeType);
        } else if (res.data.ttsUrl) {
          const baseURL = api.defaults.baseURL || 'http://localhost:5000/api';
          const fullTtsUrl = res.data.ttsUrl.startsWith('http') 
            ? res.data.ttsUrl 
            : `${baseURL.replace(/\/api\/?$/, '')}${res.data.ttsUrl}`;
          playStreamAudio(fullTtsUrl);
        } else {
          speakText(reply);
        }
        toast.success('Call Connected with Nethmi (AI Receptionist)!');
      } else {
        throw new Error(res.data?.error || 'Failed to connect');
      }
    } catch (err) {
      console.error('Call connection error:', err);
      toast.error('Failed to initiate call. Check backend server.');
      setCallState('IDLE');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // End Call
  const handleEndCall = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch (e) {}
    }
    setCallState('ENDED');
    setIsMicActive(false);
    toast('Call Ended', { icon: '👋' });
    setTimeout(() => setCallState('IDLE'), 2000);
  };

  // Toggle Microphone recording
  const toggleMic = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser. You can type below instead.');
      return;
    }

    if (isMicActive) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsMicActive(false);
    } else {
      try {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        if (synthRef.current) synthRef.current.cancel(); // Stop AI speaking when user interrupts
        recognitionRef.current.start();
        setIsMicActive(true);
        toast('Listening... Speak in Sinhala into your Mic', { icon: '🎙️' });
      } catch (e) {
        console.warn('Recognition start error:', e);
      }
    }
  };

  // Send message turn to AI Agent & execute tools
  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || currentInput).trim();
    if (!textToSend || isAiProcessing) return;

    setCurrentInput('');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user message to UI
    const updatedMessages = [
      ...messages,
      { sender: 'user', text: textToSend, timestamp: timeNow }
    ];
    setMessages(updatedMessages);
    setIsAiProcessing(true);

    try {
      const res = await api.post('/public/voice-agent/chat', {
        message: textToSend,
        history: conversationHistory,
        voice: selectedVoice
      });

      if (res.data?.success) {
        const reply = res.data.reply;
        const toolExecs = res.data.toolExecutions || [];
        const leadCreated = res.data.leadCreated;

        setMessages([
          ...updatedMessages,
          {
            sender: 'ai',
            text: reply,
            toolExecutions: toolExecs,
            leadCreated: leadCreated,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        setConversationHistory(res.data.updatedHistory || []);
        
        if (res.data.audioBase64) {
          playBase64Audio(res.data.audioBase64, res.data.mimeType);
        } else if (res.data.ttsUrl) {
          const baseURL = api.defaults.baseURL || 'http://localhost:5000/api';
          const fullTtsUrl = res.data.ttsUrl.startsWith('http') 
            ? res.data.ttsUrl 
            : `${baseURL.replace(/\/api\/?$/, '')}${res.data.ttsUrl}`;
          playStreamAudio(fullTtsUrl);
        } else {
          speakText(reply);
        }

        if (leadCreated) {
          toast.success(`🎉 Lead Created in CRM! ID: ${leadCreated.id}`, { duration: 4000 });
          fetchRecentBookings();
        }
      } else {
        throw new Error(res.data?.error || 'AI responded with error');
      }
    } catch (err) {
      console.error('Chat error:', err);
      toast.error('Error communicating with AI agent.');
      setMessages([
        ...updatedMessages,
        {
          sender: 'ai',
          text: "Samawenna, connection error ekak awa. Karunakara thawa sarayak kiyanna.",
          timestamp: timeNow,
          isError: true
        }
      ]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Delete test booking to keep CRM clean
  const handleDeleteBooking = async (id) => {
    try {
      const res = await api.delete(`/public/voice-agent/booking/${id}`);
      if (res.data?.success) {
        toast.success(`Test Lead #${id} deleted.`);
        fetchRecentBookings();
      }
    } catch (err) {
      toast.error('Failed to delete booking.');
    }
  };

  const samplePrompts = [
    { label: '💰 Tech පන්ති ගාස්තු', text: 'Technology පන්තියේ මාසික ගාස්තු සහ සම්පූර්ණ ගාස්තු කීයද?' },
    { label: '👨‍🏫 Arts දේශකවරුන්', text: 'Arts අංශයේ උගන්වන ප්‍රධාන දේශකවරු කවුද?' },
    { label: '📅 Commerce ඩෙමෝ පන්ති', text: 'Commerce ඩෙමෝ පන්ති තියෙන්නේ කවද්ද?' },
    { label: '🎓 English ඩිප්ලෝමා විස්තර', text: 'IMA English ඩිප්ලෝමාවේ විෂයයන් සහ ගාස්තු කොහොමද?' },
    { label: '📝 Demo Registration', text: 'මගේ නම චමින්දු, නම්බර් එක 0771234567. මාව සෙනසුරාදා Tech ඩෙමෝ පන්තියට දාන්න.' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-8 custom-scrollbar">
      {/* Top Banner & Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Mic className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Sinhala AI Call Agent — Testing Console
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                IMA Campus Official Receptionist "Nethmi" & Real-time CRM Demo Booking Sandbox
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            IMA CRM Database Connected
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Isolated Test Mode (0% Live Traffic)
          </div>
        </div>
      </div>

      {/* Main Grid: Call Console (Left) + CRM Data Hub (Right) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Call Console (7 Cols) ── */}
        <div className="lg:col-span-7 flex flex-col space-y-4">

          {/* Call Status & Agent Visual Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 p-6 shadow-2xl">
            {/* Ambient Background Glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              callState === 'SPEAKING' ? 'bg-cyan-500/15' : callState === 'LISTENING' ? 'bg-emerald-500/20' : 'bg-emerald-500/5'
            }`} />

            <div className="flex items-center justify-between">
              {/* Agent Profile & Pulse Ring */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-2xl text-slate-950 shadow-xl transition-transform ${
                    callState === 'SPEAKING' ? 'scale-105' : ''
                  }`}>
                    N
                  </div>
                  {/* Active Call Pulsing Halo */}
                  {['CONNECTED', 'LISTENING', 'SPEAKING'].includes(callState) && (
                    <span className="absolute -inset-1.5 rounded-2xl border-2 border-emerald-400/50 animate-ping pointer-events-none" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-100">Nethmi</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Receptionist AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">IMA Campus Student Admissions & Demo Bookings</p>
                  
                  {/* Status Indicator Pill */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`w-2 h-2 rounded-full ${
                      callState === 'IDLE' ? 'bg-slate-500' :
                      callState === 'CONNECTING' ? 'bg-amber-400 animate-spin' :
                      callState === 'SPEAKING' ? 'bg-cyan-400 animate-pulse' :
                      callState === 'LISTENING' ? 'bg-emerald-400 animate-ping' :
                      'bg-emerald-400'
                    }`} />
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                      {callState === 'IDLE' && 'Ready to Call'}
                      {callState === 'CONNECTING' && 'Connecting to Receptionist...'}
                      {callState === 'CONNECTED' && 'Call Active — Waiting for Voice'}
                      {callState === 'LISTENING' && 'Listening to Your Mic...'}
                      {callState === 'SPEAKING' && 'Nethmi is Speaking...'}
                      {callState === 'ENDED' && 'Call Terminated'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call Controls: Audio Mute & Language */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                  title={isVoiceMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isVoiceMuted 
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {isVoiceMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <div 
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm"
                  title="Official Studio Voice: Kore (Smart, Warm & 100% Consistent)"
                >
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>Kore (Studio Warm Voice)</span>
                </div>

                <select
                  value={speechLanguage}
                  onChange={(e) => setSpeechLanguage(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
                  title="Speech Recognition Language"
                >
                  <option value="si-LK">සිංහල (si-LK)</option>
                  <option value="en-US">English (en-US)</option>
                </select>
              </div>
            </div>

            {/* Audio Wave Visualizer Simulation */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5 h-8">
                {[4, 12, 24, 16, 32, 20, 10, 28, 14, 22, 8, 18, 26, 12, 6].map((h, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      callState === 'SPEAKING' ? 'bg-cyan-400 animate-pulse' :
                      callState === 'LISTENING' ? 'bg-emerald-400 animate-bounce' :
                      'bg-slate-700/60'
                    }`}
                    style={{
                      height: (callState === 'SPEAKING' || callState === 'LISTENING') 
                        ? `${Math.max(6, (h * (idx % 2 === 0 ? 1.2 : 0.8)))}px` 
                        : '6px'
                    }}
                  />
                ))}
              </div>

              {/* Call Action Button */}
              {callState === 'IDLE' || callState === 'ENDED' ? (
                <button
                  onClick={handleStartCall}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
                >
                  <PhoneCall size={18} />
                  Start Call with Nethmi
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleMic}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                      isMicActive
                        ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isMicActive ? <MicOff size={16} /> : <Mic size={16} />}
                    {isMicActive ? 'Stop Mic' : 'Speak into Mic'}
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all"
                    title="End Call"
                  >
                    <PhoneOff size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transcript / Conversation Stream */}
          <div className="flex-1 min-h-[380px] max-h-[460px] bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-inner">
            <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-2">
                <MessageSquare size={14} className="text-emerald-400" />
                Live Call Transcript Stream
              </span>
              <span>{messages.length} messages</span>
            </div>

            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
                    <PhoneCall className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-semibold text-sm text-slate-400">Call is not active yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Click <strong>"Start Call with Nethmi"</strong> to connect with the receptionist, or use the mic below to ask in Sinhala.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.sender === 'ai' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        N
                      </div>
                    )}

                    <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm'
                        : m.isError
                        ? 'bg-rose-950/40 border border-rose-800 text-rose-200 rounded-bl-sm'
                        : 'bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-bl-sm'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                      {/* Tool Execution Badges if any */}
                      {m.toolExecutions && m.toolExecutions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                          {m.toolExecutions.map((t, tidx) => (
                            <span key={tidx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                              <Zap size={11} className="text-cyan-400" />
                              {t.tool === 'get_demo_slots' && 'Checked Live Demo Slots'}
                              {t.tool === 'get_courses' && 'Loaded Active Courses'}
                              {t.tool === 'book_demo_class' && `Booked Lead #${t.leadId}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Successful Lead Creation Card */}
                      {m.leadCreated && (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                          <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-emerald-300">Saved directly in IMA Campus CRM DB!</p>
                            <p className="text-[11px] text-emerald-400/90 mt-0.5">
                              Lead ID: <strong>#{m.leadCreated.id}</strong> | Phone: {m.leadCreated.phone} | Slot: {m.leadCreated.slot_id}
                            </p>
                          </div>
                        </div>
                      )}

                      <span className="block text-[10px] text-right mt-1 opacity-60">
                        {m.timestamp}
                      </span>
                    </div>

                    {m.sender === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        <User size={14} />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* AI Processing Typing Indicator */}
              {isAiProcessing && (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-1">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>Nethmi is thinking & checking CRM tools...</span>
                </div>
              )}
            </div>

            {/* Input Bar (Microphone + Text Field) */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <button
                onClick={toggleMic}
                title={isMicActive ? "Mute Microphone" : "Speak via Microphone"}
                className={`p-2.5 rounded-xl border transition-all ${
                  isMicActive 
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {isMicActive ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isMicActive ? "Listening to your voice..." : "Type in Sinhala / Singlish or speak into Mic..."}
                disabled={isAiProcessing}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!currentInput.trim() || isAiProcessing}
                className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Quick One-Click Test Prompts */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles size={13} className="text-amber-400" />
              Quick Test:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.text)}
                disabled={isAiProcessing}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right Column: CRM Live Inspection & Bookings Hub (5 Cols) ── */}
        <div className="lg:col-span-5 flex flex-col space-y-4">

          {/* Recently Booked Leads Panel */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Recent Voice Agent Leads</h3>
              </div>
              <button
                onClick={fetchRecentBookings}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Refresh Bookings"
              >
                <RefreshCw size={14} className={isLoadingBookings ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
              {recentBookings.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No voice agent test leads created yet.
                  <p className="text-[11px] mt-1 text-slate-600">Register a demo class through the call to see it here live!</p>
                </div>
              ) : (
                recentBookings.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{b.name || 'Caller'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          #{b.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{b.phone.split('_')[0]}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[210px]">{b.feedback}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteBooking(b.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete Test Lead"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Demo Slots in CRM */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <Clock size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-200">Active Demo Class Slots (CRM)</h3>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {demoSlots.map((s, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/70 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">{s.course}</span>
                    <p className="text-[11px] text-emerald-400 mt-0.5">{s.when}</p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {s.slot_id}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Available Courses / Streams in CRM */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <BookOpen size={16} className="text-purple-400" />
              <h3 className="text-sm font-bold text-slate-200">IMA Campus Active Streams ({courses.length})</h3>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {courses.map((c, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-950 border border-slate-800 text-slate-300">
                  {c.courseName}
                </span>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

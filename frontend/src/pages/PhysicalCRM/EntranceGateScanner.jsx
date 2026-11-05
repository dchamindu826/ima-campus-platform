import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, CheckCircle2, XCircle, AlertTriangle, Volume2, VolumeX, 
  Maximize2, Minimize2, Radio, Clock, Calendar, Users, ArrowLeft,
  Search, RefreshCw, Sparkles, CreditCard, ChevronDown, Check,
  User, Building2, Bell, AlertOctagon, HelpCircle, ExternalLink,
  ChevronRight, ArrowRight, Smartphone, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import physicalCrmService from '../../api/physicalCrm';
import audioSynth, { extractCallingName } from '../../utils/audioSynthesizer';

export default function EntranceGateScanner({ isStandalone = false }) {
  const navigate = useNavigate();

  // Gate Scanner State
  const [scanResult, setScanResult] = useState(null);
  const [scanStatus, setScanStatus] = useState('IDLE'); // 'IDLE', 'PROCESSING', 'GRANTED', 'DENIED', 'ALREADY_CHECKED_IN', 'NOT_FOUND'
  const [stats, setStats] = useState({ totalToday: 0, grantedToday: 0, deniedToday: 0, recentScans: [] });
  const [availableClasses, setAvailableClasses] = useState([]);
  const [todayScheduledClasses, setTodayScheduledClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [gateMode, setGateMode] = useState('AUTO');

  // Hardware Scanner & Input Buffering
  const [manualInput, setManualInput] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const scanBufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());
  const scanTimeoutRef = useRef(null);
  const resetTimerRef = useRef(null);
  const [countdown, setCountdown] = useState(0);

  // Audio & Kiosk Settings
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep digital clock live
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial entrance gate stats & classes
  const loadGateData = useCallback(async () => {
    try {
      const [statsRes, classesRes] = await Promise.all([
        physicalCrmService.getEntranceStats().catch(err => {
          console.warn('Failed to load entrance stats:', err);
          return null;
        }),
        physicalCrmService.getClasses().catch(err => {
          console.warn('Failed to load classes:', err);
          return [];
        })
      ]);

      if (statsRes) {
        setStats({
          totalToday: statsRes.totalToday || 0,
          grantedToday: statsRes.recentScans?.filter(s => s.status === 'GRANTED')?.length || statsRes.totalToday || 0,
          deniedToday: 0,
          recentScans: statsRes.recentScans || []
        });
        setTodayScheduledClasses(statsRes.scheduledClasses || []);
      }

      if (classesRes && Array.isArray(classesRes)) {
        setAvailableClasses(classesRes);
      }
    } catch (e) {
      console.error('Error loading gate data:', e);
    }
  }, []);

  useEffect(() => {
    loadGateData();
  }, [loadGateData]);

  // Unlock Audio on First User Action
  const handleUnlockAudio = () => {
    audioSynth.initContext();
    audioSynth.playCardTap();
    setIsAudioUnlocked(true);
    toast.success('Audio & Scanner Activated', { icon: '🔊' });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Countdown timer for automatic reset to IDLE
  useEffect(() => {
    if (scanStatus === 'IDLE' || scanStatus === 'PROCESSING') {
      setCountdown(0);
      return;
    }

    setCountdown(7);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [scanStatus]);

  // Process a Card Scan
  const processCardScan = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();

    audioSynth.initContext();
    setIsAudioUnlocked(true);
    audioSynth.playCardTap();
    setScanStatus('PROCESSING');

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    try {
      const payload = {
        identifier: cleanCode,
        classId: selectedClassId ? parseInt(selectedClassId) : null,
        gateMode: selectedClassId ? 'CLASS_SPECIFIC' : 'AUTO'
      };

      const response = await physicalCrmService.entranceScan(payload);
      setScanResult(response);

      if (response.status === 'GRANTED') {
        setScanStatus('GRANTED');
        audioSynth.playAccessGranted();
        if (voiceEnabled) {
          const name = extractCallingName(response.student);
          audioSynth.speakVoice(`Access Granted. Welcome, ${name}!`);
        }

        setStats(prev => ({
          ...prev,
          totalToday: prev.totalToday + 1,
          grantedToday: prev.grantedToday + 1,
          recentScans: [
            {
              id: Date.now(),
              status: 'GRANTED',
              studentName: response.student?.studentName,
              studentId: response.student?.studentId,
              className: response.class?.name || 'Class',
              time: new Date()
            },
            ...prev.recentScans.slice(0, 30)
          ]
        }));

      } else if (response.status === 'ALREADY_CHECKED_IN') {
        setScanStatus('ALREADY_CHECKED_IN');
        audioSynth.playAlreadyCheckedIn();
        if (voiceEnabled) {
          const name = extractCallingName(response.student);
          audioSynth.speakVoice(`Welcome back, ${name}. Already checked in.`);
        }

      } else if (response.status === 'DENIED') {
        setScanStatus('DENIED');
        audioSynth.playAccessDenied();
        if (voiceEnabled) {
          audioSynth.speakVoice('Access Denied. Please visit the counter.');
        }

        setStats(prev => ({
          ...prev,
          totalToday: prev.totalToday + 1,
          deniedToday: prev.deniedToday + 1,
          recentScans: [
            {
              id: Date.now(),
              status: 'DENIED',
              studentName: response.student?.studentName,
              studentId: response.student?.studentId,
              className: response.class?.name || 'Class',
              time: new Date()
            },
            ...prev.recentScans.slice(0, 30)
          ]
        }));

      } else {
        setScanStatus('NOT_FOUND');
        audioSynth.playAccessDenied();
        if (voiceEnabled) {
          audioSynth.speakVoice('Card not recognized. Please visit the reception desk.');
        }
      }

      resetTimerRef.current = setTimeout(() => {
        setScanStatus('IDLE');
        setScanResult(null);
      }, 7500);

    } catch (err) {
      console.error('Scan processing error:', err);
      setScanStatus('NOT_FOUND');
      setScanResult({
        success: false,
        status: 'ERROR',
        message: err.response?.data?.error || err.message || 'Verification failed'
      });
      audioSynth.playAccessDenied();

      resetTimerRef.current = setTimeout(() => {
        setScanStatus('IDLE');
        setScanResult(null);
      }, 5000);
    }
  }, [selectedClassId, voiceEnabled]);

  // Global Hardware Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
      if (isInput && isManualModalOpen) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scannedCode = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        if (scannedCode.length >= 2) {
          processCardScan(scannedCode);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff > 120) {
          scanBufferRef.current = e.key;
        } else {
          scanBufferRef.current += e.key;
        }

        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(scanTimeoutRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [processCardScan, isManualModalOpen]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      processCardScan(manualInput.trim());
      setManualInput('');
      setIsManualModalOpen(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col font-sans bg-[#070b14] text-white selection:bg-cyan-500 selection:text-black select-none relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none rounded-full blur-[120px] opacity-20 bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600" />
      
      {scanStatus === 'GRANTED' && (
        <div className="absolute inset-0 pointer-events-none bg-emerald-950/30 transition-all duration-300 z-10" />
      )}
      {scanStatus === 'DENIED' && (
        <div className="absolute inset-0 pointer-events-none bg-rose-950/35 transition-all duration-300 z-10" />
      )}

      {/* Top Compact Navigation Header */}
      <header className="px-4 py-2.5 md:px-6 border-b border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-30 shadow-md">
        
        {/* Left: Branding & Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/physical/dashboard/overview')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
            title="Back to Physical Hub"
          >
            <ArrowLeft size={16} className="text-cyan-400" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Shield className="text-white" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  Smart Entrance Gate
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Digital Clock */}
        <div className="hidden sm:flex items-center gap-3 bg-white/5 px-3.5 py-1.5 rounded-xl border border-white/10 text-xs">
          <div className="flex items-center gap-1.5 text-white/70 font-medium">
            <Calendar size={13} className="text-cyan-400" />
            <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="w-px h-3.5 bg-white/20" />
          <div className="flex items-center gap-1.5 font-bold font-mono text-cyan-300">
            <Clock size={13} className="text-cyan-400" />
            <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>

        {/* Right: Controls Toolbar */}
        <div className="flex items-center gap-2">
          
          {/* Gate Session Selector */}
          <div className="relative flex items-center">
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setGateMode(e.target.value ? 'LOCKED' : 'AUTO');
                toast.success(e.target.value ? 'Gate locked to selected class' : 'Auto Timetable Detection enabled');
              }}
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl border border-white/15 focus:outline-none focus:border-cyan-400 cursor-pointer appearance-none"
            >
              <option value="" className="bg-[#0f172a] text-white">⚡ Auto Mode (Today's Timetable)</option>
              {availableClasses.map(cls => (
                <option key={cls.id} value={cls.id} className="bg-[#0f172a] text-white">
                  🔒 {cls.name} ({cls.grade})
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 text-white/50 pointer-events-none" />
          </div>

          {/* Audio State Chip */}
          {!isAudioUnlocked ? (
            <button
              onClick={handleUnlockAudio}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer animate-pulse"
            >
              <Volume2 size={14} />
              <span>Enable Sound</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                audioSynth.setMuted(nextMute);
                toast(nextMute ? 'Audio Muted' : 'Audio Active', { icon: nextMute ? '🔇' : '🔊' });
              }}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${isMuted ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-white/10 hover:bg-white/15 text-cyan-300 border-white/15'}`}
              title={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          )}

          {/* Voice Speech Toggle */}
          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              toast.success(voiceEnabled ? 'Voice Muted' : 'Voice Active');
            }}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${voiceEnabled ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/5 text-white/40 border-white/10'}`}
            title={voiceEnabled ? 'Voice speech active' : 'Voice speech muted'}
          >
            <Bell size={15} />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Kiosk Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* Main Kiosk Content Area (Zero-Scroll Flex Container) */}
      <div className="flex-1 flex flex-col lg:flex-row p-3 md:p-5 gap-4 md:gap-6 z-20 overflow-hidden w-full max-w-7xl mx-auto h-[calc(100%-52px)]">
        
        {/* CENTER STAGE: Prominent Center Screen that fills vertical space without scrolling */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-full">

          {/* STATE 1: STANDBY / READY TO SCAN */}
          {scanStatus === 'IDLE' && (
            <div className="w-full max-w-2xl flex flex-col items-center text-center p-6 md:p-8 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.7)] animate-fade-in">
              
              {/* Concentric Scanner Rings */}
              <div className="relative w-36 h-36 md:w-44 md:h-44 flex items-center justify-center mb-5">
                <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping duration-1000" />
                <div className="absolute inset-3 rounded-full border border-cyan-400/30 animate-pulse duration-700" />
                <div className="w-24 h-24 md:w-30 md:h-30 rounded-full bg-gradient-to-tr from-cyan-600/30 via-blue-600/20 to-purple-600/30 border-2 border-cyan-400/70 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                  <Radio className="text-cyan-300 animate-pulse mb-1" size={38} />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-cyan-200">Sensor Ready</span>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-1.5">
                PLEASE TAP STUDENT CARD
              </h2>
              <p className="text-xs md:text-sm text-cyan-300 font-medium mb-1">
                කරුණාකර ඔබගේ ශිෂ්‍ය කාඩ්පත (Card) ස්කෑන් කරන්න
              </p>
              <p className="text-xs text-white/50 max-w-md mb-6">
                Hold your RFID card or Barcode near the entrance scanner to verify class fees and record attendance.
              </p>

              {/* Instant Simulation Buttons for Testing / Staff */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-white/10 w-full max-w-md">
                <button
                  onClick={() => processCardScan('PHY-STU-14216')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={13} />
                  <span>Test Paid Student</span>
                </button>

                <button
                  onClick={() => processCardScan('PHY-STU-14682')}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <XCircle size={13} />
                  <span>Test Unpaid Student</span>
                </button>

                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Search size={13} />
                  <span>Manual Keypad</span>
                </button>
              </div>

            </div>
          )}

          {/* STATE 2: PROCESSING */}
          {scanStatus === 'PROCESSING' && (
            <div className="w-full max-w-lg flex flex-col items-center justify-center p-8 rounded-3xl bg-black/60 backdrop-blur-2xl border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)] animate-fade-in text-center">
              <RefreshCw size={52} className="text-cyan-400 animate-spin mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
                Verifying Credentials...
              </h3>
              <p className="text-white/60 text-xs">Checking enrollment & monthly fee records</p>
            </div>
          )}

          {/* STATE 3: ACCESS GRANTED (PROMINENT & CLEAN GREEN) */}
          {scanStatus === 'GRANTED' && scanResult && (
            <div className="w-full max-w-2xl flex flex-col items-center text-center p-5 md:p-8 rounded-3xl bg-gradient-to-b from-emerald-950/70 via-black/80 to-zinc-950/90 backdrop-blur-2xl border-2 border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.4)] animate-scale-up">
              
              {/* Status Banner */}
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-bold text-xs uppercase tracking-wider mb-4 shadow-sm">
                <Sparkles size={14} />
                <span>ACCESS GRANTED • ඇතුල්වීමට අවසර ඇත</span>
              </div>

              {/* Big Checkmark */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)] mb-4">
                <CheckCircle2 className="text-emerald-400" size={44} />
              </div>

              {/* Student Name */}
              <div className="mb-4">
                <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400/80 block mb-0.5">
                  Welcome to Class
                </span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {scanResult.student?.studentName || `${scanResult.student?.firstName || ''} ${scanResult.student?.lastName || ''}`}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <span className="font-mono text-xs md:text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-lg border border-white/15">
                    {scanResult.student?.studentId}
                  </span>
                  {scanResult.student?.school && (
                    <span className="text-xs text-white/60 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                      {scanResult.student.school}
                    </span>
                  )}
                </div>
              </div>

              {/* Class & Fee Confirmation Box */}
              <div className="w-full max-w-lg bg-black/60 border border-emerald-500/30 rounded-xl p-3.5 mb-4 text-left text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <div>
                    <span className="text-[10px] text-white/50 block">Attending Class</span>
                    <span className="text-sm font-bold text-white">{scanResult.class?.name}</span>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-md">
                    {scanResult.feeStatus || 'PAID'} ✅
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/80">
                  <span>{scanResult.class?.subject || 'Class'} ({scanResult.class?.grade || ''})</span>
                  <span className="text-emerald-400 font-semibold">{scanResult.month} Fees Settled</span>
                </div>
              </div>

              {/* Attendance Dispatched Banner */}
              <div className="w-full max-w-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Check size={16} />
                  <span>Attendance Recorded • Automated SMS sent to parent</span>
                </div>
                {countdown > 0 && (
                  <span className="font-mono text-[11px] text-emerald-400 bg-black/40 px-2 py-0.5 rounded">
                    {countdown}s
                  </span>
                )}
              </div>

            </div>
          )}

          {/* STATE 4: ACCESS DENIED (PROMINENT & DRAMATIC RED ALERT) */}
          {scanStatus === 'DENIED' && scanResult && (
            <div className="w-full max-w-2xl flex flex-col items-center text-center p-5 md:p-8 rounded-3xl bg-gradient-to-b from-rose-950/80 via-black/85 to-zinc-950/95 backdrop-blur-2xl border-2 border-rose-500 shadow-[0_0_80px_rgba(244,63,94,0.5)] animate-scale-up">
              
              {/* Alert Banner */}
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/25 border border-rose-500 text-rose-200 font-bold text-xs uppercase tracking-wider mb-4 animate-pulse">
                <AlertTriangle size={14} className="text-rose-400" />
                <span>ACCESS DENIED • ඇතුල්වීම තහනම්</span>
              </div>

              {/* Big Red Stop Icon */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-[0_0_40px_rgba(244,63,94,0.6)] mb-4">
                <XCircle className="text-rose-400" size={44} />
              </div>

              {/* Student Name */}
              <div className="mb-4">
                <span className="text-[11px] uppercase font-bold tracking-wider text-rose-400 block mb-0.5">
                  Class Fee Unpaid
                </span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {scanResult.student?.studentName || `${scanResult.student?.firstName || ''} ${scanResult.student?.lastName || ''}`}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <span className="font-mono text-xs font-bold text-white bg-white/10 px-3 py-1 rounded-lg border border-white/15">
                    {scanResult.student?.studentId}
                  </span>
                  <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30">
                    {scanResult.class?.name}
                  </span>
                </div>
              </div>

              {/* DIRECTIVE BOX: Go to Counter */}
              <div className="w-full max-w-lg bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border border-rose-400 rounded-2xl p-4 mb-4 text-center shadow-lg">
                <div className="flex items-center justify-center gap-1.5 text-white font-black text-base md:text-lg mb-0.5">
                  <AlertOctagon size={20} className="text-rose-400 animate-bounce" />
                  <span>කරුණාකර මුදල් කවුන්ටරය වෙත යන්න</span>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-rose-200 mb-2">
                  PLEASE PROCEED TO THE CASHIER COUNTER
                </p>

                <p className="text-xs text-white/90 mb-2">
                  Class fees for <span className="font-bold underline">{scanResult.month}</span> have not been settled.
                </p>

                <div className="bg-black/50 border border-rose-500/40 rounded-xl py-1.5 px-4 inline-flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-white/50">Amount Pending:</span>
                  <span className="text-base font-black text-rose-400 font-mono">
                    Rs. {Number(scanResult.dueAmount || scanResult.expectedFee || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Safety notice */}
              <div className="flex items-center justify-between w-full max-w-lg text-xs text-rose-300/80 font-medium px-2">
                <span>⛔ Attendance NOT marked • Gate locked</span>
                {countdown > 0 && <span className="font-mono text-white/50">{countdown}s</span>}
              </div>

            </div>
          )}

          {/* STATE 5: ALREADY CHECKED IN */}
          {scanStatus === 'ALREADY_CHECKED_IN' && scanResult && (
            <div className="w-full max-w-xl flex flex-col items-center text-center p-6 rounded-3xl bg-amber-950/60 backdrop-blur-2xl border border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center mb-4">
                <Clock className="text-amber-400" size={36} />
              </div>
              <span className="text-xs uppercase font-bold text-amber-300 mb-1 block">
                Already Checked In Today
              </span>
              <h3 className="text-2xl font-bold text-white mb-1">
                {scanResult.student?.studentName}
              </h3>
              <p className="text-amber-300 font-mono text-xs font-semibold mb-3">
                {scanResult.student?.studentId} • {scanResult.class?.name}
              </p>
              <div className="bg-black/40 border border-amber-500/30 p-3 rounded-xl max-w-md text-xs text-white/70">
                Attendance was already recorded for this session today. Student is permitted to enter.
              </div>
            </div>
          )}

          {/* STATE 6: NOT FOUND */}
          {scanStatus === 'NOT_FOUND' && (
            <div className="w-full max-w-xl flex flex-col items-center text-center p-6 rounded-3xl bg-orange-950/60 backdrop-blur-2xl border border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.3)] animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center mb-4">
                <AlertOctagon className="text-orange-400" size={36} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">
                Card Not Recognized
              </h3>
              <p className="text-xs text-white/70 max-w-md mb-3">
                {scanResult?.message || 'No registered student matches this card. Please proceed to the reception counter.'}
              </p>
              <div className="bg-black/50 border border-white/10 px-3 py-1 rounded-lg text-xs font-mono text-white/50">
                Code: {scanResult?.scannedCode || 'Unknown'}
              </div>
            </div>
          )}

          {/* Quick Input Bar right below center */}
          <form 
            onSubmit={handleManualSubmit}
            className="w-full max-w-md mt-4 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan card or type Student ID / Phone..."
                className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none backdrop-blur-xl transition-all shadow-inner"
              />
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            </div>
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 shadow-md"
            >
              Verify
            </button>
          </form>

        </div>

        {/* RIGHT COLUMN: Live Gate Feed & Today's Attendance Counters */}
        <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0 h-full overflow-hidden">
          
          {/* Real-time Counters */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/40 border border-white/10 p-3 rounded-xl backdrop-blur-xl">
              <span className="text-[10px] uppercase font-bold text-white/50 block mb-0.5">Total</span>
              <span className="text-xl font-bold text-white font-mono">{stats.totalToday}</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl backdrop-blur-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-400/90 block mb-0.5">Granted</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{stats.grantedToday}</span>
            </div>
            <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl backdrop-blur-xl">
              <span className="text-[10px] uppercase font-bold text-rose-400/90 block mb-0.5">Denied</span>
              <span className="text-xl font-bold text-rose-400 font-mono">{stats.deniedToday}</span>
            </div>
          </div>

          {/* Live Recent Scans Activity Log (Only this element scrolls internally) */}
          <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-3.5 flex flex-col overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Live Feed</h3>
              </div>
              <button 
                onClick={loadGateData}
                className="p-1 text-white/40 hover:text-white transition-colors cursor-pointer"
                title="Refresh feed"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
              {stats.recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/30 text-xs">
                  <Radio size={22} className="mb-1.5 opacity-50" />
                  <span>No scans recorded yet.</span>
                </div>
              ) : (
                stats.recentScans.map((scan, idx) => (
                  <div 
                    key={scan.id || idx}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      scan.status === 'DENIED' 
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-200' 
                        : 'bg-white/5 border-white/10 text-white/90'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold truncate text-xs">{scan.studentName || 'Student'}</div>
                      <div className="text-[10px] text-white/50 truncate font-mono mt-0.5">
                        {scan.studentId} • {scan.className}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        scan.status === 'DENIED' ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {scan.status === 'DENIED' ? 'Denied' : 'Granted'}
                      </span>
                      <span className="text-[9px] text-white/40 block mt-0.5 font-mono">
                        {scan.time ? new Date(scan.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Today's Timetable Quick View */}
          {todayScheduledClasses.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block mb-1.5">
                Today's Sessions ({todayScheduledClasses.length})
              </span>
              <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar">
                {todayScheduledClasses.map((cls, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px] py-0.5 border-b border-white/5 last:border-0">
                    <span className="font-medium text-white/90 truncate mr-2">{cls.className}</span>
                    <span className="text-cyan-400 font-mono shrink-0">{cls.startTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Manual Search Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/20 rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Search size={16} className="text-cyan-400" />
                Manual Student Check-In
              </h3>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="text-white/40 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60 mb-3">
              Enter Student ID, RFID code, Phone Number, or Name.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. PHY-STU-14216 or 077..."
                className="w-full bg-black/60 border border-white/20 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-md"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

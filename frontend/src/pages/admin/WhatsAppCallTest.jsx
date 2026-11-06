import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, AlertTriangle, Activity, User, BookOpen, Brain, HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { withAuthToken } from '../../api/axios';
import { io } from 'socket.io-client';

export default function WhatsAppCallTest({ loggedInUser, externalSocket, globalStatus }) {
  const [socket, setSocket] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('IDLE'); // IDLE, RINGING, IN_CALL
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [logs, setLogs] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [activeDuration, setActiveDuration] = useState(0);
  
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callStatusRef = useRef('IDLE'); // Track status inside socket listeners

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    let interval;
    if (callStatus === 'IN_CALL') {
      interval = setInterval(() => {
        setActiveDuration(prev => prev + 1);
      }, 1000);
    } else {
      setActiveDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    // Automatically load the latest recorded call from the database
    const loadLastCall = async () => {
      try {
        const res = await api.get('/admin/database/whatsAppCallRecord?limit=1');
        if (res.data && res.data.data && res.data.data.length > 0) {
          const lastCall = res.data.data[0];
          setAiResult({
             leadPhone: lastCall.leadPhone,
             duration: lastCall.duration,
             aiIsGoodCall: lastCall.aiIsGoodCall,
             aiTone: lastCall.aiTone,
             aiMood: lastCall.aiMood,
             aiSummary: lastCall.aiSummary,
             aiNotes: lastCall.aiNotes,
             aiVibe: lastCall.aiVibe,
             aiStudentQuestions: lastCall.aiStudentQuestions,
             aiFullAnalysis: lastCall.aiFullAnalysis,
             transcription: lastCall.transcription,
             recordingUrl: lastCall.recordingUrl
          });
        }
      } catch (err) {
        console.warn("Could not load previous call record:", err);
      }
    };
    loadLastCall();
  }, []);

  useEffect(() => {
    let activeSocket = externalSocket;
    let createdLocalSocket = false;

    if (!activeSocket) {
        const token = localStorage.getItem('token');
        const defaultSocketUrl = import.meta.env.VITE_API_URL 
        ? import.meta.env.VITE_API_URL.replace('/api', '') 
        : window.location.origin;

        activeSocket = io(defaultSocketUrl, {
            auth: { token },
            transports: ['websocket']
        });
        createdLocalSocket = true;
    }

    setSocket(activeSocket);

    const onConnect = () => {
      addLog('Socket connected.');
      if (callStatusRef.current !== 'IDLE') {
         endCallLocally(activeSocket);
      }
      if (createdLocalSocket || !externalSocket) {
          addLog('Joining WA Agent Pool...');
          activeSocket.emit('join_wa_agent_pool');
      }
    };

    const onDisconnect = () => {
      addLog('Socket disconnected from server.');
      endCallLocally(activeSocket);
    };

    const onCallInvite = (data) => {
      // If we are not ACTIVE in the globalStatus (when provided), ignore calls
      if (globalStatus && globalStatus !== 'ACTIVE') {
          return;
      }
      if (callStatusRef.current !== 'IDLE') {
        addLog(`Ignored call from ${data.from} because agent is busy.`);
        return;
      }
      addLog(`Incoming call from: ${data.from}`);
      setIncomingCall(data);
      setCallStatus('RINGING');
    };

    const onCallEnd = () => {
      addLog('Call ended by remote user.');
      endCallLocally(activeSocket);
    };

    const onCallAnsweredByOther = (data) => {
      if (incomingCall && data.callId === incomingCall.callId) {
          addLog('Call answered by another agent.');
          setIncomingCall(null);
          setCallStatus('IDLE');
          toast("Call answered by another agent.", { icon: 'ℹ️' });
      }
    };

    // Attach listeners
    if (createdLocalSocket) activeSocket.on('connect', onConnect);
    activeSocket.on('disconnect', onDisconnect);
    activeSocket.on('whatsapp_call_invite', onCallInvite);
    activeSocket.on('whatsapp_call_end', onCallEnd);
    activeSocket.on('whatsapp_call_answered_by_other', onCallAnsweredByOther);

    return () => {
      activeSocket.off('disconnect', onDisconnect);
      activeSocket.off('whatsapp_call_invite', onCallInvite);
      activeSocket.off('whatsapp_call_end', onCallEnd);
      activeSocket.off('whatsapp_call_answered_by_other', onCallAnsweredByOther);
      if (createdLocalSocket) {
        activeSocket.off('connect', onConnect);
        activeSocket.emit('leave_wa_agent_pool');
        activeSocket.disconnect();
      }
      endCallLocally(null);
    };
  }, [externalSocket, globalStatus, incomingCall]);

  const startRecording = (local, remote) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      
      const localSource = audioCtx.createMediaStreamSource(local);
      const remoteSource = audioCtx.createMediaStreamSource(remote);
      
      localSource.connect(dest);
      remoteSource.connect(dest);
      
      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        const durationSecs = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
        addLog(`Recording stopped. Duration: ${durationSecs}s. Uploading for AI Analysis...`);
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'call_recording.webm');
        formData.append('leadPhone', incomingCall?.from || '');
        formData.append('duration', durationSecs);
        // We let the backend figure out agentId from JWT
        
        try {
          const res = await api.post('/admin/whatsapp-call/upload-recording', formData);
          if(res.data.success) {
            setAiResult(res.data.record);
            addLog('AI Analysis complete.');
            toast.success('AI Student Card Generated!');
          }
        } catch(e) {
          addLog(`Failed to upload recording: ${e.response?.data?.error || e.message}`);
        }
      };
      
      recorder.start();
      // callStartTimeRef.current is now set when call actually connects (IN_CALL)
      addLog('Call recording started (Local + Remote mixed).');
    } catch(err) {
      addLog(`Recording error: ${err.message}`);
    }
  };

  const endCallLocally = (socketOverride) => {
    setCallStatus('IDLE');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    const currentSocket = socketOverride !== undefined ? socketOverride : socket;
    if (currentSocket) {
      currentSocket.emit('join_wa_agent_pool');
    }
  };

  const handleAcceptCall = async () => {
    try {
      if (peerConnectionRef.current) return; // Prevent double click
      setAiResult(null);
      socket?.emit('leave_wa_agent_pool');
      addLog('Accepting call... accessing microphone.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        addLog('Receiving remote audio stream.');
        const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.play().catch(e => console.warn(e));
        }
        startRecording(stream, remoteStream);
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
          addLog(`WebRTC Connection State: ${pc.iceConnectionState}. Ending call locally.`);
          endCallLocally();
        } else if (pc.iceConnectionState === 'disconnected') {
          addLog(`WebRTC Connection State: disconnected. Waiting for webhook or recovery...`);
        }
      };

      pc.onicegatheringstatechange = async () => {
        addLog(`ICE Gathering State: ${pc.iceGatheringState}`);
        if (pc.iceGatheringState === 'complete') {
          addLog('ICE Gathering Complete. Sending full SDP Answer to Meta...');
          try {
            await api.post('/admin/whatsapp-call/answer', {
              callId: incomingCall.callId,
              sdp: pc.localDescription.sdp
            });
            setCallStatus('IN_CALL');
            callStartTimeRef.current = Date.now();
            toast.success('Call Connected!');
          } catch (error) {
            addLog(`Error sending answer: ${error.response ? error.response.data.error : error.message}`);
            toast.error('Failed to connect call');
            endCallLocally();
          }
        }
      };

      // Set remote offer FIRST
      const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp: incomingCall.sdp });
      await pc.setRemoteDescription(remoteDesc);

      // Add track AFTER remote offer to ensure sendrecv direction
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      setTimeout(async () => {
        if (pc.iceGatheringState !== 'complete' && callStatus !== 'IN_CALL') {
            addLog('ICE Gathering Timeout. Sending partial SDP Answer...');
            try {
              await api.post('/admin/whatsapp-call/answer', {
                callId: incomingCall.callId,
                sdp: pc.localDescription.sdp
              });
              setCallStatus('IN_CALL');
              callStartTimeRef.current = Date.now();
              toast.success('Call Connected!');
            } catch (error) {
              addLog(`Timeout Error sending answer: ${error.response ? error.response.data.error : error.message}`);
            }
        }
      }, 5000);

    } catch (error) {
      addLog(`Error accepting call: ${error.message}`);
      toast.error('Failed to accept call');
      endCallLocally();
    }
  };

  const handleRejectCall = async () => {
    try {
      addLog('Rejecting call...');
      if (incomingCall) {
        await api.post('/admin/whatsapp-call/reject', { callId: incomingCall.callId });
      }
      endCallLocally();
    } catch (error) {
      addLog(`Error rejecting: ${error.message}`);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <PhoneCall size={28} className="text-green-500" />
        <h1 className="text-2xl font-bold text-white">WhatsApp Call Sandbox</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Softphone Panel */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden backdrop-blur-xl">
          {callStatus === 'IDLE' && (
            <div className="text-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Phone size={40} className="text-gray-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-400">Waiting for Calls</h2>
              <p className="text-sm text-gray-500 mt-2">Make a WhatsApp call to the CRM number to test.</p>
            </div>
          )}

          {callStatus === 'RINGING' && (
            <div className="text-center animate-pulse">
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                <Phone size={40} className="text-green-400 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-white">Incoming Call</h2>
              <p className="text-lg text-green-400 mt-1 font-mono">{incomingCall?.from}</p>
              
              <div className="flex gap-4 mt-8 justify-center">
                <button onClick={handleRejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                  <PhoneOff size={24} className="text-white" />
                </button>
                <button onClick={handleAcceptCall} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                  <Phone size={24} className="text-white" />
                </button>
              </div>
            </div>
          )}

          {callStatus === 'IN_CALL' && (
            <div className="text-center w-full">
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                <Activity size={40} className="text-blue-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white">In Call</h2>
              <p className="text-lg text-blue-400 mt-1 font-mono">{incomingCall?.from}</p>
              <div className="text-4xl font-mono text-white mt-4 tracking-widest bg-black/20 p-4 rounded-xl border border-blue-500/30 inline-block shadow-inner">{formatDuration(activeDuration)}</div>


              <div className="flex gap-6 mt-8 justify-center bg-black/30 p-4 rounded-2xl w-max mx-auto border border-white/5">
                <button onClick={toggleMute} className={`p-4 rounded-xl transition-all ${isMuted ? 'bg-amber-500/20 text-amber-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button onClick={() => setIsSpeaker(!isSpeaker)} className={`p-4 rounded-xl transition-all ${!isSpeaker ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {isSpeaker ? <Volume2 size={24} /> : <VolumeX size={24} />}
                </button>
                <button onClick={() => {
                  api.post('/admin/whatsapp-call/reject', { callId: incomingCall?.callId }).catch(e=>{});
                  endCallLocally();
                }} className="p-4 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                  <PhoneOff size={24} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logs Panel */}
        <div className="bg-black/80 border border-white/10 rounded-3xl p-6 font-mono text-xs flex flex-col h-[400px]">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-4 border-b border-white/10 pb-2">
            <Activity size={14} /> System Logs
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 text-gray-400 custom-scrollbar pr-2">
            {logs.length === 0 && <span className="opacity-50">Waiting for events...</span>}
            {logs.map((log, i) => (
              <div key={i} className="break-all">{log}</div>
            ))}
          </div>
        </div>
      </div>
      
      {/* AI Student Card Generated after Call */}
      {aiResult && (
        <div className="mt-6 bg-slate-900 border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Brain size={120} className="text-emerald-500" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="bg-emerald-500/20 p-3 rounded-2xl text-emerald-400 ring-1 ring-emerald-500/50">
                    <User size={28} />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Student Interaction Card</h2>
                        {aiResult.aiIsGoodCall !== null && (
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${aiResult.aiIsGoodCall ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {aiResult.aiIsGoodCall ? 'SUCCESSFUL CALL' : 'NEEDS ATTENTION'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-gray-400 font-mono">Lead: {aiResult.leadPhone}</p>
                        <p className="text-sm text-gray-400 font-mono flex items-center gap-1"><Activity size={12}/> Duration: {formatDuration(aiResult.duration || 0)}</p>
                    </div>
                </div>
                {aiResult.recordingUrl && (
                    <div className="ml-auto bg-black/40 p-2 rounded-xl border border-white/10 flex items-center shadow-inner">
                        <audio controls className="h-10 w-64 outline-none" src={withAuthToken(`${api.defaults.baseURL}/public/whatsapp-recording/${aiResult.recordingUrl}`)} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {/* Metrics Column */}
                <div className="flex flex-col gap-4">
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                            <HeartPulse size={16} className="text-pink-400" />
                            <span className="font-semibold text-xs uppercase tracking-widest text-pink-400/80">Emotional Profile</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Customer Mood</p>
                                <p className="text-lg font-medium text-white capitalize">{aiResult.aiMood || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Agent Tone</p>
                                <p className="text-lg font-medium text-white capitalize">{aiResult.aiTone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Overall Vibe</p>
                                <p className="text-lg font-medium text-white capitalize">{aiResult.aiVibe || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                            <AlertTriangle size={16} className="text-amber-400" />
                            <span className="font-semibold text-xs uppercase tracking-widest text-amber-400/80">Student Questions</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {aiResult.aiStudentQuestions || 'No specific questions asked.'}
                        </p>
                    </div>
                </div>

                {/* Analysis Column */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md flex-1">
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                            <Brain size={16} className="text-purple-400" />
                            <span className="font-semibold text-xs uppercase tracking-widest text-purple-400/80">Full AI Analysis & Summary</span>
                        </div>
                        <div className="space-y-4">
                            <p className="text-white font-medium text-sm leading-relaxed bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
                                {aiResult.aiSummary || 'Summary not available.'}
                            </p>
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Detailed Breakdown:</span>
                                {aiResult.aiFullAnalysis || 'Detailed analysis not available.'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-md">
                            <div className="flex items-center gap-2 text-gray-400 mb-3">
                                <BookOpen size={16} className="text-blue-400" />
                                <span className="font-semibold text-xs uppercase tracking-widest text-blue-400/80">Key Notes & Actions</span>
                            </div>
                            <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed custom-scrollbar max-h-32 overflow-y-auto pr-2">
                                {aiResult.aiNotes || 'No specific notes extracted.'}
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-2xl p-5 border border-white/5 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Mic size={16} className="text-emerald-400" />
                                    <span className="font-semibold text-xs uppercase tracking-widest text-emerald-400/80">Call Script / Transcription</span>
                                </div>
                            </div>
                            <div className="text-gray-400 text-xs font-mono whitespace-pre-wrap leading-relaxed custom-scrollbar max-h-32 overflow-y-auto pr-2 relative z-10">
                                {aiResult.transcription || 'Transcription not available for this call.'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Hidden Audio Element for Remote Stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}

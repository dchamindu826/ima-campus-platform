import React, { useState, useEffect, useRef } from 'react';
import { FaPhoneAlt, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaSpinner } from 'react-icons/fa';
import toast from 'react-hot-toast';
import axios from '../../../api/axios';
import { io } from 'socket.io-client';

export default function OutboundDialerModal({ isOpen, onClose, selectedLead, businessId, campaignType }) {
  const [socket, setSocket] = useState(null);
  const [callStatus, setCallStatus] = useState('IDLE'); // IDLE, DIALING, RINGING, CONNECTED
  const [callId, setCallId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(0);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Connect to Socket.io for Webhooks
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const defaultSocketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '') 
      : `${protocol}//${host}:5000`;
    
    const socketUrl = axios.defaults.baseURL ? axios.defaults.baseURL.replace('/api', '') : defaultSocketUrl;

    const newSocket = io(socketUrl, {
      auth: { token: token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Dialer Socket connected');
    });

    newSocket.on('whatsapp_call_status', (data) => {
      console.log('Call Status Update:', data);
      if (data.status === 'RINGING') setCallStatus('RINGING');
      if (data.status === 'REJECTED') {
          toast.error("Call was rejected or customer didn't answer.");
          endCall();
      }
      if (data.status === 'ACCEPTED') {
          setCallStatus('CONNECTED');
          startTimer();
      }
    });

    newSocket.on('whatsapp_outbound_answer', async (data) => {
        console.log("Received SDP Answer from Meta:", data);
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
            try {
                const remoteDesc = new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.sdp
                });
                await peerConnectionRef.current.setRemoteDescription(remoteDesc);
                console.log("Remote description set successfully");
            } catch (err) {
                console.error("Error setting remote SDP:", err);
                toast.error("Failed to connect audio.");
            }
        }
    });

    newSocket.on('whatsapp_call_end', (data) => {
        console.log("Call ended by Meta:", data);
        toast.error("Call ended by customer");
        endCall();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      cleanupCall();
    };
  }, [isOpen]);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const callIdRef = useRef(null);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Protect call from accidental page refresh or tab close
  useEffect(() => {
    if (callStatus === 'DIALING' || callStatus === 'RINGING' || callStatus === 'CONNECTED') {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'Call in progress. Reloading or leaving will disconnect the call.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [callStatus]);

  const startRecording = (local, remote) => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;
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
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (!recordedChunksRef.current.length) {
          cleanupCall();
          onClose();
          return;
        }
        console.log("[Outbound Recording] Stopped. Uploading for AI analysis...");
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'outbound_call.webm');
        formData.append('leadPhone', selectedLead?.phone || '');
        formData.append('duration', durationRef.current || 0);
        formData.append('direction', 'OUTBOUND');
        if (callIdRef.current) formData.append('callId', callIdRef.current);

        try {
          const token = localStorage.getItem('token');
          await axios.post('/admin/whatsapp-call/upload-recording', formData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log("[Outbound Recording] Successfully uploaded and processed!");
        } catch (e) {
          console.error("Failed to upload outbound recording:", e);
        } finally {
          cleanupCall();
          onClose();
        }
      };

      recorder.start(1000);
      console.log("[Outbound Recording] MediaRecorder started");
    } catch (err) {
      console.error("Error setting up outbound audio recording:", err);
    }
  };

  // Initiate the call automatically when the modal opens (or user can press dial)
  const dialCustomer = async () => {
    try {
      setCallStatus('DIALING');
      
      // 1. Get Microphone Access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported. Please ensure you are using HTTPS or localhost.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // 2. Create Peer Connection
      const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote audio
      pc.ontrack = (event) => {
        console.log("Received remote audio track");
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(e => console.error("Audio play error:", e));
        }
        startRecording(stream, event.streams[0]);
      };

      // 3. Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send Offer to Meta
      const sendOffer = async (sdp) => {
        try {
           const token = localStorage.getItem('token');
           const response = await axios.post('/admin/whatsapp-call/initiate', {
               to: selectedLead.phone,
               sdp: sdp,
               businessId: businessId,
               campaignType: campaignType
           }, { headers: { Authorization: `Bearer ${token}` } });
           
           if (response.data.success) {
               setCallId(response.data.callId);
               callIdRef.current = response.data.callId;
               console.log("Initiated call via Meta", response.data.callId);
           }
        } catch (apiError) {
           console.error("Error initiating via backend:", apiError);
           toast.error(apiError.response?.data?.error || "Failed to initiate call");
           endCall();
        }
      };

      let sent = false;
      const triggerOffer = () => {
        if (!sent && pc.localDescription?.sdp) {
          sent = true;
          sendOffer(pc.localDescription.sdp);
        }
      };

      if (pc.iceGatheringState === 'complete') {
        triggerOffer();
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete' || pc.iceGatheringState === 'interactive') {
            triggerOffer();
          }
        };
        // Fallback after 1 second if ICE gathering takes time
        setTimeout(() => {
          triggerOffer();
        }, 1000);
      }

    } catch (error) {
      console.error("Error setting up call:", error);
      toast.error(error.message || "Could not access microphone.");
      setCallStatus('IDLE');
    }
  };

  const endCall = async () => {
      setIsSaving(true);
      const currentCallId = callId;

      // Disconnect media immediately
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (currentCallId) {
          try {
              const token = localStorage.getItem('token');
              await axios.post('/admin/whatsapp-call/terminate', {
                  callId: currentCallId,
                  businessId: businessId,
                  campaignType: campaignType,
                  leadPhone: selectedLead?.phone,
                  duration: duration
              }, { headers: { Authorization: `Bearer ${token}` } });
              console.log("[OutboundDialer] Call terminated on Meta Cloud API successfully");
          } catch (err) {
              console.error("[OutboundDialer] Error terminating call via backend:", err);
          }
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop(); // Triggers onstop which will onClose()
      } else {
        cleanupCall();
        onClose();
      }
  };

  const cleanupCall = () => {
    setIsSaving(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCallStatus('IDLE');
    setCallId(null);
    setDuration(0);
  };

  const startTimer = () => {
      setDuration(0);
      timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
      }, 1000);
  };

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
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

  if (!isOpen) return null;

  if (!isOpen) return null;

  const isCallActive = callStatus === 'DIALING' || callStatus === 'RINGING' || callStatus === 'CONNECTED';

  if (isCallActive || isSaving) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        
        <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.4)] px-5 py-3 flex items-center gap-4 animate-fade-in-down">
          <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center text-emerald-400 font-bold text-base shrink-0 shadow-inner">
            {selectedLead?.name?.charAt(0) || '#'}
          </div>

          <div className="flex flex-col min-w-[130px]">
            <h4 className="text-white font-bold text-sm tracking-wide truncate max-w-[160px]">
              {selectedLead?.name || 'Customer'}
            </h4>
            <span className="text-slate-400 font-mono text-[11px]">
              {selectedLead?.phone ? selectedLead.phone.split('_')[0] : ''}
            </span>
          </div>

          {isSaving ? (
            <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold px-2">
              <FaSpinner className="animate-spin text-blue-400" size={14} /> Saving...
            </div>
          ) : (
            <>
              {(callStatus === 'DIALING' || callStatus === 'RINGING') && (
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs animate-pulse px-2">
                  <FaSpinner className="animate-spin" size={14} />
                  <span>{callStatus === 'DIALING' ? 'Dialing...' : 'Ringing...'}</span>
                </div>
              )}

              {callStatus === 'CONNECTED' && (
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-mono text-base font-bold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                    {formatTime(duration)}
                  </span>

                  <button 
                    onClick={toggleMute} 
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all shadow-md ${
                      isMuted ? 'bg-amber-500 hover:bg-amber-400' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <FaMicrophoneSlash size={14} /> : <FaMicrophone size={14} />}
                  </button>
                </div>
              )}

              <button 
                onClick={endCall} 
                className="w-9 h-9 bg-red-600 hover:bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105 shrink-0"
                title="End Call"
              >
                <FaPhoneSlash size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        
        <div className="bg-[#1e293b] rounded-3xl w-full max-w-sm p-8 shadow-2xl border border-slate-700 flex flex-col items-center animate-fade-in-up">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-4xl text-white font-bold mb-4 shadow-inner">
                {selectedLead?.name?.charAt(0) || '#'}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">{selectedLead?.name || 'Customer'}</h2>
            <p className="text-slate-400 mb-8 font-mono">{selectedLead?.phone}</p>

            <button onClick={dialCustomer} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-emerald-500/20 transition-all">
                <FaPhoneAlt /> Start Call
            </button>

            <button onClick={onClose} className="mt-6 text-slate-500 hover:text-white font-medium">Cancel</button>
        </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axios';

export default function HeadlessIvrBot() {
    const { callId } = useParams();
    const [searchParams] = useSearchParams();
    const ringtoneUrl = searchParams.get('ringtoneUrl');

    const [status, setStatus] = useState('Initializing...');
    const socketRef = useRef(null);
    const audioRef = useRef(null);
    const pcRef = useRef(null);
    const streamRef = useRef(null);
    const callDataRef = useRef(null);

    useEffect(() => {
        if (!callId) {
            setStatus('Error: No callId provided');
            return;
        }

        // Initialize Socket
        const defaultSocketUrl = import.meta.env.VITE_API_URL 
            ? import.meta.env.VITE_API_URL.replace('/api', '') 
            : 'http://localhost:5000';

        // Connect as headless bot
        const socket = io(defaultSocketUrl, {
            query: { isHeadlessBot: true },
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setStatus('Connected to signaling server');
            // The backend emits 'incoming_wa_call' to 'wa_call_headless_bot'.
            // Because we might miss it if emitted before we connect, we should ideally fetch it via API
            // But let's listen just in case we are fast enough, OR we can request the backend for the call payload.
            // For now, let's just listen. The backend triggers the bot, so there is a slight race condition.
            socket.emit('join_headless_bot_room'); 
        });

        // Listen for the payload from Puppeteer
        const handleBotPayload = async () => {
            if (window.botPayload && window.botPayload.callId === callId) {
                setStatus('Call payload received from Puppeteer. Accepting call...');
                callDataRef.current = window.botPayload;
                await acceptCall(window.botPayload);
            }
        };

        if (window.botPayload) {
            handleBotPayload();
        } else {
            window.addEventListener('BotPayloadReady', handleBotPayload);
        }

        socket.on('incoming_wa_call', async (payload) => {
            // Fallback: if we receive via socket, use it
            if (payload.callId === callId && !callDataRef.current) {
                setStatus('Call payload received via socket. Accepting call...');
                callDataRef.current = payload;
                await acceptCall(payload);
            }
        });

        return () => {
            window.removeEventListener('BotPayloadReady', handleBotPayload);
            if (socket) socket.disconnect();
            terminateCall(true);
        };
    }, [callId]);

    const acceptCall = async (payload) => {
        try {
            // Setup WebRTC
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            pcRef.current = pc;

            // Load audio file
            const audioUrl = ringtoneUrl 
                ? (ringtoneUrl.startsWith('http') ? ringtoneUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${ringtoneUrl}`) 
                : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/storage/ringtone/01.mp3`;

            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.src = audioUrl;
            audioRef.current = audio;

            // Important: We must play the audio to capture the stream
            await audio.play();
            setStatus('Audio playing, capturing stream...');

            // Capture the stream from the audio element (HTMLMediaElement.captureStream)
            // Some browsers require vendor prefixes, but Puppeteer/Chrome supports captureStream()
            const stream = audio.captureStream ? audio.captureStream() : audio.mozCaptureStream();
            streamRef.current = stream;

            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Set up Answer
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer SDP to backend
            await api.post('/admin/whatsapp-call/answer', {
                callId: payload.callId,
                sdp: answer.sdp,
                businessType: payload.businessType,
                receivingWaNumId: payload.receivingWaNumId
            });
            
            // Loop the audio continuously until the caller hangs up
            audio.loop = true;
            
            setStatus('Call connected. Streaming audio continuously...');

            // Stop call when audio finishes naturally (won't happen if looping, but keeping as fallback)
            audio.onended = () => {
                console.log('Audio finished.');
            };

            // Failsafe: kill call after 5 minutes to prevent endless loops if caller doesn't hang up properly
            setTimeout(() => {
                console.log('Failsafe timeout reached, terminating call...');
                terminateCall();
            }, 5 * 60 * 1000); // 5 minutes

        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn('Audio play aborted (likely due to React Strict Mode unmount), ignoring...');
                return;
            }
            console.error('Error accepting call headless:', err);
            setStatus(`Error: ${err.message}`);
            terminateCall();
        }
    };

    const terminateCall = async (isCleanup = false) => {
        const payload = callDataRef.current;
        if (payload && !isCleanup) {
            try {
                await api.post('/admin/whatsapp-call/terminate', {
                    callId: payload.callId,
                    businessType: payload.businessType,
                    receivingWaNumId: payload.receivingWaNumId,
                    leadPhone: payload.from,
                    isNewInquiry: payload.isNewInquiry,
                    businessId: payload.businessId,
                    duration: 30
                });
            } catch (err) {
                // Ignore
            }
        }

        if (pcRef.current) pcRef.current.close();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        
        setStatus('Call terminated.');
        
        // Signal puppeteer to close the browser
        if (!isCleanup) {
            console.log('BOT_DONE');
        }
    };

    return (
        <div style={{ backgroundColor: 'black', color: '#00ff00', padding: 20, fontFamily: 'monospace', height: '100vh' }}>
            <h1>Headless IVR Bot</h1>
            <p>Call ID: {callId}</p>
            <p>Status: {status}</p>
        </div>
    );
}

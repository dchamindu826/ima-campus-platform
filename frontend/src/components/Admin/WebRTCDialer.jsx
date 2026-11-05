import React, { useState, useEffect, useRef } from 'react';
import { UserAgent, Registerer, Inviter, SessionState } from 'sip.js';
import { FaPhoneAlt, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaSpinner } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function WebRTCDialer({ extension, password, sipDomain }) {
    const [status, setStatus] = useState('DISCONNECTED'); // DISCONNECTED, REGISTERED, DIALING, RINGING, CONNECTED
    const [targetNumber, setTargetNumber] = useState('');
    const [session, setSession] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    
    const userAgentRef = useRef(null);
    const registererRef = useRef(null);
    const remoteAudioRef = useRef(null);

    useEffect(() => {
        // Initialize SIP.js UserAgent
        const uri = UserAgent.makeURI(`sip:${extension}@${sipDomain}`);
        if (!uri) {
            toast.error("Invalid SIP Extension or Domain");
            return;
        }

        const transportOptions = {
            server: `wss://${sipDomain}:7443`,
            traceSip: true,
        };

        const userAgentOptions = {
            authorizationPassword: password,
            authorizationUsername: extension,
            transportOptions,
            uri,
            delegate: {
                onConnect: () => {
                    console.log("SIP.js Connected");
                    if (registererRef.current) registererRef.current.register();
                },
                onDisconnect: (error) => {
                    console.error("SIP.js Disconnected", error);
                    setStatus('DISCONNECTED');
                },
                onInvite: (invitation) => {
                    // Incoming call handling
                    invitation.stateChange.addListener((state) => {
                        if (state === SessionState.Established) {
                            setStatus('CONNECTED');
                            setupRemoteMedia(invitation);
                        } else if (state === SessionState.Terminated) {
                            setStatus('REGISTERED');
                            setSession(null);
                        }
                    });
                    
                    // Auto-accept for testing (in production, show a UI to answer/reject)
                    invitation.accept().then(() => {
                        setSession(invitation);
                    });
                }
            }
        };

        const ua = new UserAgent(userAgentOptions);
        userAgentRef.current = ua;

        const registerer = new Registerer(ua);
        registererRef.current = registerer;

        registerer.stateChange.addListener((newState) => {
            if (newState === 'Registered') {
                setStatus('REGISTERED');
                toast.success(`Extension ${extension} Registered Successfully!`);
            } else if (newState === 'Unregistered') {
                setStatus('DISCONNECTED');
            }
        });

        ua.start().catch(e => {
            console.error("Failed to start UserAgent", e);
            toast.error("Failed to connect to PBX");
        });

        return () => {
            if (ua) {
                ua.stop();
            }
        };
    }, [extension, password, sipDomain]);

    const setupRemoteMedia = (session) => {
        const remoteStream = new MediaStream();
        session.sessionDescriptionHandler.peerConnection.getReceivers().forEach((receiver) => {
            if (receiver.track) {
                remoteStream.addTrack(receiver.track);
            }
        });
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play();
        }
    };

    const makeCall = () => {
        if (!userAgentRef.current || !targetNumber) return;
        
        const targetURI = UserAgent.makeURI(`sip:${targetNumber}@${sipDomain}`);
        if (!targetURI) return;

        const inviter = new Inviter(userAgentRef.current, targetURI);
        
        inviter.stateChange.addListener((state) => {
            if (state === SessionState.Establishing) setStatus('DIALING');
            else if (state === SessionState.Established) {
                setStatus('CONNECTED');
                setupRemoteMedia(inviter);
            } else if (state === SessionState.Terminated) {
                setStatus('REGISTERED');
                setSession(null);
                toast.error("Call Ended");
            }
        });

        inviter.invite().then(() => {
            setSession(inviter);
        }).catch(err => {
            console.error("Invite failed", err);
            setStatus('REGISTERED');
            toast.error("Call Failed");
        });
    };

    const endCall = () => {
        if (session) {
            if (session.state === SessionState.Established) {
                session.bye();
            } else if (session.state === SessionState.Establishing) {
                if (session instanceof Inviter) {
                    session.cancel();
                }
            }
        }
    };

    const toggleMute = () => {
        if (session && session.sessionDescriptionHandler) {
            const peerConnection = session.sessionDescriptionHandler.peerConnection;
            peerConnection.getSenders().forEach((sender) => {
                if (sender.track && sender.track.kind === 'audio') {
                    sender.track.enabled = !sender.track.enabled;
                    setIsMuted(!sender.track.enabled);
                }
            });
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <audio ref={remoteAudioRef} autoPlay />
            
            <div className="text-center mb-6">
                <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${status === 'REGISTERED' || status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                <h3 className="text-xl font-bold text-white">Ext: {extension}</h3>
                <p className="text-xs font-mono text-slate-400">{status}</p>
            </div>

            {status !== 'CONNECTED' && status !== 'DIALING' && (
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={targetNumber}
                        onChange={(e) => setTargetNumber(e.target.value)}
                        placeholder="Enter Ext or Phone Number" 
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-center text-xl font-mono text-white outline-none focus:border-emerald-500"
                    />
                    <button 
                        onClick={makeCall}
                        disabled={status !== 'REGISTERED' || !targetNumber}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <FaPhoneAlt /> Call
                    </button>
                </div>
            )}

            {(status === 'DIALING' || status === 'CONNECTED') && (
                <div className="flex flex-col items-center justify-center space-y-8 py-4">
                    <div className="text-3xl font-mono font-bold text-white tracking-widest">{targetNumber}</div>
                    
                    <div className="flex items-center gap-6">
                        {status === 'CONNECTED' && (
                            <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${isMuted ? 'bg-amber-500 hover:bg-amber-400' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                {isMuted ? <FaMicrophoneSlash size={20} /> : <FaMicrophone size={20} />}
                            </button>
                        )}
                        <button onClick={endCall} className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 transform hover:scale-110 transition-all">
                            <FaPhoneSlash size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

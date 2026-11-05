import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ShieldCheck, ScanLine, Loader2, Bot } from 'lucide-react';

export default function ScanningOverlay({ isScanning, progress, results, onClose }) {
  const overlayRef = useRef(null);
  const scannerRef = useRef(null);
  const dataRefs = useRef([]);

  useEffect(() => {
    if (isScanning && overlayRef.current) {
      gsap.fromTo(overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power2.out" }
      );

      if (scannerRef.current) {
        gsap.fromTo(scannerRef.current,
          { y: -100, opacity: 0 },
          { y: 300, opacity: 1, duration: 1.5, repeat: -1, yoyo: true, ease: "power1.inOut" }
        );
      }
    }
  }, [isScanning]);

  useEffect(() => {
    if (results) {
      gsap.fromTo(dataRefs.current,
        { opacity: 0, scale: 0.8, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "back.out(1.7)" }
      );
    }
  }, [results]);

  if (!isScanning && !results) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl">
      <div className="relative w-full max-w-4xl h-[80vh] border border-cyan-500/20 bg-slate-950/50 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_80px_-20px_rgba(6,182,212,0.4)]">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold text-white tracking-widest uppercase">AI Core Bulk Verification</h2>
              <p className="text-cyan-400/60 text-xs font-mono">{isScanning ? 'PROCESSING BATCH...' : 'VERIFICATION COMPLETE'}</p>
            </div>
          </div>
          {!isScanning && (
            <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-mono text-sm transition-colors">
              CLOSE TERMINAL
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 relative p-8 overflow-y-auto custom-scrollbar">
          {isScanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-64 h-64 border border-cyan-500/30 rounded-2xl flex items-center justify-center bg-cyan-950/20 overflow-hidden mb-8">
                <div ref={scannerRef} className="flex items-center justify-center bg-cyan-500/20 backdrop-blur-sm p-6 rounded-full border border-cyan-400/50 shadow-[0_0_40px_10px_#22d3ee55]">
                  <Bot className="w-16 h-16 text-cyan-300 animate-pulse" />
                </div>
              </div>
              
              {/* Progress Bar Container */}
              <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-2 font-mono text-xs text-cyan-400">
                  <span>Extracting document metadata...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-cyan-500 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="bg-slate-900/50 border border-cyan-500/30 p-8 rounded-3xl text-center w-full max-w-2xl shadow-2xl">
                <ShieldCheck className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-8 tracking-widest uppercase">Verification Summary</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-950/80 p-6 rounded-2xl border border-blue-500/30 flex flex-col items-center justify-center">
                    <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Processed</p>
                    <p className="text-4xl font-black text-white">{results.processed}</p>
                  </div>
                  <div className="bg-green-950/40 p-6 rounded-2xl border border-green-500/50 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                    <p className="text-sm font-bold text-green-400 uppercase tracking-widest mb-2">Verified</p>
                    <p className="text-4xl font-black text-white">{results.verified}</p>
                  </div>
                  <div className="bg-yellow-950/40 p-6 rounded-2xl border border-yellow-500/50 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.15)]">
                    <p className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-2">Skipped</p>
                    <p className="text-4xl font-black text-white">{results.skipped}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

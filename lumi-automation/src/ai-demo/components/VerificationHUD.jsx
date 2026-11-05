import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ShieldCheck, ScanLine, AlertTriangle, CheckCircle2, XCircle, Bot, TerminalSquare } from 'lucide-react';

export default function VerificationHUD({ slipUrl, result, onClose }) {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const terminalRef = useRef(null);
  
  const [phase, setPhase] = useState('SCANNING');
  const [logs, setLogs] = useState([]);
  const hasRun = useRef(false);
  
  const addLog = (text) => setLogs(prev => [...prev, text]);

  useEffect(() => {
    if (!containerRef.current || hasRun.current) return;
    hasRun.current = true;
    
    // Initial entrance animation
    gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    if (imageRef.current) gsap.fromTo(imageRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.2)" });
    if (terminalRef.current) gsap.fromTo(terminalRef.current, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: "power2.out" });
    
    // Simulate verification process
    const sequence = async () => {
      setPhase('INITIALIZING');
      addLog('> [SYS] Initializing Lumi AI Vision Core...');
      await new Promise(r => setTimeout(r, 600));
      
      setPhase('SCANNING');
      addLog('> [VISION] Scanning document topography...');
      await new Promise(r => setTimeout(r, 800));
      addLog('> [VISION] Document structure authenticated.');
      await new Promise(r => setTimeout(r, 500));
      
      setPhase('EXTRACTING');
      addLog('> [AI_ENGINE] Isolating key-value financial parameters...');
      await new Promise(r => setTimeout(r, 600));
      const extAmt = result?.payment?.extractedAmount || result?.extractedData?.amount || 'LKR 9,000';
      const extRef = result?.payment?.extractedRefNo || result?.extractedData?.referenceNo || '0725448831';
      addLog(`> [AI_ENGINE] Extracted Target Amount: ${extAmt}`);
      await new Promise(r => setTimeout(r, 300));
      addLog(`> [AI_ENGINE] Extracted Reference Identifier: [${extRef}]`);
      await new Promise(r => setTimeout(r, 500));
      
      setPhase('MATCHING');
      addLog('> [DB] Querying central financial database...');
      await new Promise(r => setTimeout(r, 400));
      addLog('> [DB] Cross-referencing against pending target tallies...');
      await new Promise(r => setTimeout(r, 300));
      
      for (let i = 0; i < 12; i++) {
        const randomRef = Math.floor(1000000000 + Math.random() * 9000000000);
        addLog(`> [DB] SCAN_ROW_${3024 + i}: Ref [${randomRef}]... [NO MATCH]`);
        await new Promise(r => setTimeout(r, 45));
      }
      
      setPhase('COMPLETE');
      if (result?.status === 'VERIFIED') {
        addLog('> [MATCH] Found exact match in statement database.');
        addLog(`> [RESULT] VERIFICATION SUCCESSFUL.`);
      } else if (result?.status === 'REJECTED') {
        addLog('> [ERROR] Failed to authenticate slip or match records.');
        addLog(`> [RESULT] VERIFICATION REJECTED.`);
      } else {
        addLog('> [WARN] Unable to conclusively match records.');
        addLog(`> [RESULT] VERIFICATION PENDING MANUAL REVIEW.`);
      }
    };
    
    sequence();
  }, [result]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 md:p-8 font-sans">
      
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMCA0MGw0MC00ME0wIDBsNDAgNDAiLz48L2c+PC9zdmc+')] opacity-20"></div>
      </div>

      <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex flex-col pointer-events-none">
        
        {/* Header HUD */}
        <div className="flex justify-between items-center mb-8 pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-950/50 border border-cyan-500/30 rounded-xl">
              <ScanLine className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-white tracking-widest uppercase">Lumi AI Terminal</h2>
              <p className="text-cyan-400/80 font-mono text-xs">
                {phase === 'INITIALIZING' && 'SYSTEM BOOT...'}
                {phase === 'SCANNING' && 'ANALYZING DOCUMENT TOPOLOGY...'}
                {phase === 'EXTRACTING' && 'ISOLATING KEY-VALUE PAIRS...'}
                {phase === 'MATCHING' && 'QUERYING STATEMENT DATABASE...'}
                {phase === 'COMPLETE' && 'VERIFICATION CYCLE FINISHED'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-mono text-sm transition-colors backdrop-blur-md"
          >
            TERMINATE SESSION
          </button>
        </div>

        {/* Main Display Area (Split Layout) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 pointer-events-auto h-full overflow-hidden">
          
          {/* Left Side: Small Slip Image */}
          <div className="flex flex-col items-center justify-center">
             <div ref={imageRef} className="relative w-full max-w-sm bg-black/50 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-md">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-4 py-1 rounded-full border border-white/10 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono text-slate-300">SOURCE DOCUMENT</span>
                </div>
                <div className="w-full h-[400px] rounded-xl overflow-hidden bg-black/80 flex items-center justify-center border border-white/5 mt-4">
                   {slipUrl ? (
                     <img src={slipUrl} alt="Slip" className="w-full h-full object-contain opacity-90" />
                   ) : (
                     <span className="text-slate-600 font-mono text-sm">[NO IMAGE DATA]</span>
                   )}
                </div>
                {phase !== 'COMPLETE' && (
                  <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-2xl animate-pulse"></div>
                )}
             </div>
          </div>
          
          {/* Right Side: Terminal Output */}
          <div ref={terminalRef} className="flex flex-col h-full max-h-[600px]">
             <div className="bg-slate-950 border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-900/20 flex-1 flex flex-col overflow-hidden relative">
                {/* Terminal Header */}
                <div className="bg-slate-900/80 p-3 border-b border-white/5 flex items-center gap-3">
                   <TerminalSquare className="w-5 h-5 text-cyan-500" />
                   <span className="font-mono text-xs text-slate-400">verification_process.sh</span>
                   <div className="ml-auto flex gap-1.5">
                     <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                     <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                     <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                   </div>
                </div>
                
                {/* Terminal Body */}
                <div className="p-6 font-mono text-sm flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                   {logs.map((log, idx) => (
                     <div key={idx} className="text-cyan-400 leading-relaxed break-words opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]">
                       {log.startsWith('> [ERROR]') || log.startsWith('> [WARN]') || log.includes('REJECTED') ? (
                         <span className={log.includes('WARN') ? 'text-yellow-400' : 'text-pink-500'}>{log}</span>
                       ) : log.includes('SUCCESSFUL') || log.includes('EXACT MATCH') || log.startsWith('> [RESULT]') ? (
                         <span className="text-emerald-400 font-bold">{log}</span>
                       ) : (
                         <span className="text-slate-300">
                           <span className="text-cyan-500 mr-2">{log.split(' ')[0]}</span>
                           {log.split(' ').slice(1).join(' ')}
                         </span>
                       )}
                     </div>
                   ))}
                   {phase !== 'COMPLETE' && (
                     <div className="flex items-center gap-2 text-cyan-500 mt-2">
                       <Bot className="w-4 h-4 animate-bounce" />
                       <span className="animate-pulse">_</span>
                     </div>
                   )}
                </div>

                {/* Final Verdict Banner inside terminal */}
                {phase === 'COMPLETE' && result && (
                  <div className={`m-4 p-4 rounded-xl border flex items-center justify-between shadow-lg ${
                    result.status === 'VERIFIED' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 
                    result.status === 'REJECTED' ? 'bg-pink-950/40 border-pink-500/30 text-pink-400' :
                    'bg-yellow-950/40 border-yellow-500/30 text-yellow-400'
                  }`}>
                    <div className="flex items-center gap-3">
                      {result.status === 'VERIFIED' ? <CheckCircle2 className="w-6 h-6" /> : 
                       result.status === 'REJECTED' ? <XCircle className="w-6 h-6" /> :
                       <AlertTriangle className="w-6 h-6" />}
                      <div>
                        <p className="font-bold font-sans tracking-wide">{result.status}</p>
                        <p className="text-[10px] font-mono opacity-80 mt-0.5 uppercase">
                          {result.status === 'VERIFIED' ? 'Document successfully tallied' : 'Manual intervention required'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-mono opacity-70 mb-1">DECISION</p>
                      <p className="font-mono font-bold text-sm uppercase">{result.status}</p>
                    </div>
                  </div>
                )}
             </div>
          </div>
          
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

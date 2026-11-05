import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CosmicPortalTransition({ onClose }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  // Snappy 1.3-Second Academic Transition
  useEffect(() => {
    const startTime = Date.now();
    const duration = 1300; // 1.3 seconds

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(currentProgress);

      if (elapsed >= duration) {
        clearInterval(timer);
        navigate('/pusthakalaya');
      }
    }, 30);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-2xl overflow-hidden select-none animate-fadeIn">
      
      {/* Ambient Warm Golden Aura (No Sci-Fi / Avengers Universe Warps) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-600/20 via-[#4a0000]/30 to-black pointer-events-none"></div>

      {/* Center Academic Portal Card */}
      <div className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Glowing Center 3D Book Graphic */}
        <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
          {/* Subtle Warm Amber Light Pulse */}
          <div className="absolute inset-0 m-auto w-32 h-32 rounded-full bg-gradient-to-tr from-amber-500/30 via-yellow-400/20 to-amber-600/30 blur-2xl animate-pulse"></div>
          
          {/* Thin Elegant Gold Orbit Ring */}
          <div className="absolute inset-2 border border-amber-400/30 rounded-full animate-[spin_12s_linear_infinite]"></div>

          {/* Floating Transparent 3D Book */}
          <div className="relative z-10 p-2 transform animate-float-slow">
            <img
              src="/3d-book-portal.png"
              alt="IMA පුස්තකාලය"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[0_12px_30px_rgba(251,191,36,0.6)]"
            />
          </div>
        </div>

        {/* Clean Institutional Typography */}
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-sinhala">
            IMA පුස්තකාලය විවෘත වෙමින් පවතී...
          </h2>

          <p className="text-xs sm:text-sm text-amber-200/80 font-normal">
            Accessing Past Papers & Marking Schemes Vault
          </p>

          {/* Sleek Gold Progress Bar (1.3s) */}
          <div className="w-56 sm:w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto mt-4 border border-amber-400/30 shadow-[0_0_10px_rgba(251,191,36,0.3)]">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-full transition-all duration-75 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Quick Skip Link */}
        <div className="pt-2">
          <button
            onClick={() => navigate('/pusthakalaya')}
            className="text-[11px] text-amber-300/70 hover:text-amber-300 transition-colors font-medium flex items-center gap-1 cursor-pointer font-sinhala"
          >
            <span>ක්ෂණිකව පිවිසෙන්න</span>
            <ArrowRight size={12} />
          </button>
        </div>

      </div>

    </div>
  );
}

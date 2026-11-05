import React from 'react';

const ThemeShowcase = () => {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-100 min-h-screen">
      
      {/* 1. Modern Clean SaaS (Light & Minimalist) */}
      <div className="p-8 bg-slate-50 rounded-xl flex flex-col items-center justify-center">
         <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-slate-800 font-semibold text-lg mb-2">Modern Clean SaaS</h3>
            <p className="text-slate-500 text-sm mb-6">Minimalist look. Light borders and subtle shadows. Very professional.</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-slate-900">$12,450</span>
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition">View Report</button>
            </div>
         </div>
      </div>

      {/* 2. High-Tech Dark Mode (Sleek & Gamer Vibe) */}
      <div className="p-8 bg-gray-950 rounded-xl flex flex-col items-center justify-center">
         <div className="w-full max-w-sm p-6 bg-gray-900 rounded-lg border border-gray-800">
            <h3 className="text-gray-100 font-semibold text-lg mb-2 tracking-wide">High-Tech Dark</h3>
            <p className="text-gray-400 text-sm mb-6 font-mono">Dark mode with neon accents. No shadows, just subtle borders.</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-gray-50">$12,450</span>
                <button className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 text-sm font-medium rounded-md hover:bg-cyan-500/20 transition">Execute</button>
            </div>
         </div>
      </div>

      {/* 3. Soft Enterprise (Corporate Trust) */}
      <div className="p-8 bg-gray-100 rounded-xl flex flex-col items-center justify-center border border-gray-200">
         <div className="w-full max-w-sm p-6 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-gray-700 font-bold text-lg mb-2">Soft Enterprise</h3>
            <p className="text-gray-500 text-sm mb-6">Highly rounded corners, soft shadows, and friendly, trustworthy colors.</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-gray-800">$12,450</span>
                <button className="px-5 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full hover:bg-emerald-200 transition">Manage</button>
            </div>
         </div>
      </div>

      {/* 4. Flat & Bold (Material 3 Inspired) */}
      <div className="p-8 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-zinc-100">
         <div className="w-full max-w-sm p-6 bg-white rounded-none border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(24,24,27,1)]">
            <h3 className="text-zinc-900 font-black text-lg mb-2 uppercase tracking-tight">Flat & Bold</h3>
            <p className="text-zinc-600 text-sm mb-6 font-medium">High contrast, sharp edges, and solid hard shadows.</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-black text-zinc-900">$12,450</span>
                <button className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-none border-2 border-transparent hover:border-zinc-900 transition">Action</button>
            </div>
         </div>
      </div>

    </div>
  );
};

export default ThemeShowcase;
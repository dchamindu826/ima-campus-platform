import React from 'react';

// Shown for a moment while a page's code downloads (pages load on demand).
export default function PageLoader() {
    return (
        <div className="w-full min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-9 h-9 rounded-full border-4 border-slate-500/30 border-t-indigo-500 animate-spin" />
                <span className="text-xs font-semibold tracking-wide">Loading…</span>
            </div>
        </div>
    );
}

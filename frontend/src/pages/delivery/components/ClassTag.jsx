import React from 'react';

// Theory / Paper / Both — tag comes from the API (order.classTag).
const STYLES = {
    Theory: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
    Paper: 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-500/30',
    Both: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
};
const LABELS = { Theory: 'THEORY', Paper: 'PAPER', Both: 'THEORY + PAPER' };

export const CLASS_TAGS = ['All', 'Theory', 'Paper', 'Both'];

export const matchesClassTag = (order, filter) => filter === 'All' || (order.classTag || 'Theory') === filter;

export function ClassTagBadge({ tag, small = false }) {
    const t = tag || 'Theory';
    return (
        <span className={`${small ? 'text-[10px] px-2.5 py-1 rounded-md' : 'text-[11px] px-3 py-1.5 rounded-lg'} font-black border uppercase tracking-widest shadow-sm whitespace-nowrap ${STYLES[t] || STYLES.Theory}`}>
            {LABELS[t] || t}
        </span>
    );
}

export function ClassTagFilter({ value, onChange, orders }) {
    const count = (f) => orders.filter((o) => matchesClassTag(o, f)).length;
    return (
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Class:</span>
            <div className="flex gap-1 flex-wrap">
                {CLASS_TAGS.map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => onChange(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${value === f ? 'bg-brand-accent text-white border-brand-accent shadow-sm' : 'bg-white/80 dark:bg-black/40 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10 hover:border-brand-accent'}`}
                        title={f === 'Both' ? 'Orders with both theory and paper tutes' : `${f} orders`}
                    >
                        {f === 'Both' ? 'Theory+Paper' : f} <span className="opacity-70">({count(f)})</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

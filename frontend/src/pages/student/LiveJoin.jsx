// /live/z/:key — the link coordinators share for one Zoom meeting (same link for every batch
// that uses that Zoom link). /live/:id — older per-class link.
// Not logged in → login first, then back here. Paid → Join Now. Not paid → the reason.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Play, Lock, CalendarDays, Clock, Video, AlertTriangle } from 'lucide-react';
import api, { withAuthToken } from '../../api/axios';

export const AFTER_LOGIN_KEY = 'ima-after-login';

const hasToken = () => !!(localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('admin_token'));

export default function LiveJoin() {
    const { id, key } = useParams();
    const here = key ? `/live/z/${key}` : `/live/${id}`;
    const apiPath = key ? `/v2/live/z/${key}` : `/v2/live/${id}`;
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true });

    useEffect(() => {
        const goLogin = () => {
            try { sessionStorage.setItem(AFTER_LOGIN_KEY, here); } catch (e) {}
            navigate('/login', { replace: true });
        };
        if (!hasToken()) return goLogin();
        try { sessionStorage.setItem(AFTER_LOGIN_KEY, here); } catch (e) {}
        api.get(apiPath)
            .then((r) => {
                try { sessionStorage.removeItem(AFTER_LOGIN_KEY); } catch (e) {}
                setState({ loading: false, live: r.data });
            })
            .catch((err) => {
                const status = err.response?.status;
                if (status === 401) return goLogin();
                setState({ loading: false, error: err.response?.data?.message || 'Could not load this live class. Please try again.' });
            });
    }, [here, apiPath, navigate]);

    const shell = (children) => (
        <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-white/[0.04] backdrop-blur-xl p-6 md:p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <img src="/logo.png" alt="IMA Campus" className="h-12 mx-auto mb-5 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                {children}
            </div>
        </div>
    );

    if (state.loading) return shell(<Loader2 className="animate-spin text-red-500 mx-auto" size={36} />);

    if (state.error) return shell(<>
        <AlertTriangle className="text-amber-400 mx-auto mb-3" size={32} />
        <p className="text-white/90 font-bold mb-5">{state.error}</p>
        <Link to="/student/dashboard" className="text-sm text-white/70 underline">Go to my dashboard</Link>
    </>);

    const live = state.live;
    const when = live.date ? new Date(live.date).toDateString() : null;

    return shell(<>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 border bg-red-500/15 border-red-500/30">
            <Video size={12} className="text-red-400" />
            <span className="font-bold uppercase tracking-widest text-[10px] text-red-300">Live Class</span>
        </div>
        <h1 className="text-xl md:text-2xl font-black text-white leading-snug break-words">{live.title}</h1>
        {live.courseName && <p className="text-white/70 text-sm mt-1">{live.courseName}</p>}
        {live.batchName && <p className="text-white/50 text-xs mt-0.5">{live.batchName}</p>}

        {(when || live.startTime) && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
                {when && <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-white/15 text-white/80 text-xs font-bold"><CalendarDays size={12} className="text-blue-400" />{when}</span>}
                {live.startTime && <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-white/15 text-white/80 text-xs font-bold"><Clock size={12} className="text-yellow-400" />{live.startTime}{live.endTime ? ` - ${live.endTime}` : ''}</span>}
            </div>
        )}

        <div className="mt-6">
            {!live.access?.allowed ? (
                <>
                    <div className="flex items-start gap-2 text-left bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-4">
                        <Lock size={16} className="text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-rose-100 text-sm leading-relaxed">{live.access?.message || 'You do not have access to this class.'}</p>
                    </div>
                    <Link to="/student/dashboard" state={{ activeTab: 'courses' }} className="block w-full h-12 leading-[3rem] rounded-xl font-black uppercase tracking-widest text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20">Pay / Enroll</Link>
                </>
            ) : live.hasLink ? (
                <a href={withAuthToken(`${api.defaults.baseURL}${live.joinPath}`)} target="_blank" rel="noopener noreferrer"
                   className="w-full h-14 rounded-xl font-black flex items-center justify-center gap-2 uppercase tracking-widest text-sm bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                    <Play size={16} className="fill-white" /> Join Now
                </a>
            ) : (
                <div className="w-full h-12 rounded-xl font-black flex items-center justify-center gap-2 uppercase tracking-widest text-xs bg-black/30 text-white/70 border border-white/20">
                    <Lock size={14} /> Link Pending — refresh near class time
                </div>
            )}
        </div>
        <Link to="/student/dashboard" className="inline-block mt-4 text-xs text-white/60 hover:text-white underline">Go to my dashboard</Link>
    </>);
}

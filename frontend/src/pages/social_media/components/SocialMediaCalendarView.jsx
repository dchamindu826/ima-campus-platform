import React, { useState, useEffect } from 'react';
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Trash2, 
    Clock, 
    ExternalLink, 
    Sparkles, 
    Image as ImageIcon, 
    Film, 
    Tag, 
    CheckCircle2, 
    Loader2,
    Layers,
    ChevronLeft,
    ChevronRight,
    Search
} from 'lucide-react';
import axios from '../../../api/axios';
import toast from 'react-hot-toast';
import SocialMediaCalendarModal from './SocialMediaCalendarModal';

export default function SocialMediaCalendarView({ loggedInUser }) {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const getBackendBase = () => {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        if (protocol === 'https:') return `https://${host}`;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
        return `http://${host}:5000`;
    };

    const fetchCalendarPosts = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            const res = await axios.get('/social-media/calendar', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching calendar posts:", err);
            toast.error("Failed to load calendar events");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendarPosts();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this scheduled post?")) return;
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('userToken');
            await axios.delete(`/social-media/calendar/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Post removed from calendar");
            fetchCalendarPosts();
        } catch (err) {
            toast.error("Failed to delete post");
        }
    };

    const filteredPosts = posts.filter(p => 
        (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const upcomingPosts = filteredPosts.filter(p => new Date(p.scheduledDate) >= new Date(new Date().setHours(0,0,0,0)));
    const pastPosts = filteredPosts.filter(p => new Date(p.scheduledDate) < new Date(new Date().setHours(0,0,0,0)));

    return (
        <div className="space-y-6 text-left animate-fade-in pb-12">
            
            {/* Header Area */}
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <CalendarIcon className="text-emerald-400" size={26} /> Content Calendar
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Schedule and track upcoming promotional artwork, video releases, and organic campaigns.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input 
                            type="text"
                            placeholder="Search scheduled posts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                        <Plus size={16} /> Schedule Post
                    </button>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Scheduled</span>
                        <p className="text-3xl font-black text-white">{posts.length}</p>
                    </div>
                    <div className="bg-blue-500/15 text-blue-400 p-3 rounded-2xl border border-blue-500/30">
                        <Layers size={20} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Upcoming Releases</span>
                        <p className="text-3xl font-black text-emerald-300">{upcomingPosts.length}</p>
                    </div>
                    <div className="bg-emerald-500/15 text-emerald-400 p-3 rounded-2xl border border-emerald-500/30">
                        <Clock size={20} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Past Published</span>
                        <p className="text-3xl font-black text-slate-300">{pastPosts.length}</p>
                    </div>
                    <div className="bg-white/10 text-slate-300 p-3 rounded-2xl border border-white/15">
                        <CheckCircle2 size={20} />
                    </div>
                </div>
            </div>

            {/* Posts Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-56 bg-slate-900/40 rounded-3xl border border-white/10 animate-pulse backdrop-blur-xl"></div>
                    ))}
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="bg-slate-900/40 rounded-3xl border border-white/10 p-12 text-center flex flex-col items-center justify-center min-h-[300px] backdrop-blur-xl">
                    <CalendarIcon size={40} className="text-slate-600 mb-3" />
                    <h3 className="text-base font-bold text-white mb-1">No Scheduled Posts Found</h3>
                    <p className="text-slate-400 text-xs max-w-sm mb-4">
                        Plan ahead by scheduling marketing banners, reels, and video drops for the week.
                    </p>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center gap-2"
                    >
                        <Plus size={15} /> Add First Event
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {upcomingPosts.length > 0 && (
                        <div>
                            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Clock size={14} /> Upcoming Publishing Schedule ({upcomingPosts.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {upcomingPosts.map(post => (
                                    <PostCard 
                                        key={post.id} 
                                        post={post} 
                                        onDelete={handleDelete} 
                                        getBackendBase={getBackendBase} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {pastPosts.length > 0 && (
                        <div>
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckCircle2 size={14} /> Past Published Schedule ({pastPosts.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {pastPosts.map(post => (
                                    <PostCard 
                                        key={post.id} 
                                        post={post} 
                                        onDelete={handleDelete} 
                                        getBackendBase={getBackendBase} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            <SocialMediaCalendarModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchCalendarPosts}
            />
        </div>
    );
}

function PostCard({ post, onDelete, getBackendBase }) {
    const isPast = new Date(post.scheduledDate) < new Date(new Date().setHours(0,0,0,0));

    return (
        <div className={`bg-slate-900/60 hover:bg-slate-850 p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between group shadow-xl backdrop-blur-xl hover:-translate-y-1 ${
            isPast ? 'border-white/5 opacity-75' : 'border-white/10 hover:border-emerald-500/40'
        }`}>
            <div>
                {/* Image preview if exists */}
                {post.imageUrl && (
                    <div className="w-full h-36 rounded-2xl overflow-hidden mb-3 bg-black/40 border border-white/10 relative">
                        <img 
                            src={post.imageUrl.startsWith('http') ? post.imageUrl : `${getBackendBase()}${post.imageUrl}`} 
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 flex items-center gap-1">
                        <CalendarIcon size={11} />
                        {new Date(post.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    <button 
                        onClick={() => onDelete(post.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-xl hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete from calendar"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>

                <h3 className="text-sm font-bold text-white mb-1 line-clamp-1 group-hover:text-emerald-300 transition-colors">
                    {post.title}
                </h3>

                {post.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                        {post.description}
                    </p>
                )}
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono text-[10px] text-slate-500">#{post.id}</span>
                <span className={`font-bold ${isPast ? 'text-slate-500' : 'text-emerald-400'}`}>
                    {isPast ? 'Completed' : 'Scheduled'}
                </span>
            </div>
        </div>
    );
}

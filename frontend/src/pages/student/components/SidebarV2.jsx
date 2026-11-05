import React from 'react';
import { LayoutDashboard, BookOpen, Wallet, Video, Settings, LogOut, X, Truck, Sparkles } from 'lucide-react';

const SidebarV2 = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, handleLogout, bgImage, setBgImage }) => {

    const menuItems = [
        { id: 'home', label: 'Overview', icon: LayoutDashboard },
        { id: 'courses', label: 'Explore Courses', icon: BookOpen },
        { id: 'mycourses', label: 'My Classroom', icon: Video },
        { id: 'delivery', label: 'Delivery Hub', icon: Truck },
        { id: 'history', label: 'Payments', icon: Wallet },
        { id: 'profile', label: 'Settings', icon: Settings },
    ];

    const wallpapers = [
        { id: 'default', url: '/student-bg.jpg', label: 'Default' },
        { id: 'crimson', url: '/bg2.jpg', label: 'Crimson' },
        { id: 'midnight', url: '/bg3.jpg', label: 'Midnight' }
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
                onClick={() => setSidebarOpen(false)}
            ></div>

            {/* Sidebar Container - Clean frosted glass */}
            <aside className={`fixed lg:static top-0 left-0 h-full lg:h-[calc(100vh-40px)] lg:my-[20px] lg:ml-[20px] w-72 lg:w-[280px] bg-black/30 backdrop-blur-2xl lg:rounded-3xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col z-50 transition-transform duration-500 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                
                {/* Logo Area */}
                <div className="pt-8 pb-5 px-6 flex flex-col items-center justify-center relative shrink-0">
                    <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg mb-2.5">
                        <img src="/logo.png" alt="Logo" className="w-22 h-auto object-contain" />
                    </div>
                    <span className="text-[11px] font-bold text-white/80 tracking-widest uppercase">Student Portal</span>
                    
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute top-5 right-5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 overflow-y-auto py-3 px-4 space-y-1.5 custom-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 cursor-pointer ${
                                    isActive 
                                    ? 'bg-white text-gray-900 shadow-[0_4px_20px_rgba(255,255,255,0.35)] scale-[1.02]' 
                                    : 'text-white/85 hover:text-white hover:bg-white/10 hover:translate-x-1'
                                }`}
                            >
                                <item.icon 
                                    size={20} 
                                    strokeWidth={isActive ? 2.5 : 2} 
                                    className={isActive ? 'text-blue-600' : 'text-white/70'} 
                                />
                                <span className="text-sm tracking-wide">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Footer / Controls */}
                <div className="p-4 sm:p-5 shrink-0 mt-auto space-y-3">
                    {/* Wallpaper / Atmosphere Switcher */}
                    <div className="p-3 rounded-2xl bg-black/35 backdrop-blur-xl border border-white/15 shadow-sm">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={12} className="text-amber-400" /> Wallpaper
                            </span>
                            <span className="text-[10px] text-white/50 font-medium">3 Vibes</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {wallpapers.map((w) => {
                                const isSelected = bgImage?.includes(w.url) || bgImage === w.url;
                                return (
                                    <button
                                        key={w.id}
                                        type="button"
                                        onClick={() => setBgImage && setBgImage(w.url)}
                                        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                                            isSelected
                                                ? 'bg-white/20 border-white shadow-[0_0_12px_rgba(255,255,255,0.4)] scale-105'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 opacity-75 hover:opacity-100'
                                        }`}
                                    >
                                        <div 
                                            className={`w-7 h-7 rounded-full border-2 bg-cover bg-center transition-transform ${
                                                isSelected ? 'border-white shadow-sm' : 'border-white/40'
                                            }`}
                                            style={{ backgroundImage: `url(${w.url})` }}
                                        />
                                        <span className={`text-[10px] font-bold tracking-tight ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                            {w.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl font-semibold text-white hover:text-white bg-red-500/80 hover:bg-red-600 backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-red-500/50 cursor-pointer text-sm"
                    >
                        <LogOut size={18} strokeWidth={2.5} /> 
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default SidebarV2;

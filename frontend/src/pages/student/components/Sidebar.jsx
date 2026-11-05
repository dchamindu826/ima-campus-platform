import React from 'react';
import { LayoutDashboard, BookOpen, Wallet, Video, Settings, LogOut, X, Truck, Image as ImageIcon } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, handleLogout, bgImage, setBgImage }) => {

    const menuItems = [
        { id: 'home', label: 'Dashboard Overview', icon: LayoutDashboard },
        { id: 'courses', label: 'Enroll in Courses', icon: BookOpen },
        { id: 'mycourses', label: 'My Classrooms', icon: Video },
        { id: 'delivery', label: 'Delivery Hub', icon: Truck },
        { id: 'history', label: 'Payment History', icon: Wallet },
        { id: 'profile', label: 'Profile Settings', icon: Settings },
    ];

    const themes = ['/student-bg.jpg', '/bg2.jpg', '/bg3.jpg'];

    return (
        <>
            {/* Mobile Overlay (Animation removed) */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
            )}

            {/* Sidebar (Animations and transforms removed, simple show/hide applied) */}
            <aside className={`fixed lg:static top-0 left-0 h-full w-72 bg-black/20 border-r border-white/10 flex-col z-50 ${sidebarOpen ? 'flex' : 'hidden lg:flex'}`}>
                
                {/* Logo Section */}
                <div className="h-24 flex items-center justify-center px-8 border-b border-white/10 relative shrink-0">
                    <img src="/logo.png" alt="Logo" className="w-32 h-auto object-contain drop-shadow-2xl" />
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute right-4 text-white/70 bg-white/10 p-2 rounded-xl">
                        <X size={20} />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-8 px-5 space-y-2 custom-scrollbar">
                    <p className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-4 px-3">Main Menu</p>
                    
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            // transition-colors pamanak damma (akuru adenne nathi wenna)
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-colors duration-200 ${
                                activeTab === item.id 
                                ? 'bg-gradient-to-r from-red-600/20 to-red-800/20 text-white border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                                : 'text-white/70 hover:bg-black/20 hover:text-white border border-transparent'
                            }`}
                        >
                            <item.icon size={22} className={activeTab === item.id ? 'text-red-500' : 'text-white/80'} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-6 border-t border-white/10 shrink-0">
                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                            <ImageIcon size={12}/> Wallpaper
                        </p>
                        <div className="flex justify-center gap-2">
                            {themes.map((theme, i) => (
                                <button
                                    key={i}
                                    onClick={() => setBgImage(theme)} 
                                    className={`w-6 h-6 rounded-full border-2 bg-cover bg-center transition-all ${bgImage === theme ? 'border-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-white/20 hover:border-white/50'}`}
                                    style={{ backgroundImage: `url(${theme})` }}
                                ></button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl font-bold text-white/70 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30">
                        <LogOut size={20} strokeWidth={2.5} /> Logout
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
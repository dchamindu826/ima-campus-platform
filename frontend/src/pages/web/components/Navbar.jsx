import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ loggedInUser }) {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if we are on the home page
  const isHome = location.pathname === '/';

  return (
    <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled || !isHome ? 'bg-[#0a0f1c]/90 backdrop-blur-xl shadow-lg border-b border-white/10 py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 flex justify-between items-center">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-white/10 backdrop-blur-sm p-2.5 rounded-2xl border border-white/20 group-hover:bg-white/20 transition-all">
            <img src="/logo.png" alt="IMA Logo" className="h-8 md:h-10 object-contain" />
          </div>
          <div className="hidden sm:block leading-none">
            <span className="text-xl md:text-2xl font-black tracking-tight text-white">IMA <span className="text-red-500">CAMPUS</span></span>
          </div>
        </Link>

        {/* Center Links */}
        <ul className="hidden xl:flex items-center gap-8 font-bold text-sm text-white/70">
            <li><Link to="/" className="hover:text-red-400 transition-colors">Home</Link></li>
            <li><Link to="/#institutes" className="hover:text-red-400 transition-colors">Institutes</Link></li>
            <li><Link to="/about-us" className="hover:text-red-400 transition-colors">About Us</Link></li>
            <li><Link to="/contact-us" className="hover:text-red-400 transition-colors">Contact</Link></li>
        </ul>

        {/* Right Actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            {loggedInUser ? (
              <Link to={loggedInUser.role === 'user' ? '/student/dashboard' : '/admin/dashboard'} 
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] border border-red-500 hover:scale-105">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block text-white/80 hover:text-white font-bold text-sm px-4 py-2.5 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] border border-red-500 hover:scale-105">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
}
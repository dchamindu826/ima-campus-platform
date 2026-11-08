import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { Loader2, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login({ setLoggedInUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleUsernameChange = (e) => {
    // Only allow numbers and the + sign (no spaces, no letters)
    let val = e.target.value.replace(/[^0-9+]/g, '');
    // Allow any length for international numbers
    setUsername(val);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { phone: username, password });
      
      if (res.data.token && res.data.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        
        setLoggedInUser(res.data.user);
        toast.success(`Welcome back, ${res.data.user.firstName}!`);
        
        // Came from a live-class link (/live/<id>)? Go back there.
        let afterLogin = null;
        try { afterLogin = sessionStorage.getItem('ima-after-login'); } catch (e) {}  // the live page clears it once it opens
        if (afterLogin && /^\/live\/(\d+|z\/[0-9a-z]+)$/.test(afterLogin)) {
            navigate(afterLogin);
            return;
        }

        // Role-based Redirect
        const role = res.data.user.role?.toUpperCase(); // එන role එක Capital කරගන්නවා
        
        if(role === 'USER' || role === 'STUDENT') {
            navigate('/student/dashboard');
        } else if (role === 'MANAGER' || role === 'ASS MANAGER') {
            navigate('/manager/dashboard'); 
        } else if (role === 'COORDINATOR') {
            navigate('/coordinator/dashboard');
        } else if (role === 'FINANCE') {
            navigate('/admin/finance'); 
        } else {
            navigate('/admin/dashboard'); // වෙන මුකුත් නැත්නම් Admin එකට
        }
      }
    } catch (error) {
      toast.error('ඔබගේ මුරපදය හෝ දුරකථන අංකය වැරදියි.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 font-sans overflow-hidden">
      
      {/* 🚀 Background Image & Frosted Glass Overlay 🚀 */}
      <div className="absolute inset-0 z-0">
          <img src="/mainglass.jpg" alt="Background" className="w-full h-full object-cover scale-105" />
          {/* මෙතනින් තමයි මුළු background එකම ලස්සනට Blur කරන්නේ */}
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl"></div> 
      </div>

      {/* 🚀 Darker Glass Card for perfect readability 🚀 */}
      <div className="relative z-10 w-full max-w-[420px] bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-[0_25px_50px_rgba(0,0,0,0.5)] transform transition-all animate-fade-in">
        
        <div className="text-center mb-10">
          <img src="/logo.png" alt="IMA Campus Logo" className="h-25 mx-auto mb-4 drop-shadow-2xl object-contain" />
          <h2 className="text-2xl font-black text-white tracking-wide">Welcome Back</h2>
          <p className="text-white/60 text-xs mt-2 font-medium">Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 block">Phone Number</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={18} className="text-white/40 group-focus-within:text-white transition-colors" />
              </div>
              <input type="tel" required value={username} onChange={handleUsernameChange}
                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner"
                placeholder="Enter your username"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 block">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-white/40 group-focus-within:text-white transition-colors" />
              </div>
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-white placeholder-white/30 focus:border-red-500 focus:bg-black/60 outline-none transition-all text-sm shadow-inner"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white focus:outline-none transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-70 flex items-center justify-center gap-2 mt-8 text-sm uppercase tracking-widest hover:scale-[1.02]"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Login Securely <ArrowRight size={18}/></>}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-white/50 font-medium">
            Don't have a student account? <Link to="/register" className="text-red-400 font-bold hover:text-red-300 hover:underline transition-colors ml-1">Register Here</Link>
        </div>
      </div>
    </div>
  );
}
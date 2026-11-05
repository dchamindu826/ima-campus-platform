import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../src/api/axios';

// 1. Social Media icons ටික react-icons වලින් ගමු
import { FaFacebook, FaYoutube } from 'react-icons/fa';

// 2. අනිත් UI icons ටික lucide-react එකෙන්ම තියාගමු
import { 
  MessageCircle, ChevronRight, ChevronLeft, 
  BookOpen, Users, Award, Briefcase, Globe, GraduationCap, ArrowRight, Loader2, Search, 
  Phone, Mail, MapPin, Zap, CheckCircle2, Building2, PlayCircle 
} from 'lucide-react';

const heroImages = [
  '/hero1.jpg', 
  '/hero2.jpg', 
  '/hero3.jpg', 
];

export default function IMACampusLandingPage({ loggedInUser }) {
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  
  // Backend Data States
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto Slide & Scroll Effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const slideTimer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(slideTimer);
    };
  }, []);

  // Fetch Businesses Data from Backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/public/landing-data');
        setBusinesses(res.data?.businesses || []);
      } catch (error) {
        console.error("Failed to fetch landing data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getImageUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `${api.defaults.baseURL.replace('/api','')}/storage/icons/${imageName}`;

  // Role එක අනුව Dashboard ලින්ක් එක හදන Function එක
  const getDashboardLink = () => {
    if (!loggedInUser) return '/login';
    const role = loggedInUser.role?.toUpperCase();
    
    if (role === 'STUDENT' || role === 'USER') return '/student/dashboard';
    if (role === 'MANAGER' || role === 'ASS MANAGER') return '/manager/dashboard';
    if (role === 'COORDINATOR') return '/coordinator/dashboard';
    if (role === 'FINANCE') return '/admin/finance';
    
    return '/admin/dashboard';
  };

  return (
    <div className="bg-[#0a0f1c] text-white font-sans overflow-hidden relative">
      
      {/* --- Header (Nav Bar) --- */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'top-0 bg-[#0a0f1c]/90 backdrop-blur-xl shadow-lg border-b border-white/10 py-3' : 'top-0 bg-transparent py-5'}`}>
        <nav className="max-w-screen-2xl mx-auto px-6 md:px-12 flex items-center justify-between">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-white/10 backdrop-blur-sm p-2.5 rounded-2xl border border-white/20 group-hover:bg-white/20 transition-all">
              <img src="/logo.png" alt="IMA Logo" className="h-8 md:h-10 object-contain" />
            </div>
            <div className="hidden sm:block leading-none">
              <span className="text-xl md:text-2xl font-black tracking-tight text-white">IMA <span className="text-red-500">CAMPUS</span></span>
            </div>
          </Link>

          <ul className="hidden xl:flex items-center gap-8 font-bold text-sm text-white/70">
            {['Home', 'Institutes', 'About Us', 'Contact'].map(link => (
              <li key={link}><a href={`#${link.toLowerCase().replace(' ', '-')}`} className="hover:text-red-400 transition-colors">{link}</a></li>
            ))}
          </ul>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden lg:flex items-center gap-4 pr-6 border-r border-white/20">
              <a href="#" className="text-white/60 hover:text-[#1877F2] transition-colors"><FaFacebook size={18}/></a>
              <a href="#" className="text-white/60 hover:text-[#FF0000] transition-colors"><FaYoutube size={18}/></a>
              <a href="#" className="text-white/60 hover:text-[#25D366] transition-colors"><MessageCircle size={18}/></a>
            </div>

            <div className="flex items-center gap-3">
              {loggedInUser ? (
                  <Link to={getDashboardLink()} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] border border-red-500 hover:scale-105">
                    Dashboard
                  </Link>
              ) : (
                  <>
                    <Link to="/login" className="hidden sm:block text-white/80 hover:text-white font-bold text-sm px-4 py-2.5 transition-colors">Login</Link>
                    <Link to="/register" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] border border-red-500 hover:scale-105">
                      Register
                    </Link>
                  </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* --- Hero Section --- */}
      <section className="relative h-[85vh] lg:h-[95vh] w-full overflow-hidden bg-[#0a0f1c]" id="home">
        {/* Dynamic Dark & Red Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-red-600/20 blur-[150px]"></div>
            <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-orange-500/10 blur-[120px]"></div>
        </div>

        {heroImages.map((image, index) => (
          <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentHeroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1c]/95 via-[#0a0f1c]/70 to-transparent z-10"></div>
            <img src={image} alt={`Hero slide ${index + 1}`} className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-[10000ms]" style={{ transform: index === currentHeroIndex ? 'scale(1)' : 'scale(1.05)' }} />
            
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-start max-w-screen-2xl mx-auto px-6 lg:px-12 pt-20">
              <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8 backdrop-blur-sm animate-fade-in-down flex items-center gap-2">
                <Zap size={14} className="fill-red-500 animate-pulse"/> Sri Lanka's #1 Premium Campus
              </span>
              
              <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-black text-white leading-[1.1] mb-6 tracking-tight">
                Discover the <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">New Universe</span> <br/>
                of Education.
              </h1>
              
              <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl font-medium leading-relaxed">
                Empowering students with modern learning techniques, expert educators, and a vibrant learning community. <strong className="text-white">Your journey to success starts right here.</strong>
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <Link to="/login" className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(239,68,68,0.4)] border border-red-500/50 uppercase tracking-wide text-sm">
                    Start Learning Now <ArrowRight size={18} />
                  </Link>
                  <a href="#institutes" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-sm px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-sm uppercase tracking-wide">
                    <PlayCircle size={20} className="text-red-400" /> View Institutes
                  </a>
              </div>
            </div>
          </div>
        ))}
        
        {/* Slide Indicators */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {heroImages.map((_, index) => (
            <button key={index} onClick={() => setCurrentHeroIndex(index)} className={`h-2 rounded-full transition-all duration-500 ${index === currentHeroIndex ? 'w-12 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'w-3 bg-white/20 hover:bg-white/40'}`}></button>
          ))}
        </div>
      </section>

      {/* --- Floating Feature Cards --- */}
      <section className="relative z-30 -mt-16 lg:-mt-20 px-6 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={<BookOpen size={32}/>} title="Flexi-Learning" desc="Learn at your own pace with hybrid classes." />
          <FeatureCard icon={<Users size={32}/>} title="Expert Instructors" desc="Island's top ranking lecturers." />
          <FeatureCard icon={<Briefcase size={32}/>} title="Career Support" desc="Guiding you towards professional success." />
          <FeatureCard icon={<Award size={32}/>} title="Certified System" desc="Globally recognized learning materials." />
        </div>
      </section>

      {/* 🔴 INSTITUTES (BUSINESSES) SECTION 🔴 */}
      <section className="py-24 px-6 relative" id="institutes">
        {/* Background Decorative Glow */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-red-600/5 blur-[150px] rounded-full pointer-events-none z-0"></div>

        <div className="max-w-screen-2xl mx-auto relative z-10">
          
          <div className="text-center mb-16">
            <span className="text-red-500 font-extrabold tracking-widest uppercase text-xs mb-3 block">Our Ecosystem</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Explore Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">Institutes</span></h2>
            <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto">
              Choose from our specialized institutes designed to provide focused, high-quality education tailored for your specific academic goals.
            </p>
          </div>

          {loading ? (
             <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-red-500" size={50}/></div>
          ) : businesses.length === 0 ? (
             <div className="text-center py-20 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col items-center">
                 <Building2 size={48} className="text-white/20 mb-4" />
                 <p className="text-white/50 font-bold text-lg">No institutes available at the moment.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {businesses.map(biz => (
                <div key={biz.id} className="group bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/10 hover:border-red-500/40 hover:bg-white/10 transition-all duration-500 flex flex-col relative overflow-hidden">

                    {/* Corner Accent Glow on Hover */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-[40px] group-hover:bg-red-600/40 transition-colors duration-500 pointer-events-none"></div>

                    {/* Header: Logo & Category */}
                    <div className="flex justify-between items-start mb-8 relative z-10 gap-4">
                      <div className="w-20 h-20 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center p-3 group-hover:border-red-500/30 transition-colors shadow-inner shrink-0">
                        <img src={getImageUrl(biz.logo)} alt={biz.name} className="max-h-full max-w-full object-contain drop-shadow-md" />
                      </div>
                      
                      {/* Category Badge */}
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-right">
                        {biz.category || 'Education'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex-1 flex flex-col">
                        <h3 className="text-2xl font-black text-white mb-3 leading-tight group-hover:text-red-400 transition-colors">{biz.name}</h3>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 flex-1 line-clamp-4">
                            {biz.description || "Join our premier institute to experience world-class education, expert mentoring, and an environment crafted for your absolute success."}
                        </p>
                    </div>

                    {/* Actions (Redirects to Login) */}
                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center gap-3 w-full relative z-10">
                        <button onClick={() => navigate('/login')} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl text-center transition-all border border-white/10 hover:border-white/30 text-sm">
                            View Details
                        </button>
                        <button onClick={() => navigate('/login')} className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3.5 rounded-xl text-center transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] text-sm flex justify-center items-center gap-2 group/btn">
                            Register <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-black/40 backdrop-blur-xl text-slate-400 py-16 px-6 border-t border-white/10 relative z-10" id="contact">
        <div className="max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="IMA Logo" className="h-10" />
              <span className="text-2xl font-black text-white tracking-tight">IMA Campus</span>
            </div>
            <p className="max-w-md leading-relaxed text-white/50">
              Empowering globally ready graduates through innovative education, expert mentorship, and a vibrant student community.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-wider mb-2">Quick Links</h4>
            <ul className="space-y-3 font-medium">
              <li><a href="#home" className="hover:text-red-400 transition">Home</a></li>
              <li><a href="#institutes" className="hover:text-red-400 transition">Our Institutes</a></li>
              <li><Link to="/login" className="hover:text-red-400 transition">Student Login</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-black text-white uppercase tracking-wider mb-2">Contact Info</h4>
            <ul className="space-y-3 font-medium">
              <li className="flex items-start gap-3">
                <MapPin size={16} className="text-red-500 mt-0.5 shrink-0"/> 
                <span>No. 346/A, Robert Gunawardane Mawatha, Malabe</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={16} className="text-red-500 mt-0.5 shrink-0"/> 
                <a href="mailto:info@imacampus.online" className="hover:text-red-400 transition-colors">info@imacampus.online</a>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={16} className="text-red-500 mt-0.5 shrink-0"/> 
                <div className="flex flex-col gap-0.5">
                  <a href="tel:0712209030" className="hover:text-red-400 transition-colors">071 220 90 30 (Fast Track)</a>
                  <Link to="/contact-us" className="text-xs text-red-400 hover:underline">View all stream numbers →</Link>
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white/40">
           <p>© {new Date().getFullYear()} IMA Campus. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// --- Helper Components ---
function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 flex flex-col items-center text-center group hover:-translate-y-2 hover:bg-white/10 transition-all duration-300 shadow-xl">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
        {icon}
      </div>
      <h3 className="text-xl font-black text-white mb-3">{title}</h3>
      <p className="text-white/50 text-sm font-medium leading-relaxed">{desc}</p>
    </div>
  );
}
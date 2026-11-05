import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import { FaFacebook, FaYoutube } from 'react-icons/fa';
import { 
  MessageCircle, ChevronRight, BookOpen, Users, Award, Briefcase, Globe, GraduationCap, 
  ArrowRight, Loader2, Phone, Mail, MapPin, Zap, CheckCircle2, Building2, PlayCircle, X, Layers
} from 'lucide-react';

const heroImages = ['/hero1.jpg', '/hero2.jpg', '/hero3.jpg'];

export default function IMACampusLandingPage({ loggedInUser }) {
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBiz, setSelectedBiz] = useState(null);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔥 FIX: Check if your backend has this route open. It loads businesses + batches. 🔥
        const res = await api.get('/public/landing-data'); 
        setBusinesses(res.data?.businesses || []);
      } catch (error) {
        console.error("Failed to fetch landing data", error);
        // Fallback incase public route is not setup but student route is.
        try{
            const res2 = await api.get('/student/available-enrollments');
            setBusinesses(res2.data?.businesses || []);
        }catch(e){}
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 🔥 FIX: Meka thama Logo eka hadana hari URL eka 🔥
  const getImageUrl = (imageName) => {
      if (!imageName || imageName === 'default.png' || imageName === 'null') return '/logo.png';
      return `https://imacampus.online/storage/icons/${imageName}`;
  };

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
      
      {/* Header */}
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
            <li><Link to="/" className="hover:text-red-400 transition-colors">Home</Link></li>
            <li><a href="#institutes" className="hover:text-red-400 transition-colors">Institutes</a></li>
            <li><Link to="/about-us" className="hover:text-red-400 transition-colors">About Us</Link></li>
            <li><Link to="/contact-us" className="hover:text-red-400 transition-colors">Contact</Link></li>
          </ul>

          <div className="flex items-center gap-4 md:gap-6">
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

      {/* Hero Section */}
      <section className="relative h-[85vh] lg:h-[95vh] w-full overflow-hidden bg-[#0a0f1c]" id="home">
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
      </section>

      {/* Floating Features */}
      <section className="relative z-30 -mt-16 lg:-mt-20 px-6 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={<BookOpen size={32}/>} title="Flexi-Learning" desc="Learn at your own pace with hybrid classes." />
          <FeatureCard icon={<Users size={32}/>} title="Expert Instructors" desc="Island's top ranking lecturers." />
          <FeatureCard icon={<Briefcase size={32}/>} title="Career Support" desc="Guiding you towards professional success." />
          <FeatureCard icon={<Award size={32}/>} title="Certified System" desc="Globally recognized learning materials." />
        </div>
      </section>

      {/* INSTITUTES SECTION */}
      <section className="py-24 px-6 relative" id="institutes">
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
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-[40px] group-hover:bg-red-600/40 transition-colors duration-500 pointer-events-none"></div>

                    <div className="flex justify-between items-start mb-8 relative z-10 gap-4">
                      <div className="w-20 h-20 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center p-3 group-hover:border-red-500/30 transition-colors shadow-inner shrink-0">
                        {/* 🔥 FIX: Render dynamic image properly 🔥 */}
                        <img src={getImageUrl(biz.logo)} alt={biz.name} className="max-h-full max-w-full object-contain drop-shadow-md" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-right">
                        {biz.category || 'Education'}
                      </span>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col">
                        <h3 className="text-2xl font-black text-white mb-3 leading-tight group-hover:text-red-400 transition-colors">{biz.name}</h3>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 flex-1 line-clamp-4">
                            {biz.description || "Join our premier institute to experience world-class education."}
                        </p>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center gap-3 w-full relative z-10">
                        <button onClick={() => setSelectedBiz(biz)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl text-center transition-all border border-white/10 hover:border-white/30 text-sm">
                            View Batches
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

      {/* Footer */}
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
              <li><Link to="/about-us" className="hover:text-red-400 transition">About Us</Link></li>
              <li><Link to="/contact-us" className="hover:text-red-400 transition">Contact Us</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-red-400 transition">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-red-400 transition">Terms & Conditions</Link></li>
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
        <div className="max-w-screen-2xl mx-auto border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white/40 text-xs">
           <p>© {new Date().getFullYear()} IMA Campus. Operated by <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> & <strong>IMA FAST TRACK (PVT) LTD</strong>. All Rights Reserved.</p>
           <p>No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka</p>
        </div>
      </footer>

      {/* Batches Popup Modal */}
      {selectedBiz && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#0a0f1c] border border-white/10 rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
                
                {/* Modal Header */}
                <div className="p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-white/5 relative">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 blur-[50px] pointer-events-none rounded-full"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-16 h-16 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center p-2">
                            <img src={getImageUrl(selectedBiz.logo)} alt={selectedBiz.name} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">{selectedBiz.name}</h2>
                            <p className="text-red-400 text-xs font-bold uppercase tracking-widest mt-1">Available Batches</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedBiz(null)} className="text-white/50 hover:text-white bg-black/40 hover:bg-red-500/20 p-2.5 rounded-xl transition-colors border border-white/10 hover:border-red-500/30 relative z-10">
                        <X size={24}/>
                    </button>
                </div>

                {/* Modal Body (Batches List) */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                    {(!selectedBiz.batches || selectedBiz.batches.length === 0) ? (
                        <div className="text-center py-12">
                            <Layers size={48} className="mx-auto text-white/20 mb-4"/>
                            <p className="text-white/50 font-bold">No batches available for this institute yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {selectedBiz.batches.map(batch => (
                                <div key={batch.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors flex flex-col justify-between group">
                                    <div>
                                        <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors mb-2">{batch.name}</h3>
                                        {batch.description && <p className="text-xs text-white/50 font-medium mb-4 line-clamp-2">{batch.description}</p>}
                                    </div>
                                    <button onClick={() => navigate('/login')} className="w-full mt-auto bg-black/40 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors border border-white/10 hover:border-red-500">
                                        Enroll Now
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

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
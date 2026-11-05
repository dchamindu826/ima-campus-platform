/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import {
  GraduationCap, BookOpen, Users, Award, Briefcase, Globe, ArrowRight,
  Phone, Mail, MapPin, CheckCircle2, Building2, PlayCircle, X, Layers,
  Search, Download, Sparkles, ShieldCheck, Clock, ExternalLink, Calendar,
  ChevronRight, ChevronLeft, Laptop, Truck, Bell, FileText, Star, Compass,
  Menu, ArrowUpRight, Flame, Volume2, Sparkle, Shield, Check, Info, Send,
  Maximize2, Eye, Play, Pause
} from 'lucide-react';
import { FaFacebook, FaYoutube, FaWhatsapp, FaTiktok } from 'react-icons/fa';
import CosmicPortalTransition from '../../../components/web/CosmicPortalTransition';
import HeroGraduation from '../components/HeroGraduation';

export default function NewCampusLandingPage({ loggedInUser }) {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search input state
  const [navSearchQuery, setNavSearchQuery] = useState('');

  // Scroll visibility states for section 3D PNG animations
  const [visibleSections, setVisibleSections] = useState({});

  // Auto-rotating Category Switcher State
  const categoriesList = [
    { id: 'SCHOLARSHIP', label: 'Scholarships', sinhala: 'ශිෂ්‍යත්ව වැඩසටහන්', icon: Award, color: 'from-amber-500 to-amber-700' },
    { id: 'OL', label: 'O/L Programmes', sinhala: 'සාමාන්‍ය පෙළ (O/L)', icon: BookOpen, color: 'from-blue-600 to-blue-800' },
    { id: 'AL', label: 'A/L Programmes', sinhala: 'උසස් පෙළ (A/L)', icon: GraduationCap, color: 'from-rose-600 to-rose-800' },
    { id: 'DEGREE', label: 'Diploma & Degrees', sinhala: 'ඩිප්ලෝමා & උපාධි', icon: FileText, color: 'from-emerald-600 to-emerald-800' },
    { id: 'OTHERS', label: 'Others & Professional', sinhala: 'වෘත්තීය පාඨමාලා', icon: Sparkles, color: 'from-purple-600 to-purple-800' }
  ];

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(2); // Default to A/L
  const [isCategoryAutoPlay, setIsCategoryAutoPlay] = useState(true);

  // Auto-cycle categories every 5 seconds
  useEffect(() => {
    if (!isCategoryAutoPlay) return;
    const interval = setInterval(() => {
      setActiveCategoryIndex((prev) => (prev + 1) % categoriesList.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isCategoryAutoPlay, categoriesList.length]);

  const activeCategory = categoriesList[activeCategoryIndex].id;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for Scroll-in 3D PNG animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1 }
    );

    const sectionIds = ['gallery', 'streams', 'ecosystem', 'pusthakalaya', 'rankers', 'management-team'];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading]);

  // Fetch Live Academic Businesses / Institutes from Backend
  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const res = await api.get('/public/landing-data');
        if (res.data?.businesses && Array.isArray(res.data.businesses)) {
          setBusinesses(res.data.businesses);
        }
      } catch (err) {
        console.warn('Fallback: fetching public landing data', err);
        try {
          const res2 = await api.get('/student/available-enrollments');
          if (res2.data?.businesses) setBusinesses(res2.data.businesses);
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };
    fetchLandingData();
  }, []);

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

  // Filter businesses by active category with fallback
  const filteredBusinesses = useMemo(() => {
    if (businesses.length === 0) return [];
    
    return businesses.filter(b => {
      const cat = (b.category || '').toUpperCase();
      const streams = (b.streams || '').toUpperCase();
      const name = (b.name || '').toUpperCase();
      const desc = (b.description || '').toUpperCase();

      if (activeCategory === 'SCHOLARSHIP') {
        return cat.includes('SCHOLAR') || name.includes('SCHOLAR') || desc.includes('SCHOLAR') || name.includes('ශිෂ්‍යත්ව');
      }
      if (activeCategory === 'OL') {
        return cat.includes('OL') || cat.includes('O/L') || name.includes('O/L') || name.includes('O\\L') || streams.includes('OL');
      }
      if (activeCategory === 'AL') {
        return cat.includes('AL') || cat.includes('A/L') || name.includes('A/L') || name.includes('A\\L') || streams.includes('AL') || streams.includes('MATH') || streams.includes('BIO') || streams.includes('ART') || streams.includes('TECH') || streams.includes('COMMERCE');
      }
      if (activeCategory === 'DEGREE') {
        return cat.includes('DEGREE') || cat.includes('DIPLOMA') || name.includes('DEGREE') || name.includes('DIPLOMA') || desc.includes('DIPLOMA');
      }
      if (activeCategory === 'OTHERS') {
        return true;
      }
      return true;
    });
  }, [businesses, activeCategory]);

  // Gallery Collage Images List with active dynamic state
  const galleryCollageImages = [
    { id: 1, src: '/gallery_convocation.jpg', title: 'Annual Convocation Ceremony', tag: 'Graduation Hall', highlight: 'Celebrating 1,200+ Graduates with Direct State University & Global Degrees' },
    { id: 2, src: '/gallery_auditorium.jpg', title: 'Smart Air-Conditioned Lecture Theatres', tag: 'Smart Campus', highlight: 'Interactive Digital Whiteboards & Tiered Acoustic Auditoriums' },
    { id: 3, src: '/gallery_lab.jpg', title: 'Modern Science & Innovation Labs', tag: 'Research & Tech', highlight: 'Hands-on practicals for Bio Science, Chemistry & Engineering Tech' },
    { id: 4, src: '/about_group.png', title: 'IMA Campus Faculty & Student Community', tag: 'Campus Life', highlight: 'Over 15,000+ active students learning both physically and via cloud' },
    { id: 5, src: '/campus_hero3.jpg', title: 'Island Rankers Distinction Celebration', tag: 'Hall of Fame', highlight: 'Honoring Top 10 All-Island distinction holders annually' },
    { id: 6, src: '/hero-campus-bg.jpg', title: 'Neoclassical Architecture & Facilities', tag: 'Campus Grounds', highlight: 'State-of-the-art campus infrastructure in a serene academic setting' }
  ];

  // Gallery Auto-Play Carousel State
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryAutoPlay, setIsGalleryAutoPlay] = useState(true);

  // Auto-play collage gallery spotlight every 4 seconds
  useEffect(() => {
    if (!isGalleryAutoPlay) return;
    const interval = setInterval(() => {
      setActiveGalleryIndex((prev) => (prev + 1) % galleryCollageImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isGalleryAutoPlay, galleryCollageImages.length]);

  // Prospectus Form State
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    stream: 'Combined Mathematics',
    year: '2027 A/L',
    mode: 'Hybrid (Physical + Online)'
  });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  // IMA Pusthakalaya 7-Second Cosmic Portal Transition State
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const handleOpenLibraryPortal = (e) => {
    if (e) e.preventDefault();
    setIsOpeningPortal(true);
  };


  return (
    <div className="min-h-screen bg-[#FDFDFE] text-slate-900 font-sans selection:bg-[#990000] selection:text-white relative overflow-x-clip">

      {/* Pure CSS Keyframe Animations */}
      <style>{`
        @keyframes heroStudentSlideUp {
          0% {
            transform: translateY(160px) scale(0.92);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-hero-student-slide {
          animation: heroStudentSlideUp 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes floatGentle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(2.5deg); }
        }
        @keyframes floatReverseGentle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(-3deg); }
        }
        .animate-float-slow {
          animation: floatGentle 6s ease-in-out infinite;
        }
        .animate-float-reverse {
          animation: floatReverseGentle 7s ease-in-out infinite;
        }

        @keyframes cardFadeInUp {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-card-entrance {
          animation: cardFadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ========================================================
          TOP NAVIGATION BAR (EXACT SPECIFICATION)
          Left: Social Media Icons
          Left-Center: HOME, GALLERY, COURSES & STREAMS
          Center: BIG PROMINENT CIRCULAR IMA CAMPUS EMBLEM
          Right-Center: ABOUT US, පුස්තකාලය, CONTACT US
          Right: Crimson Search Bar + LOGIN + REGISTER BUTTONS
      ======================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#7d0202] text-white shadow-xl transition-all duration-300">
        <div className="max-w-[1550px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between relative">
          
          {/* LEFT SIDE: Social Media Round Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" title="Facebook" className="w-7 h-7 rounded-full bg-white/15 hover:bg-white hover:text-[#7d0202] flex items-center justify-center transition-all text-xs">
              <FaFacebook size={12} />
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noreferrer" title="TikTok" className="w-7 h-7 rounded-full bg-white/15 hover:bg-white hover:text-[#7d0202] flex items-center justify-center transition-all text-xs">
              <FaTiktok size={11} />
            </a>
            <a href="https://wa.me/94712209030" target="_blank" rel="noreferrer" title="WhatsApp" className="w-7 h-7 rounded-full bg-white/15 hover:bg-white hover:text-[#7d0202] flex items-center justify-center transition-all text-xs">
              <FaWhatsapp size={12} />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" title="YouTube" className="w-7 h-7 rounded-full bg-white/15 hover:bg-white hover:text-[#7d0202] flex items-center justify-center transition-all text-xs">
              <FaYoutube size={12} />
            </a>
          </div>

          {/* LEFT-CENTER LINKS: HOME, GALLERY & COURSES */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-[13.5px] xl:text-[14px] font-extrabold uppercase tracking-wide text-white">
            <a href="#hero" className="hover:text-amber-300 transition-colors drop-shadow-sm">Home</a>
            <a href="#gallery" className="hover:text-amber-300 transition-colors drop-shadow-sm">Gallery</a>
            <a href="#streams" className="hover:text-amber-300 transition-colors drop-shadow-sm">Courses & Streams</a>
          </nav>

          {/* EXACT CENTER: LARGE PROMINENT IMA LOGO CIRCLE EMBLEM */}
          <Link to="/" className="flex items-center justify-center group my-[-6px]">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border-[3px] border-amber-400 p-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.4)] group-hover:scale-105 transition-transform flex items-center justify-center">
              <img src="/logo.png" alt="IMA Campus Logo" className="max-h-full max-w-full object-contain drop-shadow" />
            </div>
          </Link>

          {/* RIGHT-CENTER LINKS: ABOUT US, IMA LIBRARY (3D BOOK PORTAL), CONTACT US */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-[13.5px] xl:text-[14px] font-extrabold uppercase tracking-wide text-white">
            <Link to="/about-us" className="hover:text-amber-300 transition-colors drop-shadow-sm">About Us</Link>
            
            {/* 3D Interactive Book Portal Trigger */}
            <button
              onClick={handleOpenLibraryPortal}
              title="IMA පුස්තකාලය වෙත පිවිසෙන්න"
              className="group relative px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/25 via-amber-400/35 to-amber-500/25 border border-amber-400/70 hover:border-amber-300 hover:bg-amber-400/30 transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:scale-105 active:scale-95"
            >
              <img
                src="/3d-book-portal.png"
                alt="IMA පුස්තකාලය"
                className="w-5 h-5 object-contain group-hover:rotate-12 transition-transform drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]"
              />
              <span className="font-bold text-amber-300 text-sm tracking-wide font-sinhala group-hover:text-amber-200">
                IMA පුස්තකාලය
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </button>

            <a href="#admissions" className="hover:text-amber-300 transition-colors drop-shadow-sm">Contact Us</a>
          </nav>

          {/* RIGHT SIDE: SEARCH BAR + LOGIN & REGISTER BUTTONS */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Search Input Bar */}
            <div className="relative hidden xl:block">
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-36 lg:w-44 pl-3 pr-8 py-1.5 rounded-md bg-[#5a0101] text-xs text-white placeholder:text-white/60 border border-white/20 focus:outline-none focus:bg-[#480000] focus:border-amber-300 transition-all"
              />
              <button
                onClick={() => {
                  if (navSearchQuery) {
                    window.location.href = '#streams';
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 hover:text-white cursor-pointer"
              >
                <Search size={13} />
              </button>
            </div>

            {/* Login & Register Buttons */}
            <div className="flex items-center gap-1.5">
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-md text-xs font-bold text-white hover:bg-white/15 border border-white/20 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 rounded-md text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md transition-transform hover:scale-105"
              >
                Register
              </Link>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md text-white hover:bg-white/10 focus:outline-none"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

          </div>

        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#680101] border-t border-white/15 px-5 py-4 space-y-3 text-[13.5px] font-black uppercase tracking-wider">
            <a href="#hero" onClick={() => setMobileMenuOpen(false)} className="block text-white hover:text-amber-300 py-1">Home</a>
            <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="block text-white hover:text-amber-300 py-1">Campus Gallery</a>
            <a href="#streams" onClick={() => setMobileMenuOpen(false)} className="block text-white hover:text-amber-300 py-1">Courses & Streams</a>
            <Link to="/about-us" onClick={() => setMobileMenuOpen(false)} className="block text-white hover:text-amber-300 py-1">About Us</Link>
            <button
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleOpenLibraryPortal(e);
              }}
              className="w-full flex items-center justify-between text-left text-amber-300 py-2.5 px-3 rounded-lg bg-amber-400/15 border border-amber-400/40"
            >
              <span className="text-base font-bold tracking-wide font-sinhala">IMA පුස්තකාලය</span>
              <img src="/3d-book-portal.png" alt="IMA පුස්තකාලය" className="w-5 h-5 object-contain" />
            </button>
            <a href="#admissions" onClick={() => setMobileMenuOpen(false)} className="block text-white hover:text-amber-300 py-1">Contact Us</a>
          </div>
        )}
      </header>

      {/* ========================================================
          HERO SECTION: THE GRAND GRADUATION FINALE
          (Neoclassical Architecture Campus + Proud Graduates Image + Brand Ribbon & CTAs)
      ======================================================== */}
      <HeroGraduation handleOpenLibraryPortal={handleOpenLibraryPortal} />

      {/* ========================================================
          KEY METRICS STRIP
      ======================================================== */}
      <section className="bg-white border-b border-slate-200 py-6 px-4 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-3 border-r border-slate-100 last:border-0">
            <p className="text-3xl sm:text-4xl font-black text-[#7d0202]">15,400+</p>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Enrolled Students</p>
          </div>
          <div className="p-3 border-r border-slate-100 last:border-0">
            <p className="text-3xl sm:text-4xl font-black text-amber-600">38+</p>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Island Top Ranks</p>
          </div>
          <div className="p-3 border-r border-slate-100 last:border-0">
            <p className="text-3xl sm:text-4xl font-black text-slate-900">4K Ultra-HD</p>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Digital LMS Cloud</p>
          </div>
          <div className="p-3">
            <p className="text-3xl sm:text-4xl font-black text-emerald-600">25 Districts</p>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider mt-0.5">Doorstep Tute Courier</p>
          </div>
        </div>
      </section>

      {/* ========================================================
          NEW SECTION: AUTO-PLAYING DYNAMIC CAMPUS IMAGE COLLAGE
          "methanin danna ona image gallery ekak"
          "e wagema image gallaery eka collage ekak wage play wenna ona"
      ======================================================== */}
      <section id="gallery" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#7d0202] bg-rose-50 px-3 py-1 rounded-md border border-rose-200 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-600" />
                <span>Life At IMA Campus</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span>Auto-Playing Collage</span>
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mt-2">
              Interactive Campus <span className="text-[#7d0202]">Visual Showcase</span>
            </h2>
            <p className="text-slate-600 text-sm max-w-xl mt-1">
              Experience the energy of convocation day, smart physical auditoriums, science laboratories, and our vibrant student community.
            </p>
          </div>

          {/* Collage Auto-play Controls & Indicators */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <button
              onClick={() => setIsGalleryAutoPlay(!isGalleryAutoPlay)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-[#7d0202] hover:text-white text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title={isGalleryAutoPlay ? 'Pause Collage Auto-Play' : 'Play Collage Auto-Play'}
            >
              {isGalleryAutoPlay ? <Pause size={14} /> : <Play size={14} />}
              <span>{isGalleryAutoPlay ? 'Auto-Playing' : 'Paused'}</span>
            </button>

            <div className="flex items-center gap-1.5 px-2">
              {galleryCollageImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveGalleryIndex(idx);
                    setIsGalleryAutoPlay(false);
                  }}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    activeGalleryIndex === idx
                      ? 'w-6 bg-[#7d0202]'
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Animated Collage Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          
          {/* Main Featured Big Hero Spotlight Tile (7 cols) */}
          <div
            onClick={() => setSelectedGalleryImage(galleryCollageImages[activeGalleryIndex])}
            className="lg:col-span-7 h-[360px] sm:h-[460px] lg:h-[500px] rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-700 border border-slate-200 bg-slate-900"
          >
            <img
              key={activeGalleryIndex}
              src={galleryCollageImages[activeGalleryIndex].src}
              alt={galleryCollageImages[activeGalleryIndex].title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out animate-in fade-in zoom-in-95 duration-500"
            />
            
            {/* Ambient Lighting & Details */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-6 sm:p-8 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-amber-300/40">
                  {galleryCollageImages[activeGalleryIndex].tag}
                </span>
                <span className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white group-hover:scale-110 group-hover:bg-[#7d0202] transition-all">
                  <Maximize2 size={16} />
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-3xl font-black text-white leading-tight group-hover:text-amber-200 transition-colors">
                  {galleryCollageImages[activeGalleryIndex].title}
                </h3>
                <p className="text-xs sm:text-sm text-white/85 mt-2 line-clamp-2 max-w-lg">
                  {galleryCollageImages[activeGalleryIndex].highlight}
                </p>
                <div className="flex items-center gap-2 mt-4 text-[11px] font-bold text-amber-300">
                  <Eye size={14} />
                  <span>Click to expand full resolution</span>
                </div>
              </div>
            </div>

            {/* Bottom active auto-progress ticker line */}
            {isGalleryAutoPlay && (
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
                <div className="h-full bg-amber-400 w-full animate-[pulse_4s_linear_infinite]"></div>
              </div>
            )}
          </div>

          {/* Sub Collage 4-Tile Grid (5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4 h-[360px] sm:h-[460px] lg:h-[500px]">
            {galleryCollageImages
              .filter((_, idx) => idx !== activeGalleryIndex)
              .slice(0, 4)
              .map((item, subIdx) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const originalIdx = galleryCollageImages.findIndex(g => g.id === item.id);
                    setActiveGalleryIndex(originalIdx);
                  }}
                  className="rounded-2xl overflow-hidden relative group cursor-pointer border border-slate-200 bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <img
                    src={item.src}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity p-3 sm:p-4 flex flex-col justify-end text-white">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-black/50 px-2 py-0.5 rounded w-max border border-amber-300/30 mb-1">
                      {item.tag}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black leading-tight line-clamp-2 group-hover:text-amber-200 transition-colors">
                      {item.title}
                    </h4>
                  </div>
                </div>
              ))}
          </div>

        </div>
      </section>

      {/* ========================================================
          COURSES & STREAMS SECTION WITH:
          1. NO ARTIFICIAL OUTER CONTAINER BOX (CLEAN SEAMLESS CANVAS)
          2. GIANT 3D DIPLOMA SCROLL SLIDING IN FROM LEFT CORNER!
          3. ULTRA-PRO LUXURY CATEGORY SELECTOR (Scholarships, O/L, A/L, Degrees, Others)
          4. CLEAN PRO CARDS WITH BIG CENTER LOGO + NAME + SLOGAN
      ======================================================== */}
      <section id="streams" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative overflow-hidden">
        
        {/* =====================================================
            GIANT 3D DEGREE DIPLOMA SCROLL SLIDE-IN FROM LEFT CORNER
            "me certficate eka mita wada loku wenna ona scroll karankota 
            eka enna ona lefst side corner eke idala me thiynwa wage thanakata"
        ===================================================== */}
        <div
          className={`hidden lg:block absolute -left-20 -top-16 w-[500px] h-[500px] xl:w-[620px] xl:h-[620px] pointer-events-none transition-all duration-1000 ease-out z-0 transform ${
            visibleSections['streams']
              ? 'translate-x-0 opacity-100 -rotate-12 animate-float-slow'
              : '-translate-x-full opacity-0 rotate-45'
          }`}
        >
          <img
            src="/3d-scroll.png"
            alt="Giant 3D Degree Diploma Certificate Scroll"
            className="w-full h-full object-contain drop-shadow-[0_35px_70px_rgba(125,2,2,0.3)]"
          />
        </div>

        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-[#7d0202] text-xs font-black uppercase tracking-widest shadow-xs">
            <Sparkles size={13} className="text-amber-600" />
            <span>Certified Academic Pathways</span>
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            Academic Courses & <span className="text-[#7d0202]">Pathways</span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Explore world-class study programmes ranging from national scholarship coaching and A/L mastery to international undergraduate degrees.
          </p>
        </div>

        {/* =====================================================
            ULTRA-PRO LUXURY CATEGORY SWITCHER BAR
            Scholarships | O/L | A/L | Diploma & Degree Programmes | Others
        ===================================================== */}
        <div className="relative z-10 max-w-5xl mx-auto mb-14">
          
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Select Category (Auto-Shifting Active)</span>
            </span>

            <button
              onClick={() => setIsCategoryAutoPlay(!isCategoryAutoPlay)}
              className="text-xs font-bold text-slate-700 hover:text-[#7d0202] flex items-center gap-1.5 cursor-pointer bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm hover:shadow transition-all"
            >
              {isCategoryAutoPlay ? <Pause size={12} className="text-[#7d0202]" /> : <Play size={12} className="text-emerald-600" />}
              <span>{isCategoryAutoPlay ? 'Pause Auto-Shift' : 'Resume Auto-Shift'}</span>
            </button>
          </div>

          {/* Ultra-Pro Luxury Category Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {categoriesList.map((cat, idx) => {
              const isActive = activeCategoryIndex === idx;
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategoryIndex(idx);
                    setIsCategoryAutoPlay(false);
                  }}
                    className={`group p-4 rounded-2xl font-bold transition-all duration-400 cursor-pointer flex flex-col items-center text-center relative overflow-hidden ${
                      isActive
                        ? 'bg-gradient-to-br from-[#7d0202] via-[#940000] to-[#600000] text-white shadow-[0_12px_28px_rgba(125,2,2,0.38)] scale-[1.03] border-2 border-amber-400/80 z-10'
                        : 'bg-white/90 backdrop-blur-md text-slate-700 hover:text-slate-950 border border-slate-200/90 hover:border-rose-300 hover:bg-rose-50/40 shadow-xs hover:shadow-md'
                    }`}
                  >
                    {/* Top Ambient Glow on Active */}
                    {isActive && (
                      <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent"></div>
                    )}

                    <span className={`p-2 rounded-xl mb-1.5 transition-all duration-300 ${isActive ? 'bg-white/20 text-amber-300 scale-110' : 'bg-slate-100 text-slate-700 group-hover:scale-110'}`}>
                      {IconComp && <IconComp size={22} />}
                    </span>
                    <span className="text-xs sm:text-sm font-black leading-tight tracking-tight">
                      {cat.label}
                    </span>
                    <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-amber-300' : 'text-slate-400'}`}>
                      {cat.sinhala}
                    </span>

                    {/* Active Animated Progress Ticker */}
                    {isActive && isCategoryAutoPlay && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-200 w-full animate-[pulse_5s_linear_infinite]"></div>
                      </div>
                    )}
                  </button>
                );
            })}
          </div>
        </div>

        {/* =====================================================
            STREAM & PROGRAMME CARDS GRID
            "e card eke center eke lokuwata danna logo eka batches ona na penna
             logo ekai name ekai athule slogan ekai lassanata animation ekak danna"
        ===================================================== */}
        {loading ? (
          <div className="py-20 text-center space-y-3 relative z-10">
            <div className="w-8 h-8 border-2 border-[#7d0202] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Academic Programmes...</p>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-4 max-w-md mx-auto shadow-sm relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-[#7d0202] flex items-center justify-center mx-auto border border-rose-200">
              <Award size={28} />
            </div>
            <h4 className="text-base font-black text-slate-900">Custom Syllabus & Batch Admissions</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              New intakes are currently enrolling for this category. Contact our senior admissions desk at 071 220 90 30 for full schedules.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <a
                href="https://wa.me/94712209030"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <FaWhatsapp size={14} />
                <span>WhatsApp Admissions</span>
              </a>
              <button
                onClick={() => setActiveCategoryIndex(2)}
                className="px-4 py-2 rounded-xl bg-[#7d0202] text-white text-xs font-bold cursor-pointer hover:bg-[#680101]"
              >
                View A/L Streams
              </button>
            </div>
          </div>
        ) : (
          <div
            key={activeCategory}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10 max-w-6xl mx-auto animate-card-entrance"
          >
            {filteredBusinesses.map((biz, cardIndex) => (
              <div
                key={biz.id || cardIndex}
                onClick={() => setSelectedBiz(biz)}
                style={{ animationDelay: `${cardIndex * 60}ms` }}
                className="bg-white rounded-3xl border border-slate-200/90 p-7 sm:p-8 flex flex-col items-center text-center shadow-sm hover:shadow-2xl transition-all duration-500 group hover:-translate-y-2 cursor-pointer relative overflow-hidden"
              >
                {/* Top Subtle Category Tag */}
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-50 text-[#7d0202] border border-rose-200 shadow-2xs">
                    {biz.category || 'PROGRAMME'}
                  </span>
                </div>

                {/* BIG PROMINENT CENTER LOGO */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-slate-50 to-slate-100 border-2 border-slate-200/90 p-4 flex items-center justify-center my-4 group-hover:scale-110 group-hover:border-[#7d0202]/40 transition-transform duration-400 shadow-md">
                  <img
                    src={getImageUrl(biz.logo)}
                    alt={biz.name}
                    className="max-h-full max-w-full object-contain drop-shadow"
                  />
                </div>

                {/* PROGRAMME / FACULTY NAME */}
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-[#7d0202] transition-colors leading-tight mb-2">
                  {biz.name}
                </h3>

                {/* SLOGAN / DESCRIPTION (CLEAN & CENTERED) */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs font-medium line-clamp-3 mb-6">
                  {biz.description || 'Premier higher education programme designed for academic distinction and career success.'}
                </p>

                {/* Subtle Interactive Detail Cue */}
                <div className="mt-auto w-full pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs font-black text-[#7d0202] group-hover:text-rose-700">
                  <span>Explore Faculty & Timetables</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================
          HYBRID CAMPUS INFRASTRUCTURE SPOTLIGHT
      ======================================================== */}
      <section id="ecosystem" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#7d0202] bg-rose-50 px-3.5 py-1 rounded-md border border-rose-200">
            Physical & Digital Convergence
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            How The <span className="text-[#7d0202]">Hybrid System</span> Works
          </h2>
          <p className="text-slate-600 text-sm">
            Whether inside our smart AC lecture theatres or attending live online from home, your learning is seamless.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Spotlight 1: Smart Theatres */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group hover:-translate-y-1">
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden h-48 bg-slate-100 relative">
                <img src="/campus_hero2.jpg" alt="Smart Theatres" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#7d0202]">01 / PHYSICAL CAMPUS</span>
                <h3 className="text-lg font-black text-slate-900 mt-1">Air-Conditioned Smart Theatres</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Tiered auditoriums with 85-inch digital whiteboards, crystal acoustic sound, and biometric ID attendance check-in.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Parent SMS entry notifications
            </div>
          </div>

          {/* Spotlight 2: 4K LMS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group hover:-translate-y-1">
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden h-48 bg-slate-100 relative">
                <img src="/campus_hero1.jpg" alt="4K LMS Cloud" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#7d0202]">02 / DIGITAL CLOUD</span>
                <h3 className="text-lg font-black text-slate-900 mt-1">4K Cloud LMS & 24/7 Replays</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Full HD recorded sessions with speed controls (1.25x/1.5x), synced whiteboard notes, and instant homework submission.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> 24/7 Student Portal Access
            </div>
          </div>

          {/* Spotlight 3: Doorstep Tute Delivery */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group hover:-translate-y-1">
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden h-48 bg-slate-100 relative">
                <img src="/campus_hero3.jpg" alt="Tute Courier" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[#7d0202]">03 / DOORSTEP LOGISTICS</span>
                <h3 className="text-lg font-black text-slate-900 mt-1">Printed Books Doorstep Delivery</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Full-color printed theory workbooks and past paper booklets delivered monthly to any address in Sri Lanka with SMS tracking.
                </p>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> 48-72h Speed Courier Dispatch
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 4: IMA පුස්තකාලය (FREE PAST PAPERS & MARKING SCHEMES VAULT)
      ======================================================== */}
      <section id="pusthakalaya" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative">
        <div className="rounded-3xl bg-gradient-to-br from-amber-50/90 via-orange-50/70 to-amber-100/60 border border-amber-200/90 p-8 sm:p-14 shadow-xl relative overflow-hidden backdrop-blur-sm">
          
          {/* Subtle 3D background watermark */}
          <div className="absolute -right-16 -bottom-16 w-96 h-96 opacity-10 pointer-events-none">
            <img src="/3d-book-portal.png" alt="Library Watermark" className="w-full h-full object-contain" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
            
            {/* LEFT COLUMN: Clean Value Proposition & Feature Grid */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/90 px-3.5 py-1.5 rounded-lg border border-amber-300 shadow-sm font-sans">
                  100% Free Open Educational Resource
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-200 shadow-sm font-sans">
                  <Sparkles size={13} className="text-emerald-600" /> Digital Repository
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight font-sinhala">
                  IMA <span className="text-[#7d0202]">පුස්තකාලය</span> <br />
                  <span className="text-xl sm:text-3xl font-bold text-slate-700 tracking-normal font-sans">Digital Past Paper & Knowledge Vault</span>
                </h2>
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed mt-3 max-w-xl font-normal font-sinhala">
                  ශ්‍රී ලංකාවේ සියලුම විෂය ධාරාවන්ට අදාළ උසස් පෙළ, සාමාන්‍ය පෙළ සහ අනෙකුත් ශ්‍රේණිවල පසුගිය විභාග ප්‍රශ්න පත්‍ර, ආදර්ශ ප්‍රශ්න පත්‍ර සහ නිල ලකුණු ලබාදීමේ පටිපාටි (Marking Schemes) නොමිලේම බාගත කරගන්න.
                </p>
              </div>

              {/* 4 Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-3.5 rounded-xl bg-white/80 border border-amber-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-sinhala">නිල ලකුණු පටිපාටි (Marking Schemes)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-sinhala">පියවරෙන් පියවර නිවැරදි ඇගයීම් ක්‍රමවේදය</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/80 border border-amber-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-sinhala">සියලුම විෂය ධාරාවන් (All Streams)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-sinhala">ගණිත, විද්‍යා, වාණිජ, කලා සහ තාක්ෂණවේදය</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/80 border border-amber-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-sinhala">ආදර්ශ & වාර විභාග පත්‍ර (Model Papers)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-sinhala">ප්‍රමුඛ පාසල් ප්‍රශ්න පත්‍ර & ගුරු මාර්ගෝපදේශ</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/80 border border-amber-200/80 shadow-sm flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Download size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-sinhala">ක්ෂණික බාගත කිරීම් (High-Speed CDN)</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-sinhala">එක් ක්ලික් එකකින් PDF බාගත කිරීම සහ පෙරදසුන</p>
                  </div>
                </div>
              </div>

              {/* Primary Call to Action Button without any emoji or book icon */}
              <div className="pt-2 flex items-center gap-4 flex-wrap">
                <button
                  onClick={handleOpenLibraryPortal}
                  className="group px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#7d0202] via-[#990000] to-[#b30000] hover:from-[#5a0000] hover:to-[#7d0202] text-white font-bold text-sm tracking-wide shadow-[0_12px_28px_rgba(125,2,2,0.4)] hover:shadow-[0_16px_36px_rgba(125,2,2,0.6)] flex items-center gap-3 transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer border border-amber-400/40"
                >
                  <span className="tracking-wide text-amber-300 font-sinhala font-bold text-base">IMA පුස්තකාලය වෙත පිවිසෙන්න</span>
                  <ArrowRight size={18} className="text-amber-300 group-hover:translate-x-1.5 transition-transform" />
                </button>

                <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5 font-sans">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  No login required for downloads
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Luxury 3D Visual Spotlight Card */}
            <div className="lg:col-span-5">
              <div
                onClick={handleOpenLibraryPortal}
                className="group relative rounded-3xl bg-gradient-to-b from-[#4a0000] via-[#680101] to-[#2b0000] p-8 sm:p-10 border-2 border-amber-400/50 shadow-2xl overflow-hidden cursor-pointer hover:border-amber-300 transition-all hover:scale-[1.02] flex flex-col items-center justify-center text-center"
              >
                {/* Ambient cosmic gold glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/25 via-red-900/30 to-transparent pointer-events-none"></div>

                {/* Floating Stat Badge Top Left */}
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/40 border border-amber-400/40 backdrop-blur-md text-[11px] font-black text-amber-300 uppercase tracking-wider shadow font-sans">
                  1,000+ Papers
                </div>

                {/* Floating Stat Badge Top Right */}
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-400/40 backdrop-blur-md text-[11px] font-black text-emerald-300 uppercase tracking-wider shadow flex items-center gap-1 font-sans">
                  <Sparkles size={11} /> 100% Free
                </div>

                {/* Center 3D Book Graphic */}
                <div className="relative my-4">
                  <div className="absolute inset-0 m-auto w-40 h-40 rounded-full bg-amber-400/30 blur-2xl group-hover:bg-amber-400/50 transition-all"></div>
                  <img
                    src="/3d-book-portal.png"
                    alt="IMA පුස්තකාලය"
                    className="relative z-10 w-44 h-44 sm:w-52 sm:h-52 object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.8)] group-hover:scale-105 group-hover:-translate-y-2 transition-all duration-500"
                  />
                </div>

                <div className="relative z-10 space-y-2 mt-2">
                  <h3 className="text-2xl font-bold text-white tracking-wide font-sinhala">
                    IMA පුස්තකාලය
                  </h3>
                  <p className="text-xs text-amber-200/80 font-normal max-w-xs mx-auto font-sinhala leading-relaxed">
                    සියලුම ශ්‍රේණි, විෂය ධාරා සහ විෂයයන්ට අදාළ ප්‍රශ්න පත්‍ර සහ ගුරු මාර්ගෝපදේශ ගබඩාව.
                  </p>
                  
                  <div className="pt-3">
                    <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider group-hover:bg-amber-300 shadow-lg transition-all font-sinhala text-sm">
                      <span>පුස්තකාලය විවෘත කරන්න</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 5: ISLAND RANKERS & DISTINCTION WALL
          WITH GIANT 100% TRANSPARENT 3D GOLD TROPHY!
          "Island ranks ekat wenas wenna ona machan ethana ong eka thwa loku wenna ona eke bg ekat remove wenna ona"
      ======================================================== */}
      <section id="rankers" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative overflow-hidden">
        
        {/* Giant 3D Golden Academic Trophy (100% Transparent, No Background Box) */}
        <div
          className={`hidden lg:block absolute -right-12 -top-10 w-[380px] h-[380px] xl:w-[480px] xl:h-[480px] pointer-events-none transition-all duration-1000 ease-out z-0 transform ${
            visibleSections['rankers']
              ? 'translate-x-0 opacity-100 rotate-6 animate-float-slow'
              : 'translate-x-48 opacity-0 -rotate-12'
          }`}
        >
          <img
            src="/3d-trophy.png"
            alt="Giant 3D Golden Academic Distinction Trophy"
            className="w-full h-full object-contain drop-shadow-[0_30px_60px_rgba(217,119,6,0.4)]"
          />
        </div>

        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300/80 text-amber-900 text-xs font-black uppercase tracking-widest shadow-xs">
            <Award size={14} className="text-amber-600" />
            <span>Hall of National Distinction</span>
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            Celebrating <span className="text-[#7d0202]">Island Rankers</span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Every year, IMA Campus students conquer the G.C.E. Advanced Level examinations, entering premier state engineering, medical, and management faculties.
          </p>
        </div>

        {/* Luxury Gold Distinction Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative z-10">
          
          {/* Ranker 01 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-white via-amber-50/20 to-white border-2 border-amber-300/90 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col justify-between space-y-6 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-200/30 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Award size={13} className="text-white" />
                  <span>ALL-ISLAND 01</span>
                </span>
                <span className="text-[11px] font-black text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-300/50">
                  Z-Score: 2.8421
                </span>
              </div>

              <div className="text-amber-500 text-3xl font-serif">“</div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic -mt-4">
                The speed revision and past paper drills at IMA Campus gave me the exact exam technique needed to conquer the paper. The 4K cloud recordings were a lifesaver whenever I needed to clarify complex topics.
              </p>
            </div>

            <div className="pt-4 border-t border-amber-200/70 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-white font-black text-base flex items-center justify-center shadow-md shrink-0 border-2 border-white">
                KS
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm sm:text-base">Kasun Sandeepa</h4>
                <p className="text-[11px] font-bold text-[#7d0202]">Combined Maths • Faculty of Engineering, UoM</p>
              </div>
            </div>
          </div>

          {/* Ranker 02 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-white via-emerald-50/20 to-white border-2 border-emerald-300/90 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col justify-between space-y-6 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-200/30 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Award size={13} className="text-white" />
                  <span>ALL-ISLAND 02</span>
                </span>
                <span className="text-[11px] font-black text-emerald-900 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-300/50">
                  Z-Score: 2.7915
                </span>
              </div>

              <div className="text-emerald-500 text-3xl font-serif">“</div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic -mt-4">
                Printed theory workbooks delivered straight to my doorstep every month saved so much time. The lecturers are true subject masters who genuinely care about each student’s progress.
              </p>
            </div>

            <div className="pt-4 border-t border-emerald-200/70 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white font-black text-base flex items-center justify-center shadow-md shrink-0 border-2 border-white">
                CW
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm sm:text-base">Chathuri Wickramasinghe</h4>
                <p className="text-[11px] font-bold text-[#7d0202]">Biological Science • Faculty of Medicine, UoC</p>
              </div>
            </div>
          </div>

          {/* Ranker 03 */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-white via-rose-50/20 to-white border-2 border-rose-300/90 shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col justify-between space-y-6 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-rose-200/30 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#7d0202] to-[#990000] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Award size={13} className="text-white" />
                  <span>ALL-ISLAND 05</span>
                </span>
                <span className="text-[11px] font-black text-rose-900 bg-rose-100/80 px-2.5 py-0.5 rounded-md border border-rose-300/50">
                  Z-Score: 2.6840
                </span>
              </div>

              <div className="text-[#7d0202] text-3xl font-serif">“</div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic -mt-4">
                Mrs. Inoka Minipalanga’s Mass Media guidance is unmatched anywhere in Sri Lanka. Structured essay modeling and past paper discussions made scoring an A grade effortless.
              </p>
            </div>

            <div className="pt-4 border-t border-rose-200/70 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#7d0202] to-rose-400 text-white font-black text-base flex items-center justify-center shadow-md shrink-0 border-2 border-white">
                ND
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm sm:text-base">Naveen Dilshan</h4>
                <p className="text-[11px] font-bold text-[#7d0202]">Arts & Mass Media • Faculty of Arts, UoK</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          SECTION 6: EXECUTIVE LEADERSHIP & MANAGEMENT TEAM SHOWCASE
      ======================================================== */}
      <section id="management-team" className="pt-12 sm:pt-16 pb-0 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative overflow-hidden">
        
        {/* Prestige Header & Captions (100% Refined English) */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-2 relative z-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#7d0202]/10 border border-[#7d0202]/25 text-[#7d0202] text-xs font-black uppercase tracking-wider shadow-sm backdrop-blur-md">
            <Sparkles size={13} className="text-amber-500 animate-spin-slow" />
            <span>EXECUTIVE LEADERSHIP & GOVERNANCE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Guiding Your Journey to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7d0202] via-rose-700 to-amber-600">Academic Distinction</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto">
            Pioneering advanced digital education, academic discipline, and transformative mentorship to empower Sri Lanka's next generation of scholars and leaders.
          </p>

          {/* Leadership Pillars */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-slate-800 text-[11px] font-bold border border-slate-200 shadow-sm">
              <Award size={12} className="text-amber-600" /> Strategic Governance
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-slate-800 text-[11px] font-bold border border-slate-200 shadow-sm">
              <GraduationCap size={12} className="text-rose-600" /> Academic Excellence
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-slate-800 text-[11px] font-bold border border-slate-200 shadow-sm">
              <Sparkles size={12} className="text-amber-500" /> Student-First Innovation
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-slate-800 text-[11px] font-bold border border-slate-200 shadow-sm">
              <ShieldCheck size={12} className="text-emerald-600" /> 100% Transparency & Care
            </span>
          </div>
        </div>

        {/* Dynamic Slide-Up Stage for Management Team PNG with Grand Animated Background */}
        <div className="relative flex justify-center items-end max-w-6xl mx-auto pt-0 pb-0 -mt-2 sm:-mt-4">
          
          {/* ✨ BACKGROUND ANIMATION EFFECT 1: Rotating Royal Sunburst Rays ✨ */}
          <div
            className="absolute top-1/2 left-1/2 w-[600px] sm:w-[850px] h-[600px] sm:h-[850px] rounded-full pointer-events-none opacity-35 blur-2xl -z-10"
            style={{
              background: 'conic-gradient(from 0deg, rgba(125,2,2,0.25) 0deg, transparent 45deg, rgba(245,158,11,0.2) 90deg, transparent 135deg, rgba(125,2,2,0.25) 180deg, transparent 225deg, rgba(245,158,11,0.2) 270deg, transparent 315deg, rgba(125,2,2,0.25) 360deg)',
              animation: 'ray-spin-slow 30s linear infinite'
            }}
          />

          {/* ✨ BACKGROUND ANIMATION EFFECT 2: Pulsing Radiant Crimson & Gold Nebula ✨ */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-4/5 h-[340px] bg-gradient-to-t from-[#7d0202]/20 via-amber-500/12 to-transparent blur-3xl -z-10 pointer-events-none rounded-full"
            style={{ animation: 'aura-glow-pulse 5s ease-in-out infinite' }}
          />

          {/* ✨ ILLUMINATED EXECUTIVE STAGE PEDESTAL ✨ */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-[#7d0202]/30 via-amber-400/40 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.4)] z-10" />

          {/* Team Photo with Grand Slide-Up Transform Animation (Completely steady, no hover jitter) */}
          <div
            className={`w-full flex justify-center transition-all duration-1000 ease-out transform ${
              visibleSections['management-team']
                ? 'translate-y-0 opacity-100'
                : 'translate-y-24 opacity-0'
            }`}
          >
            <img
              src="/management-team.png"
              alt="IMA Campus Executive Management Team"
              className="w-full max-w-5xl sm:max-w-6xl max-h-[580px] sm:max-h-[640px] lg:max-h-[680px] object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.18)] pointer-events-none select-none relative z-10"
            />
          </div>

        </div>

      </section>

      {/* ========================================================
          SECTION 7: OFFICIAL DEPARTMENT HOTLINES & ADMISSIONS (NEW NUMBERS)
      ======================================================== */}
      <section id="admissions" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 relative">
        <div className="bg-gradient-to-br from-[#0a0f1d] via-[#111827] to-[#1c1117] rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl text-white relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>OFFICIAL ADMISSIONS & STREAM HOTLINES</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Direct Department Contacts
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                Reach out to our specialized stream coordinators for batch registrations, timetable details, and academic advice.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/contact-us"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
              >
                <span>Full Contact Center</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Department Hotlines 6-Card Grid (Matching Poster Styling) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-8 relative z-10">
            
            {/* 1. IMA O/L */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#064e3b] flex items-center justify-center text-white text-[10px] font-black">
                      O/L
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#064e3b] text-emerald-300 border border-emerald-500/30">
                      IMA O/L
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ordinary Level Stream</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-emerald-400" />
                  <span>077 428 90 30</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0774289030" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94774289030" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* 2. IMA ART */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-purple-500/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#6b21a8] flex items-center justify-center text-white text-[10px] font-black">
                      ART
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#6b21a8] text-purple-300 border border-purple-500/30">
                      IMA ART
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">A/L Arts Stream</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-purple-400" />
                  <span>076 625 90 30</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0766259030" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94766259030" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* 3. IMA COMMERCE */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-blue-500/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#1d4ed8] flex items-center justify-center text-white text-[9px] font-black">
                      COM
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#1d4ed8] text-blue-300 border border-blue-500/30">
                      IMA COMMERCE
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">A/L Commerce Stream</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-blue-400" />
                  <span>077 207 90 30</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0772079030" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94772079030" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* 4. IMA TECH */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-orange-500/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#ea580c] flex items-center justify-center text-white text-[10px] font-black">
                      TECH
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#ea580c] text-orange-300 border border-orange-500/30">
                      IMA TECH
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Technology Stream (ET / BST / ICT)</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-orange-400" />
                  <span>077 334 50 60</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0773345060" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94773345060" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* 5. FAST TRACK */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-red-500/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#dc2626] flex items-center justify-center text-white text-[10px] font-black">
                      FAST
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#dc2626] text-red-300 border border-red-500/30">
                      FAST TRACK
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Accelerated Revision & Papers</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-red-400" />
                  <span>071 220 90 30</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0712209030" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94712209030" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* 6. IMA LAW SCHOOL */}
            <div className="bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-amber-400/40 rounded-2xl p-4.5 transition-all duration-300 flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-amber-200 shadow-sm shrink-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-[#0f172a] flex items-center justify-center text-amber-300 text-[10px] font-black">
                      LAW
                    </div>
                  </div>
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#0f172a] text-amber-300 border border-amber-400/30">
                      IMA LAW SCHOOL
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Law College Entrance & LL.B</p>
                  </div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-2.5 flex items-center justify-between border border-white/5 mb-3">
                <div className="flex items-center gap-2 text-white font-black text-base sm:text-lg tracking-wide">
                  <Phone size={14} className="text-amber-400" />
                  <span>070 7 678 561</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:0707678561" className="py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <Phone size={12} />
                  <span>Call</span>
                </a>
                <a href="https://wa.me/94707678561" target="_blank" rel="noreferrer" className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5">
                  <FaWhatsapp size={13} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

          </div>

          {/* Bottom Campus Address Bar */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-red-400 shrink-0" />
              <span className="text-slate-200 font-medium">Campus: No. 346/A, Robert Gunawardane Mawatha, Malabe</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="mailto:info@imacampus.online" className="hover:text-white transition-colors flex items-center gap-1.5">
                <Mail size={13} className="text-amber-400" />
                <span>info@imacampus.online</span>
              </a>
              <span className="text-white/20">|</span>
              <a href="https://www.imacampus.online" className="hover:text-white transition-colors flex items-center gap-1.5">
                <Globe size={13} className="text-blue-400" />
                <span>www.imacampus.online</span>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          PRESTIGE FOOTER
      ======================================================== */}
      <footer className="border-t border-slate-200 bg-white py-14 px-4 sm:px-6 lg:px-8 relative z-10 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="IMA Logo" className="h-9" />
              <div>
                <span className="text-lg font-black text-slate-900 tracking-tight">IMA CAMPUS</span>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Higher Education & Academic Center</p>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed max-w-sm text-xs">
              Sri Lanka's premier technology-driven higher education campus. Empowering future leaders through physical excellence and 4K digital learning.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-[#7d0202] hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                <FaFacebook size={13} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-[#7d0202] hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                <FaYoutube size={13} />
              </a>
              <a href="https://wa.me/94712209030" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                <FaWhatsapp size={13} />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 flex items-center justify-center transition-colors">
                <FaTiktok size={13} />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs">Academic Links</h4>
            <ul className="space-y-2 font-medium">
              <li><Link to="/login" className="hover:text-[#7d0202] transition-colors">Student LMS Portal</Link></li>
              <li><Link to="/register" className="hover:text-[#7d0202] transition-colors">New Registration</Link></li>
              <li><button onClick={handleOpenLibraryPortal} className="hover:text-[#7d0202] transition-colors text-left font-sinhala text-sm font-bold cursor-pointer">IMA පුස්තකාලය</button></li>
              <li><a href="#streams" className="hover:text-[#7d0202] transition-colors">Course Schedules</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs">Admissions & Contact</h4>
            <ul className="space-y-2 font-medium">
              <li className="flex items-start gap-2 text-slate-700">
                <MapPin size={14} className="text-[#7d0202] mt-0.5 shrink-0" />
                <span>No. 346/A, Robert Gunawardane Mawatha, Malabe</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={13} className="text-[#7d0202] shrink-0" />
                <a href="mailto:info@imacampus.online" className="hover:text-[#7d0202] transition-colors">info@imacampus.online</a>
              </li>
              <li className="flex items-center gap-2">
                <Globe size={13} className="text-[#7d0202] shrink-0" />
                <a href="https://www.imacampus.online" target="_blank" rel="noreferrer" className="hover:text-[#7d0202] transition-colors">www.imacampus.online</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={13} className="text-[#7d0202] shrink-0" />
                <Link to="/contact-us" className="text-[#7d0202] font-bold hover:underline">View Official Hotlines →</Link>
              </li>
              <li className="pt-1 text-[11px] text-emerald-600 font-bold">● Admissions Open 2026/2027/2028</li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>© {new Date().getFullYear()} IMA Campus Higher Education Center. Operated by <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> & <strong>IMA FAST TRACK (PVT) LTD</strong>.</p>
          <p>No. 346/A, Robert Gunawardane Mawatha, Malabe • info@imacampus.online</p>
        </div>
      </footer>

      {/* ========================================================
          GALLERY LIGHTBOX ENLARGE MODAL
      ======================================================== */}
      {selectedGalleryImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-4xl w-full bg-[#0d1322] border border-white/15 rounded-3xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSelectedGalleryImage(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black text-white cursor-pointer z-10"
            >
              <X size={20} />
            </button>

            <div className="h-[420px] sm:h-[520px] bg-black flex items-center justify-center">
              <img
                src={selectedGalleryImage.src}
                alt={selectedGalleryImage.title}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-5 sm:p-6 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white border-t border-white/10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                  {selectedGalleryImage.tag}
                </span>
                <h3 className="text-lg font-black text-white mt-1">{selectedGalleryImage.title}</h3>
              </div>
              <button
                onClick={() => setSelectedGalleryImage(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BATCHES & PROGRAMME INSPECT MODAL
      ======================================================== */}
      {selectedBiz && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center p-2 shrink-0 shadow-sm">
                  <img src={getImageUrl(selectedBiz.logo)} alt={selectedBiz.name} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{selectedBiz.name}</h2>
                  <p className="text-[#7d0202] text-xs font-bold uppercase tracking-wider mt-0.5">
                    {selectedBiz.category || 'Academic Department'} • Active Timetables
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBiz(null)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {(!selectedBiz.batches || selectedBiz.batches.length === 0) ? (
                <div className="text-center py-10 space-y-2">
                  <Layers size={40} className="mx-auto text-slate-300" />
                  <p className="text-slate-700 font-bold text-sm">No specific sub-batches listed at the moment.</p>
                  <p className="text-xs text-slate-500">You can enroll directly or contact admissions at 071 220 90 30 for timetables.</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-[#7d0202] text-white text-xs font-bold shadow"
                  >
                    Direct Online Enrollment
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {selectedBiz.batches.map(batch => (
                    <div
                      key={batch.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 hover:border-slate-300 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1.5">{batch.name}</h3>
                        {batch.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                            {batch.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => navigate('/login')}
                        className="w-full mt-3 bg-[#7d0202] hover:bg-[#680101] text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                      >
                        Enroll in Batch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Have questions about fees or admission?</span>
              <a
                href="https://wa.me/94712209030"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 font-bold hover:underline"
              >
                WhatsApp 071 220 90 30
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          7-SECOND COSMIC HYPERSPACE & FLYING KNOWLEDGE BUTTERFLIES PORTAL TRANSITION
      ======================================================== */}
      {isOpeningPortal && (
        <CosmicPortalTransition onClose={() => setIsOpeningPortal(false)} />
      )}

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, BookOpen, Award, Sparkles, FileText, ArrowRight,
  CheckCircle2, Star, Trophy, Users, ShieldCheck, Compass, Sparkle,
  Laptop, ChevronRight, Play, Pause, RefreshCw
} from 'lucide-react';

export const journeyStages = [
  {
    id: 'grade5',
    stageNumber: '01',
    ageRange: 'Age 9 - 10',
    title: 'Grade 5 Scholarship',
    sinhalaTitle: '5 ශිෂ්‍යත්ව විශිෂ්ටත්වය',
    subtitle: 'Where Dreams Begin · පළමු පියවර',
    description: 'දරුවාගේ මූලික අධ්‍යාපන කුසලතා, තර්කනය සහ මතක ශක්තිය ක්‍රමානුකූලව වර්ධනය කරමින් ශිෂ්‍යත්ව විභාගයේ දිවයිනේ ඉහළම ලකුණු කරා දරුවා මෙහෙයවීම.',
    milestones: [
      'විභාග රටාවට අනුව සකසන ලද විශේෂ ප්‍රශ්න පත්‍ර කට්ටල',
      'දක්ෂ හා ප්‍රවීණ ආචාර්ය මණ්ඩලයේ සෘජු මඟපෙන්වීම',
      'මානසික ආතතියෙන් තොර විනෝදාත්මක ඉගැන්වීම් ක්‍රමවේද',
      'Smart Physical පන්ති කාමර සහ Online Cloud Replays'
    ],
    badge: '100% Pass Rate Target',
    badgeColor: 'from-amber-500 to-amber-700',
    statNumber: '190+',
    statLabel: 'Highest Marks Track',
    imageCutout: '/hero-stage-grade5.png',
    fallbackImg: '/slide1.jpg',
    themeColor: '#f59e0b',
    quote: '"ශිෂ්‍යත්ව පන්තියෙන්ම IMA එකට ආපු නිසා මගේ දරුවාට අධ්‍යාපනයට ලොකු ආසාවක් ඇති වුණා."'
  },
  {
    id: 'ol',
    stageNumber: '02',
    ageRange: 'Age 15 - 16',
    title: 'G.C.E. Ordinary Level (O/L)',
    sinhalaTitle: 'සාමාන්‍ය පෙළ 9-A විශිෂ්ටත්වය',
    subtitle: 'Building the Academic Foundation · පදනම ශක්තිමත් කිරීම',
    description: 'සාමාන්‍ය පෙළ සියලුම විෂය ධාරාවන් ආවරණය කරමින්, පසුගිය විභාග ප්‍රශ්න පත්‍ර සහ Model Papers හරහා විභාග බිය දුරලා 9-A සාමාර්ථ සහතික කිරීම.',
    milestones: [
      'ගණිතය, විද්‍යාව, ඉංග්‍රීසි ඇතුළු ප්‍රධාන විෂයන් සඳහා විශේෂ සම්මන්ත්‍රණ',
      'සෑම සතියකම Timed Model Paper Discussion',
      'Smart Labs මඟින් ප්‍රායෝගික පරීක්ෂණ (Science Practicals)',
      'දුර්වල විෂයන් සඳහා විශේෂ Individual Attention කණ්ඩායම්'
    ],
    badge: '9 Distinctions Target',
    badgeColor: 'from-blue-600 to-blue-800',
    statNumber: '95%+',
    statLabel: '9-A & 8-A Distinction Rate',
    imageCutout: '/hero-stage-ol.png',
    fallbackImg: '/slide2.jpg',
    themeColor: '#3b82f6',
    quote: '"O/L වලදි කරපු Model Papers නිසා විභාග ශාලාවේදී කිසිම බයක් දැනුනේ නෑ."'
  },
  {
    id: 'al',
    stageNumber: '03',
    ageRange: 'Age 17 - 19',
    title: 'G.C.E. Advanced Level (A/L)',
    sinhalaTitle: 'උසස් පෙළ දිවයිනේ විශිෂ්ටයෝ',
    subtitle: 'Aiming for the Island Pinnacle · උසස් පෙළ ජයග්‍රහණය',
    description: 'Combined Maths, Bio Science, Commerce, Technology සහ Arts - දිවයිනේ ප්‍රමුඛතම ආචාර්ය මණ්ඩලය සමඟ Smart Physical AC Theatres සහ 4K Cloud Replays.',
    milestones: [
      'Combined Maths, Biology, Commerce, Tech & Arts ප්‍රමුඛතම ගුරු මණ්ඩලය',
      'වායුසමනය කළ Smart Physical AC Lecture Theatres',
      'Full HD / 4K Digital Replay Portal (IMA Pusthakalaya)',
      'Island Rankers බිහිකළ විශේෂිත Speed & Accuracy Training'
    ],
    badge: 'All-Island Top Rankers',
    badgeColor: 'from-rose-600 to-rose-800',
    statNumber: 'Island Top 10',
    statLabel: 'Consistent Annual Distinctions',
    imageCutout: '/hero-stage-al.png',
    fallbackImg: '/slide3.jpg',
    themeColor: '#ef4444',
    quote: '"A/L කියන්නේ ලොකු තරඟයක්. IMA එකේ Lecturers ලා සහ Replay System එක මගේ Z-Score එක උපරිම කළා."'
  },
  {
    id: 'degree',
    stageNumber: '04',
    ageRange: 'Age 20 - 22',
    title: 'Higher Education & Diplomas',
    sinhalaTitle: 'ඩිප්ලෝමා & ජාත්‍යන්තර උපාධි',
    subtitle: 'Bridging to Global Careers · උසස් වෘත්තීය මාවත',
    description: 'A/L වලින් නොනැවතී Direct University Degree Pathways, Higher National Diplomas සහ Industry-ready Professional qualifications වෙත යොමු කිරීම.',
    milestones: [
      'රාජ්‍ය සහ ජාත්‍යන්තර විශ්වවිද්‍යාල පිළිගත් Degree Pathways',
      'IT, Business Management, Data Science & Engineering Diplomas',
      'Modern Computer Labs සහ Research Facilities',
      'Direct Career Placement සහ Corporate Internship සහාය'
    ],
    badge: 'UGC & Global Degrees',
    badgeColor: 'from-emerald-600 to-emerald-800',
    statNumber: '100+',
    statLabel: 'Corporate Hiring Partners',
    imageCutout: '/hero-stage-degree.png',
    fallbackImg: '/gallery_lab.jpg',
    themeColor: '#10b981',
    quote: '"A/L ඉවර වුණ ගමන්ම Diploma එකෙන් පටන් අරන් Direct Degree එක complete කරගන්න IMA Campus එක ලොකු ශක්තියක් වුණා."'
  },
  {
    id: 'graduation',
    stageNumber: '05',
    ageRange: 'Graduation Day',
    title: 'The Grand Convocation',
    sinhalaTitle: 'වාර්ෂික උපාධි ප්‍රදානෝත්සවය',
    subtitle: 'A Day to Remember · ඔබ ලැබූ මහා ජයග්‍රහණය',
    description: 'වසර ගණනාවක කැපවීම, නොපසුබට උත්සාහය සහ විශිෂ්ටත්වයේ කිරුළ පළඳින දිනය. 1,200+ වැඩි උපාධිධාරීන් සමාජයට දායාද කරන මහා උපාධි ප්‍රදානෝත්සවය.',
    milestones: [
      '1,200+ Graduates Celebrating Simultaneously',
      'Official Convocation Gowns, Gold Medals & Degree Scrolls',
      'Special Distinction Awards for Outstanding Achievers',
      'Proud Parents, Faculty Mentors & Academic Dignitaries'
    ],
    badge: '1,200+ Annual Graduates',
    badgeColor: 'from-amber-400 to-yellow-600',
    statNumber: '1,200+',
    statLabel: 'Proud Graduates Annually',
    imageCutout: '/hero-students-cutout.png',
    fallbackImg: '/gallery_convocation.jpg',
    themeColor: '#f59e0b',
    quote: '"IMA එකට 5 වසරේ ආපු මම අද Degree එකක් අතැතිව Graduate වෙන්නේ ආඩම්බරයෙන්. You Deserve This!"'
  }
];

export default function StudentJourneyScrollytelling() {
  const containerRef = useRef(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  // Scroll listener to update active stage dynamically
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const containerHeight = rect.height;
      
      // Calculate how far container has been scrolled through
      const totalScrollable = containerHeight - windowHeight;
      if (totalScrollable <= 0) return;

      const currentScrolled = -rect.top;
      const progress = Math.min(Math.max(currentScrolled / totalScrollable, 0), 1);
      setScrollProgress(progress);

      // Determine stage index (0 to 4)
      const stageIdx = Math.min(
        Math.floor(progress * journeyStages.length),
        journeyStages.length - 1
      );
      if (stageIdx >= 0 && stageIdx < journeyStages.length) {
        setActiveStageIndex(stageIdx);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-play timer if user clicks play
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % journeyStages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const currentStage = journeyStages[activeStageIndex];

  const handleImageError = (stageId) => {
    setImageErrors((prev) => ({ ...prev, [stageId]: true }));
  };

  const jumpToStage = (idx) => {
    setActiveStageIndex(idx);
    if (containerRef.current) {
      const containerTop = containerRef.current.offsetTop;
      const containerHeight = containerRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const targetScroll = containerTop + (idx / (journeyStages.length - 1)) * (containerHeight - windowHeight);
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={containerRef}
      id="student-journey"
      className="relative w-full bg-[#0d0101] text-white py-16 sm:py-24 overflow-hidden border-t-2 border-b-2 border-amber-500/20"
      style={{ minHeight: '350vh' }}
    >
      {/* Background Ambience & Lighting */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden px-4 sm:px-6 lg:px-12 py-8 pointer-events-none">
        
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7d0202]/40 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-amber-600/20 rounded-full blur-[140px] pointer-events-none -z-10"></div>
        
        {/* Subtle Grid Silhouette */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none -z-10"></div>

        {/* SECTION HEADER & STAGE SELECTOR (STICKY TOP) */}
        <div className="w-full max-w-7xl mx-auto z-20 pointer-events-auto">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles size={13} className="text-amber-300 animate-spin" style={{ animationDuration: '8s' }} />
                <span>The Complete IMA Lifetime Journey</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <span>From First Step To</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                  Grand Graduation
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-sinhala font-medium pt-1">
                5 වසර ශිෂ්‍යත්වයේ සිට University Degree එක දක්වා එකම වහලක් යට සම්පූර්ණ අධ්‍යාපන ගමන
              </p>
            </div>

            {/* Stage Selector Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/15 overflow-x-auto max-w-full">
              {journeyStages.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                return (
                  <button
                    key={stage.id}
                    onClick={() => jumpToStage(idx)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-105'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isActive ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-white'
                    }`}>
                      {stage.stageNumber}
                    </span>
                    <span className="font-sinhala text-xs">{stage.sinhalaTitle.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Glowing Connected Progress Line */}
          <div className="relative w-full h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
              style={{ width: `${((activeStageIndex + 1) / journeyStages.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* MAIN INTERACTIVE STAGE SHOWCASE (STICKY MIDDLE) */}
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center my-auto z-20 pointer-events-auto">
          
          {/* LEFT COLUMN: Stage Details & Milestones (7 cols) */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            
            {/* Stage Age & Sinhala Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-black tracking-widest text-amber-300 uppercase">
                {currentStage.ageRange}
              </span>
              <span className={`px-4 py-1 rounded-full bg-gradient-to-r ${currentStage.badgeColor} text-white text-xs font-extrabold uppercase shadow-lg tracking-wider`}>
                {currentStage.badge}
              </span>
              <span className="text-white/50 text-xs font-mono font-bold">
                STAGE {currentStage.stageNumber} OF 05
              </span>
            </div>

            {/* Stage Headings */}
            <div>
              <div className="text-amber-400 font-sinhala text-lg sm:text-2xl font-bold tracking-wide drop-shadow">
                {currentStage.sinhalaTitle}
              </div>
              <h3 className="text-3xl sm:text-5xl lg:text-5xl font-black uppercase text-white tracking-tight leading-none mt-1">
                {currentStage.title}
              </h3>
              <p className="text-sm sm:text-base text-amber-200/90 font-medium tracking-wide mt-1">
                {currentStage.subtitle}
              </p>
            </div>

            {/* Stage Description */}
            <p className="text-xs sm:text-sm text-slate-300 font-sinhala leading-relaxed max-w-2xl bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              {currentStage.description}
            </p>

            {/* Stage Key Milestones Bullet Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {currentStage.milestones.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 bg-white/5 hover:bg-white/10 p-2.5 rounded-lg border border-white/10 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={13} />
                  </div>
                  <span className="text-xs text-slate-200 font-sinhala font-medium leading-tight">
                    {m}
                  </span>
                </div>
              ))}
            </div>

            {/* Student Quote Box */}
            <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-[#7d0202]/40 to-transparent border-l-4 border-amber-400 text-xs sm:text-sm italic text-amber-100 font-sinhala">
              {currentStage.quote}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#streams"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center gap-2 transition-transform hover:scale-105 cursor-pointer"
              >
                <span>Enroll in {currentStage.title}</span>
                <ArrowRight size={15} />
              </a>

              <a
                href="#admissions"
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 transition-colors"
              >
                Inquire Batch Details
              </a>
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Character Visual Stage Showcase (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            
            {/* Visual Halo / Portal */}
            <div className="relative w-full max-w-md aspect-square sm:aspect-[4/5] rounded-3xl bg-gradient-to-b from-[#7d0202]/50 via-black/80 to-black p-6 border-2 border-amber-400/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col items-center justify-end overflow-hidden group">
              
              {/* Radial Lighting Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none"></div>

              {/* Stage Stat Floating Pill */}
              <div className="absolute top-4 left-4 z-30 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-amber-400/50 shadow-xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm">
                  {currentStage.stageNumber === '05' ? <Trophy size={16} /> : <Star size={16} />}
                </div>
                <div>
                  <div className="text-xs font-black text-white leading-none">{currentStage.statNumber}</div>
                  <div className="text-[10px] text-amber-300 font-medium">{currentStage.statLabel}</div>
                </div>
              </div>

              {/* Stage Visual Display: Cutout or Fallback with Label */}
              <div className="relative z-10 w-full h-full flex items-end justify-center">
                {!imageErrors[currentStage.id] ? (
                  <img
                    src={currentStage.imageCutout}
                    alt={currentStage.title}
                    onError={() => handleImageError(currentStage.id)}
                    className="max-h-[85%] max-w-full object-contain object-bottom drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] transition-all duration-500 transform group-hover:scale-105"
                  />
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4 rounded-2xl overflow-hidden">
                    <img
                      src={currentStage.fallbackImg}
                      alt={currentStage.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform"
                    />
                    <div className="relative z-20 space-y-2 bg-black/70 p-4 rounded-xl border border-amber-400/40">
                      <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
                        <GraduationCap size={24} />
                      </div>
                      <div className="text-xs font-bold text-white font-sinhala">{currentStage.sinhalaTitle}</div>
                      <div className="text-[10px] text-amber-300 font-mono">
                        Slot: {currentStage.imageCutout.replace('/', '')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Stage Glow Plate */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent z-20 pointer-events-none"></div>

              {/* Interactive Next / Prev Step Controls */}
              <div className="absolute bottom-4 inset-x-4 z-30 flex items-center justify-between">
                <button
                  onClick={() => jumpToStage((activeStageIndex - 1 + journeyStages.length) % journeyStages.length)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                >
                  <span>‹ Previous</span>
                </button>

                <span className="text-[11px] font-bold text-amber-300 font-mono">
                  {activeStageIndex + 1} / {journeyStages.length}
                </span>

                <button
                  onClick={() => jumpToStage((activeStageIndex + 1) % journeyStages.length)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black backdrop-blur-md flex items-center gap-1 cursor-pointer transition-all hover:scale-105 shadow-md"
                >
                  <span>Next ›</span>
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* STICKY BOTTOM FOOTER: HINT */}
        <div className="w-full max-w-7xl mx-auto text-center z-20 py-2 pointer-events-auto">
          <p className="text-[11px] text-slate-400 font-mono tracking-widest uppercase flex items-center justify-center gap-2">
            <span>Scroll to walk through the journey</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>Or click stages above</span>
          </p>
        </div>

      </div>
    </section>
  );
}

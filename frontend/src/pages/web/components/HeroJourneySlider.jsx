import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, GraduationCap, FileText, Sparkles,
  ChevronRight, ChevronLeft, Star, Trophy, CheckCircle2, Play, Pause,
  ShieldCheck, Flame
} from 'lucide-react';

export const heroStagesData = [
  {
    id: 'grade5',
    stageNumber: '01',
    label: '5 ශිෂ්‍යත්වය',
    englishLabel: 'Grade 5 Scholarship',
    headlinePrefix: 'WHERE DREAMS',
    headlineMain: 'BEGIN',
    ribbonText: 'FIRST STEP TO EXCELLENCE',
    sinhalaTag: '01. 5 ශිෂ්‍යත්ව විශිෂ්ටත්වය',
    description: 'කුඩා මනසට නිවැරදි මඟපෙන්වීම. දක්ෂ ගුරු මණ්ඩලයක් සමඟින් දිවයිනේ ඉහළම ලකුණු ලාභීන් බිහිකරන විශේෂ ශිෂ්‍යත්ව පන්ති.',
    metricBadge: '100% Pass Rate Target',
    metricSub: 'Islandwide Top Scores Track',
    ctaText: 'Explore Scholarship Batches',
    ctaLink: '#streams',
    imageCutout: '/hero-stage-grade5.png',
    fallbackBg: '/hero-campus-bg.jpg',
    themeAccent: '#f59e0b',
    badgeIcon: Award
  },
  {
    id: 'ol',
    stageNumber: '02',
    label: 'O/L සාමාන්‍ය පෙළ',
    englishLabel: 'G.C.E. Ordinary Level',
    headlinePrefix: 'BUILDING THE',
    headlineMain: 'FOUNDATION',
    ribbonText: '9-A DISTINCTIONS TARGET',
    sinhalaTag: '02. O/L සාමාන්‍ය පෙළ 9-A Master',
    description: 'විභාග බිය දුරලා විශිෂ්ට 9-A සාමාර්ථ කරා දරුවන් මෙහෙයවන විද්‍යාත්මක ඉගැන්වීම් රටාව සහ Smart Model Papers.',
    metricBadge: '9 A Distinctions Target',
    metricSub: 'Targeted Speed & Model Papers',
    ctaText: 'View O/L Programmes',
    ctaLink: '#streams',
    imageCutout: '/hero-stage-ol.png',
    fallbackBg: '/hero-campus-bg.jpg',
    themeAccent: '#3b82f6',
    badgeIcon: BookOpen
  },
  {
    id: 'al',
    stageNumber: '03',
    label: 'A/L උසස් පෙළ',
    englishLabel: 'G.C.E. Advanced Level',
    headlinePrefix: 'AIMING FOR THE',
    headlineMain: 'PINNACLE',
    ribbonText: 'ALL-ISLAND TOP RANKERS',
    sinhalaTag: '03. A/L දිවයිනේ විශිෂ්ටයෝ',
    description: 'Combined Maths, Bio Science, Commerce, Tech සහ Arts - දිවයිනේ ප්‍රමුඛතම ආචාර්ය මණ්ඩලය සමඟ Smart Physical AC Theatres සහ 4K Replays.',
    metricBadge: 'All-Island Ranks',
    metricSub: 'Maths · Bio · Tech · Commerce · Arts',
    ctaText: 'Explore A/L Streams',
    ctaLink: '#streams',
    imageCutout: '/hero-stage-al.png',
    fallbackBg: '/hero-campus-bg.jpg',
    themeAccent: '#ef4444',
    badgeIcon: Sparkles
  },
  {
    id: 'degree',
    stageNumber: '04',
    label: 'ඩිප්ලෝමා & උපාධි',
    englishLabel: 'Diplomas & Degrees',
    headlinePrefix: 'BRIDGING TO GLOBAL',
    headlineMain: 'HORIZONS',
    ribbonText: 'STATE & GLOBAL DEGREES',
    sinhalaTag: '04. ඩිප්ලෝමා & ජාත්‍යන්තර උපාධි',
    description: 'A/L වලින් නොනැවතී Direct University Degree Pathways, Higher National Diplomas සහ වෘත්තීය පාඨමාලා හරහා ජාත්‍යන්තර ක්ෂේත්‍රයට.',
    metricBadge: 'UGC & Global Degrees',
    metricSub: 'Direct Career Pathways',
    ctaText: 'Explore Degree Pathways',
    ctaLink: '#streams',
    imageCutout: '/hero-stage-degree.png',
    fallbackBg: '/hero-campus-bg.jpg',
    themeAccent: '#10b981',
    badgeIcon: FileText
  },
  {
    id: 'graduation',
    stageNumber: '05',
    label: 'Grand Convocation',
    englishLabel: 'Annual Graduation Finale',
    headlinePrefix: 'A DAY TO',
    headlineMain: 'REMEMBER',
    ribbonText: 'YOU DESERVE THIS',
    sinhalaTag: '05. උපාධි ප්‍රදානෝත්සවය (The Finale)',
    description: 'Where Sri Lanka’s brightest young minds discover their true academic potential. Annual Convocation celebrating 1,200+ proud graduates.',
    metricBadge: '1,200+ Annual Graduates',
    metricSub: 'Direct University Degrees Awarded',
    ctaText: 'Explore Live Batches',
    ctaLink: '#streams',
    imageCutout: '/hero-students-cutout.png',
    fallbackBg: '/hero-campus-bg.jpg',
    themeAccent: '#f59e0b',
    badgeIcon: GraduationCap
  }
];

export default function HeroJourneySlider({ handleOpenLibraryPortal }) {
  const [currentIdx, setCurrentIdx] = useState(4); // Default to Grand Graduation or start at 0
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const [imageErrorMap, setImageErrorMap] = useState({});
  const timerRef = useRef(null);

  const stage = heroStagesData[currentIdx];

  // Auto-play every 6 seconds
  useEffect(() => {
    if (!isAutoPlay) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % heroStagesData.length);
      setAnimKey((k) => k + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlay]);

  const selectStage = (idx) => {
    setCurrentIdx(idx);
    setAnimKey((k) => k + 1);
  };

  const nextStage = () => {
    setCurrentIdx((prev) => (prev + 1) % heroStagesData.length);
    setAnimKey((k) => k + 1);
  };

  const prevStage = () => {
    setCurrentIdx((prev) => (prev - 1 + heroStagesData.length) % heroStagesData.length);
    setAnimKey((k) => k + 1);
  };

  const handleImageError = (id) => {
    setImageErrorMap((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section
      id="hero"
      className="relative w-full min-h-[640px] sm:min-h-[720px] lg:min-h-[820px] overflow-hidden bg-[#7d0202] flex flex-col justify-between pt-24 pb-6"
      onMouseEnter={() => setIsAutoPlay(false)}
      onMouseLeave={() => setIsAutoPlay(true)}
    >
      {/* LAYER 1: Background Grand Campus & Dynamic Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/hero-campus-bg.jpg"
          alt="IMA Campus Neoclassical Architecture"
          className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#7d0202] via-[#7d0202]/55 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#7d0202] via-[#7d0202]/75 to-transparent w-full md:w-4/5"></div>
      </div>

      {/* TOP: 5-STAGE INTERACTIVE JOURNEY PROGRESS BAR / STEPPER */}
      <div className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
        <div className="bg-black/50 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl flex items-center justify-between gap-2 overflow-x-auto">
          
          <div className="flex items-center gap-1.5 sm:gap-2 w-full">
            {heroStagesData.map((item, idx) => {
              const isActive = currentIdx === idx;
              const IconComp = item.badgeIcon;
              return (
                <button
                  key={item.id}
                  onClick={() => selectStage(idx)}
                  className={`flex-1 min-w-[120px] sm:min-w-0 py-2 px-2.5 sm:px-3 rounded-xl transition-all flex items-center gap-2 text-left cursor-pointer relative overflow-hidden group ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-[1.02]'
                      : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/5'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
                    isActive ? 'bg-slate-950 text-amber-300' : 'bg-white/10 text-white'
                  }`}>
                    {item.stageNumber}
                  </div>
                  
                  <div className="overflow-hidden">
                    <div className="font-sinhala font-bold text-xs sm:text-xs leading-none truncate">
                      {item.label}
                    </div>
                    <div className={`text-[10px] font-mono leading-tight truncate ${
                      isActive ? 'text-slate-900 font-bold' : 'text-white/60'
                    }`}>
                      {item.englishLabel.split(' ')[0]}
                    </div>
                  </div>

                  {/* Active Live Progress Line for current stage */}
                  {isActive && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-950/40">
                      <div
                        className="h-full bg-slate-950 animate-pulse"
                        style={{ width: '100%' }}
                      ></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* LAYER 2: Middle Cutout Student Graphic with Pure CSS Slide-Up Animation */}
      <div className="absolute inset-0 z-10 flex items-end justify-center lg:justify-end pointer-events-none overflow-hidden lg:pr-6">
        <div
          key={animKey}
          className="w-full max-w-5xl animate-hero-student-slide transform translate-x-0 lg:translate-x-12 flex items-end justify-center lg:justify-end"
        >
          {!imageErrorMap[stage.id] ? (
            <img
              src={stage.imageCutout}
              alt={stage.englishLabel}
              onError={() => handleImageError(stage.id)}
              className="w-full max-h-[480px] sm:max-h-[580px] lg:max-h-[660px] object-contain object-bottom drop-shadow-[0_20px_45px_rgba(0,0,0,0.8)]"
            />
          ) : (
            /* Fallback cutout representation when custom PNG is not yet present */
            <div className="w-full max-w-xl max-h-[520px] bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 rounded-3xl border border-amber-400/30 flex flex-col items-center justify-center text-center backdrop-blur-sm mb-8 mr-8">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <GraduationCap size={40} />
              </div>
              <span className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider mb-2">
                Stage {stage.stageNumber} Image Slot
              </span>
              <h4 className="text-xl font-black text-white font-sinhala">{stage.sinhalaTag}</h4>
              <p className="text-xs text-amber-200/80 font-mono mt-1">
                Drop your generated cutout to: <span className="text-white font-bold">{stage.imageCutout}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LAYER 3: Foreground Dynamic Typography, Ribbon & CTAs */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-auto pb-4">
        
        <div key={`text-${animKey}`} className="max-w-xl lg:max-w-2xl space-y-2.5 sm:space-y-3.5 animate-card-entrance">
          
          {/* Stage Sinhala Tag Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-md shadow-lg">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span className="font-sinhala font-extrabold text-amber-300 text-xs sm:text-sm tracking-wide">
              {stage.sinhalaTag}
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-light text-white leading-none tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] uppercase font-serif">
            {stage.headlinePrefix}
          </h2>

          <h1 className="text-5xl sm:text-7xl lg:text-[5.2rem] font-black text-white leading-[0.9] tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)] uppercase">
            {stage.headlineMain}
          </h1>

          {/* Dynamic Ribbon Text */}
          <div className="inline-block transform -rotate-1 hover:rotate-0 transition-transform my-1">
            <div className="bg-[#b30000] text-white px-6 sm:px-8 py-2 rounded-sm shadow-[0_8px_20px_rgba(0,0,0,0.5)] border-l-4 border-amber-400 flex items-center gap-3">
              <span className="text-base sm:text-2xl font-black uppercase tracking-wider text-white">
                {stage.ribbonText}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                {stage.metricBadge}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-white/95 font-medium leading-relaxed max-w-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] pt-1 font-sinhala">
            {stage.description}
          </p>

          {/* CTAs & Pusthakalaya Button */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={stage.ctaLink}
              className="px-6 py-3 rounded-md bg-white hover:bg-slate-100 text-[#7d0202] font-black text-xs uppercase tracking-wider shadow-xl flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
            >
              <span>{stage.ctaText}</span>
              <ArrowRight size={15} />
            </a>

            <button
              onClick={handleOpenLibraryPortal}
              className="px-5 py-3 rounded-md bg-gradient-to-r from-[#5a0101] to-[#7d0202] hover:from-[#7d0202] hover:to-[#990000] text-white font-bold text-xs tracking-wider border border-amber-400/50 flex items-center gap-2 transition-all hover:border-amber-300 shadow-lg cursor-pointer group"
            >
              <img src="/3d-book-portal.png" alt="IMA පුස්තකාලය" className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" />
              <span className="text-amber-300 text-sm font-bold tracking-wide font-sinhala">IMA පුස්තකාලය</span>
            </button>
          </div>

        </div>

        {/* BOTTOM RIGHT: NAVIGATION CONTROLS & STAGE DOTS */}
        <div className="flex items-center justify-between mt-6 pt-3 border-t border-white/10">
          
          <div className="flex items-center gap-2 text-xs font-mono text-white/80">
            <button
              onClick={prevStage}
              className="w-8 h-8 rounded-lg bg-black/40 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
              title="Previous Stage"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextStage}
              className="w-8 h-8 rounded-lg bg-black/40 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
              title="Next Stage"
            >
              <ChevronRight size={16} />
            </button>
            <span className="font-bold text-amber-300 ml-2">
              STAGE {stage.stageNumber} / 05 · {stage.englishLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {heroStagesData.map((_, dotIdx) => (
              <button
                key={dotIdx}
                onClick={() => selectStage(dotIdx)}
                className={`transition-all rounded-full cursor-pointer ${
                  currentIdx === dotIdx
                    ? 'w-6 h-3 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                    : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/80'
                }`}
                title={`Go to Stage ${dotIdx + 1}`}
              />
            ))}
          </div>

        </div>

      </div>

    </section>
  );
}

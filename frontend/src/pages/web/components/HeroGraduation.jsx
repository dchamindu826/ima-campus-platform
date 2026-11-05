import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function HeroGraduation({ handleOpenLibraryPortal }) {
  return (
    <section
      id="hero"
      className="relative w-full min-h-[580px] sm:min-h-[640px] lg:min-h-[700px] xl:min-h-[760px] overflow-hidden bg-[#7d0202] flex items-center pt-24 sm:pt-28 pb-8 sm:pb-12"
    >
      {/* LAYER 1: Background Grand Campus & Dynamic Rich Crimson Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/hero-campus-bg.jpg"
          alt="IMA Campus Neoclassical Architecture"
          className="w-full h-full object-cover object-center transform scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#7d0202] via-[#7d0202]/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#7d0202] via-[#7d0202]/90 md:via-[#7d0202]/70 to-transparent w-full lg:w-4/5"></div>
      </div>

      {/* LAYER 2: Graduated Students Cutout Image - Placed flush at the absolute bottom right */}
      <div className="absolute right-0 bottom-0 z-10 flex items-end justify-end pointer-events-none overflow-hidden select-none">
        <img
          src="/hero-students-cutout.png"
          alt="IMA Campus Proud Graduates"
          className="w-auto h-auto max-h-[480px] sm:max-h-[560px] md:max-h-[620px] lg:max-h-[680px] xl:max-h-[740px] 2xl:max-h-[800px] max-w-[90vw] sm:max-w-[70vw] md:max-w-[60vw] lg:max-w-[55vw] xl:max-w-[52vw] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.85)] animate-hero-student-slide block"
          style={{ verticalAlign: 'bottom', marginBottom: '0px' }}
        />
      </div>

      {/* LAYER 3: Main Left Content Container */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Headline, Ribbon & CTAs */}
        <div className="max-w-xl lg:max-w-2xl xl:max-w-2xl space-y-3 sm:space-y-4 animate-card-entrance text-left">

          {/* Heading */}
          <div>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-light text-white leading-none tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] uppercase font-serif">
              A DAY TO
            </h2>
            <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-black text-white leading-[0.9] tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)] uppercase mt-1">
              REMEMBER
            </h1>
          </div>

          {/* Dynamic Ribbon Text */}
          <div className="inline-block transform -rotate-1 hover:rotate-0 transition-transform my-1">
            <div className="bg-[#b30000] text-white px-7 sm:px-9 py-2.5 sm:py-3 rounded-sm shadow-[0_8px_20px_rgba(0,0,0,0.5)] border-l-4 border-amber-400">
              <span className="text-lg sm:text-2xl lg:text-3xl font-black uppercase tracking-wider text-white">
                YOU DESERVE THIS
              </span>
            </div>
          </div>

          {/* Subtitle Description */}
          <p className="text-xs sm:text-sm lg:text-base text-white/95 font-medium leading-relaxed max-w-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] pt-1">
            Where Sri Lanka’s brightest young minds discover their true academic potential. Annual Convocation celebrating 1,200+ proud graduates.
          </p>

          {/* CTAs & Pusthakalaya Button */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <a
              href="#streams"
              className="px-6 sm:px-7 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-[#7d0202] font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
            >
              <span>EXPLORE LIVE BATCHES</span>
              <ArrowRight size={16} />
            </a>

            <button
              onClick={handleOpenLibraryPortal}
              className="px-5 sm:px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#5a0101] to-[#7d0202] hover:from-[#7d0202] hover:to-[#990000] text-white font-bold text-xs sm:text-sm tracking-wider border border-amber-400/60 flex items-center gap-2.5 transition-all hover:border-amber-300 shadow-xl cursor-pointer group hover:scale-105"
            >
              <img
                src="/3d-book-portal.png"
                alt="IMA පුස්තකාලය"
                className="w-5 h-5 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_2px_6px_rgba(251,191,36,0.6)]"
              />
              <span className="text-amber-300 font-bold tracking-wide font-sinhala">IMA පුස්තකාලය</span>
            </button>
          </div>

        </div>

      </div>

    </section>
  );
}

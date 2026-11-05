import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, Star, Users, BookOpen, CheckCircle2 } from 'lucide-react';
import heroImg from '../../assets/hero.png'; // ඔයාගේ assets ෆෝල්ඩර් එකේ තියෙන පින්තූරෙ

export default function Hero() {
  return (
    <div className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-slate-50">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]"></div>
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px]"></div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-12">
        
        {/* Left Content */}
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/50 border border-blue-200 text-blue-700 text-xs font-bold mb-6">
            <Star size={14} className="fill-blue-600" /> Sri Lanka's #1 Leading Campus
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] mb-6">
            Discover the <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-400">New Universe</span> <br/>
            of Education
          </h1>
          
          <p className="text-slate-600 text-lg mb-10 max-w-xl leading-relaxed">
            Empowering students with modern learning techniques, expert educators, and a vibrant learning community. Your journey to success starts right here.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center lg:justify-start">
            <Link to="/register" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-600/20 group">
              Start Learning Now <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/courses" className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
              <PlayCircle size={18} className="text-blue-600" /> View Courses
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 mt-12 pt-8 border-t border-slate-200/60 w-full justify-center lg:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Users size={24} />
              </div>
              <div className="text-left">
                <h4 className="text-2xl font-black text-slate-800">1500+</h4>
                <p className="text-xs text-slate-500 font-bold uppercase">Active Students</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <BookOpen size={24} />
              </div>
              <div className="text-left">
                <h4 className="text-2xl font-black text-slate-800">50+</h4>
                <p className="text-xs text-slate-500 font-bold uppercase">Premium Courses</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Image */}
        <div className="w-full lg:w-1/2 relative">
          <div className="relative z-10 animate-fade-in-up">
            <img src={heroImg} alt="Students Learning" className="w-full h-auto drop-shadow-2xl" />
          </div>
          {/* Floating Badges */}
          <div className="absolute top-10 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 z-20 flex items-center gap-3 animate-bounce-slow">
            <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 size={20}/></div>
            <div>
              <p className="text-xs text-slate-500 font-bold">Success Rate</p>
              <p className="text-sm font-black text-slate-800">98.5%</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
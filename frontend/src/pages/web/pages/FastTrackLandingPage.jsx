import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  Zap, 
  GraduationCap, 
  BookOpen, 
  Clock, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Receipt,
  X
} from 'lucide-react';

export default function FastTrackLandingPage() {
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  return (
    <div className="min-h-screen bg-[#060c18] text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Meta Verification Notice Bar */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/30 py-2.5 px-4 text-xs font-medium text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
              OFFICIAL CORPORATE PORTAL
            </span>
            <span className="text-slate-300 font-semibold">
              IMA FAST TRACK (PVT) LTD
            </span>
            <span className="hidden md:inline px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-300 font-mono">
              TIN: 228744492
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-amber-400" />
              Malabe 10115, Sri Lanka
            </span>
            <span className="hidden md:inline">|</span>
            <a href="tel:0767845326" className="flex items-center gap-1 text-slate-300 hover:text-white transition">
              <Phone size={12} className="text-amber-400" />
              076 784 5326
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-[#060c18]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img 
              src="/logo.png" 
              alt="IMA Fast Track Logo" 
              className="h-11 w-auto object-contain bg-white/5 p-1 rounded-xl border border-white/10" 
            />
            <div>
              <div className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                <span>IMA</span>
                <span className="text-amber-400">FAST TRACK</span>
              </div>
              <div className="text-[11px] text-slate-400 tracking-wider font-semibold uppercase">
                (PVT) LTD • Accelerated Education & Examination Systems
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#about" className="hover:text-white transition">Corporate Overview</a>
            <a href="#credentials" className="hover:text-white transition">Tax & Legal Compliance</a>
            <a href="#streams" className="hover:text-white transition">Fast Track Streams</a>
            <a href="#contact" className="hover:text-white transition">Contact Us</a>
          </nav>

          <div className="flex items-center gap-3">
            <a 
              href="tel:0767845326"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <Phone size={14} className="text-amber-400" />
              <span>076 784 5326</span>
            </a>
            <a 
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-900/30 transition transform active:scale-95"
            >
              Contact Office
              <ChevronRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-amber-500/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-[300px] h-[250px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-6">
              <Zap size={14} className="text-amber-400" />
              SRI LANKA'S LEADING ACCELERATED ACADEMIC SYSTEM
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Accelerating Academic Success Through{' '}
              <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-100 bg-clip-text text-transparent">
                High-Performance Fast Track Systems.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8">
              <strong className="text-white font-semibold">IMA FAST TRACK (PVT) LTD</strong> is a legally registered educational powerhouse in Sri Lanka dedicated to providing high-speed revision programs, structured model paper masterclasses, and intensive exam preparation for Advanced Level and Ordinary Level students nationwide under the IMA Campus network.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a 
                href="#credentials"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-900/30 transition transform hover:-translate-y-0.5"
              >
                <ShieldCheck size={16} />
                Tax & Legal Credentials
              </a>
              <a 
                href="#streams"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition"
              >
                <GraduationCap size={16} className="text-amber-400" />
                Explore Fast Track Batches
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Official Corporate Verification Card (Primary Meta Review Section) */}
      <section id="credentials" className="py-16 bg-slate-950/60 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900 rounded-3xl p-8 sm:p-10 lg:p-12 border border-amber-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 pb-8 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                  <ShieldCheck size={16} />
                  Corporate Identity & Tax Registration
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  IMA FAST TRACK (PVT) LTD
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Registered Private Limited Company in Sri Lanka • Official Tax Invoice & Telecommunication Subscriber: Dialog Axiata PLC
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono">
                  <Receipt size={16} />
                  TIN: 228744492
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 size={16} />
                  Officially Registered Entity
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Legal Name */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-amber-400" />
                  Legal Business Name
                </div>
                <div className="text-white font-bold text-sm sm:text-base leading-snug">
                  IMA FAST TRACK (PVT) LTD
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Exact Match to Tax & Registration Records
                </div>
              </div>

              {/* Registered Address */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <MapPin size={14} className="text-amber-400" />
                  Registered Corporate Address
                </div>
                <div className="text-white font-bold text-sm leading-snug">
                  NO. 346/A, ROBERT GUNAWARDANE MAWATHA, MALABE, 10115
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Western Province, Sri Lanka
                </div>
              </div>

              {/* Primary Contact Telephone */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Phone size={14} className="text-amber-400" />
                  Official Account & Mobile Line
                </div>
                <div className="text-white font-bold text-base">
                  <a href="tel:0767845326" className="hover:text-amber-400 transition">
                    +94 76 784 5326
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Direct Dialog Enterprise Mobile Line
                </div>
              </div>

              {/* Official Domain & Email */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Mail size={14} className="text-amber-400" />
                  Corporate Communication
                </div>
                <div className="text-white font-bold text-sm truncate">
                  <a href="mailto:info@imacampus.online" className="hover:text-amber-400 transition">
                    info@imacampus.online
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Domain: fasttrack.imacampus.online
                </div>
              </div>
            </div>

            {/* Additional Registered Voice Lines */}
            <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-300">Fast Track Student Hotline:</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-mono">071 220 90 30</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">076 784 5326</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles size={14} className="text-amber-400" />
                <span>Premier Division of the IMA Campus Educational Network</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Accelerated Education Pioneers
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-6">
                Revolutionizing Sri Lankan Examination Prep with Precision & Speed
              </h2>
              <div className="space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed">
                <p>
                  <strong>IMA FAST TRACK (PVT) LTD</strong> was established to give Sri Lankan secondary and high school students a decisive competitive edge. We specialize in fast-track modular revision, high-yield past paper analyses, and rapid subject mastery.
                </p>
                <p>
                  Through an integrated hybrid delivery model — combining state-of-the-art physical seminar halls in Malabe with nationwide digital live streaming — our programs have supported tens of thousands of candidates to achieve top island ranks.
                </p>
                <p>
                  Operating with complete transparency, valid tax compliance (TIN: 228744492), and direct enterprise infrastructure from Sri Lanka's leading telcos, we ensure an uninterrupted educational service for parents, educators, and candidates.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-2xl font-black text-amber-400">Top Ranks</div>
                  <div className="text-xs text-slate-400 mt-1">National Island & District Ranks</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-2xl font-black text-amber-400">25 Districts</div>
                  <div className="text-xs text-slate-400 mt-1">Islandwide Digital Student Reach</div>
                </div>
              </div>
            </div>

            {/* Core Fast Track Pillars */}
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Targeted Paper Marking & Evaluation</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Structured marking schemes matching national examination guidelines with individualized feedback on student answer scripts.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Modular Fast Track Revision Sprints</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Concentrated 8-to-12 week intensive syllabi coverage designed to convert core concepts into automatic exam-time recall.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Direct Postal & Express Tute Delivery</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Printed tutorial packages and examination papers delivered right to students' doorsteps via automated logistics tracking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Streams Section */}
      <section id="streams" className="py-20 bg-slate-950/70 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Academic Streams & Focus
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Fast Track Examination Batches
            </h2>
            <p className="text-slate-400 text-sm mt-3">
              Specialized accelerator programs conducted by prominent national lecturers and education specialists.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-amber-500/40 transition">
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Science & Mathematics</div>
                <h3 className="text-xl font-bold text-white mb-3">A/L Physical & Biological Science Fast Track</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  Intensive revision for Combined Mathematics, Physics, Chemistry, and Biology with past 20 years paper decomposition.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Format: Hybrid Seminars</span>
                <span className="text-amber-400 font-semibold">Weekly Model Tests</span>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-amber-500/40 transition">
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Commerce & Economics</div>
                <h3 className="text-xl font-bold text-white mb-3">A/L Commerce Stream Accelerator</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  High-speed problem solving in Accounting, Business Studies, and Economics with real-time financial problem frameworks.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Format: Live Online & Campus</span>
                <span className="text-blue-400 font-semibold">Structured Tutes</span>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-amber-500/40 transition">
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Technology & Arts</div>
                <h3 className="text-xl font-bold text-white mb-3">A/L Technology & Arts Rapid Modules</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  Engineering Tech, Biosystems Tech, and SFT alongside Sinhala, Media, and Logic modules structured for rapid learning.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Format: Interactive Masterclasses</span>
                <span className="text-emerald-400 font-semibold">Model Evaluations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Official Inquiries & Coordination
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
                Contact the Fast Track Administration
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                For class enrollments, institutional verifications, or student administration inquiries, reach out to our dedicated campus desk in Malabe.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Corporate & Registered Office</div>
                    <div className="text-white font-bold text-sm sm:text-base">
                      IMA FAST TRACK (PVT) LTD
                    </div>
                    <div className="text-slate-300 text-xs sm:text-sm">
                      No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    <Phone size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Official Mobile & Hotlines</div>
                    <div className="text-white font-bold text-sm sm:text-base flex flex-col gap-1">
                      <a href="tel:0767845326" className="hover:text-amber-400 transition">076 784 5326 (Direct Account Line)</a>
                      <a href="tel:0712209030" className="hover:text-amber-400 transition text-sm text-slate-300">071 220 90 30 (Fast Track Hotline)</a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    <Mail size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Official Electronic Mail</div>
                    <div className="text-white font-bold text-sm sm:text-base">
                      <a href="mailto:info@imacampus.online" className="hover:text-amber-400 transition">
                        info@imacampus.online
                      </a>
                    </div>
                    <div className="text-slate-400 text-xs">
                      Official Portal: fasttrack.imacampus.online
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Tax Identification Number</div>
                    <div className="text-white font-bold text-sm font-mono">
                      TIN: 228744492
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inquiries Form Box */}
            <div className="bg-slate-900/90 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-2">Send an Inquiry</h3>
              <p className="text-slate-400 text-xs mb-6">
                Direct inquiry routed to the desk of IMA FAST TRACK (PVT) LTD.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); alert('Inquiry received. The Fast Track team will contact you.'); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Nimal Fernando" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="name@example.com" 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="07x xxx xxxx" 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Batch / Stream</label>
                  <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400">
                    <option>A/L Combined Mathematics / Science</option>
                    <option>A/L Commerce & Economics</option>
                    <option>A/L Technology Stream</option>
                    <option>A/L Arts & Media</option>
                    <option>Institutional Verification & TIN Inquiries</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Message</label>
                  <textarea 
                    rows={4} 
                    required 
                    placeholder="Enter your inquiry or request details..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-950"
                >
                  Submit Inquiry
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Footer (Meta Compliant) */}
      <footer className="bg-black border-t border-slate-800 text-slate-400 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12 text-xs">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="h-9 w-auto" />
                <span className="text-base font-black text-white">IMA FAST TRACK (PVT) LTD</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Registered corporate educational entity providing accelerated curricula, paper masterclasses, and examination systems across Sri Lanka.
                Operating in full harmony with the IMA Campus Group.
              </p>
              <div className="text-slate-400 space-y-1">
                <p><strong className="text-slate-300">Registered Office:</strong> No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka</p>
                <p><strong className="text-slate-300">TIN:</strong> 228744492</p>
                <p><strong className="text-slate-300">Official Mobile:</strong> +94 76 784 5326 / 071 220 9030</p>
                <p><strong className="text-slate-300">Email:</strong> info@imacampus.online</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Legal & Governance</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveModal('privacy')} className="hover:text-amber-400 transition text-left">
                    Privacy Policy & Student Data
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('terms')} className="hover:text-amber-400 transition text-left">
                    Terms of Corporate Service
                  </button>
                </li>
                <li>
                  <a href="#credentials" className="hover:text-amber-400 transition">
                    Tax & Legal Credentials
                  </a>
                </li>
                <li>
                  <a href="https://imacampus.online" className="hover:text-amber-400 transition inline-flex items-center gap-1">
                    IMA Campus Main Portal <ExternalLink size={11} />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Academic Streams</h4>
              <ul className="space-y-2">
                <li>Combined Maths & Science Fast Track</li>
                <li>Commerce & Accounting Accelerator</li>
                <li>Technology Stream Masterclasses</li>
                <li>Ordinary Level Speed Preparations</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} <strong className="text-slate-400">IMA FAST TRACK (PVT) LTD</strong>. All Rights Reserved. (TIN: 228744492)
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Official Web Domain: <strong>fasttrack.imacampus.online</strong></span>
            </p>
          </div>
        </div>
      </footer>

      {/* Legal & Policy Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c1424] border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[85vh] overflow-y-auto text-slate-300 text-xs sm:text-sm relative">
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <X size={18} />
            </button>

            {activeModal === 'privacy' ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="text-amber-400" />
                  Privacy Policy & Student Data Protection
                </h3>
                <p className="text-slate-400 text-xs">
                  Effective Date: January 1, 2026 • Legal Entity: IMA FAST TRACK (PVT) LTD (TIN: 228744492)
                </p>
                <div className="space-y-3 leading-relaxed">
                  <p>
                    <strong>IMA FAST TRACK (PVT) LTD</strong> ("the Company", "we", "our", or "us"), located at No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka, operates the web portal <code>fasttrack.imacampus.online</code>. This policy defines how we safeguard user data collected through our accelerated academic services.
                  </p>
                  <h4 className="font-bold text-white text-sm">1. Collection of Data</h4>
                  <p>
                    Information including full names, contact mobile numbers, postal shipping addresses for examination materials, and evaluation performance records are collected exclusively to facilitate educational delivery, paper distribution, and student communication.
                  </p>
                  <h4 className="font-bold text-white text-sm">2. Information Protection</h4>
                  <p>
                    We apply strict organizational and technical measures, including SSL cryptographic protocols, isolated database clusters, and credential controls, ensuring no unauthorized parties access student or corporate data.
                  </p>
                  <h4 className="font-bold text-white text-sm">3. Corporate Contact</h4>
                  <p>
                    For queries regarding data privacy and corporate compliance:
                    <br />
                    <strong>IMA FAST TRACK (PVT) LTD</strong>
                    <br />
                    No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka.
                    <br />
                    Telephone: +94 76 784 5326 | Hotline: 071 220 9030 | Email: info@imacampus.online
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <FileText className="text-amber-400" />
                  Terms of Corporate Service
                </h3>
                <p className="text-slate-400 text-xs">
                  Legal Entity: IMA FAST TRACK (PVT) LTD (TIN: 228744492)
                </p>
                <div className="space-y-3 leading-relaxed">
                  <p>
                    By enrolling in any program or utilizing <code>fasttrack.imacampus.online</code>, you agree to these legal conditions under the laws of Sri Lanka.
                  </p>
                  <h4 className="font-bold text-white text-sm">1. Course Deliverables & Proprietary Models</h4>
                  <p>
                    All mock examination papers, speed learning algorithms, question schemes, and study materials are the exclusive proprietary property of IMA FAST TRACK (PVT) LTD. Unauthorized duplication or commercial reselling is strictly prohibited under the Intellectual Property Act of Sri Lanka.
                  </p>
                  <h4 className="font-bold text-white text-sm">2. Governing Law</h4>
                  <p>
                    These terms are governed by the laws of Sri Lanka and subject to the exclusive jurisdiction of the Sri Lankan courts.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 text-right">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition"
              >
                Close Disclosure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

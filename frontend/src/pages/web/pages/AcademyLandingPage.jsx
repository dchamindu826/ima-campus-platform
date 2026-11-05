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
  Award, 
  Tv, 
  Video, 
  Radio, 
  Camera, 
  BookOpen, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';

export default function AcademyLandingPage() {
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | null

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-red-500 selection:text-white">
      {/* Top Meta Verification Notice Bar */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b border-red-500/30 py-2.5 px-4 text-xs font-medium text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
              OFFICIAL CORPORATE PORTAL
            </span>
            <span className="text-slate-300 font-semibold">
              IDDAMALGODA MEDIA ACADEMY (PVT) LTD
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-red-400" />
              Malabe 10115, Sri Lanka
            </span>
            <span className="hidden md:inline">|</span>
            <a href="tel:0112177872" className="flex items-center gap-1 text-slate-300 hover:text-white transition">
              <Phone size={12} className="text-red-400" />
              011 217 7872
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-[#070b14]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img 
              src="/logo.png" 
              alt="Iddamalgoda Media Academy Logo" 
              className="h-11 w-auto object-contain bg-white/5 p-1 rounded-xl border border-white/10" 
            />
            <div>
              <div className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                <span>IDDAMALGODA</span>
                <span className="text-red-500">MEDIA ACADEMY</span>
              </div>
              <div className="text-[11px] text-slate-400 tracking-wider font-semibold uppercase">
                (PVT) LTD • Higher Education & Creative Media
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#about" className="hover:text-white transition">About Corporate</a>
            <a href="#credentials" className="hover:text-white transition">Legal & Compliance</a>
            <a href="#programs" className="hover:text-white transition">Media Programs</a>
            <a href="#contact" className="hover:text-white transition">Contact Us</a>
          </nav>

          <div className="flex items-center gap-3">
            <a 
              href="tel:0112177872"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <Phone size={14} className="text-red-400" />
              <span>011 217 7872</span>
            </a>
            <a 
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/40 transition transform active:scale-95"
            >
              Get In Touch
              <ChevronRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-red-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[250px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold mb-6">
              <ShieldCheck size={14} className="text-red-400" />
              REGISTERED PRIVATE LIMITED ENTITY IN SRI LANKA
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Empowering Sri Lanka's Next-Gen{' '}
              <span className="bg-gradient-to-r from-red-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
                Media & Digital Creators.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8">
              <strong className="text-white font-semibold">IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> is a premier creative media institution and higher education academy established in Malabe, Sri Lanka. We deliver industry-accredited training in television broadcasting, film production, digital journalism, and multi-media technologies under the renowned IMA Campus umbrella.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a 
                href="#credentials"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 shadow-xl shadow-red-900/30 transition transform hover:-translate-y-0.5"
              >
                <Building2 size={16} />
                Corporate Credentials
              </a>
              <a 
                href="#programs"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition"
              >
                <BookOpen size={16} className="text-red-400" />
                View Media Faculties
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Official Corporate Verification Card (Primary Meta Review Section) */}
      <section id="credentials" className="py-16 bg-slate-950/60 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900 rounded-3xl p-8 sm:p-10 lg:p-12 border border-red-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 pb-8 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                  <ShieldCheck size={16} />
                  Corporate Identity & Official Business Information
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  IDDAMALGODA MEDIA ACADEMY (PVT) LTD
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Registered under the Companies Act of Sri Lanka • Official Enterprise Subscriber: Sri Lanka Telecom PLC
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold self-start lg:self-center">
                <CheckCircle2 size={16} />
                Officially Verified Business Entity
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Legal Name */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-red-400" />
                  Legal Business Name
                </div>
                <div className="text-white font-bold text-sm sm:text-base leading-snug">
                  IDDAMALGODA MEDIA ACADEMY (PVT) LTD
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Exact Match to Registration Certificate
                </div>
              </div>

              {/* Registered Address */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <MapPin size={14} className="text-red-400" />
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
                  <Phone size={14} className="text-red-400" />
                  Official Enterprise Line
                </div>
                <div className="text-white font-bold text-base">
                  <a href="tel:0112177872" className="hover:text-red-400 transition">
                    +94 11 217 7872
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  SLT Mobitel Enterprise Subscriber Line
                </div>
              </div>

              {/* Official Domain & Email */}
              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800">
                <div className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Mail size={14} className="text-red-400" />
                  Corporate Communication
                </div>
                <div className="text-white font-bold text-sm truncate">
                  <a href="mailto:info@imacampus.online" className="hover:text-red-400 transition">
                    info@imacampus.online
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Domain: academy.imacampus.online
                </div>
              </div>
            </div>

            {/* Additional Registered Voice Lines */}
            <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-300">Direct Enterprise Voice Lines:</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">011 217 7872</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">011 251 1172</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">011 277 7992</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles size={14} className="text-amber-400" />
                <span>Operating under the prestigious IMA Campus Educational Network</span>
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
              <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                About Iddamalgoda Media Academy
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-6">
                Leading the Transformation of Media Arts & Broadcasting in South Asia
              </h2>
              <div className="space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed">
                <p>
                  Founded to address the modern demands of Sri Lanka's creative and broadcast sectors, 
                  <strong> IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> combines rigorous academic theory with cutting-edge hands-on media production.
                </p>
                <p>
                  From full HD live broadcast studios to advanced post-production labs equipped with enterprise-grade connectivity, our academy nurtures media directors, cinematographers, investigative journalists, and digital content entrepreneurs.
                </p>
                <p>
                  As an integral corporate institution within the <strong>IMA Campus Group</strong>, we maintain full compliance with Sri Lankan educational and corporate statutes, upholding the highest standards of student support, integrity, and transparency.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-2xl font-black text-white">Full HD</div>
                  <div className="text-xs text-slate-400 mt-1">Multi-Camera Production Studio</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-2xl font-black text-white">Enterprise</div>
                  <div className="text-xs text-slate-400 mt-1">High-Speed Fibre & Audio Lab</div>
                </div>
              </div>
            </div>

            {/* Visual Feature Showcase */}
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-red-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
                    <Tv size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Television & Broadcast Journalism</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Real-world newsroom training, live anchoring, teleprompter workflows, and field reporting under veteran media practitioners.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-red-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                    <Video size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Cinematography & Post-Production Lab</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Color grading, DaVinci Resolve workflows, visual effects (VFX), and multi-camera direction for cinema and OTT platforms.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-red-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                    <Radio size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Audio Engineering & Sound Design</h3>
                    <p className="text-slate-400 text-xs sm:text-sm">
                      Acoustic studio recording, podcast production, voice acting, and surround sound mastering for digital broadcasting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media Academic Faculties */}
      <section id="programs" className="py-20 bg-slate-950/70 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
              Curriculum & Programs
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Professional Media Programs
            </h2>
            <p className="text-slate-400 text-sm mt-3">
              Comprehensive diplomas and executive certificates designed in collaboration with leading media networks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-red-500/40 transition">
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Faculty of Media</div>
                <h3 className="text-xl font-bold text-white mb-3">Diploma in Broadcast Media & Journalism</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  Covers investigative reporting, media ethics, studio broadcasting, digital podcasting, and media law in Sri Lanka.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Duration: 12 Months</span>
                <span className="text-red-400 font-semibold">Weekend / Weekday</span>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-red-500/40 transition">
              <div>
                <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Faculty of Cinema & Arts</div>
                <h3 className="text-xl font-bold text-white mb-3">Higher Diploma in Film & Video Direction</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  Intensive screenwriting, camera operation, cinematic lighting, non-linear editing, and commercial ad film production.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Duration: 18 Months</span>
                <span className="text-rose-400 font-semibold">Practical Intensive</span>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 flex flex-col justify-between hover:border-red-500/40 transition">
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Faculty of Digital Tech</div>
                <h3 className="text-xl font-bold text-white mb-3">Certificate in Digital Media Marketing & Motion Graphics</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                  Focuses on Adobe After Effects, 3D motion design, viral social video marketing, content algorithms, and brand storytelling.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Duration: 6 Months</span>
                <span className="text-amber-400 font-semibold">Hybrid Mode</span>
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
              <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                Official Inquiries & Campus Visit
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
                Connect with the Administration
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                For student enrollments, institutional verifications, or corporate media partnerships, please contact the academy administration office located in Malabe.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Physical Campus & Registered Office</div>
                    <div className="text-white font-bold text-sm sm:text-base">
                      IDDAMALGODA MEDIA ACADEMY (PVT) LTD
                    </div>
                    <div className="text-slate-300 text-xs sm:text-sm">
                      No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                    <Phone size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Enterprise Phone Numbers</div>
                    <div className="text-white font-bold text-sm sm:text-base flex flex-col gap-1">
                      <a href="tel:0112177872" className="hover:text-red-400 transition">011 217 7872 (Main Office)</a>
                      <a href="tel:0112511172" className="hover:text-red-400 transition text-sm text-slate-300">011 251 1172 / 011 277 7992</a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                    <Mail size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Official Electronic Mail</div>
                    <div className="text-white font-bold text-sm sm:text-base">
                      <a href="mailto:info@imacampus.online" className="hover:text-red-400 transition">
                        info@imacampus.online
                      </a>
                    </div>
                    <div className="text-slate-400 text-xs">
                      Official Portal: academy.imacampus.online
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Operational Hours</div>
                    <div className="text-white font-bold text-xs sm:text-sm">
                      Monday to Saturday: 8:30 AM – 5:30 PM (IST)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inquiries Form Box */}
            <div className="bg-slate-900/90 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-2">Send an Official Inquiry</h3>
              <p className="text-slate-400 text-xs mb-6">
                Direct inquiry dispatched to the administration of IDDAMALGODA MEDIA ACADEMY (PVT) LTD.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); alert('Inquiry received. The administration will contact you.'); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Kasun Perera" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="name@example.com" 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="07x xxx xxxx" 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject / Department</label>
                  <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500">
                    <option>General Corporate Inquiries</option>
                    <option>Faculty of Broadcast Journalism</option>
                    <option>Faculty of Cinema & Direction</option>
                    <option>Faculty of Audio Engineering</option>
                    <option>Business & Institutional Verification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Message</label>
                  <textarea 
                    rows={4} 
                    required 
                    placeholder="Please specify your inquiry details..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 transition shadow-lg shadow-red-950"
                >
                  Submit Official Inquiry
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
                <span className="text-base font-black text-white">IDDAMALGODA MEDIA ACADEMY (PVT) LTD</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Registered higher educational and media production corporate entity operating in Sri Lanka.
                Member of the IMA Campus educational conglomerate.
              </p>
              <div className="text-slate-400 space-y-1">
                <p><strong className="text-slate-300">Registered Office:</strong> No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka</p>
                <p><strong className="text-slate-300">Enterprise Tel:</strong> +94 11 217 7872 / 011 251 1172</p>
                <p><strong className="text-slate-300">Email:</strong> info@imacampus.online</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Legal & Governance</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveModal('privacy')} className="hover:text-red-400 transition text-left">
                    Privacy Policy & Data Security
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveModal('terms')} className="hover:text-red-400 transition text-left">
                    Terms of Corporate Service
                  </button>
                </li>
                <li>
                  <a href="#credentials" className="hover:text-red-400 transition">
                    Corporate Compliance Info
                  </a>
                </li>
                <li>
                  <a href="https://imacampus.online" className="hover:text-red-400 transition inline-flex items-center gap-1">
                    IMA Campus Network <ExternalLink size={11} />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-3">Academic Streams</h4>
              <ul className="space-y-2">
                <li>Television Broadcasting</li>
                <li>Cinematography & VFX</li>
                <li>Audio Engineering & Acoustics</li>
                <li>Digital Content Creation</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} <strong className="text-slate-400">IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong>. All Rights Reserved.
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Official Web Domain: <strong>academy.imacampus.online</strong></span>
            </p>
          </div>
        </div>
      </footer>

      {/* Legal & Policy Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0b1120] border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[85vh] overflow-y-auto text-slate-300 text-xs sm:text-sm relative">
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <X size={18} />
            </button>

            {activeModal === 'privacy' ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="text-red-500" />
                  Privacy Policy & Data Protection
                </h3>
                <p className="text-slate-400 text-xs">
                  Effective Date: January 1, 2026 • Legal Entity: IDDAMALGODA MEDIA ACADEMY (PVT) LTD
                </p>
                <div className="space-y-3 leading-relaxed">
                  <p>
                    <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> ("the Company", "we", "our", or "us"), located at No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka, operates the website <code>academy.imacampus.online</code>. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you interact with our educational services.
                  </p>
                  <h4 className="font-bold text-white text-sm">1. Information Collection and Use</h4>
                  <p>
                    We collect essential information including full legal name, telephone contact number, email address, and academic qualifications solely for course admission, identity verification, examination processing, and administrative communications.
                  </p>
                  <h4 className="font-bold text-white text-sm">2. Security of Data</h4>
                  <p>
                    The security of your data is paramount. We employ industry-standard SSL encryption, secure relational database storage, and strict administrative access controls to safeguard your personal information against unauthorized disclosure or alteration.
                  </p>
                  <h4 className="font-bold text-white text-sm">3. Corporate Entity Contact</h4>
                  <p>
                    For inquiries regarding this Privacy Policy, please contact our Data Protection Officer at:
                    <br />
                    <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong>
                    <br />
                    No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka.
                    <br />
                    Telephone: +94 11 217 7872 | Email: info@imacampus.online
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <FileText className="text-red-500" />
                  Terms of Corporate Service
                </h3>
                <p className="text-slate-400 text-xs">
                  Legal Entity: IDDAMALGODA MEDIA ACADEMY (PVT) LTD
                </p>
                <div className="space-y-3 leading-relaxed">
                  <p>
                    By accessing or utilizing the digital portals of <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> (including <code>academy.imacampus.online</code>), you acknowledge and agree to comply with all applicable laws of the Democratic Socialist Republic of Sri Lanka and these terms.
                  </p>
                  <h4 className="font-bold text-white text-sm">1. Course Deliverables & Intellectual Property</h4>
                  <p>
                    All broadcast materials, curriculum guides, media lectures, and syllabus documentation are the exclusive intellectual property of IDDAMALGODA MEDIA ACADEMY (PVT) LTD. Unauthorized duplication, redistribution, or broadcast is strictly prohibited.
                  </p>
                  <h4 className="font-bold text-white text-sm">2. Jurisdiction</h4>
                  <p>
                    These terms are governed by and construed in accordance with the laws of Sri Lanka. Any disputes shall be subject to the exclusive jurisdiction of the competent courts of Sri Lanka.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 text-right">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition"
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

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { 
    Phone, 
    Mail, 
    MapPin, 
    Globe,
    Clock, 
    Send, 
    Check, 
    Copy, 
    ExternalLink, 
    Sparkles, 
    Scale, 
    Timer, 
    Palette, 
    BookOpen, 
    Briefcase, 
    Cpu 
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function ContactUs() {
    const [copiedNumber, setCopiedNumber] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        department: 'General Inquiries',
        message: ''
    });

    const departmentHotlines = [
        {
            id: 'ol',
            name: 'IMA O/L',
            pillText: 'IMA O/L',
            badgeBg: 'bg-[#064e3b]',
            pillBg: 'from-[#064e3b] to-[#047857]',
            accentBorder: 'border-emerald-500/40',
            badgeTextColor: 'text-emerald-300',
            number: '077 428 90 30',
            rawNumber: '0774289030',
            waNumber: '94774289030',
            icon: BookOpen,
            description: 'Ordinary Level subjects & foundation batches'
        },
        {
            id: 'art',
            name: 'IMA ART',
            pillText: 'IMA ART',
            badgeBg: 'bg-[#6b21a8]',
            pillBg: 'from-[#6b21a8] to-[#9333ea]',
            accentBorder: 'border-purple-500/40',
            badgeTextColor: 'text-purple-300',
            number: '076 625 90 30',
            rawNumber: '0766259030',
            waNumber: '94766259030',
            icon: Palette,
            description: 'Advanced Level Arts stream & humanities'
        },
        {
            id: 'commerce',
            name: 'IMA COMMERCE',
            pillText: 'IMA COMMERCE',
            badgeBg: 'bg-[#1d4ed8]',
            pillBg: 'from-[#1d4ed8] to-[#2563eb]',
            accentBorder: 'border-blue-500/40',
            badgeTextColor: 'text-blue-300',
            number: '077 207 90 30',
            rawNumber: '0772079030',
            waNumber: '94772079030',
            icon: Briefcase,
            description: 'A/L Commerce, Accounting & Business Studies'
        },
        {
            id: 'tech',
            name: 'IMA TECH',
            pillText: 'IMA TECH',
            badgeBg: 'bg-[#ea580c]',
            pillBg: 'from-[#ea580c] to-[#f97316]',
            accentBorder: 'border-orange-500/40',
            badgeTextColor: 'text-orange-300',
            number: '077 334 50 60',
            rawNumber: '0773345060',
            waNumber: '94773345060',
            icon: Cpu,
            description: 'Technology stream (Engineering, Bio Tech & ICT)'
        },
        {
            id: 'fast-track',
            name: 'FAST TRACK',
            pillText: 'FAST TRACK',
            badgeBg: 'bg-[#dc2626]',
            pillBg: 'from-[#dc2626] to-[#ef4444]',
            accentBorder: 'border-red-500/40',
            badgeTextColor: 'text-red-300',
            number: '071 220 90 30',
            rawNumber: '0712209030',
            waNumber: '94712209030',
            icon: Timer,
            description: 'Accelerated revision, paper classes & speed programs'
        },
        {
            id: 'law',
            name: 'IMA LAW SCHOOL',
            pillText: 'IMA LAW SCHOOL',
            badgeBg: 'bg-[#0f172a]',
            pillBg: 'from-[#0f172a] to-[#1e293b]',
            accentBorder: 'border-amber-400/40',
            badgeTextColor: 'text-amber-300',
            number: '070 7 678 561',
            rawNumber: '0707678561',
            waNumber: '94707678561',
            icon: Scale,
            description: 'Sri Lanka Law College entrance & LL.B guidance'
        }
    ];

    const copyToClipboard = (num, label) => {
        navigator.clipboard.writeText(num.replace(/\s+/g, ''));
        setCopiedNumber(label);
        toast.success(`${label} number copied to clipboard!`, {
            style: {
                background: '#0d1322',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)'
            }
        });
        setTimeout(() => setCopiedNumber(null), 2500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            toast.success('Thank you! Your message has been received. Our team will contact you shortly.', {
                duration: 4000,
                style: {
                    background: '#0d1322',
                    color: '#fff',
                    border: '1px solid #10b981'
                }
            });
            setFormData({
                name: '',
                email: '',
                phone: '',
                department: 'General Inquiries',
                message: ''
            });
        }, 1000);
    };

    return (
        <div className="bg-[#070b14] min-h-screen text-white pt-28 pb-24 px-4 sm:px-6 lg:px-8 selection:bg-red-500 selection:text-white">
            <Navbar />

            {/* Background Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-1/4 -left-48 w-96 h-96 bg-red-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-1/2 -right-48 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto space-y-12">
                
                {/* Header Banner */}
                <div className="text-center max-w-3xl mx-auto space-y-4 pt-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-black uppercase tracking-widest shadow-sm">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Official Campus Contact Center</span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight">
                        Get In Touch With <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500">IMA Campus</span>
                    </h1>

                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                        Connect directly with our dedicated stream coordinators, admissions counselors, or visit our Malabe campus for personal academic counseling.
                    </p>
                </div>

                {/* ========================================================
                    OFFICIAL NEW NUMBERS / DEPARTMENT HOTLINES SHOWCASE
                ======================================================== */}
                <div className="rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Section Title with Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-white/10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span>Active Department Hotlines</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Official Department Numbers
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                Call or message on WhatsApp directly to reach your department coordinator.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl w-fit">
                            <Clock size={14} className="text-amber-400" />
                            <span>Lines Open: 8:00 AM – 6:00 PM Daily</span>
                        </div>
                    </div>

                    {/* Grid of 6 Department Hotlines */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-8">
                        {departmentHotlines.map((dept) => {
                            const IconComponent = dept.icon;
                            const isCopied = copiedNumber === dept.name;

                            return (
                                <div
                                    key={dept.id}
                                    className="group relative bg-[#0b101d] rounded-2xl border border-white/10 hover:border-white/25 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
                                >
                                    {/* Top Row: Stream Badge Pill & Department Name */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            {/* Circular Gold-Rimmed Icon Medallion */}
                                            <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-md shrink-0 flex items-center justify-center">
                                                <div className={`w-full h-full rounded-full ${dept.badgeBg} flex items-center justify-center text-white`}>
                                                    <IconComponent size={18} />
                                                </div>
                                            </div>

                                            <div>
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide ${dept.badgeBg} ${dept.badgeTextColor} border ${dept.accentBorder}`}>
                                                    {dept.pillText}
                                                </span>
                                                <h3 className="text-sm font-bold text-white mt-1">
                                                    {dept.name}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Quick Copy Button */}
                                        <button
                                            onClick={() => copyToClipboard(dept.number, dept.name)}
                                            title="Copy Phone Number"
                                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                        >
                                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                        </button>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                        {dept.description}
                                    </p>

                                    {/* Number Display Container */}
                                    <div className="bg-white/5 rounded-xl border border-white/10 p-3 mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                                <Phone size={14} />
                                            </div>
                                            <span className="text-base sm:text-lg font-black tracking-wider text-white">
                                                {dept.number}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Direct Call & WhatsApp */}
                                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                                        <a
                                            href={`tel:${dept.rawNumber}`}
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/15"
                                        >
                                            <Phone size={13} />
                                            <span>Call Direct</span>
                                        </a>

                                        <a
                                            href={`https://wa.me/${dept.waNumber}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-950/40"
                                        >
                                            <FaWhatsapp size={15} />
                                            <span>WhatsApp</span>
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ========================================================
                    CAMPUS INFO & INQUIRY FORM SECTION
                ======================================================== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left 5 Cols: Campus Details & Direct Channels */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Address & Quick Info Card */}
                        <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/10 backdrop-blur-xl space-y-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span>Campus Headquarters</span>
                            </h2>

                            <div className="space-y-5 text-sm">
                                {/* Physical Campus Address */}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Campus Location</p>
                                        <p className="text-white font-medium text-base leading-snug">
                                            No. 346/A, Robert Gunawardane Mawatha, Malabe
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Sri Lanka</p>
                                        <a
                                            href="https://maps.google.com/?q=No.+346%2FA%2C+Robert+Gunawardane+Mawatha%2C+Malabe"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold mt-2"
                                        >
                                            <span>Open in Google Maps</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>

                                {/* Official Email Address */}
                                <div className="flex items-start gap-4 pt-2 border-t border-white/5">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <Mail size={19} />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Official Email</p>
                                        <a
                                            href="mailto:info@imacampus.online"
                                            className="text-white font-bold text-base hover:text-red-400 transition-colors"
                                        >
                                            info@imacampus.online
                                        </a>
                                        <p className="text-xs text-slate-400 mt-0.5">Admissions & General Communications</p>
                                    </div>
                                </div>

                                {/* Web Portal */}
                                <div className="flex items-start gap-4 pt-2 border-t border-white/5">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <Globe size={19} />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Official Portal</p>
                                        <a
                                            href="https://www.imacampus.online"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-white font-bold text-base hover:text-blue-400 transition-colors"
                                        >
                                            www.imacampus.online
                                        </a>
                                        <p className="text-xs text-slate-400 mt-0.5">Digital Learning & Student Hub</p>
                                    </div>
                                </div>

                                {/* Operating Hours */}
                                <div className="flex items-start gap-4 pt-2 border-t border-white/5">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <Clock size={19} />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Operating Hours</p>
                                        <p className="text-white font-medium text-sm">Monday – Sunday: 8:00 AM – 6:00 PM</p>
                                        <p className="text-xs text-emerald-400 font-semibold mt-0.5">Campus open for physical visits & counseling</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Google Map Preview */}
                        <div className="rounded-3xl overflow-hidden border border-white/10 h-64 bg-slate-900 shadow-xl relative">
                            <iframe
                                title="IMA Campus Malabe Location"
                                src="https://maps.google.com/maps?q=Robert+Gunawardane+Mawatha+Malabe+Sri+Lanka&t=&z=15&ie=UTF8&iwloc=&output=embed"
                                width="100%"
                                height="100%"
                                style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' }}
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5">
                                <MapPin size={12} className="text-red-400" />
                                <span>No. 346/A, Robert Gunawardane Mawatha, Malabe</span>
                            </div>
                        </div>
                    </div>

                    {/* Right 7 Cols: Contact Message Form */}
                    <div className="lg:col-span-7 bg-gradient-to-b from-white/[0.08] to-white/[0.02] rounded-3xl p-6 sm:p-10 border border-white/10 backdrop-blur-xl shadow-2xl relative">
                        <div className="space-y-2 mb-8">
                            <h2 className="text-2xl font-black text-white tracking-tight">
                                Send Us a Message
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400">
                                Leave your query and our admissions counselor for the requested stream will contact you within 24 hours.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
                                        Your Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Kasun Perera"
                                        className="w-full bg-white/5 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
                                        Phone Number <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. 077 123 4567"
                                        className="w-full bg-white/5 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="yourname@gmail.com"
                                        className="w-full bg-white/5 border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
                                        Department / Stream
                                    </label>
                                    <select
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full bg-[#0d1322] border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors cursor-pointer"
                                    >
                                        <option value="General Inquiries">General Campus Inquiries</option>
                                        <option value="IMA O/L">IMA O/L (077 428 90 30)</option>
                                        <option value="IMA ART">IMA ART (076 625 90 30)</option>
                                        <option value="IMA COMMERCE">IMA COMMERCE (077 207 90 30)</option>
                                        <option value="IMA TECH">IMA TECH (077 334 50 60)</option>
                                        <option value="FAST TRACK">FAST TRACK (071 220 90 30)</option>
                                        <option value="IMA LAW SCHOOL">IMA LAW SCHOOL (070 7 678 561)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider mb-2">
                                    Your Message or Question <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    required
                                    rows="4"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Please tell us about your educational background and the courses you wish to enroll in..."
                                    className="w-full bg-white/5 border border-white/10 focus:border-red-500 rounded-xl p-4 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-900/30 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Sending Message...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        <span>Send Inquiry to Admissions</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                </div>

            </div>
        </div>
    );
}
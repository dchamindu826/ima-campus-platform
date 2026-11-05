import React from 'react';
import Navbar from '../components/Navbar';
import { ShieldCheck, Building2, MapPin, Mail, Phone } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="bg-[#0a0f1c] min-h-screen text-white pt-32 pb-20 px-6 font-sans">
            <Navbar />
            <div className="max-w-4xl mx-auto glass-card rounded-[2rem] p-8 md:p-12 border border-white/10 shadow-2xl">
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold mb-3">
                        <ShieldCheck size={14} /> OFFICIAL LEGAL & COMPLIANCE DISCLOSURE
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Privacy & Data Governance Policy</h1>
                    <p className="text-slate-400 text-xs sm:text-sm">Effective: January 1, 2026 • Governing Corporate Operations of IMA Campus Network</p>
                </div>

                {/* Corporate Operating Entities Card */}
                <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-700/80 mb-8 space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={16} className="text-red-400" />
                        Operating Legal Corporate Entities
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                            <span className="text-red-400 font-bold block mb-1">IDDAMALGODA MEDIA ACADEMY (PVT) LTD</span>
                            <span className="text-slate-400 block">Domain: academy.imacampus.online</span>
                            <span className="text-slate-500 block mt-1">Enterprise Line: +94 11 217 7872</span>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                            <span className="text-amber-400 font-bold block mb-1">IMA FAST TRACK (PVT) LTD</span>
                            <span className="text-slate-400 block">Domain: fasttrack.imacampus.online</span>
                            <span className="text-slate-500 block mt-1">TIN: 228744492 | Mobile: +94 76 784 5326</span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-800">
                        <MapPin size={14} className="text-red-400 shrink-0" />
                        <span><strong>Registered Office:</strong> No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka</span>
                    </div>
                </div>

                <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
                    <p>
                        This Privacy Policy outlines how <strong>IDDAMALGODA MEDIA ACADEMY (PVT) LTD</strong> and <strong>IMA FAST TRACK (PVT) LTD</strong> (collectively operating as the "IMA Campus Network", "we", "our", or "us") collect, store, and process personal identification information through <code>imacampus.online</code>, <code>academy.imacampus.online</code>, and <code>fasttrack.imacampus.online</code>.
                    </p>
                    
                    <h3 className="text-base font-bold text-white mt-6">1. Data Collection & Student Enrollment</h3>
                    <p>
                        We collect essential student records (including legal name, contact telephone, email address, physical delivery address for coursework materials, and examination performance) strictly for registration, educational delivery, certification, and verification.
                    </p>

                    <h3 className="text-base font-bold text-white mt-6">2. Data Security & Storage</h3>
                    <p>
                        We employ enterprise-grade cryptographic security (HTTPS/SSL), encrypted data transmission, and strict access control to safeguard student and corporate records against unauthorized access, loss, or alteration.
                    </p>

                    <h3 className="text-base font-bold text-white mt-6">3. Corporate Contact & Compliance Inquiries</h3>
                    <p>
                        Inquiries regarding personal data handling or institutional compliance should be directed to:
                        <br />
                        <strong>Administration Headquarters:</strong> No. 346/A, Robert Gunawardane Mawatha, Malabe, 10115, Sri Lanka.
                        <br />
                        <strong>Electronic Mail:</strong> info@imacampus.online
                    </p>
                </div>
            </div>
        </div>
    );
}
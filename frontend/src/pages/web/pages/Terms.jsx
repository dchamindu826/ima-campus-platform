import React from 'react';
import Navbar from '../components/Navbar';
import { ShieldCheck, CreditCard, AlertCircle, BookOpen, UserX } from 'lucide-react';

export default function Terms() {
    return (
        <div className="bg-[#0a0f1c] min-h-screen text-white pt-32 pb-20 px-6 font-inter">
            <Navbar />
            <div className="max-w-4xl mx-auto bg-gray-900/50 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-white/10 shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4">Terms & Conditions</h1>
                    <p className="text-gray-400 text-sm md:text-base">Please read these terms carefully before using the IMA Campus platform.</p>
                </div>

                <div className="space-y-8 text-gray-300 text-sm md:text-base leading-relaxed">
                    <section className="bg-black/20 p-6 rounded-2xl border border-white/5">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                            <ShieldCheck className="text-blue-400" /> 1. Registration & Account Security
                        </h3>
                        <p>Students are entirely responsible for maintaining the confidentiality of their login credentials. Account sharing, selling, or transferring is strictly prohibited. Any suspicious activity will result in immediate suspension of the account without prior notice.</p>
                    </section>

                    <section className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20">
                        <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-3">
                            <CreditCard className="text-red-400" /> 2. Payment & Refund Policy (Strict)
                        </h3>
                        <p className="mb-2">All payments made through our platform, including but not limited to course fees, seminar fees, and installment payments, are final.</p>
                        <ul className="list-disc pl-6 space-y-1 text-red-300/80 font-medium">
                            <li><strong>Online Payments are Strictly Non-Refundable.</strong> Under no circumstances will refunds be issued for payments successfully processed via our online payment gateways (e.g., Sampath IPG, PayHere).</li>
                            <li>In the event of a double charge or technical error, the excess amount will be credited to the student's IMA wallet for future use.</li>
                            <li>Bank slip deposits must be clear and verifiable. Forged or modified slips will lead to permanent expulsion and legal action.</li>
                        </ul>
                    </section>

                    <section className="bg-black/20 p-6 rounded-2xl border border-white/5">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                            <BookOpen className="text-blue-400" /> 3. Course Access & Intellectual Property
                        </h3>
                        <p>All study materials, videos, and live class recordings provided on this platform are the exclusive intellectual property of IMA Campus. Downloading, screen-recording, or unauthorized distribution of these materials is a direct violation of copyright laws and will result in immediate termination.</p>
                    </section>

                    <section className="bg-black/20 p-6 rounded-2xl border border-white/5">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                            <UserX className="text-blue-400" /> 4. Student Conduct & Termination
                        </h3>
                        <p>We expect all students to maintain proper decorum in virtual chat rooms, forums, and physical premises. Harassment, use of foul language, or disrupting the educational environment will grant the management the right to terminate your access immediately.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
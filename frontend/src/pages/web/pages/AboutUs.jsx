import React from 'react';
import Navbar from '../components/Navbar';

export default function AboutUs() {
    return (
        <div className="bg-[#0a0f1c] min-h-screen text-white pt-32 pb-20 px-6">
            <Navbar />
            <div className="max-w-4xl mx-auto glass-card rounded-[2rem] p-10 border border-white/10">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 mb-6">About IMA Campus</h1>
                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                    IMA Campus is Sri Lanka's leading premium educational institute, dedicated to molding the next generation of professionals. With our state-of-the-art learning management system and expert panel of lecturers, we offer unparalleled education in both physical and virtual environments.
                </p>
                <p className="text-slate-400 text-lg leading-relaxed">
                    Our mission is to provide affordable, high-quality education to every corner of the country, empowering students to achieve their dreams without boundaries.
                </p>
            </div>
        </div>
    );
}
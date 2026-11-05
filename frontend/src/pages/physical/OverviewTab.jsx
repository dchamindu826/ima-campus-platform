import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Calendar, UserPlus, Users, Activity } from 'lucide-react';

export default function OverviewTab() {
  const navigate = useNavigate();

  const actionCards = [
    { 
      title: 'Class Timetable', 
      image: '/card_timetable.png',
      path: '/physical/dashboard/timetable', 
      color: 'text-pink-400', 
      bg: 'bg-pink-400/20',
      border: 'hover:border-pink-400/50',
      shadow: 'hover:shadow-pink-400/20'
    },
    { 
      title: 'Student Registration', 
      image: '/card_registration.png',
      path: '/physical/dashboard/registration', 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-400/20',
      border: 'hover:border-emerald-400/50',
      shadow: 'hover:shadow-emerald-400/20'
    },
    { 
      title: 'Teachers & Classes', 
      image: '/card_staff.png',
      path: '/physical/dashboard/staff', 
      color: 'text-blue-400', 
      bg: 'bg-blue-400/20',
      border: 'hover:border-blue-400/50',
      shadow: 'hover:shadow-blue-400/20'
    },
    { 
      title: 'Student Portal', 
      image: '/card_attendance.png',
      path: '/physical/dashboard/attendance', 
      color: 'text-amber-400', 
      bg: 'bg-amber-400/20',
      border: 'hover:border-amber-400/50',
      shadow: 'hover:shadow-amber-400/20'
    },
    { 
      title: 'Student Reports & Matrix', 
      image: '/card_student_reports_169.png',
      path: '/physical/dashboard/student-reports', 
      color: 'text-rose-400', 
      bg: 'bg-rose-400/20',
      border: 'hover:border-rose-400/50',
      shadow: 'hover:shadow-rose-400/20'
    },
    { 
      title: 'Class Compare Report', 
      image: '/card_class_compare_169.png',
      path: '/physical/dashboard/class-compare', 
      color: 'text-purple-400', 
      bg: 'bg-purple-400/20',
      border: 'hover:border-purple-400/50',
      shadow: 'hover:shadow-purple-400/20'
    },
    { 
      title: 'Cash Flow Portal', 
      image: '/card_finance.png',
      path: '/physical/dashboard/finance', 
      color: 'text-indigo-400', 
      bg: 'bg-indigo-400/20',
      border: 'hover:border-indigo-400/50',
      shadow: 'hover:shadow-indigo-400/20'
    },
    { 
      title: 'Financial Reports', 
      image: '/card_reports.png',
      path: '/physical/dashboard/reports', 
      color: 'text-rose-400', 
      bg: 'bg-rose-400/20',
      border: 'hover:border-rose-400/50',
      shadow: 'hover:shadow-rose-400/20'
    },
    { 
      title: 'Lecturer Reports', 
      image: '/card_lecturer_reports.png',
      path: '/physical/dashboard/lecturer-reports', 
      color: 'text-cyan-400', 
      bg: 'bg-cyan-400/20',
      border: 'hover:border-cyan-400/50',
      shadow: 'hover:shadow-cyan-400/20'
    },
    { 
      title: 'Entrance Gate Scanner', 
      image: '/card_entrance_gate.png',
      path: '/physical/dashboard/entrance-gate', 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/20',
      border: 'hover:border-emerald-400/60',
      shadow: 'hover:shadow-emerald-400/30'
    }
  ];


  return (
    <div className="animate-fade-in w-full min-h-full pb-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-brand-accent/20 p-3 rounded-xl border border-brand-accent/30 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
           <Building className="text-brand-accent" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-white">Physical Hub Overview</h2>
          <p className="text-gray-400 text-sm">Select an application below to manage physical operations.</p>
        </div>
      </div>

      {/* Quick Action Cards (Glassmorphism, Large Centered Icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {actionCards.map((card, idx) => (
          <button
            key={idx}
            onClick={() => card.path ? navigate(card.path) : null}
            className={`relative overflow-hidden group bg-white/5 backdrop-blur-xl border border-white/10 ${card.border} rounded-3xl p-5 flex flex-col items-center justify-center text-center transition-all duration-300 ${card.path ? 'cursor-pointer hover:-translate-y-1 ' + card.shadow : 'cursor-default'}`}
          >
            {/* Background Glow */}
            <div className={`absolute -top-20 -right-20 w-40 h-40 ${card.bg} rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500`}></div>
            <div className={`absolute -bottom-20 -left-20 w-40 h-40 ${card.bg} rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500`}></div>
            
            {card.image ? (
              <div className="w-full h-32 mb-4 relative z-10 rounded-2xl overflow-hidden shadow-lg border border-white/20 group-hover:scale-105 transition-transform duration-300">
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`p-4 rounded-3xl ${card.bg} border border-white/10 mb-4 relative z-10 group-hover:scale-110 transition-transform duration-300`}>
                <card.icon size={36} className={card.color} />
              </div>
            )}
            
            <div className="relative z-10 w-full">
              <h3 className="text-base font-bold text-white drop-shadow-md">{card.title}</h3>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}

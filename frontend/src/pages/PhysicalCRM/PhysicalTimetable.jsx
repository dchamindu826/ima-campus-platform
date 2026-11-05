import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, Download, Printer, Filter, Search, User, 
  BookOpen, Sparkles, ChevronLeft, ChevronRight, Layers, Award,
  CheckCircle2, AlertCircle, Building2, MapPin
} from 'lucide-react';
import { physicalCrmService } from '../../api/physicalCrm';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper to convert time string (e.g., "08:00 AM", "8:30", "13:30", "2:00 PM") to total minutes from midnight for exact sorting
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 9999;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const match = clean.match(/(\d+):?(\d*)/);
  if (!match) return 9999;
  let hour = parseInt(match[1], 10);
  const min = match[2] ? parseInt(match[2], 10) : 0;
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return hour * 60 + min;
};

// Format time string to clean 12-hour AM/PM format
const format12Hour = (timeStr) => {
  if (!timeStr) return '';
  if (/am|pm/i.test(timeStr)) return timeStr.toUpperCase();
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].slice(0, 2);
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${minute} ${period}`;
  }
  return timeStr;
};

// Calculate duration in hours & minutes between two time strings
const calculateDuration = (startTime, endTime) => {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (endMin <= startMin || startMin >= 9999 || endMin >= 9999) return '';
  const diff = endMin - startMin;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${minutes} min`;
};

// Color theme helper by stream for visual clarity and eye comfort
const getStreamTheme = (stream) => {
  const s = (stream || '').toLowerCase();
  if (s.includes('science') || s.includes('maths') || s.includes('bio')) {
    return {
      cardBg: 'bg-gradient-to-b from-cyan-950/40 via-slate-900/90 to-slate-950/90',
      cardBorder: 'border-cyan-500/25 hover:border-cyan-400/50 hover:shadow-cyan-950/30',
      badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      timeBg: 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300',
      accentColor: 'text-cyan-400'
    };
  }
  if (s.includes('commerce') || s.includes('acc') || s.includes('bs') || s.includes('econ')) {
    return {
      cardBg: 'bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950/90',
      cardBorder: 'border-amber-500/25 hover:border-amber-400/50 hover:shadow-amber-950/30',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      timeBg: 'bg-amber-950/60 border-amber-500/30 text-amber-300',
      accentColor: 'text-amber-400'
    };
  }
  if (s.includes('art') || s.includes('logic') || s.includes('media') || s.includes('sinhala')) {
    return {
      cardBg: 'bg-gradient-to-b from-purple-950/40 via-slate-900/90 to-slate-950/90',
      cardBorder: 'border-purple-500/25 hover:border-purple-400/50 hover:shadow-purple-950/30',
      badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      timeBg: 'bg-purple-950/60 border-purple-500/30 text-purple-300',
      accentColor: 'text-purple-400'
    };
  }
  if (s.includes('tech') || s.includes('ict') || s.includes('sft') || s.includes('et') || s.includes('bst')) {
    return {
      cardBg: 'bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-950/90',
      cardBorder: 'border-emerald-500/25 hover:border-emerald-400/50 hover:shadow-emerald-950/30',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      timeBg: 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300',
      accentColor: 'text-emerald-400'
    };
  }
  return {
    cardBg: 'bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950/90',
    cardBorder: 'border-indigo-500/25 hover:border-indigo-400/50 hover:shadow-indigo-950/30',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    timeBg: 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300',
    accentColor: 'text-indigo-400'
  };
};

export default function PhysicalTimetable() {
  const [schedule, setSchedule] = useState({});
  const [classesList, setClassesList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [hallsList, setHallsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state: 'daywise' | 'weekly'
  const [viewMode, setViewMode] = useState('weekly');
  
  // Current active day for daywise view
  const [activeDay, setActiveDay] = useState(() => {
    const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayMap[todayIndex] || 'Monday';
  });

  // Filters
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('ALL');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedHallFilter, setSelectedHallFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesRes, teachersRes, hallsRes] = await Promise.all([
        physicalCrmService.getClasses(),
        physicalCrmService.getTeachers(),
        physicalCrmService.getHalls().catch(() => [])
      ]);

      const classes = classesRes || [];
      const teachers = teachersRes || [];
      const halls = hallsRes || [];
      
      setClassesList(classes);
      setTeachersList(teachers);
      setHallsList(halls);

      // Build schedule map
      const dayMap = {};
      DAYS.forEach(d => dayMap[d] = []);

      // 1. Slots from Classes
      classes.forEach(cls => {
        if (cls.timetables && cls.timetables.length > 0) {
          const teacherNames = cls.teachers && cls.teachers.length > 0
            ? cls.teachers.map(t => t.name).join(', ')
            : 'No Teacher Assigned';

          cls.timetables.forEach(slot => {
            if (dayMap[slot.dayOfWeek]) {
              const hallName = slot.hall?.name || slot.hallName || '';
              dayMap[slot.dayOfWeek].push({
                id: slot.id,
                classId: cls.id,
                startTime: slot.startTime,
                endTime: slot.endTime,
                formattedStartTime: format12Hour(slot.startTime),
                formattedEndTime: format12Hour(slot.endTime),
                duration: calculateDuration(slot.startTime, slot.endTime),
                teacherName: teacherNames,
                teachers: cls.teachers || [],
                className: cls.name,
                classGrade: cls.grade || '',
                classStream: cls.stream || '',
                classSubject: cls.subject || '',
                monthlyFee: cls.monthlyFee || 0,
                hallId: slot.hallId || (slot.hall ? slot.hall.id : null),
                hallName: hallName,
                dayOfWeek: slot.dayOfWeek
              });
            }
          });
        }
      });

      // 2. Direct teacher slots (if any)
      teachers.forEach(teacher => {
        if (teacher.timetables) {
          teacher.timetables.forEach(slot => {
            if (slot.dayOfWeek && dayMap[slot.dayOfWeek] && !slot.classId) {
              const hallName = slot.hall?.name || slot.hallName || '';
              dayMap[slot.dayOfWeek].push({
                id: slot.id,
                classId: null,
                startTime: slot.startTime,
                endTime: slot.endTime,
                formattedStartTime: format12Hour(slot.startTime),
                formattedEndTime: format12Hour(slot.endTime),
                duration: calculateDuration(slot.startTime, slot.endTime),
                teacherName: teacher.name,
                teachers: [teacher],
                className: teacher.classes && teacher.classes.length > 0 ? teacher.classes.map(c => c.name).join(', ') : 'Direct Slot',
                classGrade: '',
                classStream: '',
                classSubject: '',
                monthlyFee: 0,
                hallId: slot.hallId || (slot.hall ? slot.hall.id : null),
                hallName: hallName,
                dayOfWeek: slot.dayOfWeek
              });
            }
          });
        }
      });

      // Sort every day chronologically by start time in minutes!
      DAYS.forEach(d => {
        dayMap[d].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      });

      setSchedule(dayMap);
    } catch (err) {
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  // Unique Grades for filter dropdown
  const uniqueGrades = useMemo(() => {
    const grades = new Set();
    classesList.forEach(c => {
      if (c.grade) grades.add(c.grade);
    });
    return Array.from(grades).sort();
  }, [classesList]);

  // Unique Halls for filter dropdown
  const availableHalls = useMemo(() => {
    const hallNames = new Set(hallsList.map(h => h.name));
    Object.values(schedule).flat().forEach(s => {
      if (s.hallName) hallNames.add(s.hallName);
    });
    return Array.from(hallNames).sort();
  }, [hallsList, schedule]);

  // Filtered Schedule based on selected filters
  const filteredSchedule = useMemo(() => {
    const res = {};
    DAYS.forEach(day => {
      const slots = schedule[day] || [];
      res[day] = slots.filter(slot => {
        // Teacher filter
        const matchTeacher = selectedTeacherFilter === 'ALL' || 
          slot.teacherName.toLowerCase().includes(selectedTeacherFilter.toLowerCase());

        // Grade filter
        const matchGrade = selectedGradeFilter === 'ALL' || 
          slot.classGrade === selectedGradeFilter;

        // Hall filter
        const matchHall = selectedHallFilter === 'ALL' || 
          (slot.hallName && slot.hallName.toLowerCase() === selectedHallFilter.toLowerCase());

        // Search term
        const term = searchTerm.trim().toLowerCase();
        const matchSearch = !term ||
          slot.className.toLowerCase().includes(term) ||
          slot.teacherName.toLowerCase().includes(term) ||
          slot.classGrade.toLowerCase().includes(term) ||
          slot.classSubject.toLowerCase().includes(term) ||
          slot.classStream.toLowerCase().includes(term) ||
          (slot.hallName && slot.hallName.toLowerCase().includes(term));

        return matchTeacher && matchGrade && matchHall && matchSearch;
      });
    });
    return res;
  }, [schedule, selectedTeacherFilter, selectedGradeFilter, selectedHallFilter, searchTerm]);

  // Total class slots count across all days
  const totalSlotsCount = useMemo(() => {
    return Object.values(filteredSchedule).reduce((acc, list) => acc + list.length, 0);
  }, [filteredSchedule]);

  // Export Timetable to CSV
  const handleExportCSV = () => {
    const headers = ['Day', 'Start Time', 'End Time', 'Duration', 'Class Name', 'Grade', 'Stream', 'Subject', 'Lecturer', 'Hall', 'Monthly Fee'];
    const rows = [];

    DAYS.forEach(day => {
      const slots = filteredSchedule[day] || [];
      slots.forEach(s => {
        rows.push([
          `"${day}"`,
          `"${s.formattedStartTime || s.startTime}"`,
          `"${s.formattedEndTime || s.endTime}"`,
          `"${s.duration || ''}"`,
          `"${(s.className || '').replace(/"/g, '""')}"`,
          `"${s.classGrade || ''}"`,
          `"${s.classStream || ''}"`,
          `"${s.classSubject || ''}"`,
          `"${(s.teacherName || '').replace(/"/g, '""')}"`,
          `"${s.hallName || 'Unassigned'}"`,
          s.monthlyFee || 0
        ]);
      });
    });

    if (rows.length === 0) {
      toast.error('No schedule data to export');
      return;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Physical_Campus_Timetable_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Timetable exported as CSV!');
  };

  // Print Softcopy
  const handlePrintSoftcopy = () => {
    window.print();
  };

  return (
    <div className="space-y-6 w-full min-h-full pb-16 max-w-[1800px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/30 text-white">
            <Calendar size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Physical Campus Timetable
            </h1>
            <p className="text-white/60 text-xs sm:text-sm mt-0.5">
              Comprehensive timetable schedule with hall allocations & chronologically ordered time slots.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex bg-black/50 p-1 rounded-2xl border border-white/15 shadow-inner">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              🗓️ Weekly 7-Day Grid
            </button>
            <button
              onClick={() => setViewMode('daywise')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'daywise'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              📅 Day-by-Day View
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>
          
          <button
            onClick={handlePrintSoftcopy}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Printer size={14} /> Print Timetable 🖨️
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        
        {/* Search */}
        <div className="relative lg:col-span-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
          <input
            type="text"
            placeholder="Search class, lecturer, hall, stream..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Hall Filter */}
        <div className="lg:col-span-3">
          <select
            value={selectedHallFilter}
            onChange={(e) => setSelectedHallFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="ALL" className="text-black">🏢 All Halls (Hall A, B, C...)</option>
            {availableHalls.map(h => (
              <option key={h} value={h} className="text-black">🏢 {h}</option>
            ))}
          </select>
        </div>

        {/* Teacher Filter */}
        <div className="lg:col-span-3">
          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="ALL" className="text-black">👨‍🏫 All Lecturers / Teachers</option>
            {teachersList.map(t => (
              <option key={t.id} value={t.name} className="text-black">{t.name}</option>
            ))}
          </select>
        </div>

        {/* Grade Filter */}
        <div className="lg:col-span-2">
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="ALL" className="text-black">🎓 All Grades</option>
            {uniqueGrades.map(g => (
              <option key={g} value={g} className="text-black">{g}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Stream Quick Indicator Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-white/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white/40 text-[11px] uppercase tracking-wider">Stream Color Codes:</span>
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">🧪 Science / Maths</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">📊 Commerce</span>
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">🎭 Arts / Logic</span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">💻 Technology / ICT</span>
        </div>
        <div className="flex items-center gap-2 font-bold text-white/80">
          <Clock size={13} className="text-blue-400" />
          <span>{totalSlotsCount} Total Sessions</span>
        </div>
      </div>

      {/* 3. Main Content: Weekly Grid View or Daywise Focus View */}
      {loading ? (
        <div className="flex justify-center items-center py-36">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : viewMode === 'weekly' ? (
        
        /* ------------------------------------------------------------- */
        /* WEEKLY 7-DAY GRID VIEW (EYE-FRIENDLY & SPACIOUS)              */
        /* ------------------------------------------------------------- */
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="grid grid-cols-7 gap-3 min-w-[1450px] items-start">
              {DAYS.map(day => {
                const slots = filteredSchedule[day] || [];
                const isToday = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] === day;
                return (
                  <div 
                    key={day} 
                    className={`flex flex-col rounded-2xl border overflow-hidden min-h-[480px] transition-all ${
                      isToday 
                        ? 'bg-slate-950/90 border-blue-500/40 shadow-lg shadow-blue-500/10' 
                        : 'bg-slate-950/60 border-white/10'
                    }`}
                  >
                    {/* Column Day Header */}
                    <div className={`px-3 py-3 border-b text-center relative ${
                      isToday 
                        ? 'bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 border-blue-500/30' 
                        : 'bg-white/[0.04] border-white/10'
                    }`}>
                      <h4 className="text-white font-black tracking-wider uppercase text-xs flex items-center justify-center gap-1.5">
                        <span>{day}</span>
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        )}
                      </h4>
                      <span className="text-[10px] text-white/60 font-bold mt-0.5 block">
                        {slots.length} {slots.length === 1 ? 'Class' : 'Classes'}
                      </span>
                    </div>

                    {/* Slots List */}
                    <div className="p-2.5 flex-1 flex flex-col gap-2.5">
                      {slots.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/30 py-16">
                          <Clock size={24} className="mb-1.5 opacity-20" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">No Classes</span>
                        </div>
                      ) : (
                        slots.map((slot, idx) => {
                          const theme = getStreamTheme(slot.classStream);
                          return (
                            <div
                              key={slot.id || idx}
                              className={`p-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl space-y-2 relative group ${theme.cardBg} ${theme.cardBorder}`}
                            >
                              {/* Time Header with Duration */}
                              <div className={`p-1.5 rounded-lg border text-center ${theme.timeBg}`}>
                                <div className="text-[11px] font-black tracking-tight text-white flex items-center justify-center gap-1">
                                  <span>{slot.formattedStartTime || slot.startTime}</span>
                                  <span className="text-white/40 font-normal text-[9px]">→</span>
                                  <span>{slot.formattedEndTime || slot.endTime}</span>
                                </div>
                                {slot.duration && (
                                  <span className="text-[9px] font-extrabold text-white/70 block mt-0.5">
                                    ⏱️ {slot.duration}
                                  </span>
                                )}
                              </div>

                              {/* Class Title & Badges */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {slot.classGrade && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-white/10 text-white/90 border border-white/10">
                                      {slot.classGrade}
                                    </span>
                                  )}
                                  {slot.classStream && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${theme.badge}`}>
                                      {slot.classStream}
                                    </span>
                                  )}
                                </div>

                                <h5 className="font-black text-white text-xs leading-snug drop-shadow-sm group-hover:text-blue-300 transition-colors">
                                  {slot.className}
                                </h5>
                              </div>

                              {/* Teacher & Hall Footer */}
                              <div className="pt-1.5 border-t border-white/10 space-y-1 text-[10px]">
                                <div className="flex items-center gap-1 text-white/80 font-bold truncate">
                                  <span>👨‍🏫</span>
                                  <span className="truncate">{slot.teacherName}</span>
                                </div>

                                {/* Hall Badge */}
                                <div className="flex items-center justify-between">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ${
                                    slot.hallName 
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                                      : 'bg-white/5 text-white/40 border border-white/10'
                                  }`}>
                                    <Building2 size={10} />
                                    <span>{slot.hallName || 'Hall Pending'}</span>
                                  </span>

                                  {slot.monthlyFee > 0 && (
                                    <span className="text-[9px] font-mono font-bold text-emerald-400">
                                      Rs. {Number(slot.monthlyFee).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      ) : (

        /* ------------------------------------------------------------- */
        /* DAY-BY-DAY TIMELINE VIEW (SPACIOUS & ELEGANT)                 */
        /* ------------------------------------------------------------- */
        <div className="space-y-4">
          
          {/* Day Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {DAYS.map(day => {
              const daySlots = filteredSchedule[day] || [];
              const isSelected = activeDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-blue-600 to-indigo-700 border-blue-400/50 shadow-lg shadow-blue-600/30 text-white transform -translate-y-0.5'
                      : 'bg-slate-900/60 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <h4 className="text-xs font-black uppercase tracking-wider">{day}</h4>
                  <span className={`text-[10px] font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-white/5 text-white/50'
                  }`}>
                    {daySlots.length} {daySlots.length === 1 ? 'Class' : 'Classes'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Day Class Schedule List */}
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-blue-400" />
                <h3 className="text-base font-black text-white">
                  {activeDay} Schedule ({filteredSchedule[activeDay]?.length || 0} Classes Scheduled)
                </h3>
              </div>
              <span className="text-xs text-white/50 font-medium">Sorted chronologically by start time</span>
            </div>

            {(!filteredSchedule[activeDay] || filteredSchedule[activeDay].length === 0) ? (
              <div className="text-center py-20 text-white/40 space-y-2">
                <Clock size={40} className="mx-auto opacity-30" />
                <h4 className="text-sm font-bold text-white/60 uppercase">No Classes Scheduled for {activeDay}</h4>
                <p className="text-xs">Try selecting another day or adjusting your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedule[activeDay].map((slot, idx) => {
                  const theme = getStreamTheme(slot.classStream);
                  return (
                    <div
                      key={slot.id || idx}
                      className={`p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl space-y-3 group ${theme.cardBg} ${theme.cardBorder}`}
                    >
                      {/* Time Header with Duration */}
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${theme.timeBg}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={15} className={theme.accentColor} />
                          <span className="text-xs font-black text-white tracking-wide">
                            {slot.formattedStartTime || slot.startTime} - {slot.formattedEndTime || slot.endTime}
                          </span>
                        </div>
                        {slot.duration && (
                          <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                            ⏱️ {slot.duration}
                          </span>
                        )}
                      </div>

                      {/* Class Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {slot.classGrade && (
                            <span className="text-[9px] font-black text-white/90 bg-white/10 px-2 py-0.5 rounded-full border border-white/10 uppercase">
                              {slot.classGrade}
                            </span>
                          )}
                          {slot.classStream && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${theme.badge}`}>
                              {slot.classStream}
                            </span>
                          )}
                          {slot.classSubject && (
                            <span className="text-[9px] font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                              {slot.classSubject}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-white group-hover:text-blue-300 transition-colors drop-shadow-sm">
                          {slot.className}
                        </h4>
                      </div>

                      {/* Teacher & Hall Footer */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
                            <User size={13} />
                          </div>
                          <span className="font-bold text-white/90 truncate">
                            {slot.teacherName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black ${
                            slot.hallName 
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-white/5 text-white/40 border border-white/10'
                          }`}>
                            <Building2 size={12} />
                            <span>{slot.hallName || 'Hall Pending'}</span>
                          </span>

                          {slot.monthlyFee > 0 && (
                            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                              Rs. {Number(slot.monthlyFee).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      )}

      {/* ========================================================================= */}
      {/* HIDDEN PRINT SOFTCOPY TEMPLATE FOR TIMETABLE                              */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white p-8 font-sans" id="printable-timetable">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-black uppercase tracking-wider">IMA PHYSICAL CAMPUS</h1>
          <h2 className="text-base font-bold text-gray-700 mt-0.5">Physical Campus Master Class Timetable</h2>
          <p className="text-xs text-gray-500 mt-1">
            Generated on: {new Date().toLocaleString()} | Filter: {selectedTeacherFilter !== 'ALL' ? `Teacher: ${selectedTeacherFilter} | ` : ''}{selectedGradeFilter !== 'ALL' ? `Grade: ${selectedGradeFilter} | ` : ''}{selectedHallFilter !== 'ALL' ? `Hall: ${selectedHallFilter}` : 'All Halls'}
          </p>
        </div>

        {/* Day-by-Day Table */}
        <div className="space-y-6">
          {DAYS.map(day => {
            const daySlots = filteredSchedule[day] || [];
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="mb-4">
                <h3 className="text-xs font-black uppercase bg-gray-800 text-white px-3 py-1.5 rounded-t">
                  {day} ({daySlots.length} Classes)
                </h3>
                <table className="w-full text-left text-[10px] border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-1.5 border border-gray-300 w-28">Time Slot</th>
                      <th className="p-1.5 border border-gray-300 w-16">Duration</th>
                      <th className="p-1.5 border border-gray-300">Class Name</th>
                      <th className="p-1.5 border border-gray-300 w-20">Grade / Year</th>
                      <th className="p-1.5 border border-gray-300 w-24">Stream</th>
                      <th className="p-1.5 border border-gray-300">Lecturer / Teacher</th>
                      <th className="p-1.5 border border-gray-300 w-20">Hall</th>
                      <th className="p-1.5 border border-gray-300 w-20 text-right">Fee (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daySlots.map((s, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-1.5 border border-gray-300 font-mono font-bold">{s.formattedStartTime || s.startTime} - {s.formattedEndTime || s.endTime}</td>
                        <td className="p-1.5 border border-gray-300">{s.duration || '-'}</td>
                        <td className="p-1.5 border border-gray-300 font-bold">{s.className}</td>
                        <td className="p-1.5 border border-gray-300">{s.classGrade || '-'}</td>
                        <td className="p-1.5 border border-gray-300">{s.classStream || '-'}</td>
                        <td className="p-1.5 border border-gray-300 font-semibold">{s.teacherName}</td>
                        <td className="p-1.5 border border-gray-300 font-bold">{s.hallName || 'Pending'}</td>
                        <td className="p-1.5 border border-gray-300 text-right font-mono">{s.monthlyFee ? `Rs. ${s.monthlyFee}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Print Footer */}
        <div className="mt-8 pt-4 border-t border-gray-400 flex justify-between text-[10px] text-gray-500">
          <span>IMA Campus Timetable Management System</span>
          <span>Physical Department</span>
        </div>
      </div>

    </div>
  );
}

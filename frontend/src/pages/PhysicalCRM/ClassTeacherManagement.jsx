import React, { useState, useEffect, useRef } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { BookOpen, Users, Calendar, Clock, Plus, Trash2, Edit2, Camera, Search, X, Check, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime12Hour = (timeStr) => {
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

const getTeacherImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('data:image') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  let apiBase = '';
  if (import.meta.env.VITE_API_URL) {
    apiBase = import.meta.env.VITE_API_URL;
  } else {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
      apiBase = `http://${hostname}:5000/api`;
    } else if (window.location.protocol === 'https:') {
      apiBase = `https://${hostname}/api`;
    } else {
      apiBase = `http://${hostname}:5000/api`;
    }
  }

  const backendHost = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${backendHost}${cleanPath}`;
};

export default function ClassTeacherManagement() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Constants for Streams and Subjects
  const STREAMS = ['Science', 'Commerce', 'Arts', 'Technology', 'Other'];
  const STREAM_SUBJECTS = {
    'Science': ['Physics', 'Chemistry', 'Biology', 'Combined Maths', 'Custom'],
    'Commerce': ['Accounting', 'Business Studies', 'Economics', 'Custom'],
    'Arts': ['Media', 'Logic', 'Sinhala', 'Political Science', 'Geography', 'History', 'Custom'],
    'Technology': ['SFT', 'ET', 'BST', 'ICT', 'Agri', 'Custom'],
    'Other': ['Custom']
  };

  // Helper: Format YYYY-MM to readable month (e.g. 2025-01 -> Jan 2025)
  const formatMonthYear = (mStr) => {
    if (!mStr) return '';
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (e) {
      return mStr;
    }
  };

  // Helper: Get next month string from a given YYYY-MM
  const getNextMonthStr = (mStr) => {
    if (!mStr) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const [year, month] = mStr.split('-').map(Number);
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  };

  // Class Form State
  const [editingClassId, setEditingClassId] = useState(null);
  const [classForm, setClassForm] = useState({ 
    name: '', 
    grade: '', 
    stream: '', 
    subject: '', 
    customSubject: '',
    monthlyFee: '',
    startMonth: '',
    activeMonths: [],
    timetables: [] 
  });

  // Manual Month Input State
  const [customMonthInput, setCustomMonthInput] = useState('');

  // Current Schedule Slot being composed
  const [slotDay, setSlotDay] = useState(DAYS[0]);
  const [slotStartHour, setSlotStartHour] = useState('08');
  const [slotStartMin, setSlotStartMin] = useState('00');
  const [slotStartPeriod, setSlotStartPeriod] = useState('AM');
  const [slotEndHour, setSlotEndHour] = useState('10');
  const [slotEndMin, setSlotEndMin] = useState('30');
  const [slotEndPeriod, setSlotEndPeriod] = useState('AM');

  // Halls State
  const [halls, setHalls] = useState([]);
  const [slotHallId, setSlotHallId] = useState('');
  const [showAddHallInput, setShowAddHallInput] = useState(false);
  const [newHallInputName, setNewHallInputName] = useState('');
  
  // Search States
  const [activeClassSearch, setActiveClassSearch] = useState('');
  const [teacherClassSearch, setTeacherClassSearch] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  
  // Teacher Form State
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [teacherForm, setTeacherForm] = useState({
    name: '', address: '', whatsapp: '', phone: '', classIds: [], instituteCut: 0, image: null
  });
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clsRes, tchRes, hallsRes] = await Promise.all([
        physicalCrmService.getClasses(),
        physicalCrmService.getTeachers(),
        physicalCrmService.getHalls().catch(() => [])
      ]);
      setClasses(clsRes || []);
      setTeachers(tchRes || []);
      setHalls(hallsRes || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateHall = async () => {
    if (!newHallInputName || !newHallInputName.trim()) {
      toast.error('Please enter a hall name');
      return;
    }
    try {
      const created = await physicalCrmService.createHall({ name: newHallInputName.trim() });
      setHalls(prev => [...prev, created]);
      setSlotHallId(String(created.id));
      setNewHallInputName('');
      setShowAddHallInput(false);
      toast.success(`Created hall: ${created.name}`);
    } catch (err) {
      toast.error('Failed to create hall');
    }
  };

  // --- Active Months Management Handlers ---
  const handleStartMonthChange = (newStartMonth) => {
    let newActiveMonths = classForm.activeMonths;
    if (!newActiveMonths || newActiveMonths.length === 0) {
      newActiveMonths = newStartMonth ? [newStartMonth] : [];
    } else if (newStartMonth && !newActiveMonths.includes(newStartMonth)) {
      newActiveMonths = [newStartMonth, ...newActiveMonths.filter(m => m !== newStartMonth)].sort();
    }
    setClassForm(prev => ({
      ...prev,
      startMonth: newStartMonth,
      activeMonths: newActiveMonths
    }));
  };

  const handleAddNextMonth = () => {
    const lastMonth = classForm.activeMonths && classForm.activeMonths.length > 0
      ? classForm.activeMonths[classForm.activeMonths.length - 1]
      : classForm.startMonth;

    const nextM = getNextMonthStr(lastMonth);
    if (classForm.activeMonths.includes(nextM)) {
      toast.error('Month already added');
      return;
    }

    setClassForm(prev => ({
      ...prev,
      activeMonths: [...(prev.activeMonths || []), nextM].sort()
    }));
    toast.success(`Added month: ${formatMonthYear(nextM)}`);
  };

  const handleAddCustomMonth = () => {
    if (!customMonthInput) {
      toast.error('Please select a month to add');
      return;
    }
    if (classForm.activeMonths.includes(customMonthInput)) {
      toast.error('This month is already added');
      return;
    }
    setClassForm(prev => ({
      ...prev,
      activeMonths: [...(prev.activeMonths || []), customMonthInput].sort()
    }));
    toast.success(`Added month: ${formatMonthYear(customMonthInput)}`);
    setCustomMonthInput('');
  };

  const handleRemoveMonth = (monthToRemove) => {
    setClassForm(prev => ({
      ...prev,
      activeMonths: prev.activeMonths.filter(m => m !== monthToRemove)
    }));
  };

  // --- Timetable Slot Handlers for Class Form ---
  const handleAddSlotToClass = () => {
    const startTimeFormatted = `${slotStartHour}:${slotStartMin} ${slotStartPeriod}`;
    const endTimeFormatted = `${slotEndHour}:${slotEndMin} ${slotEndPeriod}`;

    const exists = classForm.timetables.some(
      t => t.dayOfWeek === slotDay && t.startTime === startTimeFormatted && t.endTime === endTimeFormatted
    );

    if (exists) {
      toast.error('This time slot is already added');
      return;
    }

    const selectedHallObj = halls.find(h => String(h.id) === String(slotHallId));

    const newSlot = {
      dayOfWeek: slotDay,
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      hallId: slotHallId ? parseInt(slotHallId) : null,
      hallName: selectedHallObj ? selectedHallObj.name : null
    };

    setClassForm(prev => ({
      ...prev,
      timetables: [...prev.timetables, newSlot]
    }));

    toast.success(`Added slot: ${slotDay} ${startTimeFormatted} - ${endTimeFormatted}${selectedHallObj ? ` (${selectedHallObj.name})` : ''}`);
  };

  const handleRemoveSlotFromClass = (index) => {
    setClassForm(prev => ({
      ...prev,
      timetables: prev.timetables.filter((_, i) => i !== index)
    }));
  };

  // --- Class Edit & Submit Handlers ---
  const startEditClass = (c) => {
    setEditingClassId(c.id);
    const isAL = c.grade === 'Grade 12' || c.grade === 'Grade 13';
    const isKnownSubject = isAL && c.stream && STREAM_SUBJECTS[c.stream]?.includes(c.subject);

    let parsedActiveMonths = [];
    if (Array.isArray(c.activeMonths)) parsedActiveMonths = c.activeMonths;
    else if (typeof c.activeMonths === 'string') {
      try { parsedActiveMonths = JSON.parse(c.activeMonths); } catch(e) { parsedActiveMonths = [c.activeMonths]; }
    } else if (c.startMonth) {
      parsedActiveMonths = [c.startMonth];
    }
    
    setClassForm({
      name: c.name || '',
      grade: c.grade || '',
      stream: c.stream || '',
      subject: isKnownSubject ? c.subject : (c.subject ? 'Custom' : ''),
      customSubject: (!isKnownSubject && c.subject) ? c.subject : '',
      monthlyFee: c.monthlyFee !== undefined && c.monthlyFee !== null ? c.monthlyFee : '',
      startMonth: c.startMonth || (parsedActiveMonths[0] || ''),
      activeMonths: parsedActiveMonths,
      timetables: c.timetables ? c.timetables.map(t => ({
        dayOfWeek: t.dayOfWeek,
        startTime: t.startTime,
        endTime: t.endTime,
        hallId: t.hallId || (t.hall ? t.hall.id : null) || null,
        hallName: t.hallName || (t.hall ? t.hall.name : null) || null
      })) : []
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Editing class: ' + c.name, { icon: '✏️' });
  };

  const cancelEditClass = () => {
    setEditingClassId(null);
    setClassForm({ 
      name: '', 
      grade: '', 
      stream: '', 
      subject: '', 
      customSubject: '', 
      monthlyFee: '',
      startMonth: '',
      activeMonths: [],
      timetables: [] 
    });
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();
    if (!classForm.grade) {
      toast.error('Please select a grade');
      return;
    }
    if (!classForm.name) {
      toast.error('Please enter a class name');
      return;
    }

    try {
      const payload = {
        ...classForm,
        monthlyFee: classForm.monthlyFee ? parseFloat(classForm.monthlyFee) : 0,
        activeMonths: classForm.activeMonths && classForm.activeMonths.length > 0 
          ? classForm.activeMonths 
          : (classForm.startMonth ? [classForm.startMonth] : [])
      };
      // Resolve custom subject
      if (payload.grade === 'Grade 12' || payload.grade === 'Grade 13') {
        if (payload.subject === 'Custom') {
          payload.subject = payload.customSubject;
        }
      } else {
        payload.stream = null;
        payload.subject = null;
      }
      
      if (editingClassId) {
        await physicalCrmService.updateClass(editingClassId, payload);
        toast.success('Class updated successfully!');
        setEditingClassId(null);
      } else {
        await physicalCrmService.createClass(payload);
        toast.success('Class created with billing schedule successfully!');
      }

      setClassForm({ 
        name: '', 
        grade: '', 
        stream: '', 
        subject: '', 
        customSubject: '', 
        monthlyFee: '',
        startMonth: '',
        activeMonths: [],
        timetables: [] 
      });
      fetchData();
    } catch (err) {
      toast.error('Failed to save class: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleClassDelete = async (id) => {
    if(!window.confirm('Delete this class and its timetable slots?')) return;
    try {
      await physicalCrmService.deleteClass(id);
      if (editingClassId === id) cancelEditClass();
      toast.success('Class deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete class');
    }
  };

  // --- Teacher Edit & Submit Handlers ---
  const startEditTeacher = (t) => {
    setEditingTeacherId(t.id);
    setTeacherForm({
      name: t.name || '',
      address: t.address || '',
      whatsapp: t.whatsapp || '',
      phone: t.phone || '',
      classIds: t.classes ? t.classes.map(c => c.id) : [],
      instituteCut: t.instituteCut || 0,
      image: t.image || null
    });
    setImagePreview(getTeacherImageUrl(t.image));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Editing teacher: ' + t.name, { icon: '✏️' });
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setTeacherForm({ name: '', address: '', whatsapp: '', phone: '', classIds: [], instituteCut: 0, image: null });
    setImagePreview(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setTeacherForm(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTeacherId) {
        await physicalCrmService.updateTeacher(editingTeacherId, teacherForm);
        toast.success('Teacher updated successfully!');
        setEditingTeacherId(null);
      } else {
        await physicalCrmService.createTeacher(teacherForm);
        toast.success('Teacher registered successfully!');
      }

      setTeacherForm({ name: '', address: '', whatsapp: '', phone: '', classIds: [], instituteCut: 0, image: null });
      setImagePreview(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save teacher: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTeacherDelete = async (id) => {
    if(!window.confirm('Delete this teacher?')) return;
    try {
      await physicalCrmService.deleteTeacher(id);
      if (editingTeacherId === id) cancelEditTeacher();
      toast.success('Teacher deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete teacher');
    }
  };

  return (
    <div className="space-y-6 w-full min-h-full pb-10 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
            Class & Teacher Hub
          </h1>
          <p className="text-white/60 text-sm mt-1">Manage physical classes, set day & time schedules with AM/PM, and register or edit teachers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Classes with Timetable creation / Edit */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create / Edit Class Card */}
          <div className={`bg-black/40 backdrop-blur-xl border ${editingClassId ? 'border-blue-400/60 ring-2 ring-blue-500/30' : 'border-white/20'} p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden text-white transition-all`}>
            <div className="absolute top-0 left-0 w-36 h-36 bg-blue-500/15 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-md">
                <BookOpen size={20} className="text-blue-400" />
                {editingClassId ? 'Edit Class & Timetable' : 'Create Class & Timetable'}
              </h2>
              {editingClassId && (
                <button 
                  type="button" 
                  onClick={cancelEditClass}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Cancel Edit
                </button>
              )}
            </div>
            
            <form onSubmit={handleClassSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Grade</label>
                <select 
                  required 
                  value={classForm.grade} 
                  onChange={e => {
                    const newGrade = e.target.value;
                    const isAL = newGrade === 'Grade 12' || newGrade === 'Grade 13';
                    setClassForm({...classForm, grade: newGrade, stream: isAL ? (classForm.stream || '') : '', subject: isAL ? (classForm.subject || '') : ''});
                  }} 
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white appearance-none shadow-inner text-sm"
                >
                  <option value="" className="text-black">Allocate to Grade</option>
                  {[...Array(13)].map((_, i) => <option key={i+1} value={`Grade ${i+1}`} className="text-black">Grade {i+1}</option>)}
                </select>
              </div>

              {(classForm.grade === 'Grade 12' || classForm.grade === 'Grade 13') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Stream</label>
                    <select 
                      required 
                      value={classForm.stream} 
                      onChange={e => setClassForm({...classForm, stream: e.target.value, subject: ''})} 
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white appearance-none shadow-inner text-xs"
                    >
                      <option value="" className="text-black">Select Stream</option>
                      {STREAMS.map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Subject</label>
                    <select 
                      required 
                      value={classForm.subject} 
                      onChange={e => setClassForm({...classForm, subject: e.target.value})} 
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white appearance-none shadow-inner text-xs" 
                      disabled={!classForm.stream}
                    >
                      <option value="" className="text-black">Select Subject</option>
                      {classForm.stream && STREAM_SUBJECTS[classForm.stream]?.map(sub => (
                        <option key={sub} value={sub} className="text-black">{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {classForm.subject === 'Custom' && (
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Custom Subject Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. IT, History" 
                    value={classForm.customSubject} 
                    onChange={e => setClassForm({...classForm, customSubject: e.target.value})} 
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white placeholder:text-white/30 shadow-inner text-sm" 
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Class Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Science Batch 1, A/L Econ 2028" 
                  value={classForm.name} 
                  onChange={e => setClassForm({...classForm, name: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white placeholder:text-white/30 shadow-inner text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Class Fee / Monthly Fee (Rs.)</span>
                  <span className="text-[9px] text-white/40 font-normal lowercase">(optional - default: 0)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/80 font-bold text-xs">Rs.</span>
                  <input 
                    type="number" 
                    min="0"
                    step="50"
                    placeholder="e.g. 3500" 
                    value={classForm.monthlyFee} 
                    onChange={e => setClassForm({...classForm, monthlyFee: e.target.value})} 
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-emerald-500/30 rounded-xl focus:ring-2 focus:ring-emerald-500/40 outline-none text-emerald-300 font-bold placeholder:text-white/30 shadow-inner text-sm" 
                  />
                </div>
              </div>

              {/* START MONTH & ACTIVE BILLING MONTHS (ONE-BY-ONE MANAGER) */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} /> Class Billing Months
                  </span>
                  <span className="text-[10px] text-white/50">Start Month & Active Months</span>
                </div>

                {/* Start Month Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Start Month</label>
                    <input 
                      type="month"
                      value={classForm.startMonth}
                      onChange={e => handleStartMonthChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500/40 outline-none text-white text-xs font-bold shadow-inner cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={handleAddNextMonth}
                      className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus size={14} /> + Add Next Month
                    </button>
                  </div>
                </div>

                {/* Custom Month Picker */}
                <div className="flex gap-2">
                  <input 
                    type="month"
                    value={customMonthInput}
                    onChange={e => setCustomMonthInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none"
                    placeholder="Pick specific month"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomMonth}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/90 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center gap-1 shrink-0"
                  >
                    <Plus size={13} /> Add Month
                  </button>
                </div>

                {/* Active Billing Months Chips */}
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Active Billing Months ({classForm.activeMonths?.length || 0})</span>
                    <span className="text-[9px] text-emerald-400/70 font-normal">months students pay fees for</span>
                  </label>
                  
                  {classForm.activeMonths && classForm.activeMonths.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                      {classForm.activeMonths.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                          <span className="text-emerald-300 font-extrabold">{formatMonthYear(m)}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveMonth(m)}
                            className="text-white/40 hover:text-red-400 transition-colors ml-1"
                            title="Remove month"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/40 italic bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                      No active months set yet. Pick a Start Month above.
                    </p>
                  )}
                </div>
              </div>

              {/* TIMETABLE SCHEDULE SECTION (DAY + START & END TIME WITH AM/PM) */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} /> Class Timetable Schedule
                  </span>
                  <span className="text-[11px] text-white/50">Day & Time (AM/PM)</span>
                </div>

                {/* Day of Week & Hall Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Day of Week</label>
                    <select 
                      value={slotDay} 
                      onChange={e => setSlotDay(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white text-xs font-semibold appearance-none shadow-inner"
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day} className="text-black">{day}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1">
                        🏢 Hall / Location
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowAddHallInput(!showAddHallInput)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {showAddHallInput ? 'Cancel' : '+ New Hall'}
                      </button>
                    </div>

                    {showAddHallInput ? (
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="text" 
                          placeholder="Hall name (e.g. Hall 01)"
                          value={newHallInputName}
                          onChange={e => setNewHallInputName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-black/40 border border-blue-500/40 rounded-lg text-xs text-white outline-none"
                        />
                        <button 
                          type="button"
                          onClick={handleQuickCreateHall}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={slotHallId} 
                        onChange={e => setSlotHallId(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/40 outline-none text-white text-xs font-semibold appearance-none shadow-inner"
                      >
                        <option value="" className="text-black">-- Select Hall (Optional) --</option>
                        {halls.map(h => (
                          <option key={h.id} value={h.id} className="text-black">{h.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Start Time & End Time with AM/PM */}
                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Start Time */}
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1.5">
                    <label className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} /> Start Time
                    </label>
                    <div className="flex items-center gap-1">
                      <select 
                        value={slotStartHour} 
                        onChange={e => setSlotStartHour(e.target.value)}
                        className="w-12 py-1 px-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-white text-center outline-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                          <option key={h} value={h} className="text-black">{h}</option>
                        ))}
                      </select>
                      <span className="text-white/60 font-bold">:</span>
                      <select 
                        value={slotStartMin} 
                        onChange={e => setSlotStartMin(e.target.value)}
                        className="w-12 py-1 px-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-white text-center outline-none"
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m} className="text-black">{m}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSlotStartPeriod(p => p === 'AM' ? 'PM' : 'AM')}
                        className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${slotStartPeriod === 'AM' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}
                      >
                        {slotStartPeriod}
                      </button>
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1.5">
                    <label className="block text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} /> End Time
                    </label>
                    <div className="flex items-center gap-1">
                      <select 
                        value={slotEndHour} 
                        onChange={e => setSlotEndHour(e.target.value)}
                        className="w-12 py-1 px-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-white text-center outline-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => (
                          <option key={h} value={h} className="text-black">{h}</option>
                        ))}
                      </select>
                      <span className="text-white/60 font-bold">:</span>
                      <select 
                        value={slotEndMin} 
                        onChange={e => setSlotEndMin(e.target.value)}
                        className="w-12 py-1 px-1 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-white text-center outline-none"
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m} className="text-black">{m}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSlotEndPeriod(p => p === 'AM' ? 'PM' : 'AM')}
                        className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${slotEndPeriod === 'AM' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}
                      >
                        {slotEndPeriod}
                      </button>
                    </div>
                  </div>

                </div>

                {/* Add slot button */}
                <button
                  type="button"
                  onClick={handleAddSlotToClass}
                  className="w-full py-2 bg-white/10 hover:bg-white/15 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> Add Schedule Slot ({slotDay} {slotStartHour}:{slotStartMin} {slotStartPeriod} - {slotEndHour}:{slotEndMin} {slotEndPeriod})
                </button>

                {/* Selected slots list for this class */}
                {classForm.timetables.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Scheduled Slots for this class:</span>
                    <div className="flex flex-wrap gap-2">
                      {classForm.timetables.map((slot, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                          <span className="text-blue-300 font-extrabold">{slot.dayOfWeek.slice(0, 3)}</span>
                          <span className="text-white/90">{formatTime12Hour(slot.startTime)} - {formatTime12Hour(slot.endTime)}</span>
                          {slot.hallName && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                              🏢 {slot.hallName}
                            </span>
                          )}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSlotFromClass(sIdx)}
                            className="text-white/40 hover:text-red-400 transition-colors ml-1"
                            title="Remove slot"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {editingClassId && (
                  <button 
                    type="button" 
                    onClick={cancelEditClass}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-xl font-bold transition-all text-sm"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className={`flex-1 py-3 ${editingClassId ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'} text-white rounded-xl font-bold shadow-lg transition-all text-sm tracking-wide`}
                >
                  {editingClassId ? 'Update Class' : 'Add Class'}
                </button>
              </div>
            </form>
          </div>

          {/* List Classes Card */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-h-[300px] text-white flex flex-col">
             <div className="flex flex-col gap-3 mb-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-white drop-shadow-md flex items-center gap-2">
                   Active Classes <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70 font-bold">{classes.length}</span>
                 </h3>
               </div>
               <div className="relative w-full">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                 <input 
                   type="text" 
                   placeholder="Search classes..." 
                   value={activeClassSearch}
                   onChange={(e) => setActiveClassSearch(e.target.value)}
                   className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/30 outline-none text-white text-sm placeholder:text-white/30 shadow-inner"
                 />
               </div>
             </div>
             
             <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar flex-1">
               {classes.filter(c => 
                 c.name.toLowerCase().includes(activeClassSearch.toLowerCase()) || 
                 c.grade.toLowerCase().includes(activeClassSearch.toLowerCase()) ||
                 (c.stream && c.stream.toLowerCase().includes(activeClassSearch.toLowerCase())) ||
                 (c.subject && c.subject.toLowerCase().includes(activeClassSearch.toLowerCase()))
               ).map(c => {
                 let classMonths = [];
                 if (Array.isArray(c.activeMonths)) classMonths = c.activeMonths;
                 else if (typeof c.activeMonths === 'string') {
                   try { classMonths = JSON.parse(c.activeMonths); } catch(e) { classMonths = [c.activeMonths]; }
                 } else if (c.startMonth) {
                   classMonths = [c.startMonth];
                 }

                 return (
                  <div 
                    key={c.id} 
                    className={`p-3.5 bg-white/5 rounded-xl border ${editingClassId === c.id ? 'border-blue-400 ring-2 ring-blue-500/30 bg-blue-500/10' : 'border-white/10'} shadow-inner hover:border-white/20 transition-all space-y-2`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white drop-shadow-sm text-sm">
                            {c.name}
                          </p>
                          {c.stream && <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[9px] uppercase tracking-wider border border-blue-500/20">{c.stream}</span>}
                          {c.subject && <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[9px] uppercase tracking-wider border border-purple-500/20">{c.subject}</span>}
                          {c.monthlyFee > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold tracking-wide border border-emerald-500/30">
                              Rs. {Number(c.monthlyFee).toLocaleString()} / mo
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-white/40 text-[9px] font-medium border border-white/10">
                              No Fee Set
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-0.5">{c.grade}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => startEditClass(c)} 
                          className="p-1.5 text-white/50 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit class"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleClassDelete(c.id)} 
                          className="p-1.5 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Delete class"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Active Billing Months Preview */}
                    {classMonths.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[9px] text-emerald-400/80 font-bold uppercase tracking-wider">Billing Months:</span>
                        {classMonths.map((m, idx) => (
                          <span key={idx} className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            {formatMonthYear(m)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Timetable schedule preview for this class */}
                    {c.timetables && c.timetables.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.timetables.map((tt, tIdx) => (
                          <span key={tIdx} className="text-[11px] font-semibold bg-blue-500/15 border border-blue-500/20 text-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Clock size={11} className="text-blue-400" />
                            <strong className="text-blue-300">{tt.dayOfWeek.slice(0, 3)}</strong> {formatTime12Hour(tt.startTime)} - {formatTime12Hour(tt.endTime)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-white/40 italic flex items-center gap-1">
                        <Clock size={10} /> No timetable set
                      </span>
                    )}

                    {/* Assigned Teachers */}
                    {c.teachers && c.teachers.length > 0 && (
                      <div className="text-[10px] text-purple-300 font-medium pt-1 flex items-center gap-1">
                        <Users size={11} /> Teacher: {c.teachers.map(t => t.name).join(', ')}
                      </div>
                    )}
                  </div>
                 );
               })}
               {classes.length === 0 && (
                 <div className="text-center py-10 text-white/40 text-xs italic">
                   No active classes yet. Create one above.
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Teacher Registration / Edit */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Register / Edit Teacher Card */}
          <div className={`bg-black/40 backdrop-blur-xl border ${editingTeacherId ? 'border-purple-400/60 ring-2 ring-purple-500/30' : 'border-white/20'} p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden text-white transition-all`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-md">
                <Users size={20} className="text-purple-400" />
                {editingTeacherId ? 'Edit Teacher' : 'Teacher Registration'}
              </h2>
              {editingTeacherId && (
                <button 
                  type="button" 
                  onClick={cancelEditTeacher}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Cancel Edit
                </button>
              )}
            </div>
            
            <form onSubmit={handleTeacherSubmit} className="space-y-5">
              
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Profile Pic */}
                <div className="flex flex-col items-center gap-2">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-28 h-28 rounded-full border-2 border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-purple-400 transition-colors bg-white/5 relative shadow-inner"
                  >
                    {imagePreview ? (
                      <img 
                        src={getTeacherImageUrl(imagePreview)} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherForm.name || 'Teacher')}&background=7c3aed&color=fff&bold=true`;
                        }}
                      />
                    ) : (
                      <>
                        <Camera size={28} className="text-white/40 group-hover:text-purple-400 mb-1 transition-colors" />
                        <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider text-center px-1">Upload Pic</span>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={20} className="text-white" />
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>

                {/* Info Fields */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Dr. Kasun Perera" 
                      value={teacherForm.name} 
                      onChange={e => setTeacherForm({...teacherForm, name: e.target.value})} 
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white shadow-inner text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Phone</label>
                    <input 
                      type="text" 
                      placeholder="0771234567" 
                      value={teacherForm.phone} 
                      onChange={e => setTeacherForm({...teacherForm, phone: e.target.value})} 
                      className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white shadow-inner text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">WhatsApp</label>
                    <input 
                      type="text" 
                      placeholder="0771234567" 
                      value={teacherForm.whatsapp} 
                      onChange={e => setTeacherForm({...teacherForm, whatsapp: e.target.value})} 
                      className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white shadow-inner text-xs" 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Colombo, Kandy" 
                      value={teacherForm.address} 
                      onChange={e => setTeacherForm({...teacherForm, address: e.target.value})} 
                      className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white shadow-inner text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Allocate Classes (Unlimited) */}
              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">Allocate to Classes</label>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <input 
                        type="text" 
                        placeholder="Search classes to allocate..." 
                        value={teacherClassSearch}
                        onChange={(e) => setTeacherClassSearch(e.target.value)}
                        onFocus={() => setShowClassDropdown(true)}
                        className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white text-xs shadow-inner"
                      />
                    </div>
                    {teacherForm.classIds.length > 0 && (
                      <div className="text-xs font-bold text-purple-400 bg-purple-500/15 px-3 py-2 rounded-xl border border-purple-500/20 whitespace-nowrap">
                        {teacherForm.classIds.length} Selected
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Classes Chips */}
                  {teacherForm.classIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {teacherForm.classIds.map(id => {
                        const c = classes.find(cls => cls.id === id);
                        if (!c) return null;
                        return (
                          <div key={c.id} className="flex items-center gap-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                            <span>{c.name} ({c.grade})</span>
                            <button 
                              type="button" 
                              onClick={() => setTeacherForm({...teacherForm, classIds: teacherForm.classIds.filter(cid => cid !== c.id)})} 
                              className="hover:text-red-400 ml-1 text-white/60"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Class selection dropdown */}
                  {showClassDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-[#151520] border border-white/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-h-52 overflow-y-auto custom-scrollbar p-2">
                      <div className="flex justify-between items-center mb-1.5 px-2">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Select Classes</span>
                        <button type="button" onClick={() => setShowClassDropdown(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
                      </div>
                      <div className="space-y-1">
                        {classes.filter(c => c.name.toLowerCase().includes(teacherClassSearch.toLowerCase()) || c.grade.toLowerCase().includes(teacherClassSearch.toLowerCase())).map(c => (
                          <div 
                            key={c.id}
                            onClick={() => {
                              const isSelected = teacherForm.classIds.includes(c.id);
                              if (isSelected) {
                                setTeacherForm({...teacherForm, classIds: teacherForm.classIds.filter(id => id !== c.id)});
                              } else {
                                setTeacherForm({...teacherForm, classIds: [...teacherForm.classIds, c.id]});
                              }
                            }}
                            className={`cursor-pointer px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${teacherForm.classIds.includes(c.id) ? 'bg-purple-500/25 text-purple-300 font-bold' : 'hover:bg-white/5 text-white/70'}`}
                          >
                            <span>{c.name} <span className="text-white/40 text-[10px] ml-1">({c.grade})</span></span>
                            {teacherForm.classIds.includes(c.id) && <Check size={14} className="text-purple-400" />}
                          </div>
                        ))}
                        {classes.length === 0 && <span className="text-xs text-white/40 italic p-2 block">No classes available. Create a class first.</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Institute Cut (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={teacherForm.instituteCut} 
                  onChange={e => setTeacherForm({...teacherForm, instituteCut: parseFloat(e.target.value) || 0})} 
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/40 outline-none text-white shadow-inner text-sm font-semibold" 
                />
              </div>

              <div className="flex gap-2 pt-2">
                {editingTeacherId && (
                  <button 
                    type="button" 
                    onClick={cancelEditTeacher}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-xl font-bold transition-all text-sm"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className={`flex-1 py-3 ${editingTeacherId ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30'} text-white rounded-xl font-bold shadow-lg transition-all text-sm tracking-wide`}
                >
                  {editingTeacherId ? 'Update Teacher' : 'Register Teacher'}
                </button>
              </div>
            </form>
          </div>

          {/* Registered Teachers List */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-white">
            <h3 className="text-lg font-bold text-white mb-4 drop-shadow-md flex items-center justify-between">
              <span>Registered Teachers</span>
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-white/70 font-bold">{teachers.length}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {teachers.map(t => (
                <div 
                  key={t.id} 
                  className={`p-4 bg-white/5 rounded-2xl border ${editingTeacherId === t.id ? 'border-purple-400 ring-2 ring-purple-500/30 bg-purple-500/10' : 'border-white/10'} flex gap-4 shadow-inner hover:border-white/20 transition-all`}
                >
                  {t.image ? (
                    <img 
                      src={getTeacherImageUrl(t.image)} 
                      alt={t.name} 
                      className="w-16 h-16 rounded-xl object-cover shadow-sm border border-white/20 shrink-0" 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=7c3aed&color=fff&bold=true`;
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-sm border border-white/20 shrink-0">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-white leading-tight drop-shadow-sm truncate text-sm">{t.name}</h4>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => startEditTeacher(t)} 
                          className="text-white/50 hover:text-purple-400 transition-colors p-1 hover:bg-white/10 rounded-lg"
                          title="Edit teacher"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleTeacherDelete(t.id)} 
                          className="text-white/50 hover:text-red-400 transition-colors p-1 hover:bg-white/10 rounded-lg"
                          title="Delete teacher"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {t.phone && <p className="text-[11px] text-white/50 mt-0.5">{t.phone}</p>}
                    
                    {/* Classes badges */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.classes && t.classes.map(c => (
                         <span key={c.id} className="text-[10px] font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-500/20 uppercase tracking-wider">
                           {c.name}
                         </span>
                      ))}
                    </div>
                    
                    {t.instituteCut > 0 && (
                      <p className="text-[10px] font-bold text-emerald-400 mt-1 uppercase tracking-wider">
                        Inst. Cut: {t.instituteCut}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {teachers.length === 0 && (
                <div className="col-span-2 text-center py-12 text-white/40 text-xs italic">
                  No teachers registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

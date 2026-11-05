import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, BookOpen, User, X, Trash2, Filter, Building2, Layers, Pencil, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function ClassTimetable() {
    const [loading, setLoading] = useState(false);
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
    const userRole = storedUser.role ? storedUser.role.toUpperCase().replace(/[\s_-]+/g, '_') : 'STAFF';

    // Role Permissions
    const canEdit = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN', 'PHYSICAL_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'CALL_CENTER_SUPERVISOR'].includes(userRole) || userRole.includes('MANAG');

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState([]);
    const [calendarTab, setCalendarTab] = useState('THEORY'); // 'THEORY' | 'PAPER' | 'DUAL'
    const [schedulingCategory, setSchedulingCategory] = useState('THEORY'); // 'THEORY' | 'PAPER'
    
    // Selection State
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState('');

    // Content Hub Data (combined for all batches in biz)
    const [subjects, setSubjects] = useState([]);
    const [lecturers, setLecturers] = useState([]);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    
    // Form State (New & Edit Class)
    const [selectedBatchesForNew, setSelectedBatchesForNew] = useState([]);
    const [newClassSubject, setNewClassSubject] = useState('');
    const [newClassLecturer, setNewClassLecturer] = useState('');

    // Edit Form State
    const [selectedBatchesForEdit, setSelectedBatchesForEdit] = useState([]);
    const [editSubject, setEditSubject] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editLecturer, setEditLecturer] = useState('');
    const [editDate, setEditDate] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedBiz) {
            fetchSchedule();
            extractAllBatchData();
        }
    }, [selectedBiz, currentDate, batches]);

    const fetchInitialData = async () => {
        try {
            const bizRes = await api.get('/admin/businesses'); 
            const fetchedBiz = bizRes.data?.businesses || bizRes.data || [];
            setBusinesses(fetchedBiz);
            if (fetchedBiz.length === 1) {
                const bId = fetchedBiz[0].id.toString();
                setSelectedBiz(bId);
                const batchRes = await api.get(`/admin/batches/${bId}`);
                setBatches(batchRes.data?.batches || batchRes.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleBusinessChange = async (e) => {
        const bizId = e.target.value;
        setSelectedBiz(bizId);
        setSchedule([]);
        if (bizId) {
            try {
                const batchRes = await api.get(`/admin/batches/${bizId}`);
                setBatches(batchRes.data?.batches || batchRes.data || []);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const extractAllBatchData = () => {
        let subs = [];
        let allLecturers = [];

        batches.forEach(batch => {
            batch?.groups?.forEach(g => {
                g.courses?.forEach(c => {
                    const cType = parseInt(c.courseType || g.classType || 1);
                    const tag = cType === 2 ? 'Paper' : 'Theory';
                    const hasTagInName = c.name.toLowerCase().includes('paper') || c.name.toLowerCase().includes('theory');
                    const displayName = hasTagInName ? c.name : `${c.name} (${tag})`;
                    if (!subs.find(s => s.displayName === displayName)) {
                        subs.push({ ...c, courseType: cType, displayName });
                    }
                });
            });

            try {
                if (batch.lecturers) {
                    const parsed = JSON.parse(batch.lecturers);
                    parsed.forEach(l => {
                        if (!allLecturers.find(ex => ex.name === l.name)) allLecturers.push(l);
                    });
                }
            } catch (e) {}
        });

        setSubjects(subs);
        setLecturers(allLecturers);
    };

    const fetchSchedule = async () => {
        if (!selectedBiz) return;
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const res = await api.get(`/admin/timetable?businessId=${selectedBiz}&year=${year}&month=${month}`);
            setSchedule(res.data || []);
        } catch (e) {
            toast.error("Failed to load schedule");
        } finally {
            setLoading(false);
        }
    };

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const blanks = Array(firstDayOfMonth).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getLocalDateStr = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isPaperClass = (event) => {
        if (!event) return false;
        const sub = (event.subjectName || '').toLowerCase();
        const title = (event.title || '').toLowerCase();
        const paperKeywords = [
            'paper',
            'revision',
            'ප්‍රශ්න පත්‍ර',
            'ප්‍රශ්නපත්‍ර',
            'පේපර්',
            'රිවිෂන්',
            'question paper',
            'model paper',
            'past paper'
        ];
        return paperKeywords.some(kw => sub.includes(kw) || title.includes(kw));
    };

    const isTheoryClass = (event) => !isPaperClass(event);

    const theorySchedule = schedule.filter(isTheoryClass);
    const paperSchedule = schedule.filter(isPaperClass);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        
        if (submitting) return;

        if (selectedBatchesForNew.length === 0) {
            toast.error("Please select at least one batch!");
            return;
        }

        const formData = new FormData(e.target);
        let rawSubject = formData.get('subjectName') || '';
        const subLower = rawSubject.toLowerCase();
        const hasTag = subLower.includes('paper') || subLower.includes('theory') || subLower.includes('revision');
        let finalSubject = rawSubject;
        if (!hasTag) {
            finalSubject = schedulingCategory === 'PAPER' ? `${rawSubject} (Paper)` : `${rawSubject} (Theory)`;
        }

        const payload = {
            businessId: selectedBiz,
            batchIds: selectedBatchesForNew,
            date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
            subjectName: finalSubject,
            title: formData.get('title'),
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            lecturerName: formData.get('lecturerName') || null,
            optionalMCQ: formData.get('optionalMCQ') === 'on',
            optionalPaper: formData.get('optionalPaper') === 'on'
        };

        setSubmitting(true);
        try {
            await api.post('/admin/timetable', payload);
            toast.success(`${schedulingCategory === 'PAPER' ? 'Paper' : 'Theory'} Class Scheduled!`);
            setShowAddModal(false);
            setSelectedBatchesForNew([]);
            fetchSchedule();
        } catch (error) {
            toast.error("Failed to schedule class");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("Are you sure you want to delete this class?")) return;
        try {
            await api.delete(`/admin/timetable/${id}`);
            toast.success("Class deleted");
            setShowViewModal(false);
            fetchSchedule();
        } catch (e) {
            toast.error("Failed to delete class");
        }
    };

    const getLecturerImage = (lecName) => {
        if (!lecName) return null;
        const foundSub = subjects.find(s => s.lecturerName === lecName);
        if (foundSub && foundSub.groupPrices) {
            try {
                const parsed = typeof foundSub.groupPrices === 'string' ? JSON.parse(foundSub.groupPrices) : foundSub.groupPrices;
                if (parsed?.[0]?.lecturerImage) {
                    const baseUrl = api.defaults.baseURL.replace('/api', '');
                    return `${baseUrl}/storage/icons/${parsed[0].lecturerImage}`;
                }
            } catch(e) {}
        }
        return null;
    };

    const getBusinessName = () => businesses.find(b => b.id.toString() === selectedBiz?.toString())?.name || '';

    const handleSubjectChange = (e) => {
        const selectedSub = e.target.value;
        setNewClassSubject(selectedSub);
        
        const foundSub = subjects.find(s => (s.displayName || s.name) === selectedSub || s.name === selectedSub);
        if (foundSub && foundSub.lecturerName) {
            setNewClassLecturer(foundSub.lecturerName);
        } else {
            setNewClassLecturer('');
        }
    };

    const startEditing = (evt) => {
        setEditSubject(evt.subjectName || '');
        setEditTitle(evt.title || '');
        setEditStartTime(evt.startTime || '');
        setEditEndTime(evt.endTime || '');
        setEditLecturer(evt.lecturerName || '');
        setEditDate(evt.date ? getLocalDateStr(evt.date) : '');
        
        let eventBatches = [];
        if (evt.batchId) eventBatches.push(evt.batchId);
        if (evt.additionalBatchIds) {
            try {
                const parsed = typeof evt.additionalBatchIds === 'string' ? JSON.parse(evt.additionalBatchIds) : evt.additionalBatchIds;
                if (Array.isArray(parsed)) {
                    eventBatches.push(...parsed);
                }
            } catch(e) {}
        }
        setSelectedBatchesForEdit([...new Set(eventBatches)]);
        setIsEditing(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (selectedBatchesForEdit.length === 0) {
            toast.error("Please select at least one batch!");
            return;
        }
        try {
            await api.put(`/admin/timetable/${selectedEvent.id}`, {
                subjectName: editSubject,
                title: editTitle,
                startTime: editStartTime,
                endTime: editEndTime,
                lecturerName: editLecturer,
                date: editDate,
                batchIds: selectedBatchesForEdit
            });
            toast.success("Class timetable updated successfully!");
            setShowViewModal(false);
            setIsEditing(false);
            fetchSchedule();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to update timetable class");
        }
    };

    const renderCalendarGrid = (type, eventList) => {
        const isPaper = type === 'PAPER';
        const calTitle = isPaper ? 'Paper & Revision Calendar' : 'Theory Classes Calendar';
        const calSubtitle = isPaper ? 'ප්‍රශ්න පත්‍ර හා රිවිෂන් පන්ති කාලසටහන' : 'තියරි පන්ති කාලසටහන';
        
        const theme = isPaper ? {
            containerBorder: 'border-purple-200/80 dark:border-purple-500/20',
            headerBg: 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/70 dark:border-purple-500/20',
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-white dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
            badgeBg: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
            eventBorder: 'border-purple-200/80 dark:border-purple-500/20 hover:border-purple-400 dark:hover:border-purple-400 hover:bg-purple-50/40 dark:hover:bg-purple-950/30',
            batchTag: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            btn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
            dayHover: 'hover:border-purple-400/50 hover:bg-purple-50/20 dark:hover:bg-purple-950/20',
            tagLabel: 'PAPER'
        } : {
            containerBorder: 'border-blue-200/80 dark:border-blue-500/20',
            headerBg: 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-500/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-white dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
            badgeBg: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
            eventBorder: 'border-blue-200/80 dark:border-blue-500/20 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/30',
            batchTag: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
            dayHover: 'hover:border-blue-400/50 hover:bg-blue-50/20 dark:hover:bg-blue-950/20',
            tagLabel: 'THEORY'
        };

        return (
            <div className={`bg-white dark:bg-brand-darkCard border ${theme.containerBorder} p-4 md:p-8 rounded-3xl shadow-sm transition-colors mb-8 last:mb-0`}>
                {/* Calendar Sub-Header */}
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 ${theme.headerBg} p-4 md:px-6 md:py-4 rounded-2xl border transition-colors shadow-sm`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl border shadow-sm ${theme.iconBg}`}>
                            {isPaper ? <FileText size={24} /> : <BookOpen size={24} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-wider transition-colors">
                                    {calTitle}
                                </h3>
                                <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}>
                                    {eventList.length} {eventList.length === 1 ? 'Class' : 'Classes'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-brand-darkTextMuted font-bold mt-0.5">
                                {calSubtitle} • {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedDay(new Date().getDate());
                                    setSelectedBatchesForNew([]);
                                    setNewClassSubject('');
                                    setNewClassLecturer('');
                                    setSchedulingCategory(type);
                                    setShowAddModal(true);
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all ${theme.btn}`}
                            >
                                <Plus size={16} />
                                <span>Schedule {isPaper ? 'Paper' : 'Theory'} Class</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Days of Week */}
                <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, idx) => (
                        <div key={day} className={`text-center font-black text-[10px] md:text-xs tracking-widest pb-3 border-b-2 transition-colors ${idx === 0 || idx === 6 ? 'text-brand-accent border-brand-accent/30' : 'text-gray-500 dark:text-slate-500 border-gray-200 dark:border-brand-darkBorder'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 md:gap-4">
                    {/* Blank Cells */}
                    {blanks.map((_, i) => (
                        <div key={`blank-${type}-${i}`} className="min-h-[100px] md:min-h-[140px] rounded-2xl bg-gray-50 dark:bg-brand-darkBg border border-gray-100 dark:border-brand-darkBorder opacity-50 transition-colors"></div>
                    ))}
                    
                    {/* Actual Days */}
                    {days.map(day => {
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = eventList.filter(e => getLocalDateStr(e.date) === dateStr);
                        const isToday = getLocalDateStr(new Date().toISOString()) === dateStr;

                        return (
                            <div 
                                key={`${type}-${day}`} 
                                onClick={() => { 
                                    if(canEdit) { 
                                        setSelectedDay(day); 
                                        setSelectedBatchesForNew([]); 
                                        setNewClassSubject(''); 
                                        setNewClassLecturer(''); 
                                        setSchedulingCategory(type);
                                        setShowAddModal(true); 
                                    } 
                                }}
                                className={`min-h-[110px] md:min-h-[140px] p-2 md:p-3 rounded-2xl border transition-all relative flex flex-col group overflow-hidden ${
                                    canEdit ? `cursor-pointer ${theme.dayHover} hover:shadow-md` : ''
                                } ${isToday ? 'bg-brand-accentLight/50 dark:bg-brand-accentLight border-brand-accent/40 shadow-[inset_0_0_20px_var(--theme-light)]' : 'bg-white dark:bg-brand-darkBg border-gray-200 dark:border-brand-darkBorder shadow-sm'}`}
                            >
                                {/* Day Number */}
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`flex items-center justify-center text-sm md:text-base font-black w-7 h-7 md:w-8 md:h-8 rounded-full z-10 transition-colors ${
                                        isToday ? 'bg-brand-accent text-white shadow-md' : 'text-gray-500 dark:text-slate-400 group-hover:text-brand-accent dark:group-hover:text-brand-accent'
                                    }`}>
                                        {day}
                                    </span>
                                    {canEdit && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-accent bg-brand-accentLight p-1.5 rounded-lg">
                                            <Plus size={14}/>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Events Container */}
                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar relative z-10">
                                    {dayEvents.map(event => {
                                        const lecImg = getLecturerImage(event.lecturerName);
                                        return (
                                        <div 
                                            key={event.id} 
                                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setShowViewModal(true); }}
                                            className={`bg-gray-50 dark:bg-brand-darkCard border ${theme.eventBorder} p-2 md:p-2.5 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col gap-1.5`}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-[10px] md:text-xs truncate leading-tight transition-colors flex-1" title={event.subjectName}>
                                                    {event.subjectName}
                                                </h4>
                                                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                                    <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded border ${theme.batchTag}`} title={event.batch?.name}>
                                                        {event.batch?.name?.substring(0, 6) || 'BATCH'}
                                                    </span>
                                                    {(() => {
                                                        if (!event.additionalBatchIds) return null;
                                                        try {
                                                            const ids = typeof event.additionalBatchIds === 'string' ? JSON.parse(event.additionalBatchIds) : event.additionalBatchIds;
                                                            if (Array.isArray(ids) && ids.length > 0) {
                                                                return (
                                                                    <span className="text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1 py-0.5 rounded font-bold" title={`+${ids.length} more batches allocated`}>
                                                                        +{ids.length}
                                                                    </span>
                                                                );
                                                            }
                                                        } catch(e) {}
                                                        return null;
                                                    })()}
                                                    {canEdit && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }} 
                                                            className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-0.5 rounded transition-colors"
                                                            title="Delete Class"
                                                        >
                                                            <Trash2 size={11}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* TECH DEPT STATUS BADGES */}
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {event.hall ? (
                                                    <span className="text-[8px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-1 py-0.5 rounded font-bold uppercase" title="Allocated Hall">
                                                        {event.hall.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] bg-slate-500/10 text-slate-500 border border-slate-500/20 px-1 py-0.5 rounded font-bold uppercase" title="No Hall Assigned">
                                                        Pending Hall
                                                    </span>
                                                )}
                                                {event.deliveryStatus === 'DELIVERED' ? (
                                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.5 rounded font-bold uppercase" title="Deliverables Sent">
                                                        Link Sent
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded font-bold uppercase" title="Deliverables Pending">
                                                        Link Pending
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mt-1.5 gap-2">
                                                <span className="text-[9px] md:text-[10px] text-gray-600 dark:text-slate-300 font-semibold flex items-center gap-1 bg-white dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder px-1.5 py-0.5 rounded-md truncate transition-colors">
                                                    <Clock size={10} className="text-brand-accent"/> {event.startTime}
                                                </span>
                                                {lecImg ? (
                                                    <img src={lecImg} alt={event.lecturerName} className="w-4 h-4 md:w-5 md:h-5 rounded-full object-cover shrink-0 border border-gray-200 dark:border-brand-darkBorder shadow-sm" />
                                                ) : (
                                                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-gray-100 dark:bg-brand-darkBg flex items-center justify-center shrink-0 border border-gray-200 dark:border-brand-darkBorder transition-colors">
                                                        <User size={10} className="text-gray-400 dark:text-slate-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full text-gray-900 dark:text-slate-200 font-sans pb-10 animate-in fade-in duration-300 transition-colors">
            
            {/* HEADER & FILTERS */}
            <div className="mb-6 bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-accentLight rounded-2xl border border-brand-accent/20 text-brand-accent transition-colors">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-wide transition-colors">Class Timetable</h2>
                        <p className="text-gray-500 dark:text-brand-darkTextMuted text-sm font-medium mt-1 transition-colors">Schedule and manage upcoming classes & events</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto bg-gray-50 dark:bg-brand-darkBg p-2 rounded-2xl border border-gray-200 dark:border-brand-darkBorder transition-colors shadow-sm">
                    {businesses.length > 1 && (
                        <>
                            <div className="relative flex-1 sm:w-64">
                                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 transition-colors" />
                                <select value={selectedBiz} onChange={handleBusinessChange} className="w-full bg-transparent border-none text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-0 appearance-none pl-11 pr-4 py-3 cursor-pointer transition-colors">
                                    <option value="" className="bg-white dark:bg-brand-darkCard text-gray-700 dark:text-white">-- Select Business --</option>
                                    {businesses.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-brand-darkCard text-gray-700 dark:text-white">{b.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* DYNAMIC BIZ HEADER */}
            {selectedBiz && (
                <div className="mb-6 bg-brand-accentLight border border-brand-accent/20 p-5 md:p-6 rounded-3xl flex items-center justify-between shadow-sm transition-colors">
                   <div>
                       <h3 className="text-brand-accent font-bold text-xs uppercase tracking-widest mb-1 transition-colors">Business Calendar</h3>
                       <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white transition-colors">{getBusinessName()}</h2>
                   </div>
                   <div className="hidden md:flex items-center gap-3">
                      <div className="bg-white dark:bg-brand-darkCard px-4 py-2 rounded-xl border border-brand-accent/20 shadow-sm transition-colors">
                        <span className="text-brand-accent text-xs font-bold uppercase block text-center transition-colors">Scheduled Classes</span>
                        <span className="text-gray-900 dark:text-white text-lg font-black block text-center transition-colors">{schedule.length}</span>
                      </div>
                   </div>
                </div>
            )}

            {/* CALENDAR VIEW TABS & SWITCHER */}
            {selectedBiz && (
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-brand-darkCard p-3 rounded-2xl border border-gray-200 dark:border-brand-darkBorder shadow-sm transition-colors">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCalendarTab('THEORY')}
                            className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center gap-2.5 transition-all outline-none ${
                                calendarTab === 'THEORY'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30'
                                    : 'bg-gray-50 dark:bg-brand-darkBg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-brand-darkBorder'
                            }`}
                        >
                            <BookOpen size={18} className={calendarTab === 'THEORY' ? 'text-white' : 'text-blue-500'} />
                            <span>Theory Calendar</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                calendarTab === 'THEORY' ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}>
                                {theorySchedule.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCalendarTab('PAPER')}
                            className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center gap-2.5 transition-all outline-none ${
                                calendarTab === 'PAPER'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-500/30'
                                    : 'bg-gray-50 dark:bg-brand-darkBg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-brand-darkBorder'
                            }`}
                        >
                            <FileText size={18} className={calendarTab === 'PAPER' ? 'text-white' : 'text-purple-500'} />
                            <span>Paper Calendar</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                calendarTab === 'PAPER' ? 'bg-white/20 text-white' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}>
                                {paperSchedule.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCalendarTab('DUAL')}
                            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center gap-2 transition-all outline-none ${
                                calendarTab === 'DUAL'
                                    ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/30 ring-2 ring-brand-accent/30'
                                    : 'bg-gray-50 dark:bg-brand-darkBg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-brand-darkBorder'
                            }`}
                        >
                            <Layers size={18} />
                            <span>Dual View</span>
                        </button>
                    </div>

                    {/* Month Navigator in bar */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-brand-darkBg p-1 rounded-xl border border-gray-200 dark:border-brand-darkBorder">
                            <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-brand-darkCard rounded-lg text-gray-600 dark:text-slate-300 transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-xs md:text-sm font-black px-3 text-gray-800 dark:text-white uppercase tracking-wider">
                                {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </span>
                            <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-brand-darkCard rounded-lg text-gray-600 dark:text-slate-300 transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CALENDAR SECTION */}
            {selectedBiz ? (
                <div>
                    {calendarTab === 'THEORY' && renderCalendarGrid('THEORY', theorySchedule)}
                    {calendarTab === 'PAPER' && renderCalendarGrid('PAPER', paperSchedule)}
                    {calendarTab === 'DUAL' && (
                        <div className="space-y-8">
                            {renderCalendarGrid('THEORY', theorySchedule)}
                            {renderCalendarGrid('PAPER', paperSchedule)}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-80 bg-white dark:bg-brand-darkCard rounded-3xl border border-gray-200 dark:border-brand-darkBorder shadow-sm transition-colors">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-brand-darkBg rounded-full flex items-center justify-center mb-4 border border-gray-200 dark:border-brand-darkBorder shadow-sm transition-colors">
                        <Calendar size={40} className="text-gray-400 dark:text-slate-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">No Business Selected</h3>
                    <p className="text-gray-500 dark:text-slate-400 font-medium text-sm text-center px-4 max-w-md transition-colors">Please select a Business from the filters above to view or manage the class schedule.</p>
                </div>
            )}

            {/* ----------------- MODALS ----------------- */}

            {/* SCHEDULE ADD MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 dark:bg-[#0a0f1c]/95 p-4 backdrop-blur-sm animate-in fade-in duration-200 transition-colors">
                    <div className="bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-3xl p-8 w-full max-w-5xl shadow-2xl relative transition-colors">
                        <div className="flex justify-between items-start mb-8 transition-colors">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 transition-colors">Schedule Class</h3>
                                <span className="bg-brand-accentLight text-brand-accent px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-accent/20 uppercase tracking-widest transition-colors">
                                    Date: {currentDate.getFullYear()}-{String(currentDate.getMonth() + 1).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')}
                                </span>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="bg-gray-100 dark:bg-brand-darkBg p-2.5 rounded-xl border border-gray-200 dark:border-brand-darkBorder text-gray-500 dark:text-slate-400 hover:text-white hover:bg-red-500 dark:hover:text-white dark:hover:bg-red-500 transition-colors outline-none"><X size={18}/></button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="flex flex-col gap-5">
                            {/* Class Category Switcher: Theory vs Paper */}
                            <div className="p-1.5 bg-gray-100 dark:bg-brand-darkBg rounded-2xl flex gap-2 border border-gray-200 dark:border-brand-darkBorder">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSchedulingCategory('THEORY');
                                        setNewClassSubject('');
                                        setNewClassLecturer('');
                                    }}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all outline-none ${
                                        schedulingCategory === 'THEORY'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50'
                                    }`}
                                >
                                    <BookOpen size={16} /> Theory Class (තියරි)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSchedulingCategory('PAPER');
                                        setNewClassSubject('');
                                        setNewClassLecturer('');
                                    }}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all outline-none ${
                                        schedulingCategory === 'PAPER'
                                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                                            : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/50'
                                    }`}
                                >
                                    <FileText size={16} /> Paper / Revision Class (ප්‍රශ්න පත්‍ර)
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column */}
                                <div className="space-y-5">
                                    {/* MULTI-BATCH SELECTION */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">Allocate to Batches *</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                                            {batches.map(b => (
                                                <label key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedBatchesForNew.includes(b.id) ? 'bg-brand-accentLight border-brand-accent/40 shadow-sm' : 'bg-gray-50 dark:bg-brand-darkBg border-gray-200 dark:border-brand-darkBorder hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 accent-brand-accent"
                                                        checked={selectedBatchesForNew.includes(b.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedBatchesForNew([...selectedBatchesForNew, b.id]);
                                                            else setSelectedBatchesForNew(selectedBatchesForNew.filter(id => id !== b.id));
                                                        }}
                                                    />
                                                    <span className="text-sm font-bold text-gray-700 dark:text-white">{b.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">
                                            {schedulingCategory === 'PAPER' ? 'Paper / Revision Subject *' : 'Theory Subject *'}
                                        </label>
                                        <select 
                                            name="subjectName" 
                                            value={newClassSubject} 
                                            onChange={handleSubjectChange} 
                                            required 
                                            className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3.5 text-sm text-gray-900 dark:text-white font-bold outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors cursor-pointer shadow-sm"
                                        >
                                            <option value="" className="text-gray-500 dark:text-slate-500">-- Select Subject --</option>
                                            {subjects
                                                .filter(sub => {
                                                    const isSubPaper = sub.courseType === 2 || (sub.displayName || sub.name).toLowerCase().includes('paper') || (sub.displayName || sub.name).toLowerCase().includes('revision');
                                                    return schedulingCategory === 'PAPER' ? isSubPaper : !isSubPaper;
                                                })
                                                .map((sub, i) => (
                                                    <option key={`p-${i}`} value={sub.displayName || sub.name} className="text-gray-900 dark:text-white">
                                                        {sub.displayName || sub.name}
                                                    </option>
                                                ))}
                                            <optgroup label="All Other Subjects">
                                                {subjects
                                                    .filter(sub => {
                                                        const isSubPaper = sub.courseType === 2 || (sub.displayName || sub.name).toLowerCase().includes('paper') || (sub.displayName || sub.name).toLowerCase().includes('revision');
                                                        return schedulingCategory === 'PAPER' ? !isSubPaper : isSubPaper;
                                                    })
                                                    .map((sub, i) => (
                                                        <option key={`o-${i}`} value={sub.displayName || sub.name} className="text-gray-900 dark:text-white">
                                                            {sub.displayName || sub.name}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">Lecturer (Optional)</label>
                                        <select name="lecturerName" value={newClassLecturer} onChange={(e) => setNewClassLecturer(e.target.value)} className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3.5 text-sm text-gray-900 dark:text-white font-bold outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors cursor-pointer shadow-sm">
                                            <option value="" className="text-gray-500 dark:text-slate-500">Not Assigned</option>
                                            {lecturers.map((lec, i) => <option key={i} value={lec.name} className="text-gray-900 dark:text-white">{lec.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block transition-colors">Title/Topic *</label>
                                        <input 
                                            type="text" 
                                            name="title" 
                                            required 
                                            placeholder={schedulingCategory === 'PAPER' ? "e.g. Combined Maths - Paper Class Unit 03" : "e.g. Mechanics Part 1"} 
                                            className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3.5 text-sm text-gray-900 dark:text-white font-medium outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-colors shadow-sm placeholder-gray-400 dark:placeholder-slate-500" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1 transition-colors"><Clock size={12}/> Start Time</label>
                                            <input type="time" name="startTime" required className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3.5 text-sm text-gray-900 dark:text-white font-bold outline-none focus:border-brand-accent dark:focus:border-brand-accent [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1 transition-colors"><Clock size={12}/> End Time</label>
                                            <input type="time" name="endTime" required className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3.5 text-sm text-gray-900 dark:text-white font-bold outline-none focus:border-brand-accent dark:focus:border-brand-accent [color-scheme:light] dark:[color-scheme:dark] transition-colors shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl shadow-sm transition-colors mt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                name="optionalMCQ" 
                                                defaultChecked={schedulingCategory === 'PAPER'}
                                                className="w-5 h-5 accent-brand-accent shrink-0" 
                                            />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                Require <span className="text-brand-accent font-bold">MCQ Paper</span> Task
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                name="optionalPaper" 
                                                defaultChecked={schedulingCategory === 'PAPER'}
                                                className="w-5 h-5 accent-brand-accent shrink-0" 
                                            />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                Require <span className="text-brand-accent font-bold">Structured Paper</span> Task
                                            </span>
                                        </label>
                                    </div>

                                    <div className="pt-2">
                                        <button type="submit" disabled={submitting} className={`w-full bg-brand-accent hover:bg-brand-accentHover text-white font-black py-4 rounded-xl transition-transform text-sm uppercase tracking-widest shadow-md outline-none ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}>
                                            {submitting ? 'Scheduling Class...' : 'Save to Schedule'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW / CANCEL MODAL */}
            {showViewModal && selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 dark:bg-[#0a0f1c]/95 p-4 backdrop-blur-sm animate-in fade-in duration-200 transition-colors">
                    <div className={`bg-white dark:bg-brand-darkCard border border-gray-200 dark:border-brand-darkBorder rounded-3xl p-8 w-full ${isEditing ? 'max-w-lg' : 'max-w-sm'} shadow-2xl relative transition-all max-h-[90vh] overflow-y-auto custom-scrollbar`}>
                        <div className="flex justify-between items-start mb-6 border-b border-gray-200 dark:border-brand-darkBorder pb-6 transition-colors">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight transition-colors">{selectedEvent.subjectName}</h3>
                                <span className="bg-brand-accentLight text-brand-accent px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest border border-brand-accent/20 transition-colors">
                                    {getLocalDateStr(selectedEvent.date)}
                                </span>
                            </div>
                            <button onClick={() => setShowViewModal(false)} className="bg-gray-100 dark:bg-brand-darkBg p-2.5 rounded-xl border border-gray-200 dark:border-brand-darkBorder text-gray-500 dark:text-slate-400 hover:text-gray-900 hover:bg-gray-200 dark:hover:text-white dark:hover:bg-brand-darkHover transition-colors shrink-0 outline-none"><X size={18}/></button>
                        </div>

                        {isEditing ? (
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                {/* MULTI-BATCH SELECTION IN EDIT */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Allocate to Batches *</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1.5 bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl">
                                        {batches.map(b => (
                                            <label key={b.id} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${selectedBatchesForEdit.includes(b.id) ? 'bg-brand-accentLight border-brand-accent/40 shadow-sm' : 'bg-white dark:bg-brand-darkCard border-gray-200 dark:border-brand-darkBorder hover:border-gray-300'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 accent-brand-accent"
                                                    checked={selectedBatchesForEdit.includes(b.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedBatchesForEdit([...selectedBatchesForEdit, b.id]);
                                                        else setSelectedBatchesForEdit(selectedBatchesForEdit.filter(id => id !== b.id));
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-gray-700 dark:text-white truncate" title={b.name}>{b.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">Subject Name</label>
                                    <input 
                                        type="text" 
                                        value={editSubject} 
                                        onChange={(e) => setEditSubject(e.target.value)} 
                                        required 
                                        className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">Topic / Title</label>
                                    <input 
                                        type="text" 
                                        value={editTitle} 
                                        onChange={(e) => setEditTitle(e.target.value)} 
                                        required 
                                        className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">Class Date</label>
                                    <input 
                                        type="date" 
                                        value={editDate} 
                                        onChange={(e) => setEditDate(e.target.value)} 
                                        required 
                                        className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">Start Time</label>
                                        <input 
                                            type="time" 
                                            value={editStartTime} 
                                            onChange={(e) => setEditStartTime(e.target.value)} 
                                            required 
                                            className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">End Time</label>
                                        <input 
                                            type="time" 
                                            value={editEndTime} 
                                            onChange={(e) => setEditEndTime(e.target.value)} 
                                            required 
                                            className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">Lecturer Name</label>
                                    <input 
                                        type="text" 
                                        value={editLecturer} 
                                        onChange={(e) => setEditLecturer(e.target.value)} 
                                        placeholder="e.g. Dr. Silva" 
                                        className="w-full bg-gray-50 dark:bg-brand-darkBg border border-gray-200 dark:border-brand-darkBorder rounded-xl p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-brand-accent"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditing(false)} 
                                        className="flex-1 bg-gray-100 dark:bg-brand-darkHover text-gray-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-xs uppercase tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="flex-1 bg-brand-accent hover:bg-brand-accentHover text-white font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest shadow-md"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="space-y-4 bg-gray-50 dark:bg-brand-darkBg p-5 rounded-2xl border border-gray-200 dark:border-brand-darkBorder mb-6 shadow-sm transition-colors">
                                    <div className="flex items-start gap-4 transition-colors">
                                        <div className="bg-brand-accentLight p-2.5 rounded-xl text-brand-accent border border-brand-accent/20 transition-colors"><BookOpen size={20} /></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Topic / Details</p>
                                            <p className="text-base text-gray-900 dark:text-white font-bold transition-colors">{selectedEvent.title}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 transition-colors">
                                        <div className="bg-orange-50 dark:bg-orange-500/10 p-2.5 rounded-xl text-orange-500 border border-orange-200 dark:border-orange-500/20 transition-colors"><Clock size={20} /></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Time Allocation</p>
                                            <p className="text-base text-gray-900 dark:text-white font-bold transition-colors">{selectedEvent.startTime} — {selectedEvent.endTime}</p>
                                        </div>
                                    </div>

                                    {/* TECH DEPT ALLOCATION DETAILS */}
                                    <div className="flex items-start gap-4 transition-colors">
                                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-xl text-indigo-500 border border-indigo-200 dark:border-indigo-500/20 transition-colors"><Building2 size={20} /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Technical Department Status</p>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {(() => {
                                                    let allBatches = [];
                                                    if (selectedEvent.batch?.name) {
                                                        allBatches.push(selectedEvent.batch.name);
                                                    } else if (selectedEvent.batchId) {
                                                        const found = batches.find(b => b.id === selectedEvent.batchId);
                                                        if (found) allBatches.push(found.name);
                                                    }
                                                    if (selectedEvent.additionalBatchIds) {
                                                        try {
                                                            const extraIds = typeof selectedEvent.additionalBatchIds === 'string' 
                                                                ? JSON.parse(selectedEvent.additionalBatchIds) 
                                                                : selectedEvent.additionalBatchIds;
                                                            if (Array.isArray(extraIds)) {
                                                                extraIds.forEach(id => {
                                                                    const found = batches.find(b => b.id === id);
                                                                    const name = found ? found.name : `Batch #${id}`;
                                                                    if (!allBatches.includes(name)) allBatches.push(name);
                                                                });
                                                            }
                                                        } catch(e) {}
                                                    }
                                                    return allBatches.map((bName, idx) => (
                                                        <span key={idx} className="text-xs bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-2 py-1 rounded-md font-bold flex items-center gap-1">
                                                            📚 {bName}
                                                        </span>
                                                    ));
                                                })()}

                                                {selectedEvent.hall ? (
                                                    <span className="text-xs bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-1 rounded-md font-bold">
                                                        📍 {selectedEvent.hall.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs bg-slate-500/10 text-slate-500 border border-slate-500/20 px-2 py-1 rounded-md font-bold">
                                                        ⏳ Hall Not Assigned
                                                    </span>
                                                )}
                                                
                                                {selectedEvent.deliveryStatus === 'DELIVERED' ? (
                                                    <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-md font-bold">
                                                        ✅ Live Link Sent
                                                    </span>
                                                ) : (
                                                    <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded-md font-bold">
                                                        ⚠️ Submit Link in Tasks
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 transition-colors">
                                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 transition-colors"><User size={20} /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Lecturer</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                {getLecturerImage(selectedEvent.lecturerName) ? (
                                                    <img src={getLecturerImage(selectedEvent.lecturerName)} className="w-8 h-8 rounded-full border border-gray-200 dark:border-brand-darkBorder object-cover shadow-sm transition-colors" alt="Lec"/>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-brand-darkHover flex items-center justify-center border border-gray-200 dark:border-brand-darkBorder transition-colors shadow-sm"><User size={14} className="text-gray-400 dark:text-slate-400"/></div>
                                                )}
                                                <p className="text-base text-gray-900 dark:text-white font-bold transition-colors">{selectedEvent.lecturerName || 'TBA'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {canEdit && (
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => startEditing(selectedEvent)} 
                                            className="flex-1 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-500 dark:hover:bg-sky-600 text-sky-600 dark:text-sky-400 hover:text-white border border-sky-200 dark:border-sky-500/30 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-sm outline-none"
                                        >
                                            <Pencil size={16}/> Edit Class
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(selectedEvent.id)} 
                                            className="flex-1 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white border border-red-200 dark:border-red-500/30 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-sm outline-none"
                                        >
                                            <Trash2 size={16}/> Cancel
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
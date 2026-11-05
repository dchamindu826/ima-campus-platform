import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GitCompare, Search, Filter, Download, Users, CheckCircle2, 
  XCircle, Award, Layers, ChevronRight, Sparkles, BookOpen, User, 
  Phone, GraduationCap, X, Check, ArrowRight, ShieldCheck, Eye
} from 'lucide-react';
import { physicalCrmService } from '../../api/physicalCrm';
import StudentDetailModal from '../../components/PhysicalCRM/StudentDetailModal';
import toast from 'react-hot-toast';

export default function ClassComparisonReport() {
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [classSearch, setClassSearch] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'common' | 'exclusive' | 'overlap'
  const [selectedExclusiveClassId, setSelectedExclusiveClassId] = useState(null);

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState('ALL'); // 'ALL' | 'FULL' | 'HALF' | 'FREE'
  
  // Student modal
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const printRef = useRef(null);

  useEffect(() => {
    fetchInitialClasses();
  }, []);

  const fetchInitialClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await physicalCrmService.getClasses();
      const classesList = res || [];
      setAllClasses(classesList);

      // Auto-select first 2 classes if available
      if (classesList.length >= 2) {
        setSelectedClassIds([classesList[0].id, classesList[1].id]);
      } else if (classesList.length === 1) {
        setSelectedClassIds([classesList[0].id]);
      }
    } catch (err) {
      toast.error('Failed to load physical classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (selectedClassIds.length > 0) {
      fetchComparison();
    } else {
      setComparisonData(null);
    }
  }, [selectedClassIds]);

  const fetchComparison = async () => {
    if (selectedClassIds.length === 0) return;
    setLoadingCompare(true);
    try {
      const res = await physicalCrmService.compareClasses(selectedClassIds.join(','));
      if (res && res.success) {
        setComparisonData(res);
        if (!selectedExclusiveClassId || !selectedClassIds.includes(Number(selectedExclusiveClassId))) {
          setSelectedExclusiveClassId(selectedClassIds[0]);
        }
      }
    } catch (err) {
      toast.error('Failed to compare selected classes');
    } finally {
      setLoadingCompare(false);
    }
  };

  const handleToggleClass = (classId) => {
    const numericId = parseInt(classId);
    setSelectedClassIds(prev => {
      if (prev.includes(numericId)) {
        return prev.filter(id => id !== numericId);
      } else {
        return [...prev, numericId];
      }
    });
    setCurrentPage(1);
  };

  const handleClearSelection = () => {
    setSelectedClassIds([]);
    setComparisonData(null);
  };

  const filteredClassOptions = useMemo(() => {
    if (!classSearch.trim()) return allClasses;
    const q = classSearch.toLowerCase().trim();
    return allClasses.filter(c => {
      const name = (c.name || '').toLowerCase();
      const grade = (c.grade || '').toLowerCase();
      const stream = (c.stream || '').toLowerCase();
      const subject = (c.subject || '').toLowerCase();
      const teacher = (c.teachers || []).some(t => (t.name || '').toLowerCase().includes(q));
      return name.includes(q) || grade.includes(q) || stream.includes(q) || subject.includes(q) || teacher;
    });
  }, [allClasses, classSearch]);

  // Determine current active student dataset based on tab
  const currentTabStudents = useMemo(() => {
    if (!comparisonData || !comparisonData.students) return [];

    let list = [];
    if (activeTab === 'all') {
      list = comparisonData.students;
    } else if (activeTab === 'common') {
      list = comparisonData.commonStudents || [];
    } else if (activeTab === 'exclusive') {
      if (selectedExclusiveClassId) {
        list = comparisonData.exclusiveStudentsByClass?.[selectedExclusiveClassId] || [];
      } else {
        list = comparisonData.students.filter(s => s.isExclusive);
      }
    } else {
      list = comparisonData.students;
    }

    // Apply search filter and card type filter
    return list.filter(s => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch = !term ||
        (s.studentName && s.studentName.toLowerCase().includes(term)) ||
        (s.studentId && s.studentId.toLowerCase().includes(term)) ||
        (s.phone && s.phone.toLowerCase().includes(term)) ||
        (s.guardianPhone && s.guardianPhone.toLowerCase().includes(term)) ||
        (s.school?.name && s.school.name.toLowerCase().includes(term)) ||
        (s.nic && s.nic.toLowerCase().includes(term)) ||
        (s.rfid && s.rfid.toLowerCase().includes(term));

      const matchCardType = cardTypeFilter === 'ALL' || s.cardType === cardTypeFilter;

      return matchSearch && matchCardType;
    });
  }, [comparisonData, activeTab, selectedExclusiveClassId, searchTerm, cardTypeFilter]);

  const totalPages = Math.ceil(currentTabStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentTabStudents.slice(start, start + itemsPerPage);
  }, [currentTabStudents, currentPage, itemsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!comparisonData || currentTabStudents.length === 0) {
      toast.error('No students to export');
      return;
    }

    const headers = [
      'Student ID',
      'Student Name',
      'Phone',
      'Guardian Phone',
      'School',
      'Card Type',
      'Total Classes Selected',
      'Common in All',
      ...comparisonData.classes.map(c => `Enrolled: ${c.name} (${c.grade})`),
      ...comparisonData.classes.map(c => `Card Type: ${c.name}`)
    ];

    const rows = currentTabStudents.map(s => [
      `"${s.studentId || ''}"`,
      `"${(s.studentName || '').replace(/"/g, '""')}"`,
      `"${s.phone || ''}"`,
      `"${s.guardianPhone || ''}"`,
      `"${(s.school?.name || '').replace(/"/g, '""')}"`,
      `"${s.cardType || 'FULL'}"`,
      s.enrolledCount || 0,
      s.isCommonInAll ? 'YES' : 'NO',
      ...comparisonData.classes.map(c => s.enrolledClasses?.[c.id]?.enrolled ? 'YES' : 'NO'),
      ...comparisonData.classes.map(c => s.enrolledClasses?.[c.id]?.cardType || '-')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Class_Comparison_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Comparison report exported as CSV!');
  };

  // Trigger Print / Softcopy
  const handlePrintSoftcopy = () => {
    window.print();
  };

  return (
    <div className="space-y-6 w-full min-h-full pb-16 max-w-[1700px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-purple-600/30 text-white">
              <GitCompare size={26} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Class Comparison & Overlap Reports
              </h1>
              <p className="text-white/60 text-xs sm:text-sm mt-0.5">
                Compare 2, 3, 4+ physical classes simultaneously • Analyze common students and exclusive enrollments.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={!comparisonData || currentTabStudents.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download size={15} /> Export CSV / Excel
          </button>
        </div>
      </div>

      {/* 2. Multi-Class Selector Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-brand-accent" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Select Classes to Compare ({selectedClassIds.length} Selected)
            </h3>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
              <input
                type="text"
                placeholder="Search by teacher, grade, stream..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none transition-all"
              />
              {classSearch && (
                <button
                  type="button"
                  onClick={() => setClassSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedClassIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Selected Class Badges Strip */}
        {selectedClassIds.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider self-center mr-1">
              Active Selection:
            </span>
            {selectedClassIds.map(id => {
              const cls = allClasses.find(c => c.id === id);
              if (!cls) return null;
              const teacherNames = (cls.teachers || []).map(t => t.name).join(', ') || 'No Teacher';
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold shadow-md animate-in fade-in"
                >
                  <BookOpen size={13} className="text-purple-400" />
                  <span>{cls.name}</span>
                  <span className="text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded-md font-mono">
                    {cls.grade}
                  </span>
                  <span className="text-[10px] text-purple-300/80 font-normal">
                    ({teacherNames})
                  </span>
                  <button
                    onClick={() => handleToggleClass(id)}
                    className="hover:text-red-400 text-white/70 font-extrabold ml-1 transition-colors cursor-pointer"
                    title="Remove from comparison"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-xs font-medium mb-4 flex items-center gap-2">
            <span>⚠️ Please select at least 2 classes below to generate a comparison report.</span>
          </div>
        )}

        {/* Available Classes Pill Grid */}
        <div className="max-h-48 overflow-y-auto pr-1 no-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredClassOptions.map(cls => {
            const isSelected = selectedClassIds.includes(cls.id);
            const teacherNames = (cls.teachers || []).map(t => t.name).join(', ') || '';
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleToggleClass(cls.id)}
                className={`flex items-start justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500/60 shadow-lg shadow-purple-500/10 text-white'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 hover:text-white'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-purple-400 shadow-sm shadow-purple-400' : 'bg-white/30'}`}></span>
                    <h4 className="text-xs font-bold truncate">{cls.name}</h4>
                  </div>
                  <p className="text-[10px] text-white/60 mt-0.5 truncate">
                    {cls.grade} {cls.stream ? `• ${cls.stream}` : ''} {teacherNames ? `• ${teacherNames}` : ''}
                  </p>
                  {cls.monthlyFee > 0 && (
                    <span className="text-[9px] text-emerald-400 font-extrabold mt-1 inline-block">
                      Rs. {Number(cls.monthlyFee).toLocaleString()} /mo
                    </span>
                  )}
                </div>

                <div className={`shrink-0 w-5 h-5 rounded-lg flex items-center justify-center border ${
                  isSelected ? 'bg-purple-500 border-purple-400 text-white' : 'border-white/20 text-transparent'
                }`}>
                  <Check size={12} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Executive KPI Stats Cards */}
      {comparisonData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Unique Students */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Total Unique Students</span>
              <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">
                {comparisonData.stats.totalUniqueStudents}
              </span>
              <p className="text-[11px] text-white/50 mt-1">Distinct students enrolled in selection</p>
            </div>
          </div>

          {/* Common in ALL Selected Classes */}
          <div className="bg-gradient-to-b from-purple-950/40 to-black/40 backdrop-blur-xl border border-purple-500/30 p-5 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                Common to ALL ({selectedClassIds.length}) Classes
              </span>
              <div className="p-2 bg-purple-500/30 text-purple-200 rounded-xl">
                <Sparkles size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-200">
                {comparisonData.stats.commonInAllCount}
              </span>
              <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                {comparisonData.stats.commonInAllPercentage}% overlap
              </span>
            </div>
            <p className="text-[11px] text-purple-300/70 mt-1">
              Enrolled across all selected classes
            </p>
          </div>

          {/* Single Class Exclusive Students */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Exclusive to Single Class</span>
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
                <Award size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">
                {Object.values(comparisonData.stats.exclusiveCounts || {}).reduce((a, b) => a + b, 0)}
              </span>
              <p className="text-[11px] text-white/50 mt-1">Enrolled in single class only (Unique)</p>
            </div>
          </div>

          {/* Card Type Distribution */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/15 p-5 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Card Distribution</span>
              <ShieldCheck size={18} className="text-emerald-400" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center">
                <span className="text-[9px] font-bold text-emerald-400 block uppercase">Full</span>
                <span className="text-base font-extrabold text-white">{comparisonData.stats.cardDistribution?.overall?.FULL || 0}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center">
                <span className="text-[9px] font-bold text-amber-400 block uppercase">Half</span>
                <span className="text-base font-extrabold text-white">{comparisonData.stats.cardDistribution?.overall?.HALF || 0}</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-xl text-center">
                <span className="text-[9px] font-bold text-purple-400 block uppercase">Free</span>
                <span className="text-base font-extrabold text-white">{comparisonData.stats.cardDistribution?.overall?.FREE || 0}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. Comparison Class Breakdown Summary Cards */}
      {comparisonData && comparisonData.classes?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {comparisonData.classes.map(cls => {
            const teacherNames = (cls.teachers || []).map(t => t.name).join(', ') || 'No Teacher';
            const isSelectedExclusive = activeTab === 'exclusive' && selectedExclusiveClassId === cls.id;
            return (
              <div
                key={cls.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSelectedExclusive
                    ? 'bg-purple-950/40 border-purple-500/60 shadow-lg'
                    : 'bg-black/30 backdrop-blur-md border-white/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-brand-accent uppercase tracking-wider">{cls.grade}</span>
                    <h4 className="text-sm font-bold text-white truncate max-w-[180px]">{cls.name}</h4>
                    <p className="text-[11px] text-white/60 truncate max-w-[180px]">👨‍🏫 {teacherNames}</p>
                  </div>
                  <span className="text-xs font-black text-white bg-white/10 px-2.5 py-1 rounded-xl">
                    {cls.totalStudentsCount} <span className="text-[10px] text-white/50 font-normal">Students</span>
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                  <span className="text-white/60">Only in this class:</span>
                  <span className="font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    {cls.exclusiveStudentsCount} students
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Main Interactive Data Table Area */}
      {comparisonData && (
        <div className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
          
          {/* Navigation Sub-Tabs & Filtering */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-4">
            
            {/* View Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                All Students Matrix ({comparisonData.students?.length || 0})
              </button>

              <button
                onClick={() => { setActiveTab('common'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'common'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                }`}
              >
                <Sparkles size={13} /> Common in ALL Classes ({comparisonData.commonStudents?.length || 0})
              </button>

              <button
                onClick={() => { setActiveTab('exclusive'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'exclusive'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                Single Class Only
              </button>

              {selectedClassIds.length >= 3 && (
                <button
                  onClick={() => setActiveTab('overlap')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'overlap'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                  }`}
                >
                  Pairwise Overlap Matrix
                </button>
              )}
            </div>

            {/* In-table Search & Card Type Filter */}
            {activeTab !== 'overlap' && (
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={13} />
                  <input
                    type="text"
                    placeholder="Filter student by name, ID, phone..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:border-brand-accent outline-none"
                  />
                </div>

                <select
                  value={cardTypeFilter}
                  onChange={(e) => { setCardTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-black">All Card Types</option>
                  <option value="FULL" className="text-black">🟢 Full Card</option>
                  <option value="HALF" className="text-black">🟡 Half Card</option>
                  <option value="FREE" className="text-black">🟣 Free Card</option>
                </select>
              </div>
            )}
          </div>

          {/* Exclusive Class Sub-Selector (when in exclusive tab) */}
          {activeTab === 'exclusive' && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider mr-2">Filter Class:</span>
              {comparisonData.classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedExclusiveClassId(cls.id); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedExclusiveClassId === cls.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-black/40 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  {cls.name} ({comparisonData.stats.exclusiveCounts?.[cls.id] || 0})
                </button>
              ))}
            </div>
          )}

          {/* Tab Content 1, 2, 3: Student Data Table */}
          {activeTab !== 'overlap' ? (
            <div>
              {currentTabStudents.length === 0 ? (
                <div className="text-center py-16 text-white/40 text-sm space-y-2">
                  <Users size={36} className="mx-auto opacity-30" />
                  <p>No student records matched your current comparison & filter criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 font-bold uppercase tracking-wider">
                        <th className="py-3 px-3">Student</th>
                        <th className="py-3 px-3">Contact</th>
                        <th className="py-3 px-3">School</th>
                        <th className="py-3 px-3 text-center">Card Type</th>
                        {comparisonData.classes.map(cls => (
                          <th key={cls.id} className="py-3 px-3 text-center min-w-[120px]">
                            <span className="text-white block font-bold truncate max-w-[130px]">{cls.name}</span>
                            <span className="text-[9px] text-white/40 block">{cls.grade}</span>
                          </th>
                        ))}
                        <th className="py-3 px-3 text-center">Total Enrolled</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/90">
                      {paginatedStudents.map(student => (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                          
                          {/* Student ID & Name */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedStudentForModal(student.id)}
                                className="font-mono text-xs font-bold text-brand-accent hover:underline text-left cursor-pointer"
                              >
                                {student.studentId}
                              </button>
                            </div>
                            <h4 className="font-bold text-white text-xs mt-0.5">{student.studentName}</h4>
                          </td>

                          {/* Contact */}
                          <td className="py-3 px-3 text-[11px] space-y-0.5">
                            {student.phone && (
                              <div className="flex items-center gap-1.5 text-white/80">
                                <Phone size={11} className="text-white/40" />
                                <span>{student.phone}</span>
                              </div>
                            )}
                            {student.guardianPhone && (
                              <div className="text-[10px] text-white/50">
                                Guardian: {student.guardianPhone}
                              </div>
                            )}
                          </td>

                          {/* School */}
                          <td className="py-3 px-3 text-[11px] text-white/70">
                            {student.school?.name || '-'}
                          </td>

                          {/* Card Type */}
                          <td className="py-3 px-3 text-center">
                            {student.cardType && student.cardType !== 'FULL' ? (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                student.cardType === 'FREE'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>
                                {student.cardType === 'FREE' ? 'Free Card' : 'Half Card'}
                              </span>
                            ) : (
                              <span className="text-white/40 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Class Enrollment Status Checkmarks for each selected class */}
                          {comparisonData.classes.map(cls => {
                            const enrollmentInfo = student.enrolledClasses?.[cls.id];
                            const isEnrolled = Boolean(enrollmentInfo?.enrolled);
                            const cType = enrollmentInfo?.cardType || student.cardType;

                            return (
                              <td key={cls.id} className="py-3 px-3 text-center">
                                {isEnrolled ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                      <CheckCircle2 size={12} /> Enrolled
                                    </span>
                                    {cType && cType !== 'FULL' && (
                                      <span className="text-[9px] text-amber-300 font-bold mt-0.5">
                                        ({cType} CARD)
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-white/20 text-[11px] font-mono">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Enrolled */}
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                              student.isCommonInAll
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-white/10 text-white'
                            }`}>
                              {student.enrolledCount} / {comparisonData.classes.length}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedStudentForModal(student.id)}
                              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
                              title="View Full Profile & Attendance"
                            >
                              <Eye size={14} />
                            </button>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-4 border-t border-white/10 text-xs text-white/60">
                  <span>Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, currentTabStudents.length)} of {currentTabStudents.length} students</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-xl cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="font-bold text-white">{currentPage} / {totalPages}</span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-xl cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 4: Pairwise Overlap Matrix */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cross-Class Overlap Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(comparisonData.pairwiseOverlap || {}).map(([key, data]) => {
                  const clsA = comparisonData.classes.find(c => c.id === data.classAId);
                  const clsB = comparisonData.classes.find(c => c.id === data.classBId);
                  if (!clsA || !clsB) return null;

                  return (
                    <div key={key} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                        <span>{clsA.name}</span>
                        <ArrowRight size={14} className="text-white/40" />
                        <span>{clsB.name}</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-white/60">Common Enrolled:</span>
                        <span className="text-xl font-extrabold text-white bg-indigo-500/20 px-3 py-0.5 rounded-xl border border-indigo-500/30">
                          {data.count} students
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* HIDDEN PRINT SOFTCOPY TEMPLATE (Styles applied via @media print) */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white p-8 font-sans" id="printable-softcopy">
        {/* Campus Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-2xl font-black uppercase tracking-wider">IMA PHYSICAL CAMPUS</h1>
          <h2 className="text-base font-bold text-gray-700 mt-0.5">Physical Class Comparison & Overlap Report</h2>
          <p className="text-xs text-gray-500 mt-1">
            Generated on: {new Date().toLocaleString()} | Total Selected Classes: {selectedClassIds.length}
          </p>
        </div>

        {/* Selected Classes Summary */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">Compared Classes:</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {comparisonData?.classes?.map(c => (
              <div key={c.id} className="p-2 border border-gray-300 rounded">
                <strong>{c.name}</strong> ({c.grade} • {c.subject || 'General'})
                <div className="text-[11px] text-gray-600">
                  Lecturer: {(c.teachers || []).map(t => t.name).join(', ') || 'N/A'} | Total Students: {c.totalStudentsCount}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-level Statistics */}
        <div className="mb-6 bg-gray-100 p-3 rounded border border-gray-300 text-xs">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="block font-bold text-gray-600">Total Unique Students:</span>
              <span className="text-lg font-black">{comparisonData?.stats?.totalUniqueStudents || 0}</span>
            </div>
            <div>
              <span className="block font-bold text-gray-600">Common in ALL Classes:</span>
              <span className="text-lg font-black">{comparisonData?.stats?.commonInAllCount || 0} ({comparisonData?.stats?.commonInAllPercentage}%)</span>
            </div>
            <div>
              <span className="block font-bold text-gray-600">Card Distribution:</span>
              <span className="text-xs font-semibold">
                Full: {comparisonData?.stats?.cardDistribution?.overall?.FULL || 0} | 
                Half: {comparisonData?.stats?.cardDistribution?.overall?.HALF || 0} | 
                Free: {comparisonData?.stats?.cardDistribution?.overall?.FREE || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Student Table */}
        <table className="w-full text-left text-[10px] border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-400">
              <th className="p-1.5 border border-gray-300">#</th>
              <th className="p-1.5 border border-gray-300">Student ID</th>
              <th className="p-1.5 border border-gray-300">Student Name</th>
              <th className="p-1.5 border border-gray-300">Phone</th>
              <th className="p-1.5 border border-gray-300">Guardian Phone</th>
              <th className="p-1.5 border border-gray-300">Card Type</th>
              {comparisonData?.classes?.map(c => (
                <th key={c.id} className="p-1.5 border border-gray-300 text-center">{c.name}</th>
              ))}
              <th className="p-1.5 border border-gray-300 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {currentTabStudents.map((s, idx) => (
              <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-1.5 border border-gray-300 font-mono">{idx + 1}</td>
                <td className="p-1.5 border border-gray-300 font-mono font-bold">{s.studentId}</td>
                <td className="p-1.5 border border-gray-300 font-semibold">{s.studentName}</td>
                <td className="p-1.5 border border-gray-300">{s.phone || '-'}</td>
                <td className="p-1.5 border border-gray-300">{s.guardianPhone || '-'}</td>
                <td className="p-1.5 border border-gray-300 font-bold">{s.cardType || 'FULL'}</td>
                {comparisonData?.classes?.map(c => (
                  <td key={c.id} className="p-1.5 border border-gray-300 text-center font-bold">
                    {s.enrolledClasses?.[c.id]?.enrolled ? '✓' : '-'}
                  </td>
                ))}
                <td className="p-1.5 border border-gray-300 text-center font-black">{s.enrolledCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-400 flex justify-between text-[10px] text-gray-500">
          <span>IMA Campus Physical CRM • Automated Report</span>
          <span>Page 1 of 1</span>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudentForModal && (
        <StudentDetailModal
          studentId={selectedStudentForModal}
          onClose={() => setSelectedStudentForModal(null)}
          onRefresh={fetchComparison}
        />
      )}

    </div>
  );
}

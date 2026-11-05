import React, { useState, useEffect, useRef, useMemo } from 'react';
import { physicalCrmService } from '../../api/physicalCrm';
import { physicalFinanceService } from '../../api/physicalFinance';
import SchoolManagerModal from '../../components/PhysicalCRM/SchoolManagerModal';
import StudentDetailModal from '../../components/PhysicalCRM/StudentDetailModal';
import { User, Search, GraduationCap, Users, Filter, Edit2, Trash2, X, FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles, CreditCard, BookOpen, ChevronDown, Check, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

import { printThermalReceipt } from '../../utils/thermalReceiptPrinter';
import { extractCallingName } from '../../utils/nameUtils';

const initialFormData = {
  studentName: '',
  nic: '',
  classId: '',
  classIds: [],
  enrollmentCardTypes: {},
  schoolId: '',
  phone: '',
  address: '',
  gender: '',
  dob: '',
  guardianName: '',
  guardianPhone: '',
  rfid: '',
  cardType: 'FULL',
  registrationFeeAmount: '',
  registrationFeeStatus: 'PENDING'
};

export default function StudentRegistration() {
  const [students, setStudents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);
  
  // Bulk Excel Import & Class Allocator Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalMode, setImportModalMode] = useState('allocate'); // 'allocate' | 'profileImport'
  const [excelFile, setExcelFile] = useState(null);
  const [allocateClassId, setAllocateClassId] = useState('');
  const [autoCreateUnmatched, setAutoCreateUnmatched] = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [importSchoolId, setImportSchoolId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [allocationResult, setAllocationResult] = useState(null);
  const [activeResultTab, setActiveResultTab] = useState('allocated'); // 'allocated' | 'already' | 'unmatched'
  const fileInputRef = useRef(null);

  // Quick Card Scan / Allocate Modal State
  const [cardModalStudent, setCardModalStudent] = useState(null);
  const [cardModalInput, setCardModalInput] = useState('');
  const [savingCardModal, setSavingCardModal] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterCardType, setFilterCardType] = useState('ALL');
  const [allocatorClassSearch, setAllocatorClassSearch] = useState('');
  const [formClassSearch, setFormClassSearch] = useState('');
  const [isFormClassDropdownOpen, setIsFormClassDropdownOpen] = useState(false);
  const formClassDropdownRef = useRef(null);
  const [importBatchClassSearch, setImportBatchClassSearch] = useState('');

  // Form State
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [formData, setFormData] = useState(initialFormData);

  // Close form class dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formClassDropdownRef.current && !formClassDropdownRef.current.contains(e.target)) {
        setIsFormClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, schoolsRes, classesRes, regFeeRes] = await Promise.all([
        physicalCrmService.getStudents(),
        physicalCrmService.getSchools(),
        physicalCrmService.getClasses(),
        physicalFinanceService.getDefaultRegFee()
      ]);
      setStudents(studentsRes || []);
      setSchools(schoolsRes || []);
      setClasses(classesRes || []);
      if (regFeeRes && regFeeRes.amount) {
        setFormData(prev => ({ ...prev, registrationFeeAmount: regFeeRes.amount }));
      }
    } catch (err) {
      toast.error('Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (student) => {
    setEditingStudentId(student.id);
    const existingClassIds = student.enrollments && student.enrollments.length > 0 
      ? student.enrollments.map(e => e.classId) 
      : (student.classId ? [student.classId] : []);

    const cardMap = {};
    (student.enrollments || []).forEach(e => {
      cardMap[e.classId] = e.cardType || student.cardType || 'FULL';
    });

    setFormData({
      studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      nic: student.nic || '',
      classId: student.classId || (existingClassIds[0] || ''),
      classIds: existingClassIds,
      enrollmentCardTypes: cardMap,
      schoolId: student.schoolId || '',
      phone: student.phone || '',
      address: student.address || '',
      gender: student.gender || '',
      dob: student.dob || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      rfid: student.rfid || '',
      cardType: student.cardType || 'FULL',
      registrationFeeAmount: student.registrationFeeAmount || '',
      registrationFeeStatus: student.registrationFeeStatus || 'PENDING'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setFormData(initialFormData);
  };

  const handleQuickAllocateCard = async (targetStudent, rfidCode) => {
    if (!targetStudent) return;
    setSavingCardModal(true);
    try {
      const cleanRfid = rfidCode ? String(rfidCode).trim() : '';
      const res = await physicalCrmService.allocateCard(targetStudent.id, cleanRfid);
      toast.success(res.message || 'Card updated successfully!');
      setCardModalStudent(null);
      setCardModalInput('');
      fetchData();
    } catch (err) {
      console.error('Error allocating card:', err);
      toast.error(err.response?.data?.error || 'Failed to allocate card');
    } finally {
      setSavingCardModal(false);
    }
  };

  const handleDirectBindRfid = async (studentId, rfidValue) => {
    if (!studentId) return;
    try {
      const cleanRfid = rfidValue ? String(rfidValue).trim() : '';
      const res = await physicalCrmService.allocateCard(studentId, cleanRfid);
      toast.success(res.message || 'Card allocated & saved successfully!');
      fetchData();
    } catch (err) {
      console.error('Error allocating card:', err);
      toast.error(err.response?.data?.error || 'Failed to save card');
    }
  };

  const handleDeleteClick = async (student) => {
    const sName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
    if (window.confirm(`Are you sure you want to delete "${sName}" (${student.studentId})?`)) {
      try {
        await physicalCrmService.deleteStudent(student.id);
        toast.success(`Student "${sName}" deleted successfully.`);
        fetchData();
      } catch (err) {
        console.error('Error deleting student:', err);
        toast.error(err.response?.data?.error || 'Failed to delete student.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let resultStudent = null;
      if (editingStudentId) {
        resultStudent = await physicalCrmService.updateStudent(editingStudentId, formData);
        toast.success('Student updated successfully!');
      } else {
        resultStudent = await physicalCrmService.createStudent(formData);
        toast.success('Student registered successfully!');
      }

      // If registration fee was marked as PAID, trigger thermal receipt
      if (formData.registrationFeeStatus === 'PAID' && resultStudent) {
        const regFeeVal = Number(formData.registrationFeeAmount || 1000);
        printThermalReceipt({
          receiptNo: `REG-${resultStudent.studentId || Date.now().toString().slice(-6)}`,
          studentId: resultStudent.studentId || formData.nic || '-',
          studentName: resultStudent.studentName || formData.studentName || 'Student',
          studentPhone: resultStudent.phone || formData.phone || '',
          className: 'Admission & Registration',
          month: new Date().toISOString().slice(0, 7),
          cardType: 'STUDENT REGISTRATION',
          amount: regFeeVal,
          paymentMethod: 'CASH',
          paidDate: new Date(),
          items: [
            {
              description: 'Campus Admission & Registration Fee',
              month: new Date().toISOString().slice(0, 7),
              cardType: 'REGISTRATION',
              amount: regFeeVal
            }
          ],
          totalAmount: regFeeVal
        });
      }

      setFormData(initialFormData);
      setEditingStudentId(null);
      fetchData();
    } catch (err) {
      console.error('Error saving student:', err);
      toast.error(err.response?.data?.error || (editingStudentId ? 'Update failed' : 'Registration failed'));
    }
  };

  const handleExcelFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setImportResult(null);
    }
  };

  const handleExcelImportSubmit = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      toast.error('Please select an Excel file to import.');
      return;
    }

    try {
      setImporting(true);
      const data = new FormData();
      data.append('file', excelFile);
      data.append('excel', excelFile);
      if (importClassId) data.append('defaultClassId', importClassId);
      if (importSchoolId) data.append('defaultSchoolId', importSchoolId);

      const res = await physicalCrmService.importExcelStudents(data);
      if (res && res.success) {
        setImportResult(res);
        toast.success(`Done! Updated ${res.updatedCount || 0} student profiles & added ${res.importedCount || 0} new students!`);
        fetchData();
      } else {
        toast.error(res.error || 'Import failed.');
      }
    } catch (err) {
      console.error('Error importing Excel students:', err);
      toast.error(err.response?.data?.error || 'Bulk Excel import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      toast.error('Please select an Excel or CSV file.');
      return;
    }
    if (!allocateClassId) {
      toast.error('Please select a Target Class to allocate students to.');
      return;
    }

    try {
      setImporting(true);
      const data = new FormData();
      data.append('file', excelFile);
      data.append('excel', excelFile);
      data.append('classId', allocateClassId);
      data.append('autoCreateUnmatched', autoCreateUnmatched);

      const res = await physicalCrmService.allocateExcelToClass(data);
      if (res && res.success) {
        setAllocationResult(res);
        toast.success(`Allocated ${res.allocatedCount} students to ${res.targetClass?.name}!`);
        fetchData();
      } else {
        toast.error(res.error || 'Allocation failed.');
      }
    } catch (err) {
      console.error('Error allocating students from Excel:', err);
      toast.error(err.response?.data?.error || 'Failed to allocate students from Excel.');
    } finally {
      setImporting(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterClassChange = (e) => {
    setFilterClass(e.target.value);
    setCurrentPage(1);
  };

  const filteredStudents = students.filter(s => {
    const term = searchTerm.trim().toLowerCase();
    const sName = (s.studentName || `${s.firstName || ''} ${s.lastName || ''}`).toLowerCase();
    const sId = (s.studentId || '').toLowerCase();
    const sPhone = (s.phone || '').toLowerCase();
    const sNic = (s.nic || '').toLowerCase();
    const sGuardianPhone = (s.guardianPhone || '').toLowerCase();

    const matchSearch = !term || sName.includes(term) || sId.includes(term) || sPhone.includes(term) || sNic.includes(term) || sGuardianPhone.includes(term);
    const matchClass = filterClass ? (s.classId?.toString() === filterClass || (s.enrollments && s.enrollments.some(e => e.classId?.toString() === filterClass))) : true;
    const matchCardType = filterCardType === 'ALL' || (s.cardType || 'FULL') === filterCardType;
    return matchSearch && matchClass && matchCardType;
  });

  const filterClassList = (classList, searchStr) => {
    if (!searchStr || !searchStr.trim()) return classList;
    const q = searchStr.toLowerCase().trim();
    return classList.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const gradeMatch = (c.grade || '').toLowerCase().includes(q);
      const streamMatch = (c.stream || '').toLowerCase().includes(q);
      const subjectMatch = (c.subject || '').toLowerCase().includes(q);
      const teacherMatch = c.teachers && c.teachers.some(t => (t.name || '').toLowerCase().includes(q));
      return nameMatch || gradeMatch || streamMatch || subjectMatch || teacherMatch;
    });
  };

  const filteredAllocatorClasses = useMemo(() => filterClassList(classes, allocatorClassSearch), [classes, allocatorClassSearch]);
  const filteredFormClasses = useMemo(() => filterClassList(classes, formClassSearch), [classes, formClassSearch]);
  const filteredBatchClasses = useMemo(() => filterClassList(classes, importBatchClassSearch), [classes, importBatchClassSearch]);
  const selectedAllocClass = useMemo(() => classes.find(c => c.id === parseInt(allocateClassId)), [classes, allocateClassId]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const inputBaseClass = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-accent/50 outline-none text-white transition-all shadow-inner placeholder:text-white/30";

  return (
    <div className="space-y-4 w-full min-h-full pb-10 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">
            Physical Student Registration
          </h1>
          <p className="text-white/60 mt-1">Register new physical students and manage existing campus enrollments.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Excel Class Allocator Button */}
          <button
            onClick={() => {
              setImportModalMode('allocate');
              setIsImportModalOpen(true);
              setExcelFile(null);
              setImportResult(null);
              setAllocationResult(null);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-purple-600/30 transition-all outline-none transform hover:-translate-y-0.5"
          >
            <Sparkles size={18} className="text-purple-200" /> Allocate Excel to Class 🎯
          </button>

          {/* Full Profile Import Button */}
          <button
            onClick={() => {
              setImportModalMode('profileImport');
              setIsImportModalOpen(true);
              setExcelFile(null);
              setImportResult(null);
              setAllocationResult(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold rounded-xl text-sm border border-emerald-500/30 transition-all outline-none"
          >
            <FileSpreadsheet size={16} /> Import Full Profiles 📊
          </button>

          {/* Counter */}
          <div className="flex items-center gap-3 px-4 py-2 bg-black/40 rounded-xl backdrop-blur-md border border-white/20 text-white">
            <Users className="text-brand-accent" size={20} />
            <div>
              <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider">Total Enrolled</p>
              <p className="text-base font-extrabold text-white">{students.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-md">
                {editingStudentId ? (
                  <><Edit2 size={20} className="text-brand-accent" /> Edit Student</>
                ) : (
                  <><User size={20} className="text-brand-accent" /> New Registration</>
                )}
              </h2>
              {editingStudentId && (
                <button onClick={cancelEdit} className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1 text-sm font-semibold">
                  <X size={16} /> Cancel Edit
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 flex-1">
              {/* Student Name & ID Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">Student Name *</label>
                    {formData.studentName && formData.studentName.trim() && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🗣️ Voice:</span>
                        <strong className="text-emerald-300">{extractCallingName(formData.studentName)}</strong>
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    name="studentName" 
                    required 
                    placeholder="Full Student Name (e.g. K.S. Saman or Saman Kumara)"
                    value={formData.studentName} 
                    onChange={handleInputChange} 
                    className={inputBaseClass} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">NIC / National ID (Optional)</label>
                  <input 
                    type="text" 
                    name="nic" 
                    placeholder="Optional (e.g. NIC)" 
                    value={formData.nic} 
                    onChange={handleInputChange} 
                    className={inputBaseClass} 
                  />
                </div>
              </div>

              {/* Class & School */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                      Allocate Classes (Multi-Class Support) *
                    </label>
                    <span className="text-[10px] text-white/40">
                      {(formData.classIds || []).length} Allocated
                    </span>
                  </div>
                  
                  {/* Selected Class Badges */}
                  {(formData.classIds || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {(formData.classIds || []).map(cId => {
                        const cls = classes.find(c => c.id === parseInt(cId));
                        if (!cls) return null;
                        const teacherNames = cls.teachers && cls.teachers.length > 0
                          ? cls.teachers.map(t => t.name).join(', ')
                          : '';
                        return (
                          <span key={cId} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-red-600/30 to-red-900/40 border border-red-500/40 text-white rounded-xl text-xs font-bold shadow-md animate-in fade-in">
                            <BookOpen size={13} className="text-amber-400 shrink-0" />
                            <span className="break-words leading-tight" title={cls.name}>{cls.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded text-amber-200 shrink-0">
                              {cls.grade}
                            </span>
                            {cls.monthlyFee > 0 && (
                              <span className="text-[10px] text-emerald-300 font-extrabold bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                Rs. {Number(cls.monthlyFee).toLocaleString()}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const newIds = (prev.classIds || []).filter(id => id !== cId);
                                  return { ...prev, classIds: newIds, classId: newIds[0] || '' };
                                });
                              }}
                              className="hover:text-red-400 hover:bg-white/10 rounded-full w-4 h-4 flex items-center justify-center ml-0.5 text-xs cursor-pointer transition-colors"
                              title="Remove Class"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>Select at least one class to enroll student.</span>
                    </div>
                  )}

                  {/* Interactive Class Combobox Dropdown */}
                  <div className="relative" ref={formClassDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFormClassDropdownOpen(prev => !prev)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-medium text-white transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Search size={14} className="text-white/40 shrink-0" />
                        <span className="text-white/80 truncate">
                          {(formData.classIds || []).length > 0 
                            ? `+ Add more classes (${(formData.classIds || []).length} selected)...` 
                            : `🔍 Click to search & allocate classes (${classes.length} available)...`}
                        </span>
                      </div>
                      <ChevronDown size={15} className={`text-white/50 transition-transform ${isFormClassDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Popover Dropdown */}
                    {isFormClassDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#140808] border border-white/20 rounded-2xl shadow-2xl z-50 p-2 space-y-2 max-h-80 flex flex-col">
                        <div className="relative shrink-0">
                          <Search size={14} className="absolute left-3 top-2.5 text-white/40" />
                          <input
                            type="text"
                            value={formClassSearch}
                            onChange={(e) => setFormClassSearch(e.target.value)}
                            placeholder="Type to filter classes (e.g. Commerce, BS, English)..."
                            className="w-full pl-9 pr-8 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner placeholder:text-white/40"
                            autoFocus
                          />
                          {formClassSearch && (
                            <button
                              type="button"
                              onClick={() => setFormClassSearch('')}
                              className="absolute right-2.5 top-2.5 text-white/40 hover:text-white cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {/* List of classes */}
                        <div className="overflow-y-auto max-h-56 space-y-1 custom-scrollbar pr-1">
                          {filteredFormClasses.length === 0 ? (
                            <div className="p-3 text-center text-xs text-white/40">
                              No classes found matching "{formClassSearch}"
                            </div>
                          ) : (
                            filteredFormClasses.map(c => {
                              const isSelected = formData.classIds?.includes(c.id);
                              const teacherNames = c.teachers?.map(t => t.name).join(', ') || '';

                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => {
                                      const currentIds = prev.classIds || [];
                                      const newIds = isSelected 
                                        ? currentIds.filter(id => id !== c.id)
                                        : [...currentIds, c.id];
                                      return { ...prev, classIds: newIds, classId: newIds[0] || '' };
                                    });
                                  }}
                                  className={`w-full text-left p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected 
                                      ? 'bg-red-600/30 border border-red-500/50 text-white shadow-sm' 
                                      : 'text-white/85 hover:bg-white/10 hover:text-white border border-transparent'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-white break-words leading-snug" title={c.name}>{c.name}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded text-amber-200 font-normal shrink-0">
                                        {c.grade}
                                      </span>
                                      {c.stream && (
                                        <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-normal">
                                          {c.stream}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-white/50 font-normal mt-0.5 flex items-center gap-2">
                                      {teacherNames && <span>👨‍🏫 {teacherNames}</span>}
                                      {c.monthlyFee > 0 && <span className="text-emerald-400 font-semibold">Rs. {Number(c.monthlyFee).toLocaleString()}</span>}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {isSelected ? (
                                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                        <Check size={11} /> Enrolled
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-white/40 hover:text-white">
                                        + Select
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Popover Footer */}
                        <div className="pt-1.5 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[10px] text-white/50 font-medium">
                            {(formData.classIds || []).length} classes selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsFormClassDropdownOpen(false)}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">School *</label>
                    <button type="button" onClick={() => setIsSchoolModalOpen(true)} className="text-xs font-semibold text-brand-accent hover:text-brand-accentHover transition-colors">
                      + Manage
                    </button>
                  </div>
                  <select name="schoolId" value={formData.schoolId} onChange={handleInputChange} required className={inputBaseClass + " appearance-none font-medium"}>
                    <option value="" className="text-black">Select a School</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Phone Number</label>
                  <input type="text" name="phone" placeholder="07XXXXXXXX" value={formData.phone} onChange={handleInputChange} className={inputBaseClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Address</label>
                  <input type="text" name="address" placeholder="Home / Residential Address" value={formData.address} onChange={handleInputChange} className={inputBaseClass} />
                </div>
              </div>

              {/* Gender & DOB */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} className={inputBaseClass + " appearance-none"}>
                    <option value="" className="text-black">Select Gender</option>
                    <option value="Female" className="text-black">Female</option>
                    <option value="Male" className="text-black">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Date of Birth</label>
                  <input type="text" name="dob" placeholder="YYYY-MM-DD" value={formData.dob} onChange={handleInputChange} className={inputBaseClass} />
                </div>
              </div>

              {/* Guardian Details */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mt-4 shadow-inner">
                <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-3">Parent / Guardian Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input type="text" name="guardianName" placeholder="Parent / Guardian Name" value={formData.guardianName} onChange={handleInputChange} className={inputBaseClass} />
                  </div>
                  <div>
                    <input type="text" name="guardianPhone" placeholder="Parent Mobile (Optional)" value={formData.guardianPhone} onChange={handleInputChange} className={inputBaseClass} />
                  </div>
                </div>
              </div>

              {/* Student Card Type Selection (Full / Half / Free) */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mt-4 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    💳 Student Card Concession (Payment Plan)
                  </h3>
                  {formData.cardType !== 'FULL' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      formData.cardType === 'FREE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                      'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {formData.cardType === 'FREE' ? '🟣 Free Card' : '🟡 Half Card'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { type: 'FULL', label: 'Full (Normal)', desc: '100% Fee', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' },
                    { type: 'HALF', label: 'Half Card', desc: '50% Fee', color: 'border-amber-500 bg-amber-500/20 text-amber-300' },
                    { type: 'FREE', label: 'Free Card', desc: 'Free (100% Off)', color: 'border-purple-500 bg-purple-500/20 text-purple-300' }
                  ].map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cardType: opt.type }))}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        formData.cardType === opt.type
                          ? `${opt.color} shadow-lg font-bold`
                          : 'border-white/10 bg-black/30 text-white/60 hover:border-white/20'
                      }`}
                    >
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className="text-[9px] opacity-75">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* RFID Card Scanner */}
              <div className="mt-4 bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    💳 Card / QR Scanner (Scan Student ID Card)
                  </label>
                  {formData.rfid && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, rfid: '' }));
                        if (editingStudentId) {
                          handleDirectBindRfid(editingStudentId, '');
                        }
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                    >
                      Clear Card
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      name="rfid"
                      placeholder="Click here and scan Student ID Card / QR..."
                      value={formData.rfid}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setFormData(prev => ({ ...prev, rfid: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.target.value.trim();
                          if (editingStudentId) {
                            handleDirectBindRfid(editingStudentId, val);
                          } else if (val) {
                            toast.success(`Card Code Captured: ${val}`);
                          }
                        }
                      }}
                      className={`${inputBaseClass} border-emerald-500/40 focus:ring-emerald-500/60 bg-emerald-950/40 text-emerald-100 placeholder:text-emerald-500/40 font-mono font-bold tracking-wider`}
                    />
                  </div>

                  {editingStudentId && (
                    <button
                      type="button"
                      onClick={() => handleDirectBindRfid(editingStudentId, formData.rfid)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
                    >
                      <span>⚡ Save Card</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-emerald-400/70 mt-1.5">
                  {editingStudentId 
                    ? "💡 Scan card barcode & press Enter (or click 'Save Card') to bind immediately to this student."
                    : "💡 Scanned card code will be captured and saved when you submit registration below."}
                </p>
              </div>

              {/* Registration Fee */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mt-4 shadow-inner">
                <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-3">Registration Fee</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Fee Amount (LKR)</label>
                    <div className="flex gap-2">
                      <input type="number" name="registrationFeeAmount" placeholder="Amount" value={formData.registrationFeeAmount} onChange={handleInputChange} className={inputBaseClass} />
                      <button type="button" onClick={async () => {
                        try {
                          await physicalFinanceService.setDefaultRegFee(formData.registrationFeeAmount);
                          toast.success('Default Fee Updated!');
                        } catch(err){
                          toast.error('Failed to update default fee');
                        }
                      }} className="px-3 bg-white/10 text-xs rounded-xl hover:bg-white/20 whitespace-nowrap">Save</button>
                    </div>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Fee Status</label>
                     <select name="registrationFeeStatus" value={formData.registrationFeeStatus} onChange={handleInputChange} className={inputBaseClass + " appearance-none font-bold " + (formData.registrationFeeStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400')}>
                        <option value="PENDING" className="text-black">PENDING</option>
                        <option value="PAID" className="text-black">PAID</option>
                     </select>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-3.5 bg-brand-accent hover:bg-brand-accentHover text-white rounded-xl font-semibold shadow-lg shadow-brand-accent/30 hover:shadow-brand-accent/50 transition-all transform hover:-translate-y-0.5">
                  {editingStudentId ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-1">
          <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col h-full max-h-[780px] text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 whitespace-nowrap drop-shadow-md">
                <GraduationCap size={20} className="text-brand-accent" /> Registered Students
              </h2>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input 
                    type="text" 
                    placeholder="Search Name, ID, Phone..." 
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-full focus:ring-2 focus:ring-brand-accent/50 outline-none text-white text-xs w-full sm:w-36 transition-all shadow-inner placeholder:text-white/30" 
                  />
                </div>
                
                {/* Card Type Filter */}
                <div className="relative flex-1 sm:flex-initial">
                  <select 
                    value={filterCardType} 
                    onChange={(e) => { setFilterCardType(e.target.value); setCurrentPage(1); }} 
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full focus:ring-2 focus:ring-brand-accent/50 outline-none text-white text-xs transition-all appearance-none shadow-inner cursor-pointer font-bold"
                  >
                    <option value="ALL" className="text-black">All Cards</option>
                    <option value="FULL" className="text-black">🟢 Full Card</option>
                    <option value="HALF" className="text-black">🟡 Half Card</option>
                    <option value="FREE" className="text-black">🟣 Free Card</option>
                  </select>
                </div>

                <div className="relative flex-1 sm:flex-initial">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <select 
                    value={filterClass} 
                    onChange={handleFilterClassChange} 
                    className="pl-8 pr-6 py-1.5 bg-white/5 border border-white/10 rounded-full focus:ring-2 focus:ring-brand-accent/50 outline-none text-white text-xs w-full sm:w-28 transition-all appearance-none shadow-inner"
                  >
                    <option value="" className="text-black">All Classes</option>
                    {classes.map(c => {
                      const teacherNames = c.teachers && c.teachers.length > 0
                        ? ` • ${c.teachers.map(t => t.name).join(', ')}`
                        : '';
                      return (
                        <option key={c.id} value={c.id} className="text-black">{c.name} ({c.grade}){teacherNames}</option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center flex-1 py-12">
                <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-400 py-12">
                <Users size={48} className="mb-4 opacity-50" />
                <p>No students found matching your search.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* Scrollable Cards Grid */}
                <div className="overflow-y-auto pr-2 custom-scrollbar max-h-[580px]">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
                    {paginatedStudents.map(student => (
                      <div key={student.id} className="group bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-brand-accent/50 hover:bg-white/10 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between shadow-inner">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-brand-accent/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 opacity-90 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setSelectedStudentForReport(student.id)}
                            className="p-1.5 px-2 bg-purple-600/30 hover:bg-purple-600 rounded-lg text-purple-200 hover:text-white transition-all border border-purple-500/40 flex items-center gap-1 text-[11px] font-bold cursor-pointer shadow-sm active:scale-95"
                            title="View Full Student Report (🟣 Payments & 🟣 Attendance)"
                          >
                            <FileText size={12} />
                            <span>Report</span>
                          </button>
                          <button 
                            onClick={() => handleEditClick(student)}
                            className="p-1.5 bg-black/40 hover:bg-brand-accent rounded-lg text-gray-300 hover:text-white transition-all border border-white/10"
                            title="Edit Student"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(student)}
                            className="p-1.5 bg-black/40 hover:bg-red-600 rounded-lg text-gray-300 hover:text-white transition-all border border-white/10"
                            title="Delete Student"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-start mb-3 pr-8">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-base drop-shadow-md">
                                  {student.studentName || `${student.firstName} ${student.lastName}`}
                                </h3>
                                {student.cardType && student.cardType !== 'FULL' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                    student.cardType === 'FREE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                    'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}>
                                    {student.cardType === 'FREE' ? 'Free' : 'Half'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 font-mono">{student.studentId} {student.nic ? `• ${student.nic}` : ''}</p>
                            </div>
                            <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                              {student.enrollments && student.enrollments.length > 0 ? (
                                student.enrollments.map(e => {
                                  const tNames = e.class?.teachers && e.class.teachers.length > 0
                                    ? e.class.teachers.map(t => t.name).join(', ')
                                    : '';
                                  return (
                                    <span key={e.id} title={tNames ? `Teacher: ${tNames}` : ''} className="px-2 py-0.5 bg-brand-accent/20 border border-brand-accent/40 text-brand-accent rounded-md text-[10px] font-bold">
                                      {e.class?.name || 'Class'}{tNames ? ` (${tNames})` : ''}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="px-2.5 py-1 bg-brand-accent/10 text-brand-accent rounded-full text-[11px] font-bold whitespace-nowrap">
                                  {student.class ? student.class.name : (student.grade || 'No Class')}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-1 mb-3 text-xs text-white/80">
                            {student.phone && <p>📞 Phone: {student.phone}</p>}
                            {student.address && <p className="truncate">🏠 {student.address}</p>}
                            {student.guardianPhone && <p>👪 Parent Mobile: {student.guardianPhone}</p>}
                          </div>
                        </div>
                        
                        <div className="pt-2.5 border-t border-white/10 flex justify-between items-center text-[10px] text-white/50 uppercase tracking-wider font-bold">
                          <span>School: <span className="font-semibold text-white/80">{student.school?.name || 'N/A'}</span></span>
                          <span>Parent: <span className="font-semibold text-white/80">{student.guardianName || 'N/A'}</span></span>
                        </div>

                        {/* ID Card / RFID Badge & 1-Click Quick Allocate */}
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {student.rfid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
                                💳 {student.rfid}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-white/50 text-[10px] font-bold border border-white/10">
                                ⚠️ No Card
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCardModalStudent(student);
                              setCardModalInput(student.rfid || '');
                            }}
                            className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black tracking-wide transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            title="Scan or change ID Card code for this student"
                          >
                            <CreditCard size={11} />
                            <span>{student.rfid ? 'Change Card' : '+ Allocate Card'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagination Controls */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70">
                  <span>
                    Showing <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong className="text-white">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</strong> of <strong className="text-white">{filteredStudents.length}</strong>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 rounded-lg text-white font-semibold transition-all border border-white/10"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 font-mono font-bold text-white">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 rounded-lg text-white font-semibold transition-all border border-white/10"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BULK EXCEL ALLOCATOR & IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-white shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setAllocationResult(null);
                setImportResult(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 z-10"
            >
              <X size={20} />
            </button>

            {/* Modal Header & Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${importModalMode === 'allocate' ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                  {importModalMode === 'allocate' ? <Sparkles size={24} /> : <FileSpreadsheet size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {importModalMode === 'allocate' ? 'Excel Class Allocator 🎯' : 'Import Full Student Profiles 📊'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {importModalMode === 'allocate' ? 'Tally Excel list with database & allocate to a specific class' : 'Upload student records with school, address & parent info'}
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalMode('allocate');
                    setAllocationResult(null);
                    setImportResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${importModalMode === 'allocate' ? 'bg-purple-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  Class Allocator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportModalMode('profileImport');
                    setAllocationResult(null);
                    setImportResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${importModalMode === 'profileImport' ? 'bg-emerald-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  Full Profiles
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-4">

              {/* MODE 1: CLASS ALLOCATOR */}
              {importModalMode === 'allocate' && (
                <>
                  {!allocationResult ? (
                    <form onSubmit={handleAllocateSubmit} className="space-y-4">
                      
                      {/* Step 1: Select Target Class */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                            <span>1. Select Target Class to Allocate *</span>
                            {allocatorClassSearch && (
                              <span className="text-[10px] text-purple-300 font-semibold bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                                {filteredAllocatorClasses.length} of {classes.length} classes found
                              </span>
                            )}
                          </label>
                          <span className="text-[10px] text-white/50 lowercase font-normal">multi-class enrollment enabled</span>
                        </div>

                        {/* Search Bar for Lecturer / Sir Name */}
                        <div className="relative">
                          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400" />
                          <input
                            type="text"
                            value={allocatorClassSearch}
                            onChange={(e) => setAllocatorClassSearch(e.target.value)}
                            placeholder="🔍 Type Lecturer / Sir Name, Subject, Grade to search..."
                            className="w-full pl-10 pr-9 py-2.5 bg-black/60 border border-purple-500/40 hover:border-purple-400 focus:border-purple-400 rounded-xl text-xs text-white placeholder:text-purple-300/40 outline-none focus:ring-2 focus:ring-purple-500/50 shadow-inner transition-all"
                          />
                          {allocatorClassSearch && (
                            <button
                              type="button"
                              onClick={() => setAllocatorClassSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                              title="Clear Search"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Class Dropdown */}
                        <select
                          required
                          value={allocateClassId}
                          onChange={(e) => setAllocateClassId(e.target.value)}
                          className="w-full px-4 py-3 bg-black/70 border border-purple-500/40 rounded-xl text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer shadow-inner transition-all"
                        >
                          <option value="" className="text-black">
                            {filteredAllocatorClasses.length === 0 ? '-- No Classes Found Matching Search --' : `-- Choose Class to Allocate Students (${filteredAllocatorClasses.length} available) --`}
                          </option>
                          {filteredAllocatorClasses.map(c => {
                            const teacherNames = c.teachers && c.teachers.length > 0
                              ? c.teachers.map(t => t.name).join(', ')
                              : '';
                            return (
                              <option key={c.id} value={c.id} className="text-black">
                                {c.name} ({c.grade}){c.stream ? ` - ${c.stream}` : ''}{teacherNames ? ` • ${teacherNames}` : ''}{c.monthlyFee > 0 ? ` [Rs. ${Number(c.monthlyFee).toLocaleString()}]` : ''}
                              </option>
                            );
                          })}
                        </select>

                        {/* Selected Class Highlight Card */}
                        {selectedAllocClass && (
                          <div className="p-3 bg-purple-950/50 border border-purple-500/40 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="font-extrabold text-white">{selectedAllocClass.name}</span>
                                <span className="text-purple-300 font-bold">({selectedAllocClass.grade})</span>
                              </div>
                              {selectedAllocClass.teachers && selectedAllocClass.teachers.length > 0 && (
                                <span className="text-purple-200 bg-purple-500/25 px-2 py-0.5 rounded-md border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 w-fit">
                                  👨‍🏫 {selectedAllocClass.teachers.map(t => t.name).join(', ')}
                                </span>
                              )}
                            </div>
                            {selectedAllocClass.monthlyFee > 0 && (
                              <span className="text-emerald-400 font-extrabold text-xs bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                                Rs. {Number(selectedAllocClass.monthlyFee).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Step 2: Excel Dropzone */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                          2. Upload Excel / CSV Student List *
                        </label>
                        <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-6 text-center bg-black/40 relative transition-all">
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx, .xls, .csv"
                            onChange={handleExcelFileSelect}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                            <Upload size={30} className="text-purple-400" />
                            {excelFile ? (
                              <div>
                                <p className="text-sm font-extrabold text-purple-300">{excelFile.name}</p>
                                <p className="text-[11px] text-gray-400">{(excelFile.size / 1024).toFixed(1)} KB</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-bold text-white">Click or Drag & Drop Excel (.xlsx, .xls, .csv) File</p>
                                <p className="text-[11px] text-purple-300/80 mt-1 font-medium">Auto-detects columns: <strong className="text-white">Student Name</strong> & <strong className="text-white">P.Phone / Phone</strong></p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Header Guide & Info Box */}
                      <div className="bg-purple-950/40 border border-purple-500/20 rounded-2xl p-3.5 text-xs text-purple-200/90 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-purple-300">
                          <CheckCircle2 size={14} className="text-purple-400" /> Auto-Matching Logic (Zero Manual Header Renaming):
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-white/70 pl-1">
                          <li><strong>Phone Matching:</strong> Auto-formats numbers with or without zero (e.g. <code className="text-purple-300">751543669</code> matches <code className="text-purple-300">0751543669</code>).</li>
                          <li><strong>Name Matching:</strong> Matches full names and initials (e.g. <code className="text-purple-300">Mudeesha Dewruwan</code>).</li>
                          <li><strong>Multi-Class:</strong> Existing students retain all their previous classes and gain access to this class.</li>
                        </ul>
                      </div>

                      {/* Option: Auto create unmatched */}
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer" onClick={() => setAutoCreateUnmatched(!autoCreateUnmatched)}>
                        <input
                          type="checkbox"
                          checked={autoCreateUnmatched}
                          onChange={(e) => setAutoCreateUnmatched(e.target.checked)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-black/40 border-white/20 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-white/90">
                          Auto-register unmatched students into database and allocate them to this class
                        </span>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={importing || !excelFile || !allocateClassId}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 uppercase text-xs tracking-wider disabled:opacity-50 outline-none transition-all"
                      >
                        {importing ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> Matching & Allocating Students...
                          </>
                        ) : (
                          <>
                            <Sparkles size={18} /> Match & Allocate to Class 🚀
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* ALLOCATION RESULTS VIEW */
                    <div className="space-y-4 animate-in fade-in">
                      
                      {/* Class Banner */}
                      <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border border-purple-500/40 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Target Allocated Class</p>
                          <h4 className="text-lg font-extrabold text-white">
                            {allocationResult.targetClass?.name} ({allocationResult.targetClass?.grade})
                            {allocationResult.targetClass?.teachers && allocationResult.targetClass.teachers.length > 0 && (
                              <span className="text-xs font-semibold text-purple-200 ml-2 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                                👨‍🏫 {allocationResult.targetClass.teachers.map(t => t.name).join(', ')}
                              </span>
                            )}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold rounded-xl text-xs">
                            ✓ Allocation Finished
                          </span>
                        </div>
                      </div>

                      {/* 4 Stat Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase">Total In Excel</p>
                          <p className="text-xl font-extrabold text-white">{allocationResult.totalInExcel}</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-blue-300 uppercase">DB Matched</p>
                          <p className="text-xl font-extrabold text-blue-400">{allocationResult.matchedCount}</p>
                        </div>
                        <div className="bg-emerald-500/15 border border-emerald-500/30 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-emerald-300 uppercase">Newly Allocated</p>
                          <p className="text-xl font-extrabold text-emerald-400">+{allocationResult.allocatedCount}</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-amber-300 uppercase">Already In Class</p>
                          <p className="text-xl font-extrabold text-amber-400">{allocationResult.alreadyEnrolledCount}</p>
                        </div>
                      </div>

                      {/* Unmatched Alert if any */}
                      {allocationResult.unmatchedCount > 0 && (
                        <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl flex items-center justify-between text-xs text-rose-300">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-400 shrink-0" />
                            <span><strong>{allocationResult.unmatchedCount}</strong> students in Excel were not found in database.</span>
                          </div>
                        </div>
                      )}

                      {/* Sub-tabs for detailed lists */}
                      <div className="flex gap-2 border-b border-white/10 pb-2">
                        <button
                          type="button"
                          onClick={() => setActiveResultTab('allocated')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeResultTab === 'allocated' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-white/60 hover:text-white'}`}
                        >
                          Allocated Students ({allocationResult.allocatedList?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveResultTab('already')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeResultTab === 'already' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/60 hover:text-white'}`}
                        >
                          Already Enrolled ({allocationResult.alreadyEnrolledList?.length || 0})
                        </button>
                        {allocationResult.unmatchedList?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveResultTab('unmatched')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeResultTab === 'unmatched' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-white/60 hover:text-white'}`}
                          >
                            Unmatched ({allocationResult.unmatchedList.length})
                          </button>
                        )}
                      </div>

                      {/* Detailed Student List Table */}
                      <div className="max-h-48 overflow-y-auto custom-scrollbar bg-black/40 border border-white/10 rounded-2xl p-2">
                        {activeResultTab === 'allocated' && (
                          <div className="space-y-1.5">
                            {allocationResult.allocatedList?.map((s, sIdx) => (
                              <div key={sIdx} className="p-2 bg-white/5 rounded-xl flex items-center justify-between text-xs hover:bg-white/10">
                                <div>
                                  <p className="font-bold text-white">{s.studentName || s.excelName}</p>
                                  <p className="text-[10px] text-white/50">{s.phone || s.excelPhone} {s.studentId ? `• ${s.studentId}` : ''}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">
                                  {s.isNew ? 'New Student Created' : 'Enrolled ✓'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeResultTab === 'already' && (
                          <div className="space-y-1.5">
                            {allocationResult.alreadyEnrolledList?.map((s, sIdx) => (
                              <div key={sIdx} className="p-2 bg-white/5 rounded-xl flex items-center justify-between text-xs hover:bg-white/10">
                                <div>
                                  <p className="font-bold text-white">{s.studentName}</p>
                                  <p className="text-[10px] text-white/50">{s.phone} • {s.studentId}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  Already Enrolled
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeResultTab === 'unmatched' && (
                          <div className="space-y-1.5">
                            {allocationResult.unmatchedList?.map((s, sIdx) => (
                              <div key={sIdx} className="p-2 bg-rose-500/5 rounded-xl flex items-center justify-between text-xs border border-rose-500/20">
                                <div>
                                  <p className="font-bold text-white">{s.name}</p>
                                  <p className="text-[10px] text-white/50">Row #{s.rowIdx} • Phone: {s.phone}</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                  Not Found in DB
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAllocationResult(null);
                            setExcelFile(null);
                          }}
                          className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-all"
                        >
                          Allocate Another File
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsImportModalOpen(false);
                            setAllocationResult(null);
                          }}
                          className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all"
                        >
                          Done & View Students
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MODE 2: FULL PROFILE IMPORT */}
              {importModalMode === 'profileImport' && (
                <form onSubmit={handleExcelImportSubmit} className="space-y-4">
                  {/* File Dropzone */}
                  <div className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-6 text-center bg-black/40 relative transition-all">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <Upload size={30} className="text-emerald-400" />
                      {excelFile ? (
                        <div>
                          <p className="text-sm font-extrabold text-emerald-300">{excelFile.name}</p>
                          <p className="text-[11px] text-gray-400">{(excelFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-white">Select or Drop Excel (.xlsx, .csv) File</p>
                          <p className="text-[11px] text-gray-400">Supports id_number, student_name, phone_number, address, gender, date_of_birth, parent_name, parent_mobile</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Default Class & School Filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Batch Class (Optional)</label>
                      {classes.length > 4 && (
                        <div className="relative mb-1">
                          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                          <input
                            type="text"
                            value={importBatchClassSearch}
                            onChange={(e) => setImportBatchClassSearch(e.target.value)}
                            placeholder="Search class / lecturer..."
                            className="w-full pl-7 pr-6 py-1 bg-black/40 border border-white/10 rounded-lg text-[10px] text-white placeholder:text-white/30 outline-none focus:border-emerald-500"
                          />
                          {importBatchClassSearch && (
                            <button
                              type="button"
                              onClick={() => setImportBatchClassSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      )}
                      <select
                        value={importClassId}
                        onChange={(e) => setImportClassId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="" className="text-black">No Class (Assign Later)</option>
                        {filteredBatchClasses.map(c => {
                          const teacherNames = c.teachers && c.teachers.length > 0
                            ? ` • ${c.teachers.map(t => t.name).join(', ')}`
                            : '';
                          return (
                            <option key={c.id} value={c.id} className="text-black">{c.name} ({c.grade}){teacherNames}</option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Batch School (Optional)</label>
                      <select
                        value={importSchoolId}
                        onChange={(e) => setImportSchoolId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="" className="text-black">No School (Assign Later)</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Import Result Feedback */}
                  {importResult && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
                      <CheckCircle2 size={22} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-extrabold text-emerald-300">Import & Update Completed! 🎉</h4>
                        <p className="text-xs text-emerald-200/80 leading-relaxed mt-0.5">
                          Successfully updated <strong className="text-white">{importResult.updatedCount || 0}</strong> existing student records and created <strong className="text-white">{importResult.importedCount || 0}</strong> new students!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={importing || !excelFile}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 uppercase text-xs tracking-wider disabled:opacity-50 outline-none"
                  >
                    {importing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Importing Students...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={18} /> Start Bulk Import 🚀
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* QUICK CARD SCAN & ALLOCATE MODAL */}
      {cardModalStudent && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-[#0f111a] border border-white/15 rounded-3xl p-6 sm:p-7 max-w-md w-full text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden font-sans space-y-4">
            
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 flex items-center justify-center text-white shrink-0 border border-white/20">
                  <CreditCard size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-white tracking-tight">Allocate Physical ID Card</h3>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    Student: <span className="text-blue-300 font-bold">{cardModalStudent.studentName || `${cardModalStudent.firstName || ''} ${cardModalStudent.lastName || ''}`.trim()}</span>
                  </p>
                  <p className="text-[11px] text-white/40 font-mono font-semibold">{cardModalStudent.studentId}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setCardModalStudent(null);
                  setCardModalInput('');
                }}
                className="text-white/40 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Card Input Field */}
            <div className="space-y-2 relative z-10 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                  Physical ID Card / Barcode
                </label>
                {cardModalInput && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Ready to Bind
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Scan barcode (e.g. +1488) or enter code..."
                  value={cardModalInput}
                  onChange={(e) => setCardModalInput(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAllocateCard(cardModalStudent, cardModalInput);
                    }
                  }}
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl px-4 py-3.5 text-white font-sans text-sm font-bold tracking-wide placeholder:text-white/30 outline-none transition-all"
                />
              </div>

              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                <span className="text-blue-400 text-sm leading-none">⚡</span>
                <span>
                  Scan with hardware barcode scanner and press <strong>Enter</strong> to auto-bind, or type code and click <strong>Save & Bind Card</strong>.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2 relative z-10">
              {cardModalStudent.rfid && (
                <button
                  type="button"
                  onClick={() => handleQuickAllocateCard(cardModalStudent, '')}
                  disabled={savingCardModal}
                  className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  Unlink Card
                </button>
              )}
              <button
                type="button"
                onClick={() => handleQuickAllocateCard(cardModalStudent, cardModalInput)}
                disabled={savingCardModal || !cardModalInput}
                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={16} />
                <span>{savingCardModal ? 'Saving Card...' : 'Save & Bind Card ⚡'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      <SchoolManagerModal 
        isOpen={isSchoolModalOpen} 
        onClose={() => {
          setIsSchoolModalOpen(false);
          physicalCrmService.getSchools().then(setSchools);
        }} 
      />

      {/* Comprehensive Student History Report Modal */}
      {selectedStudentForReport && (
        <StudentDetailModal
          studentId={selectedStudentForReport}
          isOpen={Boolean(selectedStudentForReport)}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
    </div>
  );
}

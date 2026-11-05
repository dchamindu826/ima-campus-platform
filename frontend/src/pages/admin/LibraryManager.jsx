import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  BookOpen, Upload, Plus, Trash2, Edit3, Eye, Download, Search,
  Filter, Layers, CheckCircle2, X, RefreshCw, BarChart2, FileText,
  Tag, Globe, Folder, Award, Settings, GraduationCap, ArrowRight,
  AlertCircle, Grid, List, Sparkles, ShieldCheck, ChevronDown, Check,
  ExternalLink, FileCheck, ArrowUpRight
} from 'lucide-react';

const RESOURCE_TYPES = [
  { value: 'PAST_PAPER', label: 'Past Paper', color: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30' },
  { value: 'MODEL_PAPER', label: 'Model Examination Paper', color: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30' },
  { value: 'TEACHERS_GUIDE', label: 'Teachers’ Resource Guide', color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'SHORT_NOTE', label: 'Short Note / Handout', color: 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30' },
  { value: 'TERM_TEST', label: 'Term Test Paper', color: 'from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30' }
];

const SUGGESTED_TAGS = [
  '2026 A/L', '2025 A/L', '2024 A/L', 'Model Paper', 'Past Paper',
  'Marking Scheme', 'Colombo Schools', 'Provincial Paper', 'Sinhala Medium',
  'English Medium', '1st Term', '2nd Term', '3rd Term'
];

export default function LibraryManager({ loggedInUser: propUser }) {
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch(e) { return {}; }
  })();
  const user = propUser || storedUser;
  const roleUpper = (user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
  
  const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN', 'SUPER'].includes(roleUpper)
    || roleUpper.includes('ADMIN')
    || roleUpper.includes('DIRECTOR')
    || roleUpper.includes('SUPER');
  const isManager = ['MANAGER', 'HEAD_MANAGER', 'ASS_MANAGER', 'ASSISTANT_MANAGER'].includes(roleUpper) || roleUpper.includes('MANAGER');
  const isCoordinator = ['COORDINATOR', 'STAFF', 'CLASS_COORDINATOR', 'CALLER'].includes(roleUpper) || user?.department === 'Class Coordination' || roleUpper.includes('COORDINATOR');

  // Permissions logic
  const canManageStructure = isSystemAdmin; // Only System Admin can add/edit/delete Category, Grade, Stream
  const canManageSubjects = isSystemAdmin || isManager || isCoordinator || Boolean(user?.role); // Coordinators, Managers, Admins can add & edit
  const canDeleteSubject = isSystemAdmin || isManager || isCoordinator || Boolean(user?.role); // Coordinators, Managers, Admins can DELETE subjects!
  const canManageResources = isSystemAdmin || isManager || isCoordinator || Boolean(user?.role); // Coordinators, Managers, Admins can upload & edit
  const canDeleteResource = isSystemAdmin; // Only System Admin can delete resources/papers

  // Navigation tab: 'RESOURCES' | 'SUBJECTS' | 'STRUCTURE'
  const [activeTab, setActiveTab] = useState('RESOURCES');
  const [structureSubTab, setStructureSubTab] = useState('CATEGORIES'); // 'CATEGORIES' | 'STREAMS' | 'GRADES'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Data states
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & Filters for Resources
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCatFilter, setAdminCatFilter] = useState('ALL');
  const [adminStreamFilter, setAdminStreamFilter] = useState('ALL');
  const [adminSubjectFilter, setAdminSubjectFilter] = useState('ALL');
  const [adminTypeFilter, setAdminTypeFilter] = useState('ALL');
  const [adminMediumFilter, setAdminMediumFilter] = useState('ALL');

  // Search & Filter for Subjects tab
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectCatFilter, setSubjectCatFilter] = useState('ALL');
  const [subjectStreamFilter, setSubjectStreamFilter] = useState('ALL');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [staffPreviewResource, setStaffPreviewResource] = useState(null);

  // Structure CRUD Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Forms
  const [catForm, setCatForm] = useState({ id: null, name: '', code: '', description: '', sortOrder: 0 });
  const [gradeForm, setGradeForm] = useState({ id: null, name: '', gradeNumber: '', categoryId: '', sortOrder: 0 });
  const [streamForm, setStreamForm] = useState({ id: null, name: '', code: '', description: '', categoryId: '', sortOrder: 0 });
  const [subjectForm, setSubjectForm] = useState({ id: null, name: '', code: '', categoryId: '', streamId: '', gradeId: '', sortOrder: 0 });

  // Upload Form State
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    description: '',
    resourceType: 'PAST_PAPER',
    medium: 'SINHALA',
    tags: '',
    categoryId: '',
    gradeId: '',
    streamId: '',
    subjectId: '',
    isFeatured: false,
    hasMarkingScheme: false
  });
  const [paperFile, setPaperFile] = useState(null);
  const [markingSchemeFile, setMarkingSchemeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOverPaper, setDragOverPaper] = useState(false);
  const [dragOverScheme, setDragOverScheme] = useState(false);

  // Fetch Structure & Resources
  const fetchData = async () => {
    setLoading(true);
    try {
      const [structRes, resRes, anaRes] = await Promise.all([
        api.get('/library/admin/structure').catch(async () => {
          const [cRes, gRes, stRes, suRes] = await Promise.all([
            api.get('/library/categories').catch(() => ({ data: {} })),
            api.get('/library/grades').catch(() => ({ data: {} })),
            api.get('/library/streams').catch(() => ({ data: {} })),
            api.get('/library/subjects').catch(() => ({ data: {} }))
          ]);
          return {
            data: {
              categories: cRes.data?.categories || [],
              grades: gRes.data?.grades || [],
              streams: stRes.data?.streams || [],
              subjects: suRes.data?.subjects || []
            }
          };
        }),
        api.get('/library/resources', { params: { limit: 150 } }).catch(() => ({ data: {} })),
        api.get('/library/admin/analytics').catch(() => ({ data: {} }))
      ]);

      if (structRes.data?.categories) setCategories(structRes.data.categories);
      if (structRes.data?.grades) setGrades(structRes.data.grades);
      if (structRes.data?.streams) setStreams(structRes.data.streams);
      if (structRes.data?.subjects) setSubjects(structRes.data.subjects);
      if (resRes.data?.resources) setResources(resRes.data.resources);
      if (anaRes.data?.analytics) setAnalytics(anaRes.data.analytics);
    } catch (err) {
      console.error("Error loading library data:", err);
      toast.error("Failed to load library data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Upload handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!paperFile) {
      toast.error("Please select a PDF document to upload");
      return;
    }
    if (!uploadFormData.title || !uploadFormData.title.trim()) {
      toast.error("Please enter a document title");
      return;
    }
    if (!uploadFormData.tags || !uploadFormData.tags.trim()) {
      toast.error("Search tags are mandatory (Comma separated keywords)");
      return;
    }

    setUploading(true);
    const data = new FormData();
    data.append('paper', paperFile);
    if (markingSchemeFile) data.append('markingScheme', markingSchemeFile);

    Object.keys(uploadFormData).forEach(key => {
      if (uploadFormData[key] !== undefined && uploadFormData[key] !== null && uploadFormData[key] !== '') {
        data.append(key, uploadFormData[key]);
      }
    });

    try {
      const res = await api.post('/library/admin/resources/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        toast.success("Document uploaded successfully to Vault!");
        setIsUploadModalOpen(false);
        setPaperFile(null);
        setMarkingSchemeFile(null);
        setUploadFormData({
          title: '',
          description: '',
          resourceType: 'PAST_PAPER',
          medium: 'SINHALA',
          tags: '',
          categoryId: '',
          gradeId: '',
          streamId: '',
          subjectId: '',
          isFeatured: false,
          hasMarkingScheme: false
        });
        fetchData();
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Edit Resource Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingResource) return;
    if (!editingResource.tags || !editingResource.tags.trim()) {
      toast.error("Search tags cannot be empty");
      return;
    }

    try {
      const res = await api.put(`/library/admin/resources/${editingResource.id}`, editingResource);
      if (res.data?.success) {
        toast.success("Resource updated successfully");
        setIsEditModalOpen(false);
        setEditingResource(null);
        fetchData();
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error(err.response?.data?.message || "Failed to update resource");
    }
  };

  // Delete Resource (System Admin Only)
  const handleDeleteResource = async (id, title) => {
    if (!canDeleteResource) {
      toast.error("Access Denied: Only System Administrators can delete resources.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone.`)) return;
    try {
      const res = await api.delete(`/library/admin/resources/${id}`);
      if (res.data?.success) {
        toast.success("Resource deleted successfully");
        fetchData();
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.response?.data?.message || "Failed to delete resource");
    }
  };

  // --- Category CRUD (System Admin Only) ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can configure categories.");
      return;
    }
    try {
      if (catForm.id) {
        await api.put(`/library/admin/categories/${catForm.id}`, catForm);
        toast.success("Category updated successfully");
      } else {
        const res = await api.post('/library/admin/categories', catForm);
        toast.success("Category created successfully");
        if (res.data?.category?.id) {
          setUploadFormData(prev => ({ ...prev, categoryId: String(res.data.category.id) }));
        }
      }
      setIsCatModalOpen(false);
      setCatForm({ id: null, name: '', code: '', description: '', sortOrder: 0 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category");
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can delete categories.");
      return;
    }
    if (!window.confirm(`Delete category "${name}"? Linked resources may be unlinked.`)) return;
    try {
      await api.delete(`/library/admin/categories/${id}`);
      toast.success("Category deleted");
      if (uploadFormData.categoryId === String(id)) {
        setUploadFormData(prev => ({ ...prev, categoryId: '', streamId: '', gradeId: '', subjectId: '' }));
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete category");
    }
  };

  // --- Grade CRUD (System Admin Only) ---
  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can configure grades.");
      return;
    }
    try {
      if (gradeForm.id) {
        await api.put(`/library/admin/grades/${gradeForm.id}`, gradeForm);
        toast.success("Grade updated");
      } else {
        const res = await api.post('/library/admin/grades', gradeForm);
        toast.success("Grade created");
        if (res.data?.grade?.id) {
          setUploadFormData(prev => ({ ...prev, gradeId: String(res.data.grade.id) }));
        }
      }
      setIsGradeModalOpen(false);
      setGradeForm({ id: null, name: '', gradeNumber: '', categoryId: '', sortOrder: 0 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save grade");
    }
  };

  const handleDeleteGrade = async (id, name) => {
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can delete grades.");
      return;
    }
    if (!window.confirm(`Delete grade "${name}"?`)) return;
    try {
      await api.delete(`/library/admin/grades/${id}`);
      toast.success("Grade deleted");
      if (uploadFormData.gradeId === String(id)) {
        setUploadFormData(prev => ({ ...prev, gradeId: '' }));
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete grade");
    }
  };

  // --- Stream CRUD (System Admin Only) ---
  const handleSaveStream = async (e) => {
    e.preventDefault();
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can configure streams.");
      return;
    }
    try {
      if (streamForm.id) {
        await api.put(`/library/admin/streams/${streamForm.id}`, streamForm);
        toast.success("Stream updated");
      } else {
        const res = await api.post('/library/admin/streams', streamForm);
        toast.success("Stream created");
        if (res.data?.stream?.id) {
          setUploadFormData(prev => ({ ...prev, streamId: String(res.data.stream.id) }));
        }
      }
      setIsStreamModalOpen(false);
      setStreamForm({ id: null, name: '', code: '', description: '', categoryId: '', sortOrder: 0 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save stream");
    }
  };

  const handleDeleteStream = async (id, name) => {
    if (!canManageStructure) {
      toast.error("Access Denied: Only System Administrators can delete streams.");
      return;
    }
    if (!window.confirm(`Delete stream "${name}"?`)) return;
    try {
      await api.delete(`/library/admin/streams/${id}`);
      toast.success("Stream deleted");
      if (uploadFormData.streamId === String(id)) {
        setUploadFormData(prev => ({ ...prev, streamId: '', subjectId: '' }));
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete stream");
    }
  };

  // --- Subject CRUD (Coordinators, Managers & Admins can Create, Edit AND Delete) ---
  const handleSaveSubject = async (e) => {
    e.preventDefault();
    if (!canManageSubjects) {
      toast.error("Access Denied: You do not have permission to configure subjects.");
      return;
    }
    try {
      if (subjectForm.id) {
        await api.put(`/library/admin/subjects/${subjectForm.id}`, subjectForm);
        toast.success("Subject updated successfully");
      } else {
        const res = await api.post('/library/admin/subjects', subjectForm);
        toast.success("Subject created successfully");
        // If created from upload modal, auto-select it
        if (res.data?.subject?.id) {
          setUploadFormData(prev => ({ ...prev, subjectId: String(res.data.subject.id) }));
        }
      }
      setIsSubjectModalOpen(false);
      setSubjectForm({ id: null, name: '', code: '', categoryId: '', streamId: '', gradeId: '', sortOrder: 0 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save subject");
    }
  };

  const handleDeleteSubject = async (id, name) => {
    if (!canDeleteSubject) {
      toast.error("Access Denied: You do not have permission to delete subjects.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete subject "${name}"? Any linked papers will have this subject unlinked.`)) return;
    try {
      await api.delete(`/library/admin/subjects/${id}`);
      toast.success("Subject deleted successfully");
      if (uploadFormData.subjectId === String(id)) {
        setUploadFormData(prev => ({ ...prev, subjectId: '' }));
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete subject");
    }
  };

  // Filtered resources in Admin Table/Grid
  const filteredAdminResources = useMemo(() => {
    return resources.filter(r => {
      if (adminCatFilter !== 'ALL' && r.categoryId !== parseInt(adminCatFilter)) return false;
      if (adminStreamFilter !== 'ALL' && r.streamId !== parseInt(adminStreamFilter)) return false;
      if (adminSubjectFilter !== 'ALL' && r.subjectId !== parseInt(adminSubjectFilter)) return false;
      if (adminTypeFilter !== 'ALL' && r.resourceType !== adminTypeFilter) return false;
      if (adminMediumFilter !== 'ALL' && r.medium !== adminMediumFilter) return false;
      if (adminSearch.trim() !== '') {
        const q = adminSearch.toLowerCase();
        return (
          r.title?.toLowerCase().includes(q) ||
          r.subject?.name?.toLowerCase().includes(q) ||
          r.tags?.toLowerCase().includes(q) ||
          r.stream?.name?.toLowerCase().includes(q) ||
          r.category?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [resources, adminCatFilter, adminStreamFilter, adminSubjectFilter, adminTypeFilter, adminMediumFilter, adminSearch]);

  // Filtered subjects in Subjects Tab
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (subjectCatFilter !== 'ALL' && s.categoryId !== parseInt(subjectCatFilter)) return false;
      if (subjectStreamFilter !== 'ALL' && s.streamId !== parseInt(subjectStreamFilter)) return false;
      if (subjectSearch.trim() !== '') {
        const q = subjectSearch.toLowerCase();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.code?.toLowerCase().includes(q) ||
          s.stream?.name?.toLowerCase().includes(q) ||
          s.category?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [subjects, subjectCatFilter, subjectStreamFilter, subjectSearch]);

  // Dynamic available streams for upload modal
  const uploadAvailableStreams = useMemo(() => {
    if (!uploadFormData.categoryId) return streams;
    return streams.filter(s => !s.categoryId || s.categoryId === parseInt(uploadFormData.categoryId));
  }, [streams, uploadFormData.categoryId]);

  // Dynamic available subjects for upload modal
  const uploadAvailableSubjects = useMemo(() => {
    return subjects.filter(sub => {
      if (uploadFormData.categoryId && sub.categoryId && sub.categoryId !== parseInt(uploadFormData.categoryId)) return false;
      if (uploadFormData.streamId && sub.streamId && sub.streamId !== parseInt(uploadFormData.streamId)) return false;
      if (uploadFormData.gradeId && sub.gradeId && sub.gradeId !== parseInt(uploadFormData.gradeId)) return false;
      return true;
    });
  }, [subjects, uploadFormData.categoryId, uploadFormData.streamId, uploadFormData.gradeId]);

  // Quick tag adder for upload form
  const handleAddTag = (tag) => {
    const currentTags = uploadFormData.tags
      ? uploadFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
      setUploadFormData(prev => ({ ...prev, tags: currentTags.join(', ') }));
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* ========================================================
          PAGE HEADER - MODERN GLASSMORPHIC WITH ROLE BADGE
      ======================================================== */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-2xl p-5 sm:p-6 rounded-3xl border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <BookOpen size={26} className="text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  IMA Pusthakalaya Management
                </h1>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                  <Sparkles size={11} />
                  Staff Portal
                </span>
                {isSystemAdmin ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    System Admin Access
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Coordinator & Manager Access
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Publish past papers, model papers & teachers' guides. Coordinators & Managers have full access to manage Subjects and upload PDFs.
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setSubjectForm({ id: null, name: '', code: '', categoryId: '', streamId: '', gradeId: '', sortOrder: subjects.length + 1 });
                setIsSubjectModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-2 border border-white/10 transition-all cursor-pointer shadow-sm hover:border-white/20"
            >
              <Plus size={15} className="text-amber-400" /> Add Subject
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Upload size={15} /> Upload New PDF
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          KPI METRIC CARDS - INTERACTIVE WITH GLOW
      ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div 
          onClick={() => setActiveTab('RESOURCES')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'RESOURCES' 
              ? 'bg-slate-900/90 border-blue-500/40 shadow-lg shadow-blue-500/10' 
              : 'bg-slate-900/50 border-white/5 hover:border-white/15 hover:bg-slate-900/70'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Documents</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-white">{analytics?.totalResources || resources.length}</p>
              <span className="text-[10px] text-blue-400 font-bold">PDF Vault</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Download size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Downloads</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-emerald-400">{analytics?.totalDownloads || 0}</p>
              <span className="text-[10px] text-emerald-500/80 font-bold">Student hits</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('STRUCTURE');
            setStructureSubTab('CATEGORIES');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'STRUCTURE'
              ? 'bg-slate-900/90 border-purple-500/40 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900/50 border-white/5 hover:border-white/15 hover:bg-slate-900/70'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categories / Streams</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-purple-400">{categories.length} / {streams.length}</p>
              <span className="text-[10px] text-purple-400/80 font-bold">Allocated</span>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('SUBJECTS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'SUBJECTS'
              ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/50 border-white/5 hover:border-white/15 hover:bg-slate-900/70'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Managed Subjects</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-amber-400">{subjects.length}</p>
              <span className="text-[10px] text-amber-400/80 font-bold flex items-center gap-0.5">
                Full CRUD <ArrowRight size={10} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SEGMENTED MAIN TAB NAVIGATION
      ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Documents Repository */}
          <button
            onClick={() => setActiveTab('RESOURCES')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'RESOURCES'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={15} />
            Documents Repository
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'RESOURCES' ? 'bg-slate-950/30 text-slate-950' : 'bg-white/10 text-slate-300'
            }`}>
              {resources.length}
            </span>
          </button>

          {/* Tab 2: Subjects Management (Directly prominent for Coordinators & Managers!) */}
          <button
            onClick={() => setActiveTab('SUBJECTS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'SUBJECTS'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award size={15} />
            Subjects Management
            <span className="text-[9px] px-2 py-0.5 rounded-md font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Coordinators & Managers
            </span>
          </button>

          {/* Tab 3: System Admin Structure */}
          <button
            onClick={() => setActiveTab('STRUCTURE')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'STRUCTURE'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings size={15} />
            Categories, Streams & Grades
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isSystemAdmin 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : 'bg-white/10 text-slate-300 border border-white/10'
            }`}>
              {isSystemAdmin ? 'Admin Config' : 'Structure View'}
            </span>
          </button>
        </div>

        {/* Refresh & Quick Actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'RESOURCES' && (
            <div className="hidden sm:flex items-center bg-slate-950/60 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Table View"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid / Card View"
              >
                <Grid size={14} />
              </button>
            </div>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: DOCUMENTS REPOSITORY
      ======================================================== */}
      {activeTab === 'RESOURCES' && (
        <div className="space-y-4">
          
          {/* Advanced Filter Toolbar */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Search by title, subject, tags, stream..."
                  className="w-full bg-slate-950/90 border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
                />
                {adminSearch && (
                  <button
                    onClick={() => setAdminSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Quick Summary Counter */}
              <div className="flex items-center justify-between md:justify-end gap-3 text-xs font-bold text-slate-400">
                <span>
                  Showing <span className="text-amber-400 font-extrabold">{filteredAdminResources.length}</span> of {resources.length} documents
                </span>
                {(adminCatFilter !== 'ALL' || adminStreamFilter !== 'ALL' || adminSubjectFilter !== 'ALL' || adminTypeFilter !== 'ALL' || adminMediumFilter !== 'ALL' || adminSearch) && (
                  <button
                    onClick={() => {
                      setAdminSearch('');
                      setAdminCatFilter('ALL');
                      setAdminStreamFilter('ALL');
                      setAdminSubjectFilter('ALL');
                      setAdminTypeFilter('ALL');
                      setAdminMediumFilter('ALL');
                    }}
                    className="text-amber-400 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1 border-t border-white/5">
              {/* Category */}
              <div>
                <select
                  value={adminCatFilter}
                  onChange={(e) => {
                    setAdminCatFilter(e.target.value);
                    setAdminStreamFilter('ALL');
                    setAdminSubjectFilter('ALL');
                  }}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Stream */}
              <div>
                <select
                  value={adminStreamFilter}
                  onChange={(e) => {
                    setAdminStreamFilter(e.target.value);
                    setAdminSubjectFilter('ALL');
                  }}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Streams</option>
                  {(adminCatFilter !== 'ALL' 
                    ? streams.filter(s => !s.categoryId || s.categoryId === parseInt(adminCatFilter))
                    : streams
                  ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <select
                  value={adminSubjectFilter}
                  onChange={(e) => setAdminSubjectFilter(e.target.value)}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Subjects</option>
                  {(subjects.filter(sub => {
                    if (adminCatFilter !== 'ALL' && sub.categoryId && sub.categoryId !== parseInt(adminCatFilter)) return false;
                    if (adminStreamFilter !== 'ALL' && sub.streamId && sub.streamId !== parseInt(adminStreamFilter)) return false;
                    return true;
                  })).map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>

              {/* Resource Type */}
              <div>
                <select
                  value={adminTypeFilter}
                  onChange={(e) => setAdminTypeFilter(e.target.value)}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Document Types</option>
                  {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Medium */}
              <div>
                <select
                  value={adminMediumFilter}
                  onChange={(e) => setAdminMediumFilter(e.target.value)}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Mediums</option>
                  <option value="SINHALA">Sinhala</option>
                  <option value="ENGLISH">English</option>
                  <option value="TAMIL">Tamil</option>
                </select>
              </div>
            </div>
          </div>

          {/* VIEW: TABLE OR GRID */}
          {loading ? (
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-12 text-center text-slate-400 space-y-3">
              <RefreshCw size={28} className="animate-spin mx-auto text-amber-400" />
              <p className="text-xs font-bold text-slate-300">Loading documents from Pusthakalaya Vault...</p>
            </div>
          ) : filteredAdminResources.length === 0 ? (
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-12 text-center text-slate-400 space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto">
                <FileText size={32} />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-black text-white">No documents found</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {resources.length === 0
                    ? "Your Pusthakalaya repository is empty. Click 'Upload New PDF' to publish past papers, model papers, or teachers' guides."
                    : "No documents match your current filter criteria. Try adjusting or clearing your search filters."}
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Upload size={14} /> Upload First PDF Document
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAdminResources.map(res => (
                <div
                  key={res.id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-amber-400/40 rounded-2xl p-4.5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/40 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 uppercase tracking-wider">
                        {res.resourceType?.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                        {res.medium}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-amber-300 transition-colors" title={res.title}>
                        {res.title}
                      </h4>
                      <p className="text-xs font-semibold text-amber-400/90 mt-1">
                        {res.subject?.name || 'General Subject'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {res.category?.name || 'Academic'} • {res.stream?.name || res.grade?.name || 'General Stream'}
                      </p>
                    </div>

                    {res.hasMarkingScheme && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 size={11} /> Marking Scheme Included
                      </span>
                    )}

                    {res.tags && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {res.tags.split(',').slice(0, 3).map((t, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Download size={12} className="text-emerald-400" /> {res.downloadCount || 0}
                      <span className="text-slate-600">•</span>
                      <span>{res.fileSize || 'PDF'}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStaffPreviewResource(res)}
                        title="Preview PDF"
                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/30 text-blue-300 transition-colors cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => { setEditingResource(res); setIsEditModalOpen(true); }}
                        title="Edit Details"
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                      >
                        <Edit3 size={13} />
                      </button>
                      {canDeleteResource && (
                        <button
                          onClick={() => handleDeleteResource(res.id, res.title)}
                          title="Delete PDF (Admin Only)"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4 pl-5">Document Title & Details</th>
                      <th className="p-4">Category & Stream</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Medium</th>
                      <th className="p-4">Size</th>
                      <th className="p-4">Downloads</th>
                      <th className="p-4 pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {filteredAdminResources.map(res => (
                      <tr key={res.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="p-4 pl-5 max-w-sm">
                          <p className="font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1" title={res.title}>
                            {res.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {res.hasMarkingScheme && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                <CheckCircle2 size={10} /> Scheme
                              </span>
                            )}
                            {res.tags && (
                              <span className="text-[10px] text-slate-400 truncate max-w-xs" title={res.tags}>
                                #{res.tags.split(',')[0]?.trim()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-300">{res.category?.name || 'General'}</p>
                          <p className="text-[10px] text-slate-500">{res.stream?.name || res.grade?.name || '-'}</p>
                        </td>
                        <td className="p-4 font-bold text-amber-300">
                          {res.subject?.name || '-'}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white/10 text-slate-200 uppercase whitespace-nowrap">
                            {res.resourceType?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300">
                          {res.medium}
                        </td>
                        <td className="p-4 text-slate-400 whitespace-nowrap">{res.fileSize || '-'}</td>
                        <td className="p-4 text-emerald-400 font-bold">{res.downloadCount || 0}</td>
                        <td className="p-4 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setStaffPreviewResource(res)}
                              title="Preview PDF"
                              className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => { setEditingResource(res); setIsEditModalOpen(true); }}
                              title="Edit Details"
                              className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Edit3 size={13} />
                            </button>
                            {canDeleteResource && (
                              <button
                                onClick={() => handleDeleteResource(res.id, res.title)}
                                title="Delete Document (Admin Only)"
                                className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: SUBJECTS DIRECTORY (FULL CRUD FOR COORDINATORS & MANAGERS)
      ======================================================== */}
      {activeTab === 'SUBJECTS' && (
        <div className="space-y-4">
          
          {/* Top Banner explaining Coordinator & Manager Subjects Authority */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  Academic Subjects Directory
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Full CRUD Enabled
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Coordinators and Managers can Add New, Edit, and Delete Subjects. Once configured, upload PDFs under each subject.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setSubjectForm({ id: null, name: '', code: '', categoryId: '', streamId: '', gradeId: '', sortOrder: subjects.length + 1 });
                setIsSubjectModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer shrink-0 transition-all hover:scale-[1.02]"
            >
              <Plus size={15} /> Add New Subject
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[220px] flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Search subjects by name, code or stream..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <select
                value={subjectCatFilter}
                onChange={(e) => {
                  setSubjectCatFilter(e.target.value);
                  setSubjectStreamFilter('ALL');
                }}
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select
                value={subjectStreamFilter}
                onChange={(e) => setSubjectStreamFilter(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="ALL">All Streams</option>
                {(subjectCatFilter !== 'ALL'
                  ? streams.filter(s => !s.categoryId || s.categoryId === parseInt(subjectCatFilter))
                  : streams
                ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <span className="text-xs font-bold text-slate-400">
              Showing <span className="text-amber-400 font-extrabold">{filteredSubjects.length}</span> of {subjects.length} subjects
            </span>
          </div>

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSubjects.length === 0 ? (
              <div className="col-span-full bg-slate-900/60 border border-white/10 rounded-3xl p-10 text-center text-slate-400 space-y-3">
                <Award size={32} className="mx-auto text-amber-400/60" />
                <h4 className="text-sm font-bold text-white">No subjects found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click the "+ Add New Subject" button to add a new academic subject for coordinators and students.
                </p>
                <button
                  onClick={() => {
                    setSubjectForm({ id: null, name: '', code: '', categoryId: '', streamId: '', gradeId: '', sortOrder: subjects.length + 1 });
                    setIsSubjectModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus size={14} /> Add Subject Now
                </button>
              </div>
            ) : (
              filteredSubjects.map(sub => {
                const linkedCount = resources.filter(r => r.subjectId === sub.id).length;
                return (
                  <div
                    key={sub.id}
                    className="p-4.5 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between gap-3 shadow-lg group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                            {sub.name}
                          </h4>
                          {sub.code && (
                            <span className="text-[10px] text-amber-400/90 font-mono font-bold bg-amber-400/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                              [{sub.code}]
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 whitespace-nowrap">
                          {linkedCount} {linkedCount === 1 ? 'Paper' : 'Papers'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/20">
                          {sub.stream?.name || sub.category?.name || 'General Stream'}
                        </span>
                        {sub.grade && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                            {sub.grade.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[10px] text-slate-500">ID #{sub.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSubjectForm({
                              id: sub.id,
                              name: sub.name,
                              code: sub.code || '',
                              categoryId: sub.categoryId || '',
                              streamId: sub.streamId || '',
                              gradeId: sub.gradeId || '',
                              sortOrder: sub.sortOrder || 0
                            });
                            setIsSubjectModalOpen(true);
                          }}
                          title="Edit Subject"
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-slate-950 text-slate-300 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        
                        {/* Delete Subject Button - Enabled for Coordinators & Managers! */}
                        <button
                          onClick={() => handleDeleteSubject(sub.id, sub.name)}
                          title="Delete Subject"
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: ACADEMIC STRUCTURE MANAGEMENT (Categories, Streams, Grades)
      ======================================================== */}
      {activeTab === 'STRUCTURE' && (
        <div className="space-y-4">
          
          {/* Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2 rounded-2xl border border-white/10">
            <button
              onClick={() => setStructureSubTab('CATEGORIES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                structureSubTab === 'CATEGORIES' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Categories ({categories.length})
            </button>
            <button
              onClick={() => setStructureSubTab('STREAMS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                structureSubTab === 'STREAMS' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Academic Streams ({streams.length})
            </button>
            <button
              onClick={() => setStructureSubTab('GRADES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                structureSubTab === 'GRADES' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Grades ({grades.length})
            </button>
          </div>

          {/* Subtab: Categories */}
          {structureSubTab === 'CATEGORIES' && (
            <div className="bg-slate-900/80 border border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Categories Repository
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                      {canManageStructure ? 'Admin Full Access' : 'Admin Configured'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Top-level academic groupings (e.g., G.C.E. A/L, G.C.E. O/L)</p>
                </div>
                {canManageStructure && (
                  <button
                    onClick={() => {
                      setCatForm({ id: null, name: '', code: '', description: '', sortOrder: categories.length + 1 });
                      setIsCatModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Plus size={14} /> Add Category
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {categories.map(c => (
                  <div key={c.id} className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white text-xs">{c.name} <span className="text-[10px] text-amber-400 font-mono">[{c.code}]</span></p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{c.description || 'No description'}</p>
                    </div>
                    {canManageStructure && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setCatForm({ id: c.id, name: c.name, code: c.code, description: c.description || '', sortOrder: c.sortOrder || 0 });
                            setIsCatModalOpen(true);
                          }}
                          title="Edit Category"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          title="Delete Category"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab: Streams */}
          {structureSubTab === 'STREAMS' && (
            <div className="bg-slate-900/80 border border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Academic Streams
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                      {canManageStructure ? 'Admin Full Access' : 'Admin Configured'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">e.g. Physical Science (Maths), Bio Science, Commerce, Arts, Technology</p>
                </div>
                {canManageStructure && (
                  <button
                    onClick={() => {
                      setStreamForm({ id: null, name: '', code: '', description: '', categoryId: '', sortOrder: streams.length + 1 });
                      setIsStreamModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Plus size={14} /> Add Stream
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {streams.map(s => (
                  <div key={s.id} className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white text-xs">{s.name}</p>
                      <span className="text-[10px] text-purple-400 font-bold bg-purple-400/10 px-2 py-0.5 rounded mt-1 inline-block">
                        Category: {s.category?.name || 'General'}
                      </span>
                    </div>
                    {canManageStructure && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setStreamForm({ id: s.id, name: s.name, code: s.code || '', description: s.description || '', categoryId: s.categoryId || '', sortOrder: s.sortOrder || 0 });
                            setIsStreamModalOpen(true);
                          }}
                          title="Edit Stream"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteStream(s.id, s.name)}
                          title="Delete Stream"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab: Grades */}
          {structureSubTab === 'GRADES' && (
            <div className="bg-slate-900/80 border border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Grades Master
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                      {canManageStructure ? 'Admin Full Access' : 'Admin Configured'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">e.g. Grade 12, Grade 13, Grade 11</p>
                </div>
                {canManageStructure && (
                  <button
                    onClick={() => {
                      setGradeForm({ id: null, name: '', gradeNumber: '', categoryId: '', sortOrder: grades.length + 1 });
                      setIsGradeModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Plus size={14} /> Add Grade
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {grades.map(g => (
                  <div key={g.id} className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white text-xs">{g.name}</p>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded mt-1 inline-block">
                        Category: {g.category?.name || 'General'}
                      </span>
                    </div>
                    {canManageStructure && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setGradeForm({ id: g.id, name: g.name, gradeNumber: g.gradeNumber || '', categoryId: g.categoryId || '', sortOrder: g.sortOrder || 0 });
                            setIsGradeModalOpen(true);
                          }}
                          title="Edit Grade"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteGrade(g.id, g.name)}
                          title="Delete Grade"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          REDESIGNED UPLOAD MODAL - HIGH VISUAL HIERARCHY & USER FRIENDLY
      ======================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-white/15 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Upload Past Paper / Guide PDF</h3>
                  <p className="text-xs text-slate-400">Publish to the IMA Pusthakalaya Student & Staff Vault</p>
                </div>
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              
              {/* Document Title */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Document Title <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                  placeholder="e.g. 2026 Combined Maths Model Paper 01 + Marking Scheme"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-inner transition-all"
                />
              </div>

              {/* Resource Type & Medium */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    Resource Type <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={uploadFormData.resourceType}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, resourceType: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">Medium</label>
                  <select
                    value={uploadFormData.medium}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, medium: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="SINHALA">Sinhala Medium</option>
                    <option value="ENGLISH">English Medium</option>
                    <option value="TAMIL">Tamil Medium</option>
                  </select>
                </div>
              </div>

              {/* Smart Academic Classification */}
              <div className="p-4 bg-slate-950/70 rounded-2xl border border-white/10 space-y-3.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-amber-400" /> Academic Classification
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-300">Category</label>
                      <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setCatForm({ id: null, name: '', code: '', description: '', sortOrder: categories.length + 1 });
                              setIsCatModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            title="Add New Category"
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}
                        {isSystemAdmin && uploadFormData.categoryId && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const cat = categories.find(c => c.id === parseInt(uploadFormData.categoryId));
                                if (cat) {
                                  setCatForm({ id: cat.id, name: cat.name, code: cat.code, description: cat.description || '', sortOrder: cat.sortOrder || 0 });
                                  setIsCatModalOpen(true);
                                }
                              }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                              title="Edit Selected Category"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cat = categories.find(c => c.id === parseInt(uploadFormData.categoryId));
                                if (cat) handleDeleteCategory(cat.id, cat.name);
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer"
                              title="Delete Selected Category"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <select
                      value={uploadFormData.categoryId}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        setUploadFormData(prev => ({
                          ...prev,
                          categoryId: newCatId,
                          streamId: '',
                          gradeId: '',
                          subjectId: ''
                        }));
                      }}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Stream */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-300">Stream</label>
                      <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setStreamForm({ id: null, name: '', code: '', description: '', categoryId: uploadFormData.categoryId || '', sortOrder: streams.length + 1 });
                              setIsStreamModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            title="Add New Stream"
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}
                        {isSystemAdmin && uploadFormData.streamId && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const str = streams.find(s => s.id === parseInt(uploadFormData.streamId));
                                if (str) {
                                  setStreamForm({ id: str.id, name: str.name, code: str.code || '', description: str.description || '', categoryId: str.categoryId || '', sortOrder: str.sortOrder || 0 });
                                  setIsStreamModalOpen(true);
                                }
                              }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                              title="Edit Selected Stream"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const str = streams.find(s => s.id === parseInt(uploadFormData.streamId));
                                if (str) handleDeleteStream(str.id, str.name);
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer"
                              title="Delete Selected Stream"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <select
                      value={uploadFormData.streamId}
                      onChange={(e) => {
                        const newStreamId = e.target.value;
                        setUploadFormData(prev => ({
                          ...prev,
                          streamId: newStreamId,
                          subjectId: ''
                        }));
                      }}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="">Select Stream</option>
                      {uploadAvailableStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* Grade */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-300">Grade (Optional)</label>
                      <div className="flex items-center gap-1.5">
                        {isSystemAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setGradeForm({ id: null, name: '', gradeNumber: '', categoryId: uploadFormData.categoryId || '', sortOrder: grades.length + 1 });
                              setIsGradeModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
                            title="Add New Grade"
                          >
                            <Plus size={11} /> Add
                          </button>
                        )}
                        {isSystemAdmin && uploadFormData.gradeId && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const gr = grades.find(g => g.id === parseInt(uploadFormData.gradeId));
                                if (gr) {
                                  setGradeForm({ id: gr.id, name: gr.name, gradeNumber: gr.gradeNumber || '', categoryId: gr.categoryId || '', sortOrder: gr.sortOrder || 0 });
                                  setIsGradeModalOpen(true);
                                }
                              }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                              title="Edit Selected Grade"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const gr = grades.find(g => g.id === parseInt(uploadFormData.gradeId));
                                if (gr) handleDeleteGrade(gr.id, gr.name);
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer"
                              title="Delete Selected Grade"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <select
                      value={uploadFormData.gradeId}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, gradeId: e.target.value })}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="">Select Grade</option>
                      {(uploadFormData.categoryId
                        ? grades.filter(g => !g.categoryId || g.categoryId === parseInt(uploadFormData.categoryId))
                        : grades
                      ).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Subject Selector with Quick "+ Add Subject", Edit and Delete */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      Subject
                    </label>
                    <div className="flex items-center gap-2">
                      {canManageSubjects && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectForm({
                              id: null,
                              name: '',
                              code: '',
                              categoryId: uploadFormData.categoryId || '',
                              streamId: uploadFormData.streamId || '',
                              gradeId: uploadFormData.gradeId || '',
                              sortOrder: subjects.length + 1
                            });
                            setIsSubjectModalOpen(true);
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} /> Add New Subject
                        </button>
                      )}
                      {uploadFormData.subjectId && canManageSubjects && (
                        <button
                          type="button"
                          onClick={() => {
                            const sub = subjects.find(s => s.id === parseInt(uploadFormData.subjectId));
                            if (sub) {
                              setSubjectForm({
                                id: sub.id,
                                name: sub.name,
                                code: sub.code || '',
                                categoryId: sub.categoryId || '',
                                streamId: sub.streamId || '',
                                gradeId: sub.gradeId || '',
                                sortOrder: sub.sortOrder || 0
                              });
                              setIsSubjectModalOpen(true);
                            }
                          }}
                          className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                          title="Edit Selected Subject"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                      )}
                      {uploadFormData.subjectId && canDeleteSubject && (
                        <button
                          type="button"
                          onClick={() => {
                            const sub = subjects.find(s => s.id === parseInt(uploadFormData.subjectId));
                            if (sub) {
                              handleDeleteSubject(sub.id, sub.name);
                              setUploadFormData(prev => ({ ...prev, subjectId: '' }));
                            }
                          }}
                          className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                          title="Delete Selected Subject"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <select
                    value={uploadFormData.subjectId}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, subjectId: e.target.value })}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="">Select Subject ({uploadAvailableSubjects.length} available)</option>
                    {uploadAvailableSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} {sub.code ? `[${sub.code}]` : ''} - {sub.stream?.name || sub.category?.name || 'General'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interactive PDF Drag & Drop Upload Zone */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  Select PDF Document <span className="text-amber-400">*</span>
                </label>

                {!paperFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverPaper(true); }}
                    onDragLeave={() => setDragOverPaper(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverPaper(false);
                      if (e.dataTransfer.files?.[0]) setPaperFile(e.dataTransfer.files[0]);
                    }}
                    className={`relative p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-2 cursor-pointer ${
                      dragOverPaper 
                        ? 'border-amber-400 bg-amber-400/10' 
                        : 'border-amber-400/30 bg-slate-950/80 hover:border-amber-400/60 hover:bg-slate-950'
                    }`}
                  >
                    <input
                      type="file"
                      required
                      accept=".pdf"
                      onChange={(e) => setPaperFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Click to browse or drag & drop PDF here</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF documents up to 100MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileCheck size={20} />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate max-w-sm">{paperFile.name}</p>
                        <p className="text-[10px] text-emerald-400">
                          {(paperFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaperFile(null)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Optional Marking Scheme File */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Separate Marking Scheme PDF (Optional)
                </label>
                
                {!markingSchemeFile ? (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">Include official answers / marking guide:</span>
                    <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer shrink-0">
                      Choose PDF
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setMarkingSchemeFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{markingSchemeFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMarkingSchemeFile(null)}
                      className="text-xs text-blue-300 hover:text-white font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Tags with Quick Add Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Search Tags <span className="text-amber-400">*</span>
                  <span className="text-slate-400 font-normal ml-1">(Comma separated keywords)</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadFormData.tags}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, tags: e.target.value })}
                  placeholder="e.g. Combined Maths, Model Paper, Marking Scheme (Required)"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-inner"
                />

                {/* Tag suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick Suggestions:</span>
                  {SUGGESTED_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="text-[10px] font-semibold bg-white/5 hover:bg-amber-400 hover:text-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-white/10 transition-colors cursor-pointer"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-slate-300 text-xs font-bold hover:bg-white/20 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Uploading PDF Document...
                    </>
                  ) : (
                    <>
                      <Upload size={14} /> Publish to Vault
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================
          SUBJECT MODAL (CREATE / EDIT FOR COORDINATORS & MANAGERS)
      ======================================================== */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Award size={16} className="text-amber-400" />
                {subjectForm.id ? 'Edit Academic Subject' : 'Add New Subject'}
              </h3>
              <button onClick={() => setIsSubjectModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Subject Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="e.g. Combined Mathematics"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Subject Code (Optional)
                </label>
                <input
                  type="text"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  placeholder="e.g. CMATHS"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                <select
                  value={subjectForm.categoryId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Stream</label>
                <select
                  value={subjectForm.streamId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, streamId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">Select Stream</option>
                  {(subjectForm.categoryId
                    ? streams.filter(s => !s.categoryId || s.categoryId === parseInt(subjectForm.categoryId))
                    : streams
                  ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Grade (Optional)</label>
                <select
                  value={subjectForm.gradeId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, gradeId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">Select Grade</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 text-xs font-bold hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shadow cursor-pointer transition-all hover:scale-[1.02]"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          CATEGORY MODAL (SYSTEM ADMIN ONLY)
      ======================================================== */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white">{catForm.id ? 'Edit Category' : 'Create New Category'}</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="e.g. G.C.E. Advanced Level"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Code *</label>
                <input
                  type="text"
                  required
                  value={catForm.code}
                  onChange={(e) => setCatForm({ ...catForm, code: e.target.value })}
                  placeholder="e.g. AL"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          STREAM MODAL (SYSTEM ADMIN ONLY)
      ======================================================== */}
      {isStreamModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white">{streamForm.id ? 'Edit Stream' : 'Create New Stream'}</h3>
              <button onClick={() => setIsStreamModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveStream} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Stream Name *</label>
                <input
                  type="text"
                  required
                  value={streamForm.name}
                  onChange={(e) => setStreamForm({ ...streamForm, name: e.target.value })}
                  placeholder="e.g. Physical Science (Combined Maths)"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  value={streamForm.code}
                  onChange={(e) => setStreamForm({ ...streamForm, code: e.target.value })}
                  placeholder="e.g. MATHS"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                <select
                  value={streamForm.categoryId}
                  onChange={(e) => setStreamForm({ ...streamForm, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button type="button" onClick={() => setIsStreamModalOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">Save Stream</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          GRADE MODAL (SYSTEM ADMIN ONLY)
      ======================================================== */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white">{gradeForm.id ? 'Edit Grade' : 'Create New Grade'}</h3>
              <button onClick={() => setIsGradeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveGrade} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Grade Name *</label>
                <input
                  type="text"
                  required
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  placeholder="e.g. Grade 13"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                <select
                  value={gradeForm.categoryId}
                  onChange={(e) => setGradeForm({ ...gradeForm, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button type="button" onClick={() => setIsGradeModalOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">Save Grade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          PDF EMBEDDED PREVIEW MODAL
      ======================================================== */}
      {staffPreviewResource && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-white/15">
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between gap-4 border-b border-white/10">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 uppercase shrink-0">
                  {staffPreviewResource.resourceType}
                </span>
                <span className="text-sm font-black text-white truncate">{staffPreviewResource.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={staffPreviewResource.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> Download
                </a>
                <button
                  onClick={() => setStaffPreviewResource(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 relative">
              <iframe
                src={`${staffPreviewResource.fileUrl}#toolbar=1&navpanes=0`}
                title={staffPreviewResource.title}
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT RESOURCE MODAL
      ======================================================== */}
      {isEditModalOpen && editingResource && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full p-6 border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 size={16} className="text-amber-400" /> Edit Resource Details
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={editingResource.title || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Resource Type</label>
                  <select
                    value={editingResource.resourceType || 'PAST_PAPER'}
                    onChange={(e) => setEditingResource({ ...editingResource, resourceType: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Medium</label>
                  <select
                    value={editingResource.medium || 'SINHALA'}
                    onChange={(e) => setEditingResource({ ...editingResource, medium: e.target.value })}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="SINHALA">Sinhala</option>
                    <option value="ENGLISH">English</option>
                    <option value="TAMIL">Tamil</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Search Tags (Comma separated) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingResource.tags || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, tags: e.target.value })}
                  placeholder="e.g. Combined Maths, Model Paper, Marking Scheme (Required)"
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-slate-300 text-xs font-bold cursor-pointer hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-lg cursor-pointer hover:bg-amber-300 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

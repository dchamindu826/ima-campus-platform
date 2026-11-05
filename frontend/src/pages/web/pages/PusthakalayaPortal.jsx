import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Search, BookOpen, Download, Eye, CheckCircle2, Sparkles, Filter,
  Layers, GraduationCap, FileText, ChevronRight, X, ArrowLeft,
  BookMarked, Globe, ExternalLink, RefreshCw, Bookmark,
  Award, Shield, HelpCircle
} from 'lucide-react';
import { FaFacebook, FaTiktok, FaWhatsapp, FaYoutube } from 'react-icons/fa';

const RESOURCE_TYPE_LABELS = {
  ALL: 'All Resource Types',
  PAST_PAPER: 'Past Papers',
  MODEL_PAPER: 'Model Papers',
  TEACHERS_GUIDE: 'Teachers’ Guides',
  SHORT_NOTE: 'Short Notes & Handouts',
  TERM_TEST: 'Term Test Papers'
};

const RESOURCE_TYPE_BADGES = {
  PAST_PAPER: { label: 'PAST PAPER', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
  MODEL_PAPER: { label: 'MODEL PAPER', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
  TEACHERS_GUIDE: { label: 'TEACHERS’ GUIDE', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  SHORT_NOTE: { label: 'SHORT NOTE', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
  TERM_TEST: { label: 'TERM TEST', bg: 'bg-purple-100 text-purple-800 border-purple-200' }
};

export default function PusthakalayaPortal() {
  // State
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (NO YEAR FILTER)
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedMedium, setSelectedMedium] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Filter Drawer Toggle
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // PDF Preview Modal
  const [previewResource, setPreviewResource] = useState(null);

  // Fetch initial hierarchy data
  useEffect(() => {
    const fetchStructure = async () => {
      try {
        const [catRes, grRes, stRes, subRes] = await Promise.all([
          axios.get('/api/library/categories').catch(() => ({ data: { categories: [] } })),
          axios.get('/api/library/grades').catch(() => ({ data: { grades: [] } })),
          axios.get('/api/library/streams').catch(() => ({ data: { streams: [] } })),
          axios.get('/api/library/subjects').catch(() => ({ data: { subjects: [] } }))
        ]);

        if (catRes.data?.categories) setCategories(catRes.data.categories);
        if (grRes.data?.grades) setGrades(grRes.data.grades);
        if (stRes.data?.streams) setStreams(stRes.data.streams);
        if (subRes.data?.subjects) setSubjects(subRes.data.subjects);
      } catch (err) {
        console.error("Error loading library hierarchy:", err);
      }
    };
    fetchStructure();
  }, []);

  // Fetch Resources on filter change
  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedCategory !== 'ALL') params.categoryId = selectedCategory;
        if (selectedGrade !== 'ALL') params.gradeId = selectedGrade;
        if (selectedStream !== 'ALL') params.streamId = selectedStream;
        if (selectedSubject !== 'ALL') params.subjectId = selectedSubject;
        if (selectedType !== 'ALL') params.resourceType = selectedType;
        if (selectedMedium !== 'ALL') params.medium = selectedMedium;
        if (searchQuery.trim() !== '') params.search = searchQuery.trim();

        const res = await axios.get('/api/library/resources', { params });
        if (res.data?.success) {
          setResources(res.data.resources || []);
        }
      } catch (err) {
        console.error("Error fetching library resources:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [selectedCategory, selectedGrade, selectedStream, selectedSubject, selectedType, selectedMedium, searchQuery]);

  // Filtered Subjects based on Stream / Category
  const availableSubjects = useMemo(() => {
    return subjects.filter(sub => {
      if (selectedStream !== 'ALL' && sub.streamId !== parseInt(selectedStream)) return false;
      if (selectedCategory !== 'ALL' && sub.categoryId && sub.categoryId !== parseInt(selectedCategory)) return false;
      return true;
    });
  }, [subjects, selectedStream, selectedCategory]);

  // Filtered Grades based on Category
  const availableGrades = useMemo(() => {
    if (selectedCategory === 'ALL') return grades;
    return grades.filter(g => !g.categoryId || g.categoryId === parseInt(selectedCategory));
  }, [grades, selectedCategory]);

  // Filtered Streams based on Category
  const availableStreams = useMemo(() => {
    if (selectedCategory === 'ALL') return streams;
    return streams.filter(s => !s.categoryId || s.categoryId === parseInt(selectedCategory));
  }, [streams, selectedCategory]);

  // Handle Download trigger
  const handleDownload = async (resource) => {
    try {
      await axios.post(`/api/library/resources/${resource.id}/download`).catch(() => {});
      const link = document.createElement('a');
      link.href = resource.fileUrl;
      link.download = resource.fileName || `${resource.title}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(resource.fileUrl, '_blank');
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory('ALL');
    setSelectedGrade('ALL');
    setSelectedStream('ALL');
    setSelectedSubject('ALL');
    setSelectedType('ALL');
    setSelectedMedium('ALL');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-slate-900 font-sans selection:bg-[#7d0202] selection:text-white pb-20">
      
      {/* ========================================================
          STICKY TOP BRAND HEADER & NAVIGATION
      ======================================================== */}
      <header className="sticky top-0 z-50 bg-[#7d0202] text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to Campus</span>
            </Link>

            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-white p-1 border-2 border-amber-400 shadow flex items-center justify-center">
                <img src="/logo.png" alt="IMA Logo" className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight font-sinhala">
                  IMA පුස්තකාලය
                </h1>
                <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">The Free Past Paper Vault</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-amber-200 font-bold">
              <Sparkles size={14} className="text-amber-400" />
              <span>100% Free Open Educational Resource</span>
            </div>

            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider shadow transition-transform hover:scale-105"
            >
              Student Login
            </Link>
          </div>

        </div>
      </header>

      {/* ========================================================
          HERO BANNER & SEARCH BAR
      ======================================================== */}
      <section className="bg-gradient-to-b from-[#7d0202] via-[#5a0000] to-[#380000] text-white py-10 sm:py-14 px-4 sm:px-6 shadow-inner relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest">
            <Sparkles size={14} className="text-amber-300" />
            <span>Open Knowledge Repository</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            IMA <span className="text-amber-400 font-sinhala font-bold">පුස්තකාලය</span> <br />
            The Free Past Paper & Guide Vault
          </h1>

          <p className="text-sm sm:text-base text-amber-100/90 max-w-2xl mx-auto font-medium leading-relaxed">
            Download model examination papers, term test questions, teachers' guides, and official marking schemes free of charge.
          </p>

          {/* Search Box */}
          <div className="pt-2 max-w-2xl mx-auto">
            <div className="relative bg-white rounded-2xl shadow-2xl p-1.5 flex items-center border-2 border-amber-400">
              <Search size={22} className="text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by paper title, subject, stream, keywords..."
                className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-bold focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          CASCADING CATEGORY BAR & FILTER CONTROLS
      ======================================================== */}
      <div className="sticky top-[64px] z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          
          {/* Top Horizontal Category Pills (Touch-friendly & Mobile-Optimized) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => { setSelectedCategory('ALL'); setSelectedGrade('ALL'); setSelectedStream('ALL'); setSelectedSubject('ALL'); }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-[#7d0202] text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCategory(c.id); setSelectedGrade('ALL'); setSelectedStream('ALL'); setSelectedSubject('ALL'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-[#7d0202] text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Secondary Cascading Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
              
              {/* Stream Dropdown */}
              {availableStreams.length > 0 && (
                <select
                  value={selectedStream}
                  onChange={(e) => { setSelectedStream(e.target.value); setSelectedSubject('ALL'); }}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Streams</option>
                  {availableStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              {/* Grade Dropdown */}
              {availableGrades.length > 0 && (
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Grades</option>
                  {availableGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              {/* Subject Dropdown */}
              {availableSubjects.length > 0 && (
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Subjects</option>
                  {availableSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              )}

              {/* Resource Type Dropdown */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Resource Types</option>
                <option value="PAST_PAPER">Past Papers</option>
                <option value="MODEL_PAPER">Model Examination Papers</option>
                <option value="TEACHERS_GUIDE">Teachers’ Guides</option>
                <option value="SHORT_NOTE">Short Notes</option>
                <option value="TERM_TEST">Term Tests</option>
              </select>

              {/* Medium */}
              <select
                value={selectedMedium}
                onChange={(e) => setSelectedMedium(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Mediums</option>
                <option value="SINHALA">Sinhala Medium</option>
                <option value="ENGLISH">English Medium</option>
                <option value="TAMIL">Tamil Medium</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(selectedCategory !== 'ALL' || selectedStream !== 'ALL' || selectedGrade !== 'ALL' || selectedSubject !== 'ALL' || selectedType !== 'ALL' || selectedMedium !== 'ALL' || searchQuery) && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-[#7d0202] hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={12} /> Clear Filters
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================
          DOCUMENT CARDS REPOSITORY GRID
      ======================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-[#7d0202]" />
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              Available Papers & Learning Materials ({resources.length})
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#7d0202] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-bold text-slate-600">Loading documents vault...</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="py-20 px-4 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm max-w-2xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
              <FileText size={32} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">No Documents Found</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                No past papers or guides are published matching these filters yet. New resources are uploaded regularly by the academic board.
              </p>
            </div>
            <button
              onClick={clearAllFilters}
              className="px-5 py-2.5 rounded-xl bg-[#7d0202] hover:bg-[#680101] text-white font-black text-xs uppercase tracking-wider shadow transition-all cursor-pointer"
            >
              View All Resources
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {resources.map((res) => {
              const badge = RESOURCE_TYPE_BADGES[res.resourceType] || { label: res.resourceType, bg: 'bg-slate-100 text-slate-800 border-slate-200' };
              
              return (
                <div
                  key={res.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-5 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {res.medium} Medium
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug group-hover:text-[#7d0202] transition-colors">
                      {res.title}
                    </h3>

                    {/* Meta info */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Category:</span>
                        <span className="font-bold text-slate-800">{res.category?.name || 'General'}</span>
                      </div>
                      {(res.stream || res.grade) && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Stream / Grade:</span>
                          <span className="font-bold text-slate-800">{res.stream?.name || res.grade?.name}</span>
                        </div>
                      )}
                      {res.subject && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Subject:</span>
                          <span className="font-bold text-[#7d0202]">{res.subject.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Scheme Available Pill */}
                    {res.hasMarkingScheme && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>Official Marking Scheme Included</span>
                      </div>
                    )}

                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setPreviewResource(res)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      onClick={() => handleDownload(res)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#7d0202] hover:bg-[#680101] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* ========================================================
          INTERACTIVE PDF PREVIEW MODAL
      ======================================================== */}
      {previewResource && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            
            <div className="p-4 bg-[#7d0202] text-white flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 uppercase mr-2">
                  {previewResource.resourceType}
                </span>
                <span className="text-sm font-black text-white">{previewResource.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewResource)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 shadow cursor-pointer"
                >
                  <Download size={13} /> Download PDF
                </button>
                <button
                  onClick={() => setPreviewResource(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-900 relative">
              <iframe
                src={`${previewResource.fileUrl}#toolbar=1&navpanes=0`}
                title={previewResource.title}
                className="w-full h-full border-none"
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

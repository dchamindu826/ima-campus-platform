import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Layers, BookOpen, Trophy, Clock, Calendar, CheckCircle2, 
  FileText, FileSignature, Users, ArrowRight, ArrowLeft, Search, Filter, 
  Sparkles, RefreshCw, Eye, ExternalLink, ChevronRight, Award, Folder, 
  FolderOpen, LayoutDashboard, Briefcase, CheckCircle, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import PaperBuilderModal from '../common/contenthub/PaperBuilderModal';

export default function PaperMarkerDashboard({ loggedInUser, activeTab: initialTab = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'overview' | 'workplace'
  const [loading, setLoading] = useState(true);

  // Workplace Navigation State
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedClassType, setSelectedClassType] = useState('paper'); // 'paper' | 'theory' | 'all'
  const [selectedStream, setSelectedStream] = useState('all');

  // Ranking Tests State
  const [lessonGroups, setLessonGroups] = useState([]);
  const [subjectContents, setSubjectContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [openFolders, setOpenFolders] = useState({});
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [batchFilterType, setBatchFilterType] = useState('all'); // 'all' | 'paper' | 'theory'

  // Read-only Paper Builder Modal for Test Inspection & Leaderboard
  const [inspectingTest, setInspectingTest] = useState(null);
  const [showInspectorModal, setShowInspectorModal] = useState(false);

  // Overview Stats
  const [overviewStats, setOverviewStats] = useState({
    businessCount: 0,
    batchCount: 0,
    subjectCount: 0,
    testCount: 0,
    recentTests: []
  });

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        let url = api.defaults.baseURL || 'http://localhost:5000/api';
        return url.replace('/api', '');
      }
    }
    return 'https://imacampus.online';
  };

  const getImageUrl = (imageName) => {
    if (!imageName || imageName === 'default.png' || imageName === 'null') return '/logo.png';
    return `${getBaseUrl()}/storage/icons/${imageName}`;
  };

  // 1. Initial Load: Fetch Businesses allocated to this Paper Marker
  useEffect(() => {
    fetchInitialBusinesses();
  }, [loggedInUser]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const fetchInitialBusinesses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/businesses');
      const allBiz = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);

      // Filter by loggedInUser.businessType if available
      const userBizTypeStr = loggedInUser?.businessType || '';
      const userBizArray = userBizTypeStr
        ? userBizTypeStr.split(',').map(b => b.trim().toLowerCase()).filter(Boolean)
        : [];

      let allocatedBiz = allBiz;
      if (userBizArray.length > 0) {
        allocatedBiz = allBiz.filter(biz => {
          const bName = (biz.name || '').trim().toLowerCase();
          const bId = String(biz.id).trim();
          return userBizArray.some(u => u === bName || u === bId || bName.includes(u) || u.includes(bName));
        });
      }

      setBusinesses(allocatedBiz);

      // If only 1 business is allocated, auto-select it directly!
      if (allocatedBiz.length === 1) {
        const singleBiz = allocatedBiz[0];
        setSelectedBusiness(singleBiz);
        fetchBatchesForBusiness(singleBiz.id);
      }

      // Gather overview metrics
      compileOverviewStats(allocatedBiz);
    } catch (error) {
      console.error("Error fetching businesses for paper marker:", error);
      toast.error("Failed to load allocated businesses");
    } finally {
      setLoading(false);
    }
  };

  // Fetch batches for a selected business
  const fetchBatchesForBusiness = async (bizId) => {
    try {
      setLoadingBatches(true);
      const res = await api.get(`/admin/batches/${bizId}?t=${Date.now()}`);
      const fetched = res.data?.batches || (Array.isArray(res.data) ? res.data : []);
      setBatches(fetched);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast.error("Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  };

  // Compile overview statistics across assigned businesses
  const compileOverviewStats = async (bizList) => {
    try {
      let totalBatches = 0;
      let totalSubjects = 0;
      let allFoundTests = [];

      for (const b of bizList) {
        try {
          const res = await api.get(`/admin/batches/${b.id}?t=${Date.now()}`);
          const bList = res.data?.batches || [];
          totalBatches += bList.length;

          bList.forEach(batch => {
            const subsMap = new Map();
            batch.groups?.forEach(g => {
              g.courses?.forEach(c => {
                if (!subsMap.has(c.name)) {
                  subsMap.set(c.name, c);
                }
              });
            });
            totalSubjects += subsMap.size;
          });
        } catch (e) {}
      }

      setOverviewStats({
        businessCount: bizList.length,
        batchCount: totalBatches,
        subjectCount: totalSubjects,
        testCount: allFoundTests.length,
        recentTests: allFoundTests
      });
    } catch (e) {
      console.error("Error compiling stats:", e);
    }
  };

  // Handle Business Selection
  const handleSelectBusiness = (biz) => {
    setSelectedBusiness(biz);
    setSelectedBatch(null);
    setSelectedSubject(null);
    setLessonGroups([]);
    setSubjectContents([]);
    fetchBatchesForBusiness(biz.id);
  };

  // Handle Batch Selection -> Extract Unique Subjects
  const handleSelectBatch = (batch) => {
    setSelectedBatch(batch);
    setSelectedSubject(null);
    setLessonGroups([]);
    setSubjectContents([]);

    const bType = parseInt(batch?.type || 1);
    if (bType === 2) {
      setSelectedClassType('paper');
    } else {
      setSelectedClassType('paper'); // default to paper for Paper Marker
    }

    extractUniqueSubjects(batch);
  };

  const extractUniqueSubjects = (batch) => {
    const subs = [];
    batch?.groups?.forEach(g => {
      g.courses?.forEach(c => {
        const cType = parseInt(c.courseType || g.classType || 1);
        const existing = subs.find(s => s.name === c.name && parseInt(s.courseType || 1) === cType);

        let gpData = {};
        try {
          const parsed = typeof c.groupPrices === 'string' ? JSON.parse(c.groupPrices) : (c.groupPrices || []);
          gpData = parsed.find(p => parseInt(p.groupId) === parseInt(g.id)) || {};
        } catch (e) {}

        const priceObj = {
          groupId: g.id,
          groupName: g.name,
          courseId: c.id,
          price: c.price,
          lecturerName: c.lecturerName || g.lecturerName || ''
        };

        if (!existing) {
          subs.push({ ...c, courseType: cType, groupPrices: [priceObj], allCourseIds: [c.id] });
        } else {
          existing.groupPrices.push(priceObj);
          existing.allCourseIds.push(c.id);
        }
      });
    });

    setUniqueSubjects(subs.sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1)));
  };

  // Handle Subject Selection -> Fetch Ranking Tests
  const handleSelectSubject = async (subject) => {
    setSelectedSubject(subject);
    setLoadingContents(true);
    try {
      const safeCode = subject.code || `SUB_${subject.id}`;
      const courseIdsParam = subject.allCourseIds ? subject.allCourseIds.join(',') : subject.id;
      const res = await api.get(`/admin/manager/get-contents?batchId=${selectedBatch.id}&courseCode=${safeCode}&courseIds=${courseIdsParam}`);

      const groups = res.data?.lessonGroups || [];
      const contents = res.data?.contents || [];

      setLessonGroups(groups);
      setSubjectContents(contents);

      // Open all folders by default
      const openMap = {};
      groups.forEach(g => { openMap[g.id] = true; });
      setOpenFolders(openMap);
    } catch (e) {
      console.error("Error fetching subject contents:", e);
      toast.error("Failed to load ranking tests for this subject");
    } finally {
      setLoadingContents(false);
    }
  };

  const toggleFolder = (folderId) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Filter Ranking Tests only (testRanking, sPaper, paper, etc.)
  const rankingTestsList = useMemo(() => {
    return subjectContents.filter(item => {
      const cType = String(item.contentType || '').toLowerCase();
      const isTest = ['testranking', 'rankingtest', 'ranking_test', 'test', 'spaper', 'paper', '4', '5'].includes(cType) || Boolean(item.paper);
      if (!isTest) return false;

      if (testSearchQuery) {
        const titleMatch = (item.title || '').toLowerCase().includes(testSearchQuery.toLowerCase());
        return titleMatch;
      }
      return true;
    });
  }, [subjectContents, testSearchQuery]);

  // Ranking tests grouped into folders
  const groupedTests = useMemo(() => {
    const foldersMap = {};
    const uncategorized = [];

    // Filter relevant folders for tests (type 4 or 5)
    const testFolders = lessonGroups.filter(g => parseInt(g.type) === 4 || parseInt(g.type) === 5);

    testFolders.forEach(f => {
      foldersMap[f.id] = { folder: f, items: [] };
    });

    rankingTestsList.forEach(test => {
      const fId = test.content_group_id ?? test.contentGroupId ?? test.group?.id;
      if (fId && foldersMap[fId]) {
        foldersMap[fId].items.push(test);
      } else {
        uncategorized.push(test);
      }
    });

    return {
      folders: Object.values(foldersMap),
      uncategorized
    };
  }, [lessonGroups, rankingTestsList]);

  // Filtered Subjects based on classType and stream
  const filteredSubjects = useMemo(() => {
    let result = uniqueSubjects;
    if (selectedClassType === 'paper') {
      result = result.filter(s => parseInt(s.courseType || 1) === 2);
    } else if (selectedClassType === 'theory') {
      result = result.filter(s => parseInt(s.courseType || 1) === 1);
    }

    if (selectedStream !== 'all') {
      result = result.filter(s => {
        let stList = [];
        try {
          if (Array.isArray(s.streams)) stList = s.streams;
          else if (typeof s.streams === 'string') stList = JSON.parse(s.streams);
          else if (s.stream) stList = [s.stream];
        } catch (e) {
          if (typeof s.streams === 'string') stList = s.streams.split(',').map(x => x.trim());
        }
        return stList.includes(selectedStream);
      });
    }

    if (subjectSearchQuery) {
      result = result.filter(s => 
        (s.name || '').toLowerCase().includes(subjectSearchQuery.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(subjectSearchQuery.toLowerCase())
      );
    }

    return result;
  }, [uniqueSubjects, selectedClassType, selectedStream, subjectSearchQuery]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    let result = batches;
    if (batchFilterType === 'paper') {
      result = result.filter(b => parseInt(b.type || 1) === 2);
    } else if (batchFilterType === 'theory') {
      result = result.filter(b => parseInt(b.type || 1) === 1);
    }

    if (batchSearchQuery) {
      result = result.filter(b => (b.name || '').toLowerCase().includes(batchSearchQuery.toLowerCase()));
    }

    return result;
  }, [batches, batchFilterType, batchSearchQuery]);

  // Open Paper Inspector (Read-Only)
  const handleOpenTestInspector = (test) => {
    setInspectingTest(test);
    setShowInspectorModal(true);
  };

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-amber-500/30">
      
      {/* Top Header / Portal Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-[#0F172A] to-slate-900 border border-white/10 p-6 sm:p-8 mb-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                <Trophy size={13} className="text-amber-400" /> Paper Marker Portal
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-300 border border-blue-500/30">
                Department: {loggedInUser?.department || 'Class Coordination'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight drop-shadow-md">
              Welcome, {loggedInUser?.firstName || 'Marker'} {loggedInUser?.lastName || ''}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-medium">
              Review assigned businesses, navigate batches and subjects, and evaluate student ranking tests with verified mark schemes and leaderboards.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 shrink-0 shadow-inner">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={15} /> Overview
            </button>
            <button
              onClick={() => setActiveTab('workplace')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'workplace'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Briefcase size={15} /> Workplace
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. OVERVIEW VIEW */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#0D1527]/70 border border-white/10 rounded-3xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-lg hover:shadow-amber-500/5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Allocated Businesses</span>
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
              </div>
              <div className="text-3xl font-black text-white">{businesses.length}</div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium truncate">
                {businesses.map(b => b.name).join(', ') || 'No businesses'}
              </p>
            </div>

            <div className="bg-[#0D1527]/70 border border-white/10 rounded-3xl p-5 relative overflow-hidden group hover:border-blue-500/40 transition-all shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accessible Batches</span>
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Layers size={20} />
                </div>
              </div>
              <div className="text-3xl font-black text-white">{overviewStats.batchCount || batches.length || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Theory & Paper Batches</p>
            </div>

            <div className="bg-[#0D1527]/70 border border-white/10 rounded-3xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition-all shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Subjects</span>
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
              </div>
              <div className="text-3xl font-black text-white">{overviewStats.subjectCount || uniqueSubjects.length || 0}</div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Under assigned batches</p>
            </div>

            <div className="bg-[#0D1527]/70 border border-white/10 rounded-3xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Evaluation System</span>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
              </div>
              <div className="text-lg font-black text-emerald-400">Ready & Verified</div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Read-Only Mark Schemes</p>
            </div>
          </div>

          {/* Quick Action Card to Workplace */}
          <div className="bg-gradient-to-r from-amber-500/20 via-[#0E1726] to-[#0A101D] border border-amber-500/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5">
                <Sparkles size={13} /> Evaluation Workflow Ready
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Start Evaluating Ranking Tests
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                Open your allocated businesses, browse through batch courses, and inspect question papers, student submissions, and leaderboard rankings.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('workplace')}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 flex items-center gap-2 active:scale-95 shrink-0"
            >
              Go to Workplace <ArrowRight size={16} />
            </button>
          </div>

          {/* Allocated Businesses Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 size={18} className="text-amber-400" /> My Allocated Businesses ({businesses.length})
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="animate-spin text-amber-400" size={32} />
              </div>
            ) : businesses.length === 0 ? (
              <div className="bg-[#0D1527]/50 border border-white/10 rounded-3xl p-8 text-center text-slate-400 text-sm">
                No businesses currently assigned to your account. Please contact an administrator.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {businesses.map((biz) => (
                  <div
                    key={biz.id}
                    onClick={() => {
                      handleSelectBusiness(biz);
                      setActiveTab('workplace');
                    }}
                    className="bg-[#0D1527]/60 hover:bg-[#0D1527] border border-white/10 hover:border-amber-500/40 rounded-3xl p-6 transition-all duration-300 cursor-pointer group shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors overflow-hidden">
                        <img
                          src={getImageUrl(biz.logo)}
                          alt={biz.name}
                          className="w-full h-full object-contain drop-shadow"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-base font-black text-white truncate group-hover:text-amber-400 transition-colors">
                          {biz.name}
                        </h4>
                        <span className="text-[11px] font-bold text-slate-400 block mt-0.5">
                          {biz.category || 'General'} • {biz.medium || 'Sinhala'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                      <span>Open Business Batches</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. WORKPLACE VIEW (HIERARCHICAL DRILL-DOWN) */}
      {/* ========================================================= */}
      {activeTab === 'workplace' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Breadcrumb Navigation Bar */}
          <div className="bg-[#0D1527]/80 border border-white/10 rounded-2xl p-3.5 sm:p-4 flex items-center flex-wrap gap-2 text-xs font-bold backdrop-blur-md shadow-lg">
            <button
              onClick={() => {
                if (businesses.length > 1) {
                  setSelectedBusiness(null);
                }
                setSelectedBatch(null);
                setSelectedSubject(null);
              }}
              className={`hover:text-amber-400 transition-colors flex items-center gap-1.5 ${
                !selectedBatch && !selectedSubject ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              <Briefcase size={14} /> Workplace
            </button>

            {selectedBusiness && (
              <>
                <ChevronRight size={14} className="text-slate-600" />
                <button
                  onClick={() => {
                    setSelectedBatch(null);
                    setSelectedSubject(null);
                  }}
                  className={`hover:text-amber-400 transition-colors truncate max-w-[200px] ${
                    selectedBusiness && !selectedBatch ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {selectedBusiness.name}
                </button>
              </>
            )}

            {selectedBatch && (
              <>
                <ChevronRight size={14} className="text-slate-600" />
                <button
                  onClick={() => {
                    setSelectedSubject(null);
                  }}
                  className={`hover:text-amber-400 transition-colors truncate max-w-[200px] ${
                    selectedBatch && !selectedSubject ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {selectedBatch.name}
                </button>
              </>
            )}

            {selectedSubject && (
              <>
                <ChevronRight size={14} className="text-slate-600" />
                <span className="text-amber-400 truncate max-w-[200px]">
                  {selectedSubject.name}
                </span>
              </>
            )}

            {/* Back Shortcut Button */}
            {(selectedSubject || selectedBatch || (selectedBusiness && businesses.length > 1)) && (
              <button
                onClick={() => {
                  if (selectedSubject) {
                    setSelectedSubject(null);
                  } else if (selectedBatch) {
                    setSelectedBatch(null);
                  } else if (selectedBusiness && businesses.length > 1) {
                    setSelectedBusiness(null);
                  }
                }}
                className="ml-auto bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all border border-white/10"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
          </div>

          {/* ------------------------------------------------------- */}
          {/* LEVEL 1: BUSINESSES SELECTION (Only when > 1 business) */}
          {/* ------------------------------------------------------- */}
          {(!selectedBusiness || (businesses.length > 1 && !selectedBatch && !selectedSubject && selectedBusiness === null)) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Building2 size={22} className="text-amber-400" /> Select Business
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Choose a business to explore its corresponding paper and theory batches.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {businesses.map((biz) => (
                  <div
                    key={biz.id}
                    onClick={() => handleSelectBusiness(biz)}
                    className="bg-[#0D1527]/60 hover:bg-[#0D1527] border border-white/10 hover:border-amber-500/50 rounded-3xl p-6 transition-all duration-300 cursor-pointer group shadow-xl hover:-translate-y-1.5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all"></div>
                    
                    <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                      <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 p-3 flex items-center justify-center group-hover:border-amber-500/40 group-hover:scale-105 transition-all shadow-md">
                        <img
                          src={getImageUrl(biz.logo)}
                          alt={biz.name}
                          className="w-full h-full object-contain drop-shadow"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                          {biz.name}
                        </h3>
                        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-white/5 text-slate-300 border border-white/10">
                            {biz.category || 'Advance Level'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {biz.medium || 'Sinhala'}
                          </span>
                        </div>
                      </div>
                      <button className="w-full mt-2 bg-white/5 hover:bg-amber-500 hover:text-black text-amber-400 text-xs font-black py-2.5 rounded-xl border border-white/10 group-hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5">
                        Open Batches <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* LEVEL 2: BATCHES VIEW (When Business is chosen) */}
          {/* ------------------------------------------------------- */}
          {selectedBusiness && !selectedBatch && (
            <div className="space-y-6">
              {/* Business Header Banner */}
              <div className="bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center shrink-0">
                    <img
                      src={getImageUrl(selectedBusiness.logo)}
                      alt={selectedBusiness.name}
                      className="w-full h-full object-contain drop-shadow"
                      onError={(e) => { e.target.src = '/logo.png'; }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-white">{selectedBusiness.name}</h2>
                      {businesses.length === 1 && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Assigned Business
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedBusiness.category} • {selectedBusiness.medium} • {batches.length} Batches
                    </p>
                  </div>
                </div>

                {businesses.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedBusiness(null);
                      setSelectedBatch(null);
                      setSelectedSubject(null);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-all"
                  >
                    Switch Business
                  </button>
                )}
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                  <button
                    onClick={() => setBatchFilterType('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      batchFilterType === 'all' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Batches ({batches.length})
                  </button>
                  <button
                    onClick={() => setBatchFilterType('paper')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      batchFilterType === 'paper' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Paper Classes
                  </button>
                  <button
                    onClick={() => setBatchFilterType('theory')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      batchFilterType === 'theory' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Theory Batches
                  </button>
                </div>

                <div className="relative min-w-[240px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="Search batches..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Batches Grid */}
              {loadingBatches ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="animate-spin text-amber-400" size={32} />
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="bg-[#0D1527]/50 border border-white/10 rounded-3xl p-12 text-center text-slate-400 text-sm">
                  No batches found for this business.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredBatches.map((batch) => {
                    const isPaperBatch = parseInt(batch.type || 1) === 2;
                    return (
                      <div
                        key={batch.id}
                        onClick={() => handleSelectBatch(batch)}
                        className="bg-[#0D1527]/60 hover:bg-[#0D1527] border border-white/10 hover:border-amber-500/50 rounded-3xl p-5 transition-all duration-300 cursor-pointer group shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              isPaperBatch 
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            }`}>
                              {isPaperBatch ? '⚡ Paper Class' : '📖 Theory Batch'}
                            </span>
                            {batch.startMonth && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {batch.startMonth} {batch.endMonth ? `- ${batch.endMonth}` : ''}
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                              {batch.name}
                            </h3>
                            {batch.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                                {batch.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-amber-400 transition-colors">
                          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <BookOpen size={13} /> {batch.groups?.length || 0} Group(s)
                          </span>
                          <span className="flex items-center gap-1 font-black">
                            Explore Subjects <ChevronRight size={14} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* LEVEL 3: SUBJECTS VIEW (When Batch is chosen) */}
          {/* ------------------------------------------------------- */}
          {selectedBatch && !selectedSubject && (
            <div className="space-y-6">
              {/* Batch Header Banner */}
              <div className="bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{selectedBatch.name}</h2>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {selectedBusiness?.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a subject below to view its created ranking tests and student scores.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedBatch(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft size={13} /> Back to Batches
                </button>
              </div>

              {/* Class Type and Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                  <button
                    onClick={() => setSelectedClassType('paper')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      selectedClassType === 'paper' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy size={14} /> Paper Subjects
                  </button>
                  <button
                    onClick={() => setSelectedClassType('theory')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      selectedClassType === 'theory' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen size={14} /> Theory Subjects
                  </button>
                  <button
                    onClick={() => setSelectedClassType('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      selectedClassType === 'all' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Subjects
                  </button>
                </div>

                <div className="relative min-w-[240px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    placeholder="Search subjects by name or code..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Subjects Grid */}
              {filteredSubjects.length === 0 ? (
                <div className="bg-[#0D1527]/50 border border-white/10 rounded-3xl p-12 text-center text-slate-400 text-sm">
                  No subjects found under this category.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredSubjects.map((sub) => {
                    const isPaper = parseInt(sub.courseType || 1) === 2;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleSelectSubject(sub)}
                        className="bg-[#0D1527]/60 hover:bg-[#0D1527] border border-white/10 hover:border-amber-500/50 rounded-3xl p-5 transition-all duration-300 cursor-pointer group shadow-lg hover:-translate-y-1 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              isPaper 
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            }`}>
                              {isPaper ? 'Paper Class' : 'Theory'}
                            </span>
                            {sub.code && (
                              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                {sub.code}
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors leading-snug">
                              {sub.name}
                            </h3>
                            {sub.lecturerName && (
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                <Users size={12} className="text-amber-400" /> {sub.lecturerName}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-0.5 transition-transform">
                          <span className="flex items-center gap-1">
                            <Trophy size={13} /> View Ranking Tests
                          </span>
                          <ChevronRight size={15} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* LEVEL 4: RANKING TESTS (READ-ONLY CONTENT HUB ACCESS) */}
          {/* ------------------------------------------------------- */}
          {selectedSubject && (
            <div className="space-y-6">
              {/* Subject Header Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-[#0F172A] to-slate-900 border border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Subject Ranking Tests
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-300">
                      {selectedBatch?.name}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white drop-shadow-sm">
                    {selectedSubject.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any ranking test to inspect question paper, scheduled timings, student submissions, and live rankings.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedSubject(null)}
                  className="text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <ArrowLeft size={14} /> Back to Subjects
                </button>
              </div>

              {/* Tests Search Bar */}
              <div className="flex justify-between items-center gap-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Trophy size={16} className="text-amber-400" />
                  Available Ranking Tests ({rankingTestsList.length})
                </div>

                <div className="relative min-w-[260px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    placeholder="Search tests by title..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Tests Listing */}
              {loadingContents ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="animate-spin text-amber-400" size={32} />
                </div>
              ) : rankingTestsList.length === 0 ? (
                <div className="bg-[#0D1527]/50 border border-white/10 rounded-3xl p-12 text-center space-y-2">
                  <p className="text-slate-300 font-bold text-sm">No ranking tests found for this subject.</p>
                  <p className="text-xs text-slate-500">When teachers or coordinators add ranking tests in Content Hub, they will appear here for evaluation.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Folders */}
                  {groupedTests.folders.map(({ folder, items }) => {
                    if (items.length === 0) return null;
                    const isOpen = openFolders[folder.id] ?? true;

                    return (
                      <div key={folder.id} className="bg-[#0D1527]/40 border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          className="w-full p-4 sm:p-5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isOpen ? <FolderOpen size={20} className="text-amber-400" /> : <Folder size={20} className="text-amber-400" />}
                            <span className="text-sm font-extrabold text-white">{folder.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {items.length} {items.length === 1 ? 'Test' : 'Tests'}
                            </span>
                          </div>
                          <ChevronRight size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/5">
                            {items.map(test => (
                              <RankingTestCard 
                                key={test.id} 
                                test={test} 
                                onInspect={handleOpenTestInspector}
                                getBaseUrl={getBaseUrl}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized Tests */}
                  {groupedTests.uncategorized.length > 0 && (
                    <div className="space-y-4">
                      {groupedTests.folders.some(f => f.items.length > 0) && (
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                          Other Tests
                        </h4>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedTests.uncategorized.map(test => (
                          <RankingTestCard 
                            key={test.id} 
                            test={test} 
                            onInspect={handleOpenTestInspector}
                            getBaseUrl={getBaseUrl}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 3. READ-ONLY TEST INSPECTOR MODAL */}
      {/* ========================================================= */}
      {showInspectorModal && inspectingTest && (
        <PaperBuilderModal
          content={inspectingTest}
          isOpen={showInspectorModal}
          onClose={() => {
            setShowInspectorModal(false);
            setInspectingTest(null);
          }}
          onUpdated={() => {
            if (selectedSubject) {
              handleSelectSubject(selectedSubject);
            }
          }}
          readOnly={true}
        />
      )}

    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponent: Ranking Test Card
// -----------------------------------------------------------------
function RankingTestCard({ test, onInspect, getBaseUrl }) {
  const paper = test.paper;
  const pType = paper?.paperType || (test.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
  const duration = paper?.durationMinutes || test.paperTime || 60;

  return (
    <div className="bg-[#090E17]/80 border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all group shadow-md hover:shadow-xl hover:-translate-y-0.5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
            pType === 'MCQ'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : pType === 'STRUCTURED'
              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          }`}>
            {pType === 'BOTH' ? 'Combined Engine' : pType === 'STRUCTURED' ? 'Structure Essay' : 'MCQ Engine'}
          </span>

          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <Clock size={11} /> {duration}m
          </span>
        </div>

        <div>
          <h4 className="text-sm font-extrabold text-white group-hover:text-amber-400 transition-colors line-clamp-2">
            {test.title}
          </h4>
          {test.date && (
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Calendar size={11} /> {test.date.split('T')[0]}
            </p>
          )}
        </div>

        {/* Paper Details Summary */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] text-slate-400">
          <div>
            <span className="text-slate-500 block uppercase">Total Marks</span>
            <span className="font-extrabold text-white">{paper?.totalMarks ?? 100}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase">Pass Marks</span>
            <span className="font-extrabold text-emerald-400">{paper?.passMarks ?? 40}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-3 border-t border-white/5 flex gap-2">
        <button
          onClick={() => onInspect(test)}
          className="flex-1 bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-300 font-extrabold py-2 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
        >
          <Trophy size={13} /> View Rankings & Test
        </button>

        {test.fileName && (
          <a
            href={`${getBaseUrl()}/storage/documents/${test.fileName}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors flex items-center justify-center"
            title="Preview attached paper file"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

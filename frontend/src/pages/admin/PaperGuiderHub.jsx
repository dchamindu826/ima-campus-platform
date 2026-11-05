import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, Users, FileText, FileSignature, CheckCircle2, Clock, Calendar, 
  Award, Download, Eye, RefreshCw, Search, Filter, Layers, Building2, 
  BookOpen, Sparkles, Printer, ExternalLink, ChevronRight, X, Check,
  AlertCircle, ChevronDown, CheckCircle, ArrowRight, Share2, Star,
  HelpCircle, UserCheck, Percent, Hash, ShieldCheck, Flame, PenTool, FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import api from '../../api/axios';
import PaperMarkingStudio from './PaperMarkingStudio';

export default function PaperGuiderHub({ loggedInUser }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('papers'); // 'papers' | 'submissions' | 'leaderboard'

  // Loading states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingContents, setLoadingContents] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Business / Batch / Subject Selection
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Filters
  const [selectedClassType, setSelectedClassType] = useState('all'); // 'all' | 'paper' | 'theory'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'WEEKLY' | 'MONTHLY'
  const [selectedFormat, setSelectedFormat] = useState('all'); // 'all' | 'MCQ' | 'STRUCTURED' | 'BOTH'
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded Contents & Papers
  const [subjectContents, setSubjectContents] = useState([]);
  const [selectedPaperContent, setSelectedPaperContent] = useState(null); // The paper currently opened in Submissions / Leaderboard
  const [selectedPaperDetails, setSelectedPaperDetails] = useState(null); // Full paper details from /api/papers/content/:id

  // Submissions State
  const [submissions, setSubmissions] = useState([]);
  const [submissionFilterStatus, setSubmissionFilterStatus] = useState('all'); // 'all' | 'SUBMITTED' | 'GRADED' | 'PENDING_EVALUATION' | 'PASSED' | 'FAILED'
  const [submissionSearch, setSubmissionSearch] = useState('');

  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [activeStudioSubmission, setActiveStudioSubmission] = useState(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardMeta, setLeaderboardMeta] = useState(null);

  // Paper Inspection Modal State (Inspect full questions & guidelines)
  const [inspectingPaper, setInspectingPaper] = useState(null);
  const [loadingInspect, setLoadingInspect] = useState(false);

  const printRef = useRef(null);

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        let url = api.defaults.baseURL || 'http://localhost:5000/api';
        return url.replace('/api', '');
      }
    }
    return 'https://imacampus.online';
  };

  // Grade badge styling
  const getGradeBadgeStyle = (grade) => {
    const g = (grade || '').trim().toUpperCase();
    if (g.startsWith('A')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10';
    if (g.startsWith('B')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/10';
    if (g.startsWith('C')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10';
    if (g.startsWith('S') || g.startsWith('D')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10';
  };

  // ==========================================
  // 1. INITIAL LOAD: BUSINESSES
  // ==========================================
  useEffect(() => {
    fetchBusinesses();
  }, [loggedInUser]);

  const fetchBusinesses = async () => {
    try {
      setLoadingInitial(true);
      const res = await api.get('/admin/businesses');
      const allBiz = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);

      // Filter by user's businessType if restricted
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

      if (allocatedBiz.length > 0) {
        const firstBiz = allocatedBiz[0];
        setSelectedBusiness(firstBiz);
        fetchBatches(firstBiz.id);
      }
    } catch (err) {
      console.error("Error loading businesses:", err);
      toast.error("Failed to load academic institutions");
    } finally {
      setLoadingInitial(false);
    }
  };

  // ==========================================
  // 2. FETCH BATCHES FOR SELECTED BUSINESS
  // ==========================================
  const fetchBatches = async (bizId) => {
    try {
      setLoadingBatches(true);
      const res = await api.get(`/admin/batches/${bizId}?t=${Date.now()}`);
      const fetched = res.data?.batches || (Array.isArray(res.data) ? res.data : []);
      setBatches(fetched);

      if (fetched.length > 0) {
        const firstBatch = fetched[0];
        setSelectedBatch(firstBatch);
        extractSubjects(firstBatch);
      } else {
        setSelectedBatch(null);
        setUniqueSubjects([]);
        setSubjectContents([]);
      }
    } catch (err) {
      console.error("Error loading batches:", err);
      toast.error("Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  };

  // ==========================================
  // 3. EXTRACT SUBJECTS FROM BATCH GROUPS
  // ==========================================
  const extractSubjects = (batch) => {
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

    const sortedSubs = subs.sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));
    setUniqueSubjects(sortedSubs);

    if (sortedSubs.length > 0) {
      const firstSub = sortedSubs[0];
      setSelectedSubject(firstSub);
      fetchContents(batch.id, firstSub);
    } else {
      setSelectedSubject(null);
      setSubjectContents([]);
    }
  };

  // ==========================================
  // 4. FETCH CONTENTS FOR SELECTED SUBJECT
  // ==========================================
  const fetchContents = async (batchId, subject) => {
    if (!batchId || !subject) return;
    try {
      setLoadingContents(true);
      const safeCode = subject.code || `SUB_${subject.id}`;
      const courseIdsParam = subject.allCourseIds ? subject.allCourseIds.join(',') : subject.id;
      
      const res = await api.get(`/admin/manager/get-contents?batchId=${batchId}&courseCode=${safeCode}&courseIds=${courseIdsParam}`);
      const contents = res.data?.contents || [];

      // Filter only test/paper items
      const papersOnly = contents.filter(item => {
        const cType = String(item.contentType || '').toLowerCase();
        return ['testranking', 'rankingtest', 'ranking_test', 'test', 'spaper', 'paper', '4', '5'].includes(cType) || Boolean(item.paper);
      });

      setSubjectContents(papersOnly);

      // Auto-select first paper if none selected or previous is not in list
      if (papersOnly.length > 0) {
        const currentActive = papersOnly.find(p => p.id === selectedPaperContent?.id) || papersOnly[0];
        setSelectedPaperContent(currentActive);
        fetchPaperDetails(currentActive.id);
      } else {
        setSelectedPaperContent(null);
        setSelectedPaperDetails(null);
        setSubmissions([]);
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Error loading subject contents:", err);
      toast.error("Failed to load test papers for this subject");
    } finally {
      setLoadingContents(false);
    }
  };

  // ==========================================
  // 5. FETCH FULL PAPER DETAILS BY CONTENT ID
  // ==========================================
  const fetchPaperDetails = async (contentId) => {
    if (!contentId) return;
    try {
      const res = await api.get(`/papers/content/${contentId}`);
      setSelectedPaperDetails(res.data);
      
      // If we are on submissions or leaderboard, load their data
      if (res.data?.paper?.id) {
        if (activeTab === 'submissions') {
          fetchSubmissionsForPaper(res.data.paper.id);
        } else if (activeTab === 'leaderboard') {
          fetchLeaderboardForPaper(res.data.paper.id);
        }
      }
    } catch (err) {
      console.error("Error loading paper details:", err);
    }
  };

  // ==========================================
  // 6. FETCH SUBMISSIONS FOR A PAPER
  // ==========================================
  const fetchSubmissionsForPaper = async (paperId) => {
    if (!paperId) return;
    try {
      setLoadingSubmissions(true);
      const res = await api.get(`/papers/${paperId}/submissions`);
      setSubmissions(res.data?.submissions || []);
    } catch (err) {
      console.error("Error loading submissions:", err);
      toast.error("Failed to load student submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // ==========================================
  // 7. FETCH LEADERBOARD FOR A PAPER
  // ==========================================
  const fetchLeaderboardForPaper = async (paperId) => {
    if (!paperId) return;
    try {
      setLoadingLeaderboard(true);
      const res = await api.get(`/papers/${paperId}/leaderboard`);
      setLeaderboard(res.data?.leaderboard || []);
      setLeaderboardMeta({
        totalCandidates: res.data?.totalCandidates || 0,
        manualParticipantCount: res.data?.manualParticipantCount || null,
        category: res.data?.category || 'WEEKLY'
      });
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      toast.error("Failed to load leaderboard rankings");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // When tab changes, load appropriate data if paper exists
  useEffect(() => {
    const pId = selectedPaperDetails?.paper?.id;
    if (pId) {
      if (activeTab === 'submissions' && submissions.length === 0) {
        fetchSubmissionsForPaper(pId);
      } else if (activeTab === 'leaderboard' && leaderboard.length === 0) {
        fetchLeaderboardForPaper(pId);
      }
    }
  }, [activeTab, selectedPaperDetails]);

  // Handle switching paper from dropdown / cards
  const handleSelectPaper = (paperItem) => {
    setSelectedPaperContent(paperItem);
    fetchPaperDetails(paperItem.id);
  };

  // Jump to Submissions
  const handleJumpToSubmissions = (paperItem) => {
    setSelectedPaperContent(paperItem);
    fetchPaperDetails(paperItem.id);
    setActiveTab('submissions');
  };

  // Jump to Leaderboard
  const handleJumpToLeaderboard = (paperItem) => {
    setSelectedPaperContent(paperItem);
    fetchPaperDetails(paperItem.id);
    setActiveTab('leaderboard');
  };

  // Open Paper Inspection Modal
  const handleInspectPaper = async (contentItem) => {
    try {
      setLoadingInspect(true);
      const res = await api.get(`/papers/content/${contentItem.id}`);
      setInspectingPaper(res.data);
    } catch (err) {
      toast.error("Failed to open paper viewer");
    } finally {
      setLoadingInspect(false);
    }
  };

  // Handle Grade Submission Submit
  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    try {
      setIsSubmittingGrade(true);
      const res = await api.put(`/papers/submissions/${gradingSubmission.id}/grade`, {
        score: gradeScore,
        teacherFeedback: gradeFeedback
      });

      toast.success("Submission graded successfully!");
      setGradingSubmission(null);
      setGradeScore('');
      setGradeFeedback('');

      // Refresh submissions and leaderboard
      const pId = selectedPaperDetails?.paper?.id;
      if (pId) {
        fetchSubmissionsForPaper(pId);
        fetchLeaderboardForPaper(pId);
      }
    } catch (err) {
      console.error("Error grading submission:", err);
      toast.error(err.response?.data?.error || "Failed to submit grade");
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  // Handle PDF Download (Direct PDF or compiles student images into an A4 PDF)
  const handleDownloadPdf = async (sub) => {
    const base = getBaseUrl();
    const studentName = `${sub.student?.firstName || 'Student'}_${sub.student?.lastName || ''}`;
    const paperTitle = selectedPaperContent?.title || 'AnswerSheet';

    // 1. Direct PDF if available
    if (sub.answerFile && sub.answerFile.toLowerCase().endsWith('.pdf')) {
      const url = sub.answerFile.startsWith('http') ? sub.answerFile : `${base}/storage/documents/${sub.answerFile}`;
      window.open(url, '_blank');
      return;
    }

    // 2. Collect images
    const images = [];
    if (sub.answerFile && !sub.answerFile.toLowerCase().endsWith('.pdf')) {
      const url = sub.answerFile.startsWith('http') ? sub.answerFile : `${base}/storage/documents/${sub.answerFile}`;
      images.push(url);
    }

    let imgArray = [];
    if (Array.isArray(sub.answerImages)) {
      imgArray = sub.answerImages;
    } else if (typeof sub.answerImages === 'string') {
      try {
        imgArray = JSON.parse(sub.answerImages);
      } catch {
        if (sub.answerImages.trim()) imgArray = [sub.answerImages];
      }
    }

    if (Array.isArray(imgArray)) {
      imgArray.forEach(img => {
        const url = img.startsWith('http') ? img : `${base}/storage/documents/${img}`;
        if (!images.includes(url)) images.push(url);
      });
    }

    if (images.length === 0) {
      toast.error("No answer sheets or images attached to download.");
      return;
    }

    const toastId = toast.loading('Compiling student answer images into PDF...');
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = pageHeight - (margin * 2);

      for (let i = 0; i < images.length; i++) {
        if (i > 0) pdf.addPage('a4', 'portrait');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = images[i];
        });

        if (img.width && img.height) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);

          let renderWidth = printableWidth;
          let renderHeight = printableWidth * (img.height / img.width);

          if (renderHeight > printableHeight) {
            renderHeight = printableHeight;
            renderWidth = printableHeight / (img.height / img.width);
          }

          const offsetX = margin + (printableWidth - renderWidth) / 2;
          const offsetY = margin + (printableHeight - renderHeight) / 2;

          pdf.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
        }

        pdf.setFontSize(8);
        pdf.setTextColor(110);
        pdf.text(`${studentName} • ${paperTitle} • Page ${i + 1} of ${images.length}`, margin, pageHeight - 4);
      }

      const cleanStudent = studentName.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanPaper = paperTitle.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${cleanStudent}_${cleanPaper}_AnswerSheet.pdf`);
      toast.success('Answer sheet compiled into PDF successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Failed to compile PDF: ' + err.message, { id: toastId });
    }
  };

  // Export Leaderboard as CSV
  const exportLeaderboardCSV = () => {
    if (!leaderboard || leaderboard.length === 0) {
      toast.error("No rankings to export");
      return;
    }

    const title = selectedPaperContent?.title || 'Test_Rankings';
    const csvRows = [
      ['Rank', 'Student Name', 'Student ID', 'City', 'Phone', 'Total Score', 'Percentage', 'Grade', 'Time (Mins)', 'Submitted At']
    ];

    leaderboard.forEach(item => {
      csvRows.push([
        item.rank,
        `"${item.student?.firstName || ''} ${item.student?.lastName || ''}"`,
        item.student?.id || '',
        `"${item.student?.city || ''}"`,
        `"${item.student?.phone || ''}"`,
        item.score ?? 0,
        `${item.percentage || 0}%`,
        item.grade || 'F',
        item.durationMinutes || 0,
        item.submittedAt ? new Date(item.submittedAt).toLocaleString() : ''
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/[\s/]/g, '_')}_Leaderboard.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Leaderboard exported as CSV!");
  };

  // Print Leaderboard
  const handlePrintLeaderboard = () => {
    window.print();
  };

  // ==========================================
  // FILTERED DATA
  // ==========================================
  // Filtered Papers
  const filteredPapers = useMemo(() => {
    return subjectContents.filter(paper => {
      const pData = paper.paper || {};
      
      // Category filter (WEEKLY vs MONTHLY)
      if (selectedCategory !== 'all') {
        const cat = (pData.category || 'WEEKLY').toUpperCase();
        if (cat !== selectedCategory) return false;
      }

      // Format filter (MCQ vs STRUCTURED vs BOTH)
      if (selectedFormat !== 'all') {
        const fmt = (pData.paperType || 'MCQ').toUpperCase();
        if (fmt !== selectedFormat) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (paper.title || '').toLowerCase().includes(q);
        return matchTitle;
      }

      return true;
    });
  }, [subjectContents, selectedCategory, selectedFormat, searchQuery]);

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const passMarks = selectedPaperDetails?.paper?.passMarks || 40;
      const isPassed = (sub.score || 0) >= passMarks;

      // Status filter
      if (submissionFilterStatus === 'GRADED' && sub.status !== 'GRADED') return false;
      if (submissionFilterStatus === 'PENDING_EVALUATION' && sub.status !== 'PENDING_EVALUATION') return false;
      if (submissionFilterStatus === 'SUBMITTED' && (sub.status !== 'SUBMITTED' && sub.status !== 'GRADED')) return false;
      if (submissionFilterStatus === 'PASSED' && !isPassed) return false;
      if (submissionFilterStatus === 'FAILED' && isPassed) return false;

      // Search
      if (submissionSearch.trim()) {
        const q = submissionSearch.toLowerCase();
        const nameMatch = `${sub.student?.firstName || ''} ${sub.student?.lastName || ''}`.toLowerCase().includes(q);
        const phoneMatch = (sub.student?.phone || '').includes(q);
        const cityMatch = (sub.student?.city || '').toLowerCase().includes(q);
        const idMatch = String(sub.student?.id || '').includes(q);
        return nameMatch || phoneMatch || cityMatch || idMatch;
      }

      return true;
    });
  }, [submissions, submissionFilterStatus, submissionSearch, selectedPaperDetails]);

  // Filtered Leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!leaderboardSearch.trim()) return leaderboard;
    const q = leaderboardSearch.toLowerCase();
    return leaderboard.filter(item => {
      const name = `${item.student?.firstName || ''} ${item.student?.lastName || ''}`.toLowerCase();
      const city = (item.student?.city || '').toLowerCase();
      const id = String(item.student?.id || '');
      return name.includes(q) || city.includes(q) || id.includes(q);
    });
  }, [leaderboard, leaderboardSearch]);

  // Statistics calculation for current paper submissions
  const paperStats = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return { total: 0, avg: 0, high: 0, passRate: 0, gradedCount: 0 };
    }
    const scores = submissions.map(s => s.score || 0);
    const total = submissions.length;
    const high = Math.max(...scores);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : 0;
    const passMarks = selectedPaperDetails?.paper?.passMarks || 40;
    const passed = submissions.filter(s => (s.score || 0) >= passMarks).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const gradedCount = submissions.filter(s => s.status === 'GRADED').length;

    return { total, avg, high, passRate, gradedCount };
  }, [submissions, selectedPaperDetails]);

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-amber-500/30">
      
      {/* ======================================================== */}
      {/* 1. TOP PORTAL HERO BANNER */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/15 via-[#0C1222] to-indigo-950/40 border border-white/10 p-6 sm:p-8 mb-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none -mr-20 -mt-20"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/30 flex items-center gap-1.5">
                <Trophy size={13} className="text-black" /> Paper Guider & Ranking Hub
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-amber-300 border border-white/10">
                Department: {loggedInUser?.department || 'Academic & Evaluation'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <Sparkles size={11} /> Live Ranking Engine
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight drop-shadow-md">
              Academic Paper & Evaluation Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl font-medium leading-relaxed">
              Seamlessly monitor exam papers, inspect full question sets, evaluate student answer submissions, and review real-time student leaderboards and ranking analytics.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 p-2 rounded-2xl shrink-0 backdrop-blur-md shadow-inner">
            <div className="text-center px-4 py-2 border-r border-white/10">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Papers</span>
              <span className="text-xl font-black text-amber-400">{subjectContents.length}</span>
            </div>
            <div className="text-center px-4 py-2 border-r border-white/10">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Submissions</span>
              <span className="text-xl font-black text-blue-400">{paperStats.total}</span>
            </div>
            <div className="text-center px-4 py-2">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Pass Rate</span>
              <span className="text-xl font-black text-emerald-400">{paperStats.passRate}%</span>
            </div>
          </div>
        </div>

        {/* MAIN NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('papers')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'papers'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <FileText size={15} /> All Test Papers ({subjectContents.length})
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'submissions'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <Users size={15} /> Student Submissions {selectedPaperContent && `(${submissions.length})`}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <Trophy size={15} /> Live Leaderboard & Rankings {leaderboard.length > 0 && `(${leaderboard.length})`}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. CONTEXT SELECTOR: BUSINESS -> BATCH -> SUBJECT */}
      {/* ======================================================== */}
      <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 mb-8 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
            <Building2 size={16} /> Academic Scope Selection:
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => {
              if (selectedBatch && selectedSubject) {
                fetchContents(selectedBatch.id, selectedSubject);
              }
            }}
            disabled={loadingContents}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 self-start md:self-auto bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
          >
            <RefreshCw size={13} className={loadingContents ? 'animate-spin' : ''} /> Refresh Scope Data
          </button>
        </div>

        {/* 3 Step Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* 1. Business Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              1. Select Business / Brand
            </label>
            <div className="relative">
              <select
                value={selectedBusiness?.id || ''}
                onChange={(e) => {
                  const bId = parseInt(e.target.value);
                  const found = businesses.find(b => b.id === bId);
                  if (found) {
                    setSelectedBusiness(found);
                    fetchBatches(found.id);
                  }
                }}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-amber-500 appearance-none cursor-pointer"
              >
                {businesses.map(b => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white font-bold">
                    {b.name} ({b.medium || 'Sinhala'})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 2. Batch Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              2. Select Batch / Year
            </label>
            <div className="relative">
              <select
                value={selectedBatch?.id || ''}
                disabled={loadingBatches || batches.length === 0}
                onChange={(e) => {
                  const bId = parseInt(e.target.value);
                  const found = batches.find(b => b.id === bId);
                  if (found) {
                    setSelectedBatch(found);
                    extractSubjects(found);
                  }
                }}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-amber-500 appearance-none cursor-pointer disabled:opacity-50"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white font-bold">
                    {b.name} {parseInt(b.type) === 2 ? '• (Paper Class Batch)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 3. Subject Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              3. Select Academic Subject
            </label>
            <div className="relative">
              <select
                value={selectedSubject?.id || ''}
                disabled={uniqueSubjects.length === 0}
                onChange={(e) => {
                  const sId = parseInt(e.target.value);
                  const found = uniqueSubjects.find(s => s.id === sId);
                  if (found) {
                    setSelectedSubject(found);
                    if (selectedBatch) {
                      fetchContents(selectedBatch.id, found);
                    }
                  }
                }}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-amber-500 appearance-none cursor-pointer disabled:opacity-50"
              >
                {uniqueSubjects.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white font-bold">
                    {s.name} {parseInt(s.courseType) === 2 ? '• (Paper Class)' : '• (Theory)'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ALL PAPERS & TESTS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'papers' && (
        <div className="space-y-6">
          
          {/* Controls Bar */}
          <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={13} /> Filter:
              </span>

              {/* Category Filter */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedCategory === 'all' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  All Categories
                </button>
                <button
                  onClick={() => setSelectedCategory('WEEKLY')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedCategory === 'WEEKLY' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  ⚡ Weekly Tests
                </button>
                <button
                  onClick={() => setSelectedCategory('MONTHLY')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedCategory === 'MONTHLY' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  🏆 Monthly Exams
                </button>
              </div>

              {/* Format Filter */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setSelectedFormat('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedFormat === 'all' ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  All Formats
                </button>
                <button
                  onClick={() => setSelectedFormat('MCQ')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedFormat === 'MCQ' ? 'bg-emerald-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  MCQ Only
                </button>
                <button
                  onClick={() => setSelectedFormat('STRUCTURED')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedFormat === 'STRUCTURED' ? 'bg-purple-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Essay Only
                </button>
                <button
                  onClick={() => setSelectedFormat('BOTH')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedFormat === 'BOTH' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Dual (Part 1 + 2)
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search papers by title..."
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

          </div>

          {/* Papers Cards Grid */}
          {loadingContents ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/[0.02] rounded-3xl border border-white/5">
              <RefreshCw className="animate-spin text-amber-400 mb-3" size={32} />
              <p className="text-slate-400 text-xs font-bold">Loading test papers for {selectedSubject?.name || 'subject'}...</p>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-white/5 p-6 space-y-3">
              <AlertCircle size={40} className="mx-auto text-slate-500" />
              <h3 className="text-base font-bold text-white">No Test Papers Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No ranking papers match your selected filters for this subject. Try switching batches or resetting your category/format filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPapers.map((paperItem) => {
                const p = paperItem.paper || {};
                const isBoth = p.paperType === 'BOTH';
                const isMcq = p.paperType === 'MCQ';
                const isEssay = p.paperType === 'STRUCTURED';
                const isWeekly = (p.category || 'WEEKLY').toUpperCase() === 'WEEKLY';

                return (
                  <div
                    key={paperItem.id}
                    className="group bg-[#0B111E]/90 hover:bg-[#0E1627] border border-white/10 hover:border-amber-500/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between relative overflow-hidden backdrop-blur-xl"
                  >
                    {/* Top Glow bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Header Badges */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {/* Category Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          isWeekly ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {isWeekly ? '⚡ Weekly Test' : '🏆 Monthly Exam'}
                        </span>

                        {/* Format Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          isMcq ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                          isEssay ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                          'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isMcq ? 'MCQ Only' : isEssay ? 'Structure Essay' : 'Dual Part (MCQ + Essay)'}
                        </span>
                      </div>

                      {/* Paper Title */}
                      <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug drop-shadow-sm" title={paperItem.title}>
                        {paperItem.title}
                      </h3>

                      {/* Subject info */}
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                        <BookOpen size={13} className="text-amber-400" />
                        {selectedSubject?.name || 'Subject'} • {selectedBatch?.name || 'Batch'}
                      </p>
                    </div>

                    {/* Paper Meta Grid */}
                    <div className="grid grid-cols-2 gap-2.5 my-4 p-3 bg-black/40 rounded-2xl border border-white/5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                        <span className="text-xs font-black text-white flex items-center gap-1 mt-0.5">
                          <Clock size={12} className="text-blue-400" />
                          {p.durationMinutes || 60} Mins
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Marks</span>
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                          <Award size={12} className="text-emerald-400" />
                          {p.totalMarks || 100} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Pass Mark</span>
                        <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                          {p.passMarks || 40} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Timer Mode</span>
                        <span className="text-[11px] font-bold text-amber-300 mt-0.5 block truncate">
                          {p.timerMode === 'SCHEDULED' ? '⏰ Scheduled' : '✨ Flexible'}
                        </span>
                      </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      
                      {/* View Submissions & Leaderboard */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleJumpToSubmissions(paperItem)}
                          className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Users size={13} /> Submissions
                        </button>
                        
                        <button
                          onClick={() => handleJumpToLeaderboard(paperItem)}
                          className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Trophy size={13} /> Leaderboard
                        </button>
                      </div>

                      {/* Inspect Paper Questions / Master Sheet */}
                      <button
                        onClick={() => handleInspectPaper(paperItem)}
                        className="w-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Eye size={13} className="text-cyan-400" /> Inspect Questions & Guidelines
                      </button>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: STUDENT SUBMISSIONS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          
          {/* Top Paper Selector & Summary Box */}
          <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <FileText size={12} /> Viewing Submissions for Paper:
                </span>
                
                {/* Paper Selector Dropdown */}
                <div className="relative mt-1 inline-block min-w-[280px]">
                  <select
                    value={selectedPaperContent?.id || ''}
                    onChange={(e) => {
                      const cId = parseInt(e.target.value);
                      const found = subjectContents.find(p => p.id === cId);
                      if (found) handleSelectPaper(found);
                    }}
                    className="bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-extrabold outline-none focus:border-amber-500 appearance-none cursor-pointer pr-8"
                  >
                    {subjectContents.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white font-bold">
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const pId = selectedPaperDetails?.paper?.id;
                    if (pId) fetchSubmissionsForPaper(pId);
                  }}
                  disabled={loadingSubmissions}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <RefreshCw size={13} className={loadingSubmissions ? 'animate-spin' : ''} /> Refresh List
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Trophy size={13} /> View Live Leaderboard
                </button>
              </div>
            </div>

            {/* Performance Overview KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Total Submissions</span>
                <span className="text-2xl font-black text-white mt-1 block">{paperStats.total}</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Average Score</span>
                <span className="text-2xl font-black text-blue-400 mt-1 block">{paperStats.avg}%</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Highest Score</span>
                <span className="text-2xl font-black text-amber-400 mt-1 block">{paperStats.high} pts</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-3.5 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Pass Rate</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">{paperStats.passRate}%</span>
              </div>
            </div>

          </div>

          {/* Submissions Controls & Filter Bar */}
          <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={12} /> Status:
              </span>
              <button
                onClick={() => setSubmissionFilterStatus('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${submissionFilterStatus === 'all' ? 'bg-amber-500 text-black shadow' : 'bg-black/40 text-slate-400 hover:text-white'}`}
              >
                All ({submissions.length})
              </button>
              <button
                onClick={() => setSubmissionFilterStatus('GRADED')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${submissionFilterStatus === 'GRADED' ? 'bg-emerald-500 text-black shadow' : 'bg-black/40 text-slate-400 hover:text-white'}`}
              >
                Graded
              </button>
              <button
                onClick={() => setSubmissionFilterStatus('PENDING_EVALUATION')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${submissionFilterStatus === 'PENDING_EVALUATION' ? 'bg-amber-500 text-black shadow' : 'bg-black/40 text-slate-400 hover:text-white'}`}
              >
                Pending Evaluation
              </button>
              <button
                onClick={() => setSubmissionFilterStatus('PASSED')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${submissionFilterStatus === 'PASSED' ? 'bg-blue-500 text-white shadow' : 'bg-black/40 text-slate-400 hover:text-white'}`}
              >
                Passed
              </button>
            </div>

            {/* Student Search */}
            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                placeholder="Search student by name, phone, city..."
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
              {submissionSearch && (
                <button onClick={() => setSubmissionSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

          </div>

          {/* Submissions Table */}
          {loadingSubmissions ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/[0.02] rounded-3xl border border-white/5">
              <RefreshCw className="animate-spin text-amber-400 mb-3" size={30} />
              <p className="text-slate-400 text-xs font-bold">Loading student submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] rounded-3xl border border-white/5 p-6 space-y-2">
              <AlertCircle size={36} className="mx-auto text-slate-500 mb-2" />
              <h4 className="text-sm font-bold text-white">No Submissions Found</h4>
              <p className="text-xs text-slate-400">
                {submissions.length === 0
                  ? "No students have attempted this test paper yet."
                  : "No submissions match your active filter."}
              </p>
            </div>
          ) : (
            <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-black/50 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="p-4">Student</th>
                      <th className="p-4">Phone / City</th>
                      <th className="p-4">Started / Submitted</th>
                      <th className="p-4">Time Taken</th>
                      <th className="p-4">Score Breakdown</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {filteredSubmissions.map((sub) => {
                      const passMarks = selectedPaperDetails?.paper?.passMarks || 40;
                      const isPassed = (sub.score || 0) >= passMarks;
                      const pType = selectedPaperDetails?.paper?.paperType || 'MCQ';

                      return (
                        <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                          
                          {/* Student Info */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-md">
                                {sub.student?.firstName?.charAt(0) || 'S'}
                              </div>
                              <div>
                                <p className="font-extrabold text-white text-xs leading-tight">
                                  {sub.student?.firstName} {sub.student?.lastName}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono">ID #{sub.student?.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Phone / City */}
                          <td className="p-4 text-slate-300">
                            <p className="font-medium text-xs">{sub.student?.phone || 'No Phone'}</p>
                            <span className="text-[10px] text-slate-500">{sub.student?.city || 'City Unknown'}</span>
                          </td>

                          {/* Time */}
                          <td className="p-4 text-slate-300">
                            <p className="text-[11px] font-bold text-white">
                              {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="p-4 text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold">
                              {sub.startedAt && sub.submittedAt 
                                ? `${Math.round((new Date(sub.submittedAt) - new Date(sub.startedAt)) / 60000)} mins`
                                : '-'}
                            </span>
                          </td>

                          {/* Score Breakdown & Document Badge */}
                          <td className="p-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-black ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {sub.score !== null ? `${sub.score} pts` : 'Pending'}
                                </span>
                                {sub.grade && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${getGradeBadgeStyle(sub.grade)}`}>
                                    Grade {sub.grade}
                                  </span>
                                )}
                              </div>

                              {pType === 'BOTH' && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <span>MCQ: <strong className="text-white">{sub.mcqScore ?? 0}</strong></span>
                                  <span>•</span>
                                  <span>Essay: <strong className="text-white">{sub.structuredScore !== null ? sub.structuredScore : 'Ungraded'}</strong></span>
                                </div>
                              )}

                              {/* Attached Document Status */}
                              <div className="pt-0.5">
                                {sub.answerFile && sub.answerFile.toLowerCase().endsWith('.pdf') ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-md">
                                    <FileText size={11} className="text-purple-400" /> PDF Answer Sheet
                                  </span>
                                ) : (sub.answerImages && (Array.isArray(sub.answerImages) ? sub.answerImages.length > 0 : sub.answerImages.length > 2)) || sub.answerFile ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 rounded-md">
                                    <Layers size={11} className="text-blue-400" /> Answer Photos (PDF Ready)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">No Upload</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              sub.status === 'GRADED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              sub.status === 'PENDING_EVALUATION' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}>
                              {sub.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              
                              {/* Download PDF button (handles both direct PDF and images compiled into PDF) */}
                              {(sub.answerFile || (sub.answerImages && sub.answerImages.length > 0)) && (
                                <button
                                  onClick={() => handleDownloadPdf(sub)}
                                  className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all active:scale-95 shadow border border-white/5"
                                  title="Download Answer Sheet as PDF (Compiles images into a clean PDF automatically)"
                                >
                                  <Download size={13} className="text-blue-400" />
                                  <span>PDF</span>
                                </button>
                              )}

                              {/* View & Mark Paper Studio Button */}
                              <button
                                onClick={() => setActiveStudioSubmission(sub)}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-95"
                                title="Open Full-Screen Digital Marking Studio to annotate and mark"
                              >
                                <Sparkles size={13} className="text-amber-300" />
                                <span>{sub.structuredScore !== null ? 'Re-Mark & View' : 'Mark Paper'}</span>
                              </button>

                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LEADERBOARD & RANKINGS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6" ref={printRef}>
          
          {/* Top Paper Selector & Export Bar */}
          <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Trophy size={13} /> Live Ranking Leaderboard For:
                </span>
                
                {/* Paper Selector Dropdown */}
                <div className="relative mt-1 inline-block min-w-[280px]">
                  <select
                    value={selectedPaperContent?.id || ''}
                    onChange={(e) => {
                      const cId = parseInt(e.target.value);
                      const found = subjectContents.find(p => p.id === cId);
                      if (found) handleSelectPaper(found);
                    }}
                    className="bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-extrabold outline-none focus:border-amber-500 appearance-none cursor-pointer pr-8"
                  >
                    {subjectContents.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white font-bold">
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const pId = selectedPaperDetails?.paper?.id;
                    if (pId) fetchLeaderboardForPaper(pId);
                  }}
                  disabled={loadingLeaderboard}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <RefreshCw size={13} className={loadingLeaderboard ? 'animate-spin' : ''} /> Refresh Rankings
                </button>
                <button
                  onClick={exportLeaderboardCSV}
                  className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  onClick={handlePrintLeaderboard}
                  className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer size={13} /> Print
                </button>
              </div>
            </div>

            {/* Candidate Pool Note */}
            {leaderboardMeta?.manualParticipantCount && (
              <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                <ShieldCheck size={14} className="text-amber-400" />
                <span>
                  Official Participant Pool: <strong>{leaderboardMeta.manualParticipantCount} Candidates</strong> (Rankings calculated out of this official pool).
                </span>
              </div>
            )}

          </div>

          {/* TOP 3 PODIUM CARDS */}
          {leaderboard.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              
              {/* 2nd Place (Silver) */}
              <div className="order-2 md:order-1 bg-gradient-to-b from-slate-700/20 via-slate-800/15 to-[#0B111E] border border-slate-400/30 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-xl shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-slate-300/20 border-2 border-slate-300 text-slate-200 flex items-center justify-center font-black text-2xl mb-3 shadow-lg">
                  🥈
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-white/10 px-3 py-1 rounded-full mb-2">
                  Rank #2 • Silver Medal
                </span>
                <h4 className="font-black text-white text-base truncate max-w-full">
                  {leaderboard[1]?.student?.firstName} {leaderboard[1]?.student?.lastName}
                </h4>
                <p className="text-xs text-slate-400 font-medium">{leaderboard[1]?.student?.city || 'Student'}</p>
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex justify-around">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Score</span>
                    <span className="text-xl font-black text-white">{leaderboard[1]?.score ?? 0} pts</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Duration</span>
                    <span className="text-xs font-bold text-slate-300 mt-1 block">{leaderboard[1]?.durationMinutes} mins</span>
                  </div>
                </div>
              </div>

              {/* 1st Place (Gold) - Elevated & Highlighted */}
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/25 via-amber-600/10 to-[#0B111E] border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-2xl shadow-2xl shadow-amber-500/20 md:-translate-y-3">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>
                <div className="w-16 h-16 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black text-3xl mb-3 shadow-xl shadow-amber-500/40">
                  🥇
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-950 bg-amber-400 px-3.5 py-1 rounded-full mb-2 shadow">
                  Rank #1 • Champion
                </span>
                <h4 className="font-black text-white text-lg sm:text-xl truncate max-w-full">
                  {leaderboard[0]?.student?.firstName} {leaderboard[0]?.student?.lastName}
                </h4>
                <p className="text-xs text-amber-200/80 font-medium">{leaderboard[0]?.student?.city || 'Top Student'}</p>
                <div className="mt-4 pt-4 border-t border-amber-500/30 w-full flex justify-around">
                  <div>
                    <span className="text-[10px] text-amber-300 uppercase font-bold block">Final Score</span>
                    <span className="text-2xl font-black text-white">{leaderboard[0]?.score ?? 0} pts</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-300 uppercase font-bold block">Duration</span>
                    <span className="text-sm font-bold text-slate-200 mt-1 block">{leaderboard[0]?.durationMinutes} mins</span>
                  </div>
                </div>
              </div>

              {/* 3rd Place (Bronze) */}
              <div className="order-3 bg-gradient-to-b from-amber-800/20 via-amber-900/10 to-[#0B111E] border border-amber-700/30 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-xl shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-700/20 border-2 border-amber-600/50 text-amber-400 flex items-center justify-center font-black text-2xl mb-3 shadow-lg">
                  🥉
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-white/10 px-3 py-1 rounded-full mb-2">
                  Rank #3 • Bronze Medal
                </span>
                <h4 className="font-black text-white text-base truncate max-w-full">
                  {leaderboard[2]?.student?.firstName || 'Third Spot'} {leaderboard[2]?.student?.lastName || ''}
                </h4>
                <p className="text-xs text-slate-400 font-medium">{leaderboard[2]?.student?.city || 'Student'}</p>
                <div className="mt-4 pt-3 border-t border-white/10 w-full flex justify-around">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Score</span>
                    <span className="text-xl font-black text-white">{leaderboard[2]?.score ?? 0} pts</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Duration</span>
                    <span className="text-xs font-bold text-slate-300 mt-1 block">{leaderboard[2]?.durationMinutes || 0} mins</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Leaderboard Search & Controls */}
          <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Award size={15} className="text-amber-400" /> Full Candidate Ranking Table ({leaderboard.length})
            </span>

            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
                placeholder="Find student rank by name or ID..."
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
              {leaderboardSearch && (
                <button onClick={() => setLeaderboardSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Full Leaderboard Table */}
          {loadingLeaderboard ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/[0.02] rounded-3xl border border-white/5">
              <RefreshCw className="animate-spin text-amber-400 mb-3" size={30} />
              <p className="text-slate-400 text-xs font-bold">Computing rankings...</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] rounded-3xl border border-white/5 p-6 space-y-2">
              <Trophy size={36} className="mx-auto text-slate-500 mb-2" />
              <h4 className="text-sm font-bold text-white">No Rankings Available</h4>
              <p className="text-xs text-slate-400">
                {leaderboard.length === 0
                  ? "No student attempts have been submitted for this paper yet."
                  : "No students match your leaderboard search."}
              </p>
            </div>
          ) : (
            <div className="bg-[#0B111E]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-black/50 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="p-4 text-center w-16">Rank</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Student ID / City</th>
                      <th className="p-4">Score & Grade</th>
                      <th className="p-4">Percentage</th>
                      <th className="p-4">Time Taken</th>
                      <th className="p-4">Completed On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {filteredLeaderboard.map((item) => {
                      const isTop3 = item.rank <= 3;
                      const isTop10 = item.rank <= 10;

                      return (
                        <tr key={item.rank} className={`hover:bg-white/[0.02] transition-colors ${item.rank === 1 ? 'bg-amber-500/5' : ''}`}>
                          
                          {/* Rank Icon / Number */}
                          <td className="p-4 text-center font-black">
                            {item.rank === 1 ? (
                              <span className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black text-sm mx-auto shadow-md">
                                🥇
                              </span>
                            ) : item.rank === 2 ? (
                              <span className="w-8 h-8 rounded-xl bg-slate-300 text-black flex items-center justify-center font-black text-sm mx-auto shadow-md">
                                🥈
                              </span>
                            ) : item.rank === 3 ? (
                              <span className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center font-black text-sm mx-auto shadow-md">
                                🥉
                              </span>
                            ) : (
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs mx-auto ${
                                isTop10 ? 'bg-white/10 text-amber-300' : 'text-slate-400'
                              }`}>
                                #{item.rank}
                              </span>
                            )}
                          </td>

                          {/* Student Name */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-300 flex items-center justify-center font-black text-xs">
                                {item.student?.firstName?.charAt(0) || 'S'}
                              </div>
                              <p className="font-extrabold text-white text-xs">
                                {item.student?.firstName} {item.student?.lastName}
                              </p>
                            </div>
                          </td>

                          {/* ID & City */}
                          <td className="p-4 text-slate-300">
                            <p className="text-xs font-mono">ID #{item.student?.id}</p>
                            <span className="text-[10px] text-slate-500">{item.student?.city || 'No City'}</span>
                          </td>

                          {/* Score & Grade */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-white">
                                {item.score ?? 0} pts
                              </span>
                              {item.grade && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${getGradeBadgeStyle(item.grade)}`}>
                                  Grade {item.grade}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Percentage */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <span className="text-xs font-black text-amber-400">{item.percentage || 0}%</span>
                              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                                  style={{ width: `${Math.min(item.percentage || 0, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Time Taken */}
                          <td className="p-4 text-slate-300">
                            <span className="text-xs font-bold text-slate-300">{item.durationMinutes || 0} Mins</span>
                          </td>

                          {/* Completed At */}
                          <td className="p-4 text-slate-400 text-[11px]">
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '-'}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL: GRADE STRUCTURED ESSAY SUBMISSION */}
      {/* ======================================================== */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0e1626] border border-white/20 rounded-3xl p-6 sm:p-7 w-full max-w-lg space-y-5 shadow-2xl relative">
            
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <FileSignature size={20} className="text-purple-400" />
                <h4 className="font-extrabold text-white text-base">
                  Grade Submission: {gradingSubmission.student?.firstName} {gradingSubmission.student?.lastName}
                </h4>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Answer File Links */}
            {gradingSubmission.answerFile && (
              <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={16} className="text-purple-300 shrink-0" />
                  <span className="text-xs text-purple-200 font-mono truncate">{gradingSubmission.answerFile}</span>
                </div>
                <a
                  href={`${getBaseUrl()}/storage/documents/${gradingSubmission.answerFile}`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-all shadow"
                >
                  <Download size={13} /> View Sheet
                </a>
              </div>
            )}

            {/* Marks Input */}
            <form onSubmit={handleGradeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Structured Essay Marks (out of {selectedPaperDetails?.paper?.totalStructuredMarks || selectedPaperDetails?.paper?.totalMarks || 100})
                </label>
                <input
                  type="number"
                  required
                  step="0.5"
                  min="0"
                  max={selectedPaperDetails?.paper?.totalStructuredMarks || selectedPaperDetails?.paper?.totalMarks || 100}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-purple-500"
                  placeholder="e.g. 42.5"
                />
                {selectedPaperDetails?.paper?.paperType === 'BOTH' && gradingSubmission.mcqScore !== null && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 font-medium">
                    💡 Part 1 MCQ: <strong>{gradingSubmission.mcqScore} pts</strong> + Part 2 Essay: <strong>{gradeScore || 0} pts</strong> = Total: <strong>{(parseFloat(gradingSubmission.mcqScore) + parseFloat(gradeScore || 0)).toFixed(1)} pts</strong>
                  </p>
                )}
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Lecturer / Guider Guidance Remarks
                </label>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 resize-y"
                  placeholder="Provide personalized remarks, corrections, or encouragement for the student..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrade}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-2 rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingGrade ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  Submit Grade & Update Ranking
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL: INSPECT PAPER QUESTIONS & GUIDELINES */}
      {/* ======================================================== */}
      {inspectingPaper && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0e1626] border border-white/20 rounded-3xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Paper Inspection & Answer Key
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  {inspectingPaper.content?.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Format: <strong>{inspectingPaper.paper?.paperType}</strong> • Duration: <strong>{inspectingPaper.paper?.durationMinutes} Mins</strong> • Total: <strong>{inspectingPaper.paper?.totalMarks} pts</strong>
                </p>
              </div>
              <button onClick={() => setInspectingPaper(null)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar my-4 space-y-6 pr-2">
              
              {/* Question Master Sheet PDF Downloads */}
              {(inspectingPaper.paper?.structuredPaperFile || inspectingPaper.paper?.mcqPaperFile) && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" /> Master Question Paper File(s)
                  </h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    {inspectingPaper.paper?.mcqPaperFile && (
                      <a
                        href={`${getBaseUrl()}/storage/documents/${inspectingPaper.paper.mcqPaperFile}`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Download size={13} /> Part 1: MCQ Question Sheet (PDF)
                      </a>
                    )}
                    {inspectingPaper.paper?.structuredPaperFile && (
                      <a
                        href={`${getBaseUrl()}/storage/documents/${inspectingPaper.paper.structuredPaperFile}`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Download size={13} /> Part 2: Structured Essay Sheet (PDF)
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {inspectingPaper.paper?.instructions && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-xs text-amber-200 leading-relaxed">
                  <strong>Exam Instructions:</strong> {inspectingPaper.paper.instructions}
                </div>
              )}

              {/* MCQ Questions List */}
              {inspectingPaper.paper?.questions && inspectingPaper.paper.questions.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" /> MCQ Question Key ({inspectingPaper.paper.questions.length} Questions)
                  </h4>

                  <div className="space-y-3.5">
                    {inspectingPaper.paper.questions.map((q, idx) => (
                      <div key={q.id} className="bg-black/40 border border-white/10 rounded-2xl p-4.5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-white text-xs leading-relaxed">
                            <span className="text-amber-400 mr-1.5">Q{q.questionNo || (idx + 1)}.</span>
                            {q.questionText}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded shrink-0">
                            {q.marks || 1} pt
                          </span>
                        </div>

                        {/* Diagrams */}
                        {q.image && (
                          <div className="max-w-xs rounded-xl overflow-hidden border border-white/10 bg-black/60 p-1">
                            <img src={`${getBaseUrl()}/storage/documents/${q.image}`} alt="Question diagram" className="w-full h-auto object-contain rounded-lg" />
                          </div>
                        )}

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options?.map((opt, oIdx) => (
                            <div
                              key={opt.id || oIdx}
                              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                opt.isCorrect
                                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold'
                                  : 'bg-white/[0.02] border-white/5 text-slate-400'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                                opt.isCorrect ? 'bg-emerald-500 text-black font-black' : 'bg-white/10 text-slate-400'
                              }`}>
                                {oIdx + 1}
                              </span>
                              <span className="truncate">{opt.optionText}</span>
                              {opt.isCorrect && <Check size={12} className="ml-auto text-emerald-400 shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 font-medium bg-white/5 rounded-2xl border border-white/10">
                  No digital MCQ questions configured for this paper. It uses master PDF question sheets.
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-4 flex justify-end shrink-0">
              <button
                onClick={() => setInspectingPaper(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. FULL-SCREEN DIGITAL PAPER MARKING & ANNOTATION STUDIO */}
      {/* ======================================================== */}
      {activeStudioSubmission && (
        <PaperMarkingStudio
          submission={activeStudioSubmission}
          submissionsList={filteredSubmissions}
          paperDetails={selectedPaperDetails || { paper: selectedPaperDetails?.paper, content: selectedPaperContent }}
          getBaseUrl={getBaseUrl}
          onClose={() => setActiveStudioSubmission(null)}
          onGradeSaved={() => {
            const pId = selectedPaperDetails?.paper?.id;
            if (pId) {
              fetchSubmissionsForPaper(pId);
              fetchLeaderboardForPaper(pId);
            }
          }}
        />
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  X, Save, Plus, Trash2, CheckCircle2, Clock, Calendar, 
  FileText, CheckCircle, Users, Award, AlertCircle, FileSignature, 
  HelpCircle, Sparkles, ChevronRight, Eye, RefreshCw, UploadCloud, Download,
  Trophy, Layers, Image as ImageIcon, ZoomIn, Loader2, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import AiPdfMcqExtractorModal from './AiPdfMcqExtractorModal';

export default function PaperBuilderModal({ content, isOpen, onClose, onUpdated, readOnly = false }) {
  const [activeTab, setActiveTab] = useState('questions'); // 'questions' | 'pdf' | 'settings' | 'submissions' | 'leaderboard'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Paper config
  const [paperId, setPaperId] = useState(null);
  const [paperType, setPaperType] = useState('MCQ'); // 'MCQ' | 'STRUCTURED' | 'BOTH'
  const [timerMode, setTimerMode] = useState('FLEXIBLE'); // 'SCHEDULED' | 'FLEXIBLE'
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passMarks, setPassMarks] = useState(40);
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('WEEKLY'); // 'WEEKLY' | 'MONTHLY'
  const [manualParticipantCount, setManualParticipantCount] = useState('');

  const defaultGradingScale = [
    { grade: 'A', min: 75, max: 100 },
    { grade: 'B', min: 65, max: 74 },
    { grade: 'C', min: 55, max: 64 },
    { grade: 'S', min: 35, max: 54 },
    { grade: 'F', min: 0, max: 34 }
  ];
  const [gradingScale, setGradingScale] = useState(defaultGradingScale);

  const handleUpdateGradeTier = (index, field, value) => {
    setGradingScale(prev => {
      const updated = [...prev];
      updated[index] = { 
        ...updated[index], 
        [field]: field === 'grade' ? value : (value === '' ? '' : parseFloat(value)) 
      };
      return updated;
    });
  };

  const handleAddGradeTier = () => {
    setGradingScale(prev => [
      ...prev,
      { grade: 'New', min: 0, max: 0 }
    ]);
  };

  const handleRemoveGradeTier = (index) => {
    setGradingScale(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetStandardGrade = () => {
    setGradingScale(defaultGradingScale);
  };

  const getGradeBadgeStyle = (grade) => {
    const g = (grade || '').trim().toUpperCase();
    if (g.startsWith('A')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (g.startsWith('B')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (g.startsWith('C')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (g.startsWith('S') || g.startsWith('D')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  // Dual section independent scheduling & upload window
  const [mcqTimerMode, setMcqTimerMode] = useState('FLEXIBLE'); // 'SCHEDULED' | 'FLEXIBLE'
  const [mcqScheduledStartTime, setMcqScheduledStartTime] = useState('');
  const [structuredTimerMode, setStructuredTimerMode] = useState('FLEXIBLE'); // 'SCHEDULED' | 'FLEXIBLE'
  const [structuredScheduledStartTime, setStructuredScheduledStartTime] = useState('');
  const [breakIntervalMinutes, setBreakIntervalMinutes] = useState(15);
  const [structuredUploadMinutes, setStructuredUploadMinutes] = useState(15);

  // Dual durations & marks for BOTH
  const [mcqDurationHours, setMcqDurationHours] = useState(1);
  const [mcqDurationMinutes, setMcqDurationMinutes] = useState(0);
  const [structuredDurationHours, setStructuredDurationHours] = useState(2);
  const [structuredDurationMinutes, setStructuredDurationMinutes] = useState(0);
  const [totalMcqMarks, setTotalMcqMarks] = useState(50);
  const [totalStructuredMarks, setTotalStructuredMarks] = useState(50);
  const [mcqPaperFile, setMcqPaperFile] = useState('');
  const [structuredPaperFile, setStructuredPaperFile] = useState('');
  const [questionCount, setQuestionCount] = useState(content?.questionCount || 4);
  const [hasLeaderboard, setHasLeaderboard] = useState(true);
  const [uploadingMasterSheet, setUploadingMasterSheet] = useState(false);

  // MCQ Questions list
  const [questions, setQuestions] = useState([]);
  const [showAiPdfModal, setShowAiPdfModal] = useState(false);

  // Submissions list
  const [submissions, setSubmissions] = useState([]);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Leaderboard / Rankings
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Question Images upload & preview state
  const [uploadingQuestionIdx, setUploadingQuestionIdx] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const toLocalDatetimeInputValue = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
  };

  const toUTCISOString = (localDatetimeStr) => {
    if (!localDatetimeStr) return null;
    const d = new Date(localDatetimeStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  // Upload Master Essay PDF handler
  const handleUploadMasterSheetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Please upload a PDF file only.");
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentId', content.id);
    formData.append('paperType', paperType);

    setUploadingMasterSheet(true);
    try {
      const res = await api.post('/papers/upload-master-sheet', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStructuredPaperFile(res.data.filename);
      toast.success("Master Essay PDF uploaded successfully!");
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Upload error", err);
      toast.error("Failed to upload master essay PDF");
    } finally {
      setUploadingMasterSheet(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (isOpen && content?.id) {
      fetchPaperDetails();
    }
  }, [isOpen, content?.id]);

  const fetchPaperDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/papers/content/${content.id}`);
      const p = res.data?.paper;
      if (p) {
        setPaperId(p.id);
        const resolvedType = p.paperType || (content.contentType === 'sPaper' ? 'STRUCTURED' : 'MCQ');
        setPaperType(resolvedType);
        if (resolvedType === 'STRUCTURED') {
          setActiveTab('pdf');
        } else {
          setActiveTab('questions');
        }
        setTimerMode(p.timerMode || 'FLEXIBLE');
        setScheduledStartTime(toLocalDatetimeInputValue(p.scheduledStartTime));
        setMcqTimerMode(p.mcqTimerMode || p.timerMode || 'FLEXIBLE');
        setMcqScheduledStartTime(toLocalDatetimeInputValue(p.mcqScheduledStartTime || p.scheduledStartTime));
        setStructuredTimerMode(p.structuredTimerMode || p.timerMode || 'FLEXIBLE');
        setStructuredScheduledStartTime(toLocalDatetimeInputValue(p.structuredScheduledStartTime || p.scheduledStartTime));
        setBreakIntervalMinutes(p.breakIntervalMinutes !== null && p.breakIntervalMinutes !== undefined ? p.breakIntervalMinutes : 15);
        setStructuredUploadMinutes(p.structuredUploadMinutes !== null && p.structuredUploadMinutes !== undefined ? p.structuredUploadMinutes : 15);
        setCategory(p.category || 'WEEKLY');
        setHasLeaderboard(p.hasLeaderboard !== undefined ? p.hasLeaderboard : true);
        if (res.data?.content?.questionCount) {
          setQuestionCount(res.data.content.questionCount);
        } else if (content?.questionCount) {
          setQuestionCount(content.questionCount);
        }
        setManualParticipantCount(p.manualParticipantCount !== null && p.manualParticipantCount !== undefined ? String(p.manualParticipantCount) : '');
        
        const mcqMins = resolvedType === 'MCQ'
          ? (p.durationMinutes || p.mcqDurationMinutes || content.paperTime || 60)
          : (p.mcqDurationMinutes ?? (p.durationMinutes || content.paperTime || 60));
        setMcqDurationHours(Math.floor(mcqMins / 60));
        setMcqDurationMinutes(mcqMins % 60);

        const structMins = resolvedType === 'STRUCTURED'
          ? (p.durationMinutes || p.structuredDurationMinutes || content.paperTime || 60)
          : (p.structuredDurationMinutes ?? (p.durationMinutes || content.paperTime || 60));
        setStructuredDurationHours(Math.floor(structMins / 60));
        setStructuredDurationMinutes(structMins % 60);

        const totalMins = resolvedType === 'MCQ' ? mcqMins : (resolvedType === 'STRUCTURED' ? structMins : (p.durationMinutes || (mcqMins + structMins)));
        setDurationHours(Math.floor(totalMins / 60));
        setDurationMinutes(totalMins % 60);

        setTotalMcqMarks(p.totalMcqMarks ?? 50);
        setTotalStructuredMarks(p.totalStructuredMarks ?? 50);
        setTotalMarks(p.totalMarks || 100);
        setPassMarks(p.passMarks || 40);
        if (p.gradingScale) {
          try {
            const parsed = typeof p.gradingScale === 'string' ? JSON.parse(p.gradingScale) : p.gradingScale;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setGradingScale(parsed);
            } else {
              setGradingScale(defaultGradingScale);
            }
          } catch (e) {
            setGradingScale(defaultGradingScale);
          }
        } else {
          setGradingScale(defaultGradingScale);
        }
        setInstructions(p.instructions || '');
        setMcqPaperFile(p.mcqPaperFile || '');
        setStructuredPaperFile(p.structuredPaperFile || content.fileName || '');

        if (p.questions && p.questions.length > 0) {
          setQuestions(p.questions.map(q => {
            const initialImages = Array.isArray(q.images) && q.images.length > 0 
              ? q.images 
              : (q.image ? [q.image] : []);
            return {
              id: q.id,
              questionNo: q.questionNo,
              questionText: q.questionText,
              image: initialImages.length > 0 ? initialImages[0] : '',
              images: initialImages,
              marks: q.marks || 1,
              options: q.options && q.options.length > 0 ? q.options.map(opt => ({
                id: opt.id,
                optionNo: opt.optionNo,
                optionText: opt.optionText,
                isCorrect: Boolean(opt.isCorrect)
              })) : [
                { optionNo: 1, optionText: '', isCorrect: true },
                { optionNo: 2, optionText: '', isCorrect: false },
                { optionNo: 3, optionText: '', isCorrect: false },
                { optionNo: 4, optionText: '', isCorrect: false },
                { optionNo: 5, optionText: '', isCorrect: false }
              ]
            };
          }));
        } else {
          // Initialize with 1 default question
          setQuestions([
            {
              questionNo: 1,
              questionText: '',
              image: '',
              images: [],
              marks: 1,
              options: [
                { optionNo: 1, optionText: '', isCorrect: true },
                { optionNo: 2, optionText: '', isCorrect: false },
                { optionNo: 3, optionText: '', isCorrect: false },
                { optionNo: 4, optionText: '', isCorrect: false },
                { optionNo: 5, optionText: '', isCorrect: false }
              ]
            }
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to load paper details", err);
      toast.error("Failed to load paper settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!paperId) return;
    try {
      const res = await api.get(`/papers/${paperId}/submissions`);
      setSubmissions(res.data?.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions", err);
      toast.error("Failed to load student submissions");
    }
  };

  const fetchLeaderboard = async () => {
    if (!paperId) return;
    try {
      setLoadingLeaderboard(true);
      const res = await api.get(`/papers/${paperId}/leaderboard`);
      setLeaderboard(res.data?.leaderboard || []);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
      toast.error("Failed to load rankings leaderboard");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'submissions' && paperId) {
      fetchSubmissions();
    } else if (activeTab === 'leaderboard' && paperId) {
      fetchLeaderboard();
    }
  }, [activeTab, paperId]);

  // Helper to auto-calculate Structured start time based on MCQ start time + duration + break
  const autoCalculateStructuredStartTime = () => {
    if (!mcqScheduledStartTime) {
      toast.error("Please set MCQ Scheduled Start Time first.");
      return;
    }
    const mcqStart = new Date(mcqScheduledStartTime);
    const mcqMins = (parseInt(mcqDurationHours || 0) * 60) + parseInt(mcqDurationMinutes || 0);
    const breakMins = parseInt(breakIntervalMinutes || 15);
    const structStart = new Date(mcqStart.getTime() + (mcqMins + breakMins) * 60 * 1000);
    
    // Format to YYYY-MM-DDTHH:mm
    const tzOffset = structStart.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(structStart.getTime() - tzOffset)).toISOString().slice(0, 16);
    setStructuredScheduledStartTime(localISOTime);
    toast.success(`Structured start set to ${localISOTime.replace('T', ' ')} (MCQ + ${breakMins}m break)`);
  };

  // Handle Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      let calculatedMins = Math.max(1, (parseInt(durationHours || 0) * 60) + parseInt(durationMinutes || 0));
      let calculatedMcqMins = (parseInt(mcqDurationHours || 0) * 60) + parseInt(mcqDurationMinutes || 0);
      let calculatedStructMins = (parseInt(structuredDurationHours || 0) * 60) + parseInt(structuredDurationMinutes || 0);

      if (paperType === 'MCQ') {
        calculatedMcqMins = calculatedMins;
      } else if (paperType === 'STRUCTURED') {
        calculatedStructMins = calculatedMins;
      } else if (paperType === 'BOTH') {
        calculatedMins = calculatedMcqMins + calculatedStructMins;
      }

      const payload = {
        contentId: content.id,
        paperType,
        timerMode: paperType === 'BOTH' ? (mcqTimerMode === 'SCHEDULED' || structuredTimerMode === 'SCHEDULED' ? 'SCHEDULED' : 'FLEXIBLE') : (paperType === 'STRUCTURED' ? structuredTimerMode : mcqTimerMode),
        scheduledStartTime: toUTCISOString(paperType === 'STRUCTURED' ? (structuredTimerMode === 'SCHEDULED' ? structuredScheduledStartTime : null) : (mcqTimerMode === 'SCHEDULED' ? mcqScheduledStartTime : null)),
        mcqTimerMode,
        mcqScheduledStartTime: mcqTimerMode === 'SCHEDULED' ? toUTCISOString(mcqScheduledStartTime) : null,
        structuredTimerMode,
        structuredScheduledStartTime: structuredTimerMode === 'SCHEDULED' ? toUTCISOString(structuredScheduledStartTime) : null,
        breakIntervalMinutes: parseInt(breakIntervalMinutes || 15),
        structuredUploadMinutes: parseInt(structuredUploadMinutes || 15),
        durationMinutes: calculatedMins,
        mcqDurationMinutes: calculatedMcqMins,
        structuredDurationMinutes: calculatedStructMins,
        totalMarks: parseFloat(totalMarks || 100),
        totalMcqMarks: parseFloat(totalMcqMarks || 50),
        totalStructuredMarks: parseFloat(totalStructuredMarks || 50),
        passMarks: 0,
        gradingScale: JSON.stringify(gradingScale),
        category,
        hasLeaderboard: category === 'WEEKLY' ? hasLeaderboard : true,
        questionCount: (paperType === 'STRUCTURED' || paperType === 'BOTH') ? (parseInt(questionCount) || 4) : null,
        manualParticipantCount: manualParticipantCount !== '' && manualParticipantCount !== null ? parseInt(manualParticipantCount) : null,
        instructions
      };

      const res = await api.post('/papers/config', payload);
      setPaperId(res.data.paper.id);
      toast.success("Paper settings updated!");
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Questions (MCQ)
  const handleSaveQuestions = async () => {
    if (!paperId) {
      await handleSaveSettings();
    }
    setSaving(true);
    try {
      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText.trim()) {
          toast.error(`Question ${i + 1} cannot have empty question text.`);
          setSaving(false);
          return;
        }
        const hasCorrect = q.options.some(opt => opt.isCorrect);
        if (!hasCorrect) {
          toast.error(`Question ${i + 1} must have at least one correct option selected.`);
          setSaving(false);
          return;
        }
      }

      await api.post('/papers/questions', {
        paperId: paperId,
        questions: questions.map(q => ({
          ...q,
          image: q.images && q.images.length > 0 ? q.images[0] : (q.image || null),
          images: q.images || []
        }))
      });

      toast.success("All questions saved successfully!");
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Failed to save questions", err);
      toast.error("Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  // Question Management Helpers
  const addQuestion = () => {
    const nextNo = questions.length + 1;
    setQuestions([
      ...questions,
      {
        questionNo: nextNo,
        questionText: '',
        image: '',
        images: [],
        marks: 1,
        options: [
          { optionNo: 1, optionText: '', isCorrect: true },
          { optionNo: 2, optionText: '', isCorrect: false },
          { optionNo: 3, optionText: '', isCorrect: false },
          { optionNo: 4, optionText: '', isCorrect: false },
          { optionNo: 5, optionText: '', isCorrect: false }
        ]
      }
    ]);
  };

  // Handle import from AI PDF Extractor
  const handleImportExtractedQuestions = (newExtractedQuestions, mode = 'append') => {
    if (mode === 'replace') {
      const formatted = newExtractedQuestions.map((q, idx) => ({
        ...q,
        questionNo: idx + 1,
        marks: q.marks || 1,
        image: '',
        images: []
      }));
      setQuestions(formatted);
    } else {
      const startNo = questions.length;
      const formatted = newExtractedQuestions.map((q, idx) => ({
        ...q,
        questionNo: startNo + idx + 1,
        marks: q.marks || 1,
        image: '',
        images: []
      }));
      setQuestions(prev => [...prev, ...formatted]);
    }
  };

  const removeQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.error("Paper must have at least one question.");
      return;
    }
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNo: i + 1 }));
    setQuestions(updated);
  };

  const updateQuestionText = (idx, text) => {
    const updated = [...questions];
    updated[idx].questionText = text;
    setQuestions(updated);
  };

  const handleQuestionImagesUpload = async (qIdx, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate size (max 25MB each)
    const validFiles = files.filter(f => {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 25MB limit.`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    try {
      setUploadingQuestionIdx(qIdx);
      const formData = new FormData();
      validFiles.forEach(f => formData.append('images', f));

      const res = await api.post('/papers/upload-question-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newFilenames = res.data?.filenames || [];
      if (newFilenames.length > 0) {
        setQuestions(prev => {
          const updated = [...prev];
          const currentImages = Array.isArray(updated[qIdx].images) ? updated[qIdx].images : [];
          const combined = [...currentImages, ...newFilenames];
          updated[qIdx].images = combined;
          updated[qIdx].image = combined[0] || '';
          return updated;
        });
        toast.success(`Attached ${newFilenames.length} figure(s) successfully!`);
      }
    } catch (err) {
      console.error("Failed to upload question images", err);
      toast.error(err.response?.data?.error || "Failed to upload question images");
    } finally {
      setUploadingQuestionIdx(null);
      e.target.value = '';
    }
  };

  const removeQuestionImage = (qIdx, imgIdx) => {
    setQuestions(prev => {
      const updated = [...prev];
      const currentImages = Array.isArray(updated[qIdx].images) ? [...updated[qIdx].images] : [];
      currentImages.splice(imgIdx, 1);
      updated[qIdx].images = currentImages;
      updated[qIdx].image = currentImages[0] || '';
      return updated;
    });
  };

  const updateOptionText = (qIdx, optIdx, text) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx].optionText = text;
    setQuestions(updated);
  };

  const setCorrectOption = (qIdx, optIdx) => {
    const updated = [...questions];
    updated[qIdx].options.forEach((opt, idx) => {
      opt.isCorrect = idx === optIdx;
    });
    setQuestions(updated);
  };

  const addOptionToQuestion = (qIdx) => {
    const updated = [...questions];
    if (updated[qIdx].options.length >= 5) {
      toast.error("Maximum 5 answers allowed per question.");
      return;
    }
    const nextOptNo = updated[qIdx].options.length + 1;
    updated[qIdx].options.push({
      optionNo: nextOptNo,
      optionText: '',
      isCorrect: false
    });
    setQuestions(updated);
  };

  const removeOptionFromQuestion = (qIdx, optIdx) => {
    const updated = [...questions];
    if (updated[qIdx].options.length <= 2) {
      toast.error("At least 2 options required per question.");
      return;
    }
    const wasCorrect = updated[qIdx].options[optIdx].isCorrect;
    updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== optIdx).map((opt, i) => ({ ...opt, optionNo: i + 1 }));
    if (wasCorrect && updated[qIdx].options.length > 0) {
      updated[qIdx].options[0].isCorrect = true;
    }
    setQuestions(updated);
  };

  // Grade Structured / Both Submission
  const handleGradeSubmit = async () => {
    if (!gradingSubmission) return;
    try {
      await api.put(`/papers/submissions/${gradingSubmission.id}/grade`, {
        score: parseFloat(gradeScore || 0),
        teacherFeedback: gradeFeedback
      });
      toast.success("Submission graded successfully!");
      setGradingSubmission(null);
      fetchSubmissions();
    } catch (err) {
      toast.error("Failed to grade submission");
    }
  };

  if (!isOpen) return null;

  const getBaseUrl = () => {
    let baseApiUrl = (api.defaults && api.defaults.baseURL) 
      ? api.defaults.baseURL.replace('/api', '') 
      : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
    return baseApiUrl || 'http://localhost:5000';
  };

  const calculatedTotalMinutes = (parseInt(durationHours || 0) * 60) + parseInt(durationMinutes || 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-[#090E17]/95 border border-white/10 rounded-2xl sm:rounded-[2rem] w-full max-w-7xl h-[92vh] flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex flex-wrap justify-between items-center gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${
              paperType === 'MCQ' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
              paperType === 'STRUCTURED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {paperType === 'MCQ' ? <CheckCircle size={24} /> : paperType === 'STRUCTURED' ? <FileSignature size={24} /> : <Layers size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  category === 'MONTHLY'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                }`}>
                  {category === 'MONTHLY' ? '🏆 Monthly Test' : '⚡ Weekly Test'}
                </span>
                <span className="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-white/80">
                  {paperType === 'MCQ' ? 'MCQ Exam Engine' : paperType === 'STRUCTURED' ? 'Structure Essay Engine' : 'Combined Engine'}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${timerMode === 'SCHEDULED' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {timerMode === 'SCHEDULED' ? '⏰ Scheduled' : '⚡ Flexible Start'}
                </span>
                <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock size={12} /> {durationHours}h {durationMinutes}m ({calculatedTotalMinutes}m)
                </span>
                {manualParticipantCount && (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Users size={12} /> {manualParticipantCount} Candidates
                  </span>
                )}
                {readOnly && (
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <Eye size={12} /> Paper Marker View
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white mt-1 drop-shadow-sm truncate max-w-[500px]">
                {content?.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs Navigation */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 flex-wrap gap-1">
              {(paperType === 'MCQ' || paperType === 'BOTH') && (
                <button
                  onClick={() => setActiveTab('questions')}
                  className={`px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'questions' ? 'bg-brand-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                  {paperType === 'BOTH' ? `Part 1: MCQ (${questions.length})` : `MCQ Questions (${questions.length})`}
                </button>
              )}
              {(paperType === 'STRUCTURED' || paperType === 'BOTH') && (
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'pdf' ? 'bg-brand-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                >
                  {paperType === 'BOTH' ? 'Part 2: Master PDF' : 'Master Sheet PDF'}
                </button>
              )}
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'settings' ? 'bg-brand-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Category & Timing
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'submissions' ? 'bg-brand-accent text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Submissions ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-3 sm:px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'leaderboard' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-amber-400 hover:text-amber-300'}`}
              >
                <Trophy size={14} /> Rankings
              </button>
            </div>

            <button onClick={onClose} className="text-gray-400 hover:text-white bg-white/5 border border-white/10 p-2.5 rounded-xl transition-all hover:bg-red-500/20 outline-none">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="animate-spin text-brand-accent" size={32} />
              <p className="text-slate-400 text-sm font-semibold">Loading test data...</p>
            </div>
          ) : (
            <>
              {/* TAB: MCQ QUESTIONS BUILDER */}
              {activeTab === 'questions' && (paperType === 'MCQ' || paperType === 'BOTH') && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  <div className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/10 flex-wrap gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <HelpCircle className="text-emerald-400" size={18} /> 
                        {paperType === 'BOTH' ? 'Part 1: MCQ Questions Builder' : 'MCQ Questions Builder'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Add questions with up to 5 answers. Click the radio button next to an option to mark it as the correct answer.
                      </p>
                    </div>
                    {!readOnly ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAiPdfModal(true)}
                          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <Sparkles size={15} className="text-yellow-300 animate-pulse" />
                          <span>AI Extract from PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus size={16} /> Add Question
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveQuestions}
                          disabled={saving}
                          className="bg-brand-accent hover:bg-brand-accent/90 text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save All Questions
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
                        <Eye size={14} className="text-cyan-400" /> Read-Only Questions Mode
                      </div>
                    )}
                  </div>

                  {/* Questions List */}
                  <div className="space-y-6">
                    {questions.map((q, qIdx) => (
                      <div key={qIdx} className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4 relative group shadow-lg">
                        
                        {/* Question Header */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-sm">
                              #{qIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Question {qIdx + 1} of {questions.length}
                            </span>
                          </div>
                          <button
                            onClick={() => removeQuestion(qIdx)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-xl transition-all text-xs font-bold flex items-center gap-1"
                            title="Delete this question"
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </div>

                        {/* Question Text */}
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Question Text *
                          </label>
                          <textarea
                            rows={3}
                            value={q.questionText}
                            onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                            placeholder={`Type Question ${qIdx + 1} details here...`}
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-y"
                          />
                        </div>

                        {/* Question Figures / Diagrams Attachment */}
                        <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ImageIcon size={16} className="text-emerald-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                Question Figures / Diagrams
                              </span>
                              {q.images && q.images.length > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  {q.images.length} {q.images.length === 1 ? 'figure' : 'figures'} attached
                                </span>
                              )}
                            </div>

                            {/* Upload Button */}
                            <label className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                              uploadingQuestionIdx === qIdx 
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50'
                            }`}>
                              {uploadingQuestionIdx === qIdx ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={13} />
                                  <span>+ Add Figure(s)</span>
                                </>
                              )}
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                disabled={uploadingQuestionIdx === qIdx}
                                onChange={(e) => handleQuestionImagesUpload(qIdx, e)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* Attached Images Grid */}
                          {q.images && q.images.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                              {q.images.map((imgFilename, imgIdx) => (
                                <div 
                                  key={imgIdx} 
                                  className="relative group bg-black/60 rounded-xl border border-white/10 overflow-hidden hover:border-emerald-500/50 transition-all shadow-sm"
                                >
                                  {/* Thumbnail */}
                                  <div className="h-28 w-full bg-black/80 flex items-center justify-center p-1 relative overflow-hidden">
                                    <img
                                      src={`${getBaseUrl()}/storage/documents/${imgFilename}`}
                                      alt={`Figure ${imgIdx + 1}`}
                                      className="max-h-full max-w-full object-contain rounded"
                                    />
                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImageUrl(`${getBaseUrl()}/storage/documents/${imgFilename}`)}
                                        className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-all"
                                        title="Preview full size"
                                      >
                                        <ZoomIn size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeQuestionImage(qIdx, imgIdx)}
                                        className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-all"
                                        title="Remove figure"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  {/* Caption */}
                                  <div className="px-2.5 py-1.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-300">
                                      Figure {imgIdx + 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeQuestionImage(qIdx, imgIdx)}
                                      className="text-slate-500 hover:text-red-400 text-xs transition-colors group-hover:opacity-100 opacity-60"
                                      title="Remove figure"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="border border-dashed border-white/10 rounded-xl p-3 text-center text-xs text-slate-500 hover:border-white/20 transition-all flex items-center justify-center gap-2">
                              <ImageIcon size={14} className="text-slate-600" />
                              <span>No diagrams attached. Click <span className="text-emerald-400 font-semibold">+ Add Figure(s)</span> to attach charts or figures.</span>
                            </div>
                          )}
                        </div>

                        {/* Options / Answers */}
                        <div className="space-y-2.5 pt-2">
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Options (Answers) - <span className="text-emerald-400 font-normal">Select the radio icon for the correct answer:</span>
                          </label>
                          
                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => (
                              <div 
                                key={optIdx} 
                                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${opt.isCorrect ? 'bg-emerald-500/10 border-emerald-500/40 shadow-inner' : 'bg-black/30 border-white/5 hover:border-white/15'}`}
                              >
                                {/* Radio button for Correct Answer */}
                                <button
                                  type="button"
                                  onClick={() => setCorrectOption(qIdx, optIdx)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${opt.isCorrect ? 'bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/40 scale-105' : 'bg-white/5 text-slate-500 border border-white/10 hover:border-emerald-500/50'}`}
                                  title={opt.isCorrect ? "Correct Answer" : "Click to set as Correct Answer"}
                                >
                                  {opt.isCorrect ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{optIdx + 1}</span>}
                                </button>

                                <input
                                  type="text"
                                  value={opt.optionText}
                                  onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                                  placeholder={`Answer Option ${optIdx + 1}...`}
                                  className="flex-1 bg-transparent border-0 text-sm text-white placeholder-slate-600 outline-none"
                                />

                                {opt.isCorrect && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                                    Correct
                                  </span>
                                )}

                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOptionFromQuestion(qIdx, optIdx)}
                                    className="text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors"
                                    title="Remove option"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {q.options.length < 5 && (
                            <button
                              type="button"
                              onClick={() => addOptionToQuestion(qIdx)}
                              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2 pl-1"
                            >
                              <Plus size={14} /> Add 5th Answer Option
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Action Bar */}
                  {!readOnly && (
                    <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/10 sticky bottom-0 z-20 backdrop-blur-md">
                      <button
                        onClick={addQuestion}
                        className="bg-white/10 hover:bg-white/20 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all"
                      >
                        <Plus size={16} /> Add Another Question
                      </button>
                      <button
                        onClick={handleSaveQuestions}
                        disabled={saving}
                        className="bg-brand-accent hover:bg-brand-accent/90 text-white font-extrabold px-8 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                      >
                        {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} Save All Questions ({questions.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: STRUCTURED / MCQ MASTER SHEET PDF */}
              {activeTab === 'pdf' && (paperType === 'STRUCTURED' || paperType === 'BOTH') && (
                <div className="max-w-3xl mx-auto bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <FileSignature size={28} className="text-purple-400" />
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {paperType === 'BOTH' ? 'Master Question Sheets (Part 1 & Part 2)' : 'Structure Essay Master Sheet'}
                      </h3>
                      <p className="text-xs text-slate-400">Students view or download these master question sheets during their exam.</p>
                    </div>
                  </div>

                  {paperType === 'BOTH' && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle size={20} className="text-emerald-400" />
                          <div>
                            <p className="text-sm font-bold text-white">Part 1: MCQ Question Paper (PDF)</p>
                            <p className="text-xs text-slate-400 font-mono">{mcqPaperFile || 'No file uploaded yet'}</p>
                          </div>
                        </div>
                        {mcqPaperFile && (
                          <a 
                            href={`${getBaseUrl()}/storage/documents/${mcqPaperFile}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            download
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <Download size={14} /> Download PDF
                          </a>
                        )}
                      </div>
                      {!mcqPaperFile && (
                        <p className="text-[11px] text-slate-400 italic">To attach an MCQ PDF question sheet, edit this content card in Content Hub.</p>
                      )}
                    </div>
                  )}

                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <FileSignature size={24} className="text-purple-400 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-white">
                            {paperType === 'BOTH' ? 'Part 2: Structure Essay Master Sheet (PDF)' : 'Structure Essay Master Sheet (PDF)'}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">{(structuredPaperFile || content.fileName) || 'No file uploaded yet'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(structuredPaperFile || content.fileName) && (
                          <a 
                            href={`${getBaseUrl()}/storage/documents/${structuredPaperFile || content.fileName}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            download
                            className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <Download size={14} /> Download PDF
                          </a>
                        )}
                        <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md">
                          {uploadingMasterSheet ? (
                            <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Uploading...</span>
                          ) : (
                            <span className="flex items-center gap-1.5"><UploadCloud size={14} /> {(structuredPaperFile || content.fileName) ? 'Replace PDF Sheet' : 'Upload Essay PDF Sheet'}</span>
                          )}
                          <input type="file" accept=".pdf" onChange={handleUploadMasterSheetFile} className="hidden" disabled={uploadingMasterSheet} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-xs text-purple-200 leading-relaxed">
                    💡 <strong>Evaluation Note:</strong> When students submit their answers, their uploaded answer sheets will appear under the <strong>Submissions</strong> tab ready for evaluation and grading.
                  </div>
                </div>
              )}

              {/* TAB: TIMER & SETTINGS */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl mx-auto bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8">
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-white/10 pb-4">
                    <Clock className="text-blue-400" size={20} /> Test Format & Examination Rules
                  </h3>

                  {/* 0. TEST CATEGORY (WEEKLY VS. MONTHLY) */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Test Category *</span>
                      <span className="text-[10px] text-blue-400 font-semibold">Separates Weekly vs Monthly progress & leaderboards</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setCategory('WEEKLY')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${category === 'WEEKLY' ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${category === 'WEEKLY' ? 'bg-amber-500 text-black shadow' : 'bg-white/5 text-slate-400'}`}>
                          ⚡
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            Weekly Test
                            {category === 'WEEKLY' && <span className="text-[9px] bg-amber-500 text-black font-extrabold px-1.5 py-0.2 rounded">Active</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Weekly speed test & regular progress series</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setCategory('MONTHLY')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${category === 'MONTHLY' ? 'bg-indigo-500/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/40' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${category === 'MONTHLY' ? 'bg-indigo-500 text-white shadow' : 'bg-white/5 text-slate-400'}`}>
                          🏆
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            Monthly Test
                            {category === 'MONTHLY' && <span className="text-[9px] bg-indigo-500 text-white font-extrabold px-1.5 py-0.2 rounded">Active</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Major monthly milestone & ranking exam</div>
                        </div>
                      </div>
                    </div>

                    {/* Weekly Leaderboard Publishing Option */}
                    {category === 'WEEKLY' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy size={18} className="text-amber-400" />
                            <label className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wider">
                              Weekly Leaderboard Publishing *
                            </label>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${hasLeaderboard ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                            {hasLeaderboard ? 'Leaderboard Enabled' : 'Private Practice'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div
                            onClick={() => setHasLeaderboard(true)}
                            className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center gap-3 ${hasLeaderboard ? 'bg-amber-500/20 border-amber-500 text-white shadow-md ring-1 ring-amber-500/30' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${hasLeaderboard ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'}`}>
                              ✓
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Publish to Live Leaderboard</div>
                              <div className="text-[10px] text-slate-400">Student scores & rankings appear on public leaderboard</div>
                            </div>
                          </div>
                          <div
                            onClick={() => setHasLeaderboard(false)}
                            className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center gap-3 ${!hasLeaderboard ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/30' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${!hasLeaderboard ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                              🔒
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Practice / Homework Only</div>
                              <div className="text-[10px] text-slate-400">Hidden from leaderboard rankings. Individual score only.</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1. PAPER FORMAT SELECTION (3 FORMATS) */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Test Format *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div
                        onClick={() => setPaperType('MCQ')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-2 ${paperType === 'MCQ' ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                      >
                        <CheckCircle size={22} className={paperType === 'MCQ' ? 'text-emerald-400' : 'text-slate-500'} />
                        <span className="text-xs font-black">MCQ Only</span>
                        <span className="text-[10px] text-slate-500">Auto-graded quiz</span>
                      </div>

                      <div
                        onClick={() => setPaperType('STRUCTURED')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-2 ${paperType === 'STRUCTURED' ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                      >
                        <FileSignature size={22} className={paperType === 'STRUCTURED' ? 'text-purple-400' : 'text-slate-500'} />
                        <span className="text-xs font-black">Structure Essay Only</span>
                        <span className="text-[10px] text-slate-500">PDF Master & Answer upload</span>
                      </div>

                      <div
                        onClick={() => setPaperType('BOTH')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-2 ${paperType === 'BOTH' ? 'bg-blue-500/20 border-blue-500 text-white shadow-lg shadow-blue-500/10' : 'bg-black/30 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                      >
                        <Layers size={22} className={paperType === 'BOTH' ? 'text-blue-400' : 'text-slate-500'} />
                        <span className="text-xs font-black">MCQ + Structured Both</span>
                        <span className="text-[10px] text-slate-500">Dual part comprehensive</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. TIMER & SCHEDULING MODE */}
                  {paperType === 'BOTH' ? (
                    <div className="space-y-6 pt-3 border-t border-white/5">
                      {/* Header Banner */}
                      <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-2">
                            <Layers className="text-blue-400" size={18} /> Dual-Section Scheduling & Time Settings
                          </h4>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Configure MCQ and Structured parts independently (Scheduled vs. Flexible, Intermission, and Upload Lockout).
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-lg shrink-0">
                          Part 1 + Part 2
                        </span>
                      </div>

                      {/* --- PART 1: MCQ SECTION --- */}
                      <div className="bg-emerald-500/[0.04] border border-emerald-500/25 rounded-2xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-400" />
                            <span className="text-sm font-black text-emerald-300 uppercase tracking-wider">
                              Part 1: MCQ Section Timing
                            </span>
                          </div>
                          <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                            {(parseInt(mcqDurationHours || 0) * 60) + parseInt(mcqDurationMinutes || 0)} Mins Duration
                          </span>
                        </div>

                        {/* MCQ Mode Selector */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                            MCQ Timer Mode *
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label 
                              onClick={() => setMcqTimerMode('SCHEDULED')}
                              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${mcqTimerMode === 'SCHEDULED' ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                            >
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-amber-400" />
                                <div>
                                  <p className="text-xs font-bold text-white">Scheduled Start</p>
                                  <p className="text-[10px] text-slate-400">Fixed start time for all students</p>
                                </div>
                              </div>
                              <input type="radio" checked={mcqTimerMode === 'SCHEDULED'} onChange={() => setMcqTimerMode('SCHEDULED')} className="accent-amber-500" />
                            </label>

                            <label 
                              onClick={() => setMcqTimerMode('FLEXIBLE')}
                              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${mcqTimerMode === 'FLEXIBLE' ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-emerald-400" />
                                <div>
                                  <p className="text-xs font-bold text-white">Flexible Start</p>
                                  <p className="text-[10px] text-slate-400">Student starts whenever ready</p>
                                </div>
                              </div>
                              <input type="radio" checked={mcqTimerMode === 'FLEXIBLE'} onChange={() => setMcqTimerMode('FLEXIBLE')} className="accent-emerald-500" />
                            </label>
                          </div>
                        </div>

                        {/* Scheduled Time for MCQ */}
                        {mcqTimerMode === 'SCHEDULED' && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-1.5 animate-in fade-in">
                            <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Calendar size={13} /> MCQ Scheduled Start Date & Time *
                            </label>
                            <input 
                              type="datetime-local" 
                              value={mcqScheduledStartTime} 
                              onChange={(e) => setMcqScheduledStartTime(e.target.value)}
                              required={mcqTimerMode === 'SCHEDULED'}
                              className="w-full bg-black/60 border border-amber-500/40 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400 font-bold"
                            />
                            <p className="text-[10px] text-slate-400">Synchronized countdown begins towards this timestamp.</p>
                          </div>
                        )}

                        {/* MCQ Duration */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 mb-1.5 block uppercase tracking-wider">
                            MCQ Exam Duration
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="24" 
                                  step="1" 
                                  value={mcqDurationHours} 
                                  onChange={(e) => setMcqDurationHours(e.target.value)} 
                                  className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                                />
                                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Hours</span>
                              </div>
                            </div>
                            <div>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  min="0" 
                                  max="59" 
                                  step="5" 
                                  value={mcqDurationMinutes} 
                                  onChange={(e) => setMcqDurationMinutes(e.target.value)} 
                                  className="w-full bg-black/60 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                                />
                                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Minutes</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* --- BREAK / INTERMISSION CARD --- */}
                      <div className="bg-indigo-500/[0.06] border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center gap-2">
                            <Clock size={18} className="text-indigo-400" />
                            <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                              Break / Intermission Between Papers
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Rest interval given to students after submitting MCQ before Part 2 starts.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs font-bold text-slate-300">Break Time:</label>
                          <div className="relative w-28">
                            <input 
                              type="number" 
                              min="0" 
                              max="180" 
                              step="5" 
                              value={breakIntervalMinutes} 
                              onChange={(e) => setBreakIntervalMinutes(e.target.value)} 
                              className="w-full bg-black/60 border border-indigo-500/40 focus:border-indigo-400 rounded-xl p-2 text-white outline-none text-xs font-bold pr-12" 
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">Mins</span>
                          </div>
                        </div>
                      </div>

                      {/* --- PART 2: STRUCTURED SECTION & UPLOAD WINDOW --- */}
                      <div className="bg-purple-500/[0.04] border border-purple-500/25 rounded-2xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                          <div className="flex items-center gap-2">
                            <FileSignature size={18} className="text-purple-400" />
                            <span className="text-sm font-black text-purple-300 uppercase tracking-wider">
                              Part 2: Structured Essay Section Timing & Upload Window
                            </span>
                          </div>
                          <span className="text-[11px] font-extrabold text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-lg">
                            {(parseInt(structuredDurationHours || 0) * 60) + parseInt(structuredDurationMinutes || 0)}m Writing + {structuredUploadMinutes || 15}m Upload
                          </span>
                        </div>

                        {/* Structured Mode Selector */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                            Structure Timer Mode *
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label 
                              onClick={() => setStructuredTimerMode('SCHEDULED')}
                              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${structuredTimerMode === 'SCHEDULED' ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                            >
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-amber-400" />
                                <div>
                                  <p className="text-xs font-bold text-white">Scheduled Start</p>
                                  <p className="text-[10px] text-slate-400">Fixed start time for all students</p>
                                </div>
                              </div>
                              <input type="radio" checked={structuredTimerMode === 'SCHEDULED'} onChange={() => setStructuredTimerMode('SCHEDULED')} className="accent-amber-500" />
                            </label>

                            <label 
                              onClick={() => setStructuredTimerMode('FLEXIBLE')}
                              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${structuredTimerMode === 'FLEXIBLE' ? 'bg-purple-500/15 border-purple-500/60 shadow-md shadow-purple-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-400" />
                                <div>
                                  <p className="text-xs font-bold text-white">Flexible Start</p>
                                  <p className="text-[10px] text-slate-400">Student begins after MCQ / break</p>
                                </div>
                              </div>
                              <input type="radio" checked={structuredTimerMode === 'FLEXIBLE'} onChange={() => setStructuredTimerMode('FLEXIBLE')} className="accent-purple-500" />
                            </label>
                          </div>
                        </div>

                        {/* Scheduled Time for Structure */}
                        {structuredTimerMode === 'SCHEDULED' && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={13} /> Structured Scheduled Start Date & Time *
                              </label>
                              {mcqScheduledStartTime && (
                                <button
                                  type="button"
                                  onClick={autoCalculateStructuredStartTime}
                                  className="text-[11px] font-extrabold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                                >
                                  ⚡ Auto-set (MCQ + Break)
                                </button>
                              )}
                            </div>
                            <input 
                              type="datetime-local" 
                              value={structuredScheduledStartTime} 
                              onChange={(e) => setStructuredScheduledStartTime(e.target.value)}
                              required={structuredTimerMode === 'SCHEDULED'}
                              className="w-full bg-black/60 border border-amber-500/40 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-400 font-bold"
                            />
                            <p className="text-[10px] text-slate-400">Students will see a synchronized waiting countdown until this time arrives.</p>
                          </div>
                        )}

                        {/* Durations: Writing Duration + Upload Buffer Window */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {/* Writing Time */}
                          <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-2">
                            <label className="text-[11px] font-bold text-purple-300 block uppercase tracking-wider flex items-center gap-1.5">
                              <FileSignature size={13} /> 1. Writing Duration
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="24" 
                                    step="1" 
                                    value={structuredDurationHours} 
                                    onChange={(e) => setStructuredDurationHours(e.target.value)} 
                                    className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                                  />
                                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Hours</span>
                                </div>
                              </div>
                              <div>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max="59" 
                                    step="5" 
                                    value={structuredDurationMinutes} 
                                    onChange={(e) => setStructuredDurationMinutes(e.target.value)} 
                                    className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                                  />
                                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Mins</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400">Time students write answers on paper while viewing the question sheet.</p>
                          </div>

                          {/* Upload Buffer Window */}
                          <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-rose-300 block uppercase tracking-wider flex items-center gap-1.5">
                                <UploadCloud size={13} /> 2. Dedicated Upload Window
                              </label>
                              <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md">
                                Auto-Locking
                              </span>
                            </div>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="5" 
                                max="60" 
                                step="5" 
                                value={structuredUploadMinutes} 
                                onChange={(e) => setStructuredUploadMinutes(e.target.value)} 
                                className="w-full bg-black/60 border border-rose-500/30 focus:border-rose-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold pr-16" 
                              />
                              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Minutes</span>
                            </div>
                            <p className="text-[10px] text-rose-300/80 leading-tight">
                              Strict photo/PDF upload buffer. Once time runs out, uploading is permanently locked.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : paperType === 'MCQ' ? (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        MCQ Timer Scheduling Mode *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label 
                          onClick={() => setMcqTimerMode('SCHEDULED')}
                          className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2 ${mcqTimerMode === 'SCHEDULED' ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-white text-sm">
                              <Calendar size={18} className="text-amber-400" /> Scheduled Start
                            </div>
                            <input type="radio" checked={mcqTimerMode === 'SCHEDULED'} onChange={() => setMcqTimerMode('SCHEDULED')} className="accent-amber-500" />
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Synchronized exam time for all students. Shows a waiting countdown until the start time arrives.
                          </p>
                        </label>

                        <label 
                          onClick={() => setMcqTimerMode('FLEXIBLE')}
                          className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2 ${mcqTimerMode === 'FLEXIBLE' ? 'bg-blue-500/10 border-blue-500/50 shadow-md shadow-blue-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-white text-sm">
                              <Sparkles size={18} className="text-blue-400" /> Flexible Start
                            </div>
                            <input type="radio" checked={mcqTimerMode === 'FLEXIBLE'} onChange={() => setMcqTimerMode('FLEXIBLE')} className="accent-blue-500" />
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Students start whenever ready. Countdown runs independently once they start.
                          </p>
                        </label>
                      </div>

                      {mcqTimerMode === 'SCHEDULED' && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2 animate-in fade-in">
                          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Scheduled Start Date & Time *
                          </label>
                          <input 
                            type="datetime-local" 
                            value={mcqScheduledStartTime} 
                            onChange={(e) => setMcqScheduledStartTime(e.target.value)}
                            required={mcqTimerMode === 'SCHEDULED'}
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500 font-bold"
                          />
                        </div>
                      )}

                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-300 block uppercase tracking-wider">
                            Exam Duration *
                          </label>
                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                            Total: {durationHours || 0}h {durationMinutes || 0}m ({calculatedTotalMinutes} Minutes)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 mb-1 block">Hours</label>
                            <input 
                              type="number" 
                              min="0" 
                              max="24" 
                              step="1" 
                              value={durationHours} 
                              onChange={(e) => setDurationHours(e.target.value)} 
                              className="w-full bg-black/60 border border-white/10 focus:border-emerald-500 rounded-xl p-3 text-white outline-none text-sm font-bold" 
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 mb-1 block">Minutes</label>
                            <input 
                              type="number" 
                              min="0" 
                              max="59" 
                              step="5" 
                              value={durationMinutes} 
                              onChange={(e) => setDurationMinutes(e.target.value)} 
                              className="w-full bg-black/60 border border-white/10 focus:border-emerald-500 rounded-xl p-3 text-white outline-none text-sm font-bold" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Structure Essay Timer Scheduling Mode *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label 
                          onClick={() => setStructuredTimerMode('SCHEDULED')}
                          className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2 ${structuredTimerMode === 'SCHEDULED' ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-white text-sm">
                              <Calendar size={18} className="text-amber-400" /> Scheduled Start
                            </div>
                            <input type="radio" checked={structuredTimerMode === 'SCHEDULED'} onChange={() => setStructuredTimerMode('SCHEDULED')} className="accent-amber-500" />
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Synchronized start time for all students. Shows a waiting countdown.
                          </p>
                        </label>

                        <label 
                          onClick={() => setStructuredTimerMode('FLEXIBLE')}
                          className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col gap-2 ${structuredTimerMode === 'FLEXIBLE' ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-500/10' : 'bg-black/30 border-white/10 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-white text-sm">
                              <Sparkles size={18} className="text-purple-400" /> Flexible Start
                            </div>
                            <input type="radio" checked={structuredTimerMode === 'FLEXIBLE'} onChange={() => setStructuredTimerMode('FLEXIBLE')} className="accent-purple-500" />
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Students start whenever ready. The countdown begins once clicked.
                          </p>
                        </label>
                      </div>

                      {structuredTimerMode === 'SCHEDULED' && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2 animate-in fade-in">
                          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Scheduled Start Date & Time *
                          </label>
                          <input 
                            type="datetime-local" 
                            value={structuredScheduledStartTime} 
                            onChange={(e) => setStructuredScheduledStartTime(e.target.value)}
                            required={structuredTimerMode === 'SCHEDULED'}
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500 font-bold"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="bg-purple-500/[0.04] border border-purple-500/25 rounded-2xl p-4 space-y-2">
                          <label className="text-xs font-bold text-purple-300 block uppercase tracking-wider flex items-center gap-1.5">
                            <FileSignature size={14} /> 1. Writing Duration
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 mb-1 block">Hours</label>
                              <input 
                                type="number" 
                                min="0" 
                                max="24" 
                                step="1" 
                                value={durationHours} 
                                onChange={(e) => setDurationHours(e.target.value)} 
                                className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 mb-1 block">Minutes</label>
                              <input 
                                type="number" 
                                min="0" 
                                max="59" 
                                step="5" 
                                value={durationMinutes} 
                                onChange={(e) => setDurationMinutes(e.target.value)} 
                                className="w-full bg-black/60 border border-purple-500/30 focus:border-purple-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-rose-300 block uppercase tracking-wider flex items-center gap-1.5">
                              <UploadCloud size={14} /> 2. Dedicated Upload Window
                            </label>
                            <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md">
                              Auto-Locking
                            </span>
                          </div>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="5" 
                              max="60" 
                              step="5" 
                              value={structuredUploadMinutes} 
                              onChange={(e) => setStructuredUploadMinutes(e.target.value)} 
                              className="w-full bg-black/60 border border-rose-500/30 focus:border-rose-400 rounded-xl p-2.5 text-white outline-none text-xs font-bold pr-16" 
                            />
                            <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">Minutes</span>
                          </div>
                          <p className="text-[10px] text-rose-300/80 leading-relaxed">
                            Strict buffer time for scanning and uploading. Uploading closes when time ends.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. EXAM STRUCTURE & QUESTIONS CONFIGURATION */}
                  {paperType === 'STRUCTURED' && (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                              <FileSignature size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                                Structure / Essay Master Question Paper & Questions Count
                              </h4>
                              <p className="text-xs text-slate-400">
                                Upload the essay paper PDF and configure total questions in this paper.
                              </p>
                            </div>
                          </div>
                          {(structuredPaperFile || content.fileName) && (
                            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30 truncate max-w-[240px]">
                              {structuredPaperFile || content.fileName}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                          {/* Master Question Paper PDF upload */}
                          <div className="md:col-span-2 bg-black/40 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                            <label className="text-xs sm:text-sm font-bold text-purple-300 block uppercase tracking-wider">
                              Essay Question Paper PDF *
                            </label>
                            <div className="flex flex-wrap items-center gap-2.5">
                              <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md">
                                {uploadingMasterSheet ? (
                                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Uploading PDF...</span>
                                ) : (
                                  <span className="flex items-center gap-2"><UploadCloud size={16} /> {(structuredPaperFile || content.fileName) ? 'Change / Replace PDF' : 'Upload Question Paper PDF'}</span>
                                )}
                                <input type="file" accept=".pdf" onChange={handleUploadMasterSheetFile} className="hidden" disabled={uploadingMasterSheet} />
                              </label>

                              {(structuredPaperFile || content.fileName) && (
                                <a 
                                  href={`${getBaseUrl()}/storage/documents/${structuredPaperFile || content.fileName}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  download
                                  className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                  <Download size={14} /> Download PDF
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              Students will view this question paper to write and upload their answers.
                            </p>
                          </div>

                          {/* Number of Essay Questions in the paper */}
                          <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-amber-300 block uppercase tracking-wider">
                              Total Questions *
                            </label>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="1" 
                                max="50" 
                                value={questionCount} 
                                onChange={(e) => setQuestionCount(e.target.value)} 
                                placeholder="e.g. 4" 
                                className="w-full bg-black/60 border border-amber-500/40 focus:border-amber-400 rounded-xl p-3 text-white outline-none font-black text-lg" 
                              />
                              <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-bold uppercase">Questions</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">
                              Paper Guiders will award marks question-by-question based on this count.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {paperType === 'BOTH' && (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
                        <div className="flex items-center gap-3 border-b border-blue-500/20 pb-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                            <Layers size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                              Dual Part Paper Configuration (Part 1 MCQ & Part 2 Essay)
                            </h4>
                            <p className="text-xs text-slate-400">
                              Part 1 MCQ questions are managed in the Questions tab. Set Part 2 Essay paper details below.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                          {/* Part 1: MCQ Summary */}
                          <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-emerald-300 block uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle size={14} /> Part 1: MCQ Quiz
                            </label>
                            <div className="text-2xl font-black text-white">
                              {questions.length} <span className="text-xs font-bold text-slate-400 uppercase">Questions Built</span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Auto-synced from questions added in the Part 1 MCQ tab.
                            </p>
                          </div>

                          {/* Part 2: Essay Master PDF */}
                          <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-4 space-y-2.5">
                            <label className="text-xs sm:text-sm font-bold text-purple-300 block uppercase tracking-wider">
                              Part 2: Essay PDF *
                            </label>
                            <div className="flex flex-col gap-2">
                              <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md">
                                {uploadingMasterSheet ? (
                                  <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Uploading...</span>
                                ) : (
                                  <span className="flex items-center gap-1.5"><UploadCloud size={14} /> {(structuredPaperFile || content.fileName) ? 'Replace PDF' : 'Upload PDF'}</span>
                                )}
                                <input type="file" accept=".pdf" onChange={handleUploadMasterSheetFile} className="hidden" disabled={uploadingMasterSheet} />
                              </label>
                              {(structuredPaperFile || content.fileName) && (
                                <p className="text-[10px] font-mono text-purple-300 truncate">
                                  {structuredPaperFile || content.fileName}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Part 2: Essay Question Count */}
                          <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                            <label className="text-xs sm:text-sm font-bold text-amber-300 block uppercase tracking-wider">
                              Part 2 Questions *
                            </label>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="1" 
                                max="50" 
                                value={questionCount} 
                                onChange={(e) => setQuestionCount(e.target.value)} 
                                placeholder="e.g. 4" 
                                className="w-full bg-black/60 border border-amber-500/40 focus:border-amber-400 rounded-xl p-2.5 text-white outline-none font-black text-base" 
                              />
                              <span className="absolute right-3 top-3 text-[11px] text-slate-400 font-bold uppercase">Questions</span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Guiders evaluate each essay question individually.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {paperType === 'MCQ' && (
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-2">
                        <label className="text-xs sm:text-sm font-bold text-emerald-300 block uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle size={14} /> MCQ Quiz Questions Summary
                        </label>
                        <div className="text-2xl font-black text-white">
                          {questions.length} <span className="text-xs font-bold text-slate-400 uppercase">Questions Built in Quiz</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Manage MCQ questions, figure diagrams, and correct answers directly in the MCQ Questions tab.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Grade Boundaries & Grading Scale */}
                  <div className="bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-purple-950/20 border border-indigo-500/20 rounded-2xl p-4.5 space-y-3.5 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/10 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <Trophy size={15} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-indigo-200 tracking-wide uppercase flex items-center gap-2">
                            Grade Boundaries & Grading Scale
                            <span className="text-[10px] font-semibold normal-case text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                              Score % Ranges
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Define student grade badges according to marks / percentage thresholds (e.g. A: 75–100, B: 65–74)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetStandardGrade}
                          className="text-[11px] font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                          title="Reset to default A, B, C, S, F"
                        >
                          Reset Default
                        </button>
                        <button
                          type="button"
                          onClick={handleAddGradeTier}
                          className="text-[11px] font-semibold text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={13} /> Add Grade
                        </button>
                      </div>
                    </div>

                    {/* Grade Tiers Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {gradingScale.map((tier, idx) => {
                        const badgeStyle = getGradeBadgeStyle(tier.grade);
                        return (
                          <div 
                            key={idx} 
                            className="relative bg-black/40 border border-white/10 hover:border-indigo-500/30 rounded-xl p-3 flex flex-col justify-between transition-all group min-w-[130px]"
                          >
                            <div className="flex items-center justify-between gap-1.5 mb-2">
                              <div className="flex items-center gap-1.5 flex-1">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-black border ${badgeStyle} shadow-sm min-w-[28px] text-center`}>
                                  {tier.grade || '?'}
                                </span>
                                <input
                                  type="text"
                                  value={tier.grade}
                                  onChange={(e) => handleUpdateGradeTier(idx, 'grade', e.target.value)}
                                  placeholder="Grade"
                                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-400 rounded-lg px-2 py-1 text-white font-bold text-xs uppercase outline-none"
                                />
                              </div>
                              {gradingScale.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGradeTier(idx)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                                  title="Remove grade tier"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <div className="flex-1 space-y-1">
                                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold text-center">Min %</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={tier.min}
                                  onChange={(e) => handleUpdateGradeTier(idx, 'min', e.target.value)}
                                  placeholder="0"
                                  className="w-full bg-black/60 border border-white/15 focus:border-indigo-400 rounded-lg py-1 px-0.5 text-center text-white font-black text-xs sm:text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                                />
                              </div>
                              <span className="text-slate-500 pt-3.5 font-black text-xs">-</span>
                              <div className="flex-1 space-y-1">
                                <span className="text-[10px] sm:text-[11px] text-slate-400 block uppercase font-bold text-center">Max %</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={tier.max}
                                  onChange={(e) => handleUpdateGradeTier(idx, 'max', e.target.value)}
                                  placeholder="100"
                                  className="w-full bg-black/60 border border-white/15 focus:border-indigo-400 rounded-lg py-1 px-0.5 text-center text-white font-black text-xs sm:text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Staff Participant Count Override */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                        Staff Candidate / Participant Count (Optional Override)
                      </label>
                      <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded font-mono">
                        Leaderboard Total Count
                      </span>
                    </div>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="e.g. 150 (Leave blank to automatically count online submissions)"
                      value={manualParticipantCount} 
                      onChange={(e) => setManualParticipantCount(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 focus:border-blue-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none font-bold" 
                    />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      💡 If physical or offline students also sat for this test, enter the total official participant count here. The leaderboard and student rankings will reflect e.g. "Rank 4 of {manualParticipantCount || 'X'} Candidates".
                    </p>
                  </div>

                  {/* Exam Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Exam Instructions for Students
                    </label>
                    <textarea 
                      rows={3}
                      value={instructions} 
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Read each question carefully. Countdown begins once started. Submit your answers before time runs out."
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-y"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 border-t border-white/10">
                    {!readOnly ? (
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-brand-accent hover:bg-brand-accent/90 text-white font-extrabold px-8 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                      >
                        {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} Save Settings
                      </button>
                    ) : (
                      <div className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                        <Eye size={14} className="text-cyan-400" /> Read-Only Mode: Settings cannot be modified
                      </div>
                    )}
                  </div>
                </form>
              )}

              {/* TAB: SUBMISSIONS & RESULTS */}
              {activeTab === 'submissions' && (
                <div className="space-y-6 max-w-6xl mx-auto">
                  <div className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/10 flex-wrap gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Users className="text-blue-400" size={18} /> Student Exam Submissions ({submissions.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        View student attempts, breakdown scores, answer files, and grade structured papers.
                      </p>
                    </div>
                    <button
                      onClick={fetchSubmissions}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="text-center py-16 bg-white/[0.01] rounded-2xl border border-white/5">
                      <AlertCircle className="mx-auto text-slate-500 mb-3" size={36} />
                      <p className="text-slate-400 text-sm font-semibold">No students have submitted this test yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                            <th className="p-3.5">Student</th>
                            <th className="p-3.5">Phone / City</th>
                            <th className="p-3.5">Started At</th>
                            <th className="p-3.5">Submitted At</th>
                            <th className="p-3.5">Score Breakdown</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                          {submissions.map((sub) => {
                            const isPassed = (sub.score || 0) >= (passMarks || 40);
                            return (
                              <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-300 flex items-center justify-center font-black text-xs">
                                    {sub.student?.firstName?.charAt(0) || 'S'}
                                  </div>
                                  <div>
                                    <p className="leading-tight">{sub.student?.firstName} {sub.student?.lastName}</p>
                                    <span className="text-[10px] text-slate-500">ID #{sub.student?.id}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 text-slate-400">
                                  {sub.student?.phone} <br />
                                  <span className="text-[10px] text-slate-500">{sub.student?.city || 'No City'}</span>
                                </td>
                                <td className="p-3.5 text-slate-400">
                                  {sub.startedAt ? new Date(sub.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                                <td className="p-3.5 text-slate-400">
                                  {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                                </td>
                                <td className="p-3.5">
                                  {paperType === 'MCQ' && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-black text-sm ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {sub.score}%
                                      </span>
                                      {sub.grade && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border uppercase ${getGradeBadgeStyle(sub.grade)}`}>
                                          Grade {sub.grade}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400">
                                        ({sub.correctAnswers || 0}/{sub.totalQuestions || 0})
                                      </span>
                                    </div>
                                  )}
                                  {paperType === 'STRUCTURED' && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-purple-300">
                                        {sub.score !== null ? `${sub.score} / ${totalMarks} Marks` : 'Pending Grading'}
                                      </span>
                                      {sub.grade && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border uppercase ${getGradeBadgeStyle(sub.grade)}`}>
                                          Grade {sub.grade}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {paperType === 'BOTH' && (
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-black text-sm ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                                          Total: {sub.score !== null ? `${sub.score} Marks` : 'Pending'}
                                        </span>
                                        {sub.grade && (
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border uppercase ${getGradeBadgeStyle(sub.grade)}`}>
                                            Grade {sub.grade}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                        <span>MCQ: {sub.mcqScore !== null ? `${sub.mcqScore}` : '0'}</span>
                                        <span>•</span>
                                        <span>Essay: {sub.structuredScore !== null ? `${sub.structuredScore}` : 'Ungraded'}</span>
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${sub.status === 'SUBMITTED' || sub.status === 'GRADED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {sub.status}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right">
                                  {(paperType === 'STRUCTURED' || paperType === 'BOTH') && (
                                    <div className="flex justify-end gap-2">
                                      {sub.answerFile && (
                                        <a
                                          href={`${getBaseUrl()}/storage/documents/${sub.answerFile}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          download
                                          className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                                        >
                                          <Download size={12} /> Answer Sheet
                                        </a>
                                      )}
                                      <button
                                        onClick={() => {
                                          setGradingSubmission(sub);
                                          setGradeScore(sub.structuredScore !== null ? String(sub.structuredScore) : (sub.score !== null ? String(sub.score) : ''));
                                          setGradeFeedback(sub.teacherFeedback || '');
                                        }}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                                      >
                                        {sub.structuredScore !== null ? 'Re-Grade' : 'Grade'}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Grading Modal */}
                  {gradingSubmission && (
                    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4">
                      <div className="bg-[#0e1626] border border-white/20 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3">
                          <h4 className="font-bold text-white text-base">
                            Grade Submission: {gradingSubmission.student?.firstName} {gradingSubmission.student?.lastName}
                          </h4>
                          <button onClick={() => setGradingSubmission(null)} className="text-gray-400 hover:text-white">
                            <X size={18} />
                          </button>
                        </div>

                        {gradingSubmission.answerFile && (
                          <div className="bg-white/5 p-3 rounded-xl flex items-center justify-between border border-white/10">
                            <span className="text-xs text-slate-300 truncate max-w-[200px]">{gradingSubmission.answerFile}</span>
                            <a
                              href={`${getBaseUrl()}/storage/documents/${gradingSubmission.answerFile}`}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                              <Download size={12} /> View File
                            </a>
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                            {paperType === 'BOTH' ? 'Structured Essay Marks' : `Score / Marks (out of ${totalMarks})`}
                          </label>
                          <input
                            type="number"
                            value={gradeScore}
                            onChange={(e) => setGradeScore(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500"
                            placeholder="e.g. 45"
                          />
                          {paperType === 'BOTH' && gradingSubmission.mcqScore !== null && (
                            <p className="text-[11px] text-emerald-400 mt-1">
                              MCQ Score: {gradingSubmission.mcqScore} pts + Structured Score: {gradeScore || 0} pts = Total {(parseFloat(gradingSubmission.mcqScore) + parseFloat(gradeScore || 0))} pts
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                            Teacher Feedback
                          </label>
                          <textarea
                            rows={3}
                            value={gradeFeedback}
                            onChange={(e) => setGradeFeedback(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500 resize-y"
                            placeholder="Add helpful remarks or guidance for the student..."
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                          <button
                            onClick={() => setGradingSubmission(null)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleGradeSubmit}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                          >
                            Submit Grade
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: LEADERBOARD & RANKINGS */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-6 max-w-6xl mx-auto">
                  <div className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/10 flex-wrap gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Trophy className="text-amber-400" size={20} /> Live Test Rankings & Leaderboard
                      </h3>
                      <p className="text-xs text-slate-400">
                        Top ranked students calculated by highest scores and fastest completion times.
                      </p>
                    </div>
                    <button
                      onClick={fetchLeaderboard}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw size={14} className={loadingLeaderboard ? 'animate-spin' : ''} /> Refresh Rankings
                    </button>
                  </div>

                  {loadingLeaderboard ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <RefreshCw className="animate-spin text-amber-400" size={32} />
                      <p className="text-slate-400 text-xs mt-2">Computing live rankings...</p>
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="text-center py-16 bg-white/[0.01] rounded-2xl border border-white/5">
                      <Trophy className="mx-auto text-slate-600 mb-3" size={40} />
                      <p className="text-slate-400 text-sm font-semibold">No submissions recorded yet for the leaderboard.</p>
                      <p className="text-slate-500 text-xs mt-1">Once students complete this test, their rankings will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* PODIUM CARDS FOR TOP 3 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {/* 2nd Place */}
                        <div className="order-2 md:order-1 bg-gradient-to-b from-slate-700/20 to-slate-900/40 border border-slate-500/30 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
                          <div className="w-12 h-12 rounded-full bg-slate-400/20 border-2 border-slate-300 text-slate-300 flex items-center justify-center font-black text-xl mb-3 shadow-lg">
                            🥈
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded-full mb-2">Rank #2 • Silver</span>
                          {leaderboard[1] ? (
                            <>
                              <h4 className="font-extrabold text-white text-base truncate max-w-full">
                                {leaderboard[1].student?.firstName} {leaderboard[1].student?.lastName}
                              </h4>
                              <p className="text-xs text-slate-400">{leaderboard[1].student?.city || 'Student'}</p>
                              <div className="mt-4 pt-3 border-t border-white/10 w-full flex justify-around">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Score</span>
                                  <span className="text-lg font-black text-white">{leaderboard[1].score ?? 0}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Time Taken</span>
                                  <span className="text-xs font-bold text-slate-300 mt-1 block">{leaderboard[1].durationMinutes} mins</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-4">Spot open</p>
                          )}
                        </div>

                        {/* 1st Place (Gold Champion) */}
                        <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 to-amber-950/40 border-2 border-amber-500/50 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-2xl shadow-amber-500/20 -translate-y-1">
                          <div className="absolute top-2 right-3">
                            <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Champion</span>
                          </div>
                          <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center font-black text-3xl mb-3 shadow-lg shadow-amber-500/30">
                            🥇
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full mb-2">Rank #1 • Gold</span>
                          {leaderboard[0] ? (
                            <>
                              <h4 className="font-black text-white text-lg truncate max-w-full">
                                {leaderboard[0].student?.firstName} {leaderboard[0].student?.lastName}
                              </h4>
                              <p className="text-xs text-amber-200/80">{leaderboard[0].student?.city || 'Top Performer'}</p>
                              <div className="mt-4 pt-3 border-t border-amber-500/30 w-full flex justify-around">
                                <div>
                                  <span className="text-[10px] text-amber-300/70 uppercase font-bold block">Score</span>
                                  <span className="text-2xl font-black text-amber-300">{leaderboard[0].score ?? 0}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-amber-300/70 uppercase font-bold block">Time Taken</span>
                                  <span className="text-xs font-bold text-white mt-1 block">{leaderboard[0].durationMinutes} mins</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-4">Spot open</p>
                          )}
                        </div>

                        {/* 3rd Place */}
                        <div className="order-3 md:order-3 bg-gradient-to-b from-amber-900/20 to-stone-900/40 border border-amber-700/30 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
                          <div className="w-12 h-12 rounded-full bg-amber-700/20 border-2 border-amber-600 text-amber-500 flex items-center justify-center font-black text-xl mb-3 shadow-lg">
                            🥉
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-white/5 px-2 py-0.5 rounded-full mb-2">Rank #3 • Bronze</span>
                          {leaderboard[2] ? (
                            <>
                              <h4 className="font-extrabold text-white text-base truncate max-w-full">
                                {leaderboard[2].student?.firstName} {leaderboard[2].student?.lastName}
                              </h4>
                              <p className="text-xs text-slate-400">{leaderboard[2].student?.city || 'Student'}</p>
                              <div className="mt-4 pt-3 border-t border-white/10 w-full flex justify-around">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Score</span>
                                  <span className="text-lg font-black text-white">{leaderboard[2].score ?? 0}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Time Taken</span>
                                  <span className="text-xs font-bold text-slate-300 mt-1 block">{leaderboard[2].durationMinutes} mins</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500 italic py-4">Spot open</p>
                          )}
                        </div>
                      </div>

                      {/* COMPLETE RANKINGS TABLE */}
                      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-300">All Leaderboard Standings</span>
                          <span className="text-xs font-bold text-slate-400">Total Participants: {leaderboard.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] bg-white/[0.02]">
                                <th className="p-3.5 text-center w-16">Rank</th>
                                <th className="p-3.5">Student</th>
                                <th className="p-3.5">City</th>
                                <th className="p-3.5">Time Taken</th>
                                {paperType === 'BOTH' && <th className="p-3.5">MCQ Pts</th>}
                                {paperType === 'BOTH' && <th className="p-3.5">Essay Pts</th>}
                                <th className="p-3.5">Final Score</th>
                                <th className="p-3.5 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                              {leaderboard.map((entry) => {
                                const isTop3 = entry.rank <= 3;
                                return (
                                  <tr key={entry.id} className={`hover:bg-white/[0.03] transition-colors ${entry.rank === 1 ? 'bg-amber-500/5' : ''}`}>
                                    <td className="p-3.5 text-center">
                                      {entry.rank === 1 && <span className="font-black text-amber-400 text-sm">🥇 #1</span>}
                                      {entry.rank === 2 && <span className="font-black text-slate-300 text-sm">🥈 #2</span>}
                                      {entry.rank === 3 && <span className="font-black text-amber-600 text-sm">🥉 #3</span>}
                                      {entry.rank > 3 && (
                                        <span className="font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                                          #{entry.rank}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${isTop3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-600/30 text-blue-300'}`}>
                                        {entry.student?.firstName?.charAt(0) || 'S'}
                                      </div>
                                      <div>
                                        <p className="leading-tight font-extrabold">{entry.student?.firstName} {entry.student?.lastName}</p>
                                        <span className="text-[10px] text-slate-500">ID #{entry.student?.id}</span>
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-slate-400">
                                      {entry.student?.city || '-'}
                                    </td>
                                    <td className="p-3.5 text-slate-300 font-semibold">
                                      {entry.durationMinutes} mins
                                    </td>
                                    {paperType === 'BOTH' && (
                                      <td className="p-3.5 text-emerald-400 font-bold">
                                        {entry.mcqScore ?? '-'}
                                      </td>
                                    )}
                                    {paperType === 'BOTH' && (
                                      <td className="p-3.5 text-purple-300 font-bold">
                                        {entry.structuredScore ?? 'Ungraded'}
                                      </td>
                                    )}
                                    <td className="p-3.5">
                                      <span className={`text-base font-black ${entry.rank === 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {entry.score ?? 0}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-right">
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                                        {entry.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Lightbox Preview Modal */}
        {previewImageUrl && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon size={15} className="text-emerald-400" /> Image Preview
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center overflow-auto max-h-[80vh] bg-black/40">
                <img
                  src={previewImageUrl}
                  alt="Figure Preview"
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* AI PDF MCQ Extractor Modal */}
        <AiPdfMcqExtractorModal
          isOpen={showAiPdfModal}
          onClose={() => setShowAiPdfModal(false)}
          onImportQuestions={handleImportExtractedQuestions}
          existingQuestionsCount={questions.length}
        />

      </div>
    </div>
  );
}


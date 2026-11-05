import React, { useState, useRef, useEffect } from 'react';
import {
  X, UploadCloud, FileText, Sparkles, CheckCircle2, AlertCircle,
  RefreshCw, Plus, Trash2, Check, ArrowRight, Eye, HelpCircle,
  Layers, ChevronDown, ChevronUp, StopCircle, Key, Zap, Edit3,
  Search, ShieldAlert, Sparkle, DownloadCloud, CheckCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

export default function AiPdfMcqExtractorModal({
  isOpen,
  onClose,
  onImportQuestions,
  existingQuestionsCount = 0
}) {
  const [pdfFile, setPdfFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const fileInputRef = useRef(null);

  // Pre-parsed PDF session on backend
  const [preparsedSession, setPreparsedSession] = useState(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Gemini API Key management
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('user_gemini_api_key') || '';
  });
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [saveAsDefaultKey, setSaveAsDefaultKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState(null); // { valid: boolean, message: string }

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [progress, setProgress] = useState({
    status: 'idle', // 'idle' | 'reading_pdf' | 'processing' | 'completed' | 'error' | 'key_error'
    currentPage: 0,
    totalPages: 0,
    message: '',
    logs: []
  });

  // Extracted Questions Workspace (Live & Interactive)
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [selectedPageFilter, setSelectedPageFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const logsEndRef = useRef(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.logs]);

  if (!isOpen) return null;

  // Handle PDF file selection and immediate backend pre-parse
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a valid PDF file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds 50MB limit.');
      return;
    }

    setPdfFile(file);
    setFileDetails({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
    });
    setExtractedQuestions([]);
    setPreparsedSession(null);

    // Pre-parse PDF on server using standard Axios
    setIsUploadingPdf(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setProgress({
      status: 'reading_pdf',
      currentPage: 0,
      totalPages: 0,
      message: 'Analyzing PDF structure and page count...',
      logs: [{ time: timeStr, text: `Analyzing "${file.name}"...`, type: 'info' }]
    });

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await api.post('/papers/ai-upload-mcq-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setPreparsedSession({
          fileId: res.data.fileId,
          totalPages: res.data.totalPages,
          fileName: res.data.fileName
        });

        setProgress({
          status: 'idle',
          currentPage: 0,
          totalPages: res.data.totalPages,
          message: `PDF ready! Analyzed ${res.data.totalPages} page(s). Click "Start AI Extraction" to begin.`,
          logs: [
            { time: timeStr, text: `Uploaded "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, type: 'info' },
            { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: `Analyzed ${res.data.totalPages} page(s) successfully. Ready to extract!`, type: 'success' }
          ]
        });
        toast.success(`PDF analyzed! ${res.data.totalPages} page(s) ready.`);
      } else {
        throw new Error(res.data?.error || 'Failed to parse PDF');
      }
    } catch (err) {
      console.error('PDF pre-parse error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to upload and parse PDF';
      setProgress({
        status: 'error',
        currentPage: 0,
        totalPages: 0,
        message: errMsg,
        logs: [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: `❌ ${errMsg}`, type: 'error' }]
      });
      toast.error(errMsg);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Test Gemini API Key
  const handleTestApiKey = async () => {
    if (!customApiKey || !customApiKey.trim()) {
      toast.error('Please enter an API key to test.');
      return;
    }

    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await api.post('/papers/gemini-key/test', { apiKey: customApiKey.trim() });
      if (res.data?.valid) {
        setKeyTestStatus({ valid: true, message: 'API Key is active and verified working!' });
        toast.success('Gemini API Key verified working!');
      } else {
        setKeyTestStatus({ valid: false, message: res.data?.error || 'Key verification failed.' });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Key test failed.';
      setKeyTestStatus({ valid: false, message: msg });
      toast.error(msg);
    } finally {
      setIsTestingKey(false);
    }
  };

  // Process SSE Events from Backend
  const handleSseEvent = (eventType, data) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    switch (eventType) {
      case 'init':
        setProgress(prev => ({
          ...prev,
          status: 'processing',
          totalPages: data.totalPages,
          message: data.message || `Loaded PDF with ${data.totalPages} page(s).`,
          logs: [...prev.logs, { time: timeStr, text: `Loaded ${data.fileName} (${data.totalPages} pages)`, type: 'info' }]
        }));
        break;

      case 'page_start':
        setProgress(prev => ({
          ...prev,
          currentPage: data.pageNumber,
          totalPages: data.totalPages,
          message: `Reading & analyzing Page ${data.pageNumber} of ${data.totalPages}...`,
          logs: [...prev.logs, { time: timeStr, text: `⚡ Processing Page ${data.pageNumber} of ${data.totalPages}...`, type: 'info' }]
        }));
        break;

      case 'questions_chunk':
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setExtractedQuestions(prev => {
            const nextQuestions = [...prev];
            data.questions.forEach(newQ => {
              nextQuestions.push({
                ...newQ,
                questionNo: nextQuestions.length + 1,
                isReviewed: false
              });
            });
            return nextQuestions;
          });

          setProgress(prev => ({
            ...prev,
            message: `Extracted ${data.questions.length} question(s) from Page ${data.pageNumber}!`,
            logs: [...prev.logs, { time: timeStr, text: `✅ Page ${data.pageNumber}: Extracted ${data.questions.length} question(s) (Total: ${data.totalSoFar})`, type: 'success' }]
          }));
        }
        break;

      case 'page_skip':
      case 'page_no_questions':
        setProgress(prev => ({
          ...prev,
          logs: [...prev.logs, { time: timeStr, text: `ℹ️ ${data.message}`, type: 'info' }]
        }));
        break;

      case 'page_error':
        setProgress(prev => ({
          ...prev,
          logs: [...prev.logs, { time: timeStr, text: `⚠️ Page ${data.pageNumber}: ${data.error}`, type: 'warn' }]
        }));
        break;

      case 'key_error':
        setShowApiKeySetting(true);
        setProgress(prev => ({
          ...prev,
          status: 'key_error',
          message: data.message || 'Gemini API key error. Please enter an active API key below.',
          logs: [...prev.logs, { time: timeStr, text: `🔑 ${data.message}`, type: 'error' }]
        }));
        toast.error('Gemini API key quota depleted or invalid. Please provide an active key.', { duration: 6000 });
        break;

      case 'complete':
        setProgress(prev => ({
          ...prev,
          status: 'completed',
          message: `All ${data.totalPages} page(s) processed! Extracted ${data.totalExtractedQuestions} MCQ questions.`,
          logs: [...prev.logs, { time: timeStr, text: `🎉 Completed! Total ${data.totalExtractedQuestions} question(s) ready for review.`, type: 'success' }]
        }));
        toast.success(`Awesome! Extracted ${data.totalExtractedQuestions} MCQ questions!`, { icon: '🎉', duration: 5000 });
        break;

      case 'fatal_error':
      case 'error':
        setProgress(prev => ({
          ...prev,
          status: 'error',
          message: data.message || 'Error occurred during extraction.',
          logs: [...prev.logs, { time: timeStr, text: `❌ ${data.message || 'Fatal error occurred'}`, type: 'error' }]
        }));
        toast.error(data.message || 'Failed to extract questions');
        break;

      default:
        break;
    }
  };

  // Start Real-Time AI Extraction
  const handleStartExtraction = async () => {
    if (!pdfFile) {
      toast.error('Please upload a PDF question paper first.');
      return;
    }

    // If PDF was not pre-parsed yet, do it now
    let fileIdToUse = preparsedSession?.fileId;
    if (!fileIdToUse) {
      try {
        setIsUploadingPdf(true);
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        const res = await api.post('/papers/ai-upload-mcq-pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data?.success) {
          fileIdToUse = res.data.fileId;
          setPreparsedSession({
            fileId: res.data.fileId,
            totalPages: res.data.totalPages,
            fileName: res.data.fileName
          });
        } else {
          throw new Error('Failed to analyze PDF file');
        }
      } catch (err) {
        toast.error(err.response?.data?.error || err.message || 'Failed to prepare PDF');
        setIsUploadingPdf(false);
        return;
      } finally {
        setIsUploadingPdf(false);
      }
    }

    setIsExtracting(true);
    setExtractedQuestions([]);
    setProgress({
      status: 'processing',
      currentPage: 0,
      totalPages: preparsedSession?.totalPages || 0,
      message: 'Connecting to AI Extractor stream...',
      logs: [{ time: new Date().toLocaleTimeString(), text: `Starting extraction for "${fileDetails?.name || 'PDF'}"...`, type: 'info' }]
    });

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Save custom key if requested
      if (saveAsDefaultKey && customApiKey && customApiKey.trim()) {
        api.post('/papers/gemini-key', { apiKey: customApiKey.trim() }).catch(() => {});
        localStorage.setItem('user_gemini_api_key', customApiKey.trim());
      } else if (customApiKey && customApiKey.trim()) {
        localStorage.setItem('user_gemini_api_key', customApiKey.trim());
      }

      const token = localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('admin_token');
      
      // Determine backend URL matching axios configuration
      const rawBase = api.defaults.baseURL || '/api';
      const streamEndpoint = rawBase.replace(/\/api\/?$/, '') + '/api/papers/ai-extract-mcq-stream';

      const response = await fetch(streamEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          fileId: fileIdToUse,
          customApiKey: customApiKey && customApiKey.trim() ? customApiKey.trim() : null
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6).trim();
            }
          }

          if (dataStr) {
            try {
              const parsedData = JSON.parse(dataStr);
              handleSseEvent(eventType, parsedData);
            } catch (jsonErr) {
              console.error('SSE JSON error:', jsonErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        toast('Extraction stopped.', { icon: '⏹️' });
        setProgress(prev => ({
          ...prev,
          status: 'idle',
          message: 'Extraction stopped by user.',
          logs: [...prev.logs, { time: new Date().toLocaleTimeString(), text: 'Extraction stopped by user.', type: 'warn' }]
        }));
      } else {
        console.error('Extraction error:', err);
        setProgress(prev => ({
          ...prev,
          status: 'error',
          message: err.message || 'Failed to extract questions',
          logs: [...prev.logs, { time: new Date().toLocaleTimeString(), text: err.message || 'Error occurred', type: 'error' }]
        }));
        toast.error(err.message || 'Extraction failed');
      }
    } finally {
      setIsExtracting(false);
      setAbortController(null);
    }
  };

  const handleStopExtraction = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  // Live Question Editing Helpers
  const handleUpdateQuestionText = (index, text) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], questionText: text };
      return updated;
    });
  };

  const handleSetCorrectOption = (qIdx, optIdx) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIdx];
      const updatedOptions = q.options.map((opt, i) => ({
        ...opt,
        isCorrect: i === optIdx
      }));
      updated[qIdx] = { ...q, options: updatedOptions };
      return updated;
    });
  };

  const handleUpdateOptionText = (qIdx, optIdx, text) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIdx];
      const updatedOptions = [...q.options];
      updatedOptions[optIdx] = { ...updatedOptions[optIdx], optionText: text };
      updated[qIdx] = { ...q, options: updatedOptions };
      return updated;
    });
  };

  const handleAddOption = (qIdx) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIdx];
      const nextOptNo = q.options.length + 1;
      const updatedOptions = [
        ...q.options,
        { optionNo: nextOptNo, optionText: '', isCorrect: false }
      ];
      updated[qIdx] = { ...q, options: updatedOptions };
      return updated;
    });
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      const q = updated[qIdx];
      if (q.options.length <= 2) {
        toast.error('Question must have at least 2 options.');
        return prev;
      }
      const updatedOptions = q.options.filter((_, i) => i !== optIdx).map((o, idx) => ({ ...o, optionNo: idx + 1 }));
      if (!updatedOptions.some(o => o.isCorrect)) {
        updatedOptions[0].isCorrect = true;
      }
      updated[qIdx] = { ...q, options: updatedOptions };
      return updated;
    });
  };

  const handleRemoveQuestion = (qIdx) => {
    setExtractedQuestions(prev => {
      return prev.filter((_, i) => i !== qIdx).map((q, i) => ({ ...q, questionNo: i + 1 }));
    });
    toast.success('Question removed.');
  };

  const handleToggleReviewed = (qIdx) => {
    setExtractedQuestions(prev => {
      const updated = [...prev];
      updated[qIdx] = { ...updated[qIdx], isReviewed: !updated[qIdx].isReviewed };
      return updated;
    });
  };

  // Transfer extracted questions to paper builder
  const handleApplyToPaper = (mode = 'append') => {
    if (extractedQuestions.length === 0) {
      toast.error('No extracted questions to import.');
      return;
    }

    const invalidQ = extractedQuestions.find(q => !q.questionText.trim());
    if (invalidQ) {
      toast.error(`Question #${invalidQ.questionNo} has empty text. Please enter or delete it.`);
      return;
    }

    onImportQuestions(extractedQuestions, mode);
    toast.success(`Successfully imported ${extractedQuestions.length} MCQ questions into paper! 🎉`);
    onClose();
  };

  // Filtered Questions
  const filteredQuestions = extractedQuestions.filter(q => {
    if (selectedPageFilter !== 'ALL' && q.extractedFromPage !== selectedPageFilter) {
      return false;
    }
    if (searchFilter.trim()) {
      const query = searchFilter.toLowerCase();
      const inText = (q.questionText || '').toLowerCase().includes(query);
      const inOptions = (q.options || []).some(o => (o.optionText || '').toLowerCase().includes(query));
      return inText || inOptions;
    }
    return true;
  });

  // Calculate percentage
  const progressPercent = progress.totalPages > 0 
    ? Math.round((progress.currentPage / progress.totalPages) * 100) 
    : (progress.status === 'completed' ? 100 : 0);

  // Unique extracted pages
  const extractedPagesList = Array.from(new Set(extractedQuestions.map(q => q.extractedFromPage).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl bg-[#090d16] border border-white/15 rounded-2xl md:rounded-[2rem] shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col h-[92vh] max-h-[920px] overflow-hidden">
        
        {/* 🔥 HEADER BAR 🔥 */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-[#0d1527] to-slate-950 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <Sparkles size={20} className="text-yellow-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  AI MCQ Extractor from PDF
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Gemini Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload any exam paper PDF to automatically extract questions and answers page by page in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExtracting}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              title="Close extractor"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* 🪟 2-COLUMN SPLIT WORKSPACE: LEFT (CONTROLLER) | RIGHT (LIVE QUESTIONS) 🪟 */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-white/10">

          {/* 👈 LEFT COLUMN: PDF UPLOADER & REAL-TIME PROGRESS CONTROLLER (4.5 COLS) */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar bg-slate-950/40">
            
            {/* 1. PDF FILE DROPZONE */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-400" />
                <span>Select Question Paper PDF *</span>
              </label>

              <div
                onClick={() => !isExtracting && !isUploadingPdf && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  pdfFile 
                    ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-400' 
                    : 'border-white/15 bg-black/30 hover:border-indigo-500/50 hover:bg-white/[0.02]'
                } ${isExtracting || isUploadingPdf ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isExtracting || isUploadingPdf}
                />

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform ${pdfFile ? 'bg-emerald-500/20 text-emerald-400 scale-105' : 'bg-white/5 text-slate-400'}`}>
                  {isUploadingPdf ? (
                    <Loader2 size={24} className="animate-spin text-purple-400" />
                  ) : pdfFile ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <UploadCloud size={24} />
                  )}
                </div>

                {pdfFile ? (
                  <div>
                    <p className="text-sm font-bold text-white max-w-[280px] truncate" title={fileDetails?.name}>
                      {fileDetails?.name}
                    </p>
                    <p className="text-xs text-emerald-400 font-medium mt-0.5">
                      {isUploadingPdf ? 'Analyzing PDF...' : preparsedSession ? `Ready to extract • ${preparsedSession.totalPages} page(s) • ${fileDetails?.size}` : `Ready to extract • ${fileDetails?.size}`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">
                      Click to Browse or Drag & Drop PDF
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Supports up to 50MB (English, Sinhala, Tamil MCQs)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. GEMINI API KEY ACCORDION */}
            <div className={`rounded-xl border transition-all overflow-hidden ${progress.status === 'key_error' ? 'border-amber-500/60 bg-amber-500/10' : 'border-white/10 bg-black/20'}`}>
              <button
                type="button"
                onClick={() => setShowApiKeySetting(!showApiKeySetting)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Key size={13} className={progress.status === 'key_error' ? 'text-amber-400 animate-bounce' : 'text-amber-400'} />
                  <span>Gemini API Key Settings {customApiKey ? '• (Custom Key Set)' : '(Optional)'}</span>
                </div>
                {showApiKeySetting ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showApiKeySetting && (
                <div className="p-3.5 pt-0 space-y-2.5 border-t border-white/5 text-xs">
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Enter your Google AI Studio Gemini API Key (`AIza...`). If the default system key is out of quota, your custom key will be used:
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => {
                        setCustomApiKey(e.target.value);
                        setKeyTestStatus(null);
                      }}
                      placeholder="AIzaSy..."
                      disabled={isExtracting}
                      className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={isTestingKey || !customApiKey.trim()}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {isTestingKey ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="text-amber-400" />}
                      <span>Test</span>
                    </button>
                  </div>

                  {keyTestStatus && (
                    <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${keyTestStatus.valid ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                      {keyTestStatus.valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      <span className="leading-tight">{keyTestStatus.message}</span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={saveAsDefaultKey}
                      onChange={(e) => setSaveAsDefaultKey(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-indigo-500 focus:ring-0"
                    />
                    <span>Save this key to system settings for all paper extractions</span>
                  </label>
                </div>
              )}
            </div>

            {/* 3. EXTRACTION ACTION BUTTONS */}
            <div className="flex gap-2">
              {!isExtracting ? (
                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={!pdfFile || isUploadingPdf}
                  className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                  <span>Start AI Extraction</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopExtraction}
                  className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <StopCircle size={16} />
                  <span>Stop Extraction</span>
                </button>
              )}
            </div>

            {/* 4. REAL-TIME PROGRESS & LIVE LOG WIDGET */}
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-3.5 sm:p-4 flex flex-col gap-3 min-h-[220px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isExtracting ? 'bg-amber-400 animate-ping' : progress.status === 'completed' ? 'bg-emerald-400' : progress.status === 'key_error' ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`}></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Status
                  </span>
                </div>
                {progress.totalPages > 0 && (
                  <span className="text-xs font-mono font-bold text-purple-300">
                    Page {progress.currentPage} / {progress.totalPages} ({progressPercent}%)
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {/* Status Message */}
              <div className="text-xs font-medium text-slate-200 bg-white/5 p-2 rounded-xl border border-white/5 flex items-center gap-2">
                {isExtracting ? (
                  <RefreshCw size={13} className="animate-spin text-purple-400 shrink-0" />
                ) : progress.status === 'completed' ? (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                ) : progress.status === 'key_error' ? (
                  <Key size={13} className="text-amber-400 shrink-0 animate-bounce" />
                ) : (
                  <HelpCircle size={13} className="text-slate-400 shrink-0" />
                )}
                <span className="truncate">{progress.message || 'Waiting for PDF to start...'}</span>
              </div>

              {/* Live Activity Timeline Log */}
              <div className="flex-1 bg-black/50 rounded-xl p-2.5 overflow-y-auto font-mono text-[11px] space-y-1.5 border border-white/5 max-h-[160px] custom-scrollbar">
                {progress.logs.length === 0 ? (
                  <p className="text-slate-600 text-center py-4">No activity yet.</p>
                ) : (
                  progress.logs.map((log, lIdx) => (
                    <div key={lIdx} className="flex items-start gap-1.5 leading-tight">
                      <span className="text-slate-500 text-[10px] shrink-0">[{log.time}]</span>
                      <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'}>
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>

          {/* 👉 RIGHT COLUMN: LIVE INTERACTIVE QUESTIONS WORKSPACE (7.5 COLS) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden bg-slate-950/20">
            
            {/* WORKSPACE TOP CONTROLS */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs font-black">
                  {extractedQuestions.length}
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Live Extracted Questions
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isExtracting ? 'AI is extracting questions live. You can edit them below right now!' : 'Review question statements and correct choices.'}
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {extractedPagesList.length > 1 && (
                  <select
                    value={selectedPageFilter}
                    onChange={(e) => setSelectedPageFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    className="bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="ALL">All Pages ({extractedQuestions.length})</option>
                    {extractedPagesList.map(p => (
                      <option key={p} value={p}>Page {p}</option>
                    ))}
                  </select>
                )}

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search questions..."
                    className="bg-black/40 border border-white/15 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none w-36 sm:w-44 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* QUESTIONS SCROLLABLE LIST */}
            <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">
              {filteredQuestions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 shadow-inner">
                    <Sparkles size={28} className={isExtracting ? "animate-spin" : ""} />
                  </div>
                  <h5 className="text-sm font-bold text-white mb-1">
                    {isExtracting ? 'AI is processing pages...' : 'No Extracted Questions Yet'}
                  </h5>
                  <p className="text-xs text-slate-400 max-w-sm">
                    {isExtracting 
                      ? 'Questions will appear here in real-time as each page finishes. You can start proofreading immediately!' 
                      : 'Select a PDF paper on the left and click "Start AI Extraction" to automatically read questions & answers.'}
                  </p>
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const actualIdx = extractedQuestions.findIndex(item => item.questionNo === q.questionNo);
                  return (
                    <div
                      key={q.questionNo}
                      className={`rounded-2xl border p-4 transition-all duration-200 relative ${
                        q.isReviewed 
                          ? 'bg-emerald-950/20 border-emerald-500/30' 
                          : 'bg-black/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Question Top Bar */}
                      <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-xs">
                            #{q.questionNo}
                          </span>
                          {q.extractedFromPage && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                              Page {q.extractedFromPage}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleReviewed(actualIdx)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              q.isReviewed 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                            }`}
                            title="Mark as reviewed / proofread"
                          >
                            <Check size={11} />
                            <span>{q.isReviewed ? 'Reviewed' : 'Mark Reviewed'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(actualIdx)}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete this question"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question Statement Input */}
                      <div className="space-y-1.5 mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Edit3 size={11} className="text-purple-400" />
                          <span>Question Statement</span>
                        </label>
                        <textarea
                          rows={2}
                          value={q.questionText}
                          onChange={(e) => handleUpdateQuestionText(actualIdx, e.target.value)}
                          placeholder="Type or edit question..."
                          className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-all resize-y"
                        />
                      </div>

                      {/* Options / Answers Grid */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Answer Choices (Click radio icon to set correct answer):
                          </label>
                          {q.options.length < 5 && (
                            <button
                              type="button"
                              onClick={() => handleAddOption(actualIdx)}
                              className="text-[10px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-0.5"
                            >
                              <Plus size={11} /> Add Option
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                opt.isCorrect 
                                  ? 'bg-emerald-500/10 border-emerald-500/40' 
                                  : 'bg-black/30 border-white/5 hover:border-white/10'
                              }`}
                            >
                              {/* Correct Radio Selector */}
                              <button
                                type="button"
                                onClick={() => handleSetCorrectOption(actualIdx, optIdx)}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                  opt.isCorrect 
                                    ? 'bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/30' 
                                    : 'bg-white/5 text-slate-400 border border-white/10 hover:border-emerald-500/40'
                                }`}
                                title={opt.isCorrect ? "Correct answer" : "Click to mark as correct answer"}
                              >
                                {opt.isCorrect ? <CheckCircle2 size={13} /> : <span className="text-[10px] font-bold">{optIdx + 1}</span>}
                              </button>

                              <input
                                type="text"
                                value={opt.optionText}
                                onChange={(e) => handleUpdateOptionText(actualIdx, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}...`}
                                className="flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-600 outline-none"
                              />

                              {opt.isCorrect && (
                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                                  Correct
                                </span>
                              )}

                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(actualIdx, optIdx)}
                                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors shrink-0 cursor-pointer"
                                  title="Remove option"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* WORKSPACE BOTTOM ACTIONS */}
            <div className="p-3.5 sm:p-4 bg-slate-950/80 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Total Ready: <strong className="text-white font-black">{extractedQuestions.length}</strong> questions</span>
                {existingQuestionsCount > 0 && (
                  <span className="text-[11px] text-slate-500">(Paper currently has {existingQuestionsCount} questions)</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {existingQuestionsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleApplyToPaper('replace')}
                    disabled={extractedQuestions.length === 0}
                    className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Replace Existing ({existingQuestionsCount})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleApplyToPaper('append')}
                  disabled={extractedQuestions.length === 0}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  <ArrowRight size={15} />
                  <span>
                    {existingQuestionsCount > 0 ? `Append ${extractedQuestions.length} to Paper` : `Import ${extractedQuestions.length} Questions`}
                  </span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

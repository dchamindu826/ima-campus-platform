import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  Sparkles,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  BrainCircuit,
  Film,
  ListOrdered,
  BookOpen,
  Sliders,
  Layers,
  FileSpreadsheet,
  Video,
  UploadCloud,
  Music,
  FileAudio,
  Key,
  X,
  ShieldCheck,
  Info,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const YoutubeIcon = ({ className = "w-5 h-5", size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function YouTubeTranscriber({ loggedInUser }) {
  // Role check
  const roleUpper = (loggedInUser?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
  const isAuthorized = [
    'SYSTEM_ADMIN',
    'DIRECTOR',
    'SUPER',
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER'
  ].includes(roleUpper);

  // States
  const [inputType, setInputType] = useState('youtube'); // 'youtube' | 'upload'
  const [audioFile, setAudioFile] = useState(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookiesStatus, setCookiesStatus] = useState(null);
  const [cookiesInput, setCookiesInput] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookieFile, setCookieFile] = useState(null);

  const [url, setUrl] = useState('');
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [engine, setEngine] = useState('gemini'); // 'gemini' | 'auto'
  const [generateSummary, setGenerateSummary] = useState(true);

  // Active Job State
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobState, setJobState] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollIntervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const cookieFileInputRef = useRef(null);

  // Result Display States
  const [activeTab, setActiveTab] = useState('segments'); // 'segments' | 'fulltext' | 'summary'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedType, setCopiedType] = useState(null); // 'plain' | 'timestamps' | null
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Stop polling on unmount
  useEffect(() => {
    fetchCookiesStatus();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const fetchCookiesStatus = async () => {
    try {
      const res = await api.get('/youtube-transcribe/cookies-status');
      if (res.data) {
        setCookiesStatus(res.data);
      }
    } catch (e) {
      console.warn('Failed to load cookie status:', e);
    }
  };

  const handleSaveCookies = async () => {
    if (!cookiesInput.trim() && !cookieFile) {
      toast.error('Please paste cookie text or select a yt_cookies.txt file.');
      return;
    }
    setIsSavingCookies(true);
    try {
      if (cookieFile) {
        const fd = new FormData();
        fd.append('cookieFile', cookieFile);
        await api.post('/youtube-transcribe/update-cookies', fd);
      } else {
        await api.post('/youtube-transcribe/update-cookies', { cookiesText: cookiesInput });
      }
      toast.success('YouTube cookies updated successfully!');
      setCookieModalOpen(false);
      setCookiesInput('');
      setCookieFile(null);
      fetchCookiesStatus();
    } catch (err) {
      console.error('Update cookies error:', err);
      toast.error(err.response?.data?.error || 'Failed to update cookies.');
    } finally {
      setIsSavingCookies(false);
    }
  };

  // Fetch Video Information
  const handleFetchInfo = async (overrideUrl) => {
    const targetUrl = (overrideUrl || url).trim();
    if (!targetUrl) {
      toast.error('Please enter a YouTube video URL.');
      return;
    }

    setFetchingInfo(true);
    setVideoInfo(null);
    try {
      const res = await api.get(`/youtube-transcribe/info?url=${encodeURIComponent(targetUrl)}`);
      if (res.data?.success) {
        setVideoInfo(res.data);
        toast.success('Video details loaded!');
      }
    } catch (err) {
      console.error('Info fetch error:', err);
      toast.error(err.response?.data?.error || 'Failed to load video details. Please verify the URL.');
    } finally {
      setFetchingInfo(false);
    }
  };

  // Start Background Transcription from YouTube
  const handleStartTranscribe = async () => {
    if (!videoInfo && !url) {
      toast.error('Please provide a valid YouTube link.');
      return;
    }

    setIsProcessing(true);
    setJobState({
      status: 'queued',
      progress: 5,
      stage: 'Initializing',
      message: 'Submitting transcription task to queue...'
    });

    try {
      const res = await api.post('/youtube-transcribe/start', {
        url: videoInfo?.url || url,
        engine,
        generateSummary,
        chunkMinutes: 15
      });

      if (res.data?.success && res.data?.jobId) {
        const jobId = res.data.jobId;
        setActiveJobId(jobId);
        toast.success('Transcription job started in background!');
        startPolling(jobId);
      }
    } catch (err) {
      console.error('Start transcription error:', err);
      setIsProcessing(false);
      toast.error(err.response?.data?.error || 'Failed to start transcription.');
    }
  };

  // Start Direct Audio File Upload
  const handleStartAudioUpload = async () => {
    if (!audioFile) {
      toast.error('Please select an audio file to upload.');
      return;
    }

    setIsProcessing(true);
    setJobState({
      status: 'queued',
      progress: 5,
      stage: 'Uploading File',
      message: `Uploading ${audioFile.name} (${(audioFile.size / (1024 * 1024)).toFixed(1)} MB)...`
    });

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', audioTitle.trim() || audioFile.name.replace(/\.[^/.]+$/, ''));
      formData.append('generateSummary', generateSummary);

      const res = await api.post('/youtube-transcribe/upload-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 25) / progressEvent.total);
            setJobState((prev) => ({
              ...prev,
              progress: Math.min(25, Math.max(5, percent)),
              message: `Uploading audio file: ${Math.round((progressEvent.loaded * 100) / progressEvent.total)}% complete...`
            }));
          }
        }
      });

      if (res.data?.success && res.data?.jobId) {
        const jobId = res.data.jobId;
        setActiveJobId(jobId);
        toast.success('Audio uploaded! Transcription started.');
        startPolling(jobId);
      }
    } catch (err) {
      console.error('Audio upload error:', err);
      setIsProcessing(false);
      toast.error(err.response?.data?.error || 'Failed to upload audio file.');
    }
  };

  // Polling Job Status
  const startPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/youtube-transcribe/status/${jobId}`);
        if (res.data?.success && res.data?.job) {
          const current = res.data.job;
          setJobState(current);

          if (current.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            toast.success('🎉 Transcription completed successfully!', { duration: 5000 });
          } else if (current.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsProcessing(false);
            toast.error(current.message || 'Transcription job failed.');
          }
        }
      } catch (pollErr) {
        console.warn('Status poll warning:', pollErr);
      }
    }, 2000);
  };


  // Copy plain text
  const handleCopyText = (withTimestamps = false) => {
    const result = jobState?.result;
    if (!result) return;

    let textToCopy = '';
    if (withTimestamps && Array.isArray(result.segments)) {
      textToCopy = result.segments
        .map((s) => `[${s.start}] ${s.text}`)
        .join('\n\n');
    } else {
      textToCopy = result.fullText || result.segments?.map((s) => s.text).join(' ');
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedType(withTimestamps ? 'timestamps' : 'plain');
    toast.success(withTimestamps ? 'Copied with timestamps!' : 'Copied plain text!');
    setTimeout(() => setCopiedType(null), 3000);
  };

  // Download Word Document (.docx)
  const handleDownloadDocx = async () => {
    const result = jobState?.result;
    if (!result) return;

    setIsExportingDocx(true);
    try {
      const response = await api.post(
        '/youtube-transcribe/export-docx',
        {
          title: result.metadata?.title || 'YouTube Transcription',
          channel: result.metadata?.channel || '',
          durationFormatted: result.metadata?.durationFormatted || '',
          url: result.url || url,
          summary: result.summary,
          keyTakeaways: result.keyTakeaways,
          segments: result.segments,
          fullText: result.fullText
        },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeTitle = (result.metadata?.title || 'Transcript')
        .replace(/[^a-zA-Z0-9_\u0D80-\u0DFF]/g, '_')
        .slice(0, 40);
      link.download = `${safeTitle}_Transcript.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Word Document downloaded successfully!');
    } catch (err) {
      console.error('Docx export error:', err);
      toast.error('Failed to export Word document.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Print or Save as PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // Download Plain Text
  const handleDownloadTxt = () => {
    const result = jobState?.result;
    if (!result) return;

    const content = `Title: ${result.metadata?.title || ''}\nChannel: ${result.metadata?.channel || ''}\nDuration: ${result.metadata?.durationFormatted || ''}\nURL: ${result.url || ''}\n\n====================\nSUMMARY\n====================\n${result.summary || 'N/A'}\n\n====================\nKEY TAKEAWAYS\n====================\n${(result.keyTakeaways || []).join('\n• ')}\n\n====================\nFULL TRANSCRIPT\n====================\n${(result.segments || []).map((s) => `[${s.start}] ${s.text}`).join('\n\n')}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${(result.metadata?.title || 'Transcript').slice(0, 30)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  };

  // Filter segments
  const filteredSegments = (jobState?.result?.segments || []).filter((s) => {
    if (!searchQuery.trim()) return true;
    return (s.text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           (s.start || '').includes(searchQuery);
  });

  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-400 mb-4">
            YouTube Transcriber is available to System Administrators & Directors only.
          </p>
        </div>
      </div>
    );
  }

  const result = jobState?.result;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/40 via-slate-900 to-indigo-950/40 border border-red-500/20 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold tracking-wide">
              <YoutubeIcon size={14} className="animate-pulse" />
              <span>YOUTUBE SINHALA AUDIO ENGINE</span>
              <span className="w-1 h-1 rounded-full bg-red-400" />
              <span className="text-amber-300 font-normal">Supports 3+ Hours Videos</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              YouTube AI Transcriber <Sparkles className="text-amber-400 w-7 h-7" />
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
              Paste any YouTube video link (Sinhala lectures, discussions, podcasts, seminars). Transcribe hours of continuous speech with Google Gemini 2.5 Flash, search instantly, and export as formatted Word or PDF documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
              <span className="text-xs text-slate-400 block mb-1">STT Model</span>
              <span className="text-sm font-extrabold text-emerald-400 flex items-center justify-center gap-1">
                <BrainCircuit size={16} /> Gemini 2.5
              </span>
            </div>
            <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
              <span className="text-xs text-slate-400 block mb-1">Max Duration</span>
              <span className="text-sm font-extrabold text-amber-400 flex items-center justify-center gap-1">
                <Clock size={16} /> Unlimited
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
        {/* Source Mode Tabs + Cookie Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 p-1.5 bg-slate-950/70 border border-white/10 rounded-2xl">
            <button
              type="button"
              onClick={() => setInputType('youtube')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                inputType === 'youtube'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <YoutubeIcon size={16} />
              <span>YouTube Video Link</span>
            </button>

            <button
              type="button"
              onClick={() => setInputType('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                inputType === 'upload'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud size={16} />
              <span>Direct Audio Upload</span>
              <span className="hidden md:inline-block bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold border border-emerald-500/30">
                100% Reliable
              </span>
            </button>
          </div>

          {/* YouTube Cookies Status / Button */}
          <button
            type="button"
            onClick={() => setCookieModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/50 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all self-end sm:self-auto"
            title="Manage YouTube Cookies"
          >
            <Key size={14} className="text-amber-400" />
            <span>YouTube Cookies</span>
            <span
              className={`w-2 h-2 rounded-full ${
                cookiesStatus?.hasYoutube ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>
        </div>

        {/* Tab 1: YouTube URL */}
        {inputType === 'youtube' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Film size={16} className="text-red-400" />
                Enter YouTube Video Link:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFetchInfo();
                    }}
                    disabled={isProcessing}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-2xl px-4 py-3.5 pl-11 text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 text-sm md:text-base transition-all"
                  />
                  <YoutubeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 w-5 h-5 pointer-events-none" />
                  {url && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrl('');
                        setVideoInfo(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs bg-slate-800 px-2 py-1 rounded-lg"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleFetchInfo()}
                  disabled={fetchingInfo || isProcessing || !url.trim()}
                  className="px-6 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {fetchingInfo ? (
                    <>
                      <RefreshCw className="animate-spin w-4 h-4" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Preview Video</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Direct Audio Upload */}
        {inputType === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const f = e.dataTransfer.files[0];
                  setAudioFile(f);
                  if (!audioTitle) setAudioTitle(f.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : audioFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-white/10 hover:border-blue-500/40 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/mp4,.mp3,.m4a,.wav,.aac,.ogg,.opus,.webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setAudioFile(f);
                    if (!audioTitle) setAudioTitle(f.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
              />

              {audioFile ? (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <FileAudio size={28} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base">{audioFile.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Sinhala Transcription
                    </p>
                  </div>
                  <span className="text-xs text-blue-400 underline font-medium">
                    Click or drop another file to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <h4 className="text-white font-extrabold text-base md:text-lg">
                      Click to Browse or Drag & Drop Lecture Audio
                    </h4>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">
                      Upload MP3, M4A, WAV, AAC, MP4, or OPUS files (Up to 500 MB, supports 3+ hour recordings)
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-white/10 text-[11px] text-slate-300">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span>Bypasses YouTube bot verification 100% guaranteed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Title Input for Audio File */}
            {audioFile && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-slate-300">
                  Lecture / Recording Title:
                </label>
                <input
                  type="text"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="e.g., Full Stack Web Development - Batch 10 - Day 01"
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Options Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
          <div className="flex items-center gap-3 bg-slate-950/40 border border-white/5 rounded-2xl p-3.5">
            <Sliders size={18} className="text-cyan-400 shrink-0" />
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-300 block">Transcription Engine</span>
              <span className="text-[11px] text-slate-500">Gemini 2.5 Flash guarantees 100% Sinhala speech precision</span>
            </div>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              disabled={isProcessing}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="gemini">Gemini 2.5 Flash AI (High Precision)</option>
              {inputType === 'youtube' && <option value="auto">Auto (Captions First ⚡)</option>}
            </select>
          </div>

          <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-2xl p-3.5">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-300 block">AI Summary & Key Takeaways</span>
                <span className="text-[11px] text-slate-500">Generate executive lecture summary & bullet points</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={generateSummary}
                onChange={(e) => setGenerateSummary(e.target.checked)}
                disabled={isProcessing}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Start Button for Direct Audio Upload */}
        {inputType === 'upload' && audioFile && !isProcessing && (
          <div className="pt-2 animate-fade-in">
            <button
              type="button"
              onClick={handleStartAudioUpload}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              <Play size={16} fill="white" />
              <span>Start Full Sinhala Transcription Now</span>
            </button>
          </div>
        )}

        {/* Video Preview Card for YouTube Input */}
        {inputType === 'youtube' && videoInfo && !isProcessing && !result && (
          <div className="mt-4 bg-slate-950/60 border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-6 items-start animate-fade-in">
            <div className="relative rounded-xl overflow-hidden w-full md:w-64 aspect-video bg-black/60 shrink-0 border border-white/10">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-xs px-2 py-0.5 rounded-md font-bold border border-white/20">
                {videoInfo.durationFormatted}
              </span>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider block">
                  {videoInfo.channel}
                </span>
                <h3 className="text-base md:text-lg font-bold text-white line-clamp-2">
                  {videoInfo.title}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 border border-white/5">
                  ⏱️ Length: <strong className="text-white">{videoInfo.durationFormatted}</strong>
                </span>
                {videoInfo.duration > 1800 && (
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg font-bold">
                    🔥 Long Video (Will auto-chunk with zero data loss)
                  </span>
                )}
                {videoInfo.hasSinhalaCaptions && (
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg">
                    ✅ Sinhala Captions Detected
                  </span>
                )}
                {videoInfo.botChallengeWarning && (
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    ⚠️ YouTube Protected Stream
                  </span>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartTranscribe}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                >
                  <Play size={16} fill="white" />
                  <span>Start Full Sinhala Transcription Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error & Troubleshooting Card */}
      {!isProcessing && jobState?.status === 'failed' && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-4 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs uppercase font-extrabold text-red-400 tracking-wider">
                Transcription Failed
              </span>
              <h3 className="text-lg font-bold text-white">
                Unable to complete transcription
              </h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                {jobState.message || 'An unexpected error occurred during transcription.'}
              </p>
            </div>
          </div>

          {/* Helpful suggestions & 1-click solutions */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <Info size={16} />
              <span>Recommended Solutions:</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              YouTube blocks media stream downloads on cloud server IP addresses for certain protected videos.
              You can transcribe this lecture immediately with zero restrictions by uploading its audio file directly:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setInputType('upload');
                  setJobState(null);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                <UploadCloud size={14} />
                <span>Switch to Direct Audio Upload (Recommended - 100% Reliable)</span>
              </button>

              <button
                type="button"
                onClick={() => setCookieModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs transition-all border border-amber-500/30 flex items-center gap-1.5"
              >
                <Key size={14} />
                <span>Update YouTube Cookies</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJobState(null);
                  if (inputType === 'youtube') handleStartTranscribe();
                  else handleStartAudioUpload();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Progress & Live Job Status */}
      {isProcessing && jobState && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RefreshCw className="animate-spin w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                  {jobState.stage || 'Processing'}
                </span>
                <h3 className="text-lg font-bold text-white">
                  Transcribing Sinhala Audio with Gemini AI
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-400">{jobState.progress}%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-white/10 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, jobState.progress)}%` }}
            />
          </div>

          <p className="text-sm text-slate-300 font-mono bg-slate-950/60 p-3 rounded-xl border border-white/5">
            {jobState.message || 'Please wait while Gemini processes the audio stream...'}
          </p>
        </div>
      )}


      {/* Results Studio Section */}
      {result && (
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {/* Result Header & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready
                </span>
                <span className="text-xs text-slate-400">
                  {result.stats?.totalSegments || 0} segments | ~{result.stats?.wordCount || 0} words
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white line-clamp-1">
                {result.metadata?.title || 'Video Transcript'}
              </h2>
              <span className="text-xs text-slate-400 block">
                Channel: <strong className="text-slate-300">{result.metadata?.channel}</strong> | Duration: <strong className="text-slate-300">{result.metadata?.durationFormatted}</strong>
              </span>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleCopyText(false)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
                title="Copy Plain Text"
              >
                {copiedType === 'plain' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedType === 'plain' ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyText(true)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
                title="Copy with Timestamps [00:15:20]"
              >
                {copiedType === 'timestamps' ? <Check size={14} className="text-emerald-400" /> : <Clock size={14} />}
                <span>{copiedType === 'timestamps' ? 'Copied Timed!' : 'Copy Timestamps'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={isExportingDocx}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                title="Download formatted Microsoft Word document (.docx)"
              >
                {isExportingDocx ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <FileText size={14} />}
                <span>{isExportingDocx ? 'Generating Word...' : 'Download Word (.docx)'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
                title="Save as PDF / Print"
              >
                <Printer size={14} />
                <span>Save as PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center gap-1.5 shadow-sm"
                title="Download plain text file"
              >
                <Download size={14} />
                <span>.TXT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVideoInfo(null);
                  setJobState(null);
                  setUrl('');
                }}
                className="px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-xs transition-all border border-red-500/20 flex items-center gap-1.5"
                title="Transcribe Another Video"
              >
                <RefreshCw size={14} />
                <span>New Video</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 sm:pb-0 sm:border-b-0">
              <button
                type="button"
                onClick={() => setActiveTab('segments')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'segments'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered size={14} />
                <span>Timed Transcript ({result.segments?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fulltext')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'fulltext'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen size={14} />
                <span>Continuous Reading View</span>
              </button>

              {result.summary && (
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'summary'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>AI Lecture Summary & Points</span>
                </button>
              )}
            </div>

            {/* In-Transcript Search */}
            {activeTab === 'segments' && (
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px]"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tab 1: Timed Segments */}
          {activeTab === 'segments' && (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredSegments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No segments found matching "{searchQuery}"
                </div>
              ) : (
                filteredSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-950/50 hover:bg-slate-950/90 border border-white/5 hover:border-blue-500/30 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-start gap-3"
                  >
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-xs font-bold shrink-0 self-start">
                      <Clock size={12} />
                      <span>{seg.start}</span>
                    </div>
                    <div className="flex-1 text-slate-200 text-sm md:text-base leading-relaxed select-text font-normal">
                      {seg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Continuous Full Text */}
          {activeTab === 'fulltext' && (
            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 max-h-[600px] overflow-y-auto custom-scrollbar select-text">
              <p className="text-slate-200 text-base leading-loose whitespace-pre-line font-normal">
                {result.fullText}
              </p>
            </div>
          )}

          {/* Tab 3: AI Summary & Takeaways */}
          {activeTab === 'summary' && result.summary && (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {/* Executive Summary */}
              <div className="bg-gradient-to-br from-amber-950/20 via-slate-950/80 to-slate-900 border border-amber-500/20 rounded-2xl p-6 space-y-3">
                <h3 className="text-base font-extrabold text-amber-300 flex items-center gap-2">
                  <Sparkles size={18} /> Executive Summary (දේශනයේ / වීඩියෝවේ සාරාංශය)
                </h3>
                <p className="text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-line select-text">
                  {result.summary}
                </p>
              </div>

              {/* Key Takeaways */}
              {Array.isArray(result.keyTakeaways) && result.keyTakeaways.length > 0 && (
                <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-extrabold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={18} /> Key Takeaways & Highlights (ප්‍රධාන සාකච්ඡා කරුණු)
                  </h3>
                  <ul className="space-y-2.5">
                    {result.keyTakeaways.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-slate-200 text-sm md:text-base select-text"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cookie Settings Modal */}
      {cookieModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setCookieModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Key size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">YouTube Cookies Management</h3>
                <p className="text-xs text-slate-400">
                  Update session cookies (yt_cookies.txt) to authenticate YouTube requests from cloud servers.
                </p>
              </div>
            </div>

            {/* Current Cookie Status Badge */}
            {cookiesStatus && (
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[11px] text-slate-400 block">File Exists</span>
                  <span className="text-xs font-bold text-white">
                    {cookiesStatus.exists ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">YouTube Cookies</span>
                  <span className={`text-xs font-bold ${cookiesStatus.hasYoutube ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {cookiesStatus.hasYoutube ? 'Active' : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Total Entries</span>
                  <span className="text-xs font-bold text-white font-mono">
                    {cookiesStatus.lineCount || 0} cookies
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Last Updated</span>
                  <span className="text-xs font-bold text-slate-300">
                    {cookiesStatus.lastModified
                      ? new Date(cookiesStatus.lastModified).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <span className="font-bold text-blue-300 flex items-center gap-1.5">
                <Info size={14} /> How to export fresh cookies in 30 seconds:
              </span>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 leading-relaxed">
                <li>Install the free browser extension: <strong>"Get cookies.txt LOCALLY"</strong> (Chrome / Firefox / Edge).</li>
                <li>Open <strong>https://www.youtube.com</strong> in your browser while signed into your Google/YouTube account.</li>
                <li>Click the extension icon, click <strong>Export</strong> (Netscape format), and copy the text or download the file.</li>
                <li>Paste the copied text below or upload the <code>yt_cookies.txt</code> file here.</li>
              </ol>
            </div>

            {/* File Upload or Textarea */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Upload yt_cookies.txt File or Paste Text:
                </label>
                <button
                  type="button"
                  onClick={() => cookieFileInputRef.current?.click()}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                >
                  <Upload size={12} />
                  <span>Select .txt file</span>
                </button>
              </div>

              <input
                ref={cookieFileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setCookieFile(e.target.files[0]);
                    toast.success(`Selected file: ${e.target.files[0].name}`);
                  }
                }}
              />

              {cookieFile ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-950/70 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-emerald-400" />
                    <span className="text-xs text-white font-medium">{cookieFile.name}</span>
                    <span className="text-[10px] text-slate-400">({(cookieFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCookieFile(null)}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  1820401885  SID  ...&#10;.youtube.com  TRUE  /  TRUE  1820401885  LOGIN_INFO  ..."
                  className="w-full bg-slate-950/70 border border-white/10 rounded-2xl p-3.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setCookieModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCookies}
                disabled={isSavingCookies || (!cookiesInput.trim() && !cookieFile)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-600/30 disabled:opacity-50"
              >
                {isSavingCookies ? <RefreshCw className="animate-spin w-4 h-4" /> : <Check size={14} />}
                <span>Save & Apply Cookies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Container for PDF / Window.print() */}

      <div className="hidden print:block print:text-black print:bg-white p-8">
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          {result?.metadata?.title || 'YouTube Video Transcription'}
        </h1>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '16px' }}>
          Channel: {result?.metadata?.channel} | Duration: {result?.metadata?.durationFormatted} | URL: {result?.url}
        </p>
        <hr style={{ marginBottom: '16px' }} />

        {result?.summary && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Executive Summary
            </h2>
            <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{result.summary}</p>
          </div>
        )}

        {result?.keyTakeaways && result.keyTakeaways.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Key Takeaways
            </h2>
            <ul>
              {result.keyTakeaways.map((k, i) => (
                <li key={i} style={{ fontSize: '14px', marginBottom: '6px' }}>
                  • {k}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            Transcript
          </h2>
          {(result?.segments || []).map((seg, i) => (
            <p key={i} style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '8px' }}>
              <strong>[{seg.start}]</strong> {seg.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
